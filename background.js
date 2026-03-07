// ── 캘린더 알림/URL 유틸 ──
function _calFormatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function _calFormatTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function _calTimeMinus5(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  let total = h * 60 + m - 5;
  if (total < 0) total += 24 * 60;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function _syncGet(keys) {
  return new Promise(r => whale.storage.sync.get(keys, r));
}
function _localGet(keys) {
  return new Promise(r => whale.storage.local.get(keys, r));
}
function _localSet(data) {
  return new Promise(r => whale.storage.local.set(data, r));
}

async function checkCalendarEvents() {
  const now = new Date();
  const dateStr = _calFormatDate(now);
  const timeStr = _calFormatTime(now);

  const syncData = await _syncGet([
    'calendar_notify_settings',
    'calendar_events',
    'calendar_ical_subs',
    'calendar_ical_annotations'
  ]);
  const localData = await _localGet(['calendar_ical_cache', 'cal_fired']);

  const urlOn = !syncData.calendar_notify_settings || syncData.calendar_notify_settings.url !== false;
  const manualEvents = syncData.calendar_events || [];
  const subs = syncData.calendar_ical_subs || [];
  const annot = syncData.calendar_ical_annotations || {};
  const icalCache = localData.calendar_ical_cache || {};

  // 오늘 날짜가 바뀌면 firedKeys 초기화
  const firedRaw = localData.cal_fired || {};
  const firedKeys = new Set(firedRaw.date === dateStr ? (firedRaw.keys || []) : []);
  const origSize = firedKeys.size;

  function notify(name, time) {
    whale.notifications.create(`cal_${Date.now()}`, {
      type: 'basic',
      iconUrl: 'assets/icons/icon48.png',
      title: '📅 일정 알림',
      message: `${name}\n${time} 시작 (5분 전)`,
      priority: 2
    });
  }

  // ── 수동 일정 ──
  manualEvents.filter(e => e.date === dateStr && e.time).forEach(evt => {
    if (evt.notify !== false) {
      const alertKey = `popup_manual_${evt.id}`;
      const alertTime = _calTimeMinus5(evt.time);
      if (alertTime === timeStr && !firedKeys.has(alertKey)) {
        firedKeys.add(alertKey);
        notify(evt.name, evt.time);
      }
    }
    if (urlOn && evt.url) {
      const urlKey = `url_manual_${evt.id}`;
      if (evt.time === timeStr && !firedKeys.has(urlKey)) {
        firedKeys.add(urlKey);
        whale.tabs.create({ url: evt.url, active: false });
      }
    }
  });

  // ── iCal 일정 ──
  subs.filter(s => s.enabled).forEach(sub => {
    const cached = icalCache[sub.id];
    if (!cached) return;
    (cached.events || []).filter(e => e.dtstart && e.dtstart.date === dateStr && e.dtstart.time).forEach(evt => {
      const annotKey = `${sub.id}|${evt.uid}`;
      const annotation = annot[annotKey];
      const notifyOn = annotation ? annotation.notify !== false : true;

      if (notifyOn) {
        const alertKey = `popup_ical_${sub.id}_${evt.uid}`;
        const alertTime = _calTimeMinus5(evt.dtstart.time);
        if (alertTime === timeStr && !firedKeys.has(alertKey)) {
          firedKeys.add(alertKey);
          notify(evt.summary || sub.name, evt.dtstart.time);
        }
      }
      if (urlOn && annotation && annotation.url) {
        const urlKey = `url_ical_${sub.id}_${evt.uid}`;
        if (evt.dtstart.time === timeStr && !firedKeys.has(urlKey)) {
          firedKeys.add(urlKey);
          whale.tabs.create({ url: annotation.url, active: false });
        }
      }
    });
  });

  if (firedKeys.size !== origSize) {
    await _localSet({ cal_fired: { date: dateStr, keys: [...firedKeys] } });
  }
}

// ── 알람 등록 ──
function _ensureAlarm() {
  whale.alarms.get('calendarCheck', alarm => {
    if (!alarm) whale.alarms.create('calendarCheck', { periodInMinutes: 1 });
  });
}

whale.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'calendarCheck') checkCalendarEvents();
});


// ── 확장앱 설치/시작 ──
whale.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  whale.contextMenus.create({
    id: 'addToMemo',
    title: '메모에 추가',
    contexts: ['selection']
  });
  _ensureAlarm();
});

whale.runtime.onStartup.addListener(() => {
  _ensureAlarm();
});

// 우클릭 → 메모에 추가
whale.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'addToMemo' && info.selectionText) {
    whale.storage.local.set({
      memo_append: { text: info.selectionText.trim(), ts: Date.now() }
    });
  }
});

// 사이드바/iframe에서 외부 URL fetch 요청 처리 (CORS 우회)
whale.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchUrl') {
    fetch(request.url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => sendResponse({ success: true, data: text }))
      .catch(err => sendResponse({ success: false, error: err.message }));

    // 비동기 응답을 위해 true 반환
    return true;
  }

  // Roll20 현재 탭에 매크로 추가
  if (request.action === 'addMacrosToRoll20') {
    (async () => {
      try {
        const allActiveTabs = await whale.tabs.query({ active: true });
        const tab = allActiveTabs.find(t =>
          t.url &&
          !t.url.startsWith('chrome-extension://') &&
          !t.url.startsWith('whale-extension://') &&
          !t.url.startsWith('about:')
        );
        if (!tab) {
          sendResponse({ success: false, error: 'Roll20 탭을 활성화해주세요.' });
          return;
        }

        const macros = request.macros;

        // Step 1: ISOLATED world에서 sessionStorage에 데이터 저장 (CSP 제약 없음)
        await whale.scripting.executeScript({
          target: { tabId: tab.id },
          func: (macrosData) => {
            sessionStorage.setItem('__r20Macros', JSON.stringify(macrosData));
          },
          args: [macros]
        });

        // Step 2: MAIN world에서 파일로 실행 (CSP 우회 - 파일은 inline script 아님)
        const results = await whale.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          files: ['roll20Helper.js']
        });

        const result = results && results[0] && results[0].result;
        sendResponse(result || { success: false, error: '알 수 없는 오류' });
      } catch (e) {
        // sendResponse({ success: false, error: e.message });
        sendResponse({ success: false, error: "Roll20 탭을 활성화해주세요." });
      }
    })();
    return true;
  }
});

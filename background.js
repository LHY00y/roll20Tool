// iCal 파서 로드 (서비스 워커에서 직접 파싱하기 위해)
importScripts('calendar/icalParser.js');

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

const ICAL_CACHE_TTL = 60 * 60 * 1000; // 1시간

/**
 * 백그라운드에서 직접 iCal 피드를 fetch·파싱해 캐시 갱신
 * 사이드바를 열지 않아도 알림이 동작하도록 보장
 */
async function _ensureIcalCache(subs, icalCache) {
  const now = new Date();
  const windowStart = new Date(now.getFullYear() - 1, 0, 1);
  const windowEnd = new Date(now.getFullYear() + 2, 11, 31);

  let updated = { ...icalCache };
  let changed = false;

  for (const sub of subs.filter(s => s.enabled)) {
    const entry = icalCache[sub.id];
    const stale = !entry || (Date.now() - entry.fetchedAt > ICAL_CACHE_TTL);
    if (!stale) continue;

    try {
      const res = await fetch(sub.icalUrl);
      if (!res.ok) continue;
      const text = await res.text();

      let events = ICalParser.parse(text);
      let expanded = [];
      events.forEach(evt => {
        const occs = evt.rrule
          ? ICalParser.expandRecurring(evt, windowStart, windowEnd)
          : [evt];
        occs.forEach(occ => {
          expanded = expanded.concat(ICalParser.expandMultiDay(occ));
        });
      });

      updated[sub.id] = {
        events: expanded,
        calendarName: ICalParser.getCalendarName(text) || sub.name,
        fetchedAt: Date.now()
      };
      changed = true;
    } catch (e) {
      console.warn(`[Cal] iCal fetch failed (${sub.name}):`, e.message);
    }
  }

  if (changed) {
    await _localSet({ calendar_ical_cache: updated });
  }
  return updated;
}

async function checkCalendarEvents() {
  try {
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


    // iCal 캐시 없거나 만료 시 백그라운드에서 직접 갱신
    const icalCache = subs.length
      ? await _ensureIcalCache(subs, localData.calendar_ical_cache || {})
      : {};

    // 오늘 날짜가 바뀌면 firedKeys 초기화
    const firedRaw = localData.cal_fired || {};
    const firedKeys = new Set(firedRaw.date === dateStr ? (firedRaw.keys || []) : []);
    const origSize = firedKeys.size;

    // 탭 열기 + 최소화된 창 복원·포커스
    function openTab(url) {
      whale.tabs.create({ url, active: true }, (tab) => {
        if (tab && tab.windowId) {
          whale.windows.update(tab.windowId, { focused: true, state: 'normal' });
        }
      });
    }

    function notify(name, time) {
      const iconUrl = whale.runtime.getURL('assets/icons/icon48.png');
      whale.notifications.create(`cal_${Date.now()}`, {
        type: 'basic',
        iconUrl,
        title: '📅 일정 알림',
        message: `${name}\n${time} 시작 (5분 전)`,
        priority: 2
      }, (id) => {
        if (whale.runtime.lastError) {
          console.error('[Cal] notification error:', whale.runtime.lastError.message);
        } else {
        }
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
        const urlTime = _calTimeMinus5(evt.time);
        if (urlTime === timeStr && !firedKeys.has(urlKey)) {
          firedKeys.add(urlKey);
          openTab(evt.url);
        }
      }
    });

    // ── iCal 일정 ──
    subs.filter(s => s.enabled).forEach(sub => {
      const cached = icalCache[sub.id];
      if (!cached) return;

      const todayEvts = (cached.events || []).filter(e => e.dtstart && e.dtstart.date === dateStr && e.dtstart.time);

      todayEvts.forEach(evt => {
        const alertTime = _calTimeMinus5(evt.dtstart.time);
        const annotKey = `${sub.id}|${evt.uid}`;
        const annotation = annot[annotKey];
        const notifyOn = annotation ? annotation.notify !== false : true;
        const alertKey = `popup_ical_${sub.id}_${evt.uid}_${evt.dtstart.time}`;
        const urlKey = `url_ical_${sub.id}_${evt.uid}_${evt.dtstart.time}`;

        if (alertTime === timeStr) {
          if (notifyOn && !firedKeys.has(alertKey)) {
            firedKeys.add(alertKey);
            notify(evt.summary || sub.name, evt.dtstart.time);
          } else {
            if (!notifyOn) console.warn(`[Cal] 알림 스킵: "${evt.summary}" → annotation.notify=false (일정 상세에서 알림 토글을 켜고 저장하세요)`);
            if (firedKeys.has(alertKey)) console.warn(`[Cal] 알림 스킵: "${evt.summary}" → 이미 발송됨 (firedKeys)`);
          }
          if (urlOn && annotation && annotation.url && !firedKeys.has(urlKey)) {
            firedKeys.add(urlKey);
            openTab(annotation.url);
          }
        }
      });
    });

    if (firedKeys.size !== origSize) {
      await _localSet({ cal_fired: { date: dateStr, keys: [...firedKeys] } });
    }
  } catch (e) {
    console.error('[Cal] checkCalendarEvents error:', e);
  }
}

// ── 알람 등록 ──
function _ensureAlarm() {
  whale.alarms.get('calendarCheck', alarm => {
    if (!alarm) whale.alarms.create('calendarCheck', { periodInMinutes: 1 });
  });
}

whale.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'calendarCheck') {
    checkCalendarEvents().catch(e => console.error('[Cal] alarm handler error:', e));
  }
});

// MV3 서비스 워커는 수시로 종료·재시작되므로
// 이벤트 리스너 등록과 함께 최상위에서 직접 알람 보장
_ensureAlarm();

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
    whale.sidebarAction.show();
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
        // Roll20 탭만 찾기
        const roll20Tabs = await whale.tabs.query({ url: ['*://app.roll20.net/*', '*://roll20.net/*'] });
        const tab = roll20Tabs.find(t => t.active) || roll20Tabs[0];
        if (!tab) {
          sendResponse({ success: false, error: 'Roll20 탭을 열어주세요.' });
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
          files: ['assets/js/roll20Helper.js']
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

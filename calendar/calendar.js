document.addEventListener('DOMContentLoaded', () => {
  const calTitle = document.getElementById('calTitle');
  const calBody = document.getElementById('calBody');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnToday = document.getElementById('btnToday');
  const btnSubs = document.getElementById('btnSubs');

  // 구독 패널
  const subsPanel = document.getElementById('subsPanel');
  const subsList = document.getElementById('subsList');
  const subsUrlInput = document.getElementById('subsUrlInput');
  const subsAddBtn = document.getElementById('subsAddBtn');
  const subsStatus = document.getElementById('subsStatus');

  // 일정 패널
  const evtPanel = document.getElementById('evtPanel');
  const evtPanelDate = document.getElementById('evtPanelDate');
  const evtList = document.getElementById('evtList');
  const evtEmpty = document.getElementById('evtEmpty');
  const evtAddBtn = document.getElementById('evtAddBtn');

  // 수동 일정 폼
  const evtFormOverlay = document.getElementById('evtFormOverlay');
  const evtFormTitle = document.getElementById('evtFormTitle');
  const evtFormClose = document.getElementById('evtFormClose');
  const evtName = document.getElementById('evtName');
  const evtDate = document.getElementById('evtDate');
  const evtTime = document.getElementById('evtTime');
  const evtMemo = document.getElementById('evtMemo');
  const evtUrl = document.getElementById('evtUrl');
  const evtSaveBtn = document.getElementById('evtSaveBtn');
  const evtDeleteBtn = document.getElementById('evtDeleteBtn');
  const evtNotify = document.getElementById('evtNotify');

  // iCal 상세 폼
  const icalDetailOverlay = document.getElementById('icalDetailOverlay');
  const icalDetailTitle = document.getElementById('icalDetailTitle');
  const icalDetailClose = document.getElementById('icalDetailClose');
  const icalDetailInfo = document.getElementById('icalDetailInfo');
  const icalDetailMemo = document.getElementById('icalDetailMemo');
  const icalDetailUrl = document.getElementById('icalDetailUrl');
  const icalDetailNotify = document.getElementById('icalDetailNotify');
  const icalDetailSave = document.getElementById('icalDetailSave');

  const today = new Date();
  let currentYear = today.getFullYear();
  let currentMonth = today.getMonth();
  let selectedDate = null;
  let editingEventId = null;
  let icalDetailContext = null; // {subId, eventUid}


  // ══════════════════════════════════
  //  달력 렌더링
  // ══════════════════════════════════
  async function render() {
    calTitle.textContent = `${currentYear}년 ${currentMonth + 1}월`;
    calBody.innerHTML = '';

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevLastDate = new Date(currentYear, currentMonth, 0).getDate();

    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    // 수동 일정 날짜
    const manualDates = CalendarEvents.getDatesWithEvents(currentYear, currentMonth);

    // iCal 일정 날짜 (비동기)
    let icalDateMap = new Map();
    try {
      icalDateMap = await CalendarIcal.getDatesWithEvents(currentYear, currentMonth);
    } catch (e) {
      console.warn('iCal 날짜 로드 실패:', e);
    }

    let cells = [];

    // 이전달
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevLastDate - i;
      const m = currentMonth - 1;
      const y = m < 0 ? currentYear - 1 : currentYear;
      const realM = m < 0 ? 12 : m + 1;
      cells.push({ day: d, other: true, dateStr: `${y}-${String(realM).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    // 이번달
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, other: false, dateStr });
    }

    // 다음달
    const remain = 7 - (cells.length % 7);
    if (remain < 7) {
      for (let d = 1; d <= remain; d++) {
        const m = currentMonth + 1;
        const y = m > 11 ? currentYear + 1 : currentYear;
        const realM = m > 11 ? 1 : m + 1;
        cells.push({ day: d, other: true, dateStr: `${y}-${String(realM).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
      }
    }

    for (let i = 0; i < cells.length; i += 7) {
      const tr = document.createElement('tr');

      for (let j = 0; j < 7; j++) {
        const cell = cells[i + j];
        const td = document.createElement('td');
        td.dataset.date = cell.dateStr;

        const span = document.createElement('span');
        span.className = 'cal__day';
        span.textContent = cell.day;

        if (cell.other) span.classList.add('cal__day--other');
        if (j === 0) span.classList.add('cal__day--sun');
        if (j === 6) span.classList.add('cal__day--sat');

        if (!cell.other && cell.day === todayD && currentMonth === todayM && currentYear === todayY) {
          span.classList.add('cal__day--today');
        }

        if (cell.dateStr === selectedDate) {
          span.classList.add('cal__day--selected');
        }

        td.appendChild(span);

        // 일정 표시 점들
        const dots = document.createElement('div');
        dots.className = 'cal__dots';

        const hasManual = manualDates.has(cell.dateStr) || CalendarEvents.getByDate(cell.dateStr).length > 0;
        const icalColors = icalDateMap.get(cell.dateStr) || [];

        if (hasManual) {
          const dot = document.createElement('span');
          dot.className = 'cal__dot';
          dot.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#1a73e8';
          dots.appendChild(dot);
        }

        icalColors.forEach(c => {
          const dot = document.createElement('span');
          dot.className = 'cal__dot';
          dot.style.backgroundColor = c.color;
          dots.appendChild(dot);
        });

        if (hasManual || icalColors.length > 0) {
          td.appendChild(dots);
        }

        td.addEventListener('click', () => {
          selectedDate = cell.dateStr;
          render();
          showEventsPanel(cell.dateStr);
        });

        tr.appendChild(td);
      }

      calBody.appendChild(tr);
    }
  }


  // ══════════════════════════════════
  //  일정 패널
  // ══════════════════════════════════
  async function showEventsPanel(dateStr) {
    evtPanel.style.display = 'block';
    const parts = dateStr.split('-');
    evtPanelDate.textContent = `${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;

    const manualEvents = CalendarEvents.getByDate(dateStr);
    let icalEvents = [];
    try {
      icalEvents = await CalendarIcal.getEventsByDate(dateStr);
    } catch (e) {
      console.warn('iCal 이벤트 로드 실패:', e);
    }

    evtList.innerHTML = '';

    const totalCount = manualEvents.length + icalEvents.length;

    if (totalCount === 0) {
      evtEmpty.style.display = 'block';
      evtList.style.display = 'none';
      return;
    }

    evtEmpty.style.display = 'none';
    evtList.style.display = 'block';

    // 수동 일정
    manualEvents.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    manualEvents.forEach(evt => {
      const li = document.createElement('li');
      li.className = 'evt-item';
      li.dataset.type = 'manual';
      li.dataset.id = evt.id;

      const urlIcon = evt.url ? '<span class="evt-item__url-icon" title="URL 연결됨">🔗</span>' : '';

      li.innerHTML = `
        <span class="evt-item__dot" style="background-color:${getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#1a73e8'};"></span>
        <span class="evt-item__time">${evt.time || ''}</span>
        <span class="evt-item__name">${escapeHtml(evt.name)}</span>
        ${urlIcon}
      `;

      li.addEventListener('click', () => openFormForEdit(evt.id));
      evtList.appendChild(li);
    });

    // iCal 일정
    icalEvents.sort((a, b) => (a.dtstart.time || '').localeCompare(b.dtstart.time || ''));
    icalEvents.forEach(evt => {
      const li = document.createElement('li');
      li.className = 'evt-item';
      li.dataset.type = 'ical';

      const annot = CalendarIcal.getAnnotation(evt.subId, evt.uid);
      const urlIcon = (annot && annot.url) ? '<span class="evt-item__url-icon" title="URL 연결됨">🔗</span>' : '';
      const memoIcon = (annot && annot.memo) ? '<span class="evt-item__memo-icon" title="메모 있음">📝</span>' : '';

      li.innerHTML = `
        <span class="evt-item__dot" style="background-color:${evt.subColor};"></span>
        <span class="evt-item__time">${evt.dtstart.time || (evt.allDay ? '종일' : '')}</span>
        <span class="evt-item__name">${escapeHtml(evt.summary)}</span>
        ${memoIcon}${urlIcon}
      `;

      li.addEventListener('click', () => openIcalDetail(evt));
      evtList.appendChild(li);
    });
  }


  // ══════════════════════════════════
  //  수동 일정 폼
  // ══════════════════════════════════
  function openFormForAdd(dateStr) {
    editingEventId = null;
    evtFormTitle.textContent = '일정 추가';
    evtName.value = '';
    evtDate.value = dateStr;
    evtTime.value = '';
    evtMemo.value = '';
    evtUrl.value = '';
    evtNotify.checked = true;
    evtDeleteBtn.style.display = 'none';
    evtFormOverlay.style.display = 'flex';
    evtName.focus();
  }

  function openFormForEdit(id) {
    const evt = CalendarEvents.getById(id);
    if (!evt) return;

    editingEventId = id;
    evtFormTitle.textContent = '일정 수정';
    evtName.value = evt.name || '';
    evtDate.value = evt.date || '';
    evtTime.value = evt.time || '';
    evtMemo.value = evt.memo || '';
    evtUrl.value = evt.url || '';
    evtNotify.checked = evt.notify !== false;
    evtDeleteBtn.style.display = 'inline-flex';
    evtFormOverlay.style.display = 'flex';
    evtName.focus();
  }

  function closeForm() {
    evtFormOverlay.style.display = 'none';
    editingEventId = null;
  }

  function saveEvent() {
    const name = evtName.value.trim();
    const date = evtDate.value;
    const time = evtTime.value;
    const memo = evtMemo.value.trim();
    const url = evtUrl.value.trim();
    const notify = evtNotify.checked;

    if (!name) { evtName.focus(); return; }
    if (!date) { evtDate.focus(); return; }

    if (editingEventId) {
      CalendarEvents.update(editingEventId, { name, date, time, memo, url, notify });
    } else {
      CalendarEvents.add(name, date, time, memo, url, notify);
    }

    closeForm();
    selectedDate = date;
    render();
    showEventsPanel(date);
  }

  function deleteEvent() {
    if (!editingEventId) return;
    CalendarEvents.remove(editingEventId);
    closeForm();
    render();
    if (selectedDate) showEventsPanel(selectedDate);
  }


  // ══════════════════════════════════
  //  iCal 이벤트 상세 (어노테이션)
  // ══════════════════════════════════
  function openIcalDetail(evt) {
    icalDetailContext = { subId: evt.subId, eventUid: evt.uid };
    icalDetailTitle.textContent = escapeHtml(evt.summary);

    // 읽기전용 정보
    let infoHtml = '';
    if (evt.dtstart.time) infoHtml += `<div class="ical-detail__row"><span class="ical-detail__label">시간</span><span>${evt.dtstart.time}${evt.dtend ? ' ~ ' + evt.dtend.time : ''}</span></div>`;
    if (evt.allDay) infoHtml += `<div class="ical-detail__row"><span class="ical-detail__label">종일</span><span>종일 일정</span></div>`;
    if (evt.location) infoHtml += `<div class="ical-detail__row"><span class="ical-detail__label">장소</span><span>${escapeHtml(evt.location)}</span></div>`;
    const desc = (evt.description || '').trim();
    const isBoilerplate = /^this is an event reminder$/i.test(desc);
    if (desc && !isBoilerplate) infoHtml += `<div class="ical-detail__row"><span class="ical-detail__label">상세정보</span><span>${escapeHtml(desc).replace(/\n/g, '<br>')}</span></div>`;
    infoHtml += `<div class="ical-detail__row"><span class="ical-detail__label">캘린더</span><span class="ical-detail__cal"><span class="ical-detail__cal-dot" style="background:${evt.subColor}"></span>${escapeHtml(evt.subName)}</span></div>`;

    icalDetailInfo.innerHTML = infoHtml;

    // 기존 어노테이션 로드
    const annot = CalendarIcal.getAnnotation(evt.subId, evt.uid);
    icalDetailMemo.value = annot ? annot.memo : '';
    icalDetailUrl.value = annot ? annot.url : '';
    icalDetailNotify.checked = annot ? annot.notify !== false : true;

    icalDetailOverlay.style.display = 'flex';
  }

  function closeIcalDetail() {
    icalDetailOverlay.style.display = 'none';
    icalDetailContext = null;
  }

  function saveIcalAnnotation() {
    if (!icalDetailContext) return;
    const memo = icalDetailMemo.value.trim();
    const url = icalDetailUrl.value.trim();
    const notify = icalDetailNotify.checked;

    if (!memo && !url && notify) {
      CalendarIcal.removeAnnotation(icalDetailContext.subId, icalDetailContext.eventUid);
    } else {
      CalendarIcal.setAnnotation(icalDetailContext.subId, icalDetailContext.eventUid, memo, url, notify);
    }

    closeIcalDetail();
    if (selectedDate) showEventsPanel(selectedDate);
  }


  // ══════════════════════════════════
  //  iCal 구독 관리
  // ══════════════════════════════════
  function toggleSubsPanel() {
    const visible = subsPanel.style.display !== 'none';
    subsPanel.style.display = visible ? 'none' : 'block';
    if (!visible) renderSubsList();
  }

  function renderSubsList() {
    const subs = CalendarIcal.getSubs();
    subsList.innerHTML = '';

    if (subs.length === 0) {
      subsList.innerHTML = '<li class="subs-empty">구독한 캘린더가 없습니다.</li>';
      return;
    }

    subs.forEach(sub => {
      const li = document.createElement('li');
      li.className = 'subs-item';
      li.innerHTML = `
        <input type="color" class="subs-item__color" data-id="${sub.id}" value="${sub.color}" title="색상 변경">
        <span class="subs-item__name">${escapeHtml(sub.name)}</span>
        <button class="subs-item__btn subs-item__btn--refresh" data-id="${sub.id}" title="새로고침">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </button>
        <button class="subs-item__btn subs-item__btn--delete" data-id="${sub.id}" title="삭제">×</button>
      `;
      subsList.appendChild(li);
    });

    // 이벤트 위임
    subsList.addEventListener('click', handleSubsAction);
    subsList.addEventListener('change', (e) => {
      const colorInput = e.target.closest('.subs-item__color');
      if (!colorInput) return;
      const id = Number(colorInput.dataset.id);
      CalendarIcal.updateSub(id, { color: colorInput.value });
      render();
      if (selectedDate) showEventsPanel(selectedDate);
    });
  }

  async function handleSubsAction(e) {
    const refreshBtn = e.target.closest('.subs-item__btn--refresh');
    const deleteBtn = e.target.closest('.subs-item__btn--delete');

    if (refreshBtn) {
      const id = Number(refreshBtn.dataset.id);
      showSubsStatus('새로고침 중...');
      try {
        CalendarIcal.clearCache(id);
        await CalendarIcal.fetchAndParse(id);
        showSubsStatus('새로고침 완료!', 'success');
        renderSubsList();
        render();
        if (selectedDate) showEventsPanel(selectedDate);
      } catch (err) {
        showSubsStatus('실패: ' + err.message, 'error');
      }
    }

    if (deleteBtn) {
      const id = Number(deleteBtn.dataset.id);
      CalendarIcal.removeSub(id);
      renderSubsList();
      render();
      if (selectedDate) showEventsPanel(selectedDate);
    }
  }

  async function addSubscription() {
    const url = subsUrlInput.value.trim();
    if (!url) { subsUrlInput.focus(); return; }

    showSubsStatus('캘린더를 불러오는 중...');
    subsAddBtn.disabled = true;

    try {
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#1a73e8';
      const sub = CalendarIcal.addSub('iCal', url, primaryColor);
      await CalendarIcal.fetchAndParse(sub.id);
      showSubsStatus('캘린더 추가 완료!', 'success');
      subsUrlInput.value = '';
      renderSubsList();
      render();
    } catch (err) {
      showSubsStatus('실패: ' + err.message, 'error');
      // 추가 실패 시 구독 제거
      const subs = CalendarIcal.getSubs();
      const last = subs[subs.length - 1];
      if (last) CalendarIcal.removeSub(last.id);
    }

    subsAddBtn.disabled = false;
  }

  function showSubsStatus(msg, type) {
    subsStatus.textContent = msg;
    subsStatus.className = 'subs-status' + (type ? ` subs-status--${type}` : '');
    if (type) {
      setTimeout(() => { subsStatus.textContent = ''; subsStatus.className = 'subs-status'; }, 3000);
    }
  }


  // ══════════════════════════════════
  //  이벤트 바인딩
  // ══════════════════════════════════
  btnPrev.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    selectedDate = null;
    evtPanel.style.display = 'none';
    render();
  });

  btnNext.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    selectedDate = null;
    evtPanel.style.display = 'none';
    render();
  });

  btnToday.addEventListener('click', () => {
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    selectedDate = null;
    evtPanel.style.display = 'none';
    render();
  });

  btnSubs.addEventListener('click', toggleSubsPanel);

  evtAddBtn.addEventListener('click', () => {
    if (selectedDate) openFormForAdd(selectedDate);
  });

  evtFormClose.addEventListener('click', closeForm);
  evtFormOverlay.addEventListener('click', (e) => { if (e.target === evtFormOverlay) closeForm(); });
  evtSaveBtn.addEventListener('click', saveEvent);
  evtDeleteBtn.addEventListener('click', deleteEvent);

  [evtName, evtDate, evtTime, evtUrl].forEach(el => {
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveEvent(); });
  });

  icalDetailClose.addEventListener('click', closeIcalDetail);
  icalDetailOverlay.addEventListener('click', (e) => { if (e.target === icalDetailOverlay) closeIcalDetail(); });
  icalDetailSave.addEventListener('click', saveIcalAnnotation);

  subsAddBtn.addEventListener('click', addSubscription);
  subsUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSubscription(); });


  // ══════════════════════════════════
  //  알림 설정 (on/off)
  // ══════════════════════════════════
  const SETTINGS_KEY = 'calendar_notify_settings';
  const toggleUrl = document.getElementById('toggleUrl');

  function loadSettings() {
    return new Promise((resolve) => {
      whale.storage.sync.get(SETTINGS_KEY, (result) => {
        try {
          const s = result[SETTINGS_KEY];
          if (s) {
            toggleUrl.checked = s.url !== false;
          }
        } catch { /* 기본값 유지 */ }
        resolve();
      });
    });
  }

  function saveSettings() {
    whale.storage.sync.set({ [SETTINGS_KEY]: { url: toggleUrl.checked } });
  }

  toggleUrl.addEventListener('change', saveSettings);


  // ══════════════════════════════════
  //  알림 팝업
  // ══════════════════════════════════
  const notifyPopup = document.getElementById('notifyPopup');
  const notifyTitle = document.getElementById('notifyTitle');
  const notifyTime = document.getElementById('notifyTime');
  const notifyClose = document.getElementById('notifyClose');
  let notifyTimer = null;
  let notifyQueue = [];

  function showNotification(name, time) {
    notifyQueue.push({ name, time });
    if (notifyPopup.style.display === 'none') {
      _displayNext();
    }
  }

  function _displayNext() {
    if (notifyQueue.length === 0) {
      notifyPopup.style.display = 'none';
      return;
    }
    const item = notifyQueue.shift();
    notifyTitle.textContent = item.name;
    notifyTime.textContent = `${item.time} 시작 (5분 전)`;
    notifyPopup.style.display = 'flex';
    // 30초 후 자동 닫기
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(dismissNotification, 30000);
  }

  function dismissNotification() {
    clearTimeout(notifyTimer);
    notifyPopup.style.display = 'none';
    // 대기열에 남은 알림 표시
    if (notifyQueue.length > 0) {
      setTimeout(_displayNext, 300);
    }
  }

  notifyClose.addEventListener('click', dismissNotification);


  // ══════════════════════════════════
  //  타이머 (5분전 팝업 + URL 자동 열기)
  // ══════════════════════════════════
  let firedKeys = new Set();

  function _timeMinus5(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    let total = h * 60 + m - 5;
    if (total < 0) total += 24 * 60;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function checkScheduledEvents() {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const urlOn = toggleUrl.checked;

    // ── 수동 일정 체크 ──
    const manualEvents = CalendarEvents.getByDate(dateStr);
    manualEvents.forEach(evt => {
      if (!evt.time) return;

      // 5분 전 팝업 알림 (이벤트별 설정)
      if (evt.notify !== false) {
        const alertKey = `popup_manual_${evt.id}`;
        const alertTime = _timeMinus5(evt.time);
        if (alertTime === timeStr && !firedKeys.has(alertKey)) {
          firedKeys.add(alertKey);
          showNotification(evt.name, evt.time);
        }
      }

      // URL 자동 열기 (정시)
      if (urlOn && evt.url) {
        const urlKey = `url_manual_${evt.id}`;
        if (evt.time === timeStr && !firedKeys.has(urlKey)) {
          firedKeys.add(urlKey);
          window.open(evt.url, '_blank');
        }
      }
    });

    // ── iCal 이벤트 체크 ──
    const subs = CalendarIcal.getSubs().filter(s => s.enabled);
    subs.forEach(sub => {
      try {
        const cached = CalendarIcal.getCache(sub.id);
        if (!cached) return;

        cached.events.forEach(evt => {
          if (!evt.dtstart || evt.dtstart.date !== dateStr || !evt.dtstart.time) return;

          const annot = CalendarIcal.getAnnotation(sub.id, evt.uid);

          // 5분 전 팝업 알림 (어노테이션에 notify 설정이 있으면 따름, 기본 true)
          const notifyOn = annot ? annot.notify !== false : true;
          if (notifyOn) {
            const alertKey = `popup_ical_${sub.id}_${evt.uid}`;
            const alertTime = _timeMinus5(evt.dtstart.time);
            if (alertTime === timeStr && !firedKeys.has(alertKey)) {
              firedKeys.add(alertKey);
              showNotification(evt.summary || sub.name, evt.dtstart.time);
            }
          }

          // URL 자동 열기 (어노테이션에 URL이 있는 경우만, 정시)
          if (urlOn && annot && annot.url) {
            const urlKey = `url_ical_${sub.id}_${evt.uid}`;
            if (evt.dtstart.time === timeStr && !firedKeys.has(urlKey)) {
              firedKeys.add(urlKey);
              window.open(annot.url, '_blank');
            }
          }
        });
      } catch (e) { /* ignore */ }
    });
  }

  // ══════════════════════════════════
  //  유틸
  // ══════════════════════════════════
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 초기 렌더링
  Promise.all([CalendarEvents.init(), CalendarIcal.init(), loadSettings()]).then(async () => {
    setInterval(checkScheduledEvents, 30000);
    checkScheduledEvents();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    selectedDate = todayStr;
    await render();
    showEventsPanel(todayStr);
  });
});

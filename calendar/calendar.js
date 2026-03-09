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
  let tpSync = null; // 타임피커 sync 함수
  let dpSync = null; // 데이트피커 sync 함수


  // ══════════════════════════════════
  //  달력 렌더링
  // ══════════════════════════════════
  async function render() {
    calTitle.textContent = I18n.formatCalTitle(currentYear, currentMonth);
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
    evtPanelDate.textContent = I18n.formatCalDate(parseInt(parts[1]), parseInt(parts[2]));

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
        <div class="evt-item__body">
          <div class="evt-item__name-row">
            <span class="evt-item__name">${escapeHtml(evt.name)}</span>
            ${urlIcon}
          </div>
          ${evt.memo ? `<div class="evt-item__memo">${escapeHtml(evt.memo)}</div>` : ''}
        </div>
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
      const desc = (evt.description || '').trim();
      const isBoilerplate = /^this is an event reminder$/i.test(desc);
      const descHtml = (desc && !isBoilerplate)
        ? `<div class="evt-item__desc">${escapeHtml(desc).replace(/\n/g, '<br>')}</div>` : '';
      const memoHtml = (annot && annot.memo)
        ? `<div class="evt-item__memo">${escapeHtml(annot.memo)}</div>` : '';

      li.innerHTML = `
        <span class="evt-item__dot" style="background-color:${evt.subColor};"></span>
        <span class="evt-item__time">${evt.dtstart.time || (evt.allDay ? I18n.t('cal_all_day') : '')}</span>
        <div class="evt-item__body">
          <div class="evt-item__name-row">
            <span class="evt-item__name">${escapeHtml(evt.summary)}</span>
            ${urlIcon}
          </div>
          ${descHtml}${memoHtml}
        </div>
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
    evtFormTitle.textContent = I18n.t('cal_evt_add');
    evtName.value = '';
    evtDate.value = dateStr;
    if (dpSync) dpSync();
    evtTime.value = '';
    if (tpSync) tpSync();
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
    evtFormTitle.textContent = I18n.t('cal_evt_edit');
    evtName.value = evt.name || '';
    evtDate.value = evt.date || '';
    if (dpSync) dpSync();
    evtTime.value = evt.time || '';
    if (tpSync) tpSync();
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
    const tpPanelEl = document.getElementById('tpPanel');
    if (tpPanelEl) tpPanelEl.classList.remove('tp__panel--open');
    const dpPanelEl = document.getElementById('dpPanel');
    if (dpPanelEl) dpPanelEl.classList.remove('dp__panel--open');
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
    if (evt.dtstart.time) infoHtml += `<div class="ical-detail__row"><span class="ical-detail__label">${I18n.t('cal_ical_time')}</span><span>${evt.dtstart.time}${evt.dtend ? ' ~ ' + evt.dtend.time : ''}</span></div>`;
    if (evt.allDay) infoHtml += `<div class="ical-detail__row"><span class="ical-detail__label">${I18n.t('cal_ical_allday')}</span><span>${I18n.t('cal_ical_allday_val')}</span></div>`;
    if (evt.location) infoHtml += `<div class="ical-detail__row"><span class="ical-detail__label">${I18n.t('cal_ical_location')}</span><span>${escapeHtml(evt.location)}</span></div>`;
    const desc = (evt.description || '').trim();
    const isBoilerplate = /^this is an event reminder$/i.test(desc);
    if (desc && !isBoilerplate) infoHtml += `<div class="ical-detail__row"><span class="ical-detail__label">${I18n.t('cal_ical_desc')}</span><span>${escapeHtml(desc).replace(/\n/g, '<br>')}</span></div>`;
    infoHtml += `<div class="ical-detail__row"><span class="ical-detail__label">${I18n.t('cal_ical_calendar')}</span><span class="ical-detail__cal"><span class="ical-detail__cal-dot" style="background:${evt.subColor}"></span>${escapeHtml(evt.subName)}</span></div>`;

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
      subsList.innerHTML = `<li class="subs-empty">${I18n.t('cal_subs_empty')}</li>`;
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
      showSubsStatus(I18n.t('cal_refreshing'));
      try {
        CalendarIcal.clearCache(id);
        await CalendarIcal.fetchAndParse(id);
        showSubsStatus(I18n.t('cal_refreshed'), 'success');
        renderSubsList();
        render();
        if (selectedDate) showEventsPanel(selectedDate);
      } catch (err) {
        showSubsStatus(I18n.t('cal_fail') + err.message, 'error');
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

    showSubsStatus(I18n.t('cal_loading'));
    subsAddBtn.disabled = true;

    try {
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#1a73e8';
      const sub = CalendarIcal.addSub('iCal', url, primaryColor);
      await CalendarIcal.fetchAndParse(sub.id);
      showSubsStatus(I18n.t('cal_added'), 'success');
      subsUrlInput.value = '';
      renderSubsList();
      render();
    } catch (err) {
      showSubsStatus(I18n.t('cal_fail') + err.message, 'error');
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
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    selectedDate = todayStr;
    evtPanel.style.display = 'none';
    showEventsPanel(todayStr)
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
  //  유틸
  // ══════════════════════════════════
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ══════════════════════════════════
  //  12h 타임 피커
  // ══════════════════════════════════
  function initTimePicker() {
    const tpPanel  = document.getElementById('tpPanel');
    const tpToggle = document.getElementById('tpToggle');
    const tpHr     = document.getElementById('tpHr');
    const tpMi     = document.getElementById('tpMi');
    const tpHrCol  = document.getElementById('tpHrCol');
    const tpMiCol  = document.getElementById('tpMiCol');
    const tpAmBtn  = document.getElementById('tpAm');
    const tpPmBtn  = document.getElementById('tpPm');
    const tpNowBtn = document.getElementById('tpNow');
    const tpClrBtn = document.getElementById('tpClr');
    const tpWrap   = document.getElementById('tp');

    let h12 = 12, min = 0, ap = 'AM';

    // 내부 12h → 24h 문자열
    function to24() {
      let h = h12;
      if (ap === 'AM') { if (h === 12) h = 0; }
      else { if (h !== 12) h += 12; }
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }

    // 24h 문자열 → 내부 12h 상태
    function from24(val) {
      if (!val) { h12 = 12; min = 0; ap = 'AM'; return; }
      const m = val.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return;
      const h = parseInt(m[1]), mi = parseInt(m[2]);
      if (isNaN(h) || isNaN(mi)) return;
      ap = h >= 12 ? 'PM' : 'AM';
      h12 = h % 12 || 12;
      min = mi;
    }

    // UI 갱신
    function render() {
      tpHr.value = String(h12);
      tpMi.value = String(min).padStart(2, '0');
      tpAmBtn.classList.toggle('tp__ap--on', ap === 'AM');
      tpPmBtn.classList.toggle('tp__ap--on', ap === 'PM');
    }

    // evtTime 값 반영
    function commit() {
      evtTime.value = to24();
    }

    // ── 패널 열기/닫기 ──
    function openPanel() {
      if (tpPanel.classList.contains('tp__panel--open')) return;
      if (!evtTime.value) {
        const now = new Date();
        h12 = now.getHours() % 12 || 12;
        min = now.getMinutes();
        ap  = now.getHours() >= 12 ? 'PM' : 'AM';
      } else {
        from24(evtTime.value);
      }
      render();
      tpPanel.classList.add('tp__panel--open');
    }

    function closePanel() {
      tpPanel.classList.remove('tp__panel--open');
      tpHrCol.classList.remove('tp__col--focus');
      tpMiCol.classList.remove('tp__col--focus');
    }

    // 외부에서 evtTime.value 설정 후 호출
    function sync() {
      if (evtTime.value) from24(evtTime.value);
      else { h12 = 12; min = 0; ap = 'AM'; }
      render();
      closePanel();
    }

    // ── 패널 토글 이벤트 ──
    evtTime.addEventListener('click', openPanel);
    evtTime.addEventListener('focus', openPanel);

    tpToggle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (tpPanel.classList.contains('tp__panel--open')) closePanel();
      else openPanel();
    });

    // 바깥 클릭 → 닫기
    document.addEventListener('mousedown', (e) => {
      if (tpWrap && !tpWrap.contains(e.target)) closePanel();
    });

    // 포커스가 tp 밖으로 이동 → 닫기 (Tab 키 등)
    tpWrap.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!tpWrap.contains(document.activeElement)) closePanel();
      });
    });

    // ── 시 입력 ──
    tpHr.addEventListener('focus', () => {
      tpHrCol.classList.add('tp__col--focus');
      tpMiCol.classList.remove('tp__col--focus');
      setTimeout(() => tpHr.select(), 0);
    });

    tpHr.addEventListener('input', () => {
      const v = tpHr.value.replace(/\D/g, '');
      tpHr.value = v;
      const n = parseInt(v);
      if (n >= 1 && n <= 12) { h12 = n; commit(); }
      // 13~24 입력 시 PM 자동 전환
      if (n >= 13 && n <= 23) {
        ap = 'PM'; h12 = n - 12; commit(); render();
        tpMi.focus(); return;
      }
      if (n === 0 || n === 24) {
        ap = 'AM'; h12 = 12; commit(); render();
        tpMi.focus(); return;
      }
      if (v.length >= 2) tpMi.focus();
    });

    tpHr.addEventListener('blur', () => {
      let v = parseInt(tpHr.value) || 12;
      if (v < 1 || v > 12) v = 12;
      h12 = v;
      tpHr.value = String(v);
      commit();
    });

    tpHr.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); adjHour(1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); adjHour(-1); }
      if (e.key === 'Enter')     { e.preventDefault(); closePanel(); evtTime.focus(); }
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); tpMi.focus(); }
    });

    tpHr.addEventListener('wheel', (e) => { e.preventDefault(); adjHour(e.deltaY < 0 ? 1 : -1); }, { passive: false });

    // ── 분 입력 ──
    tpMi.addEventListener('focus', () => {
      tpMiCol.classList.add('tp__col--focus');
      tpHrCol.classList.remove('tp__col--focus');
      setTimeout(() => tpMi.select(), 0);
    });

    tpMi.addEventListener('input', () => {
      const v = tpMi.value.replace(/\D/g, '');
      tpMi.value = v;
      const n = parseInt(v);
      if (!isNaN(n) && n >= 0 && n <= 59) { min = n; commit(); }
    });

    tpMi.addEventListener('blur', () => {
      let v = parseInt(tpMi.value);
      if (isNaN(v) || v < 0) v = 0;
      if (v > 59) v = 59;
      min = v;
      tpMi.value = String(v).padStart(2, '0');
      commit();
    });

    tpMi.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); adjMin(1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); adjMin(-1); }
      if (e.key === 'Enter')     { e.preventDefault(); closePanel(); evtTime.focus(); }
      if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); tpHr.focus(); }
    });

    tpMi.addEventListener('wheel', (e) => { e.preventDefault(); adjMin(e.deltaY < 0 ? 1 : -1); }, { passive: false });

    // ── 화살표 ──
    function adjHour(d) {
      h12 = (h12 - 1 + d + 12) % 12 + 1;
      tpHr.value = String(h12);
      render(); commit();
    }

    function adjMin(d) {
      min = (min + d + 60) % 60;
      tpMi.value = String(min).padStart(2, '0');
      render(); commit();
    }

    document.getElementById('tpHrUp').addEventListener('click', () => { adjHour(1); tpHr.focus(); });
    document.getElementById('tpHrDn').addEventListener('click', () => { adjHour(-1); tpHr.focus(); });
    document.getElementById('tpMiUp').addEventListener('click', () => { adjMin(1); tpMi.focus(); });
    document.getElementById('tpMiDn').addEventListener('click', () => { adjMin(-1); tpMi.focus(); });

    // ── AM / PM ──
    tpAmBtn.addEventListener('click', () => { ap = 'AM'; render(); commit(); });
    tpPmBtn.addEventListener('click', () => { ap = 'PM'; render(); commit(); });

    // ── Now / Clear ──
    tpNowBtn.addEventListener('click', () => {
      const now = new Date();
      h12 = now.getHours() % 12 || 12;
      min = now.getMinutes();
      ap  = now.getHours() >= 12 ? 'PM' : 'AM';
      render(); commit();
    });

    tpClrBtn.addEventListener('click', () => {
      h12 = 12; min = 0; ap = 'AM';
      evtTime.value = '';
      render(); closePanel();
    });

    // ── 직접 타이핑 (HH:MM) ──
    evtTime.addEventListener('input', () => {
      const val = evtTime.value;
      // 완전한 HH:MM 패턴
      if (/^\d{1,2}:\d{2}$/.test(val)) {
        const [hStr, mStr] = val.split(':');
        let hh = parseInt(hStr), mm = parseInt(mStr);
        if (mm > 59) return;
        if (hh >= 13 && hh <= 23) {
          ap = 'PM'; h12 = hh - 12; min = mm;
        } else if (hh === 0 || hh === 24) {
          ap = 'AM'; h12 = 12; min = mm;
          evtTime.value = '00:' + String(mm).padStart(2, '0');
        } else {
          from24(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
        }
        render();
      }
      if (!val) { h12 = 12; min = 0; ap = 'AM'; render(); }
    });

    // 초기 렌더링
    render();
    return sync;
  }


  // ══════════════════════════════════
  //  날짜 선택기 (Date Picker)
  // ══════════════════════════════════
  function initDatePicker() {
    const dpPanel    = document.getElementById('dpPanel');
    const dpToggle   = document.getElementById('dpToggle');
    const dpNavTitle = document.getElementById('dpNavTitle');
    const dpGrid     = document.getElementById('dpGrid');
    const dpPrevBtn  = document.getElementById('dpPrev');
    const dpNextBtn  = document.getElementById('dpNext');
    const dpTodayBtn = document.getElementById('dpToday');
    const dpClrBtn   = document.getElementById('dpClr');
    const dpWrap     = document.getElementById('dp');

    let viewYear, viewMonth;

    // 현재 evtDate 값에서 viewYear/viewMonth 초기화
    function initView() {
      const val = evtDate.value;
      if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const parts = val.split('-').map(Number);
        viewYear  = parts[0];
        viewMonth = parts[1] - 1;
      } else {
        const now = new Date();
        viewYear  = now.getFullYear();
        viewMonth = now.getMonth();
      }
    }

    function formatDate(y, m, d) {
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    function renderGrid() {
      dpNavTitle.textContent = I18n.formatCalTitle(viewYear, viewMonth);
      dpGrid.innerHTML = '';

      const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
      const lastDate  = new Date(viewYear, viewMonth + 1, 0).getDate();
      const prevLast  = new Date(viewYear, viewMonth, 0).getDate();

      const todayNow = new Date();
      const todayStr = formatDate(todayNow.getFullYear(), todayNow.getMonth(), todayNow.getDate());
      const selStr   = evtDate.value;

      const cells = [];

      // 이전달 채우기
      for (let i = firstDay - 1; i >= 0; i--) {
        const d = prevLast - i;
        const pm = viewMonth - 1;
        const py = pm < 0 ? viewYear - 1 : viewYear;
        const rm = pm < 0 ? 11 : pm;
        cells.push({ day: d, dateStr: formatDate(py, rm, d), other: true });
      }

      // 이번달
      for (let d = 1; d <= lastDate; d++) {
        cells.push({ day: d, dateStr: formatDate(viewYear, viewMonth, d), other: false });
      }

      // 다음달 채우기
      const remain = 7 - (cells.length % 7);
      if (remain < 7) {
        for (let d = 1; d <= remain; d++) {
          const nm = viewMonth + 1;
          const ny = nm > 11 ? viewYear + 1 : viewYear;
          const rm = nm > 11 ? 0 : nm;
          cells.push({ day: d, dateStr: formatDate(ny, rm, d), other: true });
        }
      }

      cells.forEach((cell, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dp__cell';
        btn.textContent = cell.day;

        const col = idx % 7;
        if (cell.other)            btn.classList.add('dp__cell--other');
        if (col === 0)             btn.classList.add('dp__cell--sun');
        if (col === 6)             btn.classList.add('dp__cell--sat');
        if (cell.dateStr === todayStr) btn.classList.add('dp__cell--today');
        if (cell.dateStr === selStr)   btn.classList.add('dp__cell--selected');

        btn.addEventListener('click', () => {
          evtDate.value = cell.dateStr;
          closePanel();
        });

        dpGrid.appendChild(btn);
      });
    }

    // ── 패널 열기/닫기 ──
    function openPanel() {
      if (dpPanel.classList.contains('dp__panel--open')) return;
      initView();
      renderGrid();
      dpPanel.classList.add('dp__panel--open');
    }

    function closePanel() {
      dpPanel.classList.remove('dp__panel--open');
    }

    // 외부에서 evtDate.value 설정 후 호출
    function sync() {
      initView();
      closePanel();
    }

    // ── 패널 토글 이벤트 ──
    evtDate.addEventListener('click', openPanel);
    evtDate.addEventListener('focus', openPanel);

    dpToggle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (dpPanel.classList.contains('dp__panel--open')) closePanel();
      else openPanel();
    });

    // 바깥 클릭 → 닫기
    document.addEventListener('mousedown', (e) => {
      if (dpWrap && !dpWrap.contains(e.target)) closePanel();
    });

    // 포커스가 dp 밖으로 이동 → 닫기
    dpWrap.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!dpWrap.contains(document.activeElement)) closePanel();
      });
    });

    // ── 네비게이션 ──
    dpPrevBtn.addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      renderGrid();
    });

    dpNextBtn.addEventListener('click', () => {
      viewMonth++;
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderGrid();
    });

    // ── Today / Clear ──
    dpTodayBtn.addEventListener('click', () => {
      const now = new Date();
      evtDate.value = formatDate(now.getFullYear(), now.getMonth(), now.getDate());
      viewYear  = now.getFullYear();
      viewMonth = now.getMonth();
      renderGrid();
      closePanel();
    });

    dpClrBtn.addEventListener('click', () => {
      evtDate.value = '';
      closePanel();
    });

    // ── 직접 타이핑 (YYYY-MM-DD) ──
    evtDate.addEventListener('input', () => {
      let v = evtDate.value;
      // 숫자와 하이픈만 허용
      v = v.replace(/[^\d-]/g, '');

      // 자동 하이픈 삽입: 4자리 입력 후 → "YYYY-", 7자리 후 → "YYYY-MM-"
      const digits = v.replace(/-/g, '');
      if (digits.length >= 4 && v.indexOf('-') === -1) {
        v = digits.slice(0, 4) + '-' + digits.slice(4);
      }
      if (digits.length >= 6 && v.lastIndexOf('-') <= 4) {
        v = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6);
      }
      evtDate.value = v;

      // 완전한 날짜면 뷰 업데이트
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, m, d] = v.split('-').map(Number);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          viewYear  = y;
          viewMonth = m - 1;
          if (dpPanel.classList.contains('dp__panel--open')) renderGrid();
        }
      }
    });

    // 키보드 Enter → 패널 열려있으면 닫기 (닫혀있으면 saveEvent 진행)
    evtDate.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && dpPanel.classList.contains('dp__panel--open')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closePanel();
      }
    });

    return sync;
  }


  // 초기 렌더링
  Promise.all([CalendarEvents.init(), CalendarIcal.init(), loadSettings()]).then(async () => {
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    selectedDate = todayStr;
    tpSync = initTimePicker();
    dpSync = initDatePicker();
    await render();
    showEventsPanel(todayStr);
    I18n.applyI18n();
  });

  // 언어 변경 시 달력 재렌더링
  window.addEventListener('langchange', async () => {
    I18n.applyI18n();
    await render();
    if (selectedDate) showEventsPanel(selectedDate);
  });
});

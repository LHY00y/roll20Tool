// ────── 수동 일정 ──────
const CalendarEvents = (() => {
  const STORAGE_KEY = 'calendar_events';
  let data = [];

  function init() {
    return new Promise((resolve) => {
      whale.storage.sync.get(STORAGE_KEY, (result) => {
        try { data = result[STORAGE_KEY] || []; }
        catch { data = []; }
        resolve();
      });
    });
  }

  function _save() {
    whale.storage.sync.set({ [STORAGE_KEY]: data });
  }

  function _nextId() {
    if (data.length === 0) return 1;
    return Math.max(...data.map(e => e.id)) + 1;
  }

  function getAll() {
    return [...data];
  }

  function getByDate(dateStr) {
    return data.filter(e => e.date === dateStr);
  }

  function getById(id) {
    return data.find(e => e.id === id) || null;
  }

  function getDatesWithEvents(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const events = data.filter(e => e.date.startsWith(prefix));
    return new Set(events.map(e => e.date));
  }

  function add(name, date, time, memo, url, notify) {
    const event = {
      id: _nextId(),
      name: name || '',
      date: date || '',
      time: time || '',
      memo: memo || '',
      url: url || '',
      notify: notify !== false
    };
    data.push(event);
    _save();
    return event;
  }

  function update(id, fields) {
    const idx = data.findIndex(e => e.id === id);
    if (idx === -1) return null;
    Object.assign(data[idx], fields);
    _save();
    return data[idx];
  }

  function remove(id) {
    data = data.filter(e => e.id !== id);
    _save();
  }

  return { init, getAll, getByDate, getById, getDatesWithEvents, add, update, remove };
})();


// ────── iCal 구독 ──────
const CalendarIcal = (() => {
  const SUBS_KEY = 'calendar_ical_subs';
  const CACHE_KEY = 'calendar_ical_cache';
  const ANNOT_KEY = 'calendar_ical_annotations';

  const COLORS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6', '#7baaf7', '#f691b3'];
  const CACHE_TTL = 60 * 60 * 1000; // 1시간

  let subs = [];
  let cache = {};
  let annot = {};

  function init() {
    return new Promise((resolve) => {
      whale.storage.sync.get([SUBS_KEY, ANNOT_KEY], (syncResult) => {
        try { subs = syncResult[SUBS_KEY] || []; } catch { subs = []; }
        try { annot = syncResult[ANNOT_KEY] || {}; } catch { annot = {}; }
        whale.storage.local.get(CACHE_KEY, (localResult) => {
          try { cache = localResult[CACHE_KEY] || {}; } catch { cache = {}; }
          resolve();
        });
      });
    });
  }

  function _saveSubs() { whale.storage.sync.set({ [SUBS_KEY]: subs }); }
  function _saveAnnot() { whale.storage.sync.set({ [ANNOT_KEY]: annot }); }
  function _saveCache() { whale.storage.local.set({ [CACHE_KEY]: cache }); }

  // ── 구독 관리 ──
  function getSubs() {
    return [...subs];
  }

  function getSubById(id) {
    return subs.find(s => s.id === id) || null;
  }

  function addSub(name, icalUrl, color) {
    const id = subs.length === 0 ? 1 : Math.max(...subs.map(s => s.id)) + 1;
    const resolvedColor = color || COLORS[subs.length % COLORS.length];
    const sub = { id, name: name || 'iCal', icalUrl, color: resolvedColor, enabled: true };
    subs.push(sub);
    _saveSubs();
    return sub;
  }

  function updateSub(id, fields) {
    const idx = subs.findIndex(s => s.id === id);
    if (idx === -1) return null;
    Object.assign(subs[idx], fields);
    _saveSubs();
    return subs[idx];
  }

  function removeSub(id) {
    subs = subs.filter(s => s.id !== id);
    _saveSubs();
    _removeCache(id);
    _removeAnnotationsForSub(id);
  }

  // ── 캐시 관리 ──
  function getCache(subId) {
    const entry = cache[subId];
    if (!entry) return null;
    // TTL 체크
    if (Date.now() - entry.fetchedAt > CACHE_TTL) return null;
    return entry;
  }

  function setCache(subId, events, calendarName) {
    cache[subId] = { events, calendarName: calendarName || '', fetchedAt: Date.now() };
    _saveCache();
  }

  function _removeCache(subId) {
    delete cache[subId];
    _saveCache();
  }

  function clearCache(subId) {
    _removeCache(subId);
  }

  /**
   * background script를 통해 외부 URL fetch (CORS 우회)
   */
  function _bgFetch(url) {
    const api = typeof whale !== 'undefined' ? whale : chrome;
    return new Promise((resolve, reject) => {
      api.runtime.sendMessage({ action: 'fetchUrl', url }, (response) => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
        } else if (!response || !response.success) {
          reject(new Error(response ? response.error : '응답 없음'));
        } else {
          resolve(response.data);
        }
      });
    });
  }

  /**
   * iCal 피드를 fetch하고 파싱하여 캐시에 저장
   * @returns {Promise<{events: Array, calendarName: string}>}
   */
  async function fetchAndParse(subId) {
    const sub = getSubById(subId);
    if (!sub) throw new Error('구독을 찾을 수 없습니다.');

    const text = await _bgFetch(sub.icalUrl);

    const calendarName = ICalParser.getCalendarName(text) || sub.name;
    let events = ICalParser.parse(text);

    // 반복/다일 이벤트 확장 (현재 기준 ±1~2년 윈도우)
    const now = new Date();
    const windowStart = new Date(now.getFullYear() - 1, 0, 1);   // 1년 전 1월 1일
    const windowEnd = new Date(now.getFullYear() + 2, 11, 31); // 2년 후 12월 31일

    let expanded = [];
    events.forEach(evt => {
      const occurrences = evt.rrule
        ? ICalParser.expandRecurring(evt, windowStart, windowEnd)
        : [evt];
      occurrences.forEach(occ => {
        expanded = expanded.concat(ICalParser.expandMultiDay(occ));
      });
    });

    setCache(subId, expanded, calendarName);

    // 캘린더 이름이 자동 감지되면 구독 이름도 갱신
    if (calendarName && sub.name === 'iCal') {
      updateSub(subId, { name: calendarName });
    }

    return { events: expanded, calendarName };
  }

  /**
   * 캐시된 이벤트 반환 (캐시 없으면 fetch)
   */
  async function getEvents(subId) {
    const cached = getCache(subId);
    if (cached) return cached.events;

    const result = await fetchAndParse(subId);
    return result.events;
  }

  /**
   * 특정 날짜의 iCal 이벤트 (모든 활성 구독)
   */
  async function getEventsByDate(dateStr) {
    const activeSubs = subs.filter(s => s.enabled);
    const results = [];

    for (const sub of activeSubs) {
      try {
        const events = await getEvents(sub.id);
        for (const evt of events) {
          if (evt.dtstart && evt.dtstart.date === dateStr) {
            results.push({ ...evt, subId: sub.id, subName: sub.name, subColor: sub.color });
          }
        }
        // events.filter(e => e.dtstart && e.dtstart.date === dateStr).forEach(evt => {
        //   results.push({ ...evt, subId: sub.id, subName: sub.name, subColor: sub.color });
        // });
      } catch (e) {
        console.warn(`iCal fetch 실패 (${sub.name}):`, e);
      }
    }


    return results;
  }

  /**
   * 특정 월의 iCal 이벤트가 있는 날짜 Set (구독별 색상 포함)
   * @returns {Promise<Map<string, Array<{color}>>>}
   */
  async function getDatesWithEvents(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const activeSubs = subs.filter(s => s.enabled);
    const dateMap = new Map(); // dateStr → [{color}]

    for (const sub of activeSubs) {
      try {
        const events = await getEvents(sub.id);
        events.forEach(evt => {
          if (evt.dtstart && evt.dtstart.date.startsWith(prefix)) {
            const d = evt.dtstart.date;
            if (!dateMap.has(d)) dateMap.set(d, []);
            const arr = dateMap.get(d);
            if (!arr.find(c => c.color === sub.color)) {
              arr.push({ color: sub.color });
            }
          }
        });
      } catch (e) {
        console.warn(`iCal fetch 실패 (${sub.name}):`, e);
      }
    }

    return dateMap;
  }

  // ── 어노테이션 (메모 & URL) ──
  function _annotKey(subId, eventUid) {
    return `${subId}|${eventUid}`;
  }

  function getAnnotation(subId, eventUid) {
    return annot[_annotKey(subId, eventUid)] || null;
  }

  function setAnnotation(subId, eventUid, memo, url, notify) {
    annot[_annotKey(subId, eventUid)] = { subId, eventUid, memo: memo || '', url: url || '', notify: notify !== false };
    _saveAnnot();
  }

  function removeAnnotation(subId, eventUid) {
    delete annot[_annotKey(subId, eventUid)];
    _saveAnnot();
  }

  function _removeAnnotationsForSub(subId) {
    const prefix = `${subId}|`;
    Object.keys(annot).forEach(key => {
      if (key.startsWith(prefix)) delete annot[key];
    });
    _saveAnnot();
  }

  /**
   * URL이 있는 모든 어노테이션 반환 (타이머용)
   */
  function getAllAnnotationsWithUrl() {
    return Object.values(annot).filter(a => a.url);
  }

  return {
    init,
    getSubs, getSubById, addSub, updateSub, removeSub,
    getCache, setCache, clearCache, fetchAndParse, getEvents,
    getEventsByDate, getDatesWithEvents,
    getAnnotation, setAnnotation, removeAnnotation, getAllAnnotationsWithUrl,
    COLORS
  };
})();

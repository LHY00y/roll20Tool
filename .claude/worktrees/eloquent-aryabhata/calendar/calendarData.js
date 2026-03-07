// ────── 수동 일정 ──────
const CalendarEvents = (() => {
  const STORAGE_KEY = 'calendar_events';

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function _nextId(data) {
    if (data.length === 0) return 1;
    return Math.max(...data.map(e => e.id)) + 1;
  }

  function getAll() {
    return _load();
  }

  function getByDate(dateStr) {
    return _load().filter(e => e.date === dateStr);
  }

  function getById(id) {
    return _load().find(e => e.id === id) || null;
  }

  function getDatesWithEvents(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const events = _load().filter(e => e.date.startsWith(prefix));
    const dates = new Set(events.map(e => e.date));
    return dates;
  }

  function add(name, date, time, memo, url) {
    const data = _load();
    const event = {
      id: _nextId(data),
      name: name || '',
      date: date || '',
      time: time || '',
      memo: memo || '',
      url: url || ''
    };
    data.push(event);
    _save(data);
    return event;
  }

  function update(id, fields) {
    const data = _load();
    const idx = data.findIndex(e => e.id === id);
    if (idx === -1) return null;
    Object.assign(data[idx], fields);
    _save(data);
    return data[idx];
  }

  function remove(id) {
    const data = _load();
    const filtered = data.filter(e => e.id !== id);
    _save(filtered);
  }

  return { getAll, getByDate, getById, getDatesWithEvents, add, update, remove };
})();


// ────── iCal 구독 ──────
const CalendarIcal = (() => {
  const SUBS_KEY = 'calendar_ical_subs';
  const CACHE_KEY = 'calendar_ical_cache';
  const ANNOT_KEY = 'calendar_ical_annotations';

  const COLORS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6', '#7baaf7', '#f691b3'];
  const CACHE_TTL = 60 * 60 * 1000; // 1시간

  // ── 구독 관리 ──
  function _loadSubs() {
    try { return JSON.parse(localStorage.getItem(SUBS_KEY)) || []; }
    catch { return []; }
  }
  function _saveSubs(data) {
    localStorage.setItem(SUBS_KEY, JSON.stringify(data));
  }

  function getSubs() {
    return _loadSubs();
  }

  function getSubById(id) {
    return _loadSubs().find(s => s.id === id) || null;
  }

  function addSub(name, icalUrl) {
    const subs = _loadSubs();
    const id = subs.length === 0 ? 1 : Math.max(...subs.map(s => s.id)) + 1;
    const color = COLORS[(subs.length) % COLORS.length];
    const sub = { id, name: name || 'iCal', icalUrl, color, enabled: true };
    subs.push(sub);
    _saveSubs(subs);
    return sub;
  }

  function updateSub(id, fields) {
    const subs = _loadSubs();
    const idx = subs.findIndex(s => s.id === id);
    if (idx === -1) return null;
    Object.assign(subs[idx], fields);
    _saveSubs(subs);
    return subs[idx];
  }

  function removeSub(id) {
    const subs = _loadSubs().filter(s => s.id !== id);
    _saveSubs(subs);
    // 캐시, 어노테이션도 정리
    _removeCache(id);
    _removeAnnotationsForSub(id);
  }

  // ── 캐시 관리 ──
  function _loadCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; }
    catch { return {}; }
  }
  function _saveCache(data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }

  function getCache(subId) {
    const cache = _loadCache();
    const entry = cache[subId];
    if (!entry) return null;
    // TTL 체크
    if (Date.now() - entry.fetchedAt > CACHE_TTL) return null;
    return entry;
  }

  function setCache(subId, events, calendarName) {
    const cache = _loadCache();
    cache[subId] = { events, calendarName: calendarName || '', fetchedAt: Date.now() };
    _saveCache(cache);
  }

  function _removeCache(subId) {
    const cache = _loadCache();
    delete cache[subId];
    _saveCache(cache);
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

    // 다일 이벤트 확장
    let expanded = [];
    events.forEach(evt => {
      expanded = expanded.concat(ICalParser.expandMultiDay(evt));
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
    const subs = _loadSubs().filter(s => s.enabled);
    const results = [];

    for (const sub of subs) {
      try {
        const events = await getEvents(sub.id);
        events.filter(e => e.dtstart && e.dtstart.date === dateStr).forEach(evt => {
          results.push({ ...evt, subId: sub.id, subName: sub.name, subColor: sub.color });
        });
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
    const subs = _loadSubs().filter(s => s.enabled);
    const dateMap = new Map(); // dateStr → [{color}]

    for (const sub of subs) {
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
  function _loadAnnot() {
    try { return JSON.parse(localStorage.getItem(ANNOT_KEY)) || {}; }
    catch { return {}; }
  }
  function _saveAnnot(data) {
    localStorage.setItem(ANNOT_KEY, JSON.stringify(data));
  }

  function _annotKey(subId, eventUid) {
    return `${subId}|${eventUid}`;
  }

  function getAnnotation(subId, eventUid) {
    const data = _loadAnnot();
    return data[_annotKey(subId, eventUid)] || null;
  }

  function setAnnotation(subId, eventUid, memo, url) {
    const data = _loadAnnot();
    data[_annotKey(subId, eventUid)] = { subId, eventUid, memo: memo || '', url: url || '' };
    _saveAnnot(data);
  }

  function removeAnnotation(subId, eventUid) {
    const data = _loadAnnot();
    delete data[_annotKey(subId, eventUid)];
    _saveAnnot(data);
  }

  function _removeAnnotationsForSub(subId) {
    const data = _loadAnnot();
    const prefix = `${subId}|`;
    Object.keys(data).forEach(key => {
      if (key.startsWith(prefix)) delete data[key];
    });
    _saveAnnot(data);
  }

  /**
   * URL이 있는 모든 어노테이션 반환 (타이머용)
   */
  function getAllAnnotationsWithUrl() {
    const data = _loadAnnot();
    return Object.values(data).filter(a => a.url);
  }

  return {
    getSubs, getSubById, addSub, updateSub, removeSub,
    getCache, setCache, clearCache, fetchAndParse, getEvents,
    getEventsByDate, getDatesWithEvents,
    getAnnotation, setAnnotation, removeAnnotation, getAllAnnotationsWithUrl,
    COLORS
  };
})();

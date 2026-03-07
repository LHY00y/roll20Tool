const ICalParser = (() => {

  /**
   * ICS 텍스트를 파싱하여 이벤트 배열 반환
   * @param {string} icsText
   * @returns {Array<{uid, summary, description, location, dtstart, dtend, allDay}>}
   */
  function parse(icsText) {
    // 라인 언폴딩 (줄바꿈 후 공백/탭으로 시작하면 이전 줄의 연속)
    // CRLF(\r\n) 및 LF(\n) 모두 처리
    const unfolded = icsText
      .replace(/\r\n[ \t]/g, '')
      .replace(/\n[ \t]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const lines = unfolded.split('\n');

    const events = [];
    let inEvent = false;
    let current = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === 'BEGIN:VEVENT') {
        inEvent = true;
        current = {};
      } else if (trimmed === 'END:VEVENT') {
        inEvent = false;
        const parsed = _buildEvent(current);
        if (parsed) events.push(parsed);
      } else if (inEvent) {
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx > 0) {
          const keyPart = trimmed.substring(0, colonIdx);
          const value = trimmed.substring(colonIdx + 1);
          const semiIdx = keyPart.indexOf(';');
          const baseName = semiIdx >= 0 ? keyPart.substring(0, semiIdx) : keyPart;
          const params = semiIdx >= 0 ? keyPart.substring(semiIdx + 1) : '';

          // 같은 키가 있으면 덮어쓰기 (DTSTART 등은 하나만)
          current[baseName] = { value, params };
        }
      }
    }

    return events;
  }

  function _buildEvent(raw) {
    const uid = _val(raw, 'UID');
    const summary = _unescape(_val(raw, 'SUMMARY'));
    const description = _unescape(_val(raw, 'DESCRIPTION'));
    const location = _unescape(_val(raw, 'LOCATION'));

    const dtStartRaw = raw['DTSTART'];
    const dtEndRaw = raw['DTEND'];

    const allDay = _isAllDay(dtStartRaw);
    const dtstart = _parseDateTime(dtStartRaw);
    const dtend = _parseDateTime(dtEndRaw);

    if (!dtstart) return null;

    return { uid, summary, description, location, dtstart, dtend, allDay };
  }

  function _val(raw, key) {
    return raw[key] ? raw[key].value : '';
  }

  function _isAllDay(entry) {
    if (!entry) return false;
    if (entry.params && entry.params.includes('VALUE=DATE')) return true;
    return /^\d{8}$/.test(entry.value);
  }

  /**
   * ICS 날짜를 {date: 'YYYY-MM-DD', time: 'HH:MM'} 로 변환
   */
  function _parseDateTime(entry) {
    if (!entry) return null;
    const str = entry.value;
    if (!str) return null;

    // YYYYMMDD (종일)
    if (/^\d{8}$/.test(str)) {
      return {
        date: `${str.substr(0, 4)}-${str.substr(4, 2)}-${str.substr(6, 2)}`,
        time: ''
      };
    }

    // YYYYMMDDTHHmmss 또는 YYYYMMDDTHHmmssZ
    const m = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if (m) {
      let d;
      if (str.endsWith('Z')) {
        d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
      } else {
        d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
      }
      return {
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      };
    }

    return null;
  }

  function _unescape(str) {
    if (!str) return '';
    return str.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\').replace(/\\;/g, ';');
  }

  /**
   * ICS 텍스트에서 캘린더 이름 추출
   */
  function getCalendarName(icsText) {
    const match = icsText.match(/X-WR-CALNAME:(.*)/);
    return match ? match[1].trim() : '';
  }

  /**
   * 다일(multi-day) 이벤트를 날짜별로 확장
   * 예: 3일간 이벤트 → 3개의 개별 이벤트로 반환
   */
  function expandMultiDay(event) {
    if (!event.dtstart || !event.dtend) return [event];
    if (event.dtstart.date === event.dtend.date) return [event];

    const results = [];
    const start = _toDateObj(event.dtstart.date);
    const end = _toDateObj(event.dtend.date);

    // 종일 이벤트의 DTEND는 exclusive (다음날)
    if (event.allDay) {
      end.setDate(end.getDate() - 1);
    }

    const current = new Date(start);
    while (current <= end) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      results.push({
        ...event,
        dtstart: {
          date: dateStr,
          time: dateStr === event.dtstart.date ? event.dtstart.time : ''
        }
      });
      current.setDate(current.getDate() + 1);
    }

    return results;
  }

  function _toDateObj(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  return { parse, getCalendarName, expandMultiDay };
})();

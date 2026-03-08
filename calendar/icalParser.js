const ICalParser = (() => {

  /**
   * ICS 텍스트를 파싱하여 이벤트 배열 반환
   * @param {string} icsText
   * @returns {Array<{uid, summary, description, location, dtstart, dtend, allDay, rrule, exdates, rdates}>}
   */
  function parse(icsText) {
    const unfolded = icsText
      .replace(/\r\n[ \t]/g, '')
      .replace(/\n[ \t]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    const lines = unfolded.split('\n');

    const events = [];
    let inEvent = false;
    let nestedDepth = 0;
    let current = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === 'BEGIN:VEVENT') {
        inEvent = true;
        nestedDepth = 0;
        current = {};
      } else if (trimmed === 'END:VEVENT') {
        inEvent = false;
        nestedDepth = 0;
        const parsed = _buildEvent(current);
        if (parsed) events.push(parsed);
      } else if (inEvent) {
        if (trimmed.startsWith('BEGIN:')) {
          nestedDepth++;
        } else if (trimmed.startsWith('END:')) {
          nestedDepth--;
        } else if (nestedDepth === 0) {
          const colonIdx = trimmed.indexOf(':');
          if (colonIdx > 0) {
            const keyPart = trimmed.substring(0, colonIdx);
            const value = trimmed.substring(colonIdx + 1);
            const semiIdx = keyPart.indexOf(';');
            const baseName = semiIdx >= 0 ? keyPart.substring(0, semiIdx) : keyPart;
            const params = semiIdx >= 0 ? keyPart.substring(semiIdx + 1) : '';

            // EXDATE, RDATE는 여러 줄로 나올 수 있으므로 누적
            if (baseName === 'EXDATE' || baseName === 'RDATE') {
              if (current[baseName]) {
                current[baseName].value += ',' + value;
              } else {
                current[baseName] = { value, params };
              }
            } else {
              current[baseName] = { value, params };
            }
          }
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
    const durationRaw = raw['DURATION'];
    const rruleRaw = raw['RRULE'];
    const exdateRaw = raw['EXDATE'];
    const rdateRaw = raw['RDATE'];

    const allDay = _isAllDay(dtStartRaw);
    const dtstart = _parseDateTime(dtStartRaw);
    let dtend = _parseDateTime(dtEndRaw);

    // DTEND 없으면 DURATION으로 계산
    if (!dtend && durationRaw && dtstart) {
      dtend = _applyDuration(dtstart, durationRaw.value, allDay);
    }

    if (!dtstart) return null;

    const rrule = rruleRaw ? _parseRRule(rruleRaw.value) : null;
    const exdates = exdateRaw ? _parseExDates(exdateRaw.value) : new Set();
    const rdates = rdateRaw ? _parseRDates(rdateRaw.value) : [];

    return { uid, summary, description, location, dtstart, dtend, allDay, rrule, exdates, rdates };
  }

  function _val(raw, key) {
    return raw[key] ? raw[key].value : '';
  }

  function _isAllDay(entry) {
    if (!entry) return false;
    if (entry.params && entry.params.includes('VALUE=DATE')) return true;
    return /^\d{8}$/.test(entry.value);
  }

  function _parseDateTime(entry) {
    if (!entry) return null;
    const str = entry.value;
    if (!str) return null;

    if (/^\d{8}$/.test(str)) {
      return {
        date: `${str.substr(0, 4)}-${str.substr(4, 2)}-${str.substr(6, 2)}`,
        time: ''
      };
    }

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

  // ── DURATION ──────────────────────────────────────────────────────────────

  /**
   * DURATION 속성 값을 dtstart에 더해 dtend 계산
   * P[n]W[n]Y[n]M[n]DT[n]H[n]M[n]S
   */
  function _applyDuration(dtstart, durationStr, allDay) {
    const m = durationStr.match(
      /^([+-]?)P(?:(\d+)W)?(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
    );
    if (!m) return null;

    const [yr, mo, day] = dtstart.date.split('-').map(Number);
    const [h, mi] = dtstart.time ? dtstart.time.split(':').map(Number) : [0, 0];
    const end = new Date(yr, mo - 1, day, h, mi, 0);

    end.setFullYear(end.getFullYear() + (+m[3] || 0));
    end.setMonth(end.getMonth() + (+m[4] || 0));
    end.setDate(end.getDate() + (+m[2] || 0) * 7 + (+m[5] || 0));
    end.setHours(end.getHours() + (+m[6] || 0));
    end.setMinutes(end.getMinutes() + (+m[7] || 0));
    end.setSeconds(end.getSeconds() + (+m[8] || 0));

    return {
      date: _fmtDate(end),
      time: allDay ? '' : _fmtTime(end)
    };
  }

  // ── 날짜 헬퍼 ──────────────────────────────────────────────────────────────

  function _dtToDate(dt) {
    if (!dt) return null;
    const [y, m, d] = dt.date.split('-').map(Number);
    if (dt.time) {
      const [h, mi] = dt.time.split(':').map(Number);
      return new Date(y, m - 1, d, h, mi, 0);
    }
    return new Date(y, m - 1, d, 0, 0, 0);
  }

  function _fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function _fmtTime(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // ── RRULE 파싱 ────────────────────────────────────────────────────────────

  // RFC 5545 요일 → JS getDay() 동일 매핑 (0=SU=Sun, 1=MO=Mon, …)
  const DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  function _parseBydayEntry(s) {
    const m = s.match(/^([+-]?\d*)([A-Z]{2})$/);
    if (!m) return null;
    return { n: m[1] ? parseInt(m[1]) : 0, dow: DOW[m[2]] };
  }

  function _parseRRule(str) {
    const parts = {};
    str.split(';').forEach(part => {
      const eq = part.indexOf('=');
      if (eq > 0) parts[part.substring(0, eq)] = part.substring(eq + 1);
    });

    let until = null;
    if (parts.UNTIL) {
      const u = parts.UNTIL;
      const m = u.match(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z?)?$/);
      if (m) {
        if (m[4] && u.endsWith('Z')) {
          until = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[5] || 0, +m[6] || 0, +m[7] || 0));
        } else if (m[4]) {
          until = new Date(+m[1], +m[2] - 1, +m[3], +m[5] || 0, +m[6] || 0, +m[7] || 0);
        } else {
          until = new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 59);
        }
      }
    }

    return {
      freq:       parts.FREQ || '',
      interval:   Math.max(1, parseInt(parts.INTERVAL) || 1),
      count:      parts.COUNT ? parseInt(parts.COUNT) : null,
      until,
      byday:      parts.BYDAY      ? parts.BYDAY.split(',').map(_parseBydayEntry).filter(Boolean) : null,
      bymonthday: parts.BYMONTHDAY ? parts.BYMONTHDAY.split(',').map(Number) : null,
      bymonth:    parts.BYMONTH    ? parts.BYMONTH.split(',').map(Number) : null,
      bysetpos:   parts.BYSETPOS   ? parts.BYSETPOS.split(',').map(Number) : null,
      wkst:       parts.WKST || 'MO',
    };
  }

  function _parseExDates(value) {
    const dates = new Set();
    value.split(',').forEach(s => {
      s = s.trim();
      const m = s.match(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z?))?$/);
      if (!m) return;
      if (m[4]) {
        const d = m[8] === 'Z'
          ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[5], +m[6], +m[7]))
          : new Date(+m[1], +m[2] - 1, +m[3], +m[5], +m[6], +m[7]);
        dates.add(_fmtDate(d));
      } else {
        dates.add(`${m[1]}-${m[2]}-${m[3]}`);
      }
    });
    return dates;
  }

  function _parseRDates(value) {
    const dates = [];
    value.split(',').forEach(s => {
      s = s.trim();
      const m = s.match(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z?))?$/);
      if (!m) return;
      if (m[4]) {
        dates.push(m[8] === 'Z'
          ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[5], +m[6], +m[7]))
          : new Date(+m[1], +m[2] - 1, +m[3], +m[5], +m[6], +m[7]));
      } else {
        dates.push(new Date(+m[1], +m[2] - 1, +m[3]));
      }
    });
    return dates;
  }

  // ── 반복 확장 ─────────────────────────────────────────────────────────────

  /**
   * 특정 월(1-based)에서 BYDAY 목록에 맞는 Date 배열 반환
   */
  function _daysInMonthByByday(year, month, bydayList) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const results = [];

    for (const bd of bydayList) {
      if (bd.n === 0) {
        // 해당 요일의 모든 날
        for (let d = 1; d <= daysInMonth; d++) {
          if (new Date(year, month - 1, d).getDay() === bd.dow) {
            results.push(new Date(year, month - 1, d));
          }
        }
      } else if (bd.n > 0) {
        // n번째 해당 요일
        let found = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          if (new Date(year, month - 1, d).getDay() === bd.dow && ++found === bd.n) {
            results.push(new Date(year, month - 1, d));
            break;
          }
        }
      } else {
        // 역순 n번째 해당 요일
        let found = 0;
        for (let d = daysInMonth; d >= 1; d--) {
          if (new Date(year, month - 1, d).getDay() === bd.dow && ++found === -bd.n) {
            results.push(new Date(year, month - 1, d));
            break;
          }
        }
      }
    }
    return results;
  }

  /**
   * 주어진 cursor 위치(기간의 시작)에서 후보 날짜 목록 생성
   */
  function _getCandidates(cursor, rule, dtstart) {
    const freq = rule.freq;
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1; // 1-based
    const h  = dtstart.getHours();
    const mi = dtstart.getMinutes();
    const s  = dtstart.getSeconds();

    let candidates = [];

    if (freq === 'DAILY') {
      candidates = [new Date(year, month - 1, cursor.getDate(), h, mi, s)];

      if (rule.byday) {
        const allowed = new Set(rule.byday.map(bd => bd.dow));
        candidates = candidates.filter(d => allowed.has(d.getDay()));
      }
      if (rule.bymonth) {
        candidates = candidates.filter(d => rule.bymonth.includes(d.getMonth() + 1));
      }
      if (rule.bymonthday) {
        const dim = new Date(year, month, 0).getDate();
        candidates = candidates.filter(d =>
          rule.bymonthday.some(bmd => bmd > 0 ? bmd === d.getDate() : dim + bmd + 1 === d.getDate())
        );
      }

    } else if (freq === 'WEEKLY') {
      // cursor는 항상 WKST 기준 주의 첫 날 — 7일을 순회하며 BYDAY 필터 적용
      const bydayList = rule.byday || [{ n: 0, dow: dtstart.getDay() }];
      const allowed = new Set(bydayList.map(bd => bd.dow));

      for (let offset = 0; offset < 7; offset++) {
        const d = new Date(cursor);
        d.setDate(cursor.getDate() + offset);
        d.setHours(h, mi, s, 0);
        if (allowed.has(d.getDay())) candidates.push(d);
      }
      if (rule.bymonth) {
        candidates = candidates.filter(d => rule.bymonth.includes(d.getMonth() + 1));
      }

    } else if (freq === 'MONTHLY') {
      if (rule.byday && !rule.bymonthday) {
        candidates = _daysInMonthByByday(year, month, rule.byday);
        candidates.forEach(d => d.setHours(h, mi, s, 0));

      } else if (rule.bymonthday) {
        const dim = new Date(year, month, 0).getDate();
        for (const bmd of rule.bymonthday) {
          const actual = bmd > 0 ? bmd : dim + bmd + 1;
          if (actual >= 1 && actual <= dim) {
            candidates.push(new Date(year, month - 1, actual, h, mi, s));
          }
        }
        if (rule.byday) {
          const allowed = new Set(rule.byday.map(bd => bd.dow));
          candidates = candidates.filter(d => allowed.has(d.getDay()));
        }

      } else {
        // 기본: dtstart와 같은 날짜
        const dim = new Date(year, month, 0).getDate();
        const targetDay = Math.min(dtstart.getDate(), dim);
        candidates = [new Date(year, month - 1, targetDay, h, mi, s)];
      }

      if (rule.bymonth) {
        candidates = candidates.filter(d => rule.bymonth.includes(d.getMonth() + 1));
      }

    } else if (freq === 'YEARLY') {
      if (rule.bymonth && rule.byday) {
        // 지정 월 × 지정 요일
        for (const mon of rule.bymonth) {
          const days = _daysInMonthByByday(year, mon, rule.byday);
          days.forEach(d => d.setHours(h, mi, s, 0));
          candidates.push(...days);
        }

      } else if (rule.bymonth && rule.bymonthday) {
        for (const mon of rule.bymonth) {
          const dim = new Date(year, mon, 0).getDate();
          for (const bmd of rule.bymonthday) {
            const actual = bmd > 0 ? bmd : dim + bmd + 1;
            if (actual >= 1 && actual <= dim) {
              candidates.push(new Date(year, mon - 1, actual, h, mi, s));
            }
          }
        }

      } else if (rule.bymonth) {
        // 지정 월, dtstart와 같은 날
        const targetDay = dtstart.getDate();
        for (const mon of rule.bymonth) {
          const dim = new Date(year, mon, 0).getDate();
          candidates.push(new Date(year, mon - 1, Math.min(targetDay, dim), h, mi, s));
        }
        if (rule.byday) {
          const allowed = new Set(rule.byday.map(bd => bd.dow));
          candidates = candidates.filter(d => allowed.has(d.getDay()));
        }

      } else if (rule.byday) {
        // 연간 n번째 요일 또는 해당 요일 전체
        for (const bd of rule.byday) {
          if (bd.n === 0) {
            for (let mon = 1; mon <= 12; mon++) {
              const days = _daysInMonthByByday(year, mon, [bd]);
              days.forEach(d => d.setHours(h, mi, s, 0));
              candidates.push(...days);
            }
          } else if (bd.n > 0) {
            let found = 0;
            for (let dt = new Date(year, 0, 1); dt.getFullYear() === year; dt.setDate(dt.getDate() + 1)) {
              if (dt.getDay() === bd.dow && ++found === bd.n) {
                candidates.push(new Date(year, dt.getMonth(), dt.getDate(), h, mi, s));
                break;
              }
            }
          } else {
            let found = 0;
            for (let dt = new Date(year, 11, 31); dt.getFullYear() === year; dt.setDate(dt.getDate() - 1)) {
              if (dt.getDay() === bd.dow && ++found === -bd.n) {
                candidates.push(new Date(year, dt.getMonth(), dt.getDate(), h, mi, s));
                break;
              }
            }
          }
        }

      } else if (rule.bymonthday) {
        const mon = dtstart.getMonth() + 1;
        const dim = new Date(year, mon, 0).getDate();
        for (const bmd of rule.bymonthday) {
          const actual = bmd > 0 ? bmd : dim + bmd + 1;
          if (actual >= 1 && actual <= dim) {
            candidates.push(new Date(year, mon - 1, actual, h, mi, s));
          }
        }

      } else {
        // 기본: dtstart와 같은 월/일
        const mon = dtstart.getMonth();
        const day = dtstart.getDate();
        const dim = new Date(year, mon + 1, 0).getDate();
        if (day <= dim) candidates.push(new Date(year, mon, day, h, mi, s));
      }
    }

    return candidates;
  }

  /**
   * 커서를 FREQ × INTERVAL만큼 전진
   */
  function _advanceCursor(cursor, rule, dtstart) {
    const next = new Date(cursor);
    const interval = rule.interval;

    switch (rule.freq) {
      case 'DAILY':
        next.setDate(next.getDate() + interval);
        break;

      case 'WEEKLY':
        next.setDate(next.getDate() + 7 * interval);
        break;

      case 'MONTHLY': {
        // 말일 오버플로 방지: 1일로 맞춘 후 월 이동, 그 후 날짜 고정
        const targetDay = dtstart.getDate();
        next.setDate(1);
        next.setMonth(next.getMonth() + interval);
        const dim = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(targetDay, dim));
        break;
      }

      case 'YEARLY':
        next.setFullYear(next.getFullYear() + interval);
        break;
    }

    return next;
  }

  function _applyBysetpos(candidates, bysetpos) {
    if (!bysetpos || !candidates.length) return candidates;
    const sorted = [...candidates].sort((a, b) => a - b);
    return bysetpos.map(pos => {
      if (pos > 0) return sorted[pos - 1] ?? null;
      if (pos < 0) return sorted[sorted.length + pos] ?? null;
      return null;
    }).filter(Boolean);
  }

  function _buildOccurrence(event, occDate, durationMs) {
    const dateStr = _fmtDate(occDate);
    const timeStr = event.dtstart.time;
    let dtend = event.dtend;

    if (durationMs !== 0) {
      const endDate = new Date(occDate.getTime() + durationMs);
      dtend = { date: _fmtDate(endDate), time: event.dtend ? event.dtend.time : timeStr };
    }

    return { ...event, dtstart: { date: dateStr, time: timeStr }, dtend };
  }

  /**
   * 반복 이벤트를 windowStart~windowEnd 범위로 확장
   * COUNT 기반 규칙은 DTSTART부터 정확히 카운트
   * @param {object} event
   * @param {Date} windowStart
   * @param {Date} windowEnd
   * @returns {Array}
   */
  function expandRecurring(event, windowStart, windowEnd) {
    if (!event.rrule) return [event];

    const rule = event.rrule;
    const exdates = event.exdates || new Set();

    const dtstart = _dtToDate(event.dtstart);
    const dtendDate = _dtToDate(event.dtend);
    const durationMs = dtendDate ? (dtendDate - dtstart) : 0;

    const results = [];
    let totalCount = 0;
    const maxCount = rule.count !== null ? rule.count : Infinity;
    const until = rule.until;

    // WEEKLY: 커서를 WKST 기준 주의 첫 날로 맞춤
    let cursor = new Date(dtstart);
    if (rule.freq === 'WEEKLY') {
      const wkstDow = DOW[rule.wkst] ?? 1;
      const offset = (cursor.getDay() - wkstDow + 7) % 7;
      cursor.setDate(cursor.getDate() - offset);
    }

    const MAX_ITER = 20000;
    let iter = 0;

    outer:
    while (iter++ < MAX_ITER) {
      let candidates = _getCandidates(cursor, rule, dtstart);

      if (rule.bysetpos) {
        candidates = _applyBysetpos(candidates, rule.bysetpos);
      }
      candidates.sort((a, b) => a - b);

      for (const cand of candidates) {
        if (cand < dtstart) continue;
        if (until && cand > until) break outer;
        if (totalCount >= maxCount) break outer;

        const dateStr = _fmtDate(cand);
        if (!exdates.has(dateStr)) {
          totalCount++;
          if (cand >= windowStart && cand <= windowEnd) {
            results.push(_buildOccurrence(event, cand, durationMs));
          }
        }
      }

      cursor = _advanceCursor(cursor, rule, dtstart);

      if (until && cursor > until) break;
      if (totalCount >= maxCount) break;
      // COUNT 없고 UNTIL 없으면 윈도우 벗어났을 때 종료
      if (rule.count === null && !until && cursor > windowEnd) break;
    }

    // RDATE (추가 단일 날짜) 처리
    if (event.rdates && event.rdates.length > 0) {
      for (const rd of event.rdates) {
        if (rd >= windowStart && rd <= windowEnd) {
          const dateStr = _fmtDate(rd);
          if (!exdates.has(dateStr)) {
            results.push(_buildOccurrence(event, rd, durationMs));
          }
        }
      }
    }

    results.sort((a, b) =>
      a.dtstart.date.localeCompare(b.dtstart.date) || a.dtstart.time.localeCompare(b.dtstart.time)
    );

    return results;
  }

  // ── 기존 함수 ────────────────────────────────────────────────────────────

  /**
   * ICS 텍스트에서 캘린더 이름 추출
   */
  function getCalendarName(icsText) {
    const match = icsText.match(/X-WR-CALNAME:(.*)/);
    return match ? match[1].trim() : '';
  }

  /**
   * 다일(multi-day) 이벤트를 날짜별로 확장
   */
  function expandMultiDay(event) {
    if (!event.dtstart || !event.dtend) return [event];
    if (event.dtstart.date === event.dtend.date) return [event];

    const results = [];
    const start = _toDateObj(event.dtstart.date);
    const end = _toDateObj(event.dtend.date);

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

  return { parse, getCalendarName, expandMultiDay, expandRecurring };
})();

const I18n = (() => {
  const LANG_KEY = 'app_lang';
  const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const translations = {
    ko: {
      // 네비게이션
      tab_clipboard: '클립보드',
      tab_macro: '매크로 저장소',
      tab_calendar: '일정',
      tab_bookmark: '북마크',
      tab_memo: '메모',
      tab_settings: '탭 설정',
      lang_btn: 'EN',
      // 테마
      theme_settings_btn: '🎨 테마 설정',
      theme_modal_title: '테마 설정',
      theme_text_color: '글씨색',
      theme_bg_color: '배경색',
      theme_primary_color: '포인트색',
      theme_primary_text_color: '포인트 글씨색',
      theme_hint: '*사이드바에서 스포이드 기능은 작동하지 않습니다.',
      // 공통
      search: '검색...',
      add: '추가',
      save: '저장',
      delete: '삭제',
      reset: '초기화',
      memo_toggle: '메모 표시/숨기기',
      tag_placeholder: '태그 입력 후 , 또는 Enter',
      tag_label: '태그',
      title_label: '제목',
      memo_label: '메모',
      url_label: 'URL',
      content_label: '내용',
      // TypeSaver
      ts_empty: '저장된 상용구가 없습니다.',
      ts_add: '상용구 추가',
      ts_edit: '상용구 수정',
      ts_title_ph: '제목을 입력하세요',
      ts_tag_hint: '쉼표(,)로 구분',
      ts_content_ph: '내용을 입력하세요\n예: ${이름}님 안녕하세요.',
      ts_params: '파라미터',
      ts_preview: '미리보기',
      ts_preview_empty: '내용을 입력하면 미리보기가 표시됩니다.',
      // MacroStorage
      ms_empty: '저장된 매크로가 없습니다.',
      ms_add: '매크로 추가',
      ms_edit: '매크로 수정',
      ms_title_ph: '매크로 이름',
      ms_content_ph: '매크로 내용',
      ms_select_all: '전체 선택',
      ms_deselect_all: '전체 해제',
      ms_roll20: 'Roll20에 추가',
      ms_look_auth: 'All Player 보기권한',
      ms_token_opt: '토큰옵션',
      // Bookmark
      bm_empty: '저장된 북마크가 없습니다.',
      bm_add: '북마크 추가',
      bm_edit: '북마크 수정',
      bm_title_ph: '북마크 이름',
      bm_add_url: '+ URL 추가',
      // Memo
      memo_persist: '브라우저 종료 후에도 내용 유지',
      memo_persist_hint: '체크 시 내용을 저장합니다',
      // Calendar
      cal_today: '오늘',
      cal_subs_manage: '캘린더 구독 관리',
      cal_subs_title: 'iCal 캘린더 구독',
      cal_subs_ph: 'iCal URL (https://...)',
      cal_url_open: '🔗 5분전 URL 열기',
      cal_evt_empty: '일정이 없습니다.',
      cal_evt_add: '일정 추가',
      cal_evt_edit: '일정 수정',
      cal_evt_name: '이름',
      cal_evt_name_ph: '일정 이름',
      cal_evt_date: '일자',
      cal_evt_time: '시간',
      cal_url_hint: '5분 전에 이 URL을 자동으로 엽니다.',
      cal_notify: '🔔 5분 전 알림',
      cal_dp_today: '오늘',
      cal_dp_clear: '초기화',
      cal_tp_now: '현재시각',
      cal_tp_clear: '초기화',
      cal_ical_title: 'iCal 일정',
      cal_ical_url_hint: '5분 전에 해당 URL을 자동으로 엽니다.',
      cal_ical_memo_ph: '메모 추가',
      cal_subs_empty: '구독한 캘린더가 없습니다.',
      cal_loading: '캘린더를 불러오는 중...',
      cal_added: '캘린더 추가 완료!',
      cal_refreshing: '새로고침 중...',
      cal_refreshed: '새로고침 완료!',
      cal_fail: '실패: ',
      cal_all_day: '종일',
      cal_ical_time: '시간',
      cal_ical_allday: '종일',
      cal_ical_allday_val: '종일 일정',
      cal_ical_location: '장소',
      cal_ical_desc: '상세정보',
      cal_ical_calendar: '캘린더',
      cal_sun: '일', cal_mon: '월', cal_tue: '화', cal_wed: '수',
      cal_thu: '목', cal_fri: '금', cal_sat: '토',
    },
    en: {
      // 네비게이션
      tab_clipboard: 'Clipboard',
      tab_macro: 'Macro Storage',
      tab_calendar: 'Schedule',
      tab_bookmark: 'Bookmark',
      tab_memo: 'Memo',
      tab_settings: 'Tab Settings',
      lang_btn: 'KO',
      // 테마
      theme_settings_btn: '🎨 Theme',
      theme_modal_title: 'Theme Settings',
      theme_text_color: 'Text Color',
      theme_bg_color: 'Background',
      theme_primary_color: 'Accent Color',
      theme_primary_text_color: 'Accent Text',
      theme_hint: '*Eyedropper does not work in the sidebar.',
      // 공통
      search: 'Search...',
      add: 'Add',
      save: 'Save',
      delete: 'Delete',
      reset: 'Reset',
      memo_toggle: 'Toggle Memo',
      tag_placeholder: 'Add tag, comma or Enter',
      tag_label: 'Tags',
      title_label: 'Title',
      memo_label: 'Memo',
      url_label: 'URL',
      content_label: 'Content',
      // TypeSaver
      ts_empty: 'No phrases saved.',
      ts_add: 'Add Phrase',
      ts_edit: 'Edit Phrase',
      ts_title_ph: 'Enter title',
      ts_tag_hint: 'Comma-separated',
      ts_content_ph: 'Enter content\nExample: Hello, ${name}!',
      ts_params: 'Parameters',
      ts_preview: 'Preview',
      ts_preview_empty: 'Preview will appear when content is entered.',
      // MacroStorage
      ms_empty: 'No macros saved.',
      ms_add: 'Add Macro',
      ms_edit: 'Edit Macro',
      ms_title_ph: 'Macro name',
      ms_content_ph: 'Macro content',
      ms_select_all: 'Select All',
      ms_deselect_all: 'Deselect All',
      ms_roll20: 'Add to Roll20',
      ms_look_auth: 'All Player Look Auth',
      ms_token_opt: 'Token Option',
      // Bookmark
      bm_empty: 'No bookmarks saved.',
      bm_add: 'Add Bookmark',
      bm_edit: 'Edit Bookmark',
      bm_title_ph: 'Bookmark name',
      bm_add_url: '+ Add URL',
      // Memo
      memo_persist: 'Persist after browser closes',
      memo_persist_hint: 'Check to save content',
      // Calendar
      cal_today: 'Today',
      cal_subs_manage: 'Manage Subscriptions',
      cal_subs_title: 'iCal Calendar Subscriptions',
      cal_subs_ph: 'iCal URL (https://...)',
      cal_url_open: '🔗 Open URL 5 min before',
      cal_evt_empty: 'No events.',
      cal_evt_add: 'Add Event',
      cal_evt_edit: 'Edit Event',
      cal_evt_name: 'Name',
      cal_evt_name_ph: 'Event name',
      cal_evt_date: 'Date',
      cal_evt_time: 'Time',
      cal_url_hint: 'This URL will open automatically 5 min before.',
      cal_notify: '🔔 5 min alert',
      cal_dp_today: 'Today',
      cal_dp_clear: 'Clear',
      cal_tp_now: 'Now',
      cal_tp_clear: 'Clear',
      cal_ical_title: 'iCal Event',
      cal_ical_url_hint: 'This URL will open automatically 5 min before.',
      cal_ical_memo_ph: 'Add memo',
      cal_subs_empty: 'No subscriptions.',
      cal_loading: 'Loading calendar...',
      cal_added: 'Calendar added!',
      cal_refreshing: 'Refreshing...',
      cal_refreshed: 'Refreshed!',
      cal_fail: 'Failed: ',
      cal_all_day: 'All day',
      cal_ical_time: 'Time',
      cal_ical_allday: 'All Day',
      cal_ical_allday_val: 'All-day event',
      cal_ical_location: 'Location',
      cal_ical_desc: 'Description',
      cal_ical_calendar: 'Calendar',
      cal_sun: 'Sun', cal_mon: 'Mon', cal_tue: 'Tue', cal_wed: 'Wed',
      cal_thu: 'Thu', cal_fri: 'Fri', cal_sat: 'Sat',
    }
  };

  function getLang() {
    return localStorage.getItem(LANG_KEY) || 'ko';
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.lang = lang;
  }

  function t(key) {
    const lang = getLang();
    return (translations[lang] && translations[lang][key]) ||
           translations.ko[key] || key;
  }

  // 캘린더 제목 형식: "2024년 3월" / "March 2024"
  function formatCalTitle(year, month0) {
    if (getLang() === 'en') return `${MONTH_NAMES_EN[month0]} ${year}`;
    return `${year}년 ${month0 + 1}월`;
  }

  // 날짜 형식: "3월 15일" / "March 15"
  function formatCalDate(month1, day) {
    if (getLang() === 'en') return `${MONTH_NAMES_EN[month1 - 1]} ${day}`;
    return `${month1}월 ${day}일`;
  }

  function applyI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.dataset.i18nTitle);
    });
    document.documentElement.lang = getLang();
  }

  // 부모(sidebar)로부터 언어 변경 메시지 수신
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'lang-update') {
      setLang(e.data.lang);
      applyI18n();
      window.dispatchEvent(new CustomEvent('langchange'));
    }
  });

  return { t, getLang, setLang, applyI18n, formatCalTitle, formatCalDate };
})();

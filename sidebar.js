document.addEventListener('DOMContentLoaded', () => {
  const SETTINGS_KEY = 'sidebar_tab_visibility';
  const ORDER_KEY = 'sidebar_tab_order';
  const nav = document.querySelector('.header__nav');
  const btnSettings = document.getElementById('btnSettings');
  const tabSettings = document.getElementById('tabSettings');

  // ── 탭 전환 (이벤트 위임) ──
  nav.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-tab[data-page]');
    if (!tab || tab.classList.contains('nav-tab--settings')) return;
    nav.querySelectorAll('.nav-tab[data-page]').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.page).classList.add('active');
  });

  // ── 설정 메뉴 토글 ──
  btnSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    const visible = tabSettings.style.display !== 'none';
    tabSettings.style.display = visible ? 'none' : 'flex';
  });

  document.addEventListener('click', (e) => {
    if (!tabSettings.contains(e.target) && e.target !== btnSettings) {
      tabSettings.style.display = 'none';
    }
  });

  // ── 헬퍼 ──
  function getSettingsItems() {
    return [...tabSettings.querySelectorAll('.tab-settings__item')];
  }

  function isVisible(item) {
    return item.dataset.visible === 'true';
  }

  // ── 탭 순서 저장/로드 ──
  function saveOrder() {
    const order = getSettingsItems().map(i => i.dataset.page);
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  }

  function loadOrder() {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY));
      if (saved && Array.isArray(saved)) {
        saved.forEach(page => {
          const item = tabSettings.querySelector(`.tab-settings__item[data-page="${page}"]`);
          if (item) tabSettings.appendChild(item);
        });
      }
    } catch { /* 기본 순서 유지 */ }
  }

  function applyTabOrder() {
    const order = getSettingsItems().map(i => i.dataset.page);
    // 설정 버튼 앞에 순서대로 탭 삽입
    order.forEach(page => {
      const tab = nav.querySelector(`.nav-tab[data-page="${page}"]`);
      if (tab) nav.insertBefore(tab, btnSettings);
    });
  }

  // ── 탭 가시성 저장/로드 ──
  function loadVisibility() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (saved) {
        getSettingsItems().forEach(item => {
          const page = item.dataset.page;
          if (saved[page] !== undefined) {
            item.dataset.visible = String(saved[page]);
          }
        });
      }
    } catch { /* 기본값 유지 */ }
  }

  function saveVisibility() {
    const settings = {};
    getSettingsItems().forEach(item => {
      settings[item.dataset.page] = isVisible(item);
    });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applyVisibility() {
    let hasActiveVisible = false;

    getSettingsItems().forEach(item => {
      const page = item.dataset.page;
      const tab = nav.querySelector(`.nav-tab[data-page="${page}"]`);
      const section = document.getElementById(page);

      if (isVisible(item)) {
        tab.style.display = '';
        if (tab.classList.contains('active') && section.classList.contains('active')) {
          hasActiveVisible = true;
        }
      } else {
        tab.style.display = 'none';
        if (tab.classList.contains('active')) {
          tab.classList.remove('active');
          section.classList.remove('active');
        }
      }
    });

    if (!hasActiveVisible) {
      const firstVisible = getSettingsItems().find(i => isVisible(i));
      if (firstVisible) {
        const page = firstVisible.dataset.page;
        const tab = nav.querySelector(`.nav-tab[data-page="${page}"]`);
        const section = document.getElementById(page);
        tab.classList.add('active');
        section.classList.add('active');
      }
    }
  }

  // ── 설정 아이템 클릭 (눈 토글) ──
  tabSettings.addEventListener('click', (e) => {
    const item = e.target.closest('.tab-settings__item');
    if (!item) return;
    // 핸들 드래그 중이면 무시
    if (e.target.closest('.tab-settings__handle')) return;

    const willHide = isVisible(item);
    if (willHide) {
      const visibleCount = getSettingsItems().filter(i => isVisible(i)).length;
      if (visibleCount <= 1) return;
    }
    item.dataset.visible = String(!willHide);
    saveVisibility();
    applyVisibility();
  });

  // ── 드래그 앤 드롭 (설정 메뉴 순서 변경) ──
  let dragSettingsItem = null;

  tabSettings.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.tab-settings__handle');
    const item = e.target.closest('.tab-settings__item');
    if (item) {
      item.draggable = !!handle;
    }
  });

  tabSettings.addEventListener('dragstart', (e) => {
    dragSettingsItem = e.target.closest('.tab-settings__item');
    if (!dragSettingsItem) return;
    dragSettingsItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  tabSettings.addEventListener('dragend', () => {
    if (dragSettingsItem) {
      dragSettingsItem.classList.remove('dragging');
      dragSettingsItem = null;
    }
    getSettingsItems().forEach(el => el.classList.remove('drag-over'));

    // 순서 저장 & 탭 반영
    saveOrder();
    applyTabOrder();
  });

  tabSettings.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.tab-settings__item');
    if (!target || target === dragSettingsItem) return;

    getSettingsItems().forEach(el => el.classList.remove('drag-over'));
    target.classList.add('drag-over');

    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;

    if (e.clientY < mid) {
      tabSettings.insertBefore(dragSettingsItem, target);
    } else {
      tabSettings.insertBefore(dragSettingsItem, target.nextSibling);
    }
  });

  // ── 테마 모달 ──
  const themeModalOverlay = document.getElementById('themeModalOverlay');
  const themeModal = document.getElementById('themeModal');
  const btnThemeModal = document.getElementById('btnThemeModal');
  const themeModalClose = document.getElementById('themeModalClose');

  btnThemeModal.addEventListener('click', () => {
    tabSettings.style.display = 'none';
    themeModalOverlay.style.display = 'flex';
  });

  themeModalClose.addEventListener('click', () => {
    themeModalOverlay.style.display = 'none';
  });

  themeModalOverlay.addEventListener('click', (e) => {
    if (!themeModal.contains(e.target)) {
      themeModalOverlay.style.display = 'none';
    }
  });

  // ── 테마 설정 ──
  const themeTextInput = document.getElementById('themeText');
  const themeBgInput = document.getElementById('themeBg');
  const themePrimaryInput = document.getElementById('themePrimary');
  const themePrimaryTextInput = document.getElementById('themePrimaryText');
  const themeResetBtn = document.getElementById('themeReset');

  const iframes = [
    document.getElementById('typeSaverFrame'),
    document.getElementById('macroStorageFrame'),
    document.getElementById('calendarFrame'),
    document.getElementById('bookmarkFrame'),
  ];

  function broadcastTheme(theme) {
    iframes.forEach(frame => {
      try { frame.contentWindow.postMessage({ type: 'theme-update', theme }, '*'); }
      catch { /* iframe not loaded yet */ }
    });
  }

  function applyAndSaveTheme(theme) {
    ThemeManager.apply(theme);
    ThemeManager.save(theme);
    broadcastTheme(theme);
  }

  function syncThemeInputs(theme) {
    themeTextInput.value = theme.text;
    themeBgInput.value = theme.bg;
    themePrimaryInput.value = theme.primary;
    themePrimaryTextInput.value = theme.primaryText || ThemeManager.DEFAULTS.primaryText;
  }

  themeTextInput.addEventListener('input', () => {
    const theme = ThemeManager.load();
    theme.text = themeTextInput.value;
    applyAndSaveTheme(theme);
  });

  themeBgInput.addEventListener('input', () => {
    const theme = ThemeManager.load();
    theme.bg = themeBgInput.value;
    applyAndSaveTheme(theme);
  });

  themePrimaryInput.addEventListener('input', () => {
    const theme = ThemeManager.load();
    theme.primary = themePrimaryInput.value;
    applyAndSaveTheme(theme);
  });

  themePrimaryTextInput.addEventListener('input', () => {
    const theme = ThemeManager.load();
    theme.primaryText = themePrimaryTextInput.value;
    applyAndSaveTheme(theme);
  });

  themeResetBtn.addEventListener('click', () => {
    const theme = { ...ThemeManager.DEFAULTS };
    applyAndSaveTheme(theme);
    syncThemeInputs(theme);
  });

  // ── 색상 그룹 (HEX 입력) ──
  const hexInputMap = {};

  [
    { input: themeTextInput, key: 'text' },
    { input: themeBgInput, key: 'bg' },
    { input: themePrimaryInput, key: 'primary' },
    { input: themePrimaryTextInput, key: 'primaryText' }
  ].forEach(({ input, key }) => {
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'theme-modal__hex';
    hexInput.maxLength = 7;
    hexInput.spellcheck = false;
    hexInputMap[key] = hexInput;

    hexInput.addEventListener('change', () => {
      let val = hexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        input.value = val;
        hexInput.value = val;
        input.dispatchEvent(new Event('input'));
      } else {
        hexInput.value = input.value; // 잘못된 입력 복원
      }
    });

    // color swatch 변경 시 hex도 동기화
    input.addEventListener('input', () => { hexInput.value = input.value; });

    const wrap = document.createElement('div');
    wrap.className = 'theme-modal__color-group';
    input.parentNode.replaceChild(wrap, input);
    wrap.appendChild(input);
    wrap.appendChild(hexInput);
  });

  // syncThemeInputs 재정의 (hex input도 함께 동기화)
  syncThemeInputs = (theme) => {
    themeTextInput.value = theme.text;
    themeBgInput.value = theme.bg;
    themePrimaryInput.value = theme.primary;
    themePrimaryTextInput.value = theme.primaryText || ThemeManager.DEFAULTS.primaryText;
    if (hexInputMap.text) hexInputMap.text.value = theme.text;
    if (hexInputMap.bg) hexInputMap.bg.value = theme.bg;
    if (hexInputMap.primary) hexInputMap.primary.value = theme.primary;
    if (hexInputMap.primaryText) hexInputMap.primaryText.value = theme.primaryText || ThemeManager.DEFAULTS.primaryText;
  };

  // ── 메모 추가 시 메모탭 자동 전환 ──
  whale.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.memo_append?.newValue) return;
    const memoTabEl = nav.querySelector('.nav-tab[data-page="page5"]');
    if (!memoTabEl) return;
    nav.querySelectorAll('.nav-tab[data-page]').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    memoTabEl.classList.add('active');
    document.getElementById('page5').classList.add('active');
  });

  // ── 초기화 ──
  loadOrder();
  loadVisibility();
  applyTabOrder();
  applyVisibility();
  syncThemeInputs(ThemeManager.load());
});

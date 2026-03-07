document.addEventListener('DOMContentLoaded', () => {
  const msList = document.getElementById('msList');
  const msEmpty = document.getElementById('msEmpty');
  const msSearch = document.querySelector('.ms-search');
  const msBtnAdd = document.querySelector('.ms-btn-add');
  const msTagFilter = document.getElementById('msTagFilter');
  const msBtnRoll20 = document.getElementById('msBtnRoll20');
  const msMemoToggle = document.getElementById('msMemoToggle');
  const msBtnSelectAll = document.getElementById('msBtnSelectAll');
  const msBtnDeselectAll = document.getElementById('msBtnDeselectAll');

  let selectedTags = [];

  const tagFilter = setupTagFilter({
    filterEl: msTagFilter,
    btnClass: 'ms-tag-btn',
    getTags: () => MacroStorage.getAllTags(),
    selectedTags,
    onChange: applyFilters
  });

  const dragSort = setupDragSort({
    listEl: msList,
    itemClass: 'ms-item',
    onReorder: (idxList) => MacroStorage.reorder(idxList),
    onSettle: applyFilters
  });

  const memoToggle = setupMemoToggle({
    toggleBtn: msMemoToggle,
    listEl: msList,
    memoClass: 'ms-item__memo',
    storageKey: 'macro_show_memo'
  });

  // ── 필터 통합 ──
  function applyFilters() {
    tagFilter.render();
    const keyword = msSearch.value.trim();
    let list;
    if (selectedTags.length > 0 && keyword) {
      const byTag = MacroStorage.filterByTags(selectedTags);
      const q = keyword.toLowerCase();
      list = byTag.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.content.toLowerCase().includes(q) ||
        i.tag.toLowerCase().includes(q)
      );
    } else if (selectedTags.length > 0) {
      list = MacroStorage.filterByTags(selectedTags);
    } else if (keyword) {
      list = MacroStorage.search(keyword);
    } else {
      list = null;
    }
    renderList(list);
  }

  // ── 목록 렌더링 ──
  function renderList(data) {
    const list = (data || MacroStorage.getAll()).sort((a, b) => (b.bookmark ? 1 : 0) - (a.bookmark ? 1 : 0));
    msList.innerHTML = '';
    if (list.length === 0) { msEmpty.classList.add('visible'); return; }
    msEmpty.classList.remove('visible');

    list.forEach(item => {
      const chk = el('input', { type: 'checkbox', dataset: { idx: item.idx } });
      if (item.checked) chk.checked = true;
      const checkLabel = el('label', { className: 'ms-item__check' }, [
        chk,
        el('span', { className: 'ms-item__checkmark' })
      ]);
      const titleRow = el('div', { className: 'ms-item__title-row' }, [
        el('span', { className: 'ms-item__title', textContent: item.title }),
        item.lookAuth ? el('span', { className: 'ms-item__badge badge--auth', textContent: 'All Player' }) : null,
        item.tokenOpt ? el('span', { className: 'ms-item__badge badge--token', textContent: '토큰액션' }) : null
      ]);
      const memoEl = item.memo
        ? el('div', { className: 'ms-item__memo' + (memoToggle.value ? '' : ' hidden'), textContent: item.memo })
        : null;
      const info = el('div', { className: 'ms-item__info', dataset: { idx: item.idx } }, [
        titleRow, buildTagSpans(item.tag, 'ms-item__tags'), memoEl
      ]);
      msList.appendChild(el('li', { className: 'ms-item', draggable: 'true', dataset: { idx: item.idx } }, [
        el('span', { className: 'ms-item__handle', textContent: '☰' }),
        el('button', { className: 'ms-item__bookmark' + (item.bookmark ? ' active' : ''), dataset: { idx: item.idx }, textContent: item.bookmark ? '★' : '☆' }),
        info,
        el('button', { className: 'ms-item__copy', dataset: { idx: item.idx }, title: '복사', innerHTML: SVG_COPY },

        ), checkLabel
      ]));
    });
  }

  // ── 클릭 이벤트 ──
  msList.addEventListener('click', (e) => {
    if (dragSort.isDragging) return;

    const copyBtn = e.target.closest('.ms-item__copy');
    if (copyBtn) {
      e.stopPropagation();
      const item = MacroStorage.getById(Number(copyBtn.dataset.idx));
      if (item) copyWithFeedback(copyBtn, item.content || '');
      return;
    }

    const checkbox = e.target.closest('.ms-item__check input[type="checkbox"]');
    if (checkbox) {
      e.stopPropagation();
      MacroStorage.update(Number(checkbox.dataset.idx), { checked: checkbox.checked });
      updateRoll20Btn();
      return;
    }

    const bookmarkBtn = e.target.closest('.ms-item__bookmark');
    if (bookmarkBtn) {
      e.stopPropagation();
      MacroStorage.toggleBookmark(Number(bookmarkBtn.dataset.idx));
      applyFilters();
      return;
    }

    const info = e.target.closest('.ms-item__info');
    if (info) window.location.href = `detail.html?idx=${info.dataset.idx}`;
  });

  msSearch.addEventListener('input', applyFilters);
  msBtnAdd.addEventListener('click', () => { window.location.href = 'detail.html'; });

  // ── 전체 선택 / 전체 해제 ──
  msBtnSelectAll.addEventListener('click', () => {
    msList.querySelectorAll('.ms-item').forEach(li => {
      const idx = Number(li.dataset.idx);
      const chk = li.querySelector('.ms-item__check input[type="checkbox"]');
      if (chk && !chk.checked) { chk.checked = true; MacroStorage.update(idx, { checked: true }); }
    });
    updateRoll20Btn();
  });

  msBtnDeselectAll.addEventListener('click', () => {
    MacroStorage.getAll().forEach(item => {
      if (item.checked) MacroStorage.update(item.idx, { checked: false });
    });
    msList.querySelectorAll('.ms-item__check input:checked').forEach(chk => { chk.checked = false; });
    updateRoll20Btn();
  });

  function updateRoll20Btn() {
    msBtnRoll20.disabled = !msList.querySelector('.ms-item__check input:checked');
  }

  // ── 토스트 ──
  const msToast = document.getElementById('msToast');
  let toastTimer = null;
  function showToast(msg, type) {
    clearTimeout(toastTimer);
    msToast.textContent = msg;
    msToast.className = 'ms-toast ' + type + ' visible';
    toastTimer = setTimeout(() => { msToast.classList.remove('visible'); }, 2500);
  }

  // ── Roll20에 매크로 추가 ──
  const btnText = msBtnRoll20.querySelector('.ms-btn-roll20__text');
  msBtnRoll20.addEventListener('click', () => {
    const checked = msList.querySelectorAll('.ms-item__check input:checked');
    if (checked.length === 0) return;
    const macros = [...checked].map(chk => MacroStorage.getById(Number(chk.dataset.idx))).filter(Boolean);
    if (macros.length === 0) return;
    msBtnRoll20.disabled = true;
    msBtnRoll20.classList.add('loading');
    btnText.textContent = '추가 중...';
    whale.runtime.sendMessage({ action: 'addMacrosToRoll20', macros }, (res) => {
      msBtnRoll20.classList.remove('loading');
      btnText.textContent = 'Roll20에 추가';
      if (res && res.success) {
        showToast(`${res.count}개 매크로 추가 완료`, 'success');
      } else {
        showToast(res && res.error ? res.error : '추가 실패', 'error');
      }
      updateRoll20Btn();
    });
  });

  // ── 초기 렌더링 ──
  MacroStorage.load().then(() => {
    whale.storage.sync.get('macro_show_memo', (result) => {
      memoToggle.set(!!result['macro_show_memo']);
      tagFilter.render();
      renderList();
      updateRoll20Btn();
    });
  });
});

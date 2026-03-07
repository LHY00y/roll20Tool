document.addEventListener('DOMContentLoaded', () => {
  const msList = document.getElementById('msList');
  const msEmpty = document.getElementById('msEmpty');
  const msSearch = document.querySelector('.ms-search');
  const msBtnAdd = document.querySelector('.ms-btn-add');
  const msTagFilter = document.getElementById('msTagFilter');

  let dragItem = null;
  let isDragging = false;
  let selectedTags = [];

  // ── SVG 아이콘 ──
  const SVG_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const SVG_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

  // ── DOM 헬퍼 ──
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') e.className = v;
      else if (k === 'textContent') e.textContent = v;
      else if (k === 'innerHTML') e.innerHTML = v;
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else e.setAttribute(k, v);
    }
    children.forEach(c => { if (c) e.appendChild(c); });
    return e;
  }

  // ── 태그 필터 ──
  function renderTagFilter() {
    const allTags = MacroStorage.getAllTags();
    msTagFilter.innerHTML = '';

    if (allTags.length === 0) {
      msTagFilter.classList.add('hidden');
      return;
    }

    msTagFilter.classList.remove('hidden');

    allTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'ms-tag-btn' + (selectedTags.includes(tag) ? ' active' : '');
      btn.textContent = tag;
      btn.dataset.tag = tag;
      msTagFilter.appendChild(btn);
    });
  }

  msTagFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.ms-tag-btn');
    if (!btn) return;

    const tag = btn.dataset.tag;
    const idx = selectedTags.indexOf(tag);

    if (idx === -1) {
      selectedTags.push(tag);
    } else {
      selectedTags.splice(idx, 1);
    }

    applyFilters();
  });

  // ── 검색 + 태그 통합 필터 ──
  function applyFilters() {
    renderTagFilter();

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

  function buildTagSpans(tagStr, cls) {
    if (!tagStr) return null;
    const tags = tagStr.split(',').map(t => t.trim()).filter(t => t);
    if (tags.length === 0) return null;
    const wrap = el('div', { className: cls });
    tags.forEach(t => wrap.appendChild(el('span', { className: cls.replace('tags', 'tag'), textContent: t })));
    return wrap;
  }

  // ── 목록 렌더링 ──
  function renderList(data) {
    const list = (data || MacroStorage.getAll()).sort((a, b) => (b.bookmark ? 1 : 0) - (a.bookmark ? 1 : 0));
    msList.innerHTML = '';

    if (list.length === 0) {
      msEmpty.classList.add('visible');
      return;
    }

    msEmpty.classList.remove('visible');

    list.forEach(item => {
      // 체크박스
      const chk = el('input', { type: 'checkbox', dataset: { idx: item.idx } });
      if (item.checked) chk.checked = true;
      const checkLabel = el('label', { className: 'ms-item__check' }, [
        chk,
        el('span', { className: 'ms-item__checkmark' })
      ]);

      // 제목 행 (뱃지 포함)
      const titleRow = el('div', { className: 'ms-item__title-row' }, [
        el('span', { className: 'ms-item__title', textContent: item.title }),
        item.lookAuth ? el('span', { className: 'ms-item__badge badge--auth', textContent: 'AllPlayer' }) : null,
        item.tokenOpt ? el('span', { className: 'ms-item__badge badge--token', textContent: '토큰액션' }) : null
      ]);

      const info = el('div', { className: 'ms-item__info', dataset: { idx: item.idx } }, [
        titleRow,
        buildTagSpans(item.tag, 'ms-item__tags')
      ]);

      const li = el('li', { className: 'ms-item', draggable: 'true', dataset: { idx: item.idx } }, [
        el('span', { className: 'ms-item__handle', textContent: '☰' }),
        checkLabel,
        el('button', { className: 'ms-item__bookmark' + (item.bookmark ? ' active' : ''), dataset: { idx: item.idx }, textContent: item.bookmark ? '★' : '☆' }),
        info,
        el('button', { className: 'ms-item__copy', dataset: { idx: item.idx }, title: '복사', innerHTML: SVG_COPY })
      ]);

      msList.appendChild(li);
    });
  }

  // ── 드래그 앤 드롭 (핸들에서만) ──
  msList.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.ms-item__handle');
    const item = e.target.closest('.ms-item');
    if (item) {
      item.draggable = !!handle;
    }
  });

  msList.addEventListener('dragstart', (e) => {
    dragItem = e.target.closest('.ms-item');
    if (!dragItem) return;
    isDragging = true;
    dragItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  msList.addEventListener('dragend', () => {
    if (dragItem) {
      dragItem.classList.remove('dragging');
      dragItem = null;
    }
    isDragging = false;
    msList.querySelectorAll('.ms-item').forEach(el => el.classList.remove('drag-over'));

    const orderedIdxList = [...msList.querySelectorAll('.ms-item')].map(el => Number(el.dataset.idx));
    MacroStorage.reorder(orderedIdxList);
    applyFilters();
  });

  msList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.ms-item');
    if (!target || target === dragItem) return;

    msList.querySelectorAll('.ms-item').forEach(el => el.classList.remove('drag-over'));
    target.classList.add('drag-over');

    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;

    if (e.clientY < mid) {
      msList.insertBefore(dragItem, target);
    } else {
      msList.insertBefore(dragItem, target.nextSibling);
    }
  });

  // ── 클릭 이벤트 ──
  msList.addEventListener('click', (e) => {
    if (isDragging) return;

    // 복사
    const copyBtn = e.target.closest('.ms-item__copy');
    if (copyBtn) {
      e.stopPropagation();
      const idx = Number(copyBtn.dataset.idx);
      const item = MacroStorage.getById(idx);
      if (item) {
        navigator.clipboard.writeText(item.content || '').then(() => {
          copyBtn.innerHTML = SVG_CHECK;
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML = SVG_COPY;
            copyBtn.classList.remove('copied');
          }, 1500);
        });
      }
      return;
    }

    // 체크박스
    const checkbox = e.target.closest('.ms-item__check input[type="checkbox"]');
    if (checkbox) {
      e.stopPropagation();
      const idx = Number(checkbox.dataset.idx);
      MacroStorage.update(idx, { checked: checkbox.checked });
      return;
    }

    // 북마크
    const bookmarkBtn = e.target.closest('.ms-item__bookmark');
    if (bookmarkBtn) {
      e.stopPropagation();
      const idx = Number(bookmarkBtn.dataset.idx);
      MacroStorage.toggleBookmark(idx);
      applyFilters();
      return;
    }

    // 행 클릭 → detail 이동
    const info = e.target.closest('.ms-item__info');
    if (info) {
      const idx = Number(info.dataset.idx);
      window.location.href = `detail.html?idx=${idx}`;
    }
  });

  // 검색
  msSearch.addEventListener('input', () => {
    applyFilters();
  });

  // 추가
  msBtnAdd.addEventListener('click', () => {
    window.location.href = 'detail.html';
  });

  // 초기 렌더링
  MacroStorage.load().then(() => {
    renderTagFilter();
    renderList();
  });
});

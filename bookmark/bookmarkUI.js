document.addEventListener('DOMContentLoaded', () => {
  const bmList = document.getElementById('bmList');
  const bmEmpty = document.getElementById('bmEmpty');
  const bmSearch = document.querySelector('.bm-search');
  const bmBtnAdd = document.querySelector('.bm-btn-add');
  const bmTagFilter = document.getElementById('bmTagFilter');
  const bmMemoToggle = document.getElementById('bmMemoToggle');

  let dragItem = null;
  let isDragging = false;
  let selectedTags = [];
  let showMemo = false;

  // ── SVG 아이콘 ──
  const SVG_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const SVG_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const SVG_OPEN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

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
    const allTags = BookmarkData.getAllTags();
    bmTagFilter.innerHTML = '';

    if (allTags.length === 0) {
      bmTagFilter.classList.add('hidden');
      return;
    }

    bmTagFilter.classList.remove('hidden');

    allTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'bm-tag-btn' + (selectedTags.includes(tag) ? ' active' : '');
      btn.textContent = tag;
      btn.dataset.tag = tag;
      bmTagFilter.appendChild(btn);
    });
  }

  bmTagFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.bm-tag-btn');
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

  // ── 필터 통합 ──
  function applyFilters() {
    renderTagFilter();

    const keyword = bmSearch.value.trim();
    let list;

    if (selectedTags.length > 0 && keyword) {
      const byTag = BookmarkData.filterByTags(selectedTags);
      const q = keyword.toLowerCase();
      list = byTag.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.url.toLowerCase().includes(q) ||
        i.tag.toLowerCase().includes(q) ||
        (i.memo || '').toLowerCase().includes(q)
      );
    } else if (selectedTags.length > 0) {
      list = BookmarkData.filterByTags(selectedTags);
    } else if (keyword) {
      list = BookmarkData.search(keyword);
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
    const list = (data || BookmarkData.getAll()).sort((a, b) => (b.bookmark ? 1 : 0) - (a.bookmark ? 1 : 0));
    bmList.innerHTML = '';

    if (list.length === 0) {
      bmEmpty.classList.add('visible');
      return;
    }

    bmEmpty.classList.remove('visible');

    list.forEach(item => {
      // 제목 행
      const titleRow = el('div', { className: 'bm-item__title-row' }, [
        el('span', { className: 'bm-item__title', title: item.url || '', textContent: item.title }),
        item.url ? el('span', { className: 'bm-item__url', textContent: item.url }) : null
      ]);

      // 메모
      const memo = item.memo
        ? el('div', { className: 'bm-item__memo' + (showMemo ? '' : ' hidden'), textContent: item.memo })
        : null;

      const info = el('div', { className: 'bm-item__info', dataset: { idx: item.idx } }, [
        titleRow,
        buildTagSpans(item.tag, 'bm-item__tags'),
        memo
      ]);

      const li = el('li', { className: 'bm-item', draggable: 'true', dataset: { idx: item.idx } }, [
        el('span', { className: 'bm-item__handle', textContent: '☰' }),
        el('button', { className: 'bm-item__bookmark' + (item.bookmark ? ' active' : ''), dataset: { idx: item.idx }, textContent: item.bookmark ? '★' : '☆' }),
        info,
        el('button', { className: 'bm-item__open', dataset: { idx: item.idx }, title: '새 페이지로 열기', innerHTML: SVG_OPEN }),
        el('button', { className: 'bm-item__copy', dataset: { idx: item.idx }, title: 'URL 복사', innerHTML: SVG_COPY })
      ]);

      bmList.appendChild(li);
    });
  }

  // ── 드래그 앤 드롭 ──
  bmList.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.bm-item__handle');
    const item = e.target.closest('.bm-item');
    if (item) {
      item.draggable = !!handle;
    }
  });

  bmList.addEventListener('dragstart', (e) => {
    dragItem = e.target.closest('.bm-item');
    if (!dragItem) return;
    isDragging = true;
    dragItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  bmList.addEventListener('dragend', () => {
    if (dragItem) {
      dragItem.classList.remove('dragging');
      dragItem = null;
    }
    isDragging = false;
    bmList.querySelectorAll('.bm-item').forEach(el => el.classList.remove('drag-over'));

    const orderedIdxList = [...bmList.querySelectorAll('.bm-item')].map(el => Number(el.dataset.idx));
    BookmarkData.reorder(orderedIdxList);
    applyFilters();
  });

  bmList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.bm-item');
    if (!target || target === dragItem) return;

    bmList.querySelectorAll('.bm-item').forEach(el => el.classList.remove('drag-over'));
    target.classList.add('drag-over');

    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;

    if (e.clientY < mid) {
      bmList.insertBefore(dragItem, target);
    } else {
      bmList.insertBefore(dragItem, target.nextSibling);
    }
  });

  // ── 클릭 이벤트 ──
  bmList.addEventListener('click', (e) => {
    if (isDragging) return;

    // 새 페이지로 열기
    const openBtn = e.target.closest('.bm-item__open');
    if (openBtn) {
      e.stopPropagation();
      const idx = Number(openBtn.dataset.idx);
      const item = BookmarkData.getById(idx);
      if (item && item.url) {
        window.open(item.url, '_blank');
      }
      return;
    }

    // URL 복사
    const copyBtn = e.target.closest('.bm-item__copy');
    if (copyBtn) {
      e.stopPropagation();
      const idx = Number(copyBtn.dataset.idx);
      const item = BookmarkData.getById(idx);
      if (item && item.url) {
        navigator.clipboard.writeText(item.url).then(() => {
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

    // 북마크
    const bookmarkBtn = e.target.closest('.bm-item__bookmark');
    if (bookmarkBtn) {
      e.stopPropagation();
      const idx = Number(bookmarkBtn.dataset.idx);
      BookmarkData.toggleBookmark(idx);
      applyFilters();
      return;
    }

    // 행 클릭 → detail 페이지
    const info = e.target.closest('.bm-item__info');
    if (info) {
      const idx = Number(info.dataset.idx);
      window.location.href = `detail.html?idx=${idx}`;
    }
  });

  // ── 검색 ──
  bmSearch.addEventListener('input', () => {
    applyFilters();
  });

  // ── 메모 토글 ──
  function updateMemoToggleUI() {
    bmMemoToggle.classList.toggle('active', showMemo);
  }

  bmMemoToggle.addEventListener('click', () => {
    showMemo = !showMemo;
    whale.storage.sync.set({ bookmark_show_memo: showMemo });
    updateMemoToggleUI();
    bmList.querySelectorAll('.bm-item__memo').forEach(el => {
      el.classList.toggle('hidden', !showMemo);
    });
  });

  // ── 추가 ──
  bmBtnAdd.addEventListener('click', () => {
    window.location.href = 'detail.html';
  });

  // ── 초기 렌더링 ──
  BookmarkData.load().then(() => {
    whale.storage.sync.get('bookmark_show_memo', (result) => {
      showMemo = !!result['bookmark_show_memo'];
      updateMemoToggleUI();
      renderTagFilter();
      renderList();
    });
  });
});

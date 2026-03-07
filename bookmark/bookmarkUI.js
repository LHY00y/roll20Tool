document.addEventListener('DOMContentLoaded', () => {
  const bmList = document.getElementById('bmList');
  const bmEmpty = document.getElementById('bmEmpty');
  const bmSearch = document.querySelector('.bm-search');
  const bmBtnAdd = document.querySelector('.bm-btn-add');
  const bmTagFilter = document.getElementById('bmTagFilter');
  const bmMemoToggle = document.getElementById('bmMemoToggle');

  let selectedTags = [];

  const tagFilter = setupTagFilter({
    filterEl: bmTagFilter,
    btnClass: 'bm-tag-btn',
    getTags: () => BookmarkData.getAllTags(),
    selectedTags,
    onChange: applyFilters
  });

  const dragSort = setupDragSort({
    listEl: bmList,
    itemClass: 'bm-item',
    onReorder: (idxList) => BookmarkData.reorder(idxList),
    onSettle: applyFilters
  });

  const memoToggle = setupMemoToggle({
    toggleBtn: bmMemoToggle,
    listEl: bmList,
    memoClass: 'bm-item__memo',
    storageKey: 'bookmark_show_memo'
  });

  // ── 필터 통합 ──
  function applyFilters() {
    tagFilter.render();
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

  // ── 목록 렌더링 ──
  function renderList(data) {
    const list = (data || BookmarkData.getAll()).sort((a, b) => (b.bookmark ? 1 : 0) - (a.bookmark ? 1 : 0));
    bmList.innerHTML = '';
    if (list.length === 0) { bmEmpty.classList.add('visible'); return; }
    bmEmpty.classList.remove('visible');

    list.forEach(item => {
      const titleRow = el('div', { className: 'bm-item__title-row' }, [
        el('span', { className: 'bm-item__title', title: item.url || '', textContent: item.title }),
        item.url ? el('span', { className: 'bm-item__url', textContent: item.url }) : null
      ]);
      const memo = item.memo
        ? el('div', { className: 'bm-item__memo' + (memoToggle.value ? '' : ' hidden'), textContent: item.memo })
        : null;
      const info = el('div', { className: 'bm-item__info', dataset: { idx: item.idx } }, [
        titleRow, buildTagSpans(item.tag, 'bm-item__tags'), memo
      ]);
      bmList.appendChild(el('li', { className: 'bm-item', draggable: 'true', dataset: { idx: item.idx } }, [
        el('span', { className: 'bm-item__handle', textContent: '☰' }),
        el('button', { className: 'bm-item__bookmark' + (item.bookmark ? ' active' : ''), dataset: { idx: item.idx }, textContent: item.bookmark ? '★' : '☆' }),
        info,
        el('button', { className: 'bm-item__open', dataset: { idx: item.idx }, title: '새 페이지로 열기', innerHTML: SVG_OPEN }),
        el('button', { className: 'bm-item__copy', dataset: { idx: item.idx }, title: 'URL 복사', innerHTML: SVG_COPY })
      ]));
    });
  }

  // ── 클릭 이벤트 ──
  bmList.addEventListener('click', (e) => {
    if (dragSort.isDragging) return;

    const openBtn = e.target.closest('.bm-item__open');
    if (openBtn) {
      e.stopPropagation();
      const item = BookmarkData.getById(Number(openBtn.dataset.idx));
      if (item && item.url) window.open(item.url, '_blank');
      return;
    }

    const copyBtn = e.target.closest('.bm-item__copy');
    if (copyBtn) {
      e.stopPropagation();
      const item = BookmarkData.getById(Number(copyBtn.dataset.idx));
      if (item && item.url) copyWithFeedback(copyBtn, item.url);
      return;
    }

    const bookmarkBtn = e.target.closest('.bm-item__bookmark');
    if (bookmarkBtn) {
      e.stopPropagation();
      BookmarkData.toggleBookmark(Number(bookmarkBtn.dataset.idx));
      applyFilters();
      return;
    }

    const info = e.target.closest('.bm-item__info');
    if (info) window.location.href = `detail.html?idx=${info.dataset.idx}`;
  });

  bmSearch.addEventListener('input', applyFilters);
  bmBtnAdd.addEventListener('click', () => { window.location.href = 'detail.html'; });

  // ── 초기 렌더링 ──
  BookmarkData.load().then(() => {
    whale.storage.sync.get('bookmark_show_memo', (result) => {
      memoToggle.set(!!result['bookmark_show_memo']);
      tagFilter.render();
      renderList();
    });
  });
});

document.addEventListener('DOMContentLoaded', () => {
  const tsList = document.getElementById('tsList');
  const tsEmpty = document.getElementById('tsEmpty');
  const tsSearch = document.querySelector('.ts-search');
  const tsBtnAdd = document.querySelector('.ts-btn-add');
  const tsTagFilter = document.getElementById('tsTagFilter');

  let dragItem = null;
  let isDragging = false;
  let selectedTags = [];

  // 태그 필터 렌더링
  function renderTagFilter() {
    const allTags = TypeSaver.getAllTags();
    tsTagFilter.innerHTML = '';

    if (allTags.length === 0) {
      tsTagFilter.classList.add('hidden');
      return;
    }

    tsTagFilter.classList.remove('hidden');

    allTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'ts-tag-btn' + (selectedTags.includes(tag) ? ' active' : '');
      btn.textContent = tag;
      btn.dataset.tag = tag;
      tsTagFilter.appendChild(btn);
    });
  }

  // 태그 필터 클릭
  tsTagFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.ts-tag-btn');
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

  // 검색 + 태그 필터 통합
  function applyFilters() {
    renderTagFilter();

    const keyword = tsSearch.value.trim();
    let list;

    if (selectedTags.length > 0 && keyword) {
      const byTag = TypeSaver.filterByTags(selectedTags);
      const q = keyword.toLowerCase();
      list = byTag.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.content.toLowerCase().includes(q) ||
        i.tag.toLowerCase().includes(q)
      );
    } else if (selectedTags.length > 0) {
      list = TypeSaver.filterByTags(selectedTags);
    } else if (keyword) {
      list = TypeSaver.search(keyword);
    } else {
      list = null;
    }

    renderList(list);
  }

  function renderList(data) {
    const list = data || TypeSaver.getAll();
    tsList.innerHTML = '';

    if (list.length === 0) {
      tsEmpty.classList.add('visible');
      return;
    }

    tsEmpty.classList.remove('visible');

    list.forEach(item => {
      const li = document.createElement('li');
      li.className = 'ts-item';
      li.dataset.idx = item.idx;
      li.draggable = true;

      const itemTags = item.tag ? item.tag.split(',').map(t => t.trim()).filter(t => t) : [];
      const tagHtml = itemTags.map(t =>
        `<span class="ts-item__tag">${escapeHtml(t)}</span>`
      ).join('');

      li.innerHTML = `
        <span class="ts-item__handle">☰</span>
        <button class="ts-item__bookmark ${item.bookmark ? 'active' : ''}" data-idx="${item.idx}">
          ${item.bookmark ? '★' : '☆'}
        </button>
        <div class="ts-item__info" data-idx="${item.idx}">
          <div class="ts-item__title">${escapeHtml(item.title)}</div>
          ${tagHtml ? `<div class="ts-item__tags">${tagHtml}</div>` : ''}
        </div>
        <button class="ts-item__copy" data-idx="${item.idx}" title="복사">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      `;

      tsList.appendChild(li);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // 드래그 앤 드롭 (핸들에서만 시작)
  tsList.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.ts-item__handle');
    const item = e.target.closest('.ts-item');
    if (item) {
      item.draggable = !!handle;
    }
  });

  tsList.addEventListener('dragstart', (e) => {
    dragItem = e.target.closest('.ts-item');
    if (!dragItem) return;
    isDragging = true;
    dragItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  tsList.addEventListener('dragend', () => {
    if (dragItem) {
      dragItem.classList.remove('dragging');
      dragItem = null;
    }
    isDragging = false;
    tsList.querySelectorAll('.ts-item').forEach(el => el.classList.remove('drag-over'));

    const orderedIdxList = [...tsList.querySelectorAll('.ts-item')].map(el => Number(el.dataset.idx));
    TypeSaver.reorder(orderedIdxList);
    applyFilters();
  });

  tsList.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.ts-item');
    if (!target || target === dragItem) return;

    tsList.querySelectorAll('.ts-item').forEach(el => el.classList.remove('drag-over'));
    target.classList.add('drag-over');

    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;

    if (e.clientY < mid) {
      tsList.insertBefore(dragItem, target);
    } else {
      tsList.insertBefore(dragItem, target.nextSibling);
    }
  });

  // 클릭 이벤트
  tsList.addEventListener('click', (e) => {
    if (isDragging) return;

    // 복사
    const copyBtn = e.target.closest('.ts-item__copy');
    if (copyBtn) {
      e.stopPropagation();
      const idx = Number(copyBtn.dataset.idx);
      const item = TypeSaver.getById(idx);
      if (item) {
        const filtered = item.content.replace(/\$\{[^}]+\}/g, '');
        const html = marked.parse(filtered);
        const clipItem = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([filtered], { type: 'text/plain' })
        });
        navigator.clipboard.write([clipItem]).then(() => {
          copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
            copyBtn.classList.remove('copied');
          }, 1500);
        });
      }
      return;
    }

    // 북마크
    const bookmarkBtn = e.target.closest('.ts-item__bookmark');
    if (bookmarkBtn) {
      e.stopPropagation();
      const idx = Number(bookmarkBtn.dataset.idx);
      TypeSaver.toggleBookmark(idx);
      applyFilters();
      return;
    }

    // 행 클릭 → detail 페이지 이동
    const info = e.target.closest('.ts-item__info');
    if (info) {
      const idx = Number(info.dataset.idx);
      window.location.href = `detail.html?idx=${idx}`;
    }
  });

  // 검색
  tsSearch.addEventListener('input', () => {
    applyFilters();
  });

  // 추가
  tsBtnAdd.addEventListener('click', () => {
    window.location.href = 'detail.html';
  });

  // 초기 렌더링
  renderTagFilter();
  renderList();
});

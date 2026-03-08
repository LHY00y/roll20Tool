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

// ── 태그 스팬 생성 ──
function buildTagSpans(tagStr, cls) {
  if (!tagStr) return null;
  const tags = tagStr.split(',').map(t => t.trim()).filter(t => t);
  if (tags.length === 0) return null;
  const wrap = el('div', { className: cls });
  tags.forEach(t => wrap.appendChild(el('span', { className: cls.replace('tags', 'tag'), textContent: t })));
  return wrap;
}

// ── 클립보드 복사 + 피드백 ──
function copyWithFeedback(btn, text) {
  return navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = SVG_CHECK;
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = SVG_COPY;
      btn.classList.remove('copied');
    }, 1500);
  });
}

// ── 태그 필터 설정 ──
function setupTagFilter({ filterEl, btnClass, getTags, selectedTags, onChange }) {
  function render() {
    const allTags = getTags();
    filterEl.innerHTML = '';
    if (allTags.length === 0) { filterEl.classList.add('hidden'); return; }
    filterEl.classList.remove('hidden');
    allTags.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = btnClass + (selectedTags.includes(tag) ? ' active' : '');
      btn.textContent = tag;
      btn.dataset.tag = tag;
      filterEl.appendChild(btn);
    });
  }
  filterEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.' + btnClass);
    if (!btn) return;
    const tag = btn.dataset.tag;
    const idx = selectedTags.indexOf(tag);
    if (idx === -1) selectedTags.push(tag); else selectedTags.splice(idx, 1);
    onChange();
  });
  return { render };
}

// ── 드래그 정렬 설정 ──
function setupDragSort({ listEl, itemClass, onReorder, onSettle }) {
  let dragItem = null;
  let isDragging = false;
  listEl.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.' + itemClass + '__handle');
    const item = e.target.closest('.' + itemClass);
    if (item) item.draggable = !!handle;
  });
  listEl.addEventListener('dragstart', (e) => {
    dragItem = e.target.closest('.' + itemClass);
    if (!dragItem) return;
    isDragging = true;
    dragItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  listEl.addEventListener('dragend', () => {
    if (dragItem) { dragItem.classList.remove('dragging'); dragItem = null; }
    isDragging = false;
    listEl.querySelectorAll('.' + itemClass).forEach(e => e.classList.remove('drag-over'));
    const orderedIdxList = [...listEl.querySelectorAll('.' + itemClass)].map(e => Number(e.dataset.idx));
    // save() 완료 후 onSettle 실행 (race condition 방지: 저장 전에 새 idx로 클릭하면 잘못된 항목 수정됨)
    const result = onReorder(orderedIdxList);
    if (result && typeof result.then === 'function') {
      result.then(onSettle);
    } else {
      onSettle();
    }
  });
  listEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    const target = e.target.closest('.' + itemClass);
    if (!target || target === dragItem) return;
    listEl.querySelectorAll('.' + itemClass).forEach(e => e.classList.remove('drag-over'));
    target.classList.add('drag-over');
    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if (e.clientY < mid) listEl.insertBefore(dragItem, target);
    else listEl.insertBefore(dragItem, target.nextSibling);
  });
  return { get isDragging() { return isDragging; } };
}

// ── 태그 자동완성 설정 ──
function setupTagAutocomplete({ tagInput, tagInputWrap, getExistingTags, getTags, onSelect }) {
  tagInputWrap.style.position = 'relative';
  const dropdown = document.createElement('div');
  dropdown.className = 'tag-autocomplete';
  tagInputWrap.appendChild(dropdown);

  let activeIdx = -1;
  let suggestions = [];

  function show(items) {
    suggestions = items;
    activeIdx = -1;
    dropdown.innerHTML = '';
    if (items.length === 0) { dropdown.classList.remove('open'); return; }
    items.forEach(tag => {
      const item = document.createElement('div');
      item.className = 'tag-autocomplete__item';
      item.textContent = tag;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // blur 이전에 mousedown 처리
        select(tag);
      });
      dropdown.appendChild(item);
    });
    dropdown.classList.add('open');
    updateActive();
  }

  function hide() {
    dropdown.classList.remove('open');
    activeIdx = -1;
    suggestions = [];
  }

  function updateActive() {
    [...dropdown.querySelectorAll('.tag-autocomplete__item')].forEach((el, i) => {
      el.classList.toggle('active', i === activeIdx);
    });
  }

  function select(tag) {
    onSelect(tag);
    tagInput.value = ''; // 선택 후 입력창 정리 (기존 태그 칩은 유지)
    hide();
  }

  function refresh() {
    const q = tagInput.value.trim().toLowerCase();
    const current = getTags();
    const all = getExistingTags().filter(t => !current.includes(t));
    const filtered = q ? all.filter(t => t.toLowerCase().includes(q)) : all;
    show(filtered);
  }

  tagInput.addEventListener('input', refresh);

  tagInput.addEventListener('keydown', (e) => {
    if (e.isComposing) return; // 한글 IME 조합 중 무시
    if (!dropdown.classList.contains('open')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, suggestions.length - 1);
      updateActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, -1);
      updateActive();
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      select(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      hide();
    }
  });

  tagInput.addEventListener('blur', () => setTimeout(hide, 150));
  tagInput.addEventListener('focus', refresh); // 포커스 시 전체 목록 표시

  // isHandling(): Enter 키를 자동완성이 처리 중인지 여부 (호출부에서 addTag 억제에 사용)
  return { isHandling: () => dropdown.classList.contains('open') && activeIdx >= 0 };
}

// ── 메모 토글 설정 ──
function setupMemoToggle({ toggleBtn, listEl, memoClass, storageKey }) {
  let show = false;
  function set(value) {
    show = !!value;
    toggleBtn.classList.toggle('active', show);
  }
  toggleBtn.addEventListener('click', () => {
    show = !show;
    whale.storage.sync.set({ [storageKey]: show });
    toggleBtn.classList.toggle('active', show);
    listEl.querySelectorAll('.' + memoClass).forEach(e => e.classList.toggle('hidden', !show));
  });
  return { get value() { return show; }, set };
}

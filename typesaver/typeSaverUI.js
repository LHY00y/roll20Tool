document.addEventListener('DOMContentLoaded', () => {
  const tsList = document.getElementById('tsList');
  const tsEmpty = document.getElementById('tsEmpty');
  const tsSearch = document.querySelector('.ts-search');
  const tsBtnAdd = document.querySelector('.ts-btn-add');
  const tsTagFilter = document.getElementById('tsTagFilter');

  let dragItem = null;
  let isDragging = false;
  let selectedTags = [];

  // ── 클립보드 복사 헬퍼 ──
  function copyToClipboard(text, btn) {
    const doSuccess = () => {
      btn.innerHTML = SVG_CHECK;
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = SVG_COPY;
        btn.classList.remove('copied');
      }, 1500);
    };

    try {
      const html = marked.parse(text);
      const clipItem = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      });
      navigator.clipboard.write([clipItem]).then(doSuccess).catch(() => {
        navigator.clipboard.writeText(text).then(doSuccess);
      });
    } catch {
      navigator.clipboard.writeText(text).then(doSuccess);
    }
  }

  // ── SVG 아이콘 ──
  const SVG_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const SVG_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const SVG_EDIT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

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

  // ── 파라미터 추출 ──
  function extractParams(content) {
    const matches = content.match(/\$\{([^}]+)\}/g);
    if (!matches) return [];
    const seen = new Set();
    return matches
      .map(m => m.slice(2, -1))
      .filter(name => { if (seen.has(name)) return false; seen.add(name); return true; });
  }

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

  function buildTagSpans(tagStr, cls) {
    if (!tagStr) return null;
    const tags = tagStr.split(',').map(t => t.trim()).filter(t => t);
    if (tags.length === 0) return null;
    const wrap = el('div', { className: cls });
    tags.forEach(t => wrap.appendChild(el('span', { className: cls.replace('tags', 'tag'), textContent: t })));
    return wrap;
  }

  // ── 미리보기 텍스트 생성 ──
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildOriginalHtml(content) {
    return escapeHtml(content).replace(/\$\{([^}]+)\}/g,
      (m, name) => `<span class="ts-preview__placeholder">\${${name}}</span>`
    );
  }

  function buildResultHtml(content, inputs) {
    const values = {};
    if (inputs) inputs.forEach(inp => { values[inp.dataset.param] = inp.value; });
    return escapeHtml(content).replace(/\$\{([^}]+)\}/g, (m, name) => {
      const val = values[name];
      return val ? escapeHtml(val) : '';
    });
  }

  function updatePreview(panel, content) {
    const result = panel.querySelector('.ts-preview__result');
    if (!result) return;
    result.innerHTML = buildResultHtml(content, panel.querySelectorAll('.ts-params__input'));
  }

  // ── 파라미터 패널 생성 ──
  function buildParamsPanel(item) {
    const params = extractParams(item.content || '');
    const panel = el('div', { className: 'ts-item__params', dataset: { content: item.content || '' } });

    if (params.length > 0) {
      params.forEach(name => {
        const row = el('div', { className: 'ts-params__row' }, [
          el('label', { className: 'ts-params__label', textContent: name }),
          el('input', { type: 'text', className: 'ts-params__input', dataset: { param: name }, placeholder: name })
        ]);
        panel.appendChild(row);
      });
    }

    // 미리보기: 원본 → 결과 [복사]
    const original = el('div', { className: 'ts-preview__original' });
    original.innerHTML = buildOriginalHtml(item.content || '');

    const result = el('div', { className: 'ts-preview__result' });
    result.innerHTML = buildResultHtml(item.content || '', null);

    const copyBtn = el('button', { className: 'ts-params__copy', dataset: { idx: item.idx }, innerHTML: SVG_COPY });

    const previewRow = el('div', { className: 'ts-params__preview-row' }, [
      original,
      el('span', { className: 'ts-preview__arrow', textContent: '>' }),
      result,
      copyBtn
    ]);
    panel.appendChild(previewRow);

    return panel;
  }

  function renderList(data) {
    const list = (data || TypeSaver.getAll()).sort((a, b) => (b.bookmark ? 1 : 0) - (a.bookmark ? 1 : 0));
    tsList.innerHTML = '';

    if (list.length === 0) {
      tsEmpty.classList.add('visible');
      return;
    }

    tsEmpty.classList.remove('visible');

    list.forEach(item => {
      const info = el('div', { className: 'ts-item__info', dataset: { idx: item.idx } }, [
        el('div', { className: 'ts-item__title', textContent: item.title }),
        buildTagSpans(item.tag, 'ts-item__tags')
      ]);

      const row = el('div', { className: 'ts-item__row' }, [
        el('span', { className: 'ts-item__handle', textContent: '☰' }),
        el('button', { className: 'ts-item__bookmark' + (item.bookmark ? ' active' : ''), dataset: { idx: item.idx }, textContent: item.bookmark ? '★' : '☆' }),
        info,
        el('button', { className: 'ts-item__edit', dataset: { idx: item.idx }, title: '수정', innerHTML: SVG_EDIT }),
        el('button', { className: 'ts-item__copy', dataset: { idx: item.idx }, title: '복사', innerHTML: SVG_COPY })
      ]);

      const li = el('li', { className: 'ts-item', draggable: 'true', dataset: { idx: item.idx } }, [
        row,
        buildParamsPanel(item)
      ]);

      tsList.appendChild(li);
    });
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

  tsList.addEventListener('dragend', async () => {
    if (dragItem) {
      dragItem.classList.remove('dragging');
      dragItem = null;
    }
    isDragging = false;
    tsList.querySelectorAll('.ts-item').forEach(el => el.classList.remove('drag-over'));

    const orderedIdxList = [...tsList.querySelectorAll('.ts-item')].map(el => Number(el.dataset.idx));
    await TypeSaver.reorder(orderedIdxList);
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

  // 파라미터 입력 → 미리보기 실시간 업데이트
  tsList.addEventListener('input', (e) => {
    const input = e.target.closest('.ts-params__input');
    if (!input) return;
    const panel = input.closest('.ts-item__params');
    updatePreview(panel, panel.dataset.content);
  });

  // 클릭 이벤트
  tsList.addEventListener('click', (e) => {
    if (isDragging) return;

    // 파라미터 패널 내 복사
    const paramsCopy = e.target.closest('.ts-params__copy');
    if (paramsCopy) {
      e.stopPropagation();
      const idx = Number(paramsCopy.dataset.idx);
      const item = TypeSaver.getById(idx);
      if (!item) return;

      const panel = paramsCopy.closest('.ts-item__params');
      const inputs = panel.querySelectorAll('.ts-params__input');
      let result = item.content;
      inputs.forEach(inp => {
        const regex = new RegExp('\\$\\{' + inp.dataset.param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}', 'g');
        result = result.replace(regex, inp.value);
      });

      copyToClipboard(result, paramsCopy);
      return;
    }

    // 파라미터 패널 내부 클릭은 전파 중단
    if (e.target.closest('.ts-item__params')) return;

    // 복사 (기존 — 파라미터 제거 후 복사)
    const copyBtn = e.target.closest('.ts-item__copy');
    if (copyBtn) {
      e.stopPropagation();
      const idx = Number(copyBtn.dataset.idx);
      const item = TypeSaver.getById(idx);
      if (item) {
        const filtered = item.content.replace(/\$\{[^}]+\}/g, '');
        copyToClipboard(filtered, copyBtn);
      }
      return;
    }

    // 수정 → detail.html
    const editBtn = e.target.closest('.ts-item__edit');
    if (editBtn) {
      e.stopPropagation();
      const idx = Number(editBtn.dataset.idx);
      window.location.href = `detail.html?idx=${idx}`;
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

    // 행 클릭 → 파라미터 패널 토글
    const info = e.target.closest('.ts-item__info');
    if (info) {
      const li = info.closest('.ts-item');
      const panel = li.querySelector('.ts-item__params');
      const isOpen = panel.classList.contains('open');

      // 다른 열린 패널 닫기
      tsList.querySelectorAll('.ts-item__params.open').forEach(p => p.classList.remove('open'));

      if (!isOpen) {
        panel.classList.add('open');
      }
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
  TypeSaver.load().then(() => {
    renderTagFilter();
    renderList();
  });

  // 언어 변경 시 i18n 재적용
  window.addEventListener('langchange', () => {
    I18n.applyI18n();
  });

  I18n.applyI18n();
});

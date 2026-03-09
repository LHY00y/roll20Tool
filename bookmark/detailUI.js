document.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const btnDelete = document.getElementById('btnDelete');
  const btnSave = document.getElementById('btnSave');
  const headerTitle = document.getElementById('headerTitle');

  const inputTitle = document.getElementById('inputTitle');
  const inputMemo = document.getElementById('inputMemo');

  const urlList = document.getElementById('urlList');
  const btnAddUrl = document.getElementById('btnAddUrl');

  const tagInputWrap = document.getElementById('tagInputWrap');
  const tagChips = document.getElementById('tagChips');
  const tagInput = document.getElementById('tagInput');

  // 수정 모드 여부
  const params = new URLSearchParams(location.search);
  const editIdx = params.get('idx') ? Number(params.get('idx')) : null;
  let tags = [];
  let urls = [''];

  // ── URL 목록 렌더링 ──
  function renderUrls() {
    urlList.innerHTML = '';
    urls.forEach((url, i) => {
      const row = document.createElement('div');
      row.className = 'bm-url-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'bm-url-row__input';
      input.value = url;
      input.placeholder = 'https://...';
      input.addEventListener('input', () => { urls[i] = input.value; });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'bm-url-row__remove';
      removeBtn.innerHTML = '×';
      removeBtn.title = 'URL 삭제';
      removeBtn.style.visibility = urls.length === 1 ? 'hidden' : '';
      removeBtn.addEventListener('click', () => {
        urls.splice(i, 1);
        if (urls.length === 0) urls.push('');
        renderUrls();
      });

      row.appendChild(input);
      row.appendChild(removeBtn);
      urlList.appendChild(row);
    });

    btnAddUrl.disabled = urls.length >= BookmarkData.MAX_URLS;
  }

  btnAddUrl.addEventListener('click', () => {
    if (urls.length < BookmarkData.MAX_URLS) {
      urls.push('');
      renderUrls();
      // 새로 추가된 입력칸에 포커스
      const inputs = urlList.querySelectorAll('.bm-url-row__input');
      inputs[inputs.length - 1].focus();
    }
  });

  // ── 초기화 ──
  BookmarkData.load().then(() => {
    if (editIdx) {
      const item = BookmarkData.getById(editIdx);
      if (item) {
        headerTitle.textContent = I18n.t('bm_edit');
        inputTitle.value = item.title || '';
        urls = item.urls && item.urls.length ? [...item.urls] : [''];
        inputMemo.value = item.memo || '';
        tags = item.tag ? item.tag.split(',').map(t => t.trim()).filter(t => t) : [];
        btnDelete.style.display = 'flex';
      }
    }
    renderUrls();
    renderTags();
  });

  // ── 태그 칩 ──
  function renderTags() {
    tagChips.innerHTML = '';
    tags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${escapeHtml(tag)}<button class="tag-chip__remove" data-index="${i}">×</button>`;
      tagChips.appendChild(chip);
    });
  }

  function addTag(text) {
    const t = text.trim();
    if (t && !tags.includes(t)) {
      tags.push(t);
      renderTags();
    }
    tagInput.value = '';
  }

  // ── 태그 자동완성 ──
  const ac = setupTagAutocomplete({
    tagInput,
    tagInputWrap,
    getExistingTags: () => BookmarkData.getAllTags(),
    getTags: () => tags,
    onSelect: (tag) => { addTag(tag); }
  });

  tagInput.addEventListener('keydown', (e) => {
    if (e.isComposing) return; // 한글 IME 조합 중 무시
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (!ac.isHandling()) addTag(tagInput.value);
    }
    if (e.key === 'Backspace' && tagInput.value === '' && tags.length > 0) {
      tags.pop();
      renderTags();
    }
  });

  tagInput.addEventListener('blur', () => {
    if (tagInput.value.trim()) addTag(tagInput.value);
  });

  tagChips.addEventListener('click', (e) => {
    const btn = e.target.closest('.tag-chip__remove');
    if (btn) {
      tags.splice(Number(btn.dataset.index), 1);
      renderTags();
    }
  });

  tagInputWrap.addEventListener('click', () => tagInput.focus());

  // ── 저장 ──
  btnSave.addEventListener('click', () => {
    const title = inputTitle.value.trim();
    if (!title) {
      inputTitle.focus();
      return;
    }

    const urlArray = urls.map(u => u.trim()).filter(u => u);
    const memo = inputMemo.value.trim();
    const tag = tags.join(', ');

    if (editIdx) {
      BookmarkData.update(editIdx, { title, urls: urlArray, memo, tag });
    } else {
      BookmarkData.add(title, urlArray, tag, memo);
    }

    window.location.href = 'index.html';
  });

  // ── 삭제 ──
  btnDelete.addEventListener('click', () => {
    if (!editIdx) return;
    BookmarkData.remove(editIdx);
    window.location.href = 'index.html';
  });

  // ── 뒤로 ──
  btnBack.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // 언어 변경 시 동적 텍스트 갱신
  window.addEventListener('langchange', () => {
    I18n.applyI18n();
    headerTitle.textContent = editIdx ? I18n.t('bm_edit') : I18n.t('bm_add');
  });

  I18n.applyI18n();
});

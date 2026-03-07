document.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const btnDelete = document.getElementById('btnDelete');
  const btnSave = document.getElementById('btnSave');
  const headerTitle = document.getElementById('headerTitle');

  const inputTitle = document.getElementById('inputTitle');
  const inputUrl = document.getElementById('inputUrl');
  const inputMemo = document.getElementById('inputMemo');

  const tagInputWrap = document.getElementById('tagInputWrap');
  const tagChips = document.getElementById('tagChips');
  const tagInput = document.getElementById('tagInput');

  // 수정 모드 여부
  const params = new URLSearchParams(location.search);
  const editIdx = params.get('idx') ? Number(params.get('idx')) : null;
  let tags = [];

  // ── 초기화 ──
  BookmarkData.load().then(() => {
    if (editIdx) {
      const item = BookmarkData.getById(editIdx);
      if (item) {
        headerTitle.textContent = '북마크 수정';
        inputTitle.value = item.title || '';
        inputUrl.value = item.url || '';
        inputMemo.value = item.memo || '';
        tags = item.tag ? item.tag.split(',').map(t => t.trim()).filter(t => t) : [];
        btnDelete.style.display = 'flex';
      }
    }
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

    const url = inputUrl.value.trim();
    const memo = inputMemo.value.trim();
    const tag = tags.join(', ');

    if (editIdx) {
      BookmarkData.update(editIdx, { title, url, memo, tag });
    } else {
      const item = BookmarkData.add(title, url, tag, memo);
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

  // ── 유틸 ──
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});

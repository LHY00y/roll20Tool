document.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const btnDelete = document.getElementById('btnDelete');
  const btnSave = document.getElementById('btnSave');
  const headerTitle = document.getElementById('headerTitle');

  const inputTitle = document.getElementById('inputTitle');
  const inputContent = document.getElementById('inputContent');
  const inputMemo = document.getElementById('inputMemo');
  const inputLookAuth = document.getElementById('inputLookAuth');
  const inputTokenOpt = document.getElementById('inputTokenOpt');

  const tagInputWrap = document.getElementById('tagInputWrap');
  const tagChips = document.getElementById('tagChips');
  const tagInput = document.getElementById('tagInput');

  // 수정 모드 여부
  const params = new URLSearchParams(location.search);
  const editIdx = params.get('idx') ? Number(params.get('idx')) : null;
  let tags = [];

  // ── 초기화 ──
  MacroStorage.load().then(() => {
    if (editIdx) {
      const item = MacroStorage.getById(editIdx);
      if (item) {
        headerTitle.textContent = '매크로 수정';
        inputTitle.value = item.title || '';
        inputContent.value = item.content || '';
        inputMemo.value = item.memo || '';
        inputLookAuth.checked = !!item.lookAuth;
        inputTokenOpt.checked = !!item.tokenOpt;
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
    getExistingTags: () => MacroStorage.getAllTags(),
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

    const content = inputContent.value;
    const memo = inputMemo.value.trim();
    const tag = tags.join(', ');
    const lookAuth = inputLookAuth.checked;
    const tokenOpt = inputTokenOpt.checked;

    if (editIdx) {
      MacroStorage.update(editIdx, { title, content, memo, tag, lookAuth, tokenOpt });
    } else {
      const item = MacroStorage.add(title, content, tag, lookAuth, tokenOpt);
      if (memo) MacroStorage.update(item.idx, { memo });
    }

    window.location.href = 'index.html';
  });

  // ── 삭제 ──
  btnDelete.addEventListener('click', () => {
    if (!editIdx) return;
    MacroStorage.remove(editIdx);
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

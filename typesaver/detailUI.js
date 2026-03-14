document.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  const btnSave = document.getElementById('btnSave');
  const btnDelete = document.getElementById('btnDelete');
  const pageTitle = document.getElementById('pageTitle');
  const inputTitle = document.getElementById('inputTitle');
  const inputContent = document.getElementById('inputContent');
  const paramsSection = document.getElementById('paramsSection');
  const paramsList = document.getElementById('paramsList');
  const previewBox = document.getElementById('previewBox');
  const inputTag = document.getElementById('inputTag');
  const tagChips = document.getElementById('tagChips');
  const tagInputWrap = document.getElementById('tagInputWrap');

  // URL에서 idx 파라미터 가져오기 (수정 모드)
  const urlParams = new URLSearchParams(window.location.search);
  const editIdx = urlParams.get('idx') ? Number(urlParams.get('idx')) : null;
  const isEdit = editIdx !== null;

  let currentParams = [];
  let tags = [];


  // 태그 렌더링
  function renderTags() {
    tagChips.innerHTML = '';
    tags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${escapeHtml(tag)}<button class="tag-chip__remove" data-index="${i}">&times;</button>`;
      tagChips.appendChild(chip);
    });
  }

  function addTag(text) {
    const t = text.trim();
    if (t && !tags.includes(t)) {
      tags.push(t);
      renderTags();
    }
  }

  // ── 태그 자동완성 ──
  const ac = setupTagAutocomplete({
    tagInput: inputTag,
    tagInputWrap,
    getExistingTags: () => TypeSaver.getAllTags(),
    getTags: () => tags,
    onSelect: (tag) => { addTag(tag); }
  });

  // 쉼표 또는 Enter로 태그 추가
  inputTag.addEventListener('keydown', (e) => {
    if (e.isComposing) return; // 한글 IME 조합 중 무시
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (!ac.isHandling()) {
        addTag(inputTag.value.replace(/,/g, ''));
        inputTag.value = '';
      }
    }
    if (e.key === 'Backspace' && !inputTag.value && tags.length > 0) {
      tags.pop();
      renderTags();
    }
  });

  inputTag.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val.includes(',')) {
      val.split(',').forEach(t => addTag(t));
      inputTag.value = '';
    }
  });

  // 태그 삭제
  tagChips.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.tag-chip__remove');
    if (removeBtn) {
      tags.splice(Number(removeBtn.dataset.index), 1);
      renderTags();
    }
  });

  // wrap 클릭 시 input 포커스
  tagInputWrap.addEventListener('click', () => inputTag.focus());

  // ${} 파라미터 파싱
  function parseParams(text) {
    const regex = /\$\{([^}]+)\}/g;
    const params = [];
    const seen = new Set();
    let match;
    while ((match = regex.exec(text)) !== null) {
      const name = match[1].trim();
      if (!seen.has(name)) {
        seen.add(name);
        params.push(name);
      }
    }
    return params;
  }

  // 파라미터 입력 필드 렌더링
  function renderParams(params) {
    const oldValues = {};
    paramsList.querySelectorAll('.param-row__input').forEach(input => {
      oldValues[input.dataset.param] = input.value;
    });

    paramsList.innerHTML = '';

    if (params.length === 0) {
      paramsSection.classList.add('hidden');
      return;
    }

    paramsSection.classList.remove('hidden');

    params.forEach(name => {
      const row = document.createElement('div');
      row.className = 'param-row';
      row.innerHTML = `
        <span class="param-row__label">${escapeHtml(name)}</span>
        <input type="text" class="param-row__input" data-param="${escapeHtml(name)}" placeholder="${escapeHtml(name)} 값 입력">
      `;

      const input = row.querySelector('.param-row__input');
      if (oldValues[name]) {
        input.value = oldValues[name];
      }
      input.addEventListener('input', updatePreview);

      paramsList.appendChild(row);
    });
  }

  // 파라미터 치환된 텍스트 반환
  function getResolvedText() {
    let text = inputContent.value;
    if (!text) return '';
    paramsList.querySelectorAll('.param-row__input').forEach(input => {
      const paramName = input.dataset.param;
      const value = input.value || '';
      text = text.replaceAll('${' + paramName + '}', value);
    });
    return text;
  }

  // [text](#"style="css) → <a style="css">text</a> 전처리 후 marked 변환
  function renderMarkdown(text) {
    const processed = text.replace(
      /\[([^\]]+)\]\(#"style="([^)]+)\)/g,
      '<a style="$2">$1</a>'
    );
    return marked.parse(processed);
  }

  // 플레인 미리보기 토글
  const btnPlainPreview = document.getElementById('btnPlainPreview');
  btnPlainPreview.addEventListener('click', () => {
    btnPlainPreview.classList.toggle('active');
    updatePreview();
  });

  // 미리보기 업데이트
  function updatePreview() {
    const text = getResolvedText();

    if (!text) {
      previewBox.innerHTML = `<p style="color:#999">${I18n.t('ts_preview_empty')}</p>`;
      return;
    }

    if (btnPlainPreview.classList.contains('active')) {
      const plain = text.replace(/\[([^\]]+)\]\(#"style="[^)]+\)/g, '$1');
      previewBox.textContent = plain;
      return;
    }

    try {
      previewBox.innerHTML = renderMarkdown(text);
    } catch {
      previewBox.textContent = text;
    }
  }

  // 내용 변경 시 파라미터 감지 + 미리보기 갱신
  inputContent.addEventListener('input', () => {
    const params = parseParams(inputContent.value);
    currentParams = params;
    renderParams(params);
    updatePreview();
  });

  // 초기화 (수정 모드)
  TypeSaver.load().then(() => {
    if (isEdit) {
      const item = TypeSaver.getById(editIdx);
      if (item) {
        pageTitle.textContent = I18n.t('ts_edit');
        btnDelete.classList.remove('hidden');
        inputTitle.value = item.title;
        inputContent.value = item.content;
        if (item.tag) {
          tags = item.tag.split(',').map(t => t.trim()).filter(t => t);
          renderTags();
        }
        const params = parseParams(inputContent.value);
        currentParams = params;
        renderParams(params);
        updatePreview();
      }
    }
  });

  // 저장
  btnSave.addEventListener('click', async () => {
    const title = inputTitle.value.trim();
    const content = inputContent.value.trim();

    if (!title) {
      inputTitle.focus();
      return;
    }

    const tag = tags.join(',');

    // storage write 완료 후 이동 (완료 전 이동 시 reorder 정보 유실 방지)
    if (isEdit) {
      await TypeSaver.update(editIdx, { title, content, tag });
    } else {
      await TypeSaver.add(title, content, tag);
    }

    window.location.href = 'index.html';
  });

  // 삭제
  btnDelete.addEventListener('click', async () => {
    if (confirm('이 상용구를 삭제하시겠습니까?')) {
      await TypeSaver.remove(editIdx);
      window.location.href = 'index.html';
    }
  });

  // 미리보기 복사 (HTML + 플레인텍스트)
  const btnCopyPreview = document.getElementById('btnCopyPreview');

  btnCopyPreview.addEventListener('click', () => {
    const text = getResolvedText();
    if (!text) return;
    const doSuccess = () => {
      btnCopyPreview.innerHTML = SVG_CHECK;
      btnCopyPreview.classList.add('copied');
      setTimeout(() => {
        btnCopyPreview.innerHTML = SVG_COPY;
        btnCopyPreview.classList.remove('copied');
      }, 1500);
    };
    try {
      const html = renderMarkdown(text);
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
  });

  // 뒤로가기
  btnBack.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // 언어 변경 시 동적 텍스트 갱신
  window.addEventListener('langchange', () => {
    I18n.applyI18n();
    if (isEdit) {
      pageTitle.textContent = I18n.t('ts_edit');
    } else {
      pageTitle.textContent = I18n.t('ts_add');
    }
    updatePreview();
  });

  // 초기 i18n 적용
  I18n.applyI18n();
});

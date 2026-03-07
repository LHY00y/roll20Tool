document.addEventListener('DOMContentLoaded', () => {
  const memoContent = document.getElementById('memoContent');
  const toggleStorage = document.getElementById('toggleStorage');
  const btnCopyAll = document.getElementById('btnCopyAll');

  const KEY_CONTENT = 'memo_content';
  const KEY_STORAGE_ON = 'memo_storage_enabled';

  let storageEnabled = false;

  // ── 초기 로드 ──
  whale.storage.sync.get([KEY_CONTENT, KEY_STORAGE_ON], (result) => {
    storageEnabled = !!result[KEY_STORAGE_ON];
    toggleStorage.checked = storageEnabled;
    if (storageEnabled && result[KEY_CONTENT]) {
      memoContent.value = result[KEY_CONTENT];
    }
  });

  // ── 저장 토글 ──
  toggleStorage.addEventListener('change', () => {
    storageEnabled = toggleStorage.checked;
    whale.storage.sync.set({ [KEY_STORAGE_ON]: storageEnabled });
    if (storageEnabled) {
      whale.storage.sync.set({ [KEY_CONTENT]: memoContent.value });
    } else {
      whale.storage.sync.remove(KEY_CONTENT);
    }
  });

  // ── 내용 변경 시 저장 ──
  memoContent.addEventListener('input', () => {
    if (storageEnabled) {
      whale.storage.sync.set({ [KEY_CONTENT]: memoContent.value });
    }
  });

  // ── 전체 복사 ──
  btnCopyAll.addEventListener('click', () => {
    if (memoContent.value) copyWithFeedback(btnCopyAll, memoContent.value);
  });

  // ── 우클릭 복사 수신 (background → storage.local → 여기서 감지) ──
  whale.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.memo_append?.newValue) return;
    const text = changes.memo_append.newValue.text;
    if (text) {
      appendText(text);
      whale.storage.local.remove('memo_append');
    }
  });

  function appendText(text) {
    memoContent.value = memoContent.value
      ? memoContent.value + '\n\n' + text
      : text;
    if (storageEnabled) {
      whale.storage.sync.set({ [KEY_CONTENT]: memoContent.value });
    }
    memoContent.scrollTop = memoContent.scrollHeight;
  }
});

// ── 스토리지 데이터 팩토리 ──
function createStorageData(STORAGE_KEY, { searchFields = [], stripOnSave = [] } = {}) {
  let items = [];

  function load() {
    return new Promise((resolve) => {
      whale.storage.sync.get(STORAGE_KEY, (result) => {
        try { items = result[STORAGE_KEY] || []; } catch { items = []; }
        resolve();
      });
    });
  }

  function save() {
    // 항상 얕은 복사본으로 저장 (라이브 레퍼런스 전달 방지)
    const toSave = items.map(item => {
      const c = { ...item };
      stripOnSave.forEach(k => delete c[k]);
      return c;
    });
    return new Promise(resolve => {
      whale.storage.sync.set({ [STORAGE_KEY]: toSave }, resolve);
    });
  }

  function nextIdx() {
    return items.length === 0 ? 1 : Math.max(...items.map(i => i.idx)) + 1;
  }

  function _addRaw(fields) {
    const item = { idx: nextIdx(), ...fields };
    items.push(item);
    save();
    return item;
  }

  function getAll() {
    return [...items].sort((a, b) => a.idx - b.idx);
  }

  function getById(idx) {
    return items.find(i => i.idx === idx);
  }

  function update(idx, data) {
    const item = items.find(i => i.idx === idx);
    if (!item) return null;
    Object.assign(item, data);
    save();
    return item;
  }

  function remove(idx) {
    items = items.filter(i => i.idx !== idx);
    save();
  }

  function toggleBookmark(idx) {
    const item = items.find(i => i.idx === idx);
    if (!item) return null;
    item.bookmark = !item.bookmark;
    save();
    return item;
  }

  function reorder(orderedIdxList) {
    // Map으로 캡처 (idx 변경 전 스냅샷)
    const idxMap = new Map(items.map(item => [item.idx, item]));
    const inListSet = new Set(orderedIdxList);

    const reordered = [];

    // 1. 사용자가 드래그한 순서대로 보이는 항목 추가
    orderedIdxList.forEach(oldIdx => {
      const item = idxMap.get(oldIdx);
      if (item) reordered.push(item);
    });

    // 2. 필터로 숨겨진 항목은 뒤에 추가 (삭제 방지)
    items.forEach(item => {
      if (!inListSet.has(item.idx)) reordered.push(item);
    });

    // 3. idx 재할당 (보이는 항목 먼저, 숨겨진 항목 뒤)
    reordered.forEach((item, i) => { item.idx = i + 1; });

    items = reordered;
    return save(); // Promise 반환 → 저장 완료 후 onSettle 실행
  }

  function search(keyword) {
    const q = keyword.toLowerCase();
    return getAll().filter(i => searchFields.some(f => (i[f] || '').toLowerCase().includes(q)));
  }

  function getAllTags() {
    const tagSet = new Set();
    items.forEach(i => {
      if (i.tag) i.tag.split(',').map(t => t.trim()).filter(t => t).forEach(t => tagSet.add(t));
    });
    return [...tagSet].sort();
  }

  function filterByTags(tagList) {
    return getAll().filter(item => {
      if (!item.tag) return false;
      const itemTags = item.tag.split(',').map(t => t.trim());
      return tagList.some(t => itemTags.includes(t));
    });
  }

  return { load, getAll, getById, update, remove, toggleBookmark, reorder, search, getAllTags, filterByTags, _addRaw };
}

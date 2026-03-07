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
    const toSave = stripOnSave.length
      ? items.map(item => { const c = { ...item }; stripOnSave.forEach(k => delete c[k]); return c; })
      : items;
    whale.storage.sync.set({ [STORAGE_KEY]: toSave });
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
    const reordered = [];
    orderedIdxList.forEach((oldIdx, i) => {
      const item = items.find(it => it.idx === oldIdx);
      if (item) { item.idx = i + 1; reordered.push(item); }
    });
    items = reordered;
    save();
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

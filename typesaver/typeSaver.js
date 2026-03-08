const TypeSaver = (() => {
  const STORAGE_KEY = 'typesaver_items';

  let items = [];

  function load() {
    return new Promise((resolve) => {
      whale.storage.sync.get(STORAGE_KEY, (result) => {
        try {
          items = result[STORAGE_KEY] || [];
        } catch {
          items = [];
        }
        resolve();
      });
    });
  }

  function save() {
    const toSave = items.map(item => ({ ...item }));
    return new Promise(resolve => {
      whale.storage.sync.set({ [STORAGE_KEY]: toSave }, resolve);
    });
  }

  function nextIdx() {
    if (items.length === 0) return 1;
    return Math.max(...items.map(i => i.idx)) + 1;
  }

  function getAll() {
    return [...items].sort((a, b) => a.idx - b.idx);
  }

  function getById(idx) {
    return items.find(i => i.idx === idx);
  }

  function add(title, content = '', tag = '') {
    const item = {
      idx: nextIdx(),
      title,
      content,
      tag: tag || '',
      bookmark: false
    };
    items.push(item);
    return save();
  }

  function update(idx, data) {
    const item = items.find(i => i.idx === idx);
    if (!item) return Promise.resolve(null);
    Object.assign(item, data);
    return save();
  }

  function remove(idx) {
    items = items.filter(i => i.idx !== idx);
    return save();
  }

  function toggleBookmark(idx) {
    const item = items.find(i => i.idx === idx);
    if (!item) return Promise.resolve(null);
    item.bookmark = !item.bookmark;
    return save();
  }

  function reorder(orderedIdxList) {
    // Map으로 캡처 (복사본 사용 — 참조 공유로 인한 중복·데이터 손실 방지)
    const idxMap = new Map(items.map(item => [item.idx, { ...item }]));
    const seen = new Set();

    const reordered = [];
    // 1. 드래그 순서대로 보이는 항목 추가
    orderedIdxList.forEach(oldIdx => {
      if (seen.has(oldIdx)) return;          // stale DOM 중복 idx 방어
      seen.add(oldIdx);
      const item = idxMap.get(oldIdx);
      if (item) reordered.push(item);
    });
    // 2. 필터로 숨겨진 항목 보존 (삭제 방지)
    items.forEach(item => {
      if (!seen.has(item.idx)) reordered.push({ ...item });
    });
    // 3. idx 재할당 (변이는 탐색 완료 후에만 수행)
    reordered.forEach((item, i) => { item.idx = i + 1; });

    items = reordered;
    return save();
  }

  function search(keyword) {
    const q = keyword.toLowerCase();
    return getAll().filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.content.toLowerCase().includes(q) ||
      i.tag.toLowerCase().includes(q)
    );
  }

  function getAllTags() {
    const tagSet = new Set();
    items.forEach(i => {
      if (i.tag) {
        i.tag.split(',').map(t => t.trim()).filter(t => t).forEach(t => tagSet.add(t));
      }
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

  return { getAll, getById, add, update, remove, toggleBookmark, reorder, search, getAllTags, filterByTags, load };
})();

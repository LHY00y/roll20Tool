const MacroStorage = (() => {
  const STORAGE_KEY = 'macrostorage_items';

  let items = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      items = raw ? JSON.parse(raw) : [];
    } catch {
      items = [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

  /**
   * @param {string} title
   * @param {string} content
   * @param {string} tag - 쉼표 구분 태그
   * @param {string} lookAuth - 'all' | 'gm' | 'player'
   * @param {boolean} tokenOpt - 토큰 옵션
   */
  function add(title, content = '', tag = '', lookAuth = 'all', tokenOpt = false) {
    const item = {
      idx: nextIdx(),
      title,
      content,
      tag: tag || '',
      bookmark: false,
      checked: false,
      lookAuth: lookAuth || 'all',
      tokenOpt: !!tokenOpt
    };
    items.push(item);
    save();
    return item;
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
      if (item) {
        item.idx = i + 1;
        reordered.push(item);
      }
    });
    items = reordered;
    save();
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

  load();

  return { getAll, getById, add, update, remove, toggleBookmark, reorder, search, getAllTags, filterByTags, load };
})();

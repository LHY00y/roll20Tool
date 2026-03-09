const BookmarkData = (() => {
  const base = createStorageData('bookmark_items', {
    searchFields: ['title', 'tag', 'memo']
  });

  const MAX_URLS = 7;

  // 구버전 url 문자열 → urls 배열로 마이그레이션 (in-place)
  function migrateItem(item) {
    if (!Array.isArray(item.urls)) {
      item.urls = item.url ? [item.url] : [];
      delete item.url;
    }
    return item;
  }

  function add(title, urls = [], tag = '', memo = '') {
    const urlArray = (Array.isArray(urls) ? urls : [urls]).filter(u => u).slice(0, MAX_URLS);
    return base._addRaw({ title, urls: urlArray, tag: tag || '', bookmark: false, memo: memo || '' });
  }

  const _baseGetAll = base.getAll;
  function getAll() {
    return _baseGetAll().map(migrateItem);
  }

  const _baseGetById = base.getById;
  function getById(idx) {
    const item = _baseGetById(idx);
    return item ? migrateItem(item) : item;
  }

  function search(keyword) {
    const q = keyword.toLowerCase();
    return getAll().filter(item =>
      ['title', 'tag', 'memo'].some(f => (item[f] || '').toLowerCase().includes(q)) ||
      (item.urls || []).some(u => u.toLowerCase().includes(q))
    );
  }

  function filterByTags(tagList) {
    return getAll().filter(item => {
      if (!item.tag) return false;
      const itemTags = item.tag.split(',').map(t => t.trim());
      return tagList.some(t => itemTags.includes(t));
    });
  }

  return { ...base, add, getAll, getById, search, filterByTags, MAX_URLS };
})();

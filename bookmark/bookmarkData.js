const BookmarkData = (() => {
  const base = createStorageData('bookmark_items', {
    searchFields: ['title', 'url', 'tag', 'memo']
  });

  function add(title, url = '', tag = '', memo = '') {
    return base._addRaw({ title, url, tag: tag || '', bookmark: false, memo: memo || '' });
  }

  return { ...base, add };
})();

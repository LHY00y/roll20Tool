const TypeSaver = (() => {
  const base = createStorageData('typesaver_items', {
    searchFields: ['title', 'content', 'tag']
  });

  function add(title, content = '', tag = '') {
    base._addRaw({ title, content, tag: tag || '', bookmark: false });
    return base.save();
  }

  return { ...base, add };
})();

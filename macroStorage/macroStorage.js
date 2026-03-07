const MacroStorage = (() => {
  const base = createStorageData('macrostorage_items', {
    searchFields: ['title', 'content', 'tag', 'memo'],
    stripOnSave: ['checked']
  });

  function add(title, content = '', tag = '', lookAuth = false, tokenOpt = false) {
    return base._addRaw({
      title, content, tag: tag || '', bookmark: false,
      checked: false, memo: '', lookAuth: !!lookAuth, tokenOpt: !!tokenOpt
    });
  }

  return { ...base, add };
})();

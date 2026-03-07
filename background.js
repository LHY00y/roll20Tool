// 확장앱 설치 시 실행
whale.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  whale.contextMenus.create({
    id: 'addToMemo',
    title: '메모에 추가',
    contexts: ['selection']
  });
});

// 우클릭 → 메모에 추가
whale.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'addToMemo' && info.selectionText) {
    whale.storage.local.set({
      memo_append: { text: info.selectionText.trim(), ts: Date.now() }
    });
  }
});

// 사이드바/iframe에서 외부 URL fetch 요청 처리 (CORS 우회)
whale.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchUrl') {
    fetch(request.url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then(text => sendResponse({ success: true, data: text }))
      .catch(err => sendResponse({ success: false, error: err.message }));

    // 비동기 응답을 위해 true 반환
    return true;
  }

  // Roll20 현재 탭에 매크로 추가
  if (request.action === 'addMacrosToRoll20') {
    (async () => {
      try {
        const allActiveTabs = await whale.tabs.query({ active: true });
        const tab = allActiveTabs.find(t =>
          t.url &&
          !t.url.startsWith('chrome-extension://') &&
          !t.url.startsWith('whale-extension://') &&
          !t.url.startsWith('about:')
        );
        if (!tab) {
          sendResponse({ success: false, error: 'Roll20 탭을 활성화해주세요.' });
          return;
        }

        const macros = request.macros;

        // Step 1: ISOLATED world에서 sessionStorage에 데이터 저장 (CSP 제약 없음)
        await whale.scripting.executeScript({
          target: { tabId: tab.id },
          func: (macrosData) => {
            sessionStorage.setItem('__r20Macros', JSON.stringify(macrosData));
          },
          args: [macros]
        });

        // Step 2: MAIN world에서 파일로 실행 (CSP 우회 - 파일은 inline script 아님)
        const results = await whale.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          files: ['roll20Helper.js']
        });

        const result = results && results[0] && results[0].result;
        sendResponse(result || { success: false, error: '알 수 없는 오류' });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
});

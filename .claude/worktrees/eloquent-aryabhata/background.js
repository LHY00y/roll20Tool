// 확장앱 설치 시 실행
whale.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
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
});

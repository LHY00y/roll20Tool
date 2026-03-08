// 드래그앤드롭 파일 드롭 방지 (CSP 대응용 외부 파일)
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.effectAllowed = 'none';
  e.dataTransfer.dropEffect = 'none';
}, false);

window.addEventListener('drop', (e) => {
  e.preventDefault();
  e.dataTransfer.effectAllowed = 'none';
  e.dataTransfer.dropEffect = 'none';
}, false);

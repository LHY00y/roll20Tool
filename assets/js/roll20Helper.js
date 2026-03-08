(function () {
  var raw = sessionStorage.getItem('__r20Macros');
  if (!raw) return { success: false, error: '매크로 데이터 없음' };

  var macros;
  try {
    macros = JSON.parse(raw);
    sessionStorage.removeItem('__r20Macros');
  } catch (e) {
    return { success: false, error: '파싱 오류: ' + e.message };
  }

  try {
    // currentPlayer를 직접 사용 (d20 대신)
    var player;
    if (typeof currentPlayer !== 'undefined' && currentPlayer) {
      player = currentPlayer;
    } else if (typeof d20 !== 'undefined') {
      player = d20.Campaign.players.get(d20.Campaign.get('playerid'));
    } else {
      return { success: false, error: 'Roll20 플레이어 API를 찾을 수 없습니다' };
    }

    if (!player || !player.macros) {
      return { success: false, error: 'player.macros를 찾을 수 없습니다' };
    }

    var count = 0;
    macros.forEach(function (m) {
      player.macros.create({
        name: m.title,
        action: m.content,
        visibleto: m.lookAuth ? 'all' : '',
        istokenaction: !!m.tokenOpt
      });
      count++;
    });
    return { success: true, count: count };
  } catch (e) {
    return { success: false, error: e.message };
  }
})();

window.HUB_PROGRESS = {
  game: 'luchador',
  keys: ['luch_*', 'tutorial_seen_v2', 'tutorial_run_done_v1', 'tutorial_attempts_v1'],
  score: function (keys) {
    var economy = JSON.parse(keys.luch_econ_v1 || '{}');
    return (economy.unlocked || []).length * 1e6 + (economy.bossKillsTotal || 0) * 1e3
      + (economy.bp && economy.bp.xp || 0);
  }
};

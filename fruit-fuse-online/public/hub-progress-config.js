window.HUB_PROGRESS = {
  game: 'corebelow',
  keys: ['coreBelowStats:v1', 'core-below:tutorial-complete:v2', 'hub-events:corebelow:v1'],
  score: function (keys) {
    var stats = JSON.parse(keys['coreBelowStats:v1'] || '{}');
    return (keys['core-below:tutorial-complete:v2'] === 'yes' ? 1e12 : 0)
      + (Number(stats.shiftsCompleted) || 0) * 1e6 + (Number(stats.activeSeconds) || 0);
  }
};

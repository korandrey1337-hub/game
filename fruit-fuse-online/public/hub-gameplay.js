(function () {
  'use strict';
  var events = window.HubGameEvents.create('corebelow');
  window.CoreBelowHub = {
    track: function (state, ownId, abandoned) {
      if (!state || state.tutorial || !state.shiftId) return;
      var self = state.players.find(function (player) { return player.id === ownId; });
      if (!self || !['lookout', 'operator', 'scribe'].includes(self.role)) return;
      var abandonedShifts = events.get('abandonedShifts', []);
      if (!Array.isArray(abandonedShifts)) abandonedShifts = [];
      if (abandoned && !abandonedShifts.includes(state.shiftId)) {
        abandonedShifts.push(state.shiftId);
        events.set('abandonedShifts', abandonedShifts.slice(-128));
      }
      abandoned = abandonedShifts.includes(state.shiftId);
      if (self.timedRepair) events.achievement('just_in_time');
      var finished = ['won', 'lost'].includes(state.phase);
      // run_end closes party voice: never end it while the other players are still playing.
      if (!finished) return;
      var won = !abandoned && state.phase === 'won';
      var depth = state.puzzleView && state.puzzleView.progress ? state.puzzleView.progress.resolvedCount : 0;
      if (!events.runEnd(state.shiftId, { won: won, score: depth * 100, depth: depth, mode: 'online', abandoned: !!abandoned })) return;
      if (!abandoned) {
        events.achievement(won ? 'reactor_stable' : 'boom');
        if (won && state.mistakes === 0) events.achievement('flawless_shift');
        var roles = events.get('roles', []);
        if (!Array.isArray(roles)) roles = [];
        if (!roles.includes(self.role)) roles.push(self.role);
        events.set('roles', roles);
        if (['lookout', 'operator', 'scribe'].every(function (role) { return roles.includes(role); })) events.achievement('three_professions');
      }
    }
  };
})();

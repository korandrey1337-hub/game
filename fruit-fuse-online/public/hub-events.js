(function () {
  'use strict';
  window.HubGameEvents = {
    create: function (game, options) {
      options = options || {};
      var key = 'hub-events:' + game + ':v1';
      var hub = window.Hub;
      var active = false;
      var ready = false;
      var pending = [];
      var data;
      try { data = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
      if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
      var runs = Array.isArray(data.runs) ? data.runs.filter(function (id) { return typeof id === 'string'; }).slice(-128) : [];
      var achievements = Array.isArray(data.achievements) ? data.achievements.filter(function (id) { return /^[a-z0-9_]+$/.test(id); }) : [];
      var values = data.values && typeof data.values === 'object' && !Array.isArray(data.values) ? data.values : {};
      function persist() {
        if (options.disabled) return;
        try { localStorage.setItem(key, JSON.stringify({ runs: runs, achievements: achievements, values: values })); } catch (_) {}
      }
      function send(name, value) {
        if (!active || options.disabled) return;
        try { hub.event(name, value); } catch (_) { /* Telemetry must not interrupt play. */ }
      }
      function emit(name, value) {
        if (!ready) pending.push([name, value]);
        else send(name, value);
      }
      if (!options.disabled && hub && typeof hub.ready === 'function' && typeof hub.event === 'function') {
        try { hub.ready(function (ctx) {
          ready = true;
          active = !!(ctx && ctx.inHub);
          // Re-submit earned badges after cloud restore; the hub grants each id once.
          achievements.forEach(function (id) { send('achievement', { id: id }); });
          pending.splice(0).forEach(function (entry) { send(entry[0], entry[1]); });
        }); } catch (_) { ready = true; active = false; pending = []; }
      } else ready = true;
      return {
        runId: function () { return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); },
        get: function (name, fallback) { return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : fallback; },
        set: function (name, value) { if (!options.disabled) { values[name] = value; persist(); } },
        achievement: function (id) {
          if (options.disabled || !/^[a-z0-9_]+$/.test(id) || achievements.includes(id)) return false;
          achievements.push(id); persist(); if (ready) emit('achievement', { id: id }); return true;
        },
        runEnd: function (id, result) {
          if (options.disabled || typeof id !== 'string' || !id || !result || typeof result.won !== 'boolean' || runs.includes(id)) return false;
          var value = Object.assign({}, result, { runId: id });
          ['score', 'depth'].forEach(function (field) {
            if (value[field] === undefined) return;
            if (!Number.isFinite(value[field]) || value[field] < 0 || value[field] > Number.MAX_SAFE_INTEGER) delete value[field];
            else value[field] = Math.floor(value[field]);
          });
          runs.push(id); runs = runs.slice(-128); persist(); emit('run_end', value); return true;
        }
      };
    }
  };
})();

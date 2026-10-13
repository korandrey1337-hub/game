(function () {
  'use strict';
  var hub = window.Hub && window.Hub.inHub ? window.Hub : null;
  var cfg = { keys: [], score: null };
  var loaded = false;
  var closing = false;
  var timer = 0;
  var initialized = null;
  var setItem = Storage.prototype.setItem;
  var removeItem = Storage.prototype.removeItem;

  function matches(key) {
    return cfg.keys.some(function (pattern) {
      return pattern.endsWith('*') ? key.indexOf(pattern.slice(0, -1)) === 0 : key === pattern;
    });
  }
  function snapshot() {
    var out = {};
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && matches(key)) keys.push(key);
      }
      keys.sort().forEach(function (key) { out[key] = localStorage.getItem(key); });
    } catch (error) { /* Storage may be unavailable in a webview. */ }
    return out;
  }
  function cloudKeys(save) {
    if (!save || save.v !== 1 || !save.keys || typeof save.keys !== 'object' || Array.isArray(save.keys)) return null;
    var out = {};
    Object.keys(save.keys).sort().forEach(function (key) {
      if (key !== '__proto__' && matches(key) && typeof save.keys[key] === 'string') out[key] = save.keys[key];
    });
    return out;
  }
  function apply(keys) {
    try {
      Object.keys(snapshot()).forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(keys, key)) removeItem.call(localStorage, key);
      });
      Object.keys(keys).forEach(function (key) { setItem.call(localStorage, key, keys[key]); });
      return true;
    } catch (error) { return false; }
  }
  function score(keys) {
    try {
      var value = cfg.score ? Number(cfg.score(keys)) : 0;
      return Number.isFinite(value) ? value : 0;
    } catch (error) { return 0; }
  }
  function push() {
    if (!hub || !loaded) return;
    clearTimeout(timer);
    timer = 0;
    try { hub.save({ v: 1, keys: snapshot() }); }
    catch (error) { console.warn('[hub-cloud] Save failed:', error.message); }
  }
  function later() {
    if (!hub || !loaded) return;
    clearTimeout(timer);
    if (closing || document.visibilityState === 'hidden') return push();
    timer = setTimeout(push, 1500);
  }
  if (hub) {
    Storage.prototype.setItem = function (key, value) {
      setItem.call(this, key, value);
      if (this === window.localStorage && matches(String(key))) later();
    };
    Storage.prototype.removeItem = function (key) {
      removeItem.call(this, key);
      if (this === window.localStorage && matches(String(key))) later();
    };
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden' && timer) push();
    });
    window.addEventListener('pagehide', function () { closing = true; if (timer) push(); });
    window.addEventListener('pageshow', function () { closing = false; });
  }
  window.HubCloud = {
    init: function (opts) {
      if (initialized) return initialized;
      cfg.keys = opts && Array.isArray(opts.keys) ? opts.keys.filter(function (key) { return typeof key === 'string' && key.length; }) : [];
      cfg.score = opts && opts.score;
      var flag = 'hub-cloud:reloaded:' + (opts && opts.game || location.pathname);
      initialized = new Promise(function (resolve) {
        if (!hub) return resolve();
        var started = false;
        var deadline;
        function start() { if (!started) { started = true; clearTimeout(deadline); resolve(); } }
        deadline = setTimeout(start, opts && opts.timeout || 4500);
        try {
          hub.ready(function (ctx) {
            if (!ctx || !ctx.inHub) return start();
            try {
              hub.load(function (save) {
                var cloud = cloudKeys(save);
                if (save != null && !cloud) {
                  console.warn('[hub-cloud] Ignored invalid cloud save');
                  return start();
                }
                var local = snapshot();
                if (cloud && Object.keys(cloud).length && (!Object.keys(local).length || score(cloud) > score(local))) {
                  if (started) {
                    try {
                      if (sessionStorage.getItem(flag) === '1') {
                        // A stale in-memory game must not overwrite a late cloud save.
                        console.warn('[hub-cloud] Late restore already restarted this session');
                        return;
                      }
                      sessionStorage.setItem(flag, '1');
                    } catch (error) {
                      return;
                    }
                  }
                  if (!apply(cloud)) return start();
                  loaded = true;
                  if (started) { location.reload(); return; }
                  try { sessionStorage.removeItem(flag); } catch (error) {}
                  return start();
                }
                loaded = true;
                try { sessionStorage.removeItem(flag); } catch (error) {}
                if (JSON.stringify(cloud) !== JSON.stringify(local)) push();
                start();
              });
            } catch (error) { console.warn('[hub-cloud] Load failed:', error.message); start(); }
          });
        } catch (error) { console.warn('[hub-cloud] Ready failed:', error.message); start(); }
      });
      return initialized;
    },
    flush: push
  };
})();

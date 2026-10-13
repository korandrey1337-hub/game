/*
 * hub-sdk.js — игровая сторона моста. Кладётся В ИГРУ и подключается ДО её кода:
 *
 *   <script src="hub-sdk.js"></script>
 *
 * Зачем. Игра внутри хаба живёт в <iframe> и не видит initData Telegram — его
 * получает только сам хаб. SDK прячет эту разницу: игра просто спрашивает
 * «кто играет» и «дай мой сейв», а откуда они придут — из хаба или напрямую —
 * решает SDK.
 *
 * Два режима, переключаются сами:
 *   в хабе      (адрес содержит ?hub=1 и есть родительское окно) — через postMessage;
 *   отдельно    (игру открыли по прямой ссылке из своего бота) — Telegram WebApp
 *               и localStorage, ровно как игра работала раньше.
 *
 * Игре доступен один объект — window.Hub:
 *
 *   Hub.ready(function (ctx) { ... })   ctx = {user, token, api, inHub, theme, initData}
 *                                       ctx.initData — подписанный игрок для СЕРВЕРА игры:
 *                                       в хабе её подписал шлюз секретом игры (HUB_GAME_SECRET,
 *                                       нужен auth: true в games.js хаба), вне хаба это обычная
 *                                       initData Telegram своего бота. Проверка одна и та же —
 *                                       HMAC WebAppData, «токеном» служит свой BOT_TOKEN или
 *                                       HUB_GAME_SECRET.
 *   Hub.load(function (save, at) {...}) поднять сохранение (save = null, если его нет)
 *   Hub.save(объект)                    отправить сохранение
 *   Hub.event('wave_done', 12)          событие в статистику хаба
 *   Hub.haptic('light')                 вибро-отдача
 *   Hub.exit()                          выйти в каталог хаба (вне хаба ничего не делает)
 *   Hub.start                           данные из ссылки-приглашения (или '')
 *   Hub.onParty(function (party) {...}) голосовая компания игрока из хаба: {id, kind, size,
 *                                       members: [telegram_id...]} или null (docs/game-party.md)
 *   Hub.invite('room_12345', 'текст')   позвать друзей: хаб сам откроет «Поделиться»
 *                                       со ссылкой t.me/<бот хаба>?startapp=<игра>__room_12345;
 *                                       в мультиплеере позвавший и пришедшие по ссылке — в одном
 *                                       голосовом канале стола (docs/game-party.md §1.2);
 *   Hub.room('room_12345')              партия началась за этим столом — хаб откроет по ней чат игры
 *                                       и в мультиплеере голосовой канал партии (только игроки стола,
 *                                       docs/game-round-voice.md); Hub.room('') — партия окончена,
 *                                       канал закрывается (как и Hub.event('run_end'));
 *                                       вне хаба возвращает false — игра зовёт по-своему
 */
(function () {
  'use strict';

  var PROTOCOL_VERSION = 1;

  var inHub = (function () {
    if (window.parent === window) return false;                 // не в рамке
    return /(?:\?|&)hub=/.test(window.location.search);         // и хаб пометил адрес
  })();

  var tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

  var readyCbs = [];
  var ctx = null;
  var pending = {};        // тип ответа -> колбэк, которого он ждёт
  var party = null;        // голосовая компания игрока из хаба (Hub.onParty)
  var partyCbs = [];

  // ---------- Общение с хабом ----------

  function toHub(type, data) {
    if (!inHub) return;
    var message = { source: 'hub-sdk', v: PROTOCOL_VERSION, type: type };
    Object.keys(data || {}).forEach(function (k) { message[k] = data[k]; });
    // '*' здесь безопасен: наверх уходят только данные самой игры, секретов нет.
    // Обратное направление хаб проверяет по origin строго.
    window.parent.postMessage(message, '*');
  }

  function onMessage(event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || msg.source !== 'hub') return;

    if (msg.type === 'welcome') {
      ctx = {
        user: msg.user || null,
        token: msg.token || '',
        initData: msg.initData || '',
        api: msg.api || '',
        game: msg.game || '',
        theme: msg.theme || {},
        colorScheme: msg.colorScheme || 'light',
        inHub: true
      };
      fireReady();
      return;
    }

    if (msg.type === 'party') {
      party = msg.party || null;
      partyCbs.forEach(function (cb) { try { cb(party); } catch (e) {} });
      return;
    }

    var cb = pending[msg.type];
    if (!cb) return;
    delete pending[msg.type];

    if (msg.type === 'save:data') cb(msg.save || null, msg.at || 0);
    if (msg.type === 'save:ok') cb(msg.at || 0, !!msg.error);
  }

  function fireReady() {
    var list = readyCbs.splice(0, readyCbs.length);
    list.forEach(function (cb) {
      try { cb(ctx); } catch (e) { console.error('Hub.ready:', e); }
    });
  }

  // ---------- Автономный режим: та же логика без хаба ----------

  function standaloneUser() {
    var u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (!u) return { id: 'guest', first_name: 'Гость', username: '' };
    return { id: u.id, first_name: u.first_name || '', username: u.username || '' };
  }

  function standaloneKey() {
    // Имя игры берём из адреса — папка, в которой она лежит.
    var path = window.location.pathname.replace(/\/[^/]*$/, '');
    return 'hub-sdk:save:' + standaloneUser().id + ':' + (path || 'game');
  }

  function initStandalone() {
    ctx = {
      user: standaloneUser(),
      token: '',
      initData: (tg && tg.initData) || '',
      api: '',
      game: '',
      theme: (tg && tg.themeParams) || {},
      colorScheme: (tg && tg.colorScheme) || 'light',
      inHub: false
    };
    fireReady();
  }

  // ---------- Публичное API ----------

  // Данные из ссылки-приглашения: хаб кладёт их в адрес рамки (start=).
  var startFromUrl = (function () {
    var m = /[?&]start=([A-Za-z0-9_-]{1,40})(?:&|$)/.exec(window.location.search);
    return m ? m[1] : '';
  })();

  var Hub = {
    inHub: inHub,
    start: inHub ? startFromUrl : '',

    // Голосовая компания игрока (шторка «С кем играем?» в хабе): {id, kind, size, members}
    // или null. Колбэк зовётся сразу с текущим составом и при каждом изменении.
    // Игра может посадить компанию за один стол; вне хаба компании нет.
    onParty: function (cb) {
      if (typeof cb !== 'function') return;
      partyCbs.push(cb);
      cb(party);
    },

    invite: function (payload, text) {
      if (!inHub || !/^[A-Za-z0-9_-]{1,40}$/.test(String(payload || ''))) return false;
      toHub('invite', { payload: String(payload), text: text ? String(text) : '' });
      return true;
    },

    // Сообщить хабу текущую комнату — хаб откроет по ней приватный чат игры (кнопка
    // чата поверх игры). Зовите при входе в комнату; Hub.room('') — когда игра закончилась.
    // Формат id — как start_param: [A-Za-z0-9_-], до 40. Вне хаба ничего не делает.
    room: function (id) {
      if (!inHub) return false;
      id = String(id == null ? '' : id);
      if (id && !/^[A-Za-z0-9_-]{1,40}$/.test(id)) return false;
      toHub('room', { payload: id });
      return true;
    },

    ready: function (cb) {
      if (typeof cb !== 'function') return;
      if (ctx) { cb(ctx); return; }
      readyCbs.push(cb);
    },

    load: function (cb) {
      if (typeof cb !== 'function') return;
      if (inHub) {
        pending['save:data'] = cb;
        toHub('load');
        return;
      }
      try {
        var raw = window.localStorage.getItem(standaloneKey());
        var parsed = raw ? JSON.parse(raw) : null;
        cb(parsed ? parsed.save : null, parsed ? (parsed.at || 0) : 0);
      } catch (e) {
        cb(null, 0);
      }
    },

    save: function (data, cb) {
      if (inHub) {
        if (typeof cb === 'function') pending['save:ok'] = cb;
        toHub('save', { save: data });
        return;
      }
      var at = Date.now();
      try {
        window.localStorage.setItem(standaloneKey(), JSON.stringify({ save: data, at: at }));
        if (typeof cb === 'function') cb(at, false);
      } catch (e) {
        if (typeof cb === 'function') cb(0, true);
      }
    },

    event: function (name, value) {
      if (inHub) toHub('event', { name: name, value: value });
      else console.debug('[hub-sdk] событие', name, value);
    },

    haptic: function (style) {
      if (inHub) { toHub('haptic', { style: style || 'light' }); return; }
      if (tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred) {
        try { tg.HapticFeedback.impactOccurred(style || 'light'); } catch (e) {}
      }
    },

    exit: function () {
      if (inHub) toHub('exit');
    }
  };

  window.Hub = Hub;

  if (inHub) {
    window.addEventListener('message', onMessage);
    toHub('hello');
    // Хаб не ответил — не оставляем игру висеть, поднимаем её как автономную.
    window.setTimeout(function () { if (!ctx) initStandalone(); }, 3000);
  } else {
    initStandalone();
  }
})();

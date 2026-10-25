import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const profiles = {
  core: ['fruit-fuse-online/public', 'corebelow', 'CoreBelowHub'],
  rift: ['rift-publish/capsule-rift', 'capsule-rift', 'RiftHub'],
  truck: ['truck-publish/wb_truck_survivor', 'wb-truck-survivor', 'TruckHub'],
  roulette: ['roulette-repo/roulette-club', 'roulette-club', 'RouletteHub'],
  story: ['screenstory-publish/screen-story-refactor/js', 'screen-story', 'ScreenStoryHub']
};
async function harness(name, { storage = new Map(), deferred = false, inHub = true, search = '' } = {}) {
  const [path, game, global] = profiles[name];
  const sent = [];
  let ready;
  let sequence = 0;
  const context = {
    URLSearchParams, console,
    location: { search },
    crypto: { randomUUID() { return `${name}-run-${++sequence}`; } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    Hub: { event: (event, value) => sent.push({ event, value: JSON.parse(JSON.stringify(value)) }), ready(fn) { ready = fn; if (!deferred) fn({ inHub }); } }
  };
  context.window = context;
  vm.createContext(context);
  for (const file of ['hub-events.js', 'hub-gameplay.js']) vm.runInContext(await readFile(new URL(`${path}/${file}`, root), 'utf8'), context);
  return { context, api: context[global], sent, storage, ready: (value = inHub) => ready({ inHub: value }),
    runs: () => sent.filter(item => item.event === 'run_end').map(item => item.value),
    badges: () => sent.filter(item => item.event === 'achievement').map(item => item.value.id),
    saved: () => JSON.parse(storage.get(`hub-events:${game}:v1`) || '{}') };
}
const coreState = (role = 'operator', phase = 'won', shiftId = 'shift-1') => ({ shiftId, phase, mistakes: 0, players: [{ id: 'me', role }], puzzleView: { progress: { resolvedCount: phase === 'won' ? 4 : 2 } } });
const table = (matchId = 'match-1', winnerId = 'me') => ({ matchId, winnerId, completedAt: 100, playerCount: 4, weaponSkin: 'shotgun', players: [{ id: 'me' }, { id: 'other' }] });

test('transport sanitizes fields, survives errors, and deduplicates across reload', async () => {
  const h = await harness('core');
  const e = h.context.HubGameEvents.create('test');
  assert.equal(e.runEnd('id', { won: true, score: 12.9, depth: -1 }), true);
  assert.deepEqual(h.runs(), [{ won: true, score: 12, runId: 'id' }]);
  assert.equal(e.runEnd('id', { won: false }), false);
  const reloaded = h.context.HubGameEvents.create('test');
  assert.equal(reloaded.runEnd('id', { won: false }), false);
  assert.equal(e.runEnd('bad', { score: 10 }), false);
  h.context.Hub.event = () => { throw new Error('unavailable'); };
  assert.doesNotThrow(() => e.runEnd('id-2', { won: false }));
});
test('welcome gates events and standalone never reports results', async () => {
  const h = await harness('core', { deferred: true });
  h.api.track(coreState(), 'me');
  assert.equal(h.sent.length, 0);
  h.ready();
  assert.equal(h.runs().length, 1);
  assert.equal(h.badges().filter(id => id === 'reactor_stable').length, 1);
  const outside = await harness('core', { inHub: false });
  outside.api.track(coreState(), 'me');
  assert.equal(outside.sent.length, 0);
});
test('SDK readiness failure and blocked local storage cannot break the game', async () => {
  const h = await harness('core');
  h.context.Hub.ready = () => { throw new Error('bridge unavailable'); };
  h.context.localStorage.setItem = () => { throw new Error('storage denied'); };
  let events;
  assert.doesNotThrow(() => { events = h.context.HubGameEvents.create('offline'); });
  assert.doesNotThrow(() => events.achievement('first'));
  assert.doesNotThrow(() => events.runEnd('one', { won: false }));
  assert.equal(h.sent.length, 0);
});
test('stored achievements are re-submitted after restore without replaying old runs', async () => {
  const h = await harness('core'); h.api.track(coreState(), 'me');
  const restored = await harness('core', { storage: h.storage });
  restored.api.track(coreState(), 'me');
  assert.equal(restored.runs().length, 0);
  assert.ok(restored.badges().includes('flawless_shift'));
});
test('core: final result only once, all three roles, no training or spectators', async () => {
  const h = await harness('core');
  const training = { ...coreState(), tutorial: true }; h.api.track(training, 'me');
  h.api.track(coreState('observer'), 'me'); h.api.track(coreState('lookout', 'playing'), 'me');
  assert.equal(h.runs().length, 0);
  ['lookout', 'operator', 'scribe'].forEach((role, i) => {
    const state = coreState(role, 'won', `shift-${i}`); h.api.track(state, 'me'); h.api.track(state, 'me');
  });
  assert.equal(h.runs().length, 3);
  assert.deepEqual(h.runs()[0], { won: true, score: 400, depth: 4, mode: 'online', abandoned: false, runId: 'shift-0' });
  assert.ok(h.badges().includes('three_professions'));
});
test('core: failed shift, imperfect success, server-confirmed repair window and explicit exit', async () => {
  const h = await harness('core');
  const success = coreState(); success.mistakes = 1; success.players[0].timedRepair = true;
  h.api.track(success, 'me');
  assert.ok(h.badges().includes('just_in_time')); assert.ok(!h.badges().includes('flawless_shift'));
  h.api.track(coreState('operator', 'lost', 'lost'), 'me');
  assert.ok(h.badges().includes('boom')); assert.equal(h.runs()[1].won, false);
  h.api.track(coreState('operator', 'playing', 'quit'), 'me', true);
  assert.equal(h.runs().length, 2);
  h.api.track(coreState('operator', 'won', 'quit'), 'me');
  assert.equal(h.runs()[2].abandoned, true);
  assert.equal(h.runs()[2].won, false);
});
test('rift: one result per arena, real stage, victory/loss/exit and level 30 achievement', async () => {
  const h = await harness('rift');
  const run = h.api.start(30); h.api.end(run, true, 4); h.api.end(run, true, 4);
  h.api.end(h.api.start(31), false, 2); h.api.end(h.api.start(31), false, 1, true);
  assert.equal(h.runs().length, 3); assert.equal(h.runs()[0].depth, 30);
  assert.equal(h.runs()[1].won, false); assert.equal(h.runs()[2].abandoned, true);
  assert.ok(h.badges().includes('rift_veteran'));
});
test('rift: badges reflect three-person squad and three attempts, not invented five-person party', async () => {
  const h = await harness('rift');
  h.api.pull({ party: ['one', 'two'] }); h.api.fuse(); h.api.contracts(1);
  assert.ok(!h.badges().includes('full_squad')); assert.ok(!h.badges().includes('contractor'));
  h.api.pull({ party: ['one', 'two', 'three'] }); h.api.contracts(0);
  for (const id of ['first_capsule', 'triplets', 'full_squad', 'contractor']) assert.ok(h.badges().includes(id));
});
test('truck: game over sends real score and wave once, no invented evacuation win', async () => {
  const h = await harness('truck');
  h.api.end({ score: 5, wave: 1 }); assert.equal(h.runs().length, 0);
  h.api.start(); h.api.end({ score: 12750, wave: 9 }); h.api.end({ score: 12750, wave: 9 });
  assert.deepEqual(h.runs()[0], { won: false, score: 12750, depth: 9, abandoned: false, runId: 'truck-run-1' });
  assert.deepEqual(h.badges(), ['scrap_metal']);
});
test('truck: completed waves, all four weapons and specific overlord kill', async () => {
  const h = await harness('truck');
  h.api.waves(4); h.api.weapons({ turret: 1, side: 1, emp: 1, rockets: 0 }); h.api.boss('hive');
  assert.equal(h.badges().length, 0);
  h.api.waves(5); h.api.waves(12); h.api.weapons({ turret: 1, side: 1, emp: 1, rockets: 1 }); h.api.boss('overlord');
  assert.deepEqual(h.badges(), ['fifth_wave', 'endurance', 'full_load', 'overlord_down']);
});
test('roulette: eliminating a player does not finish the table; own blank shot only', async () => {
  const h = await harness('roulette');
  const state = table(); state.completedAt = null; state.winnerId = null;
  state.lastEvent = { type: 'shot', actorId: 'other', selfShot: true, shell: 'blank' };
  h.api.track(state, 'me', true); assert.equal(h.sent.length, 0);
  state.lastEvent.actorId = 'me'; h.api.track(state, 'me', true);
  assert.deepEqual(h.badges(), ['blank_self']); assert.equal(h.runs().length, 0);
  state.completedAt = 1; state.winnerId = 'me'; h.api.track(state, 'me', true); h.api.track(state, 'me', true);
  assert.equal(h.runs().length, 1);
});
test('roulette: win, defeat, draw, no result for a non-participant', async () => {
  const h = await harness('roulette');
  h.api.track(table(), 'absent', true); assert.equal(h.runs().length, 0);
  h.api.track(table('one'), 'me', true); h.api.track(table('two', 'other'), 'me', true); h.api.track(table('three', null), 'me', true);
  assert.deepEqual(h.runs().map(run => run.won), [true, false, false]);
  assert.equal(h.runs()[2].draw, true); assert.equal(h.runs()[0].score, undefined);
  assert.ok(h.badges().includes('full_chaos')); assert.ok(h.badges().includes('club_table'));
});
test('roulette: five ONLINE wins, deduplicated results, loss and abandoned match reset streak', async () => {
  const h = await harness('roulette');
  for (let i = 0; i < 4; i++) { h.api.track(table(`win-${i}`), 'me', true); h.api.track(table(`win-${i}`), 'me', true); }
  h.api.track(table('solo'), 'me', false); assert.ok(!h.badges().includes('five_online_wins'));
  h.api.track(table('loss', 'other'), 'me', true); assert.equal(h.saved().values.onlineStreak, 0);
  for (let i = 0; i < 5; i++) h.api.track(table(`streak-${i}`), 'me', true);
  assert.ok(h.badges().includes('five_online_wins'));
  const playing = { ...table('quit'), completedAt: null, winnerId: null };
  h.api.track(playing, 'me', true, true); assert.equal(h.saved().values.onlineStreak, 0);
  assert.equal(h.runs().some(run => run.runId === 'quit'), false);
  h.api.track(table('quit'), 'me', true);
  assert.equal(h.runs().find(run => run.runId === 'quit').won, false);
});
test('roulette: a lost unfinished table cannot preserve a win streak on a new table', async () => {
  const h = await harness('roulette'); h.api.track(table('win'), 'me', true);
  h.api.track({ ...table('unfinished'), completedAt: null }, 'me', true);
  const reloaded = await harness('roulette', { storage: h.storage });
  reloaded.api.track({ ...table('new'), completedAt: null }, 'me', true);
  assert.equal(reloaded.saved().values.onlineStreak, 0);
});
test('roulette: QA never sends events or touches progression', async () => {
  const h = await harness('roulette', { search: '?qa=1' });
  h.api.track(table(), 'me', true); assert.equal(h.sent.length, 0); assert.equal(h.storage.size, 0);
});
test('story: only the actual final completes a run, no imaginary alternate endings', async () => {
  const h = await harness('story'); assert.equal(h.api.complete(), false);
  h.api.start(); h.api.beat({ t: 'fx', kind: 'glitch' }); h.api.beat({ t: 'fx', kind: 'webcam' }); h.api.beat({ t: 'day', n: 8 });
  assert.equal(h.runs().length, 0); h.api.complete(); h.api.complete();
  assert.deepEqual(h.runs(), [{ won: true, ending: 'let_me_in', runId: 'story-run-1' }]);
  assert.deepEqual(h.badges(), ['first_glitch', 'camera_taped', 'last_conversation', 'let_me_in']);
  h.api.start(); h.api.complete(); assert.equal(h.runs().length, 2);
});
test('bootstraps load telemetry AFTER cloud restore and BEFORE the game', async () => {
  for (const [name, [path]] of Object.entries(profiles)) {
    if (name === 'story') continue;
    const bootstrap = name === 'core' ? 'client-bootstrap.js' : 'hub-progress-bootstrap.js';
    const code = await readFile(new URL(`${path}/${bootstrap}`, root), 'utf8');
    assert.ok(code.indexOf('HubCloud.init(') < code.indexOf("import("));
    assert.ok(code.indexOf('hub-events.js') < code.indexOf('hub-gameplay.js'));
    assert.ok(code.indexOf('hub-gameplay.js') < (name === 'core' ? code.indexOf('client.js') : name === 'roulette' ? code.indexOf('src/main.js') : code.indexOf('game.src')));
    const h = await harness(name); vm.runInContext(await readFile(new URL(`${path}/hub-progress-config.js`, root), 'utf8'), h.context);
    assert.ok(h.context.HUB_PROGRESS.keys.includes(`hub-events:${profiles[name][1]}:v1`));
  }
});

test('real bundled SDK delivers run_end and achievements with the documented event envelope', async () => {
  const messages = [];
  const listeners = new Map();
  const storage = new Map();
  const context = {
    console, URLSearchParams,
    location: { search: '?hub=1', pathname: '/corebelow/' },
    parent: { postMessage(message) { messages.push(JSON.parse(JSON.stringify(message))); } },
    addEventListener(type, callback) { listeners.set(type, callback); },
    setTimeout() { return 1; }, clearTimeout() {},
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  };
  context.window = context; vm.createContext(context);
  for (const file of ['hub-sdk.js', 'hub-events.js', 'hub-gameplay.js']) vm.runInContext(await readFile(new URL(`fruit-fuse-online/public/${file}`, root), 'utf8'), context);
  context.CoreBelowHub.track(coreState(), 'me');
  assert.equal(messages.filter(item => item.type === 'event').length, 0);
  listeners.get('message')({ source: context.parent, data: { source: 'hub', type: 'welcome', user: { id: 123 }, game: 'corebelow' } });
  context.CoreBelowHub.track(coreState(), 'me');
  const events = messages.filter(item => item.type === 'event');
  assert.equal(events.filter(item => item.name === 'run_end').length, 1);
  assert.ok(events.some(item => item.name === 'achievement' && item.value.id === 'reactor_stable'));
  for (const event of events) { assert.equal(event.source, 'hub-sdk'); assert.equal(event.v, 1); }
});

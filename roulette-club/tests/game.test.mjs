import assert from "node:assert/strict";
import test from "node:test";

import { RouletteGame } from "../src/game.js";

function gameWithShells(shells, playerCount = 2) {
  const game = new RouletteGame({ playerCount });
  game.state.shells = [...shells];
  game.state.currentPlayerId = "p0";
  return game;
}

test("every round contains at least one combat and one blank charge", () => {
  for (const playerCount of [2, 4]) {
    const game = new RouletteGame({ playerCount });
    for (let round = 0; round < 500; round += 1) {
      game.startRound();
      assert.ok(game.state.shellCounts.live >= 1);
      assert.ok(game.state.shellCounts.blank >= 1);
      assert.equal(
        game.state.shellCounts.live + game.state.shellCounts.blank,
        game.state.shells.length,
      );
    }
  }
});

test("blank self-shot repeats the turn", () => {
  const game = gameWithShells(["blank", "live"]);
  game.shoot("p0");
  assert.equal(game.state.currentPlayerId, "p0");
  assert.equal(game.state.players[0].hp, 4);
});

test("blank opponent shot passes the turn", () => {
  const game = gameWithShells(["blank", "live"]);
  game.shoot("p1");
  assert.equal(game.state.currentPlayerId, "p1");
  assert.equal(game.state.players[1].hp, 4);
});

test("combat charge deals damage and passes the turn", () => {
  const game = gameWithShells(["live", "blank"]);
  game.shoot("p1");
  assert.equal(game.state.players[1].hp, 3);
  assert.equal(game.state.lastEvent.damage, 1);
  assert.equal(game.state.currentPlayerId, "p1");
});

test("shotgun combat charge deals two damage", () => {
  const game = new RouletteGame({ playerCount: 2, weaponSkin: "shotgun" });
  game.state.shells = ["live", "blank"];
  game.state.currentPlayerId = "p0";
  game.shoot("p1");
  assert.equal(game.state.players[1].hp, 2);
  assert.equal(game.state.lastEvent.damage, 2);
  assert.equal(game.state.currentPlayerId, "p1");
});

test("hammer skips exactly one target turn", () => {
  const game = gameWithShells(["blank", "live"]);
  game.state.players[0].items = ["hammer"];
  assert.equal(game.useItem("hammer", "p1").ok, true);
  game.shoot("p1");
  assert.equal(game.state.currentPlayerId, "p0");
  assert.equal(game.state.players[1].skipTurns, 0);
});

test("claw transfers an item and rejects an empty target", () => {
  const game = gameWithShells(["blank", "live"]);
  game.state.players[0].items = ["claw"];
  game.state.players[1].items = ["tarot"];
  assert.equal(game.useItem("claw", "p1").ok, true);
  assert.deepEqual(game.state.players[0].items, ["tarot"]);
  assert.deepEqual(game.state.players[1].items, []);

  game.state.players[0].items = ["claw"];
  assert.equal(game.useItem("claw", "p1").ok, false);
  assert.deepEqual(game.state.players[0].items, ["claw"]);
});

test("vape heals and cannot be wasted at maximum HP", () => {
  const game = gameWithShells(["blank", "live"]);
  game.state.players[0].hp = 3;
  game.state.players[0].items = ["vape"];
  assert.equal(game.useItem("vape").ok, true);
  assert.equal(game.state.players[0].hp, 4);

  game.state.players[0].items = ["vape"];
  assert.equal(game.useItem("vape").ok, false);
  assert.equal(game.state.players[0].hp, 4);
  assert.deepEqual(game.state.players[0].items, ["vape"]);
});

test("tarot reveals only the current charge", () => {
  const game = gameWithShells(["live", "blank"]);
  game.state.players[0].items = ["tarot"];
  game.useItem("tarot");
  assert.equal(game.state.peekedShell, "live");
  assert.equal(game.state.peekedBy, "p0");
  game.shoot("p1");
  assert.equal(game.state.peekedShell, null);
  assert.equal(game.state.peekedBy, null);
});

test("last surviving player wins and match completion is recorded", () => {
  const game = gameWithShells(["live", "blank"]);
  game.state.players[1].hp = 1;
  game.shoot("p1");
  assert.equal(game.state.winnerId, "p0");
  assert.ok(Number.isFinite(game.state.completedAt));
});

test("last charge keeps the shot event and carries the next-round reveal", () => {
  const game = gameWithShells(["blank"]);
  const previousRound = game.state.roundNumber;
  game.shoot("p1");

  assert.equal(game.state.roundNumber, previousRound + 1);
  assert.equal(game.state.lastEvent.type, "shot");
  assert.equal(game.state.lastEvent.shell, "blank");
  assert.equal(game.state.lastEvent.nextRound.type, "round-start");
  assert.ok(game.state.lastEvent.nextRound.revision > game.state.lastEvent.revision);
});

export const ITEM_DEFS = {
  hammer: {
    id: "hammer",
    name: "Клоунский молоток",
    shortName: "Молоток",
    needsTarget: true,
    targetMode: "other",
    description: "Выбранный игрок пропускает следующий ход.",
  },
  claw: {
    id: "claw",
    name: "Игрушечная рука-клешня",
    shortName: "Клешня",
    needsTarget: true,
    targetMode: "hasItem",
    description: "Крадет случайный предмет у выбранного игрока.",
  },
  vape: {
    id: "vape",
    name: "Вейп",
    shortName: "Вейп",
    needsTarget: false,
    description: "Восстанавливает 1 HP, но не выше максимума.",
  },
  tarot: {
    id: "tarot",
    name: "Карта таро",
    shortName: "Таро",
    needsTarget: false,
    description: "Показывает текущий заряд в оружии.",
  },
};

export const WEAPON_SKINS = {
  revolver: {
    id: "revolver",
    name: "Проп-револьвер",
    chamberName: "барабан",
    damage: 1,
  },
  shotgun: {
    id: "shotgun",
    name: "Проп-дробовик",
    chamberName: "магазин",
    damage: 2,
  },
};

const PLAYER_NAMES = ["Ты", "Шумный Прораб", "Бетонный Джим", "Смузи-Бригадир"];
const PLAYER_COLORS = ["#62d7c5", "#ff5d66", "#f3b84d", "#9ddc7c"];
const ITEM_POOL = ["hammer", "claw", "vape", "tarot"];
let matchSequence = 0;

function randomInt(min, max) {
  const range = max - min + 1;
  if (globalThis.crypto?.getRandomValues) {
    const limit = Math.floor(0x1_0000_0000 / range) * range;
    const sample = new Uint32Array(1);
    do {
      globalThis.crypto.getRandomValues(sample);
    } while (sample[0] >= limit);
    return min + (sample[0] % range);
  }
  return Math.floor(Math.random() * range) + min;
}

function pick(list) {
  return list[randomInt(0, list.length - 1)];
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeShells(roundNumber, playerCount) {
  const maxShells = playerCount === 4 ? 8 : 6;
  const minShells = playerCount === 4 ? 5 : 3;
  const pressure = Math.min(2, Math.floor(roundNumber / 3));
  const total = randomInt(minShells, maxShells);
  const liveMin = 1;
  const liveMax = Math.max(1, total - 1);
  const biasedLiveMax = Math.min(liveMax, Math.ceil(total / 2) + pressure);
  const live = randomInt(liveMin, biasedLiveMax);
  const blank = total - live;
  return shuffle([
    ...Array.from({ length: live }, () => "live"),
    ...Array.from({ length: blank }, () => "blank"),
  ]);
}

function countShells(shells) {
  return shells.reduce(
    (acc, shell) => {
      acc[shell] += 1;
      return acc;
    },
    { live: 0, blank: 0 },
  );
}

function nameOf(player, selfName = "Ты") {
  return player?.isHuman ? selfName : player?.name;
}

function actionOf(player, thirdPerson, secondPerson) {
  return `${nameOf(player)} ${player?.isHuman ? secondPerson : thirdPerson}`;
}

function actionOfLower(player, thirdPerson, secondPerson) {
  return player?.isHuman ? `ты ${secondPerson}` : `${player?.name} ${thirdPerson}`;
}

function targetNameForShot(player) {
  return player?.isHuman ? "тебя" : player?.name;
}

function makeMatchId() {
  matchSequence += 1;
  return `match-${Date.now().toString(36)}-${matchSequence}-${Math.random().toString(36).slice(2, 8)}`;
}

export class RouletteGame {
  constructor({ playerCount = 2, weaponSkin = "revolver" } = {}) {
    this.state = {
      matchId: makeMatchId(),
      playerCount,
      weaponSkin,
      players: [],
      roundNumber: 0,
      shells: [],
      shellCounts: { live: 0, blank: 0 },
      currentPlayerId: null,
      peekedShell: null,
      peekedBy: null,
      winnerId: null,
      completedAt: null,
      log: [],
      lastEvent: null,
      revision: 0,
    };
    this.newGame({ playerCount, weaponSkin });
  }

  newGame({ playerCount = this.state.playerCount, weaponSkin = this.state.weaponSkin } = {}) {
    const safeCount = Number(playerCount) === 4 ? 4 : 2;
    this.state.matchId = makeMatchId();
    this.state.playerCount = safeCount;
    this.state.weaponSkin = WEAPON_SKINS[weaponSkin] ? weaponSkin : "revolver";
    this.state.players = Array.from({ length: safeCount }, (_, index) => ({
      id: `p${index}`,
      name: PLAYER_NAMES[index],
      color: PLAYER_COLORS[index],
      isHuman: index === 0,
      hp: 4,
      maxHp: 4,
      items: [],
      skipTurns: 0,
      out: false,
    }));
    this.state.roundNumber = 0;
    this.state.currentPlayerId = this.state.players[0].id;
    this.state.winnerId = null;
    this.state.completedAt = null;
    this.state.log = [];
    this.state.lastEvent = null;
    this.pushLog("Матч начался. На столе реквизит, правила простые: выбирай цель и не доверяй барабану.");
    this.startRound({ preserveTurn: true });
  }

  get activePlayer() {
    return this.state.players.find((player) => player.id === this.state.currentPlayerId) ?? null;
  }

  get weapon() {
    return WEAPON_SKINS[this.state.weaponSkin];
  }

  alivePlayers() {
    return this.state.players.filter((player) => !player.out && player.hp > 0);
  }

  pushLog(message) {
    this.state.log.unshift(message);
    this.state.log = this.state.log.slice(0, 8);
  }

  touch(event = null) {
    this.state.revision += 1;
    this.state.shellCounts = countShells(this.state.shells);
    if (event && typeof event === "object") event.revision = this.state.revision;
    this.state.lastEvent = event;
  }

  startRound({ preserveTurn = false } = {}) {
    this.state.roundNumber += 1;
    this.state.shells = makeShells(this.state.roundNumber, this.state.playerCount);
    this.state.shellCounts = countShells(this.state.shells);
    this.state.peekedShell = null;
    this.state.peekedBy = null;

    for (const player of this.alivePlayers()) {
      player.items = [pick(ITEM_POOL)];
    }

    const { live, blank } = this.state.shellCounts;
    const message = `Раунд ${this.state.roundNumber}: боевые ${live}, пустые ${blank}. Заряды перемешаны вслепую.`;
    this.pushLog(message);

    if (!preserveTurn || !this.activePlayer || this.activePlayer.out) {
      const firstAlive = this.alivePlayers()[0];
      this.state.currentPlayerId = firstAlive?.id ?? null;
    }
    this.ensureActivePlayer();
    this.touch({
      type: "round-start",
      live,
      blank,
      weaponSkin: this.state.weaponSkin,
      message,
    });
  }

  ensureActivePlayer() {
    const active = this.activePlayer;
    if (!active || active.out || active.hp <= 0 || active.skipTurns > 0) {
      this.state.currentPlayerId = this.findNextPlayer(this.state.currentPlayerId, false);
    }
  }

  findNextPlayer(fromId, allowSame) {
    const alive = this.alivePlayers();
    if (alive.length === 0) {
      return null;
    }

    const players = this.state.players;
    const fromIndex = Math.max(0, players.findIndex((player) => player.id === fromId));
    const firstStep = allowSame ? 0 : 1;
    const maxSteps = players.length * 3;

    for (let step = firstStep; step <= maxSteps; step += 1) {
      const candidate = players[(fromIndex + step) % players.length];
      if (!candidate || candidate.out || candidate.hp <= 0) {
        continue;
      }
      if (candidate.skipTurns > 0) {
        candidate.skipTurns -= 1;
        this.pushLog(`${actionOf(candidate, "ловит", "ловишь")} эффект молотка и пропускает ход.`);
        continue;
      }
      return candidate.id;
    }

    for (const player of alive) {
      player.skipTurns = 0;
    }
    return alive[0].id;
  }

  resolveTurnAfterAction({ repeatTurn = false } = {}) {
    if (this.isGameOver()) {
      return;
    }

    const currentId = this.state.currentPlayerId;
    this.state.currentPlayerId = this.findNextPlayer(currentId, repeatTurn);

    if (this.state.shells.length === 0 && !this.isGameOver()) {
      this.startRound({ preserveTurn: true });
      return;
    }

    this.touch({ type: "turn-change" });
  }

  isGameOver() {
    const alive = this.alivePlayers();
    if (alive.length <= 1) {
      this.state.winnerId = alive[0]?.id ?? null;
      if (!this.state.completedAt) {
        this.state.completedAt = Date.now();
      }
      return true;
    }
    return false;
  }

  useItem(itemId, targetId = null) {
    const actor = this.activePlayer;
    if (!actor || actor.out || actor.hp <= 0) {
      return { ok: false, error: "Сейчас некому действовать." };
    }

    const itemIndex = actor.items.indexOf(itemId);
    if (itemIndex === -1) {
      return { ok: false, error: "Такого предмета нет у активного игрока." };
    }

    const item = ITEM_DEFS[itemId];
    if (!item) {
      return { ok: false, error: "Неизвестный предмет." };
    }

    const target = targetId ? this.state.players.find((player) => player.id === targetId) : null;

    if (item.needsTarget) {
      if (!target || target.out || target.hp <= 0) {
        return { ok: false, error: "Нужна живая цель." };
      }
      if (target.id === actor.id) {
        return { ok: false, error: "Этот предмет нужен для чужой стороны стола." };
      }
    }

    if (itemId === "claw" && (!target || target.items.length === 0)) {
      return { ok: false, error: "У цели нечего красть." };
    }

    if (itemId === "vape" && actor.hp >= actor.maxHp) {
      return { ok: false, error: "HP уже полный — прибереги вейп." };
    }

    actor.items.splice(itemIndex, 1);

    if (itemId === "hammer") {
      target.skipTurns += 1;
      const targetSeat = target.isHuman ? "тобой" : target.name;
      this.pushLog(`${actionOf(actor, "хлопает", "хлопаешь")} молотком рядом с ${targetSeat}: следующий ход мимо.`);
      this.touch({ type: "item", itemId, actorId: actor.id, targetId: target.id });
      return { ok: true };
    }

    if (itemId === "claw") {
      const stolenIndex = randomInt(0, target.items.length - 1);
      const stolen = target.items.splice(stolenIndex, 1)[0];
      actor.items.push(stolen);
      const targetPocket = target.isHuman ? "тебя" : target.name;
      this.pushLog(`${actionOf(actor, "тянет клешню и утаскивает", "тянешь клешню и утаскиваешь")} "${ITEM_DEFS[stolen].shortName}" у ${targetPocket}.`);
      this.touch({ type: "item", itemId, actorId: actor.id, targetId: target.id, stolen });
      return { ok: true };
    }

    if (itemId === "vape") {
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, actor.hp + 1);
      const healed = actor.hp - before;
      this.pushLog(
        healed > 0
          ? `${actionOf(actor, "делает", "делаешь")} затяжку и возвращает 1 HP.`
          : `${nameOf(actor)} уже на максимуме, но драматично выпускает пар.`,
      );
      this.touch({ type: "item", itemId, actorId: actor.id, targetId: actor.id, healed });
      return { ok: true };
    }

    if (itemId === "tarot") {
      this.state.peekedShell = this.state.shells[0] ?? null;
      this.state.peekedBy = actor.id;
      this.pushLog(`${actionOf(actor, "смотрит", "смотришь")} карту таро.`);
      this.touch({ type: "item", itemId, actorId: actor.id, targetId: actor.id, peekedShell: this.state.peekedShell });
      return { ok: true };
    }

    return { ok: false, error: "Этот предмет пока не готов." };
  }

  shoot(targetId) {
    const actor = this.activePlayer;
    const target = this.state.players.find((player) => player.id === targetId);

    if (!actor || actor.out || actor.hp <= 0) {
      return { ok: false, error: "Нет активного игрока." };
    }
    if (!target || target.out || target.hp <= 0) {
      return { ok: false, error: "Нужна живая цель." };
    }
    if (this.state.shells.length === 0) {
      this.startRound({ preserveTurn: true });
      return { ok: true };
    }

    const shell = this.state.shells.shift();
    this.state.peekedShell = null;
    this.state.peekedBy = null;

    const selfShot = actor.id === target.id;
    let repeatTurn = false;
    let eliminated = false;
    let damage = 0;

    if (shell === "live") {
      damage = this.weapon.damage;
      target.hp -= damage;
      this.pushLog(`${actionOf(actor, "выбирает", "выбираешь")} ${selfShot ? "себя" : targetNameForShot(target)}: боевой заряд, ${actionOfLower(target, "теряет", "теряешь")} ${damage} HP.`);
      if (target.hp <= 0) {
        target.hp = 0;
        target.out = true;
        target.items = [];
        eliminated = true;
        this.pushLog(`${actionOf(target, "вылетает", "вылетаешь")} из-за стола.`);
      }
    } else {
      this.pushLog(`${actionOf(actor, "выбирает", "выбираешь")} ${selfShot ? "себя" : targetNameForShot(target)}: пустой щелчок.`);
      repeatTurn = selfShot;
      if (repeatTurn) {
        this.pushLog(`${actionOf(actor, "получает", "получаешь")} еще один ход за рискованный пустой щелчок.`);
      }
    }

    this.state.shellCounts = countShells(this.state.shells);
    const event = {
      type: "shot",
      actorId: actor.id,
      targetId: target.id,
      shell,
      damage,
      weaponSkin: this.state.weaponSkin,
      selfShot,
      eliminated,
      message: this.state.log[0],
    };
    this.touch(event);

    if (this.isGameOver()) {
      const winner = this.state.players.find((player) => player.id === this.state.winnerId);
      this.pushLog(winner ? `${actionOf(winner, "забирает", "забираешь")} стол.` : "За столом не осталось победителя.");
      this.touch({ ...event, gameOver: true });
      return { ok: true };
    }

    this.resolveTurnAfterAction({ repeatTurn });
    if (this.state.lastEvent?.type === "round-start") {
      event.nextRound = { ...this.state.lastEvent };
    }
    this.state.lastEvent = event;
    return { ok: true };
  }
}

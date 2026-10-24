import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import ts from "typescript";

async function compile(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}
const playerCode = await compile(
  "../apps/web/features/minigames/shared/game-audio.ts",
);
const hookCode = await compile(
  "../apps/web/app/[locale]/(dashboard)/arena/hooks/use-arena-audio.ts",
);
const preferenceCode = await compile(
  "../apps/web/features/minigames/shared/audio-preference.ts",
);
const preferenceExports = {};
new Function("exports", preferenceCode)(preferenceExports);
const playerExports = {};
new Function("exports", playerCode)(playerExports);

async function fixture(load, muted = false) {
  const tracks = {};
  const socket = new EventEmitter();
  socket.connected = true;
  globalThis.document = new EventTarget();
  document.hidden = false;
  globalThis.window = new EventTarget();
  const storage = new Map([["vocalearn-game-audio-muted", String(muted)]]);
  window.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.Audio = class {
    paused = true;
    plays = 0;
    currentTime = 0;
    constructor(url) {
      tracks[url] = this;
    }
    play() {
      this.plays++;
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    removeAttribute() {}
    load() {}
  };
  const settings = {
    backgroundMusicUrl: "music",
    correctSoundUrl: "correct",
    wrongSoundUrl: "wrong",
    loseSoundUrl: "lose",
  };
  let cleanup;
  const exports = {};
  const modules = {
    "@/features/minigames/shared/audio-preference": preferenceExports,
    react: {
      useState: (value) => [value, () => {}],
      useRef: (value) => ({ current: value }),
      useCallback: (fn) => fn,
      useEffect: (fn) => {
        cleanup = fn();
      },
    },
    "@/lib/arena-socket": { arenaSocket: socket },
    "@/services/arena.service": {
      arenaService: { getMatchAudio: load ?? (async () => settings) },
    },
    "@/features/minigames/shared/game-audio": playerExports,
  };
  new Function("require", "exports", hookCode)((name) => {
    assert.ok(modules[name], name);
    return modules[name];
  }, exports);
  const { playAnswer: answer } = exports.useArenaAudio("match-a", "me");
  await Promise.resolve();
  await Promise.resolve();
  return {
    socket,
    tracks,
    answer,
    cleanup: () => cleanup(),
    settings,
    preferences: preferenceExports,
  };
}

test("arena audio follows the active match, connection, visibility and final result", async () => {
  const f = await fixture();
  f.socket.emit("match:start", { matchId: "other" });
  assert.equal(f.tracks.music.plays, 0);
  f.socket.emit("match:start", { matchId: "match-a" });
  f.answer(true);
  f.answer(false);
  assert.equal(f.tracks.correct.plays, 1);
  assert.equal(f.tracks.wrong.plays, 1);
  f.socket.emit("disconnect");
  assert.equal(f.tracks.music.paused, true);
  f.socket.emit("arena:authenticated");
  assert.equal(f.tracks.music.paused, false);
  document.hidden = true;
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(f.tracks.music.paused, true);
  document.hidden = false;
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(f.tracks.music.paused, false);
  const result = { matchId: "match-a", winnerId: "opponent", isDraw: false };
  f.socket.emit("match:finished", result);
  f.socket.emit("friend:match-finished", result);
  assert.equal(f.tracks.music.paused, true);
  assert.equal(f.tracks.lose.plays, 1);
  f.cleanup();
  assert.equal(f.socket.eventNames().length, 0);
  for (const track of Object.values(f.tracks)) assert.equal(track.paused, true);
});

test("word chain sounds only on the current player's accepted turn, and cancellation stays silent", async () => {
  const f = await fixture();
  const emit = (currentTurnUserId, turnCount) =>
    f.socket.emit("word-chain:turn", {
      matchId: "match-a",
      currentTurnUserId,
      turnCount,
    });
  emit("opponent", 0);
  emit("me", 1);
  assert.equal(f.tracks.correct.plays, 0);
  emit("opponent", 2);
  emit("opponent", 2);
  assert.equal(f.tracks.correct.plays, 1);
  f.socket.emit("word-chain:invalid", { matchId: "other" });
  f.socket.emit("word-chain:invalid", { matchId: "match-a" });
  assert.equal(f.tracks.wrong.plays, 1);
  f.socket.emit("friend:cancelled", { matchId: "match-a" });
  f.socket.emit("match:start", { matchId: "match-a" });
  assert.equal(f.tracks.music.paused, true);
  assert.equal(f.tracks.lose.plays, 0);
  f.cleanup();
});

test("late audio responses after navigation never start playback", async () => {
  let resolve;
  const f = await fixture(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  f.socket.emit("match:start", { matchId: "match-a" });
  f.cleanup();
  resolve(f.settings);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(Object.keys(f.tracks).length, 0);
});

test("a saved player preference silences the next match and toggles immediately during play", async () => {
  const f = await fixture(undefined, true);
  f.socket.emit("match:start", { matchId: "match-a" });
  f.answer(true);
  f.answer(false);
  for (const track of Object.values(f.tracks)) assert.equal(track.plays, 0);
  f.preferences.setAudioMuted(false);
  assert.equal(
    window.localStorage.getItem("vocalearn-game-audio-muted"),
    "false",
  );
  assert.equal(f.tracks.music.paused, false);
  f.answer(true);
  f.preferences.setAudioMuted(true);
  assert.equal(f.tracks.music.paused, true);
  assert.equal(f.tracks.correct.paused, true);
  f.socket.emit("match:finished", {
    matchId: "match-a",
    winnerId: "other",
    isDraw: false,
  });
  f.preferences.setAudioMuted(false);
  assert.equal(f.tracks.music.paused, true);
  assert.equal(f.tracks.lose.plays, 0);
  f.cleanup();
});

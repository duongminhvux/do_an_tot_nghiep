import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL(
    "../apps/web/features/minigames/shared/audio-preference.ts",
    import.meta.url,
  ),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function createStore() {
  const store = {};
  new Function("exports", code)(store);
  return store;
}
const key = "vocalearn-game-audio-muted";

function browser() {
  const values = new Map();
  globalThis.window = new EventTarget();
  window.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  return values;
}

test("mute is persisted and restored by another instance", () => {
  browser();
  const store = createStore();
  store.setAudioMuted(true);
  assert.equal(window.localStorage.getItem(key), "true");
  const restored = createStore();
  assert.equal(restored.getAudioMuted(), true);
  restored.setAudioMuted(false);
  assert.equal(store.getAudioMuted(), false);
});

test("subscribers synchronize same-tab changes and other-tab storage events", () => {
  const values = browser();
  const store = createStore();
  let notifications = 0;
  const unsubscribe = store.subscribeAudioMuted(() => notifications++);
  store.setAudioMuted(true);
  assert.equal(notifications, 1);
  values.set(key, "false");
  window.dispatchEvent(Object.assign(new Event("storage"), { key }));
  assert.equal(notifications, 2);
  assert.equal(store.getAudioMuted(), false);
  window.dispatchEvent(
    Object.assign(new Event("storage"), { key: "unrelated" }),
  );
  assert.equal(notifications, 2);
  unsubscribe();
  store.setAudioMuted(true);
  assert.equal(notifications, 2);
});

test("blocked browser storage still supports mute for the current session", () => {
  browser();
  window.localStorage = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
  };
  const store = createStore();
  assert.equal(store.getAudioMuted(), false);
  store.setAudioMuted(true);
  assert.equal(store.getAudioMuted(), true);
  store.setAudioMuted(false);
  assert.equal(store.getAudioMuted(), false);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL(
    "../apps/web/features/minigames/shared/game-audio.ts",
    import.meta.url,
  ),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { GameAudio } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`
);

function fixture(blocked = false) {
  const tracks = {};
  const player = new GameAudio(
    {
      backgroundMusicUrl: "music",
      correctSoundUrl: "correct",
      wrongSoundUrl: "wrong",
      loseSoundUrl: "lose",
    },
    (url) => {
      const track = {
        paused: true,
        plays: 0,
        currentTime: 0,
        play() {
          this.plays++;
          if (blocked) return Promise.reject(new Error("autoplay blocked"));
          this.paused = false;
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
        },
        removeAttribute(name) {
          this.removed = name;
        },
        load() {
          this.loaded = true;
        },
      };
      tracks[url] = track;
      return track;
    },
  );
  return { player, tracks };
}
const running = { status: "RUNNING", correct: 0, wrong: 0 };

test("music loops, pauses and resumes without resetting position", () => {
  const { player, tracks } = fixture();
  player.update(running);
  assert.equal(tracks.music.loop, true);
  assert.equal(tracks.music.plays, 1);
  tracks.music.currentTime = 12;
  player.update({ ...running, status: "PAUSED" });
  player.unlock();
  assert.equal(tracks.music.paused, true);
  assert.equal(tracks.music.plays, 1);
  player.update(running);
  assert.equal(tracks.music.currentTime, 12);
  assert.equal(tracks.music.plays, 2);
});

test("consecutive answers play once each, regardless of animation frames", () => {
  const { player, tracks } = fixture();
  player.update(running);
  player.update({ ...running, correct: 1 });
  player.update({ ...running, correct: 1 });
  player.update({ ...running, correct: 2 });
  player.update({ ...running, correct: 2, wrong: 1 });
  player.wrong();
  assert.equal(tracks.correct.plays, 2);
  assert.equal(tracks.wrong.plays, 2);
});

test("game over stops music and plays loss once, including a fatal wrong answer", () => {
  const { player, tracks } = fixture();
  player.update(running);
  const finished = { status: "FINISHED", correct: 0, wrong: 1 };
  player.update(finished);
  player.update(finished);
  player.unlock();
  player.wrong();
  assert.equal(tracks.music.paused, true);
  assert.equal(tracks.lose.plays, 1);
  assert.equal(tracks.wrong.plays, 0);
  player.dispose();
  for (const track of Object.values(tracks)) {
    assert.equal(track.paused, true);
    assert.equal(track.removed, "src");
    assert.equal(track.loaded, true);
  }
});

test("blocked autoplay can retry on a gesture, and missing audio stays silent", async () => {
  const { player, tracks } = fixture(true);
  player.update(running);
  await Promise.resolve();
  player.unlock();
  await Promise.resolve();
  assert.equal(tracks.music.plays, 2);
  const silent = new GameAudio({}, () =>
    assert.fail("must not create empty audio"),
  );
  silent.update(running);
  silent.wrong();
  silent.dispose();
});

test("arena wins and draws stop music without a loss sound, while loss plays once", () => {
  for (const lost of [false, true]) {
    const { player, tracks } = fixture();
    player.update(running);
    player.update({ ...running, status: "FINISHED", lost });
    player.update({ ...running, status: "FINISHED", lost });
    assert.equal(tracks.music.paused, true);
    assert.equal(tracks.lose.plays, lost ? 1 : 0);
    player.answer(true);
    assert.equal(tracks.correct.plays, lost ? 0 : 1);
  }
});

test("admin-disabled audio cannot be enabled by the player", () => {
  const player = new GameAudio(
    {
      audioEnabled: false,
      backgroundMusicUrl: "/music.mp3",
      correctSoundUrl: "/correct.mp3",
    },
    () => assert.fail("admin-disabled audio must not create media"),
  );
  player.setMuted(true);
  player.update(running);
  player.setMuted(false);
  player.answer(true);
  player.answer(false);
  player.unlock();
  player.update({ ...running, status: "FINISHED" });
  player.dispose();
});

test("muting stops effects and restores only background music without replaying missed sounds", () => {
  const { player, tracks } = fixture();
  player.update(running);
  tracks.music.currentTime = 18;
  player.answer(true);
  player.setMuted(true);
  for (const track of Object.values(tracks)) {
    assert.equal(track.paused, true);
    assert.equal(track.muted, true);
  }
  player.answer(false);
  player.update({ ...running, correct: 1 });
  player.setMuted(false);
  assert.equal(tracks.music.currentTime, 18);
  assert.equal(tracks.music.paused, false);
  assert.equal(tracks.correct.plays, 1);
  assert.equal(tracks.wrong.plays, 0);
  player.update({ ...running, status: "PAUSED" });
  player.setMuted(true);
  player.setMuted(false);
  assert.equal(tracks.music.paused, true);
});

import type { FallingWord, GameSession, GameState } from "../types";
export const FIELD_HEIGHT = 440;
export const DANGER_Y = 396;
export const SPAWN_HORIZONTAL_GAP = 16;
export const normalizeWord = (value: string) => value.trim().toLowerCase();
// Prefixes stay targeted while typing; fuzzy matches help recover from typos.
function inputMatchScore(word: string, input: string) {
  const text = normalizeWord(word);
  if (text === input) return 3;
  if (text.startsWith(input)) return 2;
  let previous = Array.from({ length: text.length + 1 }, (_, index) => index);
  for (let i = 1; i <= input.length; i++) {
    const current = [i];
    for (let j = 1; j <= text.length; j++)
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + (input[i - 1] === text[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return 1 - previous[text.length]! / Math.max(input.length, text.length);
}
export function findTypingTarget(
  words: FallingWord[],
  input: string,
): FallingWord | undefined {
  const normalized = normalizeWord(input);
  return words
    .filter((word) => word.status === "FALLING")
    .reduce<FallingWord | undefined>((best, word) => {
      if (!best) return word;
      const score = normalized ? inputMatchScore(word.word, normalized) : 0;
      const bestScore = normalized ? inputMatchScore(best.word, normalized) : 0;
      return score > bestScore || (score === bestScore && word.y > best.y)
        ? word
        : best;
    }, undefined);
}
export class TypingRushEngine {
  private width: number;
  private serial = 0;
  private wordsSinceHeart = 0;
  private pendingHearts = 0;
  private spawnIn = 0;
  private errorUntil = 0;
  private state: GameState;
  constructor(
    private readonly session: GameSession,
    width = 800,
    private readonly random: () => number = Math.random,
  ) {
    this.session = {
      ...session,
      config: { ...session.config },
      words: session.words.map((word) => ({ ...word })),
    };
    this.width = Math.max(240, width);
    this.state = {
      wordsUntilHeart: this.session.config.heartEveryWords ?? 20,
      heartPending: false,
      status: "RUNNING",
      words: [],
      meanings: [],
      effects: [],
      score: 0,
      combo: 0,
      bestCombo: 0,
      lives: session.config.lives,
      level: 1,
      elapsed: 0,
      correct: 0,
      wordsAppeared: 0,
      inputError: false,
    };
  }
  snapshot(): GameState {
    return {
      ...this.state,
      heartPending: this.pendingHearts > 0,
      words: this.state.words.map((w) => ({ ...w })),
      effects: [...this.state.effects],
      meanings: this.state.meanings.map((notice) => ({ ...notice })),
    };
  }
  resize(width: number) {
    this.width = Math.max(240, width);
    for (const word of this.state.words) {
      word.width = this.wordWidth(word.word, word.kind);
      word.x = Math.max(12, Math.min(word.x, this.width - word.width - 12));
    }
  }
  private wordWidth(word: string, kind = "NORMAL") {
    return Math.min(
      this.width - 24,
      Math.max(160, word.length * 9.6 + 32 + (kind === "HEART" ? 24 : 0)),
    );
  }
  private spawn() {
    const choices = this.session.words.filter(
      (item) =>
        !this.state.words.some(
          (w) => normalizeWord(w.word) === normalizeWord(item.word),
        ),
    );
    if (!choices.length || this.state.words.length >= 8) return false;
    const chosen = choices[Math.floor(this.random() * choices.length)]!;
    const kind = this.pendingHearts > 0 ? "HEART" : "NORMAL";
    const width = this.wordWidth(chosen.word, kind);
    let x = 12,
      found = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      x = 12 + this.random() * Math.max(0, this.width - width - 24);
      if (
        !this.state.words.some(
          (w) =>
            w.y < 50 &&
            x < w.x + w.width + SPAWN_HORIZONTAL_GAP &&
            x + width + SPAWN_HORIZONTAL_GAP > w.x,
        )
      ) {
        found = true;
        break;
      }
    }
    if (!found) return false;
    const every = this.session.config.heartEveryWords ?? 20;
    if (kind === "HEART") {
      this.pendingHearts--;
      this.wordsSinceHeart = 0;
      this.state.wordsUntilHeart = every;
    } else {
      this.wordsSinceHeart++;
      this.state.wordsUntilHeart = Math.max(0, every - this.wordsSinceHeart);
      if (this.wordsSinceHeart >= every) this.pendingHearts++;
    }
    this.state.words.push({
      kind,
      instanceId: String(++this.serial),
      wordId: chosen.id,
      word: chosen.word,
      meaning: chosen.meaning,
      x,
      y: 0,
      width,
      speed: this.session.config.initialFallSpeed,
      spawnedAt: this.state.elapsed,
      status: "FALLING",
    });
    this.state.wordsAppeared++;
    return true;
  }
  advance(delta: number) {
    if (this.state.status !== "RUNNING") return;
    const dt = Math.max(0, Math.min(100, delta));
    this.state.elapsed += dt;
    this.state.meanings = this.state.meanings.filter(
      (notice) => notice.until > this.state.elapsed,
    );
    this.state.level = 1 + Math.floor(this.state.elapsed / 20000);
    const multiplier = Math.min(2.5, 1 + (this.state.level - 1) * 0.15);
    for (const word of this.state.words)
      word.y += (word.speed * multiplier * dt) / 1000;
    const missed = this.state.words.filter((w) => w.y >= DANGER_Y);
    if (missed.length) {
      for (const w of missed) w.status = "MISSED";
      const missedRegular = missed.filter(
        (word) => word.kind !== "HEART",
      ).length;
      this.state.lives = Math.max(0, this.state.lives - missedRegular);
      if (missedRegular) this.state.combo = 0;
    }
    this.state.words = this.state.words.filter((w) => w.status === "FALLING");
    this.state.effects = this.state.effects.filter(
      (e) => e.until > this.state.elapsed,
    );
    this.state.inputError = this.state.elapsed < this.errorUntil;
    if (this.state.lives === 0) {
      this.state.status = "FINISHED";
      return;
    }
    this.spawnIn -= dt;
    if (this.spawnIn <= 0)
      this.spawnIn = this.spawn()
        ? Math.max(150, this.session.config.spawnInterval / multiplier)
        : 100;
  }
  submit(input: string) {
    if (this.state.status !== "RUNNING" || !normalizeWord(input)) return false;
    const target = this.state.words
      .filter((w) => normalizeWord(w.word) === normalizeWord(input))
      .sort((a, b) => b.y - a.y)[0];
    if (!target) {
      this.state.combo = 0;
      this.errorUntil = this.state.elapsed + 350;
      this.state.inputError = true;
      return false;
    }
    target.status = "DESTROYED";
    this.state.meanings.push({
      id: target.instanceId,
      word: target.word,
      meaning: target.meaning ?? "",
      x: target.x,
      y: target.y,
      width: target.width,
      until:
        this.state.elapsed +
        (this.session.config.meaningDurationSeconds ?? 3) * 1000,
    });
    this.state.combo++;
    this.state.correct++;
    let restoredLives = 0;
    if (target.kind === "HEART") {
      const before = this.state.lives;
      this.state.lives = Math.min(
        this.session.config.maxLives ?? this.session.config.lives,
        before + 1,
      );
      restoredLives = this.state.lives - before;
    }
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);
    const points = 100 + Math.min(100, (this.state.combo - 1) * 5);
    this.state.score = Math.min(10_000_000, this.state.score + points);
    this.state.effects.push({
      restoredLives,
      id: target.instanceId,
      x: target.x,
      y: target.y,
      points,
      until: this.state.elapsed + 650,
    });
    this.state.words = this.state.words.filter(
      (w) => w.instanceId !== target.instanceId,
    );
    this.errorUntil = 0;
    this.state.inputError = false;
    return true;
  }
  pause() {
    if (this.state.status === "RUNNING") this.state.status = "PAUSED";
  }
  resume() {
    if (this.state.status === "PAUSED") this.state.status = "RUNNING";
  }
}

import type { GameSession, GameState, GameWord } from "../types";
export class WordShooterEngine {
  private readonly pool: GameWord[];
  private readonly config: GameSession["config"];
  private state: GameState;
  constructor(
    session: GameSession,
    private readonly random: () => number = Math.random,
  ) {
    this.config = { ...session.config };
    this.pool = session.words.map((word) => ({ ...word }));
    if (
      this.pool.length < this.config.wordsPerRound ||
      this.config.wordsPerRound < 2
    )
      throw new Error("WORD_SHOOTER_MIN_WORDS");
    this.state = {
      status: "RUNNING",
      remainingMs: 0,
      score: 0,
      correct: 0,
      wrong: 0,
      round: 0,
      target: this.pool[0]!,
      options: [],
      feedback: null,
      feedbackMs: 0,
    };
    this.nextRound();
  }
  private shuffle<T>(items: T[]) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }
  private nextRound() {
    const eligible = this.pool.filter(
      (word) => this.state.round === 0 || word.id !== this.state.target.id,
    );
    const target = eligible[Math.floor(this.random() * eligible.length)]!;
    const others = this.shuffle(
      this.pool.filter((word) => word.id !== target.id),
    ).slice(0, this.config.wordsPerRound - 1);
    this.state.target = target;
    this.state.options = this.shuffle([target, ...others]);
    this.state.round++;
    this.state.remainingMs = this.config.roundDurationSeconds * 1000;
  }
  snapshot(): GameState {
    return {
      ...this.state,
      target: { ...this.state.target },
      options: this.state.options.map((word) => ({ ...word })),
    };
  }
  advance(delta: number) {
    if (this.state.status !== "RUNNING") return;
    const dt = Math.max(0, delta);
    this.state.remainingMs = Math.max(0, this.state.remainingMs - dt);
    this.state.feedbackMs = Math.max(0, this.state.feedbackMs - dt);
    if (!this.state.feedbackMs) {
      this.state.feedback = null;
      this.state.shotId = undefined;
    }
    if (!this.state.remainingMs) this.state.status = "FINISHED";
  }
  shoot(id: string, round: number) {
    if (
      this.state.status !== "RUNNING" ||
      round !== this.state.round ||
      !this.state.options.some((word) => word.id === id)
    )
      return false;
    this.state.shotId = id;
    this.state.feedbackMs = 450;
    if (id === this.state.target.id) {
      this.state.score = Math.min(10000000, this.state.score + 100);
      this.state.correct++;
      this.nextRound();
      this.state.feedback = "correct";
      return true;
    }
    this.state.wrong++;
    this.state.feedback = "wrong";
    this.state.remainingMs = Math.max(
      0,
      this.state.remainingMs - this.config.wrongShotPenaltySeconds * 1000,
    );
    if (!this.state.remainingMs) this.state.status = "FINISHED";
    return false;
  }
  pause() {
    if (this.state.status === "RUNNING") this.state.status = "PAUSED";
  }
  resume() {
    if (this.state.status === "PAUSED") this.state.status = "RUNNING";
  }
}

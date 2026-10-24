import type { GameAudioSettings } from "./audio-settings";

type Progress = {
  status: "RUNNING" | "PAUSED" | "FINISHED";
  correct: number;
  wrong?: number;
  lost?: boolean;
};
type AudioKey = Exclude<keyof GameAudioSettings, "audioEnabled">;
type AudioFactory = (url: string) => HTMLAudioElement;

// Own every audio element so leaving a game stops music and effects together.
export class GameAudio {
  private tracks: Partial<Record<AudioKey, HTMLAudioElement>> = {};
  private muted = false;
  private previous: Progress = { status: "PAUSED", correct: 0, wrong: 0 };
  constructor(
    settings: GameAudioSettings,
    create: AudioFactory = (url) => new Audio(url),
  ) {
    if (settings.audioEnabled === false) return;
    for (const key of [
      "backgroundMusicUrl",
      "correctSoundUrl",
      "wrongSoundUrl",
      "loseSoundUrl",
    ] as const) {
      const url = settings[key];
      if (!url) continue;
      const track = create(url);
      track.preload = "none";
      track.loop = key === "backgroundMusicUrl";
      track.volume = track.loop ? 0.3 : 0.7;
      this.tracks[key] = track;
    }
  }
  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    for (const track of Object.values(this.tracks)) {
      track.muted = muted;
      if (muted) track.pause();
    }
    if (!muted) this.unlock();
  }
  private play(track?: HTMLAudioElement) {
    if (track && !this.muted)
      void track.play().catch(() => {
        /* Retry music on the next user gesture. */
      });
  }
  unlock() {
    const music = this.tracks.backgroundMusicUrl;
    if (this.previous.status === "RUNNING" && music?.paused) this.play(music);
  }
  answer(correct: boolean) {
    if (
      this.previous.status === "RUNNING" ||
      (correct &&
        this.previous.status === "FINISHED" &&
        this.previous.lost === false)
    )
      this.effect(correct ? "correctSoundUrl" : "wrongSoundUrl");
  }
  wrong() {
    if (this.previous.status === "RUNNING") this.effect("wrongSoundUrl");
  }
  private effect(key: AudioKey) {
    const track = this.tracks[key];
    if (!track || this.muted) return;
    track.currentTime = 0;
    this.play(track);
  }
  update(next: Progress) {
    const previous = this.previous;
    this.previous = { ...next };
    if (next.status !== previous.status) {
      if (next.status === "RUNNING") this.unlock();
      else {
        for (const track of Object.values(this.tracks)) track.pause();
      }
    }
    if (next.status === "FINISHED") {
      if (previous.status !== "FINISHED" && next.lost !== false)
        this.effect("loseSoundUrl");
      return;
    }
    if (next.status !== "RUNNING") return;
    if (next.correct > previous.correct) this.effect("correctSoundUrl");
    else if ((next.wrong ?? 0) > (previous.wrong ?? 0)) this.wrong();
  }
  dispose() {
    for (const track of Object.values(this.tracks)) {
      track.pause();
      track.removeAttribute("src");
      track.load();
    }
    this.tracks = {};
  }
}

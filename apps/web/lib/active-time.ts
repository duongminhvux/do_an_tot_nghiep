import {
  ACTIVE_TIME_IDLE_MS,
  ACTIVE_TIME_MAX_SLICE_MS,
} from "@repo/shared-types/active-time";

/** Monotonic, foreground-only activity meter. It never infers activity from a timer. */
export class ActiveTimeMeter {
  private sampledAt: number;
  private interactedAt = Number.NEGATIVE_INFINITY;
  private foreground: boolean;
  private pendingMs = 0;
  totalMs = 0;

  constructor(now: number, foreground: boolean) {
    this.sampledAt = now;
    this.foreground = foreground;
  }

  sample(now: number) {
    const elapsed = now - this.sampledAt;
    if (
      this.foreground &&
      elapsed >= 0 &&
      elapsed <= ACTIVE_TIME_MAX_SLICE_MS
    ) {
      const activeMs = Math.max(
        0,
        Math.min(now, this.interactedAt + ACTIVE_TIME_IDLE_MS) - this.sampledAt,
      );
      this.pendingMs = Math.min(
        ACTIVE_TIME_MAX_SLICE_MS,
        this.pendingMs + activeMs,
      );
      this.totalMs += activeMs;
    }
    // A suspended timer, sleeping device, or clock jump cannot create a long interval.
    this.sampledAt = now;
  }

  interact(now: number) {
    this.sample(now);
    if (this.foreground) this.interactedAt = now;
  }

  setForeground(now: number, foreground: boolean) {
    this.sample(now);
    if (this.foreground !== foreground)
      this.interactedAt = Number.NEGATIVE_INFINITY;
    this.foreground = foreground;
  }

  take(now: number) {
    this.sample(now);
    const activeMs = Math.floor(this.pendingMs);
    this.pendingMs -= activeMs;
    return activeMs;
  }
}

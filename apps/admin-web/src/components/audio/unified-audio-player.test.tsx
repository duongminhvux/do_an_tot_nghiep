import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnifiedAudioPlayer } from "./unified-audio-player";

describe("Admin UnifiedAudioPlayer", () => {
  const play = vi.fn<() => Promise<void>>();
  const pause = vi.fn();

  beforeEach(() => {
    play.mockReset();
    pause.mockReset();
    play.mockResolvedValue();
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: play,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: pause,
    });
  });

  it("plays the provided media URL", async () => {
    const { container } = render(
      <UnifiedAudioPlayer sourceUrl="/media/preview.wav" />,
    );
    expect(container.querySelector("audio")).toHaveAttribute(
      "src",
      "/media/preview.wav",
    );
    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  });

  it("shows an unavailable state after playback fails", async () => {
    play.mockRejectedValueOnce(new Error("decode failed"));
    render(<UnifiedAudioPlayer sourceUrl="/media/broken.wav" />);
    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));
    expect(await screen.findByText("Audio is unavailable")).toBeInTheDocument();
  });

  it("replays without toggling a playing audio element to pause", async () => {
    render(<UnifiedAudioPlayer sourceUrl="/media/preview.wav" />);
    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    const pausesBeforeReplay = pause.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Replay audio" }));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    expect(pause).toHaveBeenCalledTimes(pausesBeforeReplay);
  });
});

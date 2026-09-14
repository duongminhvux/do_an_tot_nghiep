import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnifiedAudioPlayer } from "./unified-audio-player";

describe("UnifiedAudioPlayer", () => {
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

  it("plays the source and consumes only after playback succeeds", async () => {
    const consume = vi.fn().mockResolvedValue(1);
    render(
      <UnifiedAudioPlayer
        id="test-audio"
        sourceUrl="/media/example.wav"
        duration={16}
        currentListenCount={0}
        maximumListenCount={3}
        onListenCountConsumed={consume}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));

    expect(play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(consume).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Playing")).toBeInTheDocument();
  });

  it("does not consume when playback rejects", async () => {
    play.mockRejectedValueOnce(new Error("media rejected"));
    const consume = vi.fn();
    render(
      <UnifiedAudioPlayer
        id="failed-audio"
        sourceUrl="/media/missing.wav"
        currentListenCount={0}
        maximumListenCount={3}
        onListenCountConsumed={consume}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));

    expect(await screen.findByText("Audio is unavailable")).toBeInTheDocument();
    expect(consume).not.toHaveBeenCalled();
  });

  it("shows an audio-load error and never consumes", () => {
    const consume = vi.fn();
    const { container } = render(
      <UnifiedAudioPlayer
        id="load-error"
        sourceUrl="/media/broken.wav"
        currentListenCount={0}
        maximumListenCount={3}
        onListenCountConsumed={consume}
      />,
    );

    fireEvent.error(container.querySelector("audio")!);

    expect(screen.getByText("Audio is unavailable")).toBeInTheDocument();
    expect(consume).not.toHaveBeenCalled();
  });

  it("disables playback at the listen limit", () => {
    render(
      <UnifiedAudioPlayer
        id="limited-audio"
        sourceUrl="/media/example.wav"
        currentListenCount={3}
        maximumListenCount={3}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));

    expect(screen.getByText("Listen limit reached")).toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
  });

  it("consumes one new listen when replay starts", async () => {
    const consume = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    render(
      <UnifiedAudioPlayer
        id="replay-audio"
        sourceUrl="/media/example.wav"
        currentListenCount={0}
        maximumListenCount={3}
        onListenCountConsumed={consume}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Play audio" }));
    await waitFor(() => expect(consume).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Replay audio" }));

    await waitFor(() => expect(consume).toHaveBeenCalledTimes(2));
    expect(play).toHaveBeenCalledTimes(2);
  });
});

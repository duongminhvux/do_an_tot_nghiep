import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProtectedMediaUrl } from "./use-protected-media-url";

const mocks = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock("./api/client", () => ({
  resolveUserMediaSource: (...args: unknown[]) => mocks.resolve(...args),
}));

function Probe({ source }: { source?: string }) {
  const media = useProtectedMediaUrl(source);
  return <span>{media.url ?? (media.loading ? "loading" : "empty")}</span>;
}

describe("useProtectedMediaUrl", () => {
  const revoke = vi.fn();

  beforeEach(() => {
    mocks.resolve.mockReset();
    revoke.mockReset();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revoke,
    });
  });

  it("revokes an owned blob URL when the consumer unmounts", async () => {
    mocks.resolve.mockResolvedValue({ url: "blob:user-audio", revoke: true });
    const view = render(<Probe source="/api/v1/media/files/audio-id" />);
    await screen.findByText("blob:user-audio");
    view.unmount();
    expect(revoke).toHaveBeenCalledWith("blob:user-audio");
  });

  it("revokes a late blob result after the consumer already unmounted", async () => {
    let complete!: (value: { url: string; revoke: boolean }) => void;
    mocks.resolve.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const view = render(<Probe source="/api/v1/media/files/audio-id" />);
    view.unmount();
    complete({ url: "blob:late-audio", revoke: true });
    await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:late-audio"));
  });
});

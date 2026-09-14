import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProtectedMediaUrl } from "./use-protected-media-url";

const mocks = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock("./api/client", () => ({
  resolveAdminMediaSource: (...args: unknown[]) => mocks.resolve(...args),
}));

function Probe({ source }: { source?: string }) {
  const media = useProtectedMediaUrl(source);
  return <span>{media.url ?? (media.loading ? "loading" : "empty")}</span>;
}

describe("admin useProtectedMediaUrl", () => {
  const revoke = vi.fn();

  beforeEach(() => {
    mocks.resolve.mockReset();
    revoke.mockReset();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revoke,
    });
  });

  it("revokes an owned preview URL on unmount", async () => {
    mocks.resolve.mockResolvedValue({ url: "blob:admin-preview", revoke: true });
    const view = render(<Probe source="/api/v1/media/files/image-id" />);
    await screen.findByText("blob:admin-preview");
    view.unmount();
    expect(revoke).toHaveBeenCalledWith("blob:admin-preview");
  });
});

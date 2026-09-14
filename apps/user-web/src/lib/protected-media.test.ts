import { BrowserApiTransport } from "@listenup/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api/errors";

describe("protected media transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("surfaces a stable authorization error instead of treating media as public", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "MEDIA_ACCESS_DENIED",
            message: "You are not allowed to access this media.",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    const transport = new BrowserApiTransport({
      baseUrl: "http://localhost/api/v1",
      clientType: "USER_WEB",
      storageKey: "test-session",
      createError: (payload) =>
        new ApiError(payload.code ?? "ERROR", payload.message ?? "Error"),
    });
    await expect(
      transport.requestBlob("/media/files/protected-id"),
    ).rejects.toMatchObject({ code: "MEDIA_ACCESS_DENIED" });
  });
});

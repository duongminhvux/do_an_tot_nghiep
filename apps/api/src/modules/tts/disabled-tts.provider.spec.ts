import { describe, expect, it } from "vitest";
import { AppException } from "../../common/errors/app.exception";
import { DisabledTtsProvider } from "./disabled-tts.provider";

describe("DisabledTtsProvider", () => {
  it("reports no voices and an unconfigured health state", async () => {
    const provider = new DisabledTtsProvider();
    await expect(provider.getVoices()).resolves.toEqual([]);
    await expect(provider.healthCheck()).resolves.toEqual({
      configured: false,
      healthy: false,
      provider: "none",
    });
  });

  it("never fabricates successful synthesis", async () => {
    const provider = new DisabledTtsProvider();
    await expect(
      provider.synthesize({
        text: "Hello",
        voiceId: "",
        language: "en-US",
        speed: 1,
      }),
    ).rejects.toMatchObject({
      code: "TTS_PROVIDER_NOT_CONFIGURED",
    } satisfies Partial<AppException>);
  });
});

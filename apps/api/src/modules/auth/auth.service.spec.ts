import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthClientType } from "../../generated/prisma/client";
import { AuthService } from "./auth.service";

vi.mock("argon2", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("new-password-hash"),
    verify: vi.fn(),
  },
}));

describe("AuthService password recovery", () => {
  const jwt = { signAsync: vi.fn() };
  const config = {
    get: vi.fn((key: string) => (key === "NODE_ENV" ? "production" : undefined)),
    getOrThrow: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it("does not disclose or create a token for an unknown email", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      passwordResetToken: { create: vi.fn() },
    };
    const service = new AuthService(prisma as never, jwt as never, config as never);
    await expect(service.forgotPassword("missing@test.local")).resolves.toBeUndefined();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("creates a hashed reset token for a valid request", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: "user-id" }) },
      passwordResetToken: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new AuthService(prisma as never, jwt as never, config as never);
    await service.forgotPassword("student@test.local");
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-id",
        tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        expiresAt: expect.any(Date),
      }),
    });
  });

  it.each([
    [null, "invalid"],
    [
      {
        id: "token-id",
        userId: "user-id",
        usedAt: null,
        expiresAt: new Date(0),
      },
      "expired",
    ],
  ])("rejects an %s reset token", async (record, _label) => {
    const prisma = {
      passwordResetToken: { findUnique: vi.fn().mockResolvedValue(record) },
    };
    const service = new AuthService(prisma as never, jwt as never, config as never);
    await expect(
      service.resetPassword({ token: "bad-token", newPassword: "NewPassword1!" }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("updates the password, consumes the token, and revokes refresh sessions", async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue({
          id: "token-id",
          userId: "user-id",
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      user: { update: vi.fn().mockResolvedValue({}) },
      refreshSession: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    const service = new AuthService(prisma as never, jwt as never, config as never);
    await service.resetPassword({
      token: "valid-token",
      newPassword: "NewPassword1!",
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-id" },
      data: { passwordHash: "new-password-hash" },
    });
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-id", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("rejects an old refresh session after it has been revoked", async () => {
    const prisma = {
      refreshSession: {
        findUnique: vi.fn().mockResolvedValue({
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          clientType: AuthClientType.USER_WEB,
          user: {},
        }),
      },
    };
    const service = new AuthService(prisma as never, jwt as never, config as never);
    await expect(
      service.refresh(AuthClientType.USER_WEB, "old-refresh-token"),
    ).rejects.toMatchObject({ status: 401 });
  });
});

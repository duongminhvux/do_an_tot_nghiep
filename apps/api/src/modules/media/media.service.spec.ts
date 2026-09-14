import { describe, expect, it, vi } from "vitest";
import {
  ContentStatus,
  CourseVisibility,
  MediaStatus,
  MediaStorageProvider,
  MediaType,
  UserRole,
} from "../../generated/prisma/client";
import { MediaService } from "./media.service";

const admin = {
  id: "admin-id",
  email: "admin@test.local",
  role: UserRole.ADMIN,
  clientType: "ADMIN_WEB" as const,
};
const wav = (name = "audio.wav", size = 12) =>
  ({
    originalname: name,
    mimetype: "audio/wav",
    size,
    buffer: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(Math.max(0, size - 4))]),
  }) as Express.Multer.File;
const record = {
  id: "media-id",
  originalName: "audio.wav",
  mimeType: "audio/wav",
  type: MediaType.AUDIO,
  sizeBytes: 12n,
  durationMs: null,
  status: MediaStatus.ACTIVE,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  storageProvider: MediaStorageProvider.LOCAL,
};

const protectedRecord = (overrides: Record<string, unknown> = {}) => ({
  ...record,
  storageKey: "audio/media-id.wav",
  uploadedById: "uploader-id",
  avatarForUsers: [],
  courseThumbnails: [],
  lessonCovers: [],
  lessonResources: [],
  exerciseFinalAudio: [
    {
      status: ContentStatus.PUBLISHED,
      lesson: {
        status: ContentStatus.PUBLISHED,
        course: {
          id: "course-id",
          status: ContentStatus.PUBLISHED,
          visibility: CourseVisibility.PRIVATE,
        },
      },
    },
  ],
  groupImages: [],
  groupSharedAudio: [],
  questionImages: [],
  audioSegments: [],
  ttsOutputFor: null,
  siteLogoFor: [],
  siteFaviconFor: [],
  ...overrides,
});

describe("MediaService validation and archive safety", () => {
  it("accepts a signed WAV and stores it under a generated safe key", async () => {
    const prisma = {
      mediaFile: { create: vi.fn().mockResolvedValue(record) },
    };
    const storage = { put: vi.fn() };
    const service = new MediaService(
      prisma as never,
      { get: vi.fn().mockReturnValue(25) } as never,
      storage as never,
    );

    await expect(service.upload(admin, wav("../../unsafe.wav"))).resolves.toMatchObject({
      id: "media-id",
      sizeBytes: 12,
    });
    const key = storage.put.mock.calls[0][0] as string;
    expect(key).toMatch(/^audio\/[0-9a-f-]+\.wav$/);
    expect(key).not.toContain("unsafe");
  });

  it("rejects mismatched MIME, extension, or signature", async () => {
    const service = new MediaService(
      {} as never,
      { get: vi.fn().mockReturnValue(25) } as never,
      { put: vi.fn() } as never,
    );
    const invalid = {
      ...wav("audio.mp3"),
      mimetype: "audio/wav",
    } as Express.Multer.File;

    await expect(service.upload(admin, invalid)).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA",
      status: 415,
    });
  });

  it("rejects files above the configured size limit", async () => {
    const service = new MediaService(
      {} as never,
      { get: vi.fn().mockReturnValue(0.000001) } as never,
      { put: vi.fn() } as never,
    );

    await expect(service.upload(admin, wav())).rejects.toMatchObject({
      code: "FILE_TOO_LARGE",
      status: 413,
    });
  });

  it("archives an unused media record", async () => {
    const prisma = {
      mediaFile: {
        findUnique: vi.fn().mockResolvedValue({
          uploadedById: admin.id,
          _count: {
            avatarForUsers: 0,
            courseThumbnails: 0,
            lessonCovers: 0,
            lessonResources: 0,
            exerciseFinalAudio: 0,
            groupImages: 0,
            groupSharedAudio: 0,
            questionImages: 0,
            audioSegments: 0,
            siteLogoFor: 0,
            siteFaviconFor: 0,
          },
          ttsOutputFor: null,
        }),
        update: vi.fn().mockResolvedValue({
          ...record,
          status: MediaStatus.ARCHIVED,
        }),
      },
    };
    const service = new MediaService(
      prisma as never,
      { get: vi.fn() } as never,
      {} as never,
    );

    await expect(service.archive(admin, "media-id")).resolves.toMatchObject({
      status: MediaStatus.ARCHIVED,
    });
  });

  it("rejects archiving media referenced by published content", async () => {
    const prisma = {
      mediaFile: {
        findUnique: vi.fn().mockResolvedValue({
          uploadedById: "admin-id",
          _count: {
            avatarForUsers: 0,
            courseThumbnails: 1,
            lessonCovers: 0,
            lessonResources: 0,
            exerciseFinalAudio: 0,
            groupImages: 0,
            groupSharedAudio: 0,
            questionImages: 0,
            audioSegments: 0,
            siteLogoFor: 0,
            siteFaviconFor: 0,
          },
          ttsOutputFor: null,
        }),
        update: vi.fn(),
      },
    };
    const service = new MediaService(
      prisma as never,
      { get: vi.fn() } as never,
      {} as never,
    );
    await expect(service.archive(admin, "media-id")).rejects.toMatchObject({
      code: "MEDIA_IN_USE",
      status: 409,
    });
    expect(prisma.mediaFile.update).not.toHaveBeenCalled();
  });

  it("allows anonymous access only to explicitly public media", async () => {
    const prisma = {
      mediaFile: {
        findFirst: vi.fn().mockResolvedValue(
          protectedRecord({
            exerciseFinalAudio: [],
            courseThumbnails: [
              {
                id: "course-id",
                status: ContentStatus.PUBLISHED,
                visibility: CourseVisibility.PUBLIC,
              },
            ],
          }),
        ),
      },
    };
    const service = new MediaService(
      prisma as never,
      {} as never,
      { path: vi.fn().mockReturnValue("internal-path") } as never,
    );
    await expect(service.publicFile("media-id")).resolves.toMatchObject({
      media: { id: "media-id" },
    });

    prisma.mediaFile.findFirst.mockResolvedValue(protectedRecord());
    await expect(service.publicFile("media-id")).rejects.toMatchObject({
      code: "MEDIA_NOT_FOUND",
      status: 404,
    });
  });

  it.each([
    [true, "enrolled student"],
    [false, "unauthorized student"],
  ])("enforces course access for an %s", async (allowed) => {
    const prisma = {
      mediaFile: { findFirst: vi.fn().mockResolvedValue(protectedRecord()) },
      course: {
        findFirst: vi
          .fn()
          .mockResolvedValue(allowed ? { id: "course-id" } : null),
      },
    };
    const service = new MediaService(
      prisma as never,
      {} as never,
      { path: vi.fn().mockReturnValue("internal-path") } as never,
    );
    const action = service.protectedFile(
      { ...admin, id: "student-id", role: UserRole.STUDENT },
      "media-id",
    );
    if (allowed) {
      await expect(action).resolves.toMatchObject({ media: { id: "media-id" } });
    } else {
      await expect(action).rejects.toMatchObject({
        code: "MEDIA_ACCESS_DENIED",
        status: 403,
      });
    }
  });

  it.each([
    [true, "assigned teacher"],
    [false, "unrelated teacher"],
  ])("enforces assignment access for an %s", async (allowed) => {
    const prisma = {
      mediaFile: { findFirst: vi.fn().mockResolvedValue(protectedRecord()) },
      courseTeacherAssignment: {
        findFirst: vi
          .fn()
          .mockResolvedValue(allowed ? { courseId: "course-id" } : null),
      },
    };
    const service = new MediaService(
      prisma as never,
      {} as never,
      { path: vi.fn().mockReturnValue("internal-path") } as never,
    );
    const action = service.protectedFile(
      { ...admin, id: "teacher-id", role: UserRole.TEACHER },
      "media-id",
    );
    if (allowed) {
      await expect(action).resolves.toMatchObject({ media: { id: "media-id" } });
    } else {
      await expect(action).rejects.toMatchObject({
        code: "MEDIA_ACCESS_DENIED",
        status: 403,
      });
    }
  });

  it("allows an administrator to access protected media", async () => {
    const service = new MediaService(
      {
        mediaFile: { findFirst: vi.fn().mockResolvedValue(protectedRecord()) },
      } as never,
      {} as never,
      { path: vi.fn().mockReturnValue("internal-path") } as never,
    );
    await expect(
      service.protectedFile(admin, "media-id"),
    ).resolves.toMatchObject({ media: { id: "media-id" } });
  });
});

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { AppException } from "../../common/errors/app.exception";
import {
  AssignmentStatus,
  ContentStatus,
  CourseVisibility,
  EnrollmentStatus,
  MediaStatus,
  MediaStorageProvider,
  MediaType,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";
import { STORAGE_SERVICE, type StorageService } from "./storage.service";

const allowed = new Map<string, { type: MediaType; extensions: string[] }>([
  ["image/jpeg", { type: MediaType.IMAGE, extensions: [".jpg", ".jpeg"] }],
  ["image/png", { type: MediaType.IMAGE, extensions: [".png"] }],
  ["image/webp", { type: MediaType.IMAGE, extensions: [".webp"] }],
  ["image/gif", { type: MediaType.IMAGE, extensions: [".gif"] }],
  ["audio/mpeg", { type: MediaType.AUDIO, extensions: [".mp3"] }],
  ["audio/wav", { type: MediaType.AUDIO, extensions: [".wav"] }],
  ["audio/x-wav", { type: MediaType.AUDIO, extensions: [".wav"] }],
  ["audio/ogg", { type: MediaType.AUDIO, extensions: [".ogg"] }],
  ["audio/mp4", { type: MediaType.AUDIO, extensions: [".m4a"] }],
  ["video/mp4", { type: MediaType.VIDEO, extensions: [".mp4"] }],
  ["video/webm", { type: MediaType.VIDEO, extensions: [".webm"] }],
  ["application/pdf", { type: MediaType.DOCUMENT, extensions: [".pdf"] }],
]);

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async upload(user: AuthenticatedUser, file?: Express.Multer.File) {
    if (!file)
      throw new AppException("FILE_REQUIRED", "A file is required.", 422);
    const max =
      (this.config.get<number>("MAX_UPLOAD_SIZE_MB") ?? 25) * 1024 * 1024;
    if (file.size > max) {
      throw new AppException(
        "FILE_TOO_LARGE",
        "The uploaded file exceeds the size limit.",
        413,
      );
    }
    const rule = allowed.get(file.mimetype.toLowerCase());
    const extension = extname(file.originalname).toLowerCase();
    if (
      !rule ||
      !rule.extensions.includes(extension) ||
      !this.magicMatches(file.buffer, file.mimetype)
    ) {
      throw new AppException(
        "UNSUPPORTED_MEDIA",
        "File MIME type, extension, or signature is not allowed.",
        415,
      );
    }
    const key = `${rule.type.toLowerCase()}/${randomUUID()}${extension}`;
    await this.storage.put(key, file.buffer);
    const media = await this.prisma.mediaFile.create({
      data: {
        storageKey: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        type: rule.type,
        storageProvider: MediaStorageProvider.LOCAL,
        sizeBytes: file.size,
        checksumSha256: createHash("sha256").update(file.buffer).digest("hex"),
        uploadedById: user.id,
      },
    });
    return this.present(media);
  }

  async storeGeneratedAudio(
    uploadedById: string,
    contents: Buffer,
    options: { durationMs?: number; originalName?: string } = {},
  ) {
    if (!contents.length) {
      throw new AppException(
        "EMPTY_GENERATED_AUDIO",
        "The TTS provider returned an empty audio file.",
        502,
      );
    }
    const id = randomUUID();
    const key = `audio/tts-${id}.wav`;
    await this.storage.put(key, contents);
    try {
      const media = await this.prisma.mediaFile.create({
        data: {
          storageKey: key,
          originalName: options.originalName ?? `tts-${id}.wav`,
          mimeType: "audio/wav",
          type: MediaType.AUDIO,
          storageProvider: MediaStorageProvider.LOCAL,
          sizeBytes: contents.length,
          durationMs: options.durationMs,
          checksumSha256: createHash("sha256").update(contents).digest("hex"),
          uploadedById,
          metadata: { source: "TTS" },
        },
      });
      return this.present(media);
    } catch (error) {
      await this.storage.remove(key);
      throw error;
    }
  }

  async list(user: AuthenticatedUser) {
    const media = await this.prisma.mediaFile.findMany({
      where:
        user.role === UserRole.TEACHER
          ? { uploadedById: user.id, status: MediaStatus.ACTIVE }
          : { status: MediaStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    return media.map((item) => this.present(item));
  }

  async publicFile(id: string) {
    const media = await this.mediaWithAccessRelations(id);
    if (!media || !this.isPublic(media)) {
      throw new AppException("MEDIA_NOT_FOUND", "Media file not found.", 404);
    }
    return { media, path: this.storage.path(media.storageKey) };
  }

  async protectedFile(user: AuthenticatedUser, id: string) {
    const media = await this.mediaWithAccessRelations(id);
    if (!media) {
      throw new AppException("MEDIA_NOT_FOUND", "Media file not found.", 404);
    }
    if (user.role === UserRole.ADMIN || this.isPublic(media)) {
      return { media, path: this.storage.path(media.storageKey) };
    }
    if (user.role === UserRole.TEACHER) {
      const courseIds = this.relatedCourseIds(media);
      const assignment = courseIds.length
        ? await this.prisma.courseTeacherAssignment.findFirst({
            where: {
              teacherId: user.id,
              courseId: { in: courseIds },
              status: AssignmentStatus.ACTIVE,
            },
            select: { courseId: true },
          })
        : null;
      if (assignment || media.uploadedById === user.id) {
        return { media, path: this.storage.path(media.storageKey) };
      }
    }
    if (user.role === UserRole.STUDENT) {
      const courseIds = this.publishedLearningCourseIds(media);
      const allowedCourse = courseIds.length
        ? await this.prisma.course.findFirst({
            where: {
              id: { in: courseIds },
              status: ContentStatus.PUBLISHED,
              OR: [
                { visibility: CourseVisibility.PUBLIC },
                {
                  enrollments: {
                    some: {
                      studentId: user.id,
                      status: { not: EnrollmentStatus.DROPPED },
                    },
                  },
                },
              ],
            },
            select: { id: true },
          })
        : null;
      if (
        allowedCourse ||
        media.avatarForUsers.some((owner) => owner.id === user.id)
      ) {
        return { media, path: this.storage.path(media.storageKey) };
      }
    }
    throw new AppException(
      "MEDIA_ACCESS_DENIED",
      "You are not allowed to access this media.",
      403,
    );
  }

  private mediaWithAccessRelations(id: string) {
    return this.prisma.mediaFile.findFirst({
      where: { id, status: MediaStatus.ACTIVE },
      include: {
        avatarForUsers: { select: { id: true } },
        courseThumbnails: {
          select: { id: true, status: true, visibility: true },
        },
        lessonCovers: {
          select: {
            status: true,
            course: { select: { id: true, status: true, visibility: true } },
          },
        },
        lessonResources: {
          select: {
            lesson: {
              select: {
                status: true,
                course: {
                  select: { id: true, status: true, visibility: true },
                },
              },
            },
          },
        },
        exerciseFinalAudio: {
          select: {
            status: true,
            lesson: {
              select: {
                status: true,
                course: {
                  select: { id: true, status: true, visibility: true },
                },
              },
            },
          },
        },
        groupImages: {
          select: {
            exercise: {
              select: {
                status: true,
                lesson: {
                  select: {
                    status: true,
                    course: {
                      select: { id: true, status: true, visibility: true },
                    },
                  },
                },
              },
            },
          },
        },
        groupSharedAudio: {
          select: {
            exercise: {
              select: {
                status: true,
                lesson: {
                  select: {
                    status: true,
                    course: {
                      select: { id: true, status: true, visibility: true },
                    },
                  },
                },
              },
            },
          },
        },
        questionImages: {
          select: {
            exercise: {
              select: {
                status: true,
                lesson: {
                  select: {
                    status: true,
                    course: {
                      select: { id: true, status: true, visibility: true },
                    },
                  },
                },
              },
            },
          },
        },
        audioSegments: {
          select: {
            exercise: {
              select: {
                status: true,
                lesson: {
                  select: {
                    status: true,
                    course: {
                      select: { id: true, status: true, visibility: true },
                    },
                  },
                },
              },
            },
          },
        },
        ttsOutputFor: {
          select: {
            exercise: {
              select: {
                lesson: { select: { courseId: true } },
              },
            },
          },
        },
        siteLogoFor: { select: { id: true } },
        siteFaviconFor: { select: { id: true } },
      },
    });
  }

  async archive(user: AuthenticatedUser, id: string) {
    const media = await this.prisma.mediaFile.findUnique({
      where: { id },
      select: {
        uploadedById: true,
        _count: {
          select: {
            avatarForUsers: true,
            courseThumbnails: { where: { status: "PUBLISHED" } },
            lessonCovers: { where: { status: "PUBLISHED" } },
            lessonResources: {
              where: { lesson: { status: "PUBLISHED" } },
            },
            exerciseFinalAudio: { where: { status: "PUBLISHED" } },
            groupImages: {
              where: { exercise: { status: "PUBLISHED" } },
            },
            groupSharedAudio: {
              where: { exercise: { status: "PUBLISHED" } },
            },
            questionImages: {
              where: { exercise: { status: "PUBLISHED" } },
            },
            audioSegments: {
              where: { exercise: { status: "PUBLISHED" } },
            },
            siteLogoFor: true,
            siteFaviconFor: true,
          },
        },
        ttsOutputFor: { select: { id: true } },
      },
    });
    if (!media)
      throw new AppException("MEDIA_NOT_FOUND", "Media file not found.", 404);
    if (user.role !== UserRole.ADMIN && media.uploadedById !== user.id) {
      throw new AppException(
        "MEDIA_ACCESS_DENIED",
        "You cannot archive this media.",
        403,
      );
    }
    const usedByPublishedContent =
      Object.values(media._count).some((count) => count > 0) ||
      media.ttsOutputFor !== null;
    if (usedByPublishedContent) {
      throw new AppException(
        "MEDIA_IN_USE",
        "This media is currently used by published content.",
        409,
      );
    }
    return this.prisma.mediaFile
      .update({
        where: { id },
        data: { status: MediaStatus.ARCHIVED, archivedAt: new Date() },
      })
      .then((item) => this.present(item));
  }

  writable() {
    return this.storage.writable();
  }

  private isPublic(
    media: NonNullable<Awaited<ReturnType<MediaService["mediaWithAccessRelations"]>>>,
  ): boolean {
    return (
      media.siteLogoFor.length > 0 ||
      media.siteFaviconFor.length > 0 ||
      media.courseThumbnails.some(
        (course) =>
          course.status === ContentStatus.PUBLISHED &&
          course.visibility === CourseVisibility.PUBLIC,
      )
    );
  }

  private relatedCourseIds(
    media: NonNullable<Awaited<ReturnType<MediaService["mediaWithAccessRelations"]>>>,
  ): string[] {
    return [
      ...media.courseThumbnails.map((course) => course.id),
      ...media.lessonCovers.map((item) => item.course.id),
      ...media.lessonResources.map((item) => item.lesson.course.id),
      ...media.exerciseFinalAudio.map((item) => item.lesson.course.id),
      ...media.groupImages.map((item) => item.exercise.lesson.course.id),
      ...media.groupSharedAudio.map((item) => item.exercise.lesson.course.id),
      ...media.questionImages.map((item) => item.exercise.lesson.course.id),
      ...media.audioSegments.map((item) => item.exercise.lesson.course.id),
      ...(media.ttsOutputFor?.exercise
        ? [media.ttsOutputFor.exercise.lesson.courseId]
        : []),
    ].filter((value, index, values) => values.indexOf(value) === index);
  }

  private publishedLearningCourseIds(
    media: NonNullable<Awaited<ReturnType<MediaService["mediaWithAccessRelations"]>>>,
  ): string[] {
    const lessonCourses = [
      ...media.lessonCovers
        .filter(
          (item) =>
            item.status === ContentStatus.PUBLISHED &&
            item.course.status === ContentStatus.PUBLISHED,
        )
        .map((item) => item.course.id),
      ...media.lessonResources
        .filter(
          (item) =>
            item.lesson.status === ContentStatus.PUBLISHED &&
            item.lesson.course.status === ContentStatus.PUBLISHED,
        )
        .map((item) => item.lesson.course.id),
    ];
    const exerciseCourses = [
      ...media.exerciseFinalAudio,
      ...media.groupImages.map((item) => item.exercise),
      ...media.groupSharedAudio.map((item) => item.exercise),
      ...media.questionImages.map((item) => item.exercise),
      ...media.audioSegments.map((item) => item.exercise),
    ]
      .filter(
        (item) =>
          item.status === ContentStatus.PUBLISHED &&
          item.lesson.status === ContentStatus.PUBLISHED &&
          item.lesson.course.status === ContentStatus.PUBLISHED,
      )
      .map((item) => item.lesson.course.id);
    return [...new Set([...lessonCourses, ...exerciseCourses])];
  }

  private present(media: {
    id: string;
    originalName: string;
    mimeType: string;
    type: MediaType;
    sizeBytes: bigint;
    durationMs: number | null;
    status: MediaStatus;
    createdAt: Date;
  }) {
    return {
      id: media.id,
      name: media.originalName,
      mimeType: media.mimeType,
      type: media.type,
      sizeBytes: Number(media.sizeBytes),
      durationMs: media.durationMs,
      status: media.status,
      url: `/api/v1/media/files/${media.id}`,
      createdAt: media.createdAt.toISOString(),
    };
  }

  private magicMatches(buffer: Buffer, mime: string): boolean {
    if (buffer.length < 4) return false;
    if (mime === "image/png")
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from("89504e470d0a1a0a", "hex"));
    if (mime === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8;
    if (mime === "image/gif") return buffer.subarray(0, 3).toString() === "GIF";
    if (mime === "image/webp")
      return buffer.subarray(8, 12).toString() === "WEBP";
    if (mime.includes("wav"))
      return buffer.subarray(0, 4).toString() === "RIFF";
    if (mime === "audio/ogg")
      return buffer.subarray(0, 4).toString() === "OggS";
    if (mime === "audio/mpeg") {
      return (
        buffer.subarray(0, 3).toString() === "ID3" ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
      );
    }
    if (mime.includes("mp4"))
      return buffer.subarray(4, 8).toString() === "ftyp";
    if (mime === "video/webm")
      return buffer.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex"));
    if (mime === "application/pdf")
      return buffer.subarray(0, 5).toString() === "%PDF-";
    return false;
  }
}

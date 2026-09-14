import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { AppException } from "../../common/errors/app.exception";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import {
  AudioSegmentType,
  AudioSource,
  ContentStatus,
  ExerciseType,
  ToeicPart,
  TtsJobStatus,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "../access/course-access.service";
import { ExerciseAccessService } from "../access/exercise-access.service";
import { MediaService } from "../media/media.service";
import type { GenerateAudioDto, UpdateTtsSettingsDto } from "./dto/tts.dto";
import {
  TTS_PROVIDER,
  type TtsProvider,
  type TtsSequenceRequest,
  type TtsSynthesisRequest,
} from "./tts-provider";

type TargetType = "EXERCISE" | "GROUP" | "SEGMENT";

type SynthesisPlan =
  | {
      targetType: "EXERCISE";
      inputText: string;
      request: TtsSynthesisRequest;
    }
  | {
      targetType: "GROUP";
      groupId: string;
      inputText: string;
      request: TtsSynthesisRequest | TtsSequenceRequest;
    }
  | {
      targetType: "SEGMENT";
      groupId?: string;
      audioSegmentId: string;
      inputText: string;
      request: TtsSynthesisRequest;
    };

@Injectable()
export class TtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseAccess: CourseAccessService,
    private readonly exerciseAccess: ExerciseAccessService,
    @Inject(TTS_PROVIDER) private readonly provider: TtsProvider,
    private readonly config: ConfigService,
    private readonly media: MediaService,
  ) {}

  async settings() {
    const setting = await this.prisma.ttsSetting.findUnique({
      where: { id: "default" },
    });
    const health = await this.provider.healthCheck();
    return {
      enabled: this.config.get<boolean>("TTS_ENABLED", false),
      provider: this.config.get<string>("TTS_PROVIDER", "none"),
      defaultLanguage: setting?.defaultLanguage ?? "en-US",
      defaultVoiceId: setting?.defaultVoiceId ?? "af_heart",
      defaultSpeed: Number(setting?.defaultSpeed ?? 1),
      providerConfigured: health.configured,
      providerHealthy: health.healthy,
      device: health.device,
      gpuName: health.gpuName,
      model: health.model,
      providerError: health.error,
    };
  }

  async updateSettings(input: UpdateTtsSettingsDto) {
    const enabled = this.config.get<boolean>("TTS_ENABLED", false);
    const provider = this.config.get<string>("TTS_PROVIDER", "none");
    if (input.enabled !== undefined && input.enabled !== enabled) {
      throw new AppException(
        "TTS_ENV_MANAGED",
        "TTS enabled/disabled state is managed by Docker environment variables.",
        409,
      );
    }
    if (input.provider && input.provider !== provider) {
      throw new AppException(
        "TTS_ENV_MANAGED",
        "The active TTS provider is managed by Docker environment variables.",
        409,
      );
    }
    await this.prisma.ttsSetting.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        enabled,
        provider,
        defaultLanguage: input.defaultLanguage ?? "en-US",
        defaultVoiceId: input.defaultVoiceId ?? "af_heart",
        defaultSpeed: input.defaultSpeed ?? 1,
      },
      update: {
        enabled,
        provider,
        defaultLanguage: input.defaultLanguage,
        defaultVoiceId: input.defaultVoiceId,
        defaultSpeed: input.defaultSpeed,
      },
    });
    return this.settings();
  }

  async voices() {
    const health = await this.provider.healthCheck();
    return {
      voices: health.healthy ? await this.provider.getVoices() : [],
      providerConfigured: health.configured,
      providerHealthy: health.healthy,
      provider: health.provider,
      device: health.device,
      gpuName: health.gpuName,
      error: health.error,
    };
  }

  status() {
    return this.provider.healthCheck();
  }

  async list(user: AuthenticatedUser) {
    const courseIds =
      user.role === UserRole.TEACHER
        ? await this.courseAccess.assignedCourseIds(user.id)
        : undefined;
    const jobs = await this.prisma.ttsJob.findMany({
      where: courseIds
        ? { exercise: { lesson: { courseId: { in: courseIds } } } }
        : {},
      include: { exercise: true, requestedBy: true, outputMedia: true },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    return jobs.map((job) => ({
      id: job.id,
      exerciseId: job.exerciseId ?? "",
      exerciseTitle: job.exercise?.title ?? "Deleted exercise",
      groupId: job.groupId ?? undefined,
      audioSegmentId: job.audioSegmentId ?? undefined,
      provider: job.provider,
      voice: job.voiceId,
      language: job.language,
      speed: Number(job.speed),
      status: job.status,
      createdBy: job.requestedBy?.fullName ?? "System",
      createdAt: job.createdAt.toISOString(),
      duration: job.outputMedia?.durationMs
        ? Math.ceil(job.outputMedia.durationMs / 1000)
        : undefined,
      errorCode: job.errorCode ?? undefined,
      errorMessage: job.errorMessage ?? undefined,
      retryCount: job.retryCount,
    }));
  }

  async detail(user: AuthenticatedUser, id: string) {
    const job = await this.prisma.ttsJob.findUnique({
      where: { id },
      include: {
        exercise: {
          select: {
            id: true,
            title: true,
            lesson: { select: { courseId: true } },
          },
        },
        group: { select: { id: true, title: true, label: true } },
        audioSegment: {
          select: { id: true, segmentType: true, speakerLabel: true },
        },
        requestedBy: { select: { id: true, fullName: true } },
        outputMedia: { select: { id: true, durationMs: true } },
      },
    });
    if (!job)
      throw new AppException("TTS_JOB_NOT_FOUND", "TTS job not found.", 404);
    if (user.role === UserRole.TEACHER && job.exercise) {
      await this.courseAccess.assertManage(user, job.exercise.lesson.courseId);
    }
    return {
      id: job.id,
      exerciseId: job.exerciseId,
      exercise: job.exercise
        ? { id: job.exercise.id, title: job.exercise.title }
        : null,
      group: job.group,
      audioSegment: job.audioSegment,
      status: job.status,
      provider: job.provider,
      voiceId: job.voiceId,
      language: job.language,
      speed: Number(job.speed),
      retryCount: job.retryCount,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      requestedBy: job.requestedBy,
      outputMedia: job.outputMedia,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    };
  }

  async generate(
    user: AuthenticatedUser,
    exerciseId: string,
    input: GenerateAudioDto,
  ) {
    await this.exerciseAccess.assertManage(user, exerciseId);
    await this.assertProviderReady();
    const exercise = await this.loadExercise(exerciseId);
    const defaults = await this.defaultSettings();
    const plan = this.buildPlan(exercise, input, defaults);
    const normalizedText = this.normalizeText(plan.inputText);
    const groupId =
      plan.targetType === "GROUP" || plan.targetType === "SEGMENT"
        ? plan.groupId
        : undefined;
    const audioSegmentId =
      plan.targetType === "SEGMENT" ? plan.audioSegmentId : undefined;
    const job = await this.prisma.ttsJob.create({
      data: {
        exerciseId,
        groupId,
        audioSegmentId,
        requestedById: user.id,
        provider: "kokoro",
        model: "Kokoro-82M",
        language:
          "defaultLanguage" in plan.request
            ? plan.request.defaultLanguage
            : plan.request.language,
        voiceId:
          "defaultVoiceId" in plan.request
            ? plan.request.defaultVoiceId
            : plan.request.voiceId,
        speed:
          "defaultSpeed" in plan.request
            ? plan.request.defaultSpeed
            : plan.request.speed,
        inputText: plan.inputText,
        normalizedText,
        inputHash: createHash("sha256").update(normalizedText).digest("hex"),
        status: TtsJobStatus.PENDING,
      },
    });
    return this.executeJob(user.id, job.id, plan);
  }

  async retry(user: AuthenticatedUser, id: string) {
    const job = await this.prisma.ttsJob.findUnique({ where: { id } });
    if (!job)
      throw new AppException("TTS_JOB_NOT_FOUND", "TTS job not found.", 404);
    if (!job.exerciseId)
      throw new AppException(
        "TTS_JOB_TARGET_MISSING",
        "The original exercise no longer exists.",
        409,
      );
    await this.exerciseAccess.assertManage(user, job.exerciseId);
    if (job.status !== TtsJobStatus.FAILED) {
      throw new AppException(
        "TTS_JOB_NOT_RETRYABLE",
        "Only failed TTS jobs can be retried.",
        409,
      );
    }
    await this.assertProviderReady();
    const exercise = await this.loadExercise(job.exerciseId);
    const defaults = await this.defaultSettings();
    const plan = this.buildPlan(
      exercise,
      {
        targetType: job.audioSegmentId
          ? "SEGMENT"
          : job.groupId
            ? "GROUP"
            : "EXERCISE",
        groupId: job.groupId ?? undefined,
        audioSegmentId: job.audioSegmentId ?? undefined,
        voiceId: job.voiceId,
        language: job.language,
        speed: Number(job.speed),
      },
      defaults,
    );
    const normalizedText = this.normalizeText(plan.inputText);
    await this.prisma.ttsJob.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
        status: TtsJobStatus.PENDING,
        progress: 0,
        inputText: plan.inputText,
        normalizedText,
        inputHash: createHash("sha256").update(normalizedText).digest("hex"),
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      },
    });
    await this.executeJob(user.id, id, plan);
    return this.detail(user, id);
  }

  private async executeJob(
    requestedById: string,
    jobId: string,
    plan: SynthesisPlan,
  ) {
    const groupId =
      plan.targetType === "GROUP" || plan.targetType === "SEGMENT"
        ? plan.groupId
        : undefined;
    const audioSegmentId =
      plan.targetType === "SEGMENT" ? plan.audioSegmentId : undefined;

    await this.prisma.ttsJob.update({
      where: { id: jobId },
      data: {
        status: TtsJobStatus.PROCESSING,
        progress: 10,
        startedAt: new Date(),
      },
    });
    if (audioSegmentId) {
      await this.prisma.exerciseAudioSegment.update({
        where: { id: audioSegmentId },
        data: { generationStatus: TtsJobStatus.PROCESSING },
      });
    }
    try {
      const generated =
        "segments" in plan.request
          ? await this.provider.synthesizeSequence(plan.request)
          : await this.provider.synthesize(plan.request);
      const media = await this.media.storeGeneratedAudio(
        requestedById,
        generated.audio,
        {
          durationMs: generated.durationMs,
          originalName: `kokoro-${jobId}.wav`,
        },
      );
      const currentJob = await this.prisma.ttsJob.findUniqueOrThrow({
        where: { id: jobId },
        select: { exerciseId: true },
      });
      await this.prisma.$transaction(async (tx) => {
        if (plan.targetType === "EXERCISE" && currentJob.exerciseId) {
          await tx.listeningExercise.update({
            where: { id: currentJob.exerciseId },
            data: {
              finalAudioMediaId: media.id,
              audioSource: AudioSource.TTS,
              status: ContentStatus.DRAFT,
              publishedAt: null,
            },
          });
        } else if (plan.targetType === "GROUP") {
          await tx.exerciseGroup.update({
            where: { id: plan.groupId },
            data: { sharedAudioMediaId: media.id },
          });
          if (currentJob.exerciseId) {
            await tx.listeningExercise.update({
              where: { id: currentJob.exerciseId },
              data: {
                audioSource: AudioSource.TTS,
                status: ContentStatus.DRAFT,
                publishedAt: null,
              },
            });
          }
        } else if (plan.targetType === "SEGMENT") {
          await tx.exerciseAudioSegment.update({
            where: { id: plan.audioSegmentId },
            data: {
              mediaId: media.id,
              generationStatus: TtsJobStatus.COMPLETED,
            },
          });
          if (currentJob.exerciseId) {
            await tx.listeningExercise.update({
              where: { id: currentJob.exerciseId },
              data: { status: ContentStatus.DRAFT, publishedAt: null },
            });
          }
        }
        await tx.ttsJob.update({
          where: { id: jobId },
          data: {
            status: TtsJobStatus.COMPLETED,
            progress: 100,
            outputMediaId: media.id,
            completedAt: new Date(),
            errorCode: null,
            errorMessage: null,
          },
        });
      });
      return {
        jobId,
        status: TtsJobStatus.COMPLETED,
        targetType: plan.targetType,
        groupId,
        audioSegmentId,
        outputMedia: {
          id: media.id,
          durationMs: media.durationMs,
          url: media.url,
        },
      };
    } catch (error) {
      const code =
        error instanceof AppException ? error.code : "TTS_GENERATION_FAILED";
      const message =
        error instanceof Error ? error.message : "TTS audio generation failed.";
      await this.prisma.ttsJob.update({
        where: { id: jobId },
        data: {
          status: TtsJobStatus.FAILED,
          progress: 0,
          errorCode: code,
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      if (audioSegmentId) {
        await this.prisma.exerciseAudioSegment.update({
          where: { id: audioSegmentId },
          data: { generationStatus: TtsJobStatus.FAILED },
        });
      }
      throw error;
    }
  }

  private async assertProviderReady() {
    if (!this.config.get<boolean>("TTS_ENABLED", false)) {
      throw new AppException(
        "TTS_PROVIDER_NOT_CONFIGURED",
        "Text-to-speech is disabled by configuration.",
        503,
      );
    }
    const health = await this.provider.healthCheck();
    if (!health.configured || !health.healthy) {
      throw new AppException(
        "TTS_PROVIDER_UNAVAILABLE",
        health.error || "The local Kokoro TTS service is not ready.",
        503,
      );
    }
  }

  private async defaultSettings() {
    const setting = await this.prisma.ttsSetting.findUnique({
      where: { id: "default" },
    });
    return {
      language: setting?.defaultLanguage ?? "en-US",
      voiceId: setting?.defaultVoiceId || "af_heart",
      speed: Number(setting?.defaultSpeed ?? 1),
    };
  }

  private loadExercise(exerciseId: string) {
    return this.prisma.listeningExercise.findUniqueOrThrow({
      where: { id: exerciseId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
          include: { options: { orderBy: { orderIndex: "asc" } } },
        },
        groups: {
          orderBy: { orderIndex: "asc" },
          include: {
            questions: {
              orderBy: { orderIndex: "asc" },
              include: { options: { orderBy: { orderIndex: "asc" } } },
            },
          },
        },
        audioSegments: { orderBy: { orderIndex: "asc" } },
      },
    });
  }

  private buildPlan(
    exercise: Awaited<ReturnType<TtsService["loadExercise"]>>,
    input: GenerateAudioDto,
    defaults: { language: string; voiceId: string; speed: number },
  ): SynthesisPlan {
    const targetType: TargetType =
      input.targetType ??
      (input.audioSegmentId ? "SEGMENT" : input.groupId ? "GROUP" : "EXERCISE");
    if (targetType === "EXERCISE") {
      if (exercise.type !== ExerciseType.DICTATION) {
        throw new AppException(
          "TTS_GROUP_REQUIRED",
          "TOEIC audio must be generated for a specific stimulus group.",
          422,
        );
      }
      const correctText = exercise.questions.find(
        (question) => question.correctText?.trim(),
      )?.correctText;
      const text =
        input.text?.trim() || exercise.sourceScript?.trim() || correctText?.trim();
      if (!text) {
        throw new AppException(
          "TTS_TEXT_REQUIRED",
          "Dictation requires a script before audio can be generated.",
          422,
        );
      }
      return {
        targetType,
        inputText: text,
        request: {
          text,
          voiceId: input.voiceId || defaults.voiceId,
          language: input.language || defaults.language,
          speed: input.speed ?? defaults.speed,
        },
      };
    }

    if (targetType === "SEGMENT") {
      const segment = exercise.audioSegments.find(
        (item) => item.id === input.audioSegmentId,
      );
      if (!segment) {
        throw new AppException(
          "TTS_SEGMENT_NOT_FOUND",
          "The requested audio segment does not belong to this exercise.",
          404,
        );
      }
      const text = input.text?.trim() || segment.text.trim();
      if (!text || segment.segmentType === AudioSegmentType.PAUSE) {
        throw new AppException(
          "TTS_TEXT_REQUIRED",
          "A speakable audio segment is required for segment generation.",
          422,
        );
      }
      return {
        targetType,
        audioSegmentId: segment.id,
        groupId: segment.groupId ?? undefined,
        inputText: text,
        request: {
          text,
          voiceId: input.voiceId || segment.voiceId || defaults.voiceId,
          language: input.language || segment.language || defaults.language,
          speed: input.speed ?? Number(segment.speed || defaults.speed),
        },
      };
    }

    if (exercise.type !== ExerciseType.TOEIC || !input.groupId) {
      throw new AppException(
        "TTS_GROUP_REQUIRED",
        "A TOEIC stimulus group is required for group audio generation.",
        422,
      );
    }
    const group = exercise.groups.find((item) => item.id === input.groupId);
    if (!group) {
      throw new AppException(
        "TTS_GROUP_NOT_FOUND",
        "The requested group does not belong to this exercise.",
        404,
      );
    }
    const groupSegments = exercise.audioSegments.filter(
      (segment) => segment.groupId === group.id,
    );
    if (groupSegments.length) {
      const assignedSpeakerVoices = new Map<string, string>();
      const sequence = groupSegments.map((segment, segmentIndex) => {
        const language = segment.language || defaults.language;
        let voiceId = segment.voiceId || undefined;
        if (!voiceId && segment.segmentType === AudioSegmentType.SPEAKER) {
          const speakerIdentity =
            segment.speakerKey?.trim() ||
            segment.speakerLabel?.trim() ||
            `speaker-${segmentIndex}`;
          const assignmentKey = `${language}:${speakerIdentity}`;
          voiceId = assignedSpeakerVoices.get(assignmentKey);
          if (!voiceId) {
            voiceId = this.automaticSpeakerVoice(
              language,
              segment.speakerLabel ?? segment.speakerKey ?? "",
              assignedSpeakerVoices.size,
            );
            assignedSpeakerVoices.set(assignmentKey, voiceId);
          }
        }
        return {
          text:
            segment.segmentType === AudioSegmentType.PAUSE
              ? ""
              : segment.text.trim(),
          voiceId,
          language,
          speed: Number(segment.speed),
          pauseAfterMs: segment.pauseAfterMs,
        };
      });
      if (!sequence.some((segment) => segment.text)) {
        throw new AppException(
          "TTS_TEXT_REQUIRED",
          "This group has no speakable audio segments.",
          422,
        );
      }
      const inputText = groupSegments
        .map((segment) => segment.text.trim())
        .filter(Boolean)
        .join("\n");
      return {
        targetType: "GROUP",
        groupId: group.id,
        inputText,
        request: {
          segments: sequence,
          defaultVoiceId: input.voiceId || defaults.voiceId,
          defaultLanguage: input.language || defaults.language,
          defaultSpeed: input.speed ?? defaults.speed,
        },
      };
    }

    const question = group.questions[0];
    if (exercise.toeicPart === ToeicPart.PART_1 && question) {
      const sequence = question.options.map((option) => ({
        text: option.content.trim(),
        pauseAfterMs: 650,
      }));
      return {
        targetType: "GROUP",
        groupId: group.id,
        inputText: sequence.map((item) => item.text).join("\n"),
        request: {
          segments: sequence,
          defaultVoiceId: input.voiceId || defaults.voiceId,
          defaultLanguage: input.language || defaults.language,
          defaultSpeed: input.speed ?? defaults.speed,
        },
      };
    }
    if (exercise.toeicPart === ToeicPart.PART_2 && question) {
      const sequence = [
        { text: question.questionText.trim(), pauseAfterMs: 800 },
        ...question.options.map((option) => ({
          text: option.content.trim(),
          pauseAfterMs: 650,
        })),
      ];
      return {
        targetType: "GROUP",
        groupId: group.id,
        inputText: sequence.map((item) => item.text).join("\n"),
        request: {
          segments: sequence,
          defaultVoiceId: input.voiceId || defaults.voiceId,
          defaultLanguage: input.language || defaults.language,
          defaultSpeed: input.speed ?? defaults.speed,
        },
      };
    }
    if (exercise.toeicPart === ToeicPart.PART_3) {
      throw new AppException(
        "TTS_STRUCTURED_SEGMENTS_REQUIRED",
        "TOEIC Part 3 TTS requires speaker audio segments so each conversation speaker can use an appropriate voice.",
        422,
      );
    }
    const text = input.text?.trim() || group.sharedScript?.trim();
    if (!text) {
      throw new AppException(
        "TTS_TEXT_REQUIRED",
        "This TOEIC group needs a script or audio segments before generation.",
        422,
      );
    }
    return {
      targetType: "GROUP",
      groupId: group.id,
      inputText: text,
      request: {
        text,
        voiceId: input.voiceId || defaults.voiceId,
        language: input.language || defaults.language,
        speed: input.speed ?? defaults.speed,
      },
    };
  }

  private automaticSpeakerVoice(
    language: string,
    speakerLabel: string,
    assignmentIndex: number,
  ): string {
    const british = language === "en-GB";
    const female = british
      ? ["bf_emma", "bf_alice", "bf_isabella", "bf_lily"]
      : ["af_heart", "af_bella", "af_nicole", "af_nova"];
    const male = british
      ? ["bm_george", "bm_fable", "bm_daniel", "bm_lewis"]
      : ["am_michael", "am_fenrir", "am_puck", "am_eric"];
    const normalized = speakerLabel.toLowerCase();
    if (/\b(woman|female|lady|ms|mrs|miss)\b/.test(normalized)) {
      return female[assignmentIndex % female.length];
    }
    if (/\b(man|male|gentleman|mr)\b/.test(normalized)) {
      return male[assignmentIndex % male.length];
    }
    const alternating = [female[0], male[0], female[1], male[1]];
    return alternating[assignmentIndex % alternating.length];
  }

  private normalizeText(value: string): string {
    return value.trim().replace(/\s+/g, " ");
  }
}

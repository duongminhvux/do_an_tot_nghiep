import { ConflictException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import {
  AudioSource,
  ContentStatus,
  DictationMode,
  ExerciseType,
  MediaStatus,
  MediaType,
  QuestionKind,
  ToeicPart,
  TtsJobStatus,
  UserRole,
  type Prisma,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "../access/course-access.service";
import { ExerciseAccessService } from "../access/exercise-access.service";
import type {
  AttachAudioDto,
  CreateAudioSegmentDto,
  CreateExerciseDto,
  CreateGroupDto,
  CreateOptionDto,
  CreateQuestionDto,
  SaveExerciseDraftDto,
  UpdateExerciseDto,
} from "./dto/exercises.dto";
import { PublishValidationService } from "./publish-validation.service";

@Injectable()
export class ExercisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseAccess: CourseAccessService,
    private readonly exerciseAccess: ExerciseAccessService,
    private readonly publishValidation: PublishValidationService,
  ) {}

  async adminList(user: AuthenticatedUser) {
    const courseIds =
      user.role === UserRole.TEACHER
        ? await this.courseAccess.assignedCourseIds(user.id)
        : undefined;
    const exercises = await this.prisma.listeningExercise.findMany({
      where: courseIds ? { lesson: { courseId: { in: courseIds } } } : {},
      include: {
        lesson: { select: { courseId: true } },
        attempts: { select: { passed: true } },
        ttsJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return exercises.map((exercise) => ({
      id: exercise.id,
      title: exercise.title,
      courseId: exercise.lesson.courseId,
      lessonId: exercise.lessonId,
      type: exercise.type,
      status: exercise.status,
      ttsStatus: exercise.ttsJobs[0]?.status ?? TtsJobStatus.CANCELLED,
      attempts: exercise.attempts.length,
      passRate: exercise.attempts.length
        ? Math.round(
            (exercise.attempts.filter((attempt) => attempt.passed).length /
              exercise.attempts.length) *
              100,
          )
        : 0,
    }));
  }

  async adminGet(user: AuthenticatedUser, id: string) {
    await this.exerciseAccess.assertManage(user, id);
    return this.fullExercise(id);
  }

  async create(user: AuthenticatedUser, input: CreateExerciseDto) {
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: input.lessonId },
      select: { courseId: true },
    });
    await this.courseAccess.assertManage(user, lesson.courseId);
    const order = await this.prisma.listeningExercise.count({
      where: { lessonId: input.lessonId },
    });
    const exercise = await this.prisma.listeningExercise.create({
      data: {
        lessonId: input.lessonId,
        slug: await this.availableSlug(input.lessonId, input.title),
        title: input.title.trim(),
        instruction: input.instruction.trim(),
        type: input.type,
        dictationMode:
          input.type === ExerciseType.DICTATION
            ? (input.dictationMode ?? DictationMode.SENTENCE)
            : null,
        toeicPart:
          input.type === ExerciseType.TOEIC
            ? (input.toeicPart ?? ToeicPart.PART_1)
            : null,
        difficulty: input.difficulty,
        sourceScript: input.sourceScript,
        transcript: input.transcript,
        passThreshold: input.passThreshold ?? 80,
        maxPlays: input.maxPlays ?? 3,
        maxAttempts: input.maxAttempts ?? 3,
        audioSource: AudioSource.UPLOAD,
        orderIndex: order,
        createdById: user.id,
      },
    });
    return this.adminGet(user, exercise.id);
  }

  async update(user: AuthenticatedUser, id: string, input: UpdateExerciseDto) {
    await this.exerciseAccess.assertManage(user, id);
    await this.prisma.$transaction(async (tx) => {
      await this.assertUpdateAllowed(tx, id, input);
      await tx.listeningExercise.update({
        where: { id },
        data: {
          title: input.title?.trim(),
          instruction: input.instruction?.trim(),
          dictationMode: input.dictationMode,
          toeicPart: input.toeicPart,
          difficulty: input.difficulty,
          sourceScript: input.sourceScript,
          transcript: input.transcript,
          passThreshold: input.passThreshold,
          maxPlays: input.maxPlays,
          maxAttempts: input.maxAttempts,
          ignoreCapitalization: input.ignoreCapitalization,
          ignorePunctuation: input.ignorePunctuation,
          ignoreExtraSpaces: input.ignoreExtraSpaces,
          allowMinorTypo: input.allowMinorTypo,
          showTranscript: input.showTranscript,
          showAnswerAfterSubmit: input.showAnswerAfterSubmit,
          audioSource: input.audioSource,
          finalAudioMediaId: input.finalAudioMediaId,
          status: ContentStatus.DRAFT,
          publishedAt: null,
          archivedAt: null,
        },
      });
    });
    return this.adminGet(user, id);
  }

  async saveDraft(
    user: AuthenticatedUser,
    id: string,
    input: SaveExerciseDraftDto,
  ) {
    await this.exerciseAccess.assertManage(user, id);
    await this.prisma.$transaction(async (tx) => {
      const hasAttempts = await this.assertDraftAllowed(tx, id, input);
      const before = await tx.listeningExercise.findUniqueOrThrow({
        where: { id },
        select: {
          type: true,
          audioSource: true,
          sourceScript: true,
          finalAudioMediaId: true,
          finalAudioMedia: { select: { metadata: true } },
          questions: {
            where: { kind: QuestionKind.TEXT_INPUT },
            select: { correctText: true },
            take: 1,
          },
        },
      });
      const previousCorrectText = before.questions[0]?.correctText?.trim() ?? "";
      const dictationTtsSourceChanged =
        input.type === ExerciseType.DICTATION &&
        before.type === ExerciseType.DICTATION &&
        before.audioSource === AudioSource.TTS &&
        this.isTtsMetadata(before.finalAudioMedia?.metadata) &&
        ((before.sourceScript?.trim() ?? "") !== (input.sourceScript?.trim() ?? "") ||
          (input.correctText !== undefined &&
            previousCorrectText !== input.correctText.trim()));
      await tx.listeningExercise.update({
        where: { id },
        data: {
          type: input.type,
          title: input.title.trim(),
          instruction: input.instruction.trim(),
          orderIndex: input.orderIndex,
          dictationMode:
            input.type === ExerciseType.DICTATION
              ? (input.dictationMode ?? DictationMode.SENTENCE)
              : null,
          toeicPart:
            input.type === ExerciseType.TOEIC
              ? (input.toeicPart ?? ToeicPart.PART_1)
              : null,
          difficulty: input.difficulty,
          sourceScript: input.sourceScript,
          transcript: input.sourceScript,
          passThreshold: input.passThreshold,
          maxPlays: input.maxPlays,
          maxAttempts: input.maxAttempts,
          ignoreCapitalization: input.ignoreCapitalization,
          ignorePunctuation: input.ignorePunctuation,
          ignoreExtraSpaces: input.ignoreExtraSpaces,
          allowMinorTypo: input.allowMinorTypo,
          showTranscript: input.showTranscript,
          showAnswerAfterSubmit: input.showAnswerAfterSubmit,
          finalAudioMediaId:
            input.type === ExerciseType.TOEIC || dictationTtsSourceChanged
              ? null
              : undefined,
          // A draft save is a content edit. Never leave edited content public
          // without running publish validation again.
          status: ContentStatus.DRAFT,
          publishedAt: null,
          archivedAt: null,
        },
      });
      if (hasAttempts) return;
      if (
        input.questions === undefined &&
        input.groups === undefined &&
        input.correctText === undefined &&
        input.audioSegments === undefined
      ) {
        return;
      }
      await this.syncDraftStructure(tx, id, input);
    });
    return this.adminGet(user, id);
  }

  private async syncDraftStructure(
    tx: Prisma.TransactionClient,
    exerciseId: string,
    input: SaveExerciseDraftDto,
  ): Promise<void> {
    const current = await tx.listeningExercise.findUniqueOrThrow({
      where: { id: exerciseId },
      include: {
        groups: {
          orderBy: { orderIndex: "asc" },
          include: { sharedAudio: { select: { metadata: true } } },
        },
        questions: {
          orderBy: { orderIndex: "asc" },
          include: { options: { orderBy: { orderIndex: "asc" } } },
        },
        audioSegments: {
          orderBy: { orderIndex: "asc" },
          include: { media: { select: { metadata: true } } },
        },
      },
    });

    if (input.type === ExerciseType.DICTATION) {
      const existingTextQuestion = current.questions.find(
        (question) => question.kind === QuestionKind.TEXT_INPUT,
      );
      if (existingTextQuestion) {
        await tx.exerciseQuestion.update({
          where: { id: existingTextQuestion.id },
          data: {
            groupId: null,
            questionText: "Type what you hear.",
            kind: QuestionKind.TEXT_INPUT,
            correctText: input.correctText?.trim() ?? "",
            imageMediaId: null,
            explanation: null,
            orderIndex: 0,
          },
        });
        await tx.exerciseOption.deleteMany({
          where: { questionId: existingTextQuestion.id },
        });
        await tx.exerciseQuestion.deleteMany({
          where: {
            exerciseId,
            id: { not: existingTextQuestion.id },
          },
        });
      } else {
        await tx.exerciseQuestion.deleteMany({ where: { exerciseId } });
        await tx.exerciseQuestion.create({
          data: {
            exerciseId,
            questionText: "Type what you hear.",
            kind: QuestionKind.TEXT_INPUT,
            correctText: input.correctText?.trim() ?? "",
            orderIndex: 0,
          },
        });
      }
      await tx.exerciseAudioSegment.deleteMany({ where: { exerciseId } });
      await tx.exerciseGroup.deleteMany({ where: { exerciseId } });
      return;
    }

    const submittedGroups =
      input.groups !== undefined
        ? input.groups
        : input.questions !== undefined
          ? [
              {
                id: current.groups[0]?.id ?? "default-group",
                title: current.groups[0]?.title ?? "Listening questions",
                label: current.groups[0]?.label ?? undefined,
                sharedScript: current.groups[0]?.sharedScript ?? undefined,
                imageMediaId: current.groups[0]?.imageMediaId ?? undefined,
                sharedAudioMediaId:
                  current.groups[0]?.sharedAudioMediaId ?? undefined,
                questions: input.questions,
              },
            ]
          : undefined;

    const existingGroupIds = new Set(current.groups.map((group) => group.id));
    const existingQuestions = new Map(
      current.questions.map((question) => [question.id, question]),
    );
    const existingSegments = new Map(
      current.audioSegments.map((segment) => [segment.id, segment]),
    );
    const groupIdMap = new Map<string, string>();
    const questionIdMap = new Map<string, string>();
    const keptGroupIds = new Set<string>();
    const keptQuestionIds = new Set<string>();
    const keptSegmentIds = new Set<string>();
    const ttsAudioGroupIds = new Set<string>();
    const submittedAudioByGroup = new Map<string, string | null>();

    if (submittedGroups !== undefined) {
      // Free unique order indexes while preserving stable UUIDs.
      await tx.exerciseGroup.updateMany({
        where: { exerciseId },
        data: { orderIndex: { increment: 10_000 } },
      });

      for (const [groupIndex, group] of submittedGroups.entries()) {
        const persistentGroupId =
          group.id && existingGroupIds.has(group.id) ? group.id : undefined;
        const currentGroup = persistentGroupId
          ? current.groups.find((item) => item.id === persistentGroupId)
          : undefined;
        const currentQuestions = persistentGroupId
          ? current.questions.filter((question) => question.groupId === persistentGroupId)
          : [];
        const submittedQuestionSignature = JSON.stringify(
          group.questions.map((question) => ({
            text: question.text.trim(),
            imageMediaId: question.imageMediaId ?? "",
            options: question.options.map((option) => ({
              text: option.text.trim(),
              correct: option.correct,
            })),
          })),
        );
        const currentQuestionSignature = JSON.stringify(
          currentQuestions.map((question) => ({
            text: question.questionText.trim(),
            imageMediaId: question.imageMediaId ?? "",
            options: question.options.map((option) => ({
              text: option.content.trim(),
              correct: option.isCorrect,
            })),
          })),
        );
        const generatedSourceChanged = Boolean(
          currentGroup &&
            this.isTtsMetadata(currentGroup.sharedAudio?.metadata) &&
            ((currentGroup.sharedScript?.trim() ?? "") !==
              (group.sharedScript?.trim() ?? "") ||
              ((input.toeicPart === ToeicPart.PART_1 ||
                input.toeicPart === ToeicPart.PART_2) &&
                currentQuestionSignature !== submittedQuestionSignature)),
        );
        const requestedSharedAudioId = group.sharedAudioMediaId || null;
        const sharedAudioMediaId =
          generatedSourceChanged &&
          requestedSharedAudioId === (currentGroup?.sharedAudioMediaId ?? null)
            ? null
            : requestedSharedAudioId;
        const persistedGroup = persistentGroupId
          ? await tx.exerciseGroup.update({
              where: { id: persistentGroupId },
              data: {
                title: group.title?.trim() || null,
                label: group.label?.trim() || null,
                sharedScript: group.sharedScript?.trim() || null,
                orderIndex: groupIndex,
                imageMediaId: group.imageMediaId || null,
                sharedAudioMediaId,
              },
            })
          : await tx.exerciseGroup.create({
              data: {
                exerciseId,
                title: group.title?.trim() || null,
                label: group.label?.trim() || null,
                sharedScript: group.sharedScript?.trim() || null,
                orderIndex: groupIndex,
                imageMediaId: group.imageMediaId || null,
                sharedAudioMediaId,
              },
            });
        if (group.id) groupIdMap.set(group.id, persistedGroup.id);
        keptGroupIds.add(persistedGroup.id);
        submittedAudioByGroup.set(persistedGroup.id, sharedAudioMediaId);
        if (
          currentGroup &&
          this.isTtsMetadata(currentGroup.sharedAudio?.metadata) &&
          sharedAudioMediaId === currentGroup.sharedAudioMediaId
        ) {
          ttsAudioGroupIds.add(persistedGroup.id);
        }

        for (const [questionIndex, question] of group.questions.entries()) {
          const oldQuestion =
            question.id && existingQuestions.has(question.id)
              ? existingQuestions.get(question.id)
              : undefined;
          const persistedQuestion = oldQuestion
            ? await tx.exerciseQuestion.update({
                where: { id: oldQuestion.id },
                data: {
                  groupId: persistedGroup.id,
                  questionText: question.text.trim(),
                  kind: QuestionKind.MULTIPLE_CHOICE,
                  correctText: null,
                  imageMediaId: question.imageMediaId || null,
                  explanation: question.explanation?.trim() || null,
                  orderIndex: questionIndex,
                },
              })
            : await tx.exerciseQuestion.create({
                data: {
                  exerciseId,
                  groupId: persistedGroup.id,
                  questionText: question.text.trim(),
                  kind: QuestionKind.MULTIPLE_CHOICE,
                  imageMediaId: question.imageMediaId || null,
                  explanation: question.explanation?.trim() || null,
                  orderIndex: questionIndex,
                },
              });
          if (question.id) questionIdMap.set(question.id, persistedQuestion.id);
          keptQuestionIds.add(persistedQuestion.id);

          // Options have no TTS/job references. Rebuilding only this small child
          // collection avoids unique-label/order conflicts while keeping the
          // group/question/segment identifiers stable.
          await tx.exerciseOption.deleteMany({
            where: { questionId: persistedQuestion.id },
          });
          if (question.options.length) {
            await tx.exerciseOption.createMany({
              data: question.options.map((option, optionIndex) => ({
                questionId: persistedQuestion.id,
                label: String.fromCharCode(65 + optionIndex),
                content: option.text.trim(),
                isCorrect: option.correct,
                orderIndex: optionIndex,
              })),
            });
          }
        }
      }

    }

    if (input.audioSegments !== undefined) {
      await tx.exerciseAudioSegment.updateMany({
        where: { exerciseId },
        data: { orderIndex: { increment: 10_000 } },
      });
      for (const [segmentIndex, segment] of input.audioSegments.entries()) {
        const oldSegment =
          segment.id && existingSegments.has(segment.id)
            ? existingSegments.get(segment.id)
            : undefined;
        const groupId = segment.groupId
          ? (groupIdMap.get(segment.groupId) ??
            ((submittedGroups !== undefined
              ? keptGroupIds.has(segment.groupId)
              : existingGroupIds.has(segment.groupId))
              ? segment.groupId
              : null))
          : null;
        const questionId = segment.questionId
          ? (questionIdMap.get(segment.questionId) ??
            ((submittedGroups !== undefined
              ? keptQuestionIds.has(segment.questionId)
              : existingQuestions.has(segment.questionId))
              ? segment.questionId
              : null))
          : null;
        const requestedMediaId = segment.mediaId || null;
        const segmentSourceChanged = Boolean(
          oldSegment &&
            (oldSegment.text.trim() !== segment.text.trim() ||
              (oldSegment.voiceId?.trim() ?? "") !==
                (segment.voiceId?.trim() ?? "") ||
              oldSegment.language !== (segment.language?.trim() || "en-US") ||
              Number(oldSegment.speed) !== (segment.speed ?? 1)),
        );
        const mediaId =
          oldSegment &&
          segmentSourceChanged &&
          this.isTtsMetadata(oldSegment.media?.metadata) &&
          requestedMediaId === oldSegment.mediaId
            ? null
            : requestedMediaId;
        const data = {
          groupId,
          questionId,
          segmentType: segment.segmentType,
          speakerKey: segment.speakerKey?.trim() || null,
          speakerLabel: segment.speakerLabel?.trim() || null,
          text: segment.text.trim(),
          voiceId: segment.voiceId?.trim() || null,
          language: segment.language?.trim() || "en-US",
          speed: segment.speed ?? 1,
          pauseAfterMs: segment.pauseAfterMs ?? 0,
          orderIndex: segmentIndex,
          mediaId,
          generationStatus: mediaId ? TtsJobStatus.COMPLETED : null,
        };
        const persistedSegment = oldSegment
          ? await tx.exerciseAudioSegment.update({
              where: { id: oldSegment.id },
              data,
            })
          : await tx.exerciseAudioSegment.create({
              data: { exerciseId, ...data },
            });
        keptSegmentIds.add(persistedSegment.id);
      }

      // If structured speech content changed, a previously generated group WAV
      // is stale and must be regenerated before publishing. Manual replacement
      // audio is never cleared here.
      for (const groupId of ttsAudioGroupIds) {
        const currentSignature = JSON.stringify(
          current.audioSegments
            .filter((segment) => segment.groupId === groupId)
            .map((segment) => ({
              segmentType: segment.segmentType,
              speakerKey: segment.speakerKey?.trim() ?? "",
              speakerLabel: segment.speakerLabel?.trim() ?? "",
              text: segment.text.trim(),
              voiceId: segment.voiceId?.trim() ?? "",
              language: segment.language,
              speed: Number(segment.speed),
              pauseAfterMs: segment.pauseAfterMs,
            })),
        );
        const submittedSignature = JSON.stringify(
          input.audioSegments
            .map((segment) => ({
              groupId: segment.groupId
                ? (groupIdMap.get(segment.groupId) ?? segment.groupId)
                : null,
              segmentType: segment.segmentType,
              speakerKey: segment.speakerKey?.trim() ?? "",
              speakerLabel: segment.speakerLabel?.trim() ?? "",
              text: segment.text.trim(),
              voiceId: segment.voiceId?.trim() ?? "",
              language: segment.language?.trim() || "en-US",
              speed: segment.speed ?? 1,
              pauseAfterMs: segment.pauseAfterMs ?? 0,
            }))
            .filter((segment) => segment.groupId === groupId)
            .map(({ groupId: _groupId, ...segment }) => segment),
        );
        if (
          currentSignature !== submittedSignature &&
          submittedAudioByGroup.get(groupId) ===
            current.groups.find((group) => group.id === groupId)?.sharedAudioMediaId
        ) {
          await tx.exerciseGroup.update({
            where: { id: groupId },
            data: { sharedAudioMediaId: null },
          });
        }
      }

      if (keptSegmentIds.size) {
        await tx.exerciseAudioSegment.deleteMany({
          where: {
            exerciseId,
            id: { notIn: [...keptSegmentIds] },
          },
        });
      } else {
        await tx.exerciseAudioSegment.deleteMany({ where: { exerciseId } });
      }
    }

    if (submittedGroups !== undefined) {
      if (keptQuestionIds.size) {
        await tx.exerciseQuestion.deleteMany({
          where: {
            exerciseId,
            id: { notIn: [...keptQuestionIds] },
          },
        });
      } else {
        await tx.exerciseQuestion.deleteMany({ where: { exerciseId } });
      }

      if (keptGroupIds.size) {
        await tx.exerciseGroup.deleteMany({
          where: {
            exerciseId,
            id: { notIn: [...keptGroupIds] },
          },
        });
      } else {
        await tx.exerciseGroup.deleteMany({ where: { exerciseId } });
      }
    }
  }

  async addGroup(user: AuthenticatedUser, id: string, input: CreateGroupDto) {
    await this.exerciseAccess.assertManage(user, id);
    return this.prisma.$transaction(async (tx) => {
      await this.assertNoAttempts(tx, id);
      const group = await tx.exerciseGroup.create({
        data: { exerciseId: id, ...input },
      });
      await this.markExerciseDraft(tx, id);
      return group;
    });
  }

  async addQuestion(
    user: AuthenticatedUser,
    id: string,
    input: CreateQuestionDto,
  ) {
    await this.exerciseAccess.assertManage(user, id);
    return this.prisma.$transaction(async (tx) => {
      await this.assertNoAttempts(tx, id);
      if (input.groupId) {
        await tx.exerciseGroup.findFirstOrThrow({
          where: { id: input.groupId, exerciseId: id },
        });
      }
      const question = await tx.exerciseQuestion.create({
        data: {
          exerciseId: id,
          groupId: input.groupId,
          questionText: input.questionText,
          kind: input.kind,
          correctText:
            input.kind === QuestionKind.TEXT_INPUT ? input.correctText : null,
          imageMediaId: input.imageMediaId,
          orderIndex: input.orderIndex,
          explanation: input.explanation,
        },
      });
      await this.markExerciseDraft(tx, id);
      return question;
    });
  }

  async addOption(
    user: AuthenticatedUser,
    exerciseId: string,
    questionId: string,
    input: CreateOptionDto,
  ) {
    await this.exerciseAccess.assertManage(user, exerciseId);
    await this.assertNoAttempts(this.prisma, exerciseId);
    await this.prisma.exerciseQuestion.findFirstOrThrow({
      where: { id: questionId, exerciseId },
    });
    return this.prisma.$transaction(async (tx) => {
      await this.assertNoAttempts(tx, exerciseId);
      if (input.isCorrect) {
        await tx.exerciseOption.updateMany({
          where: { questionId, isCorrect: true },
          data: { isCorrect: false },
        });
      }
      const option = await tx.exerciseOption.create({
        data: { questionId, ...input },
      });
      await this.markExerciseDraft(tx, exerciseId);
      return option;
    });
  }

  async addAudioSegment(
    user: AuthenticatedUser,
    exerciseId: string,
    input: CreateAudioSegmentDto,
  ) {
    await this.exerciseAccess.assertManage(user, exerciseId);
    return this.prisma.$transaction(async (tx) => {
      await this.assertNoAttempts(tx, exerciseId);
      const segment = await tx.exerciseAudioSegment.create({
        data: {
          exerciseId,
          ...input,
          generationStatus: input.mediaId ? TtsJobStatus.COMPLETED : null,
        },
      });
      await this.markExerciseDraft(tx, exerciseId);
      return segment;
    });
  }

  async attachAudio(
    user: AuthenticatedUser,
    id: string,
    input: AttachAudioDto,
  ) {
    await this.exerciseAccess.assertManage(user, id);
    await this.assertNoAttempts(this.prisma, id);
    await this.prisma.mediaFile.findFirstOrThrow({
      where: { id: input.mediaId, type: "AUDIO", status: "ACTIVE" },
    });
    await this.prisma.listeningExercise.update({
      where: { id },
      data: {
        finalAudioMediaId: input.mediaId,
        audioSource: AudioSource.UPLOAD,
        status: ContentStatus.DRAFT,
        publishedAt: null,
        archivedAt: null,
      },
    });
    return this.adminGet(user, id);
  }

  async publish(user: AuthenticatedUser, id: string) {
    await this.exerciseAccess.assertManage(user, id);
    const exercise = await this.fullExercise(id);
    const errors = [
      ...this.publishValidation.validate(exercise),
      ...(await this.validatePublishMedia(id, exercise.type, exercise.toeicPart)),
    ];
    if (errors.length) {
      throw new ConflictException({
        code: "PUBLISH_VALIDATION_ERROR",
        message: "Exercise is not ready to publish.",
        details: { errors },
      });
    }
    await this.prisma.listeningExercise.update({
      where: { id },
      data: {
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        archivedAt: null,
      },
    });
    return this.adminGet(user, id);
  }

  async archive(user: AuthenticatedUser, id: string) {
    await this.exerciseAccess.assertManage(user, id);
    await this.prisma.listeningExercise.update({
      where: { id },
      data: { status: ContentStatus.ARCHIVED, archivedAt: new Date() },
    });
    return this.adminGet(user, id);
  }

  async preview(user: AuthenticatedUser, id: string) {
    const exercise = await this.adminGet(user, id);
    return { ...exercise, preview: true };
  }

  private async validatePublishMedia(
    exerciseId: string,
    type: ExerciseType,
    toeicPart: ToeicPart | null,
  ): Promise<string[]> {
    const exercise = await this.prisma.listeningExercise.findUniqueOrThrow({
      where: { id: exerciseId },
      select: {
        finalAudioMediaId: true,
        groups: {
          select: {
            id: true,
            imageMediaId: true,
            sharedAudioMediaId: true,
            questions: { select: { imageMediaId: true } },
          },
        },
      },
    });
    const mediaIds = new Set<string>();
    if (exercise.finalAudioMediaId) mediaIds.add(exercise.finalAudioMediaId);
    for (const group of exercise.groups) {
      if (group.imageMediaId) mediaIds.add(group.imageMediaId);
      if (group.sharedAudioMediaId) mediaIds.add(group.sharedAudioMediaId);
      for (const question of group.questions) {
        if (question.imageMediaId) mediaIds.add(question.imageMediaId);
      }
    }
    const media = mediaIds.size
      ? await this.prisma.mediaFile.findMany({
          where: { id: { in: [...mediaIds] } },
          select: { id: true, type: true, status: true },
        })
      : [];
    const byId = new Map(media.map((item) => [item.id, item]));
    const isActiveType = (id: string | null, expected: MediaType) => {
      if (!id) return false;
      const item = byId.get(id);
      return item?.status === MediaStatus.ACTIVE && item.type === expected;
    };
    const errors: string[] = [];
    if (
      type === ExerciseType.DICTATION &&
      exercise.finalAudioMediaId &&
      !isActiveType(exercise.finalAudioMediaId, MediaType.AUDIO)
    ) {
      errors.push("Dictation audio must be an active audio media file.");
    }
    if (type === ExerciseType.TOEIC) {
      for (const [index, group] of exercise.groups.entries()) {
        if (
          group.sharedAudioMediaId &&
          !isActiveType(group.sharedAudioMediaId, MediaType.AUDIO)
        ) {
          errors.push(
            `TOEIC group ${index + 1} audio must be an active audio media file.`,
          );
        }
        if (
          group.imageMediaId &&
          !isActiveType(group.imageMediaId, MediaType.IMAGE)
        ) {
          errors.push(
            `TOEIC group ${index + 1} image must be an active image media file.`,
          );
        }
        for (const [questionIndex, question] of group.questions.entries()) {
          if (
            question.imageMediaId &&
            !isActiveType(question.imageMediaId, MediaType.IMAGE)
          ) {
            errors.push(
              `TOEIC group ${index + 1}, question ${questionIndex + 1} image must be an active image media file.`,
            );
          }
        }
        if (toeicPart === ToeicPart.PART_1) {
          const photoId =
            group.imageMediaId ?? group.questions[0]?.imageMediaId ?? null;
          if (photoId && !isActiveType(photoId, MediaType.IMAGE)) {
            errors.push(
              `TOEIC Part 1 group ${index + 1} photograph must be an active image media file.`,
            );
          }
        }
      }
    }
    return [...new Set(errors)];
  }

  private async fullExercise(id: string) {
    const exercise = await this.prisma.listeningExercise.findUniqueOrThrow({
      where: { id },
      include: {
        lesson: { include: { course: true } },
        questions: { include: { options: { orderBy: { orderIndex: "asc" } } } },
        groups: {
          orderBy: { orderIndex: "asc" },
          include: {
            questions: {
              include: { options: { orderBy: { orderIndex: "asc" } } },
            },
          },
        },
        audioSegments: { orderBy: { orderIndex: "asc" } },
        finalAudioMedia: true,
        ttsJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
      },
    });
    return {
      ...exercise,
      finalAudioMedia: exercise.finalAudioMedia
        ? {
            ...exercise.finalAudioMedia,
            sizeBytes: Number(exercise.finalAudioMedia.sizeBytes),
          }
        : null,
    };
  }

  private async availableSlug(
    lessonId: string,
    value: string,
  ): Promise<string> {
    const base =
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "exercise";
    let slug = base;
    let suffix = 2;
    while (
      await this.prisma.listeningExercise.findUnique({
        where: { lessonId_slug: { lessonId, slug } },
        select: { id: true },
      })
    ) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }

  private gradingLocked(): never {
    throw new ConflictException({
      code: "EXERCISE_GRADING_CONFIG_LOCKED",
      message: "Grading configuration cannot be changed after attempts exist.",
    });
  }

  private async assertNoAttempts(
    tx: Prisma.TransactionClient | PrismaService,
    exerciseId: string,
  ): Promise<void> {
    if (await tx.listeningAttempt.count({ where: { exerciseId } })) {
      this.gradingLocked();
    }
  }

  private async assertUpdateAllowed(
    tx: Prisma.TransactionClient,
    exerciseId: string,
    input: UpdateExerciseDto,
  ): Promise<void> {
    const attempts = await tx.listeningAttempt.aggregate({
      where: { exerciseId },
      _count: true,
      _max: { attemptNumber: true, playCount: true },
    });
    if (!attempts._count) return;
    const current = await tx.listeningExercise.findUniqueOrThrow({
      where: { id: exerciseId },
    });
    const lockedChanged = [
      ["dictationMode", input.dictationMode],
      ["toeicPart", input.toeicPart],
      ["sourceScript", input.sourceScript],
      ["transcript", input.transcript],
      ["passThreshold", input.passThreshold],
      ["ignoreCapitalization", input.ignoreCapitalization],
      ["ignorePunctuation", input.ignorePunctuation],
      ["ignoreExtraSpaces", input.ignoreExtraSpaces],
      ["allowMinorTypo", input.allowMinorTypo],
      ["showAnswerAfterSubmit", input.showAnswerAfterSubmit],
      ["showTranscript", input.showTranscript],
      ["audioSource", input.audioSource],
      ["finalAudioMediaId", input.finalAudioMediaId],
    ].some(
      ([key, value]) =>
        value !== undefined &&
        String(current[key as keyof typeof current] ?? "") !==
          String(value ?? ""),
    );
    const invalidAttemptLimit =
      input.maxAttempts !== undefined &&
      input.maxAttempts < (attempts._max.attemptNumber ?? 0);
    const historicalMaxPlays =
      input.maxPlays === undefined
        ? 0
        : current.type === ExerciseType.TOEIC
          ? await this.maxToeicGroupPlays(tx, exerciseId)
          : (attempts._max.playCount ?? 0);
    const invalidPlayLimit =
      input.maxPlays !== undefined && input.maxPlays < historicalMaxPlays;
    if (lockedChanged || invalidAttemptLimit || invalidPlayLimit) {
      this.gradingLocked();
    }
  }

  private async assertDraftAllowed(
    tx: Prisma.TransactionClient,
    exerciseId: string,
    input: SaveExerciseDraftDto,
  ): Promise<boolean> {
    const attempts = await tx.listeningAttempt.aggregate({
      where: { exerciseId },
      _count: true,
      _max: { attemptNumber: true, playCount: true },
    });
    if (!attempts._count) return false;
    const current = await tx.listeningExercise.findUniqueOrThrow({
      where: { id: exerciseId },
      include: {
        groups: {
          orderBy: { orderIndex: "asc" },
          include: {
            questions: {
              orderBy: { orderIndex: "asc" },
              include: { options: { orderBy: { orderIndex: "asc" } } },
            },
          },
        },
        questions: {
          orderBy: { orderIndex: "asc" },
          include: { options: { orderBy: { orderIndex: "asc" } } },
        },
        audioSegments: { orderBy: { orderIndex: "asc" } },
      },
    });
    const nextDictationMode =
      input.type === ExerciseType.DICTATION
        ? (input.dictationMode ?? DictationMode.SENTENCE)
        : null;
    const nextToeicPart =
      input.type === ExerciseType.TOEIC
        ? (input.toeicPart ?? ToeicPart.PART_1)
        : null;
    const scalarChanged =
      current.type !== input.type ||
      current.dictationMode !== nextDictationMode ||
      current.toeicPart !== nextToeicPart ||
      String(current.passThreshold) !== String(input.passThreshold) ||
      current.ignoreCapitalization !== input.ignoreCapitalization ||
      current.ignorePunctuation !== input.ignorePunctuation ||
      current.ignoreExtraSpaces !== input.ignoreExtraSpaces ||
      current.allowMinorTypo !== input.allowMinorTypo ||
      current.showAnswerAfterSubmit !== input.showAnswerAfterSubmit ||
      current.showTranscript !== input.showTranscript ||
      (current.sourceScript ?? "") !== (input.sourceScript ?? "");
    const invalidAttemptLimit =
      input.maxAttempts < (attempts._max.attemptNumber ?? 0);
    const historicalMaxPlays =
      current.type === ExerciseType.TOEIC
        ? await this.maxToeicGroupPlays(tx, exerciseId)
        : (attempts._max.playCount ?? 0);
    const invalidPlayLimit = input.maxPlays < historicalMaxPlays;
    if (scalarChanged || invalidAttemptLimit || invalidPlayLimit) {
      this.gradingLocked();
    }

    if (
      input.type === ExerciseType.DICTATION &&
      input.correctText !== undefined
    ) {
      const correctText =
        current.questions.find(
          (question) => question.kind === QuestionKind.TEXT_INPUT,
        )?.correctText ?? "";
      if (correctText !== input.correctText.trim()) this.gradingLocked();
    }

    if (
      input.type === ExerciseType.TOEIC &&
      (input.questions !== undefined || input.groups !== undefined)
    ) {
      const orderedQuestions = [
        ...current.groups.flatMap((group) => group.questions),
        ...current.questions.filter((question) => !question.groupId),
      ];
      const existing = orderedQuestions.map((question) => ({
        id: question.id,
        groupId: question.groupId ?? "",
        text: question.questionText.trim(),
        explanation: question.explanation?.trim() ?? "",
        imageMediaId: question.imageMediaId ?? "",
        kind: question.kind,
        options: question.options.map((option) => ({
          id: option.id,
          text: option.content.trim(),
          correct: option.isCorrect,
        })),
      }));
      const submitted = (
        input.groups?.flatMap((group) =>
          group.questions.map((question) => ({
            ...question,
            groupId: group.id ?? "",
          })),
        ) ??
        input.questions ??
        []
      ).map((question) => ({
        id: question.id ?? "",
        groupId: question.groupId ?? "",
        text: question.text.trim(),
        explanation: question.explanation?.trim() ?? "",
        imageMediaId: question.imageMediaId ?? "",
        kind: QuestionKind.MULTIPLE_CHOICE,
        options: question.options.map((option) => ({
          id: option.id ?? "",
          text: option.text.trim(),
          correct: option.correct,
        })),
      }));
      const existingGroups = current.groups.map((group) => group.id);
      const submittedGroups = (input.groups ?? []).map(
        (group) => group.id ?? "",
      );
      if (
        JSON.stringify(existing) !== JSON.stringify(submitted) ||
        (input.groups !== undefined &&
          JSON.stringify(existingGroups) !== JSON.stringify(submittedGroups))
      ) {
        this.gradingLocked();
      }
    }

    if (input.audioSegments !== undefined) {
      const existingSegments = current.audioSegments.map((segment) => ({
        id: segment.id,
        groupId: segment.groupId ?? "",
        questionId: segment.questionId ?? "",
        segmentType: segment.segmentType,
        text: segment.text.trim(),
        voiceId: segment.voiceId?.trim() ?? "",
        language: segment.language,
        speed: Number(segment.speed),
        pauseAfterMs: segment.pauseAfterMs,
        mediaId: segment.mediaId ?? "",
      }));
      const submittedSegments = input.audioSegments.map((segment) => ({
        id: segment.id ?? "",
        groupId: segment.groupId ?? "",
        questionId: segment.questionId ?? "",
        segmentType: segment.segmentType,
        text: segment.text.trim(),
        voiceId: segment.voiceId?.trim() ?? "",
        language: segment.language?.trim() || "en-US",
        speed: segment.speed ?? 1,
        pauseAfterMs: segment.pauseAfterMs ?? 0,
        mediaId: segment.mediaId ?? "",
      }));
      if (
        JSON.stringify(existingSegments) !== JSON.stringify(submittedSegments)
      ) {
        this.gradingLocked();
      }
    }
    return true;
  }

  private async markExerciseDraft(
    tx: Prisma.TransactionClient,
    exerciseId: string,
  ): Promise<void> {
    await tx.listeningExercise.update({
      where: { id: exerciseId },
      data: {
        status: ContentStatus.DRAFT,
        publishedAt: null,
        archivedAt: null,
      },
    });
  }

  private isTtsMetadata(metadata: unknown): boolean {
    return (
      typeof metadata === "object" &&
      metadata !== null &&
      !Array.isArray(metadata) &&
      (metadata as Record<string, unknown>).source === "TTS"
    );
  }

  private async maxToeicGroupPlays(
    tx: Prisma.TransactionClient,
    exerciseId: string,
  ): Promise<number> {
    const counts = await tx.attemptListenEvent.groupBy({
      by: ["attemptId", "groupId"],
      where: {
        groupId: { not: null },
        attempt: { exerciseId },
      },
      _count: { _all: true },
    });
    return counts.reduce(
      (maximum, item) => Math.max(maximum, item._count._all),
      0,
    );
  }
}

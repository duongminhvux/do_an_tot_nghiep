import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { AppException } from "../../common/errors/app.exception";
import {
  AttemptStatus,
  ContentStatus,
  EnrollmentStatus,
  ExerciseType,
  ProgressStatus,
  ToeicPart,
  UserRole,
  type Prisma,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AttemptAccessService } from "../access/attempt-access.service";
import { CourseAccessService } from "../access/course-access.service";
import { ExerciseAccessService } from "../access/exercise-access.service";
import type { DraftAnswerDto } from "./dto/attempts.dto";
import { DictationScoringService } from "./dictation-scoring.service";
import { ToeicScoringService } from "./toeic-scoring.service";

const exerciseInclude = {
  lesson: { include: { course: true } },
  finalAudioMedia: true,
  questions: {
    orderBy: { orderIndex: "asc" as const },
    include: { options: { orderBy: { orderIndex: "asc" as const } } },
  },
  groups: {
    orderBy: { orderIndex: "asc" as const },
    include: {
      image: true,
      sharedAudio: true,
      questions: {
        orderBy: { orderIndex: "asc" as const },
        include: {
          image: true,
          options: { orderBy: { orderIndex: "asc" as const } },
        },
      },
    },
  },
} satisfies Prisma.ListeningExerciseInclude;

interface TranscriptExercise {
  toeicPart: ToeicPart | null;
  groups: Array<{
    id: string;
    title: string | null;
    label: string | null;
    sharedScript: string | null;
    questions: Array<{
      questionText: string;
      options: Array<{ label: string; content: string }>;
    }>;
  }>;
  audioSegments: Array<{
    groupId: string | null;
    segmentType: string;
    speakerKey: string | null;
    speakerLabel: string | null;
    text: string;
  }>;
}

@Injectable()
export class AttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exerciseAccess: ExerciseAccessService,
    private readonly attemptAccess: AttemptAccessService,
    private readonly courseAccess: CourseAccessService,
    private readonly dictationScoring: DictationScoringService,
    private readonly toeicScoring: ToeicScoringService,
  ) {}

  async studentExercise(user: AuthenticatedUser, exerciseId: string) {
    await this.exerciseAccess.assertStudentView(user, exerciseId);
    const exercise = await this.prisma.listeningExercise.findUnique({
      where: { id: exerciseId },
      include: exerciseInclude,
    });
    if (!exercise || exercise.status !== ContentStatus.PUBLISHED) {
      throw new AppException("EXERCISE_NOT_FOUND", "Exercise not found.", 404);
    }

    let attempt = await this.prisma.listeningAttempt.findFirst({
      where: {
        exerciseId,
        studentId: user.id,
        status: AttemptStatus.IN_PROGRESS,
      },
      include: { answers: true },
      orderBy: { attemptNumber: "desc" },
    });
    if (!attempt) {
      try {
        attempt = await this.prisma.$transaction(
          async (tx) => {
            const used = await tx.listeningAttempt.count({
              where: {
                exerciseId,
                studentId: user.id,
                status: {
                  in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED],
                },
              },
            });
            if (used >= exercise.maxAttempts) {
              throw new AppException(
                "ATTEMPT_LIMIT_REACHED",
                "You have used all attempts for this exercise.",
                409,
              );
            }
            return tx.listeningAttempt.create({
              data: {
                exerciseId,
                studentId: user.id,
                attemptNumber: used + 1,
              },
              include: { answers: true },
            });
          },
          { isolationLevel: "Serializable" },
        );
      } catch (error) {
        if (!this.isTransactionConflict(error)) throw error;
        attempt = await this.prisma.listeningAttempt.findFirst({
          where: {
            exerciseId,
            studentId: user.id,
            status: AttemptStatus.IN_PROGRESS,
          },
          include: { answers: true },
          orderBy: { attemptNumber: "desc" },
        });
        if (!attempt) {
          throw new AppException(
            "ATTEMPT_CREATION_CONFLICT",
            "Another attempt request is still being processed. Please retry.",
            409,
          );
        }
      }
    }

    const groupListenCounts =
      exercise.type === ExerciseType.TOEIC
        ? new Map(
            (
              await this.prisma.attemptListenEvent.groupBy({
                by: ["groupId"],
                where: { attemptId: attempt.id, groupId: { not: null } },
                _count: { _all: true },
              })
            )
              .filter((item) => item.groupId)
              .map((item) => [item.groupId!, item._count._all]),
          )
        : new Map<string, number>();

    return {
      id: exercise.id,
      lessonId: exercise.lessonId,
      courseSlug: exercise.lesson.course.slug,
      lessonSlug: exercise.lesson.slug,
      title: exercise.title,
      type: exercise.type,
      progressLabel:
        exercise.type === ExerciseType.DICTATION
          ? "Dictation"
          : `1 / ${exercise.groups.flatMap((group) => group.questions).length || 1}`,
      maxListenCount: exercise.maxPlays,
      maxAttemptCount: exercise.maxAttempts,
      passThreshold: Number(exercise.passThreshold),
      audio:
        exercise.type === ExerciseType.DICTATION
          ? this.mediaDto(exercise.finalAudioMedia)
          : undefined,
      attempt: {
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        listenCount: attempt.playCount,
        status: attempt.status,
        answers: attempt.answers.map((answer) => ({
          questionId: answer.questionId,
          value: answer.selectedOptionId ?? answer.studentText ?? "",
        })),
      },
      toeicPart: exercise.toeicPart ?? undefined,
      groups:
        exercise.type === ExerciseType.TOEIC
          ? exercise.groups.map((group) => ({
              id: group.id,
              listenCount: groupListenCounts.get(group.id) ?? 0,
              audio: this.mediaDto(group.sharedAudio),
              image: group.image ? this.mediaUrl(group.image.id) : undefined,
              questions: group.questions.map((question) => ({
                id: question.id,
                ...(exercise.toeicPart === ToeicPart.PART_1 ||
                exercise.toeicPart === ToeicPart.PART_2
                  ? {}
                  : { prompt: question.questionText }),
                image: question.image
                  ? this.mediaUrl(question.image.id)
                  : undefined,
                options: question.options.map((option) => ({
                  id: option.id,
                  label: option.label,
                  ...(exercise.toeicPart === ToeicPart.PART_1 ||
                  exercise.toeicPart === ToeicPart.PART_2
                    ? {}
                    : { text: option.content }),
                })),
              })),
            }))
          : undefined,
    };
  }

  async consumeListen(
    user: AuthenticatedUser,
    exerciseId: string,
    attemptId: string,
    playbackSpeed?: number,
    groupId?: string,
  ) {
    await this.attemptAccess.assertOwner(user, attemptId);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const attempt = await tx.listeningAttempt.findUniqueOrThrow({
            where: { id: attemptId },
            include: {
              exercise: { select: { maxPlays: true, type: true } },
            },
          });
          this.assertEditable(attempt.status, attempt.exerciseId, exerciseId);
          const isToeic = attempt.exercise.type === ExerciseType.TOEIC;
          if (isToeic && !groupId) {
            throw new AppException(
              "TOEIC_GROUP_REQUIRED",
              "A TOEIC stimulus group is required to record playback.",
              422,
            );
          }
          if (!isToeic && groupId) {
            throw new AppException(
              "INVALID_LISTEN_SCOPE",
              "Dictation playback must not specify an exercise group.",
              422,
            );
          }
          if (isToeic) {
            const group = await tx.exerciseGroup.findFirst({
              where: { id: groupId, exerciseId },
              select: { id: true },
            });
            if (!group) {
              throw new AppException(
                "INVALID_EXERCISE_GROUP",
                "The playback group does not belong to this exercise.",
                422,
              );
            }
          }
          const listenCount = isToeic
            ? await tx.attemptListenEvent.count({
                where: { attemptId, groupId },
              })
            : attempt.playCount;
          if (listenCount >= attempt.exercise.maxPlays) {
            throw new AppException(
              "LISTEN_LIMIT_REACHED",
              "You have reached the listening limit.",
              409,
            );
          }
          const nextTotal = attempt.playCount + 1;
          const nextListenCount = listenCount + 1;
          await tx.attemptListenEvent.create({
            data: {
              attemptId,
              groupId: isToeic ? groupId : undefined,
              playNumber: nextTotal,
              playbackSpeed,
            },
          });
          await tx.listeningAttempt.update({
            where: { id: attemptId },
            data: { playCount: nextTotal },
          });
          return {
            listenCount: nextListenCount,
            maximum: attempt.exercise.maxPlays,
            totalListenCount: nextTotal,
            groupId: isToeic ? groupId : null,
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (!this.isTransactionConflict(error)) throw error;
      throw new AppException(
        "LISTEN_CONSUMPTION_CONFLICT",
        "Another listen was recorded at the same time. Refresh before retrying.",
        409,
      );
    }
  }

  async saveDraft(
    user: AuthenticatedUser,
    exerciseId: string,
    attemptId: string,
    answers: DraftAnswerDto[],
  ) {
    await this.attemptAccess.assertOwner(user, attemptId);
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.listeningAttempt.findUniqueOrThrow({
        where: { id: attemptId },
        include: {
          exercise: {
            include: {
              questions: { include: { options: true } },
            },
          },
        },
      });
      this.assertEditable(attempt.status, attempt.exerciseId, exerciseId);
      const questions = attempt.exercise.questions;
      const resolved = answers.map((answer) => {
        const question = answer.questionId
          ? questions.find((candidate) => candidate.id === answer.questionId)
          : questions.find((candidate) => candidate.correctText !== null);
        if (!question) {
          throw new AppException(
            "INVALID_ANSWER",
            "An answer references a question outside this exercise.",
            422,
          );
        }
        if (attempt.exercise.type === ExerciseType.TOEIC) {
          if (!question.options.some((option) => option.id === answer.value)) {
            throw new AppException(
              "INVALID_OPTION",
              "A selected option does not belong to its question.",
              422,
            );
          }
          return {
            questionId: question.id,
            selectedOptionId: answer.value,
            studentText: null,
          };
        }
        return {
          questionId: question.id,
          selectedOptionId: null,
          studentText: answer.value,
        };
      });
      await tx.attemptAnswer.deleteMany({ where: { attemptId } });
      if (resolved.length) {
        await tx.attemptAnswer.createMany({
          data: resolved.map((answer) => ({ attemptId, ...answer })),
        });
      }
      return {
        id: attempt.id,
        status: attempt.status,
        answers: resolved.map((answer) => ({
          questionId: answer.questionId,
          value: answer.selectedOptionId ?? answer.studentText ?? "",
        })),
      };
    });
  }

  async submitDictation(
    user: AuthenticatedUser,
    exerciseId: string,
    attemptId: string,
    studentAnswer: string,
  ) {
    await this.attemptAccess.assertOwner(user, attemptId);
    const existing = await this.prisma.listeningAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { status: true, exerciseId: true },
    });
    if (existing.exerciseId !== exerciseId) {
      throw new AppException(
        "ATTEMPT_EXERCISE_MISMATCH",
        "Attempt does not match exercise.",
        409,
      );
    }
    if (existing.status === AttemptStatus.GRADED)
      return this.dictationResult(attemptId);

    await this.gradingTransaction(attemptId, async (tx) => {
      const attempt = await tx.listeningAttempt.findUniqueOrThrow({
        where: { id: attemptId },
        include: {
          exercise: {
            include: { questions: true, lesson: true },
          },
        },
      });
      this.assertEditable(attempt.status, attempt.exerciseId, exerciseId);
      if (attempt.exercise.type !== ExerciseType.DICTATION) {
        throw new AppException(
          "EXERCISE_TYPE_MISMATCH",
          "This is not a dictation exercise.",
          422,
        );
      }
      const question = attempt.exercise.questions.find(
        (item) => item.correctText !== null,
      );
      if (!question?.correctText) {
        throw new AppException(
          "EXERCISE_NOT_GRADABLE",
          "Dictation answer is not configured.",
          409,
        );
      }
      const scored = this.dictationScoring.score(
        studentAnswer,
        question.correctText,
        {
          ignoreCapitalization: attempt.exercise.ignoreCapitalization,
          ignorePunctuation: attempt.exercise.ignorePunctuation,
          ignoreExtraSpaces: attempt.exercise.ignoreExtraSpaces,
          allowMinorTypo: attempt.exercise.allowMinorTypo,
        },
      );
      const passed = scored.score >= Number(attempt.exercise.passThreshold);
      const settingsSnapshot = {
        ignoreCapitalization: attempt.exercise.ignoreCapitalization,
        ignorePunctuation: attempt.exercise.ignorePunctuation,
        ignoreExtraSpaces: attempt.exercise.ignoreExtraSpaces,
        allowMinorTypo: attempt.exercise.allowMinorTypo,
      };
      const feedbackSnapshot = {
        feedbackSegments: scored.feedbackSegments,
        normalizedExpected: scored.normalizedExpected,
        normalizedStudent: scored.normalizedStudent,
        correctWords: scored.correctWords,
        totalWords: scored.totalWords,
        settings: settingsSnapshot,
        passThreshold: Number(attempt.exercise.passThreshold),
        showAnswerAfterSubmit: attempt.exercise.showAnswerAfterSubmit,
      };
      await tx.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: question.id } },
        create: {
          attemptId,
          questionId: question.id,
          studentText: studentAnswer,
          correctText: question.correctText,
          score: scored.score,
          isCorrect: passed,
          feedback: feedbackSnapshot as unknown as Prisma.InputJsonValue,
        },
        update: {
          studentText: studentAnswer,
          correctText: question.correctText,
          score: scored.score,
          isCorrect: passed,
          feedback: feedbackSnapshot as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.listeningAttempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.GRADED,
          score: scored.score,
          passed,
          submittedAt: new Date(),
          gradedAt: new Date(),
          durationSeconds: Math.max(
            0,
            Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000),
          ),
        },
      });
      await this.updateProgress(
        tx,
        attempt.exercise.lessonId,
        user.id,
        scored.score,
      );
    });
    return this.dictationResult(attemptId);
  }

  async submitToeic(
    user: AuthenticatedUser,
    exerciseId: string,
    attemptId: string,
    submitted: Record<string, string>,
  ) {
    await this.attemptAccess.assertOwner(user, attemptId);
    const existing = await this.prisma.listeningAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { status: true, exerciseId: true },
    });
    if (existing.exerciseId !== exerciseId) {
      throw new AppException(
        "ATTEMPT_EXERCISE_MISMATCH",
        "Attempt does not match exercise.",
        409,
      );
    }
    if (existing.status === AttemptStatus.GRADED)
      return this.toeicResult(attemptId);

    await this.gradingTransaction(attemptId, async (tx) => {
      const attempt = await tx.listeningAttempt.findUniqueOrThrow({
        where: { id: attemptId },
        include: {
          exercise: {
            include: {
              lesson: true,
              questions: { include: { options: true } },
            },
          },
        },
      });
      this.assertEditable(attempt.status, attempt.exerciseId, exerciseId);
      if (attempt.exercise.type !== ExerciseType.TOEIC) {
        throw new AppException(
          "EXERCISE_TYPE_MISMATCH",
          "This is not a TOEIC exercise.",
          422,
        );
      }
      const questions = attempt.exercise.questions;
      if (
        questions.length === 0 ||
        questions.some(
          (question) =>
            !submitted[question.id] ||
            !question.options.some(
              (option) => option.id === submitted[question.id],
            ),
        )
      ) {
        throw new AppException(
          "INCOMPLETE_OR_INVALID_ANSWERS",
          "Every question must have a valid selected option.",
          422,
        );
      }
      const scored = this.toeicScoring.score(questions, submitted);
      const passed = scored.score >= Number(attempt.exercise.passThreshold);
      await tx.attemptAnswer.deleteMany({ where: { attemptId } });
      await tx.attemptAnswer.createMany({
        data: scored.answers.map((answer) => {
          const question = questions.find(
            (item) => item.id === answer.questionId,
          )!;
          const selected = question.options.find(
            (option) => option.id === answer.selectedOptionId,
          );
          const correct = question.options.find(
            (option) => option.id === answer.correctOptionId,
          );
          return {
            attemptId,
            questionId: answer.questionId,
            selectedOptionId: answer.selectedOptionId,
            isCorrect: answer.isCorrect,
            score: answer.isCorrect ? 100 : 0,
            feedback: {
              selectedOptionId: answer.selectedOptionId,
              selectedOptionLabel: selected?.label ?? "",
              selectedOptionText: selected?.content ?? "",
              correctOptionId: answer.correctOptionId,
              correctOptionLabel: correct?.label ?? "",
              correctOptionText: correct?.content ?? "",
              explanation: answer.explanation,
              isCorrect: answer.isCorrect,
              passThreshold: Number(attempt.exercise.passThreshold),
              showAnswerAfterSubmit: attempt.exercise.showAnswerAfterSubmit,
              showTranscript: attempt.exercise.showTranscript,
              toeicPart: attempt.exercise.toeicPart,
            },
          };
        }),
      });
      await tx.listeningAttempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.GRADED,
          score: scored.score,
          passed,
          submittedAt: new Date(),
          gradedAt: new Date(),
          durationSeconds: Math.max(
            0,
            Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000),
          ),
        },
      });
      await this.updateProgress(
        tx,
        attempt.exercise.lessonId,
        user.id,
        scored.score,
      );
    });
    return this.toeicResult(attemptId);
  }

  async result(user: AuthenticatedUser, exerciseId: string, attemptId: string) {
    await this.attemptAccess.assertView(user, attemptId);
    const attempt = await this.prisma.listeningAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { exerciseId: true },
    });
    if (attempt.exerciseId !== exerciseId) {
      throw new AppException(
        "ATTEMPT_EXERCISE_MISMATCH",
        "Attempt does not match exercise.",
        409,
      );
    }
    const exercise = await this.prisma.listeningExercise.findUniqueOrThrow({
      where: { id: exerciseId },
      select: {
        type: true,
        title: true,
        lesson: { select: { slug: true, course: { select: { slug: true } } } },
      },
    });
    const info = {
      title: exercise.title,
      courseSlug: exercise.lesson.course.slug,
      lessonSlug: exercise.lesson.slug,
    };
    return exercise.type === ExerciseType.DICTATION
      ? {
          type: ExerciseType.DICTATION,
          result: await this.dictationResult(attemptId),
          exercise: info,
        }
      : {
          type: ExerciseType.TOEIC,
          result: await this.toeicResult(attemptId),
          exercise: info,
        };
  }

  async history(user: AuthenticatedUser) {
    const attempts = await this.prisma.listeningAttempt.findMany({
      where: { studentId: user.id, status: AttemptStatus.GRADED },
      include: {
        exercise: { include: { lesson: { include: { course: true } } } },
      },
      orderBy: { submittedAt: "desc" },
    });
    return attempts.map((attempt) => ({
      id: attempt.id,
      attemptId: attempt.id,
      exerciseId: attempt.exerciseId,
      exerciseTitle: attempt.exercise.title,
      courseTitle: attempt.exercise.lesson.course.title,
      type: attempt.exercise.type,
      score: Number(attempt.score ?? 0),
      passed: Boolean(attempt.passed),
      attemptNumber: attempt.attemptNumber,
      submittedAt:
        attempt.submittedAt?.toISOString() ?? attempt.updatedAt.toISOString(),
    }));
  }

  async adminList(user: AuthenticatedUser) {
    const courseIds =
      user.role === UserRole.TEACHER
        ? await this.courseAccess.assignedCourseIds(user.id)
        : undefined;
    const attempts = await this.prisma.listeningAttempt.findMany({
      where: {
        status: AttemptStatus.GRADED,
        exercise: courseIds
          ? { lesson: { courseId: { in: courseIds } } }
          : undefined,
      },
      include: {
        student: true,
        exercise: { include: { lesson: { include: { course: true } } } },
      },
      orderBy: { submittedAt: "desc" },
      take: 250,
    });
    return attempts.map((attempt) => ({
      id: attempt.id,
      studentName: attempt.student.fullName,
      exerciseTitle: attempt.exercise.title,
      courseTitle: attempt.exercise.lesson.course.title,
      courseId: attempt.exercise.lesson.courseId,
      type: attempt.exercise.type,
      score: Number(attempt.score ?? 0),
      passed: Boolean(attempt.passed),
      listenCount: attempt.playCount,
      attemptNumber: attempt.attemptNumber,
      submittedAt:
        attempt.submittedAt?.toISOString() ?? attempt.updatedAt.toISOString(),
    }));
  }

  async adminDetail(user: AuthenticatedUser, attemptId: string) {
    const attempt = await this.prisma.listeningAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: { select: { id: true, fullName: true, email: true } },
        listenEvents: { select: { groupId: true } },
        exercise: {
          include: {
            groups: {
              orderBy: { orderIndex: "asc" },
              select: { id: true, title: true, label: true },
            },
            lesson: {
              include: { course: { select: { id: true, title: true } } },
            },
          },
        },
      },
    });
    if (!attempt) {
      throw new AppException("ATTEMPT_NOT_FOUND", "Attempt not found.", 404);
    }
    if (user.role === UserRole.TEACHER) {
      await this.courseAccess.assertManage(
        user,
        attempt.exercise.lesson.course.id,
      );
    }
    if (attempt.status !== AttemptStatus.GRADED) {
      throw new AppException(
        "RESULT_NOT_READY",
        "This attempt has not been graded.",
        409,
      );
    }
    const result =
      attempt.exercise.type === ExerciseType.DICTATION
        ? await this.dictationResult(attemptId)
        : await this.toeicResult(attemptId);
    return {
      id: attempt.id,
      status: attempt.status,
      type: attempt.exercise.type,
      score: Number(attempt.score ?? 0),
      passed: Boolean(attempt.passed),
      listenCount: attempt.playCount,
      maxListens: attempt.exercise.maxPlays,
      ...(attempt.exercise.type === ExerciseType.TOEIC
        ? {
            listenBreakdown: attempt.exercise.groups.map((group, index) => ({
              groupId: group.id,
              label:
                group.label?.trim() ||
                group.title?.trim() ||
                `Group ${index + 1}`,
              listenCount: attempt.listenEvents.filter(
                (event) => event.groupId === group.id,
              ).length,
              maximum: attempt.exercise.maxPlays,
            })),
          }
        : {}),
      attemptNumber: attempt.attemptNumber,
      submittedAt:
        attempt.submittedAt?.toISOString() ?? attempt.updatedAt.toISOString(),
      student: attempt.student,
      exercise: {
        id: attempt.exercise.id,
        title: attempt.exercise.title,
        courseId: attempt.exercise.lesson.course.id,
        courseTitle: attempt.exercise.lesson.course.title,
      },
      result,
    };
  }

  private async dictationResult(attemptId: string) {
    const attempt = await this.gradedAttempt(attemptId);
    if (attempt.exercise.type !== ExerciseType.DICTATION) {
      throw new AppException(
        "EXERCISE_TYPE_MISMATCH",
        "This is not a dictation result.",
        422,
      );
    }
    const answer = attempt.answers[0];
    const correctAnswer = answer?.correctText ?? "";
    const studentAnswer = answer?.studentText ?? "";
    const snapshot = this.jsonRecord(answer?.feedback);
    const feedbackSegments = Array.isArray(snapshot.feedbackSegments)
      ? snapshot.feedbackSegments
      : Array.isArray(answer?.feedback)
        ? answer.feedback
        : [];
    const correctWords =
      typeof snapshot.correctWords === "number"
        ? snapshot.correctWords
        : feedbackSegments.filter(
            (segment) => this.jsonRecord(segment).type === "CORRECT",
          ).length;
    const totalWords =
      typeof snapshot.totalWords === "number"
        ? snapshot.totalWords
        : correctAnswer.trim().split(/\s+/u).filter(Boolean).length;
    const threshold =
      typeof snapshot.passThreshold === "number"
        ? snapshot.passThreshold
        : Number(attempt.exercise.passThreshold);
    const showAnswer =
      typeof snapshot.showAnswerAfterSubmit === "boolean"
        ? snapshot.showAnswerAfterSubmit
        : attempt.exercise.showAnswerAfterSubmit;
    return {
      attemptId,
      score: Number(attempt.score ?? 0),
      passed: Boolean(attempt.passed),
      threshold,
      accuracy: { correctWords, totalWords },
      studentAnswer,
      correctAnswer: showAnswer ? correctAnswer : "",
      feedbackSegments: showAnswer ? feedbackSegments : [],
      feedbackMessage: attempt.passed
        ? "Great listening! You’re picking up the important details."
        : "Listen for short connecting words and try one more time.",
    };
  }

  private async toeicResult(attemptId: string) {
    const attempt = await this.gradedAttempt(attemptId);
    if (attempt.exercise.type !== ExerciseType.TOEIC) {
      throw new AppException(
        "EXERCISE_TYPE_MISMATCH",
        "This is not a TOEIC result.",
        422,
      );
    }
    const snapshots = attempt.answers.map((answer) => {
      const snapshot = this.jsonRecord(answer.feedback);
      const question = attempt.exercise.questions.find(
        (item) => item.id === answer.questionId,
      );
      const selectedOption = question?.options.find(
        (option) => option.id === answer.selectedOptionId,
      );
      const correctOption = question?.options.find(
        (option) => option.isCorrect,
      );
      return {
        questionId: answer.questionId,
        selectedOptionId:
          typeof snapshot.selectedOptionId === "string"
            ? snapshot.selectedOptionId
            : (answer.selectedOptionId ?? ""),
        selectedOptionText:
          typeof snapshot.selectedOptionText === "string"
            ? snapshot.selectedOptionText
            : (selectedOption?.content ?? ""),
        selectedOptionLabel:
          typeof snapshot.selectedOptionLabel === "string"
            ? snapshot.selectedOptionLabel
            : (selectedOption?.label ?? ""),
        correctOptionId:
          typeof snapshot.correctOptionId === "string"
            ? snapshot.correctOptionId
            : "",
        correctOptionText:
          typeof snapshot.correctOptionText === "string"
            ? snapshot.correctOptionText
            : (correctOption?.content ?? ""),
        correctOptionLabel:
          typeof snapshot.correctOptionLabel === "string"
            ? snapshot.correctOptionLabel
            : (correctOption?.label ?? ""),
        explanation:
          typeof snapshot.explanation === "string" ? snapshot.explanation : "",
        isCorrect:
          typeof snapshot.isCorrect === "boolean"
            ? snapshot.isCorrect
            : Boolean(answer.isCorrect),
        passThreshold:
          typeof snapshot.passThreshold === "number"
            ? snapshot.passThreshold
            : Number(attempt.exercise.passThreshold),
        showAnswerAfterSubmit:
          typeof snapshot.showAnswerAfterSubmit === "boolean"
            ? snapshot.showAnswerAfterSubmit
            : attempt.exercise.showAnswerAfterSubmit,
        showTranscript:
          typeof snapshot.showTranscript === "boolean"
            ? snapshot.showTranscript
            : attempt.exercise.showTranscript,
        toeicPart:
          typeof snapshot.toeicPart === "string"
            ? snapshot.toeicPart
            : attempt.exercise.toeicPart,
      };
    });
    const correctCount = snapshots.filter((answer) => answer.isCorrect).length;
    const totalQuestions = snapshots.length;
    const showAnswer = snapshots[0]?.showAnswerAfterSubmit ?? false;
    const showTranscript = snapshots[0]?.showTranscript ?? false;
    return {
      attemptId,
      score: Number(attempt.score ?? 0),
      passed: Boolean(attempt.passed),
      threshold:
        snapshots[0]?.passThreshold ?? Number(attempt.exercise.passThreshold),
      correctCount,
      totalQuestions,
      partBreakdown: [
        {
          part: snapshots[0]?.toeicPart?.replace("_", " ") ?? "TOEIC",
          correct: correctCount,
          total: totalQuestions,
        },
      ],
      strengths: correctCount
        ? ["Detail recognition", "Question focus"]
        : ["You completed the full set"],
      improvements:
        correctCount === totalQuestions
          ? ["Keep practicing under time pressure"]
          : ["Listen for purpose and context", "Review distractor options"],
      answerReviewEnabled: showAnswer,
      answers: snapshots.map((answer) =>
        showAnswer
          ? answer
          : {
              questionId: answer.questionId,
              selectedOptionId: answer.selectedOptionId,
              isCorrect: answer.isCorrect,
            },
      ),
      ...(showTranscript
        ? { transcripts: this.toeicTranscripts(attempt.exercise) }
        : {}),
    };
  }

  private gradedAttempt(attemptId: string) {
    return this.prisma.listeningAttempt
      .findUniqueOrThrow({
        where: { id: attemptId },
        include: {
          answers: true,
          exercise: {
            include: {
              groups: {
                orderBy: { orderIndex: "asc" },
                include: {
                  questions: {
                    orderBy: { orderIndex: "asc" },
                    include: {
                      options: { orderBy: { orderIndex: "asc" } },
                    },
                  },
                },
              },
              audioSegments: { orderBy: { orderIndex: "asc" } },
              questions: {
                orderBy: { orderIndex: "asc" },
                include: { options: { orderBy: { orderIndex: "asc" } } },
              },
            },
          },
        },
      })
      .then((attempt) => {
        if (attempt.status !== AttemptStatus.GRADED) {
          throw new AppException(
            "RESULT_NOT_READY",
            "This attempt has not been graded.",
            409,
          );
        }
        return attempt;
      });
  }

  private toeicTranscripts(exercise: TranscriptExercise) {
    return exercise.groups.flatMap((group, index) => {
      let text = "";
      const segments = exercise.audioSegments.filter(
        (segment) => segment.groupId === group.id && segment.text.trim(),
      );
      if (segments.length) {
        text = segments
          .map((segment) => {
            const label =
              segment.speakerLabel?.trim() ||
              segment.speakerKey?.trim() ||
              (segment.segmentType === "QUESTION"
                ? "Question"
                : segment.segmentType === "OPTION"
                  ? "Option"
                  : "Speaker");
            return `${label}: ${segment.text.trim()}`;
          })
          .join("\n");
      } else if (
        exercise.toeicPart === ToeicPart.PART_1 ||
        exercise.toeicPart === ToeicPart.PART_2
      ) {
        // For Parts 1 and 2 the complete spoken stimulus lives in the
        // structured question/options. Do not prefer a partial sharedScript
        // that may accidentally reveal only the correct response.
        text = group.questions
          .flatMap((question) => [
            ...(exercise.toeicPart === ToeicPart.PART_2 &&
            question.questionText.trim()
              ? [`Question: ${question.questionText.trim()}`]
              : []),
            ...question.options.map(
              (option) => `${option.label}: ${option.content.trim()}`,
            ),
          ])
          .join("\n");
      } else {
        text = group.sharedScript?.trim() ?? "";
      }
      if (!text) return [];
      return [
        {
          groupId: group.id,
          label:
            group.label?.trim() || group.title?.trim() || `Group ${index + 1}`,
          text,
        },
      ];
    });
  }

  private assertEditable(
    status: AttemptStatus,
    actualExerciseId: string,
    expectedExerciseId: string,
  ) {
    if (actualExerciseId !== expectedExerciseId) {
      throw new AppException(
        "ATTEMPT_EXERCISE_MISMATCH",
        "Attempt does not match exercise.",
        409,
      );
    }
    if (status !== AttemptStatus.IN_PROGRESS) {
      throw new AppException(
        "ATTEMPT_ALREADY_SUBMITTED",
        "This attempt can no longer be edited.",
        409,
      );
    }
  }

  private mediaUrl(id: string): string {
    return `/api/v1/media/files/${id}`;
  }

  private jsonRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private async gradingTransaction(
    attemptId: string,
    work: (tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(work, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      const isAlreadySubmitted =
        error instanceof AppException &&
        error.code === "ATTEMPT_ALREADY_SUBMITTED";
      if (this.isTransactionConflict(error) || isAlreadySubmitted) {
        const current = await this.prisma.listeningAttempt.findUnique({
          where: { id: attemptId },
          select: { status: true },
        });
        if (current?.status === AttemptStatus.GRADED) return;
        throw new AppException(
          "ATTEMPT_SUBMISSION_CONFLICT",
          "Another submission is being processed. Please retry.",
          409,
        );
      }
      throw error;
    }
  }

  private isTransactionConflict(error: unknown): boolean {
    if (error === null || typeof error !== "object" || !("code" in error)) {
      return false;
    }
    return error.code === "P2002" || error.code === "P2034";
  }

  private mediaDto(
    media: { id: string; durationMs: number | null; mimeType: string } | null,
  ) {
    return media
      ? {
          id: media.id,
          url: this.mediaUrl(media.id),
          duration: Math.ceil((media.durationMs ?? 0) / 1000),
          mimeType: media.mimeType,
        }
      : undefined;
  }

  private async updateProgress(
    tx: Prisma.TransactionClient,
    lessonId: string,
    studentId: string,
    score: number,
  ) {
    const lesson = await tx.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: {
        courseId: true,
        exercises: {
          where: { status: ContentStatus.PUBLISHED },
          select: { id: true },
        },
      },
    });
    const passed = await tx.listeningAttempt.groupBy({
      by: ["exerciseId"],
      where: {
        studentId,
        passed: true,
        exerciseId: { in: lesson.exercises.map((exercise) => exercise.id) },
      },
    });
    const percent = Math.round(
      (passed.length / Math.max(1, lesson.exercises.length)) * 100,
    );
    const currentProgress = await tx.lessonProgress.findUnique({
      where: { lessonId_studentId: { lessonId, studentId } },
      select: { bestScore: true, completedAt: true },
    });
    const bestScore = Math.max(Number(currentProgress?.bestScore ?? 0), score);
    await tx.lessonProgress.upsert({
      where: { lessonId_studentId: { lessonId, studentId } },
      create: {
        lessonId,
        studentId,
        status:
          percent >= 100
            ? ProgressStatus.COMPLETED
            : ProgressStatus.IN_PROGRESS,
        progressPercent: percent,
        bestScore,
        startedAt: new Date(),
        lastOpenedAt: new Date(),
        completedAt: percent >= 100 ? new Date() : null,
      },
      update: {
        status:
          percent >= 100
            ? ProgressStatus.COMPLETED
            : ProgressStatus.IN_PROGRESS,
        progressPercent: percent,
        bestScore,
        lastOpenedAt: new Date(),
        completedAt:
          percent >= 100 ? (currentProgress?.completedAt ?? new Date()) : null,
      },
    });
    const lessons = await tx.lesson.findMany({
      where: { courseId: lesson.courseId, status: ContentStatus.PUBLISHED },
      select: { id: true },
    });
    const completed = await tx.lessonProgress.count({
      where: {
        studentId,
        lessonId: { in: lessons.map((item) => item.id) },
        status: ProgressStatus.COMPLETED,
      },
    });
    const coursePercent = Math.round(
      (completed / Math.max(1, lessons.length)) * 100,
    );
    await tx.courseEnrollment.upsert({
      where: { courseId_studentId: { courseId: lesson.courseId, studentId } },
      create: {
        courseId: lesson.courseId,
        studentId,
        progressPercent: coursePercent,
        status:
          coursePercent >= 100
            ? EnrollmentStatus.COMPLETED
            : EnrollmentStatus.ACTIVE,
        completedAt: coursePercent >= 100 ? new Date() : null,
        lastAccessedAt: new Date(),
      },
      update: {
        progressPercent: coursePercent,
        status:
          coursePercent >= 100
            ? EnrollmentStatus.COMPLETED
            : EnrollmentStatus.ACTIVE,
        completedAt: coursePercent >= 100 ? new Date() : null,
        lastAccessedAt: new Date(),
      },
    });
  }
}

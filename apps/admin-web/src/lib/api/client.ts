import { BrowserApiTransport } from "@listenup/api-client";
import type {
  AdminAttemptDto,
  AdminCourseDto,
  AdminExerciseDto,
  AdminSessionDto,
  AdminStudentDto,
  AdminTeacherDto,
  AdminUser,
  LandingSectionDto,
  TtsJobDto,
  TtsJobStatus,
} from "@listenup/domain";
import { AdminApiError } from "./errors";
import { adminMockApi } from "./mock-service";

const useMock = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const http = new BrowserApiTransport({
  baseUrl: apiBase,
  clientType: "ADMIN_WEB",
  storageKey: "listenup-admin-session-v1",
  createError: (payload, status) =>
    new AdminApiError(
      payload.code ?? "REQUEST_FAILED",
      Array.isArray(payload.details?.errors)
        ? payload.details.errors.join(" ")
        : (payload.message ?? "Request failed."),
      status,
      payload.details,
    ),
});

const levelEnum = (value?: string) =>
  (value ?? "Intermediate").trim().replace(/\s+/g, "_").toUpperCase();

export const adminAuthApi = useMock
  ? {
      login: adminMockApi.login,
      refresh: async () => ({ ok: true }),
      logout: async () => ({ ok: true }),
    }
  : {
      login: (email: string, password: string) =>
        http.request<AdminSessionDto>("/auth/login", {
          method: "POST",
          body: { email, password, clientType: "ADMIN_WEB" },
          retry: false,
        }),
      refresh: () =>
        http.request<AdminSessionDto>("/auth/refresh", {
          method: "POST",
          body: { clientType: "ADMIN_WEB" },
          retry: false,
        }),
      logout: () =>
        http.request<void>("/auth/logout", {
          method: "POST",
          body: { clientType: "ADMIN_WEB" },
          retry: false,
        }),
    };

export const adminPasswordRecoveryApi = {
  forgot: (email: string) =>
    useMock
      ? Promise.resolve({
          message:
            "If the account exists, password reset instructions have been created.",
        })
      : http.request<{ message: string }>("/auth/forgot-password", {
          method: "POST",
          body: { email },
          auth: false,
          retry: false,
        }),
  reset: (token: string, newPassword: string) =>
    useMock
      ? token
        ? Promise.resolve()
        : Promise.reject(
            new AdminApiError(
              "INVALID_RESET_TOKEN",
              "Password reset token is invalid or expired.",
              401,
            ),
          )
      : http.request<void>("/auth/reset-password", {
          method: "POST",
          body: { token, newPassword },
          auth: false,
          retry: false,
        }),
};

export const adminDashboardApi = {
  get: useMock
    ? adminMockApi.dashboard
    : (_user: AdminUser) =>
        http.request<Awaited<ReturnType<typeof adminMockApi.dashboard>>>(
          "/admin/dashboard",
        ),
};

export const adminCoursesApi = {
  list: useMock
    ? adminMockApi.courses
    : async (_user: AdminUser) =>
        (await http.request<{ data: AdminCourseDto[] }>("/admin/courses")).data,
  get: useMock
    ? adminMockApi.course
    : (_user: AdminUser, id: string) =>
        http.request<AdminCourseDto>(`/admin/courses/${id}`),
  save: useMock
    ? adminMockApi.saveCourse
    : (_user: AdminUser, input: Partial<AdminCourseDto> & { title: string }) =>
        http.request<AdminCourseDto>(
          input.id ? `/admin/courses/${input.id}` : "/admin/courses",
          {
            method: input.id ? "PATCH" : "POST",
            body: {
              title: input.title,
              slug: input.slug,
              description: input.description,
              level: levelEnum(input.level),
              category: input.category,
              visibility: input.visibility,
              orderIndex: input.orderIndex,
              thumbnailMediaId: input.thumbnailMediaId || undefined,
              ...(_user.role === "ADMIN"
                ? { assignedTeacherIds: input.assignedTeacherIds ?? [] }
                : {}),
            },
          },
        ),
  publish: useMock
    ? adminMockApi.publishCourse
    : (_user: AdminUser, id: string) =>
        http.request<AdminCourseDto>(`/admin/courses/${id}/publish`, {
          method: "POST",
          body: {},
        }),
};

export const adminStudentsApi = {
  list: useMock
    ? adminMockApi.students
    : (_user: AdminUser) => http.request<AdminStudentDto[]>("/admin/students"),
  get: useMock
    ? adminMockApi.student
    : (_user: AdminUser, id: string) =>
        http.request<AdminStudentDto>(`/admin/students/${id}`),
};
export const adminTeachersApi = {
  list: useMock
    ? adminMockApi.teachers
    : (_user: AdminUser) => http.request<AdminTeacherDto[]>("/admin/teachers"),
  get: useMock
    ? async (_user: AdminUser, id: string) =>
        (await adminMockApi.teachers(_user)).find(
          (teacher) => teacher.id === id,
        ) ?? null
    : (_user: AdminUser, id: string) =>
        http.request<AdminTeacherDto | null>(`/admin/teachers/${id}`),
  save: async (
    _user: AdminUser,
    input: {
      id?: string;
      fullName: string;
      email: string;
      password?: string;
      status: string;
      notes: string;
      assignedCourseIds: string[];
    },
  ) => {
    if (useMock) return adminMockApi.teachers(_user).then((items) => items[0]);
    const teacher = input.id
      ? await http.request<AdminTeacherDto>(`/admin/teachers/${input.id}`, {
          method: "PATCH",
          body: {
            fullName: input.fullName,
            status: input.status,
            notes: input.notes,
          },
        })
      : await http.request<AdminTeacherDto>("/admin/teachers", {
          method: "POST",
          body: {
            fullName: input.fullName,
            email: input.email,
            password: input.password,
            notes: input.notes,
          },
        });
    const current = new Set(teacher.assignedCourseIds);
    const desired = new Set(input.assignedCourseIds);
    await Promise.all([
      ...[...desired]
        .filter((courseId) => !current.has(courseId))
        .map((courseId) =>
          http.request(`/admin/courses/${courseId}/assignments`, {
            method: "POST",
            body: { teacherId: teacher.id },
          }),
        ),
      ...[...current]
        .filter((courseId) => !desired.has(courseId))
        .map((courseId) =>
          http.request(`/admin/courses/${courseId}/assignments/${teacher.id}`, {
            method: "DELETE",
          }),
        ),
    ]);
    return http.request<AdminTeacherDto>(`/admin/teachers/${teacher.id}`);
  },
};
export interface AdminLessonSummary {
  id: string;
  slug: string;
  title: string;
  status: string;
  orderIndex: number;
}
export interface LessonDraft extends AdminLessonSummary {
  courseId: string;
  description: string;
  content: Record<string, unknown>;
  estimatedDurationMinutes: number;
  vocabulary: Array<{
    word: string;
    ipa?: string;
    meaning: string;
    example?: string;
  }>;
  expressions: Array<{
    expression: string;
    meaning: string;
    example?: string;
  }>;
  resources: Array<{
    type: string;
    title: string;
    mediaId?: string;
    externalUrl?: string;
  }>;
  exercises: Array<{ id: string; title: string; status: string }>;
}
const mockLessonDraft: LessonDraft = {
  id: "lesson-1",
  courseId: "course-1",
  slug: "introduction-to-listening",
  title: "Introduction to English Listening",
  description: "Build a foundation for focused English listening.",
  content: {
    blocks: [
      {
        type: "paragraph",
        text: "Active listening means paying attention to context and intent.",
      },
    ],
  },
  estimatedDurationMinutes: 15,
  orderIndex: 0,
  status: "DRAFT",
  vocabulary: [],
  expressions: [],
  resources: [],
  exercises: [],
};
export const adminLessonsApi = {
  list: useMock
    ? async (_user: AdminUser, courseId: string) =>
        courseId === mockLessonDraft.courseId ? [mockLessonDraft] : []
    : (_user: AdminUser, courseId: string) =>
        http.request<AdminLessonSummary[]>(
          `/admin/courses/${courseId}/lessons`,
        ),
  get: useMock
    ? async (_user: AdminUser, _courseId: string, _lessonId: string) =>
        mockLessonDraft
    : (_user: AdminUser, courseId: string, lessonId: string) =>
        http.request<LessonDraft>(
          `/admin/courses/${courseId}/lessons/${lessonId}`,
        ),
  save: async (
    _user: AdminUser,
    courseId: string,
    input: Omit<LessonDraft, "id" | "courseId" | "status" | "exercises">,
    lessonId?: string,
  ) => {
    if (useMock) {
      return {
        ...mockLessonDraft,
        ...input,
        id: lessonId ?? mockLessonDraft.id,
        courseId,
      };
    }
    const id =
      lessonId ??
      (
        await http.request<LessonDraft>(`/admin/courses/${courseId}/lessons`, {
          method: "POST",
          body: {
            title: input.title,
            slug: input.slug,
            description: input.description,
            content: input.content,
            estimatedDurationMinutes: input.estimatedDurationMinutes,
            orderIndex: input.orderIndex,
          },
        })
      ).id;
    return http.request<LessonDraft>(
      `/admin/courses/${courseId}/lessons/${id}/draft`,
      {
        method: "PUT",
        body: input,
      },
    );
  },
  publish: useMock
    ? async (_user: AdminUser, _courseId: string, _lessonId: string) => ({
        ...mockLessonDraft,
        status: "PUBLISHED",
      })
    : (_user: AdminUser, courseId: string, lessonId: string) =>
        http.request<LessonDraft>(
          `/admin/courses/${courseId}/lessons/${lessonId}/publish`,
          { method: "POST", body: {} },
        ),
};
export const adminAttemptsApi = {
  list: useMock
    ? adminMockApi.attempts
    : (_user: AdminUser) => http.request<AdminAttemptDto[]>("/admin/attempts"),
  get: useMock
    ? async (user: AdminUser, id: string) => {
        const attempt = (await adminMockApi.attempts(user)).find(
          (item) => item.id === id,
        );
        if (!attempt)
          throw new AdminApiError("NOT_FOUND", "Attempt not found.", 404);
        return {
          ...attempt,
          status: "GRADED",
          maxListens: 3,
          listenBreakdown:
            attempt.type === "TOEIC"
              ? [
                  {
                    groupId: "mock-group",
                    label: "Group 1",
                    listenCount: attempt.listenCount,
                    maximum: 3,
                  },
                ]
              : undefined,
          student: {
            id: "mock-student",
            fullName: attempt.studentName,
            email: "student@listenup.test",
          },
          exercise: {
            id: "mock-exercise",
            title: attempt.exerciseTitle,
            courseId: attempt.courseId,
            courseTitle: attempt.courseTitle,
          },
          result: {
            studentAnswer: "Mock answer",
            correctAnswer: "Mock answer",
          },
        } satisfies AdminAttemptDetail;
      }
    : (_user: AdminUser, id: string) =>
        http.request<AdminAttemptDetail>(`/admin/attempts/${id}`),
};

export interface AdminAttemptDetail {
  id: string;
  status: string;
  type: string;
  score: number;
  passed: boolean;
  listenCount: number;
  maxListens: number;
  listenBreakdown?: Array<{
    groupId: string;
    label: string;
    listenCount: number;
    maximum: number;
  }>;
  attemptNumber: number;
  submittedAt: string;
  student: { id: string; fullName: string; email: string };
  exercise: {
    id: string;
    title: string;
    courseId: string;
    courseTitle: string;
  };
  result: Record<string, unknown>;
}
export interface ExerciseDraft {
  id?: string;
  title: string;
  courseId: string;
  lessonId: string;
  type: string;
  dictationMode: string | null;
  toeicPart: string | null;
  instructions: string;
  orderIndex: number;
  difficulty: string;
  passThreshold: number;
  maxListens: number;
  maxAttempts: number;
  showAnswer: boolean;
  showTranscript: boolean;
  script: string;
  audioReady: boolean;
  audioUrl?: string;
  ttsStatus: string;
  correctText: string;
  ignoreCase: boolean;
  ignorePunctuation: boolean;
  normalizeWhitespace: boolean;
  allowMinorTypo: boolean;
  groups: {
    id: string;
    title: string;
    label: string;
    sharedScript: string;
    imageMediaId: string;
    sharedAudioMediaId: string;
  }[];
  questions: {
    id: string;
    groupId?: string;
    text: string;
    imageMediaId?: string;
    explanation?: string;
    options: { id: string; text: string; correct: boolean }[];
  }[];
  audioSegments: {
    id: string;
    groupId?: string;
    questionId?: string;
    segmentType: string;
    speakerKey: string;
    speakerLabel: string;
    text: string;
    voiceId: string;
    language: string;
    speed: number;
    pauseAfterMs: number;
    mediaId: string;
  }[];
}

export const emptyExerciseDraft: ExerciseDraft = {
  title: "",
  courseId: "",
  lessonId: "",
  type: "DICTATION",
  dictationMode: "SENTENCE",
  toeicPart: null,
  instructions: "Listen and type exactly what you hear.",
  orderIndex: 0,
  difficulty: "Intermediate",
  passThreshold: 80,
  maxListens: 3,
  maxAttempts: 3,
  showAnswer: true,
  showTranscript: false,
  script: "",
  audioReady: false,
  ttsStatus: "CANCELLED",
  correctText: "",
  ignoreCase: true,
  ignorePunctuation: true,
  normalizeWhitespace: true,
  allowMinorTypo: false,
  groups: [],
  questions: [],
  audioSegments: [],
};

interface RawExercise {
  id: string;
  title: string;
  type: string;
  dictationMode: string | null;
  toeicPart: string | null;
  instruction: string;
  orderIndex: number;
  difficulty: string;
  passThreshold: string | number;
  maxPlays: number;
  maxAttempts: number;
  showAnswerAfterSubmit: boolean;
  showTranscript: boolean;
  sourceScript: string | null;
  ignoreCapitalization: boolean;
  ignorePunctuation: boolean;
  ignoreExtraSpaces: boolean;
  allowMinorTypo: boolean;
  lessonId: string;
  lesson: { courseId: string };
  finalAudioMedia: { id: string } | null;
  groups: Array<{
    id: string;
    title: string | null;
    label: string | null;
    sharedScript: string | null;
    imageMediaId: string | null;
    sharedAudioMediaId: string | null;
  }>;
  questions: Array<{
    id: string;
    groupId: string | null;
    questionText: string;
    correctText: string | null;
    imageMediaId: string | null;
    explanation: string | null;
    options: Array<{
      id: string;
      content: string;
      isCorrect: boolean;
    }>;
  }>;
  ttsJobs?: Array<{ status: TtsJobStatus }>;
  audioSegments: Array<{
    id: string;
    groupId: string | null;
    questionId: string | null;
    segmentType: string;
    speakerKey: string | null;
    speakerLabel: string | null;
    text: string;
    voiceId: string | null;
    language: string;
    speed: string | number;
    pauseAfterMs: number;
    mediaId: string | null;
  }>;
}

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join(" ");

const mapExerciseDraft = (exercise: RawExercise): ExerciseDraft => ({
  id: exercise.id,
  title: exercise.title,
  courseId: exercise.lesson.courseId,
  lessonId: exercise.lessonId,
  type: exercise.type,
  dictationMode: exercise.dictationMode,
  toeicPart: exercise.toeicPart,
  instructions: exercise.instruction,
  orderIndex: exercise.orderIndex,
  difficulty: titleCase(exercise.difficulty),
  passThreshold: Number(exercise.passThreshold),
  maxListens: exercise.maxPlays,
  maxAttempts: exercise.maxAttempts,
  showAnswer: exercise.showAnswerAfterSubmit,
  showTranscript: exercise.showTranscript,
  script: exercise.sourceScript ?? "",
  audioReady:
    exercise.type === "DICTATION"
      ? Boolean(exercise.finalAudioMedia)
      : exercise.groups.length > 0 &&
        exercise.groups.every((group) => Boolean(group.sharedAudioMediaId)),
  audioUrl: exercise.finalAudioMedia
    ? `/media/files/${exercise.finalAudioMedia.id}`
    : undefined,
  ttsStatus: exercise.ttsJobs?.[0]?.status ?? "CANCELLED",
  correctText:
    exercise.questions.find((question) => question.correctText)?.correctText ??
    "",
  ignoreCase: exercise.ignoreCapitalization,
  ignorePunctuation: exercise.ignorePunctuation,
  normalizeWhitespace: exercise.ignoreExtraSpaces,
  allowMinorTypo: exercise.allowMinorTypo,
  groups: exercise.groups.map((group) => ({
    id: group.id,
    title: group.title ?? "",
    label: group.label ?? "",
    sharedScript: group.sharedScript ?? "",
    imageMediaId: group.imageMediaId ?? "",
    sharedAudioMediaId: group.sharedAudioMediaId ?? "",
  })),
  questions: exercise.questions
    .filter((question) => question.options.length > 0)
    .map((question) => ({
      id: question.id,
      groupId: question.groupId ?? undefined,
      text: question.questionText,
      imageMediaId: question.imageMediaId ?? undefined,
      explanation: question.explanation ?? undefined,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.content,
        correct: option.isCorrect,
      })),
    })),
  audioSegments: exercise.audioSegments.map((segment) => ({
    id: segment.id,
    groupId: segment.groupId ?? undefined,
    questionId: segment.questionId ?? undefined,
    segmentType: segment.segmentType,
    speakerKey: segment.speakerKey ?? "",
    speakerLabel: segment.speakerLabel ?? "",
    text: segment.text,
    voiceId: segment.voiceId ?? "",
    language: segment.language,
    speed: Number(segment.speed),
    pauseAfterMs: segment.pauseAfterMs,
    mediaId: segment.mediaId ?? "",
  })),
});

export interface ResolvedAdminMediaSource {
  url: string;
  revoke: boolean;
}

function protectedAdminMediaPath(source: string): string | null {
  if (source.startsWith("/media/files/")) return source;
  if (source.startsWith("/api/v1/media/files/")) {
    return source.slice("/api/v1".length);
  }
  try {
    const sourceUrl = new URL(source);
    const baseUrl = new URL(apiBase);
    if (
      sourceUrl.origin === baseUrl.origin &&
      sourceUrl.pathname.startsWith("/api/v1/media/files/")
    ) {
      return sourceUrl.pathname.slice("/api/v1".length);
    }
  } catch {
    return null;
  }
  return null;
}

export async function resolveAdminMediaSource(
  source?: string,
): Promise<ResolvedAdminMediaSource | undefined> {
  if (!source) return undefined;
  const protectedPath = protectedAdminMediaPath(source);
  if (protectedPath) {
    const blob = await http.requestBlob(protectedPath);
    return { url: URL.createObjectURL(blob), revoke: true };
  }
  if (source.startsWith("blob:") || source.startsWith("data:")) {
    return { url: source, revoke: false };
  }
  return {
    url: source.startsWith("/")
      ? new URL(source, new URL(apiBase).origin).toString()
      : source,
    revoke: false,
  };
}

const hydrateExerciseAudio = async (
  draft: ExerciseDraft,
): Promise<ExerciseDraft> => draft;

export const adminExercisesApi = {
  list: useMock
    ? adminMockApi.exercises
    : (_user: AdminUser) =>
        http.request<AdminExerciseDto[]>("/admin/exercises"),
  getDraft: useMock
    ? async (_user: AdminUser, _id?: string) => {
        const stored =
          adminMockApi.getExerciseDraft() as unknown as Partial<ExerciseDraft>;
        return {
          ...emptyExerciseDraft,
          ...stored,
          groups: stored.groups ?? [],
          questions: stored.questions ?? [],
          audioSegments: stored.audioSegments ?? [],
        };
      }
    : async (_user: AdminUser, id?: string) =>
        id
          ? hydrateExerciseAudio(
              mapExerciseDraft(
                await http.request<RawExercise>(`/admin/exercises/${id}`),
              ),
            )
          : { ...emptyExerciseDraft },
  saveDraft: useMock
    ? async (user: AdminUser, input: ExerciseDraft, _id?: string) =>
        (await adminMockApi.saveExerciseDraft(
          user,
          input as unknown as Record<string, unknown>,
        )) as unknown as ExerciseDraft
    : async (_user: AdminUser, input: ExerciseDraft, id?: string) => {
        const currentId =
          id ??
          (
            await http.request<RawExercise>("/admin/exercises", {
              method: "POST",
              body: {
                lessonId: input.lessonId,
                title: input.title,
                instruction: input.instructions,
                type: input.type,
                dictationMode: input.dictationMode,
                toeicPart: input.toeicPart,
                difficulty: input.difficulty.toUpperCase().replaceAll(" ", "_"),
                sourceScript: input.script,
                passThreshold: input.passThreshold,
                maxPlays: input.maxListens,
                maxAttempts: input.maxAttempts,
              },
            })
          ).id;
        return hydrateExerciseAudio(
          mapExerciseDraft(
            await http.request<RawExercise>(
              `/admin/exercises/${currentId}/draft`,
              {
                method: "PUT",
                body: {
                  type: input.type,
                  title: input.title,
                  instruction: input.instructions,
                  orderIndex: input.orderIndex,
                  dictationMode: input.dictationMode,
                  toeicPart: input.toeicPart,
                  difficulty: input.difficulty
                    .toUpperCase()
                    .replaceAll(" ", "_"),
                  sourceScript: input.script,
                  passThreshold: input.passThreshold,
                  maxPlays: input.maxListens,
                  maxAttempts: input.maxAttempts,
                  showAnswerAfterSubmit: input.showAnswer,
                  ignoreCapitalization: input.ignoreCase,
                  ignorePunctuation: input.ignorePunctuation,
                  ignoreExtraSpaces: input.normalizeWhitespace,
                  allowMinorTypo: input.allowMinorTypo,
                  showTranscript: input.showTranscript,
                  correctText:
                    input.type === "DICTATION" ? input.correctText : undefined,
                  questions:
                    input.type === "TOEIC"
                      ? input.questions.map((question) => ({
                          id: question.id,
                          groupId: question.groupId,
                          text: question.text,
                          imageMediaId: question.imageMediaId || undefined,
                          explanation: question.explanation,
                          options: question.options.map((option) => ({
                            id: option.id,
                            text: option.text,
                            correct: option.correct,
                          })),
                        }))
                      : undefined,
                  groups:
                    input.type === "TOEIC" && input.groups.length
                      ? input.groups.map((group, groupIndex) => ({
                          ...group,
                          imageMediaId: group.imageMediaId || undefined,
                          sharedAudioMediaId:
                            group.sharedAudioMediaId || undefined,
                          questions: input.questions
                            .filter(
                              (question) =>
                                question.groupId === group.id ||
                                (!question.groupId && groupIndex === 0),
                            )
                            .map((question) => ({
                              id: question.id,
                              text: question.text,
                              imageMediaId: question.imageMediaId || undefined,
                              explanation: question.explanation,
                              options: question.options.map((option) => ({
                                id: option.id,
                                text: option.text,
                                correct: option.correct,
                              })),
                            })),
                        }))
                      : undefined,
                  audioSegments:
                    input.type === "TOEIC"
                      ? input.audioSegments.map((segment) => ({
                          ...segment,
                          groupId: segment.groupId || undefined,
                          questionId: segment.questionId || undefined,
                          mediaId: segment.mediaId || undefined,
                        }))
                      : undefined,
                },
              },
            ),
          ),
        );
      },
  publish: useMock
    ? async (_user: AdminUser, _id: string) => ({ ok: true })
    : (_user: AdminUser, id: string) =>
        http.request<RawExercise>(`/admin/exercises/${id}/publish`, {
          method: "POST",
          body: {},
        }),
  archive: useMock
    ? async (_user: AdminUser, _id: string) => ({ ok: true })
    : (_user: AdminUser, id: string) =>
        http.request<RawExercise>(`/admin/exercises/${id}/archive`, {
          method: "POST",
          body: {},
        }),
  attachAudio: async (_user: AdminUser, id: string, mediaId: string) => {
    if (useMock) {
      const stored =
        adminMockApi.getExerciseDraft() as unknown as Partial<ExerciseDraft>;
      const draft = {
        ...emptyExerciseDraft,
        ...stored,
        groups: stored.groups ?? [],
        questions: stored.questions ?? [],
        audioSegments: stored.audioSegments ?? [],
      };
      return (await adminMockApi.saveExerciseDraft(_user, {
        ...draft,
        id,
        audioReady: true,
        audioUrl: mockMedia.find((item) => item.id === mediaId)?.url,
      })) as unknown as ExerciseDraft;
    }
    return hydrateExerciseAudio(
      mapExerciseDraft(
        await http.request<RawExercise>(`/admin/exercises/${id}/audio`, {
          method: "PATCH",
          body: { mediaId },
        }),
      ),
    );
  },
};
export interface TtsVoiceDto {
  id: string;
  name: string;
  language: "en-US" | "en-GB";
  gender?: "Female" | "Male";
}

export interface TtsSettingsDto {
  enabled: boolean;
  provider: string;
  defaultLanguage: string;
  defaultVoiceId: string;
  defaultSpeed: number;
  providerConfigured: boolean;
  providerHealthy: boolean;
  device?: string;
  gpuName?: string | null;
  model?: string;
  providerError?: string | null;
}

export interface TtsGenerationResponse {
  jobId: string;
  status: TtsJobStatus;
  targetType: "EXERCISE" | "GROUP" | "SEGMENT";
  groupId?: string;
  audioSegmentId?: string;
  outputMedia: { id: string; durationMs?: number; url: string };
}

export const adminTtsApi = {
  list: useMock
    ? adminMockApi.jobs
    : (_user: AdminUser) => http.request<TtsJobDto[]>("/admin/tts/jobs"),
  retry: useMock
    ? adminMockApi.retryTts
    : (_user: AdminUser, id: string) =>
        http.request<TtsJobDto>(`/admin/tts/jobs/${id}/retry`, {
          method: "POST",
          body: {},
        }),
  create: (
    _user: AdminUser,
    exerciseId: string,
    input: {
      targetType?: "EXERCISE" | "GROUP" | "SEGMENT";
      groupId?: string;
      audioSegmentId?: string;
      text?: string;
      voiceId?: string;
      language?: string;
      speed?: number;
    },
  ) =>
    useMock
      ? adminMockApi.createTts(_user, exerciseId, input)
      : http.request<TtsGenerationResponse>(
          `/admin/tts/exercises/${exerciseId}/generate-audio`,
          {
            method: "POST",
            body: input,
          },
        ),
  get: useMock
    ? async (user: AdminUser, id: string) =>
        (await adminMockApi.jobs(user)).find((job) => job.id === id) ??
        Promise.reject(
          new AdminApiError("NOT_FOUND", "TTS job not found.", 404),
        )
    : (_user: AdminUser, id: string) =>
        http.request<Record<string, unknown>>(`/admin/tts/jobs/${id}`),
  settings: useMock
    ? async (_user: AdminUser): Promise<TtsSettingsDto> => ({
        enabled: false,
        provider: "none",
        defaultLanguage: "en-US",
        defaultVoiceId: "",
        defaultSpeed: 1,
        providerConfigured: false,
        providerHealthy: false,
      })
    : (_user: AdminUser) =>
        http.request<TtsSettingsDto>("/admin/tts/settings"),
  voices: useMock
    ? async (_user: AdminUser) => ({
        voices: [] as TtsVoiceDto[],
        providerConfigured: false,
        providerHealthy: false,
        provider: "none",
      })
    : (_user: AdminUser) =>
        http.request<{
          voices: TtsVoiceDto[];
          providerConfigured: boolean;
          providerHealthy: boolean;
          provider: string;
          device?: string;
          gpuName?: string | null;
          error?: string | null;
        }>("/admin/tts/voices"),
  saveSettings: (
    _user: AdminUser,
    input: {
      enabled: boolean;
      provider: string;
      defaultLanguage: string;
      defaultVoiceId: string;
      defaultSpeed: number;
    },
  ): Promise<TtsSettingsDto> =>
    useMock
      ? Promise.resolve({
          ...input,
          providerConfigured: false,
          providerHealthy: false,
        })
      : http.request<TtsSettingsDto>("/admin/tts/settings", {
          method: "PUT",
          body: input,
        }),
};

export const adminLandingApi = {
  get: useMock
    ? adminMockApi.landing
    : (_user: AdminUser) => http.request<LandingSectionDto[]>("/admin/landing"),
  save: useMock
    ? adminMockApi.saveLanding
    : (_user: AdminUser, sections: LandingSectionDto[]) =>
        http.request<LandingSectionDto[]>("/admin/landing", {
          method: "PUT",
          body: { sections },
        }),
  publish: useMock
    ? adminMockApi.publishLanding
    : (_user: AdminUser) =>
        http.request<LandingSectionDto[]>("/admin/landing/publish", {
          method: "POST",
          body: {},
        }),
};

export interface AdminMediaDto {
  id: string;
  name: string;
  mimeType: string;
  type: string;
  sizeBytes: number;
  durationMs: number | null;
  status: string;
  url: string;
  createdAt: string;
}

export const adminMediaApi = {
  list: (_user: AdminUser) =>
    useMock
      ? Promise.resolve(mockMedia)
      : http.request<AdminMediaDto[]>("/media"),
  upload: (_user: AdminUser, file: File) => {
    if (useMock) {
      const created: AdminMediaDto = {
        id: `mock-media-${Date.now()}`,
        name: file.name,
        mimeType: file.type,
        type: file.type.startsWith("audio/")
          ? "AUDIO"
          : file.type.startsWith("image/")
            ? "IMAGE"
            : "DOCUMENT",
        sizeBytes: file.size,
        durationMs: null,
        status: "ACTIVE",
        url: URL.createObjectURL(file),
        createdAt: new Date().toISOString(),
      };
      mockMedia.unshift(created);
      return Promise.resolve(created);
    }
    const body = new FormData();
    body.append("file", file);
    return http.request<AdminMediaDto>("/media/upload", {
      method: "POST",
      body,
    });
  },
  archive: (_user: AdminUser, id: string) => {
    if (useMock) {
      const index = mockMedia.findIndex((item) => item.id === id);
      if (index < 0)
        return Promise.reject(
          new AdminApiError("NOT_FOUND", "Media not found.", 404),
        );
      const [archived] = mockMedia.splice(index, 1);
      if (archived.url.startsWith("blob:")) URL.revokeObjectURL(archived.url);
      return Promise.resolve({ ...archived, status: "ARCHIVED" });
    }
    return http.request<AdminMediaDto>(`/media/${id}`, { method: "DELETE" });
  },
};

const mockMedia: AdminMediaDto[] = [];

export interface AdminReportDto {
  system: {
    students: number;
    courses: number;
    exercises: number;
    attempts: number;
  };
  performance: { averageScore: number; passRate: number };
  tts: Array<{ status: string; count: number }>;
}

export const adminReportsApi = {
  get: async (user: AdminUser) => {
    if (!useMock) return http.request<AdminReportDto>("/admin/reports");
    const [students, courses, exercises, attempts, tts] = await Promise.all([
      adminMockApi.students(user),
      adminMockApi.courses(user),
      adminMockApi.exercises(user),
      adminMockApi.attempts(user),
      adminMockApi.jobs(user),
    ]);
    return {
      system: {
        students: students.length,
        courses: courses.length,
        exercises: exercises.length,
        attempts: attempts.length,
      },
      performance: {
        averageScore: attempts.length
          ? attempts.reduce((sum, item) => sum + item.score, 0) /
            attempts.length
          : 0,
        passRate: attempts.length
          ? (attempts.filter((item) => item.passed).length / attempts.length) *
            100
          : 0,
      },
      tts: Object.entries(
        tts.reduce<Record<string, number>>((counts, item) => {
          counts[item.status] = (counts[item.status] ?? 0) + 1;
          return counts;
        }, {}),
      ).map(([status, count]) => ({ status, count })),
    };
  },
};

export interface AdminSiteSettings {
  id: string;
  siteName: string;
  primaryColor: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  footerText?: string | null;
  logoMediaId?: string | null;
  faviconMediaId?: string | null;
  socialLinks?: Record<string, string>;
}

export const adminSiteSettingsApi = {
  get: (_user: AdminUser) =>
    useMock
      ? Promise.resolve(mockSiteSettings)
      : http.request<AdminSiteSettings>("/admin/site-settings"),
  save: (_user: AdminUser, input: Partial<AdminSiteSettings>) => {
    if (useMock) {
      Object.assign(mockSiteSettings, input);
      return Promise.resolve(mockSiteSettings);
    }
    return http.request<AdminSiteSettings>("/admin/site-settings", {
      method: "PUT",
      body: input,
    });
  },
};

const mockSiteSettings: AdminSiteSettings = {
  id: "default",
  siteName: "ListenUp",
  primaryColor: "#2563EB",
  contactEmail: "support@listenup.test",
};

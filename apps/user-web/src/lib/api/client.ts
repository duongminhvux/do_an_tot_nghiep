import { BrowserApiTransport } from "@listenup/api-client";
import { ApiError } from "./errors";
import { mockApi } from "./mock-service";

const useMock = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
const apiBase =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const http = new BrowserApiTransport({
  baseUrl: apiBase,
  clientType: "USER_WEB",
  storageKey: "listenup-session",
  createError: (payload) =>
    new ApiError(
      payload.code ?? "REQUEST_FAILED",
      payload.message ?? "Request failed.",
      payload.details,
    ),
});

const realApi = {
  login: (email: string, password: string) =>
    http.request<Awaited<ReturnType<typeof mockApi.login>>>("/auth/login", {
      method: "POST",
      body: { email, password, clientType: "USER_WEB" },
      retry: false,
    }),
  dashboard: () =>
    http.request<Awaited<ReturnType<typeof mockApi.dashboard>>>(
      "/student/dashboard",
    ),
  listCourses: async (search = "") =>
    (
      await http.request<{
        data: Awaited<ReturnType<typeof mockApi.listCourses>>;
      }>("/student/courses", {
        query: { search },
      })
    ).data,
  getCourse: (slug: string) =>
    http.request<Awaited<ReturnType<typeof mockApi.getCourse>>>(
      `/student/courses/${slug}`,
    ),
  getLesson: (courseSlug: string, lessonSlug: string) =>
    http.request<Awaited<ReturnType<typeof mockApi.getLesson>>>(
      `/student/courses/${courseSlug}/lessons/${lessonSlug}`,
    ),
  getExercise: (id: string) =>
    http.request<Awaited<ReturnType<typeof mockApi.getExercise>>>(
      `/student/exercises/${id}`,
    ),
  consumeListen: async (
    exerciseId: string,
    attemptId: string,
    groupId?: string,
  ) =>
    (
      await http.request<{ listenCount: number }>(
        `/student/exercises/${exerciseId}/attempts/${attemptId}/listens`,
        { method: "POST", body: { groupId } },
      )
    ).listenCount,
  saveDraft: (
    exerciseId: string,
    attemptId: string,
    answers: { questionId?: string; value: string }[],
  ) =>
    http.request<Awaited<ReturnType<typeof mockApi.saveDraft>>>(
      `/student/exercises/${exerciseId}/attempts/${attemptId}/draft`,
      { method: "PUT", body: { answers } },
    ),
  submitDictation: (exerciseId: string, attemptId: string, answer: string) =>
    http.request<Awaited<ReturnType<typeof mockApi.submitDictation>>>(
      `/student/exercises/${exerciseId}/attempts/${attemptId}/submit-dictation`,
      { method: "POST", body: { answer } },
    ),
  submitToeic: (
    exerciseId: string,
    attemptId: string,
    answers: Record<string, string>,
  ) =>
    http.request<Awaited<ReturnType<typeof mockApi.submitToeic>>>(
      `/student/exercises/${exerciseId}/attempts/${attemptId}/submit-toeic`,
      { method: "POST", body: { answers } },
    ),
  getResult: (exerciseId: string, attemptId: string) =>
    http.request<Awaited<ReturnType<typeof mockApi.getResult>>>(
      `/student/exercises/${exerciseId}/attempts/${attemptId}/result`,
    ),
  history: () =>
    http.request<Awaited<ReturnType<typeof mockApi.history>>>(
      "/student/history",
    ),
  getProfile: () =>
    http.request<Awaited<ReturnType<typeof mockApi.getProfile>>>(
      "/student/profile",
    ),
  updateProfile: (input: Parameters<typeof mockApi.updateProfile>[0]) =>
    http.request<Awaited<ReturnType<typeof mockApi.updateProfile>>>(
      "/student/profile",
      {
        method: "PATCH",
        body: input,
      },
    ),
  getSettings: () =>
    http.request<Awaited<ReturnType<typeof mockApi.getSettings>>>(
      "/student/preferences",
    ),
  updateSettings: (input: Parameters<typeof mockApi.updateSettings>[0]) =>
    http.request<Awaited<ReturnType<typeof mockApi.updateSettings>>>(
      "/student/preferences",
      {
        method: "PUT",
        body: input,
      },
    ),
};

export interface ResolvedMediaSource {
  url: string;
  revoke: boolean;
}

function protectedMediaPath(source: string): string | null {
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

export async function resolveUserMediaSource(
  source?: string,
): Promise<ResolvedMediaSource | undefined> {
  if (!source) return undefined;
  const protectedPath = protectedMediaPath(source);
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

const api = useMock ? mockApi : realApi;
export const authApi = {
  login: api.login,
  register: (input: {
    email: string;
    fullName: string;
    password: string;
    targetLevel?: string;
    learningGoal?: string;
  }) =>
    useMock
      ? mockApi
          .login("student@listenup.test", "Student123!")
          .then((session) => ({
            ...session,
            user: { ...session.user, ...input, id: `mock-${Date.now()}` },
          }))
      : http.request<Awaited<ReturnType<typeof mockApi.login>>>(
          "/auth/register",
          {
            method: "POST",
            body: input,
            retry: false,
            auth: false,
          },
        ),
  refreshSession: () =>
    useMock
      ? Promise.resolve({ ok: true })
      : http.request<Awaited<ReturnType<typeof mockApi.login>>>(
          "/auth/refresh",
          {
            method: "POST",
            body: { clientType: "USER_WEB" },
            retry: false,
          },
        ),
  logout: () =>
    useMock
      ? Promise.resolve()
      : http.request<void>("/auth/logout", {
          method: "POST",
          body: { clientType: "USER_WEB" },
          retry: false,
        }),
};
export const passwordRecoveryApi = {
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
            new ApiError(
              "INVALID_RESET_TOKEN",
              "Password reset token is invalid or expired.",
            ),
          )
      : http.request<void>("/auth/reset-password", {
          method: "POST",
          body: { token, newPassword },
          auth: false,
          retry: false,
        }),
};
export const publicApi = {
  getLandingData: async () => {
    if (useMock) {
      return {
        courses: await mockApi.listCourses(""),
        sections: [] as Array<{
          id: string;
          type: string;
          enabled: boolean;
          orderIndex: number;
          content: Record<string, unknown>;
        }>,
        settings: {} as Record<string, unknown>,
      };
    }
    const [courses, sections, settings] = await Promise.all([
      http.request<{ data: Awaited<ReturnType<typeof mockApi.listCourses>> }>(
        "/public/courses",
        {
          auth: false,
        },
      ),
      http.request<
        Array<{
          id: string;
          type: string;
          enabled: boolean;
          orderIndex: number;
          content: Record<string, unknown>;
        }>
      >("/public/landing", { auth: false }),
      http.request<Record<string, unknown>>("/public/site-settings", {
        auth: false,
      }),
    ]);
    return { courses: courses.data, sections, settings };
  },
};
export const dashboardApi = { get: api.dashboard };
export const coursesApi = { list: api.listCourses, get: api.getCourse };
export const lessonsApi = { get: api.getLesson };
export const exercisesApi = {
  get: api.getExercise,
  consumeListen: api.consumeListen,
  saveDraft: api.saveDraft,
};
export const attemptsApi = {
  submitDictation: api.submitDictation,
  submitToeic: api.submitToeic,
  getResult: api.getResult,
};
export const historyApi = { list: api.history };
export const profileApi = {
  get: api.getProfile,
  update: api.updateProfile,
  getSettings: api.getSettings,
  updateSettings: api.updateSettings,
};

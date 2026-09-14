import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExerciseWizard } from "./exercise-wizard";

const testContext = vi.hoisted(() => ({
  mocks: {
    getDraft: vi.fn(),
    saveDraft: vi.fn(),
    courses: vi.fn(),
    lessons: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
  },
  baseDraft: {
    id: "exercise-id",
    title: "Initial title",
    courseId: "course-id",
    lessonId: "lesson-id",
    type: "DICTATION",
    dictationMode: "SENTENCE",
    toeicPart: null,
    instructions: "Listen and type what you hear.",
    orderIndex: 0,
    difficulty: "Intermediate",
    passThreshold: 80,
    maxListens: 3,
    maxAttempts: 3,
    showAnswer: true,
    showTranscript: false,
    script: "Original audio script",
    audioReady: false,
    ttsStatus: "CANCELLED",
    correctText: "Original audio script",
    ignoreCase: true,
    ignorePunctuation: true,
    normalizeWhitespace: true,
    allowMinorTypo: false,
    groups: [],
    questions: [],
    audioSegments: [],
  },
}));

const { mocks, baseDraft } = testContext;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: testContext.mocks.replace,
    push: testContext.mocks.push,
  }),
}));

vi.mock("@/stores/admin-session", () => ({
  useAdminSession: (selector: (state: { user: Record<string, unknown> }) => unknown) =>
    selector({
      user: {
        id: "admin-id",
        fullName: "Admin",
        email: "admin@test.local",
        role: "ADMIN",
        status: "ACTIVE",
        assignedCourseIds: [],
      },
    }),
}));

vi.mock("@/lib/api/client", () => ({
  emptyExerciseDraft: {
    ...testContext.baseDraft,
    id: undefined,
    title: "",
    courseId: "",
    lessonId: "",
  },
  adminCoursesApi: {
    list: (...args: unknown[]) => testContext.mocks.courses(...args),
  },
  adminLessonsApi: {
    list: (...args: unknown[]) => testContext.mocks.lessons(...args),
  },
  adminExercisesApi: {
    getDraft: (...args: unknown[]) => testContext.mocks.getDraft(...args),
    saveDraft: (...args: unknown[]) => testContext.mocks.saveDraft(...args),
    publish: vi.fn(),
    archive: vi.fn(),
    attachAudio: vi.fn(),
  },
  adminMediaApi: { upload: vi.fn() },
  adminTtsApi: { create: vi.fn() },
}));

vi.mock("@/lib/use-protected-media-url", () => ({
  useProtectedMediaUrl: () => ({ url: undefined, loading: false, error: "" }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("ExerciseWizard serialized autosave", () => {
  beforeEach(() => {
    mocks.getDraft.mockReset().mockResolvedValue({ ...baseDraft });
    mocks.saveDraft.mockReset();
    mocks.courses.mockReset().mockResolvedValue([]);
    mocks.lessons.mockReset().mockResolvedValue([]);
    mocks.replace.mockReset();
    mocks.push.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not overwrite a newer edit with an older save response", async () => {
    const firstSave = deferred<typeof baseDraft>();
    const secondSave = deferred<typeof baseDraft>();
    mocks.saveDraft
      .mockReturnValueOnce(firstSave.promise)
      .mockReturnValueOnce(secondSave.promise);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ExerciseWizard id="exercise-id" />
      </QueryClientProvider>,
    );

    const title = await screen.findByPlaceholderText("Exercise title");
    await waitFor(() => expect(title).toHaveValue("Initial title"));
    vi.useFakeTimers();

    fireEvent.change(title, { target: { value: "First edit" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(mocks.saveDraft).toHaveBeenCalledTimes(1);
    expect(mocks.saveDraft.mock.calls[0][1].title).toBe("First edit");

    fireEvent.change(title, { target: { value: "Newest edit" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });

    await act(async () => {
      firstSave.resolve({ ...baseDraft, title: "First edit" });
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(title).toHaveValue("Newest edit");
    expect(mocks.saveDraft).toHaveBeenCalledTimes(2);
    expect(mocks.saveDraft.mock.calls[1][1].title).toBe("Newest edit");

    await act(async () => {
      secondSave.resolve({ ...baseDraft, title: "Newest edit" });
      await Promise.resolve();
    });
    expect(title).toHaveValue("Newest edit");
  });
});

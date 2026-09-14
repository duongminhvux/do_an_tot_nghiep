import {
  AttemptStatus,
  ExerciseType,
  ProgressStatus,
  UserStatus,
} from "@/domain/enums";
import type {
  CourseDetailDto,
  DashboardDto,
  DictationResultDto,
  ExerciseDto,
  HistoryItemDto,
  LessonDetailDto,
  SessionDto,
  ToeicResultDto,
  UserSettingsDto,
} from "@/domain/dto";
import type { LessonState } from "@/domain/enums";
import type { ListeningAttempt, User } from "@/domain/entities";
import {
  courses,
  defaultSettings,
  exercises,
  lessonProgress,
  lessons,
  seedAttempts,
  users,
} from "@/mocks/fixtures";
import { ApiError } from "./errors";
import { courseProgress, scoreDictation } from "@/lib/scoring";
import { delay } from "@/lib/utils";

const ATTEMPTS_KEY = "listenup-attempts";
const PROFILE_KEY = "listenup-profile";
const SETTINGS_KEY = "listenup-settings";
const read = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};
const write = <T>(key: string, value: T) => {
  if (typeof window !== "undefined")
    localStorage.setItem(key, JSON.stringify(value));
};
const getAttempts = () => read<ListeningAttempt[]>(ATTEMPTS_KEY, seedAttempts);
const saveAttempts = (attempts: ListeningAttempt[]) =>
  write(ATTEMPTS_KEY, attempts);
const getProfile = (): User => read<User>(PROFILE_KEY, users[0]);
const findExercise = (id: string) => {
  const item = exercises.find((exercise) => exercise.id === id);
  if (!item) throw new ApiError("NOT_FOUND", "Exercise not found.");
  return item;
};
const findLesson = (id: string) => lessons.find((lesson) => lesson.id === id);

function lessonState(lessonId: string): LessonState {
  const progress = lessonProgress.find((item) => item.lessonId === lessonId);
  if (progress?.status === ProgressStatus.COMPLETED)
    return "COMPLETED" as const;
  if (progress?.status === ProgressStatus.IN_PROGRESS)
    return "CURRENT" as const;
  const lesson = findLesson(lessonId);
  const preceding = lessons.filter(
    (item) =>
      item.courseId === lesson?.courseId && item.order < (lesson?.order ?? 0),
  );
  return preceding.some((item) => lessonState(item.id) !== "COMPLETED")
    ? ("LOCKED" as const)
    : ("NOT_STARTED" as const);
}

function courseCard(courseId: string) {
  const course = courses.find((item) => item.id === courseId)!;
  const courseLessons = lessons.filter((item) => item.courseId === courseId);
  const completed = courseLessons.filter(
    (item) => lessonState(item.id) === "COMPLETED",
  ).length;
  const progress = courseProgress(completed, courseLessons.length);
  return {
    ...course,
    lessonCount: courseLessons.length,
    learnerCount:
      course.id === "course-everyday"
        ? 560
        : course.id === "course-business"
          ? 1196
          : 1094,
    progress,
    status:
      progress === 100
        ? ("COMPLETED" as const)
        : progress
          ? ("IN_PROGRESS" as const)
          : ("NOT_STARTED" as const),
  };
}

function lessonList(courseId: string) {
  return lessons
    .filter((item) => item.courseId === courseId)
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      order: item.order,
      title: item.title,
      duration: item.duration,
      state: lessonState(item.id),
      exerciseCount: exercises.filter(
        (exercise) => exercise.lessonId === item.id,
      ).length,
    }));
}

function history(): HistoryItemDto[] {
  return getAttempts()
    .filter((attempt) => attempt.status === AttemptStatus.SUBMITTED)
    .map((attempt) => {
      const exercise = findExercise(attempt.exerciseId);
      const lesson = findLesson(exercise.lessonId)!;
      const course = courses.find((item) => item.id === lesson.courseId)!;
      return {
        id: attempt.id,
        attemptId: attempt.id,
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        courseTitle: course.title,
        type: exercise.type,
        score: attempt.score ?? 0,
        passed: Boolean(attempt.passed),
        attemptNumber: attempt.attemptNumber,
        submittedAt: attempt.submittedAt ?? attempt.startedAt,
      };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

async function login(email: string, password: string): Promise<SessionDto> {
  await delay();
  const user = users.find(
    (item) => item.email.toLowerCase() === email.toLowerCase(),
  );
  if (!user || password !== "Student123!")
    throw new ApiError("UNAUTHENTICATED", "Email or password is incorrect.");
  if (user.status === UserStatus.BLOCKED)
    throw new ApiError(
      "ACCOUNT_BLOCKED",
      "This account has been blocked. Contact support.",
    );
  return { accessToken: "mock-access-token-student", user };
}

async function dashboard(): Promise<DashboardDto> {
  await delay();
  return {
    userName: getProfile().fullName.split(" ")[0],
    stats: [
      {
        label: "Completed Lessons",
        value: "58",
        change: "+15 this week",
        icon: "book",
      },
      {
        label: "Listening Score",
        value: "1,245",
        change: "+254 this week",
        icon: "clock",
      },
      {
        label: "Accuracy Rate",
        value: "80%",
        change: "+6% this week",
        icon: "chart",
      },
      {
        label: "Current Streak",
        value: "12 days",
        change: "Best: 81 days",
        icon: "flame",
      },
    ],
    continueLearning: {
      courseSlug: "business-english-listening",
      lessonSlug: "handling-objections",
      courseTitle: "Business English Listening",
      lessonTitle: "Handling Objections",
      category: "Business English",
      duration: 15,
      progress: 68,
      theme: "meeting",
    },
    weeklyProgress: [
      { day: "Mon", value: 52 },
      { day: "Tue", value: 91 },
      { day: "Wed", value: 79 },
      { day: "Thu", value: 58 },
      { day: "Fri", value: 87 },
      { day: "Sat", value: 90 },
      { day: "Sun", value: 91 },
    ],
    courses: [
      courseCard("course-business"),
      courseCard("course-toeic"),
      courseCard("course-everyday"),
    ],
    recentActivity: history().slice(0, 4),
    recommended: [courseCard("course-everyday"), courseCard("course-toeic")],
    weeklyGoal: 78,
    streakDays: 12,
    streak: [
      true,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
      true,
      true,
    ],
    achievements: [
      {
        title: "Meet Master",
        description: "Study 7 days in a week",
        tone: "gold",
      },
      {
        title: "Top Performer",
        description: "Score 70% on any test",
        tone: "blue",
      },
    ],
  };
}

async function listCourses(search = "") {
  await delay();
  return courses
    .map((course) => courseCard(course.id))
    .filter((course) =>
      course.title.toLowerCase().includes(search.toLowerCase()),
    );
}
async function getCourse(slug: string): Promise<CourseDetailDto> {
  await delay();
  const course = courses.find((item) => item.slug === slug);
  if (!course) throw new ApiError("NOT_FOUND", "Course not found.");
  const card = courseCard(course.id);
  return {
    ...card,
    lessons: lessonList(course.id),
    completedLessons: lessonList(course.id).filter(
      (item) => item.state === "COMPLETED",
    ).length,
  };
}
async function getLesson(
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonDetailDto> {
  await delay();
  const course = courses.find((item) => item.slug === courseSlug);
  const lesson = lessons.find(
    (item) => item.courseId === course?.id && item.slug === lessonSlug,
  );
  if (!course || !lesson) throw new ApiError("NOT_FOUND", "Lesson not found.");
  return {
    ...lesson,
    courseSlug,
    courseTitle: course.title,
    resources: [],
    lessons: lessonList(course.id),
    exercises: [
      ...exercises
        .filter((item) => item.lessonId === lesson.id)
        .map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type,
          available: true,
        })),
      {
        id: "quiz-coming",
        title: "Quick comprehension quiz",
        type: "QUIZ",
        available: false,
      },
      {
        id: "shadowing-coming",
        title: "Guided shadowing",
        type: "SHADOWING",
        available: false,
      },
    ],
  };
}

async function getExercise(id: string): Promise<ExerciseDto> {
  await delay();
  const exercise = findExercise(id);
  const lesson = findLesson(exercise.lessonId)!;
  const course = courses.find((item) => item.id === lesson.courseId)!;
  let attempts = getAttempts();
  const submitted = attempts.filter(
    (item) => item.exerciseId === id && item.status === AttemptStatus.SUBMITTED,
  );
  let attempt = attempts.find(
    (item) =>
      item.exerciseId === id && item.status === AttemptStatus.IN_PROGRESS,
  );
  if (!attempt) {
    if (submitted.length >= exercise.maxAttemptCount)
      throw new ApiError(
        "ATTEMPT_LIMIT_REACHED",
        "You have used all attempts for this exercise.",
      );
    attempt = {
      id: `attempt-${id}-${submitted.length + 1}`,
      userId: "user-student",
      exerciseId: id,
      status: AttemptStatus.IN_PROGRESS,
      attemptNumber: submitted.length + 1,
      listenCount: 0,
      answers: [],
      startedAt: new Date().toISOString(),
    };
    attempts = [...attempts, attempt];
    saveAttempts(attempts);
  }
  return {
    id,
    lessonId: lesson.id,
    courseSlug: course.slug,
    lessonSlug: lesson.slug,
    title: exercise.title,
    type: exercise.type,
    progressLabel:
      exercise.type === ExerciseType.DICTATION
        ? "Dictation"
        : `1 / ${exercise.groups?.flatMap((g) => g.questions).length ?? 1}`,
    maxListenCount: exercise.maxListenCount,
    maxAttemptCount: exercise.maxAttemptCount,
    passThreshold: exercise.passThreshold,
    attempt: { ...attempt },
    correctAnswer: exercise.correctAnswer,
    groups: exercise.groups?.map((group) => ({
      ...group,
      listenCount: attempt.listenCountsByGroup?.[group.id] ?? 0,
    })),
    toeicPart: exercise.toeicPart,
  };
}

async function consumeListen(
  exerciseId: string,
  attemptId: string,
  groupId?: string,
) {
  const exercise = findExercise(exerciseId);
  const attempts = getAttempts();
  const attempt = attempts.find((item) => item.id === attemptId);
  if (!attempt) throw new ApiError("NOT_FOUND", "Attempt not found.");
  if (attempt.exerciseId !== exerciseId)
    throw new ApiError(
      "ATTEMPT_EXERCISE_MISMATCH",
      "Attempt does not match exercise.",
    );
  const isToeic = exercise.type === ExerciseType.TOEIC;
  if (isToeic && !groupId)
    throw new ApiError(
      "TOEIC_GROUP_REQUIRED",
      "A TOEIC stimulus group is required.",
    );
  if (isToeic && !exercise.groups?.some((group) => group.id === groupId))
    throw new ApiError(
      "INVALID_EXERCISE_GROUP",
      "The playback group does not belong to this exercise.",
    );
  if (!isToeic && groupId)
    throw new ApiError(
      "INVALID_LISTEN_SCOPE",
      "Dictation playback has no group.",
    );
  const current = isToeic
    ? (attempt.listenCountsByGroup?.[groupId!] ?? 0)
    : attempt.listenCount;
  if (current >= exercise.maxListenCount)
    throw new ApiError(
      "LISTEN_LIMIT_REACHED",
      "You have reached the listening limit.",
    );
  attempt.listenCount += 1;
  if (isToeic) {
    attempt.listenCountsByGroup = {
      ...attempt.listenCountsByGroup,
      [groupId!]: current + 1,
    };
  }
  saveAttempts(attempts);
  return current + 1;
}
async function saveDraft(
  exerciseId: string,
  attemptId: string,
  answers: { questionId?: string; value: string }[],
) {
  findExercise(exerciseId);
  const attempts = getAttempts();
  const attempt = attempts.find((item) => item.id === attemptId);
  if (!attempt || attempt.status !== AttemptStatus.IN_PROGRESS)
    throw new ApiError(
      "ATTEMPT_ALREADY_SUBMITTED",
      "This attempt can no longer be edited.",
    );
  attempt.answers = answers;
  saveAttempts(attempts);
  return attempt;
}

async function submitDictation(
  exerciseId: string,
  attemptId: string,
  answer: string,
): Promise<DictationResultDto> {
  await delay(520);
  const exercise = findExercise(exerciseId);
  const attempts = getAttempts();
  const attempt = attempts.find((item) => item.id === attemptId);
  if (!attempt) throw new ApiError("NOT_FOUND", "Attempt not found.");
  if (attempt.status === AttemptStatus.SUBMITTED)
    return getDictationResult(attemptId);
  const scored = scoreDictation(answer, exercise.correctAnswer ?? "");
  attempt.status = AttemptStatus.SUBMITTED;
  attempt.answers = [{ value: answer }];
  attempt.score = scored.score;
  attempt.passed = scored.score >= exercise.passThreshold;
  attempt.submittedAt = new Date().toISOString();
  saveAttempts(attempts);
  return {
    attemptId,
    score: scored.score,
    passed: attempt.passed,
    threshold: exercise.passThreshold,
    accuracy: {
      correctWords: scored.correctWords,
      totalWords: scored.totalWords,
    },
    studentAnswer: answer,
    correctAnswer: exercise.correctAnswer ?? "",
    feedbackSegments: scored.feedbackSegments,
    feedbackMessage: attempt.passed
      ? "Great listening! You’re picking up the important details."
      : "Listen for short connecting words and try one more time.",
  };
}
function getDictationResult(attemptId: string): DictationResultDto {
  const attempt = getAttempts().find((item) => item.id === attemptId);
  if (!attempt || attempt.status !== AttemptStatus.SUBMITTED)
    throw new ApiError("NOT_FOUND", "Result not found.");
  const exercise = findExercise(attempt.exerciseId);
  const answer = attempt.answers[0]?.value ?? "";
  const scored = scoreDictation(answer, exercise.correctAnswer ?? "");
  return {
    attemptId,
    score: attempt.score ?? scored.score,
    passed: Boolean(attempt.passed),
    threshold: exercise.passThreshold,
    accuracy: {
      correctWords: scored.correctWords,
      totalWords: scored.totalWords,
    },
    studentAnswer: answer,
    correctAnswer: exercise.correctAnswer ?? "",
    feedbackSegments: scored.feedbackSegments,
    feedbackMessage: attempt.passed
      ? "Great listening! You’re picking up the important details."
      : "Listen for short connecting words and try one more time.",
  };
}

async function submitToeic(
  exerciseId: string,
  attemptId: string,
  answers: Record<string, string>,
): Promise<ToeicResultDto> {
  await delay(520);
  const exercise = findExercise(exerciseId);
  const attempts = getAttempts();
  const attempt = attempts.find((item) => item.id === attemptId);
  if (!attempt) throw new ApiError("NOT_FOUND", "Attempt not found.");
  if (attempt.status === AttemptStatus.SUBMITTED)
    return getToeicResult(attemptId);
  const questions = exercise.groups?.flatMap((group) => group.questions) ?? [];
  const correctCount = questions.filter(
    (q) => answers[q.id] === q.correctOptionId,
  ).length;
  const score = Math.round(
    (correctCount / Math.max(1, questions.length)) * 100,
  );
  attempt.status = AttemptStatus.SUBMITTED;
  attempt.answers = Object.entries(answers).map(([questionId, value]) => ({
    questionId,
    value,
  }));
  attempt.score = score;
  attempt.passed = score >= exercise.passThreshold;
  attempt.submittedAt = new Date().toISOString();
  saveAttempts(attempts);
  return getToeicResult(attemptId);
}
function getToeicResult(attemptId: string): ToeicResultDto {
  const attempt = getAttempts().find((item) => item.id === attemptId);
  if (!attempt || attempt.status !== AttemptStatus.SUBMITTED)
    throw new ApiError("NOT_FOUND", "Result not found.");
  const exercise = findExercise(attempt.exerciseId);
  const questions = exercise.groups?.flatMap((group) => group.questions) ?? [];
  const map = Object.fromEntries(
    attempt.answers.map((item) => [item.questionId, item.value]),
  );
  const correctCount = questions.filter(
    (q) => map[q.id] === q.correctOptionId,
  ).length;
  return {
    attemptId,
    score: attempt.score ?? 0,
    passed: Boolean(attempt.passed),
    threshold: exercise.passThreshold,
    correctCount,
    totalQuestions: questions.length,
    partBreakdown: [
      {
        part: exercise.toeicPart?.replace("_", " ") ?? "TOEIC",
        correct: correctCount,
        total: questions.length,
      },
    ],
    strengths: correctCount
      ? ["Detail recognition", "Question focus"]
      : ["You completed the full set"],
    improvements:
      correctCount === questions.length
        ? ["Keep practicing under time pressure"]
        : ["Listen for purpose and context", "Review distractor options"],
    answerReviewEnabled: true,
    answers: questions.map((q) => {
      const selected = q.options.find((option) => option.id === map[q.id]);
      const correct = q.options.find(
        (option) => option.id === q.correctOptionId,
      );
      return {
        questionId: q.id,
        selectedOptionId: map[q.id] ?? "",
        selectedOptionLabel: selected?.label,
        selectedOptionText: selected?.text,
        correctOptionId: q.correctOptionId,
        correctOptionLabel: correct?.label,
        correctOptionText: correct?.text,
        explanation: q.explanation,
        isCorrect: map[q.id] === q.correctOptionId,
      };
    }),
    transcripts: (exercise.groups ?? [])
      .filter((group) => group.transcript?.trim())
      .map((group, index) => ({
        groupId: group.id,
        label: `Group ${index + 1}`,
        text: group.transcript!,
      })),
  };
}

async function getResult(exerciseId: string, attemptId: string) {
  const exercise = findExercise(exerciseId);
  const lesson = findLesson(exercise.lessonId)!;
  const course = courses.find((item) => item.id === lesson.courseId)!;
  const info = {
    title: exercise.title,
    courseSlug: course.slug,
    lessonSlug: lesson.slug,
  };
  await delay();
  return exercise.type === ExerciseType.DICTATION
    ? {
        type: ExerciseType.DICTATION as const,
        result: getDictationResult(attemptId),
        exercise: info,
      }
    : {
        type: ExerciseType.TOEIC as const,
        result: getToeicResult(attemptId),
        exercise: info,
      };
}
async function updateProfile(input: Partial<User>) {
  await delay();
  const profile = { ...getProfile(), ...input, email: getProfile().email };
  write(PROFILE_KEY, profile);
  return profile;
}
async function getSettings() {
  await delay();
  return read<UserSettingsDto>(SETTINGS_KEY, defaultSettings);
}
async function updateSettings(input: UserSettingsDto) {
  await delay();
  write(SETTINGS_KEY, input);
  return input;
}

export const mockApi = {
  login,
  dashboard,
  listCourses,
  getCourse,
  getLesson,
  getExercise,
  consumeListen,
  saveDraft,
  submitDictation,
  submitToeic,
  getResult,
  history: async () => {
    await delay();
    return history();
  },
  getProfile: async () => {
    await delay();
    return getProfile();
  },
  updateProfile,
  getSettings,
  updateSettings,
};

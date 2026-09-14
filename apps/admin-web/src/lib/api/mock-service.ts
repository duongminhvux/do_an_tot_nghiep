import {
  ContentStatus,
  UserRole,
  UserStatus,
  type AdminCourseDto,
  type AdminSessionDto,
  type AdminUser,
  type LandingSectionDto,
} from "@listenup/domain";
import { can, type PermissionResource } from "@listenup/domain/permissions";
import type { Permission } from "@listenup/domain";
import {
  adminAttempts,
  adminCourses,
  adminExercises,
  adminStudents,
  adminTeachers,
  adminUsers,
  activity,
  landingSections,
  ttsJobs,
} from "@/mocks/fixtures";
import { delay } from "@/lib/utils";
import { AdminApiError } from "./errors";

const COURSES = "listenup-admin-courses";
const LANDING = "listenup-admin-landing";
const TTS = "listenup-admin-tts";
const EXERCISE_DRAFT = "listenup-admin-exercise-draft";
const read = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
};
const write = <T>(key: string, value: T) => {
  if (typeof window !== "undefined")
    localStorage.setItem(key, JSON.stringify(value));
};
const requirePermission = (
  user: AdminUser,
  permission: Permission,
  resource?: PermissionResource,
) => {
  if (!can(user, permission, resource))
    throw new AdminApiError(
      resource ? "RESOURCE_NOT_ASSIGNED" : "FORBIDDEN",
      "You do not have permission to perform this action.",
      403,
    );
};
async function login(
  email: string,
  password: string,
): Promise<AdminSessionDto> {
  await delay();
  const user = adminUsers.find(
    (item) => item.email.toLowerCase() === email.toLowerCase(),
  );
  const expected =
    user?.role === UserRole.ADMIN
      ? "Admin123!"
      : user?.role === UserRole.TEACHER
        ? "Teacher123!"
        : "Student123!";
  if (!user || password !== expected)
    throw new AdminApiError(
      "UNAUTHENTICATED",
      "Email or password is incorrect.",
      401,
    );
  if (user.status === UserStatus.BLOCKED)
    throw new AdminApiError("ACCOUNT_BLOCKED", "This account is blocked.", 403);
  if (user.role === UserRole.STUDENT)
    throw new AdminApiError(
      "FORBIDDEN",
      "Student accounts cannot access ListenUp Admin.",
      403,
    );
  return {
    accessToken: `mock-admin-token-${user.role.toLowerCase()}`,
    audience: "listenup-admin",
    user,
  };
}
async function dashboard(user: AdminUser) {
  await delay();
  requirePermission(
    user,
    user.role === UserRole.ADMIN
      ? "dashboard:view-global"
      : "dashboard:view-assigned",
  );
  const adminMetrics = [
    {
      label: "Total Students",
      value: "12,458",
      change: "+13.2%",
      tone: "blue",
    },
    {
      label: "Active Students",
      value: "8,924",
      change: "+9.8%",
      tone: "purple",
    },
    { label: "Total Courses", value: "156", change: "+7.5%", tone: "blue" },
    { label: "Total Lessons", value: "1,248", change: "+8.5%", tone: "amber" },
    {
      label: "Listening Exercises",
      value: "3,452",
      change: "+6.5%",
      tone: "blue",
    },
    {
      label: "Total Attempts",
      value: "45,789",
      change: "+45.5%",
      tone: "purple",
    },
    { label: "Pass Rate", value: "72.6%", change: "+0.6%", tone: "green" },
    {
      label: "TTS Provider",
      value: "Not configured",
      change: "Audio generation unavailable",
      tone: "red",
    },
  ] as const;
  const teacherMetrics = [
    {
      label: "Assigned Courses",
      value: "2",
      change: "Current scope",
      tone: "blue",
    },
    {
      label: "Assigned Students",
      value: "592",
      change: "+8.4%",
      tone: "purple",
    },
    {
      label: "Lessons Created",
      value: "38",
      change: "+4 this month",
      tone: "amber",
    },
    {
      label: "Exercises Created",
      value: "74",
      change: "+11 this month",
      tone: "cyan",
    },
    {
      label: "Course Attempts",
      value: "6,291",
      change: "+12.5%",
      tone: "blue",
    },
    { label: "Average Score", value: "78.4%", change: "+2.4%", tone: "green" },
    { label: "Pass Rate", value: "74.2%", change: "+1.8%", tone: "green" },
  ] as const;
  return {
    metrics: user.role === UserRole.ADMIN ? adminMetrics : teacherMetrics,
    activity,
    chart: [],
    weekly: [],
    topCourses: adminCourses.slice(0, 3),
  };
}
async function courses(user: AdminUser) {
  await delay();
  const all = read(COURSES, adminCourses);
  return user.role === UserRole.ADMIN
    ? all
    : all.filter((course) => course.assignedTeacherIds.includes(user.id));
}
async function course(user: AdminUser, id: string) {
  const item = (await courses(user)).find((c) => c.id === id);
  if (!item)
    throw new AdminApiError(
      "RESOURCE_NOT_ASSIGNED",
      "Course was not found in your assigned scope.",
      403,
    );
  return item;
}
async function saveCourse(
  user: AdminUser,
  input: Partial<AdminCourseDto> & { title: string },
) {
  requirePermission(
    user,
    input.id
      ? user.role === UserRole.ADMIN
        ? "course:update-any"
        : "course:update-assigned"
      : "course:create",
    input.id ? { courseId: input.id } : undefined,
  );
  await delay();
  const all = read(COURSES, adminCourses);
  const assignedTeacherIds = input.assignedTeacherIds ?? [];
  const assignedTeachers = adminTeachers
    .filter((teacher) => assignedTeacherIds.includes(teacher.id))
    .map(({ id, fullName, email }) => ({ id, fullName, email }));
  if (input.id) {
    const index = all.findIndex((c) => c.id === input.id);
    if (index < 0)
      throw new AdminApiError("NOT_FOUND", "Course not found.", 404);
    all[index] = {
      ...all[index],
      ...input,
      assignedTeacherIds,
      assignedTeachers,
      updatedAt: new Date().toISOString(),
    };
    write(COURSES, all);
    return all[index];
  }
  const created: AdminCourseDto = {
    id: `course-${all.length + 1}`,
    title: input.title,
    level: input.level ?? "Beginner",
    lessons: 0,
    students: 0,
    status: ContentStatus.DRAFT,
    assignedTeacherIds,
    assignedTeachers,
    updatedAt: new Date().toISOString(),
    theme: "meeting",
  };
  write(COURSES, [...all, created]);
  return created;
}
async function publishCourse(user: AdminUser, id: string) {
  const item = await course(user, id);
  requirePermission(
    user,
    user.role === UserRole.ADMIN
      ? "course:update-any"
      : "course:update-assigned",
    { courseId: id },
  );
  if (!item.title || !item.level)
    throw new AdminApiError(
      "PUBLISH_VALIDATION_ERROR",
      "Complete the required course information before publishing.",
    );
  const all = read(COURSES, adminCourses).map((c) =>
    c.id === id ? { ...c, status: ContentStatus.PUBLISHED } : c,
  );
  write(COURSES, all);
  return all.find((c) => c.id === id)!;
}
async function students(user: AdminUser) {
  await delay();
  requirePermission(
    user,
    user.role === UserRole.ADMIN ? "student:view-any" : "student:view-assigned",
  );
  return user.role === UserRole.ADMIN
    ? adminStudents
    : adminStudents.filter((s) =>
        s.enrolledCourseIds.some((id) => user.assignedCourseIds.includes(id)),
      );
}
async function student(user: AdminUser, id: string) {
  const item = (await students(user)).find((s) => s.id === id);
  if (!item)
    throw new AdminApiError(
      "RESOURCE_NOT_ASSIGNED",
      "Student is outside your assigned scope.",
      403,
    );
  return item;
}
async function teachers(user: AdminUser) {
  await delay();
  requirePermission(user, "teacher:view");
  return adminTeachers;
}
async function attempts(user: AdminUser) {
  await delay();
  requirePermission(
    user,
    user.role === UserRole.ADMIN ? "attempt:view-any" : "attempt:view-assigned",
  );
  return user.role === UserRole.ADMIN
    ? adminAttempts
    : adminAttempts.filter((a) => user.assignedCourseIds.includes(a.courseId));
}
async function exercises(user: AdminUser) {
  await delay();
  return user.role === UserRole.ADMIN
    ? adminExercises
    : adminExercises.filter((e) => user.assignedCourseIds.includes(e.courseId));
}
async function jobs(user: AdminUser) {
  await delay();
  return user.role === UserRole.ADMIN
    ? read(TTS, ttsJobs)
    : read(TTS, ttsJobs).filter((job) =>
        adminExercises.some(
          (e) =>
            e.id === job.exerciseId &&
            user.assignedCourseIds.includes(e.courseId),
        ),
      );
}
async function retryTts(user: AdminUser, id: string) {
  requirePermission(user, "tts-job:retry");
  const job = read(TTS, ttsJobs).find((item) => item.id === id);
  if (!job) throw new AdminApiError("NOT_FOUND", "TTS job not found.", 404);
  throw new AdminApiError(
    "TTS_PROVIDER_NOT_CONFIGURED",
    "Audio generation is unavailable because no TTS provider is configured.",
    503,
  );
}
async function createTts(
  _user: AdminUser,
  _exerciseId: string,
  _input?: {
    targetType?: "EXERCISE" | "GROUP" | "SEGMENT";
    groupId?: string;
    audioSegmentId?: string;
    text?: string;
    voiceId?: string;
    language?: string;
    speed?: number;
  },
): Promise<never> {
  throw new AdminApiError(
    "TTS_PROVIDER_NOT_CONFIGURED",
    "Audio generation is unavailable because no TTS provider is configured.",
    503,
  );
}
async function landing(user: AdminUser) {
  requirePermission(user, "landing:update");
  await delay();
  return read<LandingSectionDto[]>(LANDING, landingSections).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
}
async function saveLanding(user: AdminUser, sections: LandingSectionDto[]) {
  requirePermission(user, "landing:update");
  await delay();
  write(LANDING, sections);
  return sections;
}
async function publishLanding(user: AdminUser) {
  const sections = await landing(user);
  const published = sections.map((s) => ({
    ...s,
    publishedContent: { ...s.draftContent },
    publishedAt: new Date().toISOString(),
  }));
  write(LANDING, published);
  return published;
}
const getExerciseDraft = () =>
  read(EXERCISE_DRAFT, {
    step: "basic",
    title: "",
    courseId: "course-1",
    lessonId: "lesson-1",
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
    questions: [] as unknown[],
  });
const saveExerciseDraft = async (
  user: AdminUser,
  input: Record<string, unknown>,
) => {
  requirePermission(user, "exercise:create");
  await delay(180);
  const value = { ...getExerciseDraft(), ...input };
  write(EXERCISE_DRAFT, value);
  return value;
};
export const adminMockApi = {
  login,
  dashboard,
  courses,
  course,
  saveCourse,
  publishCourse,
  students,
  student,
  teachers,
  attempts,
  exercises,
  jobs,
  retryTts,
  createTts,
  landing,
  saveLanding,
  publishLanding,
  getExerciseDraft,
  saveExerciseDraft,
};

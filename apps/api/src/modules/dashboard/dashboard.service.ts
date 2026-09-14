import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import {
  AttemptStatus,
  AssignmentStatus,
  ContentStatus,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "../access/course-access.service";
import { AttemptsService } from "../attempts/attempts.service";
import { CoursesService } from "../courses/courses.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CoursesService,
    private readonly attempts: AttemptsService,
    private readonly access: CourseAccessService,
  ) {}

  async student(user: AuthenticatedUser) {
    const profile = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const coursePage = await this.courses.studentList(user, {
      page: 1,
      limit: 12,
      search: "",
      direction: "asc",
    });
    const history = await this.attempts.history(user);
    const [graded, passed, lessonProgress] = await Promise.all([
      this.prisma.listeningAttempt.aggregate({
        where: { studentId: user.id, status: AttemptStatus.GRADED },
        _avg: { score: true },
        _count: true,
      }),
      this.prisma.listeningAttempt.count({
        where: { studentId: user.id, passed: true },
      }),
      this.prisma.lessonProgress.count({
        where: { studentId: user.id, status: "COMPLETED" },
      }),
    ]);
    const course =
      coursePage.data.find((item) => item.progress < 100) ?? coursePage.data[0];
    const lesson = course
      ? await this.prisma.lesson.findFirst({
          where: { courseId: course.id, status: ContentStatus.PUBLISHED },
          orderBy: { orderIndex: "asc" },
        })
      : null;
    const fallback = {
      courseSlug: course?.slug ?? "",
      lessonSlug: lesson?.slug ?? "",
      courseTitle: course?.title ?? "Choose a course",
      lessonTitle: lesson?.title ?? "Start listening",
      category: course?.category ?? "English",
      duration: lesson?.estimatedDurationMinutes ?? 0,
      progress: course?.progress ?? 0,
      theme: course?.theme ?? ("person" as const),
    };
    const today = new Date();
    const activityDays = new Set(
      history.map((attempt) => attempt.submittedAt.slice(0, 10)),
    );
    const recentDates = Array.from({ length: 14 }, (_, offset) => {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - (13 - offset));
      return date.toISOString().slice(0, 10);
    });
    let streakDays = 0;
    for (let offset = 0; offset < 365; offset += 1) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - offset);
      if (!activityDays.has(date.toISOString().slice(0, 10))) break;
      streakDays += 1;
    }
    const weeklyDates = recentDates.slice(-7);
    const weeklyScores = new Map<string, number[]>();
    for (const attempt of history) {
      const date = attempt.submittedAt.slice(0, 10);
      if (!weeklyDates.includes(date)) continue;
      weeklyScores.set(date, [
        ...(weeklyScores.get(date) ?? []),
        attempt.score,
      ]);
    }
    return {
      userName: profile.fullName.split(" ")[0],
      stats: [
        {
          label: "Completed Lessons",
          value: String(lessonProgress),
          change: "Updated now",
          icon: "book",
        },
        {
          label: "Listening Score",
          value: `${Math.round(Number(graded._avg.score ?? 0))}`,
          change: `${graded._count} attempts`,
          icon: "clock",
        },
        {
          label: "Accuracy Skills",
          value: `${graded._count ? Math.round((passed / graded._count) * 100) : 0}%`,
          change: "All time",
          icon: "chart",
        },
        {
          label: "Current Streak",
          value: `${streakDays} ${streakDays === 1 ? "day" : "days"}`,
          change: "Based on submitted attempts",
          icon: "flame",
        },
      ],
      continueLearning: fallback,
      weeklyProgress: weeklyDates.map((date) => ({
        day: new Intl.DateTimeFormat("en", {
          weekday: "short",
          timeZone: "UTC",
        }).format(new Date(`${date}T00:00:00Z`)),
        value: weeklyScores.has(date)
          ? Math.round(
              weeklyScores
                .get(date)!
                .reduce((total, score) => total + score, 0) /
                weeklyScores.get(date)!.length,
            )
          : 0,
      })),
      courses: coursePage.data,
      recentActivity: history.slice(0, 5),
      recommended: coursePage.data.slice(0, 3),
      weeklyGoal: Math.round(
        (weeklyDates.filter((date) => activityDays.has(date)).length / 7) * 100,
      ),
      streakDays,
      streak: recentDates.map((date) => activityDays.has(date)),
      achievements: [
        {
          title: "First Steps",
          description: "Complete your first listening activity.",
          tone: "gold" as const,
        },
        {
          title: "Focused Listener",
          description: `${graded._count} graded attempts completed.`,
          tone: "blue" as const,
        },
      ],
    };
  }

  async admin(user: AuthenticatedUser) {
    const courseIds =
      user.role === UserRole.TEACHER
        ? await this.access.assignedCourseIds(user.id)
        : undefined;
    const courseWhere = courseIds ? { id: { in: courseIds } } : {};
    const attemptWhere = courseIds
      ? {
          exercise: { lesson: { courseId: { in: courseIds } } },
          status: AttemptStatus.GRADED,
        }
      : { status: AttemptStatus.GRADED };
    const [
      studentCount,
      courseCount,
      lessonCount,
      exerciseCount,
      attemptStats,
      failedTts,
      courses,
      recent,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.STUDENT } }),
      this.prisma.course.count({ where: courseWhere }),
      this.prisma.lesson.count({
        where: courseIds ? { courseId: { in: courseIds } } : {},
      }),
      this.prisma.listeningExercise.count({
        where: courseIds ? { lesson: { courseId: { in: courseIds } } } : {},
      }),
      this.prisma.listeningAttempt.aggregate({
        where: attemptWhere,
        _count: true,
        _avg: { score: true },
      }),
      this.prisma.ttsJob.count({ where: { status: "FAILED" } }),
      this.prisma.course.findMany({
        where: courseWhere,
        include: {
          _count: { select: { lessons: true, enrollments: true } },
          teacherAssignments: {
            where: { status: AssignmentStatus.ACTIVE },
            include: { teacher: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
      }),
      this.prisma.listeningAttempt.findMany({
        where: attemptWhere,
        include: { student: true, exercise: true },
        orderBy: { submittedAt: "desc" },
        take: 6,
      }),
    ]);
    const average = Math.round(Number(attemptStats._avg.score ?? 0));
    const metric = (
      label: string,
      value: number | string,
      tone: "blue" | "purple" | "green" | "amber" | "cyan" | "red",
    ) => ({
      label,
      value: typeof value === "number" ? value.toLocaleString() : value,
      change: "Live data",
      tone,
    });
    return {
      metrics: [
        metric("Total Students", studentCount, "blue"),
        metric("Total Courses", courseCount, "purple"),
        metric("Total Lessons", lessonCount, "amber"),
        metric("Listening Exercises", exerciseCount, "cyan"),
        metric("Total Attempts", attemptStats._count, "blue"),
        metric("Average Score", `${average}%`, "green"),
        metric("Failed TTS Jobs", failedTts, "red"),
      ],
      activity: recent.map((attempt) => ({
        id: attempt.id,
        student: attempt.student.fullName,
        exercise: attempt.exercise.title,
        score: Number(attempt.score ?? 0),
        status: attempt.passed ? "PASS" : "FAIL",
        time:
          attempt.submittedAt?.toISOString() ?? attempt.updatedAt.toISOString(),
      })),
      chart: [],
      weekly: [],
      topCourses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        level: course.level,
        lessons: course._count.lessons,
        students: course._count.enrollments,
        status: course.status,
        assignedTeacherIds: course.teacherAssignments.map(
          (item) => item.teacher.id,
        ),
        assignedTeachers: course.teacherAssignments.map((item) => ({
          id: item.teacher.id,
          fullName: item.teacher.fullName,
          email: item.teacher.email,
        })),
        updatedAt: course.updatedAt.toISOString(),
        theme: course.category,
      })),
    };
  }
}

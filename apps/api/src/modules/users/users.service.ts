import { ConflictException, Injectable } from "@nestjs/common";
import argon2 from "argon2";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import {
  AssignmentStatus,
  UserRole,
  UserStatus,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CourseAccessService } from "../access/course-access.service";
import type {
  CreateTeacherDto,
  UpdatePreferenceDto,
  UpdateProfileDto,
  UpdateTeacherDto,
} from "./dto/users.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseAccess: CourseAccessService,
  ) {}

  async profile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { studentProfile: true },
    });
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      avatar: undefined,
      targetLevel: user.studentProfile?.targetLevel ?? "",
      learningGoal: user.studentProfile?.learningGoal ?? "",
    };
  }

  async updateProfile(userId: string, input: UpdateProfileDto) {
    await this.prisma.$transaction(async (tx) => {
      if (input.fullName) {
        await tx.user.update({
          where: { id: userId },
          data: { fullName: input.fullName.trim() },
        });
      }
      if (input.targetLevel || input.learningGoal !== undefined) {
        await tx.studentProfile.upsert({
          where: { userId },
          update: {
            targetLevel: input.targetLevel,
            learningGoal: input.learningGoal?.trim(),
          },
          create: {
            userId,
            targetLevel: input.targetLevel,
            learningGoal: input.learningGoal?.trim(),
          },
        });
      }
    });
    return this.profile(userId);
  }

  async preferences(userId: string) {
    const preference = await this.prisma.userPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return {
      emailNotifications: preference.emailNotifications,
      learningReminder: preference.learningReminder,
      playbackSpeed: Number(preference.defaultPlaybackSpeed),
      reducedMotion: preference.reducedMotion,
    };
  }

  async updatePreferences(userId: string, input: UpdatePreferenceDto) {
    await this.prisma.userPreference.upsert({
      where: { userId },
      update: {
        emailNotifications: input.emailNotifications,
        learningReminder: input.learningReminder,
        defaultPlaybackSpeed: input.playbackSpeed,
        reducedMotion: input.reducedMotion,
      },
      create: {
        userId,
        emailNotifications: input.emailNotifications,
        learningReminder: input.learningReminder,
        defaultPlaybackSpeed: input.playbackSpeed,
        reducedMotion: input.reducedMotion,
      },
    });
    return this.preferences(userId);
  }

  async students(user: AuthenticatedUser) {
    const courseIds =
      user.role === UserRole.TEACHER
        ? await this.courseAccess.assignedCourseIds(user.id)
        : undefined;
    const students = await this.prisma.user.findMany({
      where: {
        role: UserRole.STUDENT,
        ...(courseIds
          ? { courseEnrollments: { some: { courseId: { in: courseIds } } } }
          : {}),
      },
      include: {
        studentProfile: true,
        courseEnrollments: { select: { courseId: true } },
        listeningAttempts: {
          where: { score: { not: null } },
          select: { score: true },
        },
      },
      orderBy: { fullName: "asc" },
    });
    return students.map((student) => ({
      id: student.id,
      fullName: student.fullName,
      email: student.email,
      targetLevel: student.studentProfile?.targetLevel ?? "",
      learningGoal: student.studentProfile?.learningGoal ?? "",
      status: student.status,
      lastActive: (student.lastActiveAt ?? student.createdAt).toISOString(),
      averageScore: this.average(
        student.listeningAttempts.map((attempt) => Number(attempt.score)),
      ),
      enrolledCourseIds: student.courseEnrollments.map((enrollment) => enrollment.courseId),
    }));
  }

  async student(user: AuthenticatedUser, id: string) {
    const student = (await this.students(user)).find((item) => item.id === id);
    if (!student) throw new ConflictException("Student is outside your assigned scope.");
    return student;
  }

  async setStudentStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.update({
      where: { id, role: UserRole.STUDENT },
      data: { status },
    });
    if (status === UserStatus.BLOCKED) {
      await this.prisma.refreshSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { id: user.id, status: user.status };
  }

  async teachers() {
    const teachers = await this.prisma.user.findMany({
      where: { role: UserRole.TEACHER },
      include: {
        teacherProfile: true,
        teacherAssignments: {
          where: { status: AssignmentStatus.ACTIVE },
          select: { courseId: true },
        },
      },
      orderBy: { fullName: "asc" },
    });
    return teachers.map((teacher) => ({
      id: teacher.id,
      fullName: teacher.fullName,
      email: teacher.email,
      status: teacher.status,
      assignedCourseIds: teacher.teacherAssignments.map((assignment) => assignment.courseId),
      notes: teacher.teacherProfile?.notes ?? "",
    }));
  }

  async teacher(id: string) {
    return (await this.teachers()).find((teacher) => teacher.id === id) ?? null;
  }

  async createTeacher(input: CreateTeacherDto) {
    const email = input.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException("An account with this email already exists.");
    }
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: input.fullName.trim(),
        passwordHash,
        role: UserRole.TEACHER,
        status: UserStatus.ACTIVE,
        teacherProfile: {
          create: { expertise: input.expertise ?? [], notes: input.notes },
        },
      },
    });
    return this.teacher(user.id);
  }

  async updateTeacher(id: string, input: UpdateTeacherDto) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id, role: UserRole.TEACHER },
        data: { fullName: input.fullName, status: input.status },
      });
      if (input.notes !== undefined) {
        await tx.teacherProfile.upsert({
          where: { userId: id },
          update: { notes: input.notes },
          create: { userId: id, notes: input.notes },
        });
      }
    });
    return this.teacher(id);
  }

  private average(values: number[]): number {
    return values.length
      ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
      : 0;
  }

}

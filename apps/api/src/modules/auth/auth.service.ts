import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import {
  AuthClientType,
  UserRole,
  UserStatus,
  type User,
} from "../../generated/prisma/client";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { parseDurationSeconds } from "../../config/env.validation";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/auth.dto";

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  targetLevel: string;
  learningGoal: string;
  assignedCourseIds: string[];
}

interface IssuedSession {
  accessToken: string;
  audience?: "listenup-admin";
  user: SafeUser;
  refreshToken: string;
  cookieName: string;
  refreshMaxAgeMs: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterDto): Promise<IssuedSession> {
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException("An account with this email already exists.");
    }
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: input.fullName.trim(),
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        studentProfile: {
          create: {
            targetLevel: input.targetLevel,
            learningGoal: input.learningGoal?.trim(),
          },
        },
        preference: { create: {} },
      },
    });
    return this.issueSession(user, AuthClientType.USER_WEB);
  }

  async login(input: LoginDto): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException("Email or password is incorrect.");
    }
    this.assertClientRole(user, input.clientType);
    if (user.status === UserStatus.BLOCKED) {
      throw new ForbiddenException("This account is blocked.");
    }
    if (user.status === UserStatus.INVITED) {
      throw new ForbiddenException("This invitation has not been accepted.");
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });
    return this.issueSession(user, input.clientType);
  }

  async refresh(clientType: AuthClientType, token: string | undefined): Promise<IssuedSession> {
    if (!token) throw new UnauthorizedException("Refresh session is missing.");
    const tokenHash = this.hashToken(token);
    const session = await this.prisma.refreshSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.clientType !== clientType
    ) {
      throw new UnauthorizedException("Refresh session is invalid or expired.");
    }
    this.assertClientRole(session.user, clientType);
    if (session.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("This account cannot start a session.");
    }

    const nextToken = randomBytes(48).toString("base64url");
    const expiresAt = this.refreshExpiry();
    await this.prisma.$transaction([
      this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      }),
      this.prisma.refreshSession.create({
        data: {
          userId: session.userId,
          clientType,
          refreshTokenHash: this.hashToken(nextToken),
          expiresAt,
        },
      }),
    ]);
    return this.buildIssuedSession(session.user, clientType, nextToken, expiresAt);
  }

  async logout(clientType: AuthClientType, token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.refreshSession.updateMany({
      where: {
        refreshTokenHash: this.hashToken(token),
        clientType,
        revokedAt: null,
      },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
  }

  async me(identity: AuthenticatedUser): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: identity.id } });
    if (!user) throw new UnauthorizedException("Account no longer exists.");
    return this.toSafeUser(user);
  }

  async changePassword(identity: AuthenticatedUser, input: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: identity.id } });
    if (!user || !(await argon2.verify(user.passwordHash, input.currentPassword))) {
      throw new UnauthorizedException("Current password is incorrect.");
    }
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, role: true },
    });
    if (!user) return;
    const token = randomBytes(40).toString("base64url");
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    if (this.config.get<string>("NODE_ENV") !== "production") {
      const base = this.config.getOrThrow<string>(
        user.role === UserRole.STUDENT
          ? "RESET_URL_BASE"
          : "ADMIN_RESET_URL_BASE",
      );
      this.logger.warn(`Development password reset URL: ${base}?token=${encodeURIComponent(token)}`);
    }
  }

  async resetPassword(input: ResetPasswordDto): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(input.token) },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new UnauthorizedException("Password reset token is invalid or expired.");
    }
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueSession(user: User, clientType: AuthClientType): Promise<IssuedSession> {
    const refreshToken = randomBytes(48).toString("base64url");
    const expiresAt = this.refreshExpiry();
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        clientType,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });
    return this.buildIssuedSession(user, clientType, refreshToken, expiresAt);
  }

  private async buildIssuedSession(
    user: User,
    clientType: AuthClientType,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<IssuedSession> {
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        clientType,
        type: "access",
      },
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.getOrThrow<string>("JWT_ACCESS_EXPIRES_IN") as never,
        audience: "listenup-api",
        issuer: "listenup",
      },
    );
    return {
      accessToken,
      ...(clientType === AuthClientType.ADMIN_WEB
        ? { audience: "listenup-admin" as const }
        : {}),
      user: await this.toSafeUser(user),
      refreshToken,
      cookieName: this.cookieName(clientType),
      refreshMaxAgeMs: expiresAt.getTime() - Date.now(),
    };
  }

  private async toSafeUser(user: User): Promise<SafeUser> {
    const [profile, assignments] = await Promise.all([
      this.prisma.studentProfile.findUnique({ where: { userId: user.id } }),
      user.role === UserRole.TEACHER
        ? this.prisma.courseTeacherAssignment.findMany({
            where: { teacherId: user.id, status: "ACTIVE" },
            select: { courseId: true },
          })
        : Promise.resolve([]),
    ]);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      targetLevel: profile?.targetLevel ?? "",
      learningGoal: profile?.learningGoal ?? "",
      assignedCourseIds: assignments.map((assignment) => assignment.courseId),
    };
  }

  private assertClientRole(user: User, clientType: AuthClientType): void {
    const accepted =
      clientType === AuthClientType.USER_WEB
        ? user.role === UserRole.STUDENT
        : user.role === UserRole.ADMIN || user.role === UserRole.TEACHER;
    if (!accepted) throw new ForbiddenException("This account cannot access the selected application.");
  }

  private refreshExpiry(): Date {
    const seconds = parseDurationSeconds(
      this.config.getOrThrow<string>("REFRESH_TOKEN_EXPIRES_IN"),
    );
    return new Date(Date.now() + seconds * 1000);
  }

  cookieName(clientType: AuthClientType): string {
    return clientType === AuthClientType.ADMIN_WEB
      ? "listenup_admin_refresh"
      : "listenup_user_refresh";
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}

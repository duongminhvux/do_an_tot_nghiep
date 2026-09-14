import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { validateEnvironment } from "./config/env.validation";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AccessModule } from "./modules/access/access.module";
import { AttemptsModule } from "./modules/attempts/attempts.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CoursesModule } from "./modules/courses/courses.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { EnrollmentsModule } from "./modules/enrollments/enrollments.module";
import { ExercisesModule } from "./modules/exercises/exercises.module";
import { LessonsModule } from "./modules/lessons/lessons.module";
import { MediaModule } from "./modules/media/media.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SiteModule } from "./modules/site/site.module";
import { TeacherAssignmentsModule } from "./modules/teacher-assignments/teacher-assignments.module";
import { TtsModule } from "./modules/tts/tts.module";
import { UsersModule } from "./modules/users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    AccessModule,
    HealthModule,
    UsersModule,
    CoursesModule,
    DashboardModule,
    LessonsModule,
    ExercisesModule,
    TeacherAssignmentsModule,
    EnrollmentsModule,
    AttemptsModule,
    MediaModule,
    TtsModule,
    SiteModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

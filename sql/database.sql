-- ============================================================================
-- ListenUp operational PostgreSQL 16 schema
-- SOURCE OF TRUTH for database structure.
--
-- Docker initializes a brand-new database by running this file first, followed
-- by sql/seed.sql. Prisma is used only as the application ORM/client mapping;
-- Prisma migrations are intentionally not used by this project.
-- ============================================================================

BEGIN;

-- gen_random_uuid() is available in PostgreSQL 16; pgcrypto is kept explicitly
-- for portability across compatible PostgreSQL installations.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'BLOCKED', 'INVITED');

-- CreateEnum
CREATE TYPE "auth_client_type" AS ENUM ('USER_WEB', 'ADMIN_WEB');

-- CreateEnum
CREATE TYPE "english_level" AS ENUM ('BEGINNER', 'ELEMENTARY', 'PRE_INTERMEDIATE', 'INTERMEDIATE', 'UPPER_INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "course_visibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "progress_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "exercise_type" AS ENUM ('DICTATION', 'TOEIC');

-- CreateEnum
CREATE TYPE "dictation_mode" AS ENUM ('SENTENCE', 'PARAGRAPH');

-- CreateEnum
CREATE TYPE "toeic_part" AS ENUM ('PART_1', 'PART_2', 'PART_3', 'PART_4');

-- CreateEnum
CREATE TYPE "difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "question_kind" AS ENUM ('TEXT_INPUT', 'MULTIPLE_CHOICE');

-- CreateEnum
CREATE TYPE "attempt_status" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "media_type" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "media_storage_provider" AS ENUM ('LOCAL', 'S3', 'R2', 'OTHER');

-- CreateEnum
CREATE TYPE "media_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "lesson_resource_type" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'LINK');

-- CreateEnum
CREATE TYPE "audio_source" AS ENUM ('UPLOAD', 'TTS');

-- CreateEnum
CREATE TYPE "audio_segment_type" AS ENUM ('INTRO', 'NARRATION', 'SPEAKER', 'QUESTION', 'OPTION', 'PAUSE');

-- CreateEnum
CREATE TYPE "tts_job_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "landing_section_type" AS ENUM ('HERO', 'FEATURED_COURSES', 'FEATURES', 'HOW_IT_WORKS', 'TOEIC_PRACTICE', 'DICTATION_DEMO', 'STATISTICS', 'TESTIMONIALS', 'FAQ', 'FOOTER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "avatar_media_id" UUID,
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMPTZ(3),
    "last_active_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "user_id" UUID NOT NULL,
    "target_level" "english_level",
    "learning_goal" TEXT,
    "preferred_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "bio" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "user_id" UUID NOT NULL,
    "bio" TEXT,
    "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "learning_reminder" BOOLEAN NOT NULL DEFAULT true,
    "reminder_time" TIME(0),
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "default_playback_speed" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "reduced_motion" BOOLEAN NOT NULL DEFAULT false,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "client_type" "auth_client_type" NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" INET,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(180) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "level" "english_level" NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "visibility" "course_visibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "thumbnail_media_id" UUID,
    "accent_color" VARCHAR(16),
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_teacher_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "status" "assignment_status" NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "ended_at" TIMESTAMPTZ(3),
    "notes" TEXT,

    CONSTRAINT "course_teacher_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "progress_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_by" UUID,
    "enrolled_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{"blocks":[]}',
    "estimated_duration_minutes" INTEGER NOT NULL DEFAULT 0,
    "order_index" INTEGER NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "cover_media_id" UUID,
    "created_by" UUID,
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "word" VARCHAR(255) NOT NULL,
    "ipa" VARCHAR(255),
    "meaning" TEXT NOT NULL,
    "example" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vocabulary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expression_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "expression" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "example" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expression_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "type" "lesson_resource_type" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "media_id" UUID,
    "external_url" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lesson_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "progress_status" NOT NULL DEFAULT 'NOT_STARTED',
    "progress_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "best_score" DECIMAL(5,2),
    "started_at" TIMESTAMPTZ(3),
    "last_opened_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "public_url" TEXT,
    "mime_type" VARCHAR(255) NOT NULL,
    "type" "media_type" NOT NULL,
    "storage_provider" "media_storage_provider" NOT NULL DEFAULT 'LOCAL',
    "storage_bucket" VARCHAR(255),
    "size_bytes" BIGINT NOT NULL,
    "duration_ms" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "checksum_sha256" CHAR(64),
    "status" "media_status" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "uploaded_by" UUID,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lesson_id" UUID NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "type" "exercise_type" NOT NULL,
    "dictation_mode" "dictation_mode",
    "toeic_part" "toeic_part",
    "title" VARCHAR(255) NOT NULL,
    "instruction" TEXT NOT NULL,
    "difficulty" "difficulty" NOT NULL DEFAULT 'INTERMEDIATE',
    "source_script" TEXT,
    "transcript" TEXT,
    "pass_threshold" DECIMAL(5,2) NOT NULL DEFAULT 80,
    "max_plays" INTEGER NOT NULL DEFAULT 3,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "ignore_capitalization" BOOLEAN NOT NULL DEFAULT true,
    "ignore_punctuation" BOOLEAN NOT NULL DEFAULT true,
    "ignore_extra_spaces" BOOLEAN NOT NULL DEFAULT true,
    "allow_minor_typo" BOOLEAN NOT NULL DEFAULT false,
    "show_transcript" BOOLEAN NOT NULL DEFAULT false,
    "show_answer_after_submit" BOOLEAN NOT NULL DEFAULT true,
    "audio_source" "audio_source" NOT NULL DEFAULT 'UPLOAD',
    "final_audio_media_id" UUID,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listening_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_id" UUID NOT NULL,
    "title" VARCHAR(255),
    "label" VARCHAR(80),
    "shared_script" TEXT,
    "order_index" INTEGER NOT NULL,
    "image_media_id" UUID,
    "shared_audio_media_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exercise_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_id" UUID NOT NULL,
    "group_id" UUID,
    "question_text" TEXT NOT NULL,
    "question_kind" "question_kind" NOT NULL,
    "correct_text" TEXT,
    "image_media_id" UUID,
    "order_index" INTEGER NOT NULL,
    "explanation" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exercise_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "label" VARCHAR(4) NOT NULL,
    "content" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exercise_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_audio_segments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_id" UUID NOT NULL,
    "group_id" UUID,
    "question_id" UUID,
    "segment_type" "audio_segment_type" NOT NULL,
    "speaker_key" VARCHAR(80),
    "speaker_label" VARCHAR(120),
    "text" TEXT NOT NULL,
    "voice_id" VARCHAR(160),
    "language" VARCHAR(20) NOT NULL DEFAULT 'en-US',
    "speed" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "pause_after_ms" INTEGER NOT NULL DEFAULT 0,
    "order_index" INTEGER NOT NULL,
    "media_id" UUID,
    "generation_status" "tts_job_status",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "exercise_audio_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "status" "attempt_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" DECIMAL(5,2),
    "passed" BOOLEAN,
    "attempt_number" INTEGER NOT NULL,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(3),
    "graded_at" TIMESTAMPTZ(3),
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listening_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "selected_option_id" UUID,
    "student_text" TEXT,
    "correct_text" TEXT,
    "is_correct" BOOLEAN,
    "score" DECIMAL(5,2),
    "feedback" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_listen_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attempt_id" UUID NOT NULL,
    "group_id" UUID,
    "play_number" INTEGER NOT NULL,
    "played_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playback_speed" DECIMAL(3,2),

    CONSTRAINT "attempt_listen_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tts_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exercise_id" UUID,
    "group_id" UUID,
    "audio_segment_id" UUID,
    "requested_by" UUID,
    "provider" VARCHAR(80) NOT NULL,
    "model" VARCHAR(120),
    "language" VARCHAR(20) NOT NULL DEFAULT 'en-US',
    "voice_id" VARCHAR(160) NOT NULL,
    "speed" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "input_text" TEXT NOT NULL,
    "normalized_text" TEXT NOT NULL,
    "input_hash" CHAR(64) NOT NULL,
    "status" "tts_job_status" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "output_media_id" UUID,
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tts_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tts_settings" (
    "id" VARCHAR(50) NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" VARCHAR(80) NOT NULL,
    "default_language" VARCHAR(20) NOT NULL DEFAULT 'en-US',
    "default_voice_id" VARCHAR(160) NOT NULL,
    "default_speed" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "provider_config" JSONB NOT NULL DEFAULT '{}',
    "secret_reference" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tts_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "landing_section_type" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "landing_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" VARCHAR(50) NOT NULL DEFAULT 'default',
    "site_name" VARCHAR(120) NOT NULL,
    "logo_media_id" UUID,
    "favicon_media_id" UUID,
    "primary_color" VARCHAR(16) NOT NULL DEFAULT '#2563EB',
    "contact_email" VARCHAR(320),
    "contact_phone" VARCHAR(40),
    "address" TEXT,
    "footer_text" TEXT,
    "social_links" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_status_last_active_at_idx" ON "users"("status", "last_active_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_refresh_token_hash_key" ON "refresh_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "refresh_sessions_user_id_client_type_expires_at_idx" ON "refresh_sessions"("user_id", "client_type", "expires_at");

-- CreateIndex
CREATE INDEX "refresh_sessions_expires_at_revoked_at_idx" ON "refresh_sessions"("expires_at", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_status_visibility_order_index_idx" ON "courses"("status", "visibility", "order_index");

-- CreateIndex
CREATE INDEX "courses_level_status_idx" ON "courses"("level", "status");

-- CreateIndex
CREATE INDEX "course_teacher_assignments_teacher_id_status_idx" ON "course_teacher_assignments"("teacher_id", "status");

-- CreateIndex
CREATE INDEX "course_teacher_assignments_course_id_status_idx" ON "course_teacher_assignments"("course_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "course_teacher_assignments_course_id_teacher_id_key" ON "course_teacher_assignments"("course_id", "teacher_id");

-- CreateIndex
CREATE INDEX "course_enrollments_student_id_status_last_accessed_at_idx" ON "course_enrollments"("student_id", "status", "last_accessed_at");

-- CreateIndex
CREATE INDEX "course_enrollments_course_id_status_idx" ON "course_enrollments"("course_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_course_id_student_id_key" ON "course_enrollments"("course_id", "student_id");

-- CreateIndex
CREATE INDEX "lessons_course_id_status_order_index_idx" ON "lessons"("course_id", "status", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_course_id_slug_key" ON "lessons"("course_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_course_id_order_index_key" ON "lessons"("course_id", "order_index");

-- CreateIndex
CREATE INDEX "vocabulary_items_lesson_id_word_idx" ON "vocabulary_items"("lesson_id", "word");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_items_lesson_id_order_index_key" ON "vocabulary_items"("lesson_id", "order_index");

-- CreateIndex
CREATE INDEX "expression_items_lesson_id_idx" ON "expression_items"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "expression_items_lesson_id_order_index_key" ON "expression_items"("lesson_id", "order_index");

-- CreateIndex
CREATE INDEX "lesson_resources_media_id_idx" ON "lesson_resources"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_resources_lesson_id_order_index_key" ON "lesson_resources"("lesson_id", "order_index");

-- CreateIndex
CREATE INDEX "lesson_progress_student_id_status_updated_at_idx" ON "lesson_progress"("student_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "lesson_progress_lesson_id_status_idx" ON "lesson_progress"("lesson_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_lesson_id_student_id_key" ON "lesson_progress"("lesson_id", "student_id");

-- CreateIndex
CREATE INDEX "media_files_type_status_created_at_idx" ON "media_files"("type", "status", "created_at");

-- CreateIndex
CREATE INDEX "media_files_uploaded_by_status_idx" ON "media_files"("uploaded_by", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_files_storage_provider_storage_key_key" ON "media_files"("storage_provider", "storage_key");

-- CreateIndex
CREATE INDEX "listening_exercises_lesson_id_type_toeic_part_status_idx" ON "listening_exercises"("lesson_id", "type", "toeic_part", "status");

-- CreateIndex
CREATE INDEX "listening_exercises_status_updated_at_idx" ON "listening_exercises"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "listening_exercises_lesson_id_slug_key" ON "listening_exercises"("lesson_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "listening_exercises_lesson_id_order_index_key" ON "listening_exercises"("lesson_id", "order_index");

-- CreateIndex
CREATE INDEX "exercise_groups_exercise_id_idx" ON "exercise_groups"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_groups_exercise_id_order_index_key" ON "exercise_groups"("exercise_id", "order_index");

-- CreateIndex
CREATE INDEX "exercise_questions_exercise_id_group_id_order_index_idx" ON "exercise_questions"("exercise_id", "group_id", "order_index");

-- CreateIndex
CREATE INDEX "exercise_questions_group_id_order_index_idx" ON "exercise_questions"("group_id", "order_index");

-- CreateIndex
CREATE INDEX "exercise_options_question_id_idx" ON "exercise_options"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_options_question_id_label_key" ON "exercise_options"("question_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_options_question_id_order_index_key" ON "exercise_options"("question_id", "order_index");

-- CreateIndex
CREATE INDEX "exercise_audio_segments_exercise_id_group_id_question_id_idx" ON "exercise_audio_segments"("exercise_id", "group_id", "question_id");

-- CreateIndex
CREATE INDEX "exercise_audio_segments_generation_status_idx" ON "exercise_audio_segments"("generation_status");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_audio_segments_exercise_id_order_index_key" ON "exercise_audio_segments"("exercise_id", "order_index");

-- CreateIndex
CREATE INDEX "listening_attempts_student_id_status_submitted_at_idx" ON "listening_attempts"("student_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "listening_attempts_exercise_id_status_submitted_at_idx" ON "listening_attempts"("exercise_id", "status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "listening_attempts_exercise_id_student_id_attempt_number_key" ON "listening_attempts"("exercise_id", "student_id", "attempt_number");

-- CreateIndex
CREATE INDEX "attempt_answers_attempt_id_idx" ON "attempt_answers"("attempt_id");

-- CreateIndex
CREATE INDEX "attempt_answers_question_id_idx" ON "attempt_answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_answers_attempt_id_question_id_key" ON "attempt_answers"("attempt_id", "question_id");

-- CreateIndex
CREATE INDEX "attempt_listen_events_attempt_id_played_at_idx" ON "attempt_listen_events"("attempt_id", "played_at");

CREATE INDEX "attempt_listen_events_attempt_id_group_id_idx" ON "attempt_listen_events"("attempt_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_listen_events_attempt_id_play_number_key" ON "attempt_listen_events"("attempt_id", "play_number");

-- CreateIndex
CREATE UNIQUE INDEX "tts_jobs_output_media_id_key" ON "tts_jobs"("output_media_id");

-- CreateIndex
CREATE INDEX "tts_jobs_status_created_at_idx" ON "tts_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "tts_jobs_requested_by_created_at_idx" ON "tts_jobs"("requested_by", "created_at");

-- CreateIndex
CREATE INDEX "tts_jobs_exercise_id_status_idx" ON "tts_jobs"("exercise_id", "status");

-- CreateIndex
CREATE INDEX "tts_jobs_audio_segment_id_status_idx" ON "tts_jobs"("audio_segment_id", "status");

CREATE INDEX "tts_jobs_group_id_status_idx" ON "tts_jobs"("group_id", "status");

-- CreateIndex
CREATE INDEX "landing_sections_enabled_order_index_idx" ON "landing_sections"("enabled", "order_index");

-- CreateIndex
CREATE INDEX "landing_sections_status_order_index_idx" ON "landing_sections"("status", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "landing_sections_type_version_key" ON "landing_sections"("type", "version");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_media_id_fkey" FOREIGN KEY ("avatar_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnail_media_id_fkey" FOREIGN KEY ("thumbnail_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_teacher_assignments" ADD CONSTRAINT "course_teacher_assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_teacher_assignments" ADD CONSTRAINT "course_teacher_assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_teacher_assignments" ADD CONSTRAINT "course_teacher_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_enrolled_by_fkey" FOREIGN KEY ("enrolled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_cover_media_id_fkey" FOREIGN KEY ("cover_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expression_items" ADD CONSTRAINT "expression_items_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_exercises" ADD CONSTRAINT "listening_exercises_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_exercises" ADD CONSTRAINT "listening_exercises_final_audio_media_id_fkey" FOREIGN KEY ("final_audio_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_exercises" ADD CONSTRAINT "listening_exercises_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_groups" ADD CONSTRAINT "exercise_groups_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "listening_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_groups" ADD CONSTRAINT "exercise_groups_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_groups" ADD CONSTRAINT "exercise_groups_shared_audio_media_id_fkey" FOREIGN KEY ("shared_audio_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_questions" ADD CONSTRAINT "exercise_questions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "listening_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_questions" ADD CONSTRAINT "exercise_questions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "exercise_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_questions" ADD CONSTRAINT "exercise_questions_image_media_id_fkey" FOREIGN KEY ("image_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_options" ADD CONSTRAINT "exercise_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exercise_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_audio_segments" ADD CONSTRAINT "exercise_audio_segments_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "listening_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_audio_segments" ADD CONSTRAINT "exercise_audio_segments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "exercise_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_audio_segments" ADD CONSTRAINT "exercise_audio_segments_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exercise_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_audio_segments" ADD CONSTRAINT "exercise_audio_segments_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_attempts" ADD CONSTRAINT "listening_attempts_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "listening_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_attempts" ADD CONSTRAINT "listening_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "listening_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "exercise_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_selected_option_id_fkey" FOREIGN KEY ("selected_option_id") REFERENCES "exercise_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_listen_events" ADD CONSTRAINT "attempt_listen_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "listening_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attempt_listen_events" ADD CONSTRAINT "attempt_listen_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "exercise_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_jobs" ADD CONSTRAINT "tts_jobs_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "listening_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tts_jobs" ADD CONSTRAINT "tts_jobs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "exercise_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_jobs" ADD CONSTRAINT "tts_jobs_audio_segment_id_fkey" FOREIGN KEY ("audio_segment_id") REFERENCES "exercise_audio_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_jobs" ADD CONSTRAINT "tts_jobs_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tts_jobs" ADD CONSTRAINT "tts_jobs_output_media_id_fkey" FOREIGN KEY ("output_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logo_media_id_fkey" FOREIGN KEY ("logo_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_favicon_media_id_fkey" FOREIGN KEY ("favicon_media_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma does not currently express PostgreSQL CHECK constraints. These
-- constraints are part of the canonical migration and protect invariants even
-- when data is written outside Prisma Client.
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_normalized_check"
  CHECK ("email" = lower(btrim("email")));

ALTER TABLE "refresh_sessions"
  ADD CONSTRAINT "refresh_sessions_expiry_check"
  CHECK ("expires_at" > "created_at");

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_expiry_check"
  CHECK ("expires_at" > "created_at");

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_order_index_check" CHECK ("order_index" >= 0),
  ADD CONSTRAINT "courses_accent_color_check"
  CHECK ("accent_color" IS NULL OR "accent_color" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "course_teacher_assignments"
  ADD CONSTRAINT "course_teacher_assignment_dates_check"
  CHECK ("ended_at" IS NULL OR "ended_at" >= "assigned_at"),
  ADD CONSTRAINT "course_teacher_assignment_status_check"
  CHECK (
    ("status" = 'ACTIVE' AND "ended_at" IS NULL)
    OR ("status" = 'ENDED' AND "ended_at" IS NOT NULL)
  );

ALTER TABLE "course_enrollments"
  ADD CONSTRAINT "course_enrollment_progress_check"
  CHECK ("progress_percent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "course_enrollment_completion_check"
  CHECK ("status" <> 'COMPLETED' OR "completed_at" IS NOT NULL);

ALTER TABLE "lessons"
  ADD CONSTRAINT "lessons_duration_check"
  CHECK ("estimated_duration_minutes" >= 0),
  ADD CONSTRAINT "lessons_order_index_check" CHECK ("order_index" >= 0);

ALTER TABLE "vocabulary_items"
  ADD CONSTRAINT "vocabulary_items_order_index_check" CHECK ("order_index" >= 0);

ALTER TABLE "expression_items"
  ADD CONSTRAINT "expression_items_order_index_check" CHECK ("order_index" >= 0);

ALTER TABLE "lesson_resources"
  ADD CONSTRAINT "lesson_resources_order_index_check" CHECK ("order_index" >= 0),
  ADD CONSTRAINT "lesson_resources_source_check"
  CHECK (
    ("type" = 'LINK' AND "external_url" IS NOT NULL)
    OR ("type" <> 'LINK' AND "media_id" IS NOT NULL)
  );

ALTER TABLE "lesson_progress"
  ADD CONSTRAINT "lesson_progress_percent_check"
  CHECK ("progress_percent" BETWEEN 0 AND 100),
  ADD CONSTRAINT "lesson_progress_best_score_check"
  CHECK ("best_score" IS NULL OR "best_score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "lesson_progress_completion_check"
  CHECK ("status" <> 'COMPLETED' OR "completed_at" IS NOT NULL);

ALTER TABLE "media_files"
  ADD CONSTRAINT "media_files_size_check" CHECK ("size_bytes" >= 0),
  ADD CONSTRAINT "media_files_duration_check"
  CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0),
  ADD CONSTRAINT "media_files_dimensions_check"
  CHECK (
    ("width" IS NULL OR "width" >= 0)
    AND ("height" IS NULL OR "height" >= 0)
  );

ALTER TABLE "listening_exercises"
  ADD CONSTRAINT "listening_exercises_type_check"
  CHECK (
    ("type" = 'DICTATION' AND "dictation_mode" IS NOT NULL AND "toeic_part" IS NULL)
    OR ("type" = 'TOEIC' AND "toeic_part" IS NOT NULL AND "dictation_mode" IS NULL)
  ),
  ADD CONSTRAINT "listening_exercises_threshold_check"
  CHECK ("pass_threshold" BETWEEN 0 AND 100),
  ADD CONSTRAINT "listening_exercises_limits_check"
  CHECK ("max_plays" > 0 AND "max_attempts" > 0),
  ADD CONSTRAINT "listening_exercises_order_index_check"
  CHECK ("order_index" >= 0);

ALTER TABLE "exercise_groups"
  ADD CONSTRAINT "exercise_groups_order_index_check" CHECK ("order_index" >= 0);

ALTER TABLE "exercise_questions"
  ADD CONSTRAINT "exercise_questions_order_index_check" CHECK ("order_index" >= 0),
  ADD CONSTRAINT "exercise_questions_kind_check"
  CHECK (
    ("question_kind" = 'TEXT_INPUT' AND "correct_text" IS NOT NULL)
    OR ("question_kind" = 'MULTIPLE_CHOICE' AND "correct_text" IS NULL)
  );

ALTER TABLE "exercise_options"
  ADD CONSTRAINT "exercise_options_order_index_check" CHECK ("order_index" >= 0);

CREATE UNIQUE INDEX "exercise_options_one_correct_per_question"
  ON "exercise_options" ("question_id")
  WHERE "is_correct" = true;

ALTER TABLE "exercise_audio_segments"
  ADD CONSTRAINT "exercise_audio_segments_speed_check"
  CHECK ("speed" BETWEEN 0.50 AND 2.00),
  ADD CONSTRAINT "exercise_audio_segments_pause_check"
  CHECK ("pause_after_ms" >= 0),
  ADD CONSTRAINT "exercise_audio_segments_order_index_check"
  CHECK ("order_index" >= 0);

ALTER TABLE "listening_attempts"
  ADD CONSTRAINT "listening_attempts_score_check"
  CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "listening_attempts_attempt_number_check"
  CHECK ("attempt_number" > 0),
  ADD CONSTRAINT "listening_attempts_play_count_check" CHECK ("play_count" >= 0),
  ADD CONSTRAINT "listening_attempts_duration_check"
  CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0),
  ADD CONSTRAINT "listening_attempts_submission_check"
  CHECK (
    "status" NOT IN ('SUBMITTED', 'GRADED')
    OR "submitted_at" IS NOT NULL
  ),
  ADD CONSTRAINT "listening_attempts_grading_check"
  CHECK ("status" <> 'GRADED' OR "graded_at" IS NOT NULL);

ALTER TABLE "attempt_answers"
  ADD CONSTRAINT "attempt_answers_score_check"
  CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "attempt_answers_value_check"
  CHECK (
    ("selected_option_id" IS NOT NULL AND "student_text" IS NULL)
    OR ("selected_option_id" IS NULL AND "student_text" IS NOT NULL)
  );

ALTER TABLE "attempt_listen_events"
  ADD CONSTRAINT "attempt_listen_events_play_number_check"
  CHECK ("play_number" > 0),
  ADD CONSTRAINT "attempt_listen_events_speed_check"
  CHECK ("playback_speed" IS NULL OR "playback_speed" BETWEEN 0.50 AND 2.00);

ALTER TABLE "tts_jobs"
  ADD CONSTRAINT "tts_jobs_speed_check" CHECK ("speed" BETWEEN 0.50 AND 2.00),
  ADD CONSTRAINT "tts_jobs_progress_check" CHECK ("progress" BETWEEN 0 AND 100),
  ADD CONSTRAINT "tts_jobs_retry_count_check" CHECK ("retry_count" >= 0);

ALTER TABLE "tts_settings"
  ADD CONSTRAINT "tts_settings_default_speed_check"
  CHECK ("default_speed" BETWEEN 0.50 AND 2.00),
  ADD CONSTRAINT "tts_settings_secret_reference_check"
  CHECK (
    "secret_reference" IS NULL
    OR "secret_reference" !~* '(api[_-]?key|secret|token)=[^/]+'
  );

ALTER TABLE "landing_sections"
  ADD CONSTRAINT "landing_sections_order_index_check" CHECK ("order_index" >= 0),
  ADD CONSTRAINT "landing_sections_version_check" CHECK ("version" > 0);

ALTER TABLE "site_settings"
  ADD CONSTRAINT "site_settings_primary_color_check"
  CHECK ("primary_color" ~ '^#[0-9A-Fa-f]{6}$');

-- Composite integrity prevents a question or segment from pointing at a group
-- belonging to another exercise and prevents an answer from selecting an
-- option belonging to another question.
ALTER TABLE "exercise_groups"
  ADD CONSTRAINT "exercise_groups_id_exercise_id_key"
  UNIQUE ("id", "exercise_id");

ALTER TABLE "exercise_questions"
  ADD CONSTRAINT "exercise_questions_id_exercise_id_key"
  UNIQUE ("id", "exercise_id"),
  ADD CONSTRAINT "exercise_questions_group_exercise_fkey"
  FOREIGN KEY ("group_id", "exercise_id")
  REFERENCES "exercise_groups" ("id", "exercise_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exercise_options"
  ADD CONSTRAINT "exercise_options_id_question_id_key"
  UNIQUE ("id", "question_id");

ALTER TABLE "exercise_audio_segments"
  ADD CONSTRAINT "exercise_audio_segments_group_exercise_fkey"
  FOREIGN KEY ("group_id", "exercise_id")
  REFERENCES "exercise_groups" ("id", "exercise_id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "exercise_audio_segments_question_exercise_fkey"
  FOREIGN KEY ("question_id", "exercise_id")
  REFERENCES "exercise_questions" ("id", "exercise_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attempt_answers"
  ADD CONSTRAINT "attempt_answers_option_question_fkey"
  FOREIGN KEY ("selected_option_id", "question_id")
  REFERENCES "exercise_options" ("id", "question_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

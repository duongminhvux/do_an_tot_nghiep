"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { HomeData } from "../hooks/use-home-data";
import type { LearningModule } from "@/services/learning-activity.service";
import type { DictationLessonSummary } from "@/types/dictation";
import { MODULE_META, MODULES, moduleName } from "./module-meta";
import { surface } from "@/components/ui/page";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CardContent {
  headline: string;
  detail?: string;
  progress?: number;
  cta: string;
  href: string;
}

function ModuleCard({
  data,
  module,
  content,
  loading,
}: {
  data: HomeData;
  module: LearningModule;
  content: CardContent;
  loading: boolean;
}) {
  const { t, locale, home } = data;
  const meta = MODULE_META[module];
  const Icon = meta.icon;
  const totals = home.data?.byModule[module];
  return (
    <article
      className={cn(
        surface,
        "flex flex-col p-5 transition hover:border-blue-300 hover:shadow-md",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.tone}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">
            {moduleName(t, module)}
          </h3>
          <p className="text-xs text-slate-500">
            {t("modules.totals", {
              count: totals?.count ?? 0,
              xp: totals?.xp ?? 0,
            })}
          </p>
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-1.5">
        {loading ? (
          <>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </>
        ) : (
          <>
            <p className="line-clamp-2 text-sm font-medium text-slate-800">
              {content.headline}
            </p>
            {content.detail && (
              <p className="text-xs text-slate-500">{content.detail}</p>
            )}
            {content.progress !== undefined && (
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, content.progress))}%`,
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>

      <Link
        href={`/${locale}${content.href}`}
        className={cn(
          buttonVariants({ variant: "secondary", size: "sm" }),
          "mt-4 w-full justify-between",
        )}
      >
        {content.cta}
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

export function ContinueLearning({ data }: { data: HomeData }) {
  const { t, modules, home } = data;
  const vocab = modules.vocabulary.data;
  const dictation = modules.dictation.data;
  const toeic = modules.toeicStats.data?.data;
  const attempt = modules.toeicInProgress.data;
  const arena = modules.arena.data;

  const unfinished = dictation?.items.find((item) => !item.completed);
  const unfinishedLesson =
    unfinished && typeof unfinished.lessonId === "object"
      ? (unfinished.lessonId as DictationLessonSummary)
      : null;
  const attemptExam =
    attempt && typeof attempt.examId === "object"
      ? attempt.examId.name
      : "TOEIC";

  const contents: Record<LearningModule, CardContent> = {
    VOCABULARY: vocab?.wordsToReview
      ? {
          headline: t("modules.vocabulary.review", {
            count: vocab.wordsToReview,
          }),
          detail: t("modules.vocabulary.review_hint"),
          cta: t("modules.vocabulary.review_cta"),
          href: "/vocabulary/review",
        }
      : vocab?.currentLesson
        ? {
            headline: t("modules.vocabulary.lesson", {
              title: vocab.currentLesson.title,
            }),
            detail: vocab.currentLesson.collectionName,
            progress: vocab.currentLesson.progress,
            cta: t("modules.vocabulary.lesson_cta"),
            href: vocab.currentLesson.collectionSlug
              ? `/vocabulary/${vocab.currentLesson.collectionSlug}/lessons/${vocab.currentLesson.slug}`
              : "/vocabulary",
          }
        : {
            headline: t("modules.vocabulary.empty"),
            cta: t("modules.vocabulary.explore_cta"),
            href: "/vocabulary",
          },
    DICTATION: unfinishedLesson
      ? {
          headline: t("modules.dictation.unfinished", {
            title: unfinishedLesson.title,
          }),
          detail: t("modules.dictation.sentences", {
            done:
              unfinished!.completedSegments.length +
              (unfinished!.revealedSegments?.length ?? 0),
            total: unfinishedLesson.sentenceCount,
          }),
          progress: unfinishedLesson.sentenceCount
            ? ((unfinished!.completedSegments.length +
                (unfinished!.revealedSegments?.length ?? 0)) /
                unfinishedLesson.sentenceCount) *
              100
            : 0,
          cta: t("modules.continue"),
          href: `/dictation/${unfinishedLesson.slug}`,
        }
      : {
          headline: dictation?.completed
            ? t("modules.dictation.completed", { count: dictation.completed })
            : t("modules.dictation.empty"),
          cta: t("modules.dictation.cta"),
          href: "/dictation",
        },
    TOEIC: attempt
      ? {
          headline: t("modules.toeic.unfinished", { title: attemptExam }),
          detail: t("modules.toeic.answered", {
            answered: attempt.answeredQuestions ?? 0,
            total: attempt.totalQuestions ?? 0,
          }),
          progress: attempt.totalQuestions
            ? ((attempt.answeredQuestions ?? 0) / attempt.totalQuestions) * 100
            : 0,
          cta: t("modules.continue"),
          href: `/toeic/attempts/${attempt._id}`,
        }
      : {
          headline:
            toeic?.avgScore != null
              ? t("modules.toeic.avg_score", {
                  score: toeic.avgScore,
                  best: toeic.highestScore,
                })
              : toeic?.totalCompleted
                ? t("modules.toeic.completed", { count: toeic.totalCompleted })
                : t("modules.toeic.empty"),
          cta: t("modules.toeic.cta"),
          href: "/toeic",
        },
    ARENA: {
      headline: arena
        ? t("modules.arena.rating", { rating: arena.rating })
        : t("modules.arena.empty"),
      detail: arena?.ranked.matches
        ? t("modules.arena.record", {
            wins: arena.ranked.wins,
            losses: arena.ranked.losses,
            change: `${arena.todayRatingChange >= 0 ? "+" : ""}${arena.todayRatingChange}`,
          })
        : undefined,
      cta: t("modules.arena.cta"),
      href: "/arena",
    },
    MINIGAME: {
      headline: home.data?.byModule.MINIGAME.count
        ? t("modules.minigame.played", {
            count: home.data.byModule.MINIGAME.count,
          })
        : t("modules.minigame.empty"),
      cta: t("modules.minigame.cta"),
      href: "/games",
    },
  };

  const loading: Record<LearningModule, boolean> = {
    VOCABULARY: modules.vocabulary.isLoading,
    DICTATION: modules.dictation.isLoading,
    TOEIC: modules.toeicStats.isLoading || modules.toeicInProgress.isLoading,
    ARENA: modules.arena.isLoading,
    MINIGAME: home.isLoading,
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">
        {t("modules.title")}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {MODULES.map((module) => (
          <ModuleCard
            key={module}
            data={data}
            module={module}
            content={contents[module]}
            loading={loading[module]}
          />
        ))}
      </div>
    </section>
  );
}

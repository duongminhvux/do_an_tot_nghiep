'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  GraduationCap,
  Headphones,
  BookOpen,
  BookMarked,
  Award,
  Target,
  Tag,
  BarChart3,
  BarChart2,
  Clock,
  Lightbulb,
  FileText,
  ChevronRight,
  Play,
  X,
  Package,
  CheckCircle2,
  Info,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { toeicService, ToeicExamSummary } from '@/services/toeic.service';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

interface GroupCardConfig {
  id: string;
  slug: string;
  rawGroupId?: string;
  title: string;
  description: string;
  icon: typeof Headphones;
  iconBg: string;
  iconColor: string;
  examCount: number;
  attemptsCount?: string;
  filterKey?: string;
}

interface TipDetail {
  id: string;
  icon: typeof Target;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  content: string[];
}

const GROUP_PALETTE = [
  { icon: Headphones, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
  { icon: BookOpen, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { icon: BookMarked, iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
  { icon: Award, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  { icon: Tag, iconBg: 'bg-rose-50', iconColor: 'text-rose-600' },
  { icon: Target, iconBg: 'bg-red-50', iconColor: 'text-red-600' },
  { icon: BarChart3, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
  { icon: Lightbulb, iconBg: 'bg-teal-50', iconColor: 'text-teal-600' },
];

export default function ToeicExamsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('toeic');

  // Modals state
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [scoringModalOpen, setScoringModalOpen] = useState(false);
  const [activeTip, setActiveTip] = useState<TipDetail | null>(null);

  // Fetch actual groups from backend API (if available)
  const { data: groupsData } = useQuery({
    queryKey: ['toeic-groups'],
    queryFn: () => toeicService.getGroups({ limit: 50 }),
    staleTime: 30_000,
  });

  const rawApiGroups = unwrap<any>(groupsData);
  const apiGroupsList: any[] = Array.isArray(rawApiGroups)
    ? rawApiGroups
    : Array.isArray(rawApiGroups?.data)
    ? rawApiGroups.data
    : [];

  // Preset groups localized (used as fallback or default)
  const presetGroups: GroupCardConfig[] = useMemo(
    () => [
      {
        id: 'basic-listening',
        slug: 'basic-listening',
        title: t('groups.basic_listening.title'),
        description: t('groups.basic_listening.desc'),
        icon: Headphones,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        examCount: 12,
        attemptsCount: '1,200',
        filterKey: 'listening',
      },
      {
        id: 'basic-reading',
        slug: 'basic-reading',
        title: t('groups.basic_reading.title'),
        description: t('groups.basic_reading.desc'),
        icon: BookOpen,
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        examCount: 10,
        attemptsCount: '980',
        filterKey: 'reading',
      },
      {
        id: 'practice-tests',
        slug: 'practice-tests',
        title: t('groups.practice_tests.title'),
        description: t('groups.practice_tests.desc'),
        icon: BookMarked,
        iconBg: 'bg-purple-50',
        iconColor: 'text-purple-600',
        examCount: 8,
        attemptsCount: '2,450',
        filterKey: 'full',
      },
      {
        id: 'by-level',
        slug: 'by-level',
        title: t('groups.by_level.title'),
        description: t('groups.by_level.desc'),
        icon: Award,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        examCount: 15,
        attemptsCount: '1,800',
        filterKey: 'level',
      },
      {
        id: 'by-topic',
        slug: 'by-topic',
        title: t('groups.by_topic.title'),
        description: t('groups.by_topic.desc'),
        icon: Tag,
        iconBg: 'bg-rose-50',
        iconColor: 'text-rose-600',
        examCount: 20,
        attemptsCount: '1,650',
        filterKey: 'topic',
      },
      {
        id: 'advanced',
        slug: 'advanced',
        title: t('groups.advanced.title'),
        description: t('groups.advanced.desc'),
        icon: Target,
        iconBg: 'bg-red-50',
        iconColor: 'text-red-600',
        examCount: 6,
        attemptsCount: '720',
        filterKey: 'advanced',
      },
    ],
    [t]
  );

  // Computed displayed groups (real backend groups or fallback presets)
  const displayGroups: GroupCardConfig[] = useMemo(() => {
    if (apiGroupsList.length > 0) {
      return apiGroupsList.map((g: any, index: number) => {
        const palette = GROUP_PALETTE[index % GROUP_PALETTE.length] || GROUP_PALETTE[0]!;
        return {
          id: g._id,
          slug: g.slug || g._id,
          rawGroupId: g._id,
          title: g.name || g.title,
          description: g.description || t('groups.desc'),
          icon: palette.icon,
          iconBg: palette.iconBg,
          iconColor: palette.iconColor,
          examCount: g.examCount ?? 0,
        };
      });
    }
    return presetGroups;
  }, [apiGroupsList, presetGroups, t]);

  // Tips configuration localized
  const toeicTips: TipDetail[] = useMemo(() => {
    const partStrategyItems = (t('tips.part_strategy.items', { returnObjects: true }) as string[]) || [];
    const commonMistakesItems = (t('tips.common_mistakes.items', { returnObjects: true }) as string[]) || [];
    const timeManagementItems = (t('tips.time_management.items', { returnObjects: true }) as string[]) || [];
    const vocabGrammarItems = (t('tips.vocabulary_grammar.items', { returnObjects: true }) as string[]) || [];
    const highScoreItems = (t('tips.high_score_tips.items', { returnObjects: true }) as string[]) || [];

    return [
      {
        id: 'part-strategy',
        icon: Target,
        iconBg: 'bg-rose-50',
        iconColor: 'text-rose-600',
        title: t('tips.part_strategy.title'),
        subtitle: t('tips.part_strategy.subtitle'),
        content: Array.isArray(partStrategyItems) ? partStrategyItems : [],
      },
      {
        id: 'common-mistakes',
        icon: Lightbulb,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        title: t('tips.common_mistakes.title'),
        subtitle: t('tips.common_mistakes.subtitle'),
        content: Array.isArray(commonMistakesItems) ? commonMistakesItems : [],
      },
      {
        id: 'time-management',
        icon: Clock,
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        title: t('tips.time_management.title'),
        subtitle: t('tips.time_management.subtitle'),
        content: Array.isArray(timeManagementItems) ? timeManagementItems : [],
      },
      {
        id: 'vocabulary-grammar',
        icon: FileText,
        iconBg: 'bg-sky-50',
        iconColor: 'text-sky-600',
        title: t('tips.vocabulary_grammar.title'),
        subtitle: t('tips.vocabulary_grammar.subtitle'),
        content: Array.isArray(vocabGrammarItems) ? vocabGrammarItems : [],
      },
      {
        id: 'high-score-tips',
        icon: BarChart3,
        iconBg: 'bg-indigo-50',
        iconColor: 'text-indigo-600',
        title: t('tips.high_score_tips.title'),
        subtitle: t('tips.high_score_tips.subtitle'),
        content: Array.isArray(highScoreItems) ? highScoreItems : [],
      },
    ];
  }, [t]);

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1400px]">
        {/* Main Grid: Left Column (Hero + Groups) & Right Column (Structure + Scoring + Tips) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ===================== LEFT COLUMN (8 cols) ===================== */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. Hero Banner */}
            <div className="relative overflow-hidden rounded border border-slate-200/80 bg-white shadow-xs">
              <div className="relative z-10 flex flex-col justify-center p-6 sm:p-8 md:p-10 max-w-[62%] sm:max-w-[55%]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('banner.tag')}
                </span>
                <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-[#111827] leading-tight">
                  {t('banner.title_part1')}
                  <br />
                  {t('banner.title_part2')}
                </h1>
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-500">
                  {t('banner.desc')}
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setGuideModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 shadow-sm transition active:scale-95 cursor-pointer"
                  >
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-blue-600">
                      <Play className="h-2.5 w-2.5 fill-current ml-0.5" />
                    </div>
                    <span>{t('banner.btn_guide')}</span>
                  </button>
                </div>
              </div>

              {/* Right side banner background image */}
              <div className="absolute top-0 right-0 bottom-0 w-[50%] sm:w-[52%] overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/40 to-transparent z-10 w-28" />
                <Image
                  src="/images/toeic/banner.jpg"
                  alt="TOEIC Study Workspace"
                  fill
                  priority
                  className="object-cover object-center"
                  sizes="(max-width: 1024px) 50vw, 40vw"
                />
              </div>
            </div>

            {/* 2. Các nhóm đề thi Section (NO image on cards, links to detail page via slug) */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    {t('groups.title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    {t('groups.desc')}
                  </p>
                </div>
              </div>

              {/* Group Cards Grid without image, clicking navigates to /toeic/[slug] */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayGroups.map((group) => {
                  const Icon = group.icon;
                  return (
                    <Link
                      key={group.id}
                      href={`/${locale}/toeic/${group.slug}`}
                      className="group flex flex-col justify-between rounded border border-slate-200/90 bg-white p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition-all duration-200 cursor-pointer"
                    >
                      <div>
                        {/* Top row: Icon + Test Count Badge */}
                        <div className="flex items-center justify-between">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-full ${group.iconBg} ${group.iconColor} transition-transform duration-200 group-hover:scale-105 shadow-xs`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                            {t('groups.exam_count', { count: group.examCount })}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div className="mt-3.5">
                          <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">
                            {group.title}
                          </h3>
                          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2">
                            {group.description}
                          </p>
                        </div>
                      </div>

                      {/* Bottom Info Bar */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                          <Package className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {group.attemptsCount
                              ? t('groups.attempts_count', { count: group.attemptsCount })
                              : `${group.examCount} ${t('modals.group_exams.questions')}`}
                          </span>
                        </div>

                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ===================== RIGHT COLUMN (4 cols) ===================== */}
          <div className="lg:col-span-4 space-y-5">
            {/* 1. Cấu trúc đề thi TOEIC */}
            <div className="rounded border border-slate-200/90 bg-white p-5 shadow-xs">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                {t('structure.title')}
              </h3>

              {/* 2 Main Skill Boxes */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {/* Listening Box */}
                <div className="rounded border border-blue-100 bg-blue-50/30 p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100/70 text-blue-600 shrink-0">
                      <Headphones className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {t('structure.listening')}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {t('structure.questions_count')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="inline-block rounded-full bg-blue-100/80 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {t('structure.listening_duration')}
                    </span>
                  </div>
                </div>

                {/* Reading Box */}
                <div className="rounded border border-emerald-100 bg-emerald-50/30 p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100/70 text-emerald-600 shrink-0">
                      <BookOpen className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {t('structure.reading')}
                      </p>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {t('structure.questions_count')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="inline-block rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {t('structure.reading_duration')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Part Breakdown Lists */}
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
                {/* Listening Parts */}
                <div className="space-y-1.5">
                  <p>
                    <strong className="text-slate-800">Part 1:</strong> {t('structure.part1')}{' '}
                    <span className="text-slate-400">{t('structure.part1_count')}</span>
                  </p>
                  <p>
                    <strong className="text-slate-800">Part 2:</strong> {t('structure.part2')}{' '}
                    <span className="text-slate-400">{t('structure.part2_count')}</span>
                  </p>
                  <p>
                    <strong className="text-slate-800">Part 3:</strong> {t('structure.part3')}{' '}
                    <span className="text-slate-400">{t('structure.part3_count')}</span>
                  </p>
                  <p>
                    <strong className="text-slate-800">Part 4:</strong> {t('structure.part4')}{' '}
                    <span className="text-slate-400">{t('structure.part4_count')}</span>
                  </p>
                </div>

                {/* Reading Parts */}
                <div className="space-y-1.5">
                  <p>
                    <strong className="text-slate-800">Part 5:</strong> {t('structure.part5')}{' '}
                    <span className="text-slate-400">{t('structure.part5_count')}</span>
                  </p>
                  <p>
                    <strong className="text-slate-800">Part 6:</strong> {t('structure.part6')}{' '}
                    <span className="text-slate-400">{t('structure.part6_count')}</span>
                  </p>
                  <p>
                    <strong className="text-slate-800">Part 7:</strong> {t('structure.part7')}{' '}
                    <span className="text-slate-400">{t('structure.part7_count')}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Cách tính điểm TOEIC */}
            <div className="rounded border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {t('scoring.title')}
                </h3>
                <button
                  type="button"
                  onClick={() => setScoringModalOpen(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>{t('scoring.view_details')}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                {t('scoring.desc')}
              </p>

              {/* Listening & Reading Range Cards */}
              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                <div className="rounded border border-blue-100 bg-blue-50/20 p-2.5 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 shrink-0">
                    <Headphones className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 font-medium block truncate">
                      {t('scoring.listening_label')}
                    </span>
                    <span className="text-xs font-extrabold text-blue-600">
                      {t('scoring.range_val')}
                    </span>
                  </div>
                </div>

                <div className="rounded border border-emerald-100 bg-emerald-50/20 p-2.5 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 font-medium block truncate">
                      {t('scoring.reading_label')}
                    </span>
                    <span className="text-xs font-extrabold text-emerald-600">
                      {t('scoring.range_val')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mức điểm & Ý nghĩa Table */}
              <div className="mt-3.5 overflow-hidden rounded border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 text-[11px] whitespace-nowrap">{t('scoring.col_tier')}</th>
                      <th className="py-2 px-3 text-[11px]">{t('scoring.col_meaning')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr>
                      <td className="py-2 px-3 font-bold text-blue-600 whitespace-nowrap text-[11px]">450–600</td>
                      <td className="py-2 px-3 text-[11px] leading-snug">{t('scoring.tier_450_600')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-emerald-600 whitespace-nowrap text-[11px]">650–750</td>
                      <td className="py-2 px-3 text-[11px] leading-snug">{t('scoring.tier_650_750')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-purple-600 whitespace-nowrap text-[11px]">800–900</td>
                      <td className="py-2 px-3 text-[11px] leading-snug">{t('scoring.tier_800_900')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-rose-600 whitespace-nowrap text-[11px]">900+</td>
                      <td className="py-2 px-3 text-[11px] leading-snug">{t('scoring.tier_900_plus')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total Score Summary Box */}
              <div className="mt-3 rounded bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-blue-50/70 border border-blue-100/80 p-2.5 text-center">
                <p className="text-xs font-bold text-slate-800">
                  {t('scoring.total_calc')}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {t('scoring.scale')}
                </p>
              </div>
            </div>

            {/* 3. Mẹo thi TOEIC */}
            <div className="rounded border border-slate-200/90 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {t('tips.title')}
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTip(toeicTips[0] || null)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>{t('tips.view_all')}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {/* 5 Tips List */}
              <div className="mt-3 divide-y divide-slate-100">
                {toeicTips.map((tip) => {
                  const Icon = tip.icon;
                  return (
                    <div
                      key={tip.id}
                      onClick={() => setActiveTip(tip)}
                      className="group flex items-center justify-between py-2.5 px-2 rounded transition hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${tip.iconBg} ${tip.iconColor} shrink-0`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                            {tip.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {tip.subtitle}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== MODAL: Hướng dẫn thi TOEIC ===================== */}
      {guideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Info className="h-4.5 w-4.5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">{t('modals.guide.title')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setGuideModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs sm:text-sm text-slate-600 leading-relaxed">
              <div className="rounded bg-blue-50/60 border border-blue-100 p-3.5 space-y-1">
                <p className="font-bold text-blue-900">{t('modals.guide.ets_rule_title')}</p>
                <p className="text-xs text-blue-800">
                  {t('modals.guide.ets_rule_content')}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-sm">{t('modals.guide.sec1_title')}</h4>
                <ul className="mt-1.5 list-disc pl-5 space-y-1 text-xs text-slate-600">
                  <li>{t('modals.guide.sec1_item1')}</li>
                  <li>{t('modals.guide.sec1_item2')}</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-sm">{t('modals.guide.sec2_title')}</h4>
                <ul className="mt-1.5 list-disc pl-5 space-y-1 text-xs text-slate-600">
                  <li>{t('modals.guide.sec2_item1')}</li>
                  <li>{t('modals.guide.sec2_item2')}</li>
                  <li>{t('modals.guide.sec2_item3')}</li>
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setGuideModalOpen(false)}
                className="rounded bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
              >
                {t('modals.guide.btn_understand')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: Bảng quy đổi điểm TOEIC ===================== */}
      {scoringModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Award className="h-4.5 w-4.5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">{t('modals.scoring.title')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setScoringModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="rounded bg-blue-50/60 border border-blue-100 p-3.5 text-xs text-blue-900 leading-relaxed">
                {t('scoring.desc')}
              </div>

              {/* Mức điểm & Ý nghĩa */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2">{t('modals.scoring.sec1_title')}</h4>
                <div className="overflow-hidden rounded border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 whitespace-nowrap">{t('scoring.col_tier')}</th>
                        <th className="py-2.5 px-3">{t('scoring.col_proficiency')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr>
                        <td className="py-2 px-3 font-bold text-blue-600 whitespace-nowrap">450–600</td>
                        <td className="py-2 px-3">{t('scoring.tier_450_600')}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-emerald-600 whitespace-nowrap">650–750</td>
                        <td className="py-2 px-3">{t('scoring.tier_650_750')}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-purple-600 whitespace-nowrap">800–900</td>
                        <td className="py-2 px-3">{t('scoring.tier_800_900')}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-rose-600 whitespace-nowrap">900+</td>
                        <td className="py-2 px-3">{t('scoring.tier_900_plus')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Equating Table */}
              <div>
                <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2">{t('modals.scoring.sec2_title')}</h4>
                <div className="overflow-hidden rounded border border-slate-200">
                  <table className="w-full text-xs text-center">
                    <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">{t('modals.scoring.col_correct')}</th>
                        <th className="py-2.5 px-3 text-blue-600">{t('modals.scoring.col_listening')}</th>
                        <th className="py-2.5 px-3 text-emerald-600">{t('modals.scoring.col_reading')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      <tr><td className="py-2 px-3 font-semibold">96 - 100 {t('modals.scoring.questions_suffix')}</td><td className="py-2 px-3 text-blue-600 font-bold">495</td><td className="py-2 px-3 text-emerald-600 font-bold">485 - 495</td></tr>
                      <tr><td className="py-2 px-3 font-semibold">86 - 95 {t('modals.scoring.questions_suffix')}</td><td className="py-2 px-3 text-blue-600 font-bold">450 - 490</td><td className="py-2 px-3 text-emerald-600 font-bold">410 - 480</td></tr>
                      <tr><td className="py-2 px-3 font-semibold">76 - 85 {t('modals.scoring.questions_suffix')}</td><td className="py-2 px-3 text-blue-600 font-bold">395 - 445</td><td className="py-2 px-3 text-emerald-600 font-bold">345 - 405</td></tr>
                      <tr><td className="py-2 px-3 font-semibold">66 - 75 {t('modals.scoring.questions_suffix')}</td><td className="py-2 px-3 text-blue-600 font-bold">340 - 390</td><td className="py-2 px-3 text-emerald-600 font-bold">295 - 340</td></tr>
                      <tr><td className="py-2 px-3 font-semibold">51 - 65 {t('modals.scoring.questions_suffix')}</td><td className="py-2 px-3 text-blue-600 font-bold">260 - 335</td><td className="py-2 px-3 text-emerald-600 font-bold">220 - 290</td></tr>
                      <tr><td className="py-2 px-3 font-semibold">31 - 50 {t('modals.scoring.questions_suffix')}</td><td className="py-2 px-3 text-blue-600 font-bold">145 - 255</td><td className="py-2 px-3 text-emerald-600 font-bold">115 - 215</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setScoringModalOpen(false)}
                className="rounded bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
              >
                {t('modals.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: Chi tiết Mẹo thi TOEIC ===================== */}
      {activeTip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded bg-white shadow-2xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${activeTip.iconBg} ${activeTip.iconColor}`}>
                  <activeTip.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">{activeTip.title}</h3>
                  <p className="text-xs text-slate-400">{activeTip.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTip(null)}
                className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {activeTip.content.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <p className="leading-relaxed">{item}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 p-4 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTip(null)}
                className="rounded bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition cursor-pointer"
              >
                {t('modals.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

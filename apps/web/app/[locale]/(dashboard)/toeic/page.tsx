'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {StudyArtwork} from '@/components/study-artwork';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Headphones,
  BookOpen,
  BookMarked,
  Award,
  Target,
  Tag,
  BarChart3,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, PageHeader, PageShell, Panel, surface, tones, type Tone } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { toeicService } from '@/services/toeic.service';

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
  tone: Tone;
  examCount: number;
  attemptsCount?: string;
  filterKey?: string;
}

interface TipDetail {
  id: string;
  icon: typeof Target;
  tone: Tone;
  title: string;
  subtitle: string;
  content: string[];
}

const GROUP_PALETTE: { icon: typeof Headphones; tone: Tone }[] = [
  { icon: Headphones, tone: 'blue' },
  { icon: BookOpen, tone: 'emerald' },
  { icon: BookMarked, tone: 'violet' },
  { icon: Award, tone: 'amber' },
  { icon: Tag, tone: 'pink' },
  { icon: Target, tone: 'red' },
  { icon: BarChart3, tone: 'blue' },
  { icon: Lightbulb, tone: 'orange' },
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
        tone: 'blue',
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
        tone: 'emerald',
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
        tone: 'violet',
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
        tone: 'amber',
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
        tone: 'pink',
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
        tone: 'red',
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
          tone: palette.tone,
          examCount: g.examCount ?? 0,
          attemptsCount: Number(g.totalAttempts ?? 0).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN'),
        };
      });
    }
    return presetGroups;
  }, [apiGroupsList, presetGroups, t, locale]);

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
        tone: 'pink',
        title: t('tips.part_strategy.title'),
        subtitle: t('tips.part_strategy.subtitle'),
        content: Array.isArray(partStrategyItems) ? partStrategyItems : [],
      },
      {
        id: 'common-mistakes',
        icon: Lightbulb,
        tone: 'amber',
        title: t('tips.common_mistakes.title'),
        subtitle: t('tips.common_mistakes.subtitle'),
        content: Array.isArray(commonMistakesItems) ? commonMistakesItems : [],
      },
      {
        id: 'time-management',
        icon: Clock,
        tone: 'blue',
        title: t('tips.time_management.title'),
        subtitle: t('tips.time_management.subtitle'),
        content: Array.isArray(timeManagementItems) ? timeManagementItems : [],
      },
      {
        id: 'vocabulary-grammar',
        icon: FileText,
        tone: 'blue',
        title: t('tips.vocabulary_grammar.title'),
        subtitle: t('tips.vocabulary_grammar.subtitle'),
        content: Array.isArray(vocabGrammarItems) ? vocabGrammarItems : [],
      },
      {
        id: 'high-score-tips',
        icon: BarChart3,
        tone: 'violet',
        title: t('tips.high_score_tips.title'),
        subtitle: t('tips.high_score_tips.subtitle'),
        content: Array.isArray(highScoreItems) ? highScoreItems : [],
      },
    ];
  }, [t]);

  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 sm:p-8">
        <div className="relative z-10 max-w-xl">
          <PageHeader
            eyebrow={t('banner.tag')}
            title={`${t('banner.title_part1')} ${t('banner.title_part2')}`}
            description={t('banner.desc')}
          />
          <div className="mt-5">
            <Button type="button" onClick={() => setGuideModalOpen(true)}>
              <Play className="fill-current" />
              {t('banner.btn_guide')}
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[40%] overflow-hidden md:block">
          <div className="absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-white to-transparent" />
          <StudyArtwork kind="exam" className="h-full w-full object-cover opacity-90" />
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Groups */}
        <div className="space-y-4 lg:col-span-8">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t('groups.title')}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{t('groups.desc')}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {displayGroups.map((group) => {
              const Icon = group.icon;
              return (
                <Link
                  key={group.id}
                  href={`/${locale}/toeic/${group.slug}`}
                  className={cn(
                    surface,
                    'group flex flex-col justify-between p-5 transition-all hover:border-blue-300 hover:shadow-md',
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', tones[group.tone])}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <Badge>{t('groups.exam_count', { count: group.examCount })}</Badge>
                    </div>
                    <h3 className="mt-4 line-clamp-1 text-sm font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
                      {group.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{group.description}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Package className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {group.attemptsCount
                          ? t('groups.attempts_count', { count: group.attemptsCount })
                          : `${group.examCount} ${t('modals.group_exams.questions')}`}
                      </span>
                    </div>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:col-span-4">
          {/* Structure */}
          <Panel title={t('structure.title')} className="sm:p-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Headphones, tone: 'blue' as const, label: t('structure.listening'), duration: t('structure.listening_duration') },
                { icon: BookOpen, tone: 'emerald' as const, label: t('structure.reading'), duration: t('structure.reading_duration') },
              ].map((skill) => (
                <div key={skill.label} className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[skill.tone])}>
                      <skill.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight text-slate-900">{skill.label}</p>
                      <span className="text-[11px] text-slate-500">{t('structure.questions_count')}</span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Badge tone={skill.tone}>{skill.duration}</Badge>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <div className="space-y-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <p key={n}>
                    <strong className="font-semibold text-slate-800">Part {n}:</strong> {t(`structure.part${n}`)}{' '}
                    <span className="text-slate-400">{t(`structure.part${n}_count`)}</span>
                  </p>
                ))}
              </div>
              <div className="space-y-1.5">
                {[5, 6, 7].map((n) => (
                  <p key={n}>
                    <strong className="font-semibold text-slate-800">Part {n}:</strong> {t(`structure.part${n}`)}{' '}
                    <span className="text-slate-400">{t(`structure.part${n}_count`)}</span>
                  </p>
                ))}
              </div>
            </div>
          </Panel>

          {/* Scoring */}
          <Panel
            title={t('scoring.title')}
            className="sm:p-5"
            action={
              <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setScoringModalOpen(true)}>
                {t('scoring.view_details')}
                <ArrowRight />
              </Button>
            }
          >
            <p className="text-xs leading-relaxed text-slate-500">{t('scoring.desc')}</p>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {[
                { icon: Headphones, tone: 'blue' as const, label: t('scoring.listening_label'), color: 'text-blue-600' },
                { icon: BookOpen, tone: 'emerald' as const, label: t('scoring.reading_label'), color: 'text-emerald-600' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tones[item.tone])}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate text-[11px] text-slate-500">{item.label}</span>
                    <span className={cn('text-xs font-bold', item.color)}>{t('scoring.range_val')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2">{t('scoring.col_tier')}</th>
                    <th className="px-3 py-2">{t('scoring.col_meaning')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {SCORE_TIERS.map((tier) => (
                    <tr key={tier.range}>
                      <td className={cn('whitespace-nowrap px-3 py-2 font-semibold', tier.color)}>{tier.range}</td>
                      <td className="px-3 py-2 leading-snug">{t(tier.key)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-2.5 text-center">
              <p className="text-xs font-semibold text-slate-800">{t('scoring.total_calc')}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{t('scoring.scale')}</p>
            </div>
          </Panel>

          {/* Tips */}
          <Panel
            title={t('tips.title')}
            className="sm:p-5"
            action={
              <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setActiveTip(toeicTips[0] || null)}>
                {t('tips.view_all')}
                <ArrowRight />
              </Button>
            }
          >
            <div className="-mx-2 divide-y divide-slate-100">
              {toeicTips.map((tip) => {
                const Icon = tip.icon;
                return (
                  <button
                    key={tip.id}
                    type="button"
                    onClick={() => setActiveTip(tip)}
                    className="group flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-3 pr-2">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tip.tone])}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800 transition-colors group-hover:text-blue-600">
                          {tip.title}
                        </p>
                        <p className="truncate text-xs text-slate-500">{tip.subtitle}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-600" />
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {/* Guide modal */}
      {guideModalOpen && (
        <HubDialog
          icon={Info}
          tone="blue"
          title={t('modals.guide.title')}
          onClose={() => setGuideModalOpen(false)}
          footerLabel={t('modals.guide.btn_understand')}
        >
          <div className="space-y-4 text-sm leading-relaxed text-slate-600">
            <div className="space-y-1 rounded-lg border border-blue-100 bg-blue-50 p-3.5">
              <p className="font-semibold text-blue-900">{t('modals.guide.ets_rule_title')}</p>
              <p className="text-xs text-blue-800">{t('modals.guide.ets_rule_content')}</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">{t('modals.guide.sec1_title')}</h4>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>{t('modals.guide.sec1_item1')}</li>
                <li>{t('modals.guide.sec1_item2')}</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">{t('modals.guide.sec2_title')}</h4>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>{t('modals.guide.sec2_item1')}</li>
                <li>{t('modals.guide.sec2_item2')}</li>
                <li>{t('modals.guide.sec2_item3')}</li>
              </ul>
            </div>
          </div>
        </HubDialog>
      )}

      {/* Scoring modal */}
      {scoringModalOpen && (
        <HubDialog
          icon={Award}
          tone="emerald"
          title={t('modals.scoring.title')}
          onClose={() => setScoringModalOpen(false)}
          footerLabel={t('modals.close')}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3.5 text-xs leading-relaxed text-blue-900">
              {t('scoring.desc')}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">{t('modals.scoring.sec1_title')}</h4>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2.5">{t('scoring.col_tier')}</th>
                      <th className="px-3 py-2.5">{t('scoring.col_proficiency')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {SCORE_TIERS.map((tier) => (
                      <tr key={tier.range}>
                        <td className={cn('whitespace-nowrap px-3 py-2 font-semibold', tier.color)}>{tier.range}</td>
                        <td className="px-3 py-2">{t(tier.key)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">{t('modals.scoring.sec2_title')}</h4>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-center text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <tr>
                      <th className="px-3 py-2.5">{t('modals.scoring.col_correct')}</th>
                      <th className="px-3 py-2.5 text-blue-600">{t('modals.scoring.col_listening')}</th>
                      <th className="px-3 py-2.5 text-emerald-600">{t('modals.scoring.col_reading')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {EQUATING_ROWS.map(([correct, listening, reading]) => (
                      <tr key={correct}>
                        <td className="px-3 py-2 font-medium">
                          {correct} {t('modals.scoring.questions_suffix')}
                        </td>
                        <td className="px-3 py-2 font-semibold text-blue-600">{listening}</td>
                        <td className="px-3 py-2 font-semibold text-emerald-600">{reading}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </HubDialog>
      )}

      {/* Tip modal */}
      {activeTip && (
        <HubDialog
          icon={activeTip.icon}
          tone={activeTip.tone}
          title={activeTip.title}
          subtitle={activeTip.subtitle}
          onClose={() => setActiveTip(null)}
          footerLabel={t('modals.close')}
          size="max-w-lg"
        >
          <div className="space-y-3">
            {activeTip.content.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <p className="leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </HubDialog>
      )}
    </PageShell>
  );
}

const SCORE_TIERS = [
  { range: '450–600', key: 'scoring.tier_450_600', color: 'text-blue-600' },
  { range: '650–750', key: 'scoring.tier_650_750', color: 'text-emerald-600' },
  { range: '800–900', key: 'scoring.tier_800_900', color: 'text-violet-600' },
  { range: '900+', key: 'scoring.tier_900_plus', color: 'text-pink-600' },
];

const EQUATING_ROWS: [string, string, string][] = [
  ['96 - 100', '495', '485 - 495'],
  ['86 - 95', '450 - 490', '410 - 480'],
  ['76 - 85', '395 - 445', '345 - 405'],
  ['66 - 75', '340 - 390', '295 - 340'],
  ['51 - 65', '260 - 335', '220 - 290'],
  ['31 - 50', '145 - 255', '115 - 215'],
];

function HubDialog({
  icon: Icon,
  tone,
  title,
  subtitle,
  onClose,
  footerLabel,
  size = 'max-w-xl',
  children,
}: {
  icon: typeof Info;
  tone: Tone;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footerLabel: string;
  size?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className={cn('flex max-h-[calc(100dvh-2rem)] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl', size)}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-4">
          <Button type="button" onClick={onClose}>
            {footerLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

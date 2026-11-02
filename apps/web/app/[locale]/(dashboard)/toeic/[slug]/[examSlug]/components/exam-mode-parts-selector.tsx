'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Headphones, Info, Loader2, PauseCircle, PlayCircle, type LucideIcon } from 'lucide-react';
import { ToeicExamPart } from '@/services/toeic.service';
import { Button } from '@/components/ui/button';
import { surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';

type Mode = 'TEST' | 'PRACTICE';

function ModeOption({
  active,
  label,
  description,
  onSelect,
}: {
  active: boolean;
  label: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-500/60',
        active
          ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          active ? 'border-blue-600' : 'border-slate-300',
        )}
      >
        {active && <span className="size-1.5 rounded-full bg-blue-600" />}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-sm font-semibold', active ? 'text-blue-700' : 'text-slate-800')}>
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function PartGroup({
  label,
  icon: Icon,
  tone,
  parts,
  selected,
  togglePart,
}: {
  label: string;
  icon: LucideIcon;
  tone: string;
  parts: ToeicExamPart[];
  selected: Set<string>;
  togglePart: (id: string) => void;
}) {
  if (!parts.length) return null;
  return (
    <fieldset>
      <legend className={cn('mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider', tone)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </legend>
      <div className="space-y-0.5">
        {parts.map((p) => {
          const checked = selected.has(p._id);
          return (
            <label
              key={p._id}
              className={cn(
                'flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-slate-50',
                checked && 'bg-slate-50',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => togglePart(p._id)}
                className="size-4 shrink-0 cursor-pointer rounded accent-blue-600"
              />
              <span className="w-12 shrink-0 font-medium text-slate-800">Part {p.part}</span>
              <span className="min-w-0 flex-1 truncate text-slate-500">{p.type}</span>
              <span className="shrink-0 text-xs font-medium text-slate-500 tabular-nums">{p.totalQuestions}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

interface ExamModePartsSelectorProps {
  starting?: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
  selected: Set<string>;
  togglePart: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  listeningParts: ToeicExamPart[];
  readingParts: ToeicExamPart[];
  selectedCount: number;
  selectedQuestions: number;
  selectedMinutes: number;
  isInProgress: boolean;
  onStart: () => void;
  onContinue: () => void;
}

export function ExamModePartsSelector({
  starting = false,
  mode,
  setMode,
  selected,
  togglePart,
  selectAll,
  deselectAll,
  listeningParts,
  readingParts,
  selectedCount,
  selectedQuestions,
  selectedMinutes,
  isInProgress,
  onStart,
  onContinue,
}: ExamModePartsSelectorProps) {
  const { t } = useTranslation('toeic');
  const allSelected = selectedCount === listeningParts.length + readingParts.length;

  return (
    <section aria-labelledby="exam-start-title" className={cn(surface, 'divide-y divide-slate-100')}>
      <div className="p-5">
        <h2 id="exam-start-title" className="text-base font-semibold text-slate-900">
          {t('exam_detail.mode_title')}
        </h2>
        <div role="radiogroup" aria-labelledby="exam-start-title" className="mt-3 grid grid-cols-2 gap-2">
          <ModeOption
            active={mode === 'TEST'}
            label={t('exam_detail.mode_exam_label')}
            description={t('exam_detail.mode_exam_desc')}
            onSelect={() => setMode('TEST')}
          />
          <ModeOption
            active={mode === 'PRACTICE'}
            label={t('exam_detail.mode_practice_label')}
            description={t('exam_detail.mode_practice_desc')}
            onSelect={() => setMode('PRACTICE')}
          />
        </div>
      </div>

      <div className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{t('exam_detail.parts_title')}</h3>
          <button
            type="button"
            onClick={allSelected ? deselectAll : selectAll}
            className="cursor-pointer rounded text-xs font-semibold text-blue-600 outline-none hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/60"
          >
            {t(allSelected ? 'exam_detail.deselect' : 'exam_detail.select_all')}
          </button>
        </div>
        <div className="space-y-4">
          <PartGroup
            label="Listening"
            icon={Headphones}
            tone="text-blue-600"
            parts={listeningParts}
            selected={selected}
            togglePart={togglePart}
          />
          <PartGroup
            label="Reading"
            icon={BookOpen}
            tone="text-emerald-600"
            parts={readingParts}
            selected={selected}
            togglePart={togglePart}
          />
        </div>
      </div>

      <div className="space-y-3 p-5">
        <p className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {t('exam_detail.summary', { parts: selectedCount, questions: selectedQuestions })}
          </span>
          {selectedMinutes > 0 && (
            <span className="font-medium text-slate-700 tabular-nums">
              ~{selectedMinutes} {t('exam_detail.minutes')}
            </span>
          )}
        </p>
        {isInProgress && (
          <Button id="btn-continue-exam" type="button" variant="secondary" size="lg" onClick={onContinue} className="w-full">
            <PlayCircle />
            {t('exam_detail.btn_continue_attempt')}
          </Button>
        )}
        <Button
          id="btn-start-exam"
          type="button"
          size="lg"
          disabled={selectedCount === 0 || starting}
          onClick={onStart}
          className="h-11 w-full"
        >
          {starting ? <Loader2 className="animate-spin" /> : <PlayCircle />}
          {t(starting ? 'attempt.starting' : 'exam_detail.btn_start')}
        </Button>
        <div className="space-y-1.5 pt-1 text-xs leading-relaxed text-slate-500">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('attempt.mode_hint')}
          </p>
          <p className="flex items-start gap-2">
            <PauseCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('attempt.resume_hint')}
          </p>
        </div>
      </div>
    </section>
  );
}

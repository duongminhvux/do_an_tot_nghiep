'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { examService } from '@/services/assessment.service';
import { CreateExamDto, ExamMode, ExamSection, ExamType } from '@/types';
import {
  FileText,
  Settings,
  Headphones,
  Eye,
  Info,
  AlertTriangle,
  Clock,
  Bell,
  ListOrdered,
  Save,
  Loader2,
  CheckSquare,
  BookOpen,
  Volume2,
} from 'lucide-react';

export default function CreateExamPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<ExamType>('TOEIC');
  const [mode, setMode] = useState<ExamMode>('PRACTICE');
  const [section, setSection] = useState<ExamSection>('LISTENING');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [order, setOrder] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Toggle mode & auto-adjust defaults
  const handleModeChange = (newMode: ExamMode) => {
    setMode(newMode);
    if (newMode === 'PRACTICE') {
      const activeSection = section === 'READING' ? 'READING' : 'LISTENING';
      setSection(activeSection);
      setDurationMinutes(activeSection === 'READING' ? 75 : 45);
    } else {
      setSection('FULL_TEST');
      setDurationMinutes(120);
    }
  };

  const handleSectionChange = (newSection: ExamSection) => {
    setSection(newSection);
    if (newSection === 'READING') {
      setDurationMinutes(75);
    } else if (newSection === 'LISTENING') {
      setDurationMinutes(45);
    }
  };

  // Mutation to create exam in database
  const createMutation = useMutation({
    mutationFn: async (dto: CreateExamDto) => {
      const res = await examService.create(dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      router.push(`/${locale}/assessment`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi tạo đề thi';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const handleSubmit = (asDraft: boolean = false) => {
    setErrorMessage(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(t('createPage.nameRequired'));
      return;
    }

    const activeState = asDraft ? false : isActive;
    const finalSection: ExamSection = mode === 'FULL_TEST' ? 'FULL_TEST' : section;
    const totalQ = mode === 'FULL_TEST' ? 200 : 100;

    createMutation.mutate({
      name: trimmedName,
      type,
      mode,
      section: finalSection,
      description: description.trim(),
      durationMinutes: Number(durationMinutes) || 0,
      totalQuestions: totalQ,
      isActive: activeState,
      status: activeState ? 'ACTIVE' : 'INACTIVE',
      order: Number(order) || 1,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6 w-full">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {t('createPage.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('createPage.subtitle')}
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Left Form (7 cols) + Right Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column - Main Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Thông tin cơ bản */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {t('createPage.basicInfo')}
              </h2>
            </div>

            {/* Field: Tên đề */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                {t('createPage.nameLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('createPage.namePlaceholder')}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span>{t('createPage.nameHint')}</span>
                <span>{name.length}/100</span>
              </div>
            </div>

            {/* Field: Loại kỳ thi */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                {t('createPage.typeLabel')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ExamType)}
                  className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="TOEIC">TOEIC</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 px-0.5">
                {t('createPage.typeHint')}
              </p>
            </div>

            {/* Field: Chế độ */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                {t('createPage.modeLabel')} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option: PRACTICE */}
                <div
                  onClick={() => handleModeChange('PRACTICE')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                    mode === 'PRACTICE'
                      ? 'border-blue-500 bg-blue-50/20 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      mode === 'PRACTICE'
                        ? 'border-blue-600'
                        : 'border-slate-300'
                    }`}
                  >
                    {mode === 'PRACTICE' && (
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 tracking-wide">
                      {t('createPage.practiceTitle')}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug whitespace-pre-line">
                      {t('createPage.practiceDesc')}
                    </div>
                  </div>
                </div>

                {/* Option: FULL_TEST */}
                <div
                  onClick={() => handleModeChange('FULL_TEST')}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                    mode === 'FULL_TEST'
                      ? 'border-blue-500 bg-blue-50/20 ring-1 ring-blue-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      mode === 'FULL_TEST'
                        ? 'border-blue-600'
                        : 'border-slate-300'
                    }`}
                  >
                    {mode === 'FULL_TEST' && (
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 tracking-wide">
                      {t('createPage.fullTestTitle')}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug whitespace-pre-line">
                      {t('createPage.fullTestDesc')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Field: Kỹ năng luyện tập (Chỉ hiển thị khi chọn PRACTICE) */}
            {mode === 'PRACTICE' && (
              <div className="space-y-2.5 p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 transition-all">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>{t('createPage.sectionLabel')}</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">{t('createPage.sectionHint')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Listening Option */}
                  <div
                    onClick={() => handleSectionChange('LISTENING')}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      section === 'LISTENING'
                        ? 'border-blue-500 bg-white ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        section === 'LISTENING' ? 'border-blue-600' : 'border-slate-300'
                      }`}
                    >
                      {section === 'LISTENING' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Headphones className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900">
                        {t('createPage.sectionListening')}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {t('createPage.sectionListeningDesc')}
                      </div>
                    </div>
                  </div>

                  {/* Reading Option */}
                  <div
                    onClick={() => handleSectionChange('READING')}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                      section === 'READING'
                        ? 'border-emerald-500 bg-white ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        section === 'READING' ? 'border-emerald-600' : 'border-slate-300'
                      }`}
                    >
                      {section === 'READING' && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900">
                        {t('createPage.sectionReading')}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {t('createPage.sectionReadingDesc')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Field: Mô tả */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800">
                {t('createPage.descriptionLabel')}
              </label>
              <textarea
                rows={3}
                value={description}
                maxLength={500}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('createPage.descriptionPlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span>{t('createPage.descriptionHint')}</span>
                <span>{description.length}/500</span>
              </div>
            </div>
          </div>

          {/* Card 2: Cấu hình đề thi */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Settings className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {t('createPage.configTitle')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Thời gian làm bài */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                  {t('createPage.durationLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t('createPage.durationHint')}
                </p>
              </div>

              {/* Trạng thái hoạt động */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800">
                  {t('createPage.statusLabel')}
                </label>
                <div className="flex items-center gap-3 h-10">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <span className="text-xs font-medium text-slate-700">
                    {isActive ? t('createPage.statusActive') : t('createPage.statusInactive')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t('createPage.statusHint')}
                </p>
              </div>

              {/* Thứ tự hiển thị */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                  {t('createPage.orderLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 leading-snug">
                  {t('createPage.orderHint')}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href={`/${locale}/assessment`}
              className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {t('createPage.cancel')}
            </Link>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={createMutation.isPending}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-4 w-4 text-blue-600" />
              <span>{t('createPage.saveDraft')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={createMutation.isPending}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('createPage.creating')}</span>
                </>
              ) : (
                <span>{t('createPage.createBtn')}</span>
              )}
            </button>
          </div>
        </div>

        {/* Right Column - Live Preview & Guide */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Tóm tắt đề thi (Live Preview) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <Eye className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">{t('createPage.previewTitle')}</h3>
                <p className="text-xs text-slate-500">{t('createPage.previewSubtitle')}</p>
              </div>
            </div>

            {/* Preview Box */}
            <div className="p-4 rounded-xl border border-slate-200/70 bg-[#f8fafc] space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="font-bold text-sm text-slate-900 truncate">
                    {name.trim() || t('createPage.previewEmptyName')}
                  </div>
                  <div className="mt-1.5">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                      {type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Specs List */}
              <div className="space-y-3 pt-3 border-t border-slate-200/70 text-xs">
                {/* Chế độ */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-2">
                    <Headphones className="h-4 w-4 text-slate-400" />
                    {t('table.mode')}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                      mode === 'PRACTICE'
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-blue-50 text-blue-600 border border-blue-200'
                    }`}
                  >
                    {mode}
                  </span>
                </div>

                {/* Kỹ năng (Practice Section) */}
                {mode === 'PRACTICE' && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-slate-400" />
                      {t('createPage.sectionLabel')}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        section === 'LISTENING'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {section === 'LISTENING' ? 'Listening (Part 1–4)' : 'Reading (Part 5–7)'}
                    </span>
                  </div>
                )}

                {/* Thời gian làm bài */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    {t('table.duration')}
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {durationMinutes} {t('table.minutes')}
                  </span>
                </div>

                {/* Trạng thái */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-slate-400" />
                    {t('table.status')}
                  </span>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      <span>{t('status.active')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                      <span>{t('status.inactive')}</span>
                    </span>
                  )}
                </div>

                {/* Thứ tự hiển thị */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-2">
                    <ListOrdered className="h-4 w-4 text-slate-400" />
                    {t('createPage.orderLabel')}
                  </span>
                  <span className="font-bold text-slate-900 text-xs">{order}</span>
                </div>
              </div>
            </div>

            {/* Info Box: Cấu trúc đề thi theo chế độ */}
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-bold">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <span>{t('createPage.structureTitle')}</span>
              </div>
              <ul className="text-slate-600 text-[11px] space-y-1 pl-6 list-disc leading-relaxed">
                <li>{t('createPage.structurePracticeListening')}</li>
                <li>{t('createPage.structurePracticeReading')}</li>
                <li>{t('createPage.structureFullTest')}</li>
              </ul>
            </div>
          </div>

          {/* Card 2: Bước tiếp theo */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <CheckSquare className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">{t('createPage.nextStepsTitle')}</h3>
                <p className="text-xs text-slate-500">{t('createPage.nextStepsSubtitle')}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <div className="font-bold text-slate-900">{t('createPage.step1Title')}</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{t('createPage.step1Desc')}</div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <div className="font-bold text-slate-800">{t('createPage.step2Title')}</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{t('createPage.step2Desc')}</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <div className="font-bold text-slate-800">{t('createPage.step3Title')}</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{t('createPage.step3Desc')}</div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  4
                </div>
                <div>
                  <div className="font-bold text-slate-800">{t('createPage.step4Title')}</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">{t('createPage.step4Desc')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

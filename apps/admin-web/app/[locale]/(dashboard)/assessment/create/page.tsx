'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { examService, examGroupService } from '@/services/assessment.service';
import { CreateExamDto, ExamType, ExamGroupItem } from '@/types';
import {
  FileText,
  Settings,
  Eye,
  Info,
  AlertTriangle,
  AlertCircle,
  Clock,
  Bell,
  ListOrdered,
  Save,
  Loader2,
  CheckSquare,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FormErrors {
  name?: string;
  durationMinutes?: string;
  order?: string;
  type?: string;
}

export default function CreateExamPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const { t } = useTranslation('assessment');
  const queryClient = useQueryClient();

  const searchParams = useSearchParams();
  const initialGroupId = searchParams.get('groupId') || '';
  const [groupId, setGroupId] = useState<string>(initialGroupId);

  // Form states
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [type, setType] = useState<ExamType>('TOEIC');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | string>(120);
  const [order, setOrder] = useState<number | string>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validation states
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Query groups for selection
  const { data: groupsResponse } = useQuery({
    queryKey: ['admin-exam-groups-select'],
    queryFn: async () => {
      const res = await examGroupService.getAll({ limit: 100, isActive: true });
      return res?.data;
    },
  });
  const groups: ExamGroupItem[] = groupsResponse?.data || [];

  // Mutation to create exam in database
  const createMutation = useMutation({
    mutationFn: async (dto: CreateExamDto) => {
      const res = await examService.create(dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-groups'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exam-group-exams'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-unassigned'] });
      if (initialGroupId) {
        queryClient.invalidateQueries({ queryKey: ['admin-exam-group', initialGroupId] });
        queryClient.invalidateQueries({ queryKey: ['admin-exam-group-exams', initialGroupId] });
        router.push(`/${locale}/assessment/groups/${initialGroupId}`);
      } else if (groupId) {
        queryClient.invalidateQueries({ queryKey: ['admin-exam-group', groupId] });
        queryClient.invalidateQueries({ queryKey: ['admin-exam-group-exams', groupId] });
        router.push(`/${locale}/assessment`);
      } else {
        router.push(`/${locale}/assessment`);
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi tạo đề thi';
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
          document.getElementById('exam-create-error-alert')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
    },
  });

  const validateForm = (
    currentName: string,
    currentDuration: string | number,
    currentOrder: string | number,
    currentType: string
  ): FormErrors => {
    const errs: FormErrors = {};

    const trimmedName = currentName.trim();
    if (!trimmedName) {
      errs.name = t('createPage.nameRequired');
    } else if (trimmedName.length < 3) {
      errs.name = t('createPage.nameMinLength');
    }

    if (currentDuration === '' || currentDuration === undefined || currentDuration === null) {
      errs.durationMinutes = t('createPage.durationRequired');
    } else {
      const durNum = Number(currentDuration);
      if (isNaN(durNum) || durNum < 1 || durNum > 300) {
        errs.durationMinutes = t('createPage.durationMinMax');
      }
    }

    if (currentOrder === '' || currentOrder === undefined || currentOrder === null) {
      errs.order = t('createPage.orderRequired');
    } else {
      const ordNum = Number(currentOrder);
      if (isNaN(ordNum) || ordNum < 0) {
        errs.order = t('createPage.orderMin');
      }
    }

    if (!currentType) {
      errs.type = t('createPage.typeRequired');
    }

    return errs;
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const formErrors = validateForm(name, durationMinutes, order, type);
    setErrors(formErrors);
  };

  const handleSubmit = (asDraft: boolean = false) => {
    setErrorMessage(null);
    const formErrors = validateForm(name, durationMinutes, order, type);
    setErrors(formErrors);
    setTouched({
      name: true,
      durationMinutes: true,
      order: true,
      type: true,
    });

    if (Object.keys(formErrors).length > 0) {
      setErrorMessage(t('createPage.validationErrorsTitle'));
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
          document.getElementById('exam-create-error-alert')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
      return;
    }

    const trimmedName = name.trim();
    const activeState = asDraft ? false : isActive;

    createMutation.mutate({
      name: trimmedName,
      type,
      description: description.trim(),
      durationMinutes: Number(durationMinutes) || 120,
      totalQuestions: 200,
      isActive: activeState,
      order: Number(order) || 0,
      groupId: groupId ? groupId : undefined,
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
        <div
          id="exam-create-error-alert"
          tabIndex={-1}
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 space-y-2 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2 font-bold text-red-800 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
          {Object.values(errors).length > 0 && (
            <ul className="list-disc pl-6 space-y-1 text-red-600 text-xs font-medium">
              {Object.entries(errors).map(([key, err]) => (
                <li key={key}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Main Grid: Left Form (7 cols) + Right Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column - Main Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Thông tin cơ bản */}
          <div className="bg-white rounded border border-slate-200/80 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {t('createPage.basicInfo')}
              </h2>
            </div>

            {/* Field: Tên đề */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  {t('createPage.nameLabel')} <span className="text-red-500">*</span>
                </span>
                {(touched.name || errors.name) && errors.name && (
                  <span className="text-[11px] font-medium text-red-500">{errors.name}</span>
                )}
              </label>
              <input
                type="text"
                value={name}
                maxLength={100}
                onBlur={() => handleBlur('name')}
                onChange={(e) => {
                  const val = e.target.value;
                  setName(val);
                  if (touched.name || errors.name) {
                    const errs = validateForm(val, durationMinutes, order, type);
                    setErrors((prev) => ({ ...prev, name: errs.name }));
                  }
                }}
                placeholder={t('createPage.namePlaceholder')}
                className={`w-full h-11 px-3.5 rounded border text-sm placeholder:text-slate-400 focus:outline-none transition-all ${
                  (touched.name || errors.name) && errors.name
                    ? 'border-red-500 bg-red-50/20 focus:ring-1 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-slate-200 bg-white focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500'
                }`}
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                {(touched.name || errors.name) && errors.name ? (
                  <span className="text-red-500 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 inline shrink-0" /> {errors.name}
                  </span>
                ) : (
                  <span>{t('createPage.nameHint')}</span>
                )}
                <span>{name.length}/100</span>
              </div>
            </div>

            {/* Field: Nhóm đề thi (Exam Group) (Tùy chọn) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                <span>{t('examGroups.groupSelectLabel')}</span>
                <span className="text-[11px] font-normal text-slate-400">{locale === 'en' ? 'Optional' : 'Tùy chọn'}</span>
              </label>
              <Select value={groupId || 'none'} onValueChange={(val) => setGroupId(val === 'none' ? '' : val)}>
                <SelectTrigger className="w-full h-10 px-3.5 rounded border border-slate-200 bg-white text-xs text-slate-800">
                  <SelectValue placeholder={t('examGroups.groupSelectPlaceholder')} />
                </SelectTrigger>
                <SelectContent className="bg-white border border-slate-200 rounded text-xs shadow-md">
                  <SelectItem value="none">{t('examGroups.groupSelectPlaceholder')}</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g._id} value={g._id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field: Loại kỳ thi */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                {t('createPage.typeLabel')} <span className="text-red-500">*</span>
              </label>
              <Select
                value={type}
                onValueChange={(val) => {
                  setType(val as ExamType);
                  if (touched.type || errors.type) {
                    const errs = validateForm(name, durationMinutes, order, val);
                    setErrors((prev) => ({ ...prev, type: errs.type }));
                  }
                }}
              >
                <SelectTrigger
                  className={`w-full h-10 px-3.5 rounded border bg-white text-xs text-slate-800 ${
                    (touched.type || errors.type) && errors.type
                      ? 'border-red-500 focus:ring-red-500/20'
                      : 'border-slate-200'
                  }`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-slate-200 rounded text-xs shadow-md">
                  <SelectItem value="TOEIC">TOEIC</SelectItem>
                </SelectContent>
              </Select>
              {(touched.type || errors.type) && errors.type ? (
                <p className="text-[11px] text-red-500 font-medium flex items-center gap-1 px-0.5">
                  <AlertCircle className="h-3 w-3 inline shrink-0" /> {errors.type}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 px-0.5">
                  {t('createPage.typeHint')}
                </p>
              )}
            </div>

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
                className="w-full px-3.5 py-2.5 rounded border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                <span>{t('createPage.descriptionHint')}</span>
                <span>{description.length}/500</span>
              </div>
            </div>
          </div>

          {/* Card 2: Cấu hình đề thi */}
          <div className="bg-white rounded border border-slate-200/80 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-sm">
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
                  onBlur={() => handleBlur('durationMinutes')}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDurationMinutes(val);
                    if (touched.durationMinutes || errors.durationMinutes) {
                      const errs = validateForm(name, val, order, type);
                      setErrors((prev) => ({ ...prev, durationMinutes: errs.durationMinutes }));
                    }
                  }}
                  className={`w-full h-10 px-3 rounded border text-sm focus:outline-none transition-all ${
                    (touched.durationMinutes || errors.durationMinutes) && errors.durationMinutes
                      ? 'border-red-500 bg-red-50/20 focus:ring-1 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-slate-200 bg-white focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
                {(touched.durationMinutes || errors.durationMinutes) && errors.durationMinutes ? (
                  <p className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 inline shrink-0" /> {errors.durationMinutes}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {t('createPage.durationHint')}
                  </p>
                )}
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
                  min={0}
                  value={order}
                  onBlur={() => handleBlur('order')}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOrder(val);
                    if (touched.order || errors.order) {
                      const errs = validateForm(name, durationMinutes, val, type);
                      setErrors((prev) => ({ ...prev, order: errs.order }));
                    }
                  }}
                  className={`w-full h-10 px-3 rounded border text-sm focus:outline-none transition-all ${
                    (touched.order || errors.order) && errors.order
                      ? 'border-red-500 bg-red-50/20 focus:ring-1 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-slate-200 bg-white focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
                {(touched.order || errors.order) && errors.order ? (
                  <p className="text-[11px] text-red-500 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 inline shrink-0" /> {errors.order}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {t('createPage.orderHint')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href={`/${locale}/assessment`}
              className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            >
              {t('createPage.cancel')}
            </Link>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={createMutation.isPending}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold rounded inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="h-4 w-4 text-blue-600" />
              <span>{t('createPage.saveDraft')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={createMutation.isPending}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded inline-flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow disabled:opacity-50"
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
          <div className="bg-white rounded border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <Eye className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">{t('createPage.previewTitle')}</h3>
                <p className="text-xs text-slate-500">{t('createPage.previewSubtitle')}</p>
              </div>
            </div>

            {/* Preview Box */}
            <div className="p-4 rounded border border-slate-200/70 bg-[#f8fafc] space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
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
                {/* Cấu trúc bài thi */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-slate-400" />
                    {t('table.totalQuestions')}
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    200 {t('questions.title', { defaultValue: 'câu hỏi' })} (Part 1–7)
                  </span>
                </div>

                {/* Thời gian làm bài */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    {t('table.duration')}
                  </span>
                  <span className="font-bold text-slate-900 text-xs">
                    {durationMinutes || 0} {t('table.minutes')}
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
                  <span className="font-bold text-slate-900 text-xs">{order !== '' ? order : 0}</span>
                </div>
              </div>
            </div>

            {/* Info Box: Cấu trúc đề thi Full Test */}
            <div className="p-3.5 rounded bg-blue-50/70 border border-blue-100 text-xs space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-bold">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                <span>{t('createPage.structureTitle')}</span>
              </div>
              <ul className="text-slate-600 text-[11px] space-y-1 pl-6 list-disc leading-relaxed">
                <li>{t('createPage.structureFullTest')}</li>
                <li>Listening: 100 câu (Part 1 – Part 4) ~ 45 phút</li>
                <li>Reading: 100 câu (Part 5 – Part 7) ~ 75 phút (Tích hợp Tiptap Editor cho Part 6 & 7)</li>
              </ul>
            </div>
          </div>

          {/* Card 2: Bước tiếp theo */}
          <div className="bg-white rounded border border-slate-200/80 p-6 shadow-sm space-y-4">
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

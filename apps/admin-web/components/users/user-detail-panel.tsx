'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserItem } from '@/types/user';
import { UserAvatar } from '@/components/users/user-avatar';
import {
  Calendar,
  BookOpen,
  GraduationCap,
  Clock,
  Flame,
  User as UserIcon,
  FileText,
  Bookmark,
  Activity,
  BookMarked,
  LogIn,
  Pencil,
  Ban,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Mail,
  Phone,
  Trash2,
  AlertTriangle,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserDetailPanelProps {
  user: UserItem;
  onEdit: (user: UserItem) => void;
  onToggleBan: (user: UserItem) => void;
  onDelete: (user: UserItem) => void;
  onSaveNotes?: (notes: string) => Promise<void>;
}

type DetailTab = 'overview' | 'activity' | 'learning' | 'other';

export function UserDetailPanel({
  user,
  onEdit,
  onToggleBan,
  onDelete,
  onSaveNotes,
}: UserDetailPanelProps) {
  const { t } = useTranslation('users');
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState(user.notes || '');
  const [noteSaved, setNoteSaved] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Sync note when user changes
  React.useEffect(() => {
    setNote(user.notes || '');
  }, [user.notes]);

  const isBanned = user.status === 'banned';

  const handleCopyEmail = () => {
    if (user.email) {
      navigator.clipboard.writeText(user.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveNote = async () => {
    try {
      setIsSavingNote(true);
      if (onSaveNotes) {
        await onSaveNotes(note);
      }
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2500);
    } catch (e) {
      console.error('Failed to save note', e);
    } finally {
      setIsSavingNote(false);
    }
  };

  const coursesList = user.courses || [];
  const activitiesList = user.recentActivities || [];

  const avgProgress =
    coursesList.length > 0
      ? Math.round(
          coursesList.reduce((acc, c) => acc + (c.percentage || 0), 0) /
            coursesList.length
        )
      : user.learningStats?.accuracyRate || 0;

  const overallProgress = coursesList.length > 0 ? avgProgress : 0;

  return (
    <div className="space-y-6">
      {/* 1. Profile Banner Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <UserAvatar
              avatarUrl={user.avatarUrl}
              name={user.name}
              email={user.email}
              size="xl"
              className="w-16 h-16 ring-2 ring-slate-100"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">
                {user.name}
              </h2>
              {isBanned ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {t('filters.banned', 'Bị khóa')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {t('filters.active', 'Hoạt động')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{user.email}</span>
              <span>•</span>
              <span>ID: {user.id}</span>
            </div>

            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                User
              </span>
            </div>
          </div>
        </div>

        {/* Right: Registration Date Box */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 flex items-center gap-3.5 shrink-0 self-start sm:self-center">
          <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="text-slate-400 font-medium">
              {t('detail.metrics.registration_date', 'Ngày đăng ký')}
            </p>
            <p className="font-bold text-slate-900 text-sm">{user.createdAt}</p>
            {user.registrationAgo ? (
              <p className="text-[11px] text-slate-400">
                ({user.registrationAgo})
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* 2. Four Quick Stat Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng số từ đã học */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-blue-200 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">
              {t('detail.metrics.words_learned', 'Tổng số từ đã học')}
            </p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              {user.wordsLearned ?? 0}
            </p>
          </div>
        </div>

        {/* Card 2: Hoàn thành khóa học */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-blue-200 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">
              {t('detail.metrics.completed_courses', 'Hoàn thành khóa học')}
            </p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              {user.completedCoursesCount ?? 0}
            </p>
            {coursesList.length > 0 && (
              <p className="text-[11px] text-slate-400 truncate">
                {t('detail.courses_enrolled', {
                  count: coursesList.length,
                  defaultValue: `${coursesList.length} khóa học đã tham gia`,
                })}
              </p>
            )}
          </div>
        </div>

        {/* Card 3: Thời gian học */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-blue-200 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">
              {t('detail.learning_stats.study_time', 'Thời gian học')}
            </p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              {user.learningStats?.studyTimeMinutes
                ? `${Math.round(user.learningStats.studyTimeMinutes / 60)} ${t('detail.learning_stats.study_time_hours', 'giờ')}`
                : `0 ${t('detail.learning_stats.study_time_hours', 'giờ')}`}
            </p>
          </div>
        </div>

        {/* Card 4: Streak hiện tại */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex items-center gap-4 hover:border-amber-200 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 fill-amber-400 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 truncate">
              {t('detail.metrics.current_streak', 'Streak hiện tại')}
            </p>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">
              {user.streakDays ?? 0} {t('detail.metrics.days', 'ngày')}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Horizontal Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-8 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap relative ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {t('detail.tabs.overview', 'Tổng quan')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`pb-3 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap relative ${
            activeTab === 'activity'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {t('detail.tabs.activity_history', 'Lịch sử hoạt động')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('learning')}
          className={`pb-3 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap relative ${
            activeTab === 'learning'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {t('detail.tabs.learning_progress', 'Tiến độ học tập')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('other')}
          className={`pb-3 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap relative ${
            activeTab === 'other'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {t('detail.tabs.other_info', 'Thông tin khác')}
        </button>
      </div>

      {/* 4. Tab 1: OVERVIEW (Tổng quan - 2 Columns) */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Card: Thông tin cá nhân */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 text-blue-600 font-bold text-sm">
                <UserIcon className="w-4 h-4" />
                <span className="text-slate-900">
                  {t('detail.tabs.personal_info', 'Thông tin cá nhân')}
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <p className="text-slate-400 font-medium mb-0.5">
                    {t('forms.full_name', 'Họ và tên')}
                  </p>
                  <p className="font-bold text-slate-800 text-sm">{user.name}</p>
                </div>

                <div>
                  <p className="text-slate-400 font-medium mb-0.5">
                    {t('forms.email', 'Email')}
                  </p>
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <span className="truncate">{user.email}</span>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="text-slate-400 hover:text-blue-600 transition-colors p-0.5 cursor-pointer"
                      title={copied ? t('detail.personal.copied', 'Đã sao chép') : t('detail.personal.copy_email', 'Sao chép email')}
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-slate-400 font-medium mb-0.5">
                    {t('detail.personal.role', 'Vai trò')}
                  </p>
                  <span className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                    {t('detail.role_badge', 'User')}
                  </span>
                </div>

                <div>
                  <p className="text-slate-400 font-medium mb-0.5">
                    {t('table.status', 'Trạng thái')}
                  </p>
                  {isBanned ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                      {t('filters.banned', 'Bị khóa')}
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                      {t('filters.active', 'Hoạt động')}
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-slate-400 font-medium mb-0.5">
                    {t('table.registered_date', 'Ngày đăng ký')}
                  </p>
                  <p className="font-semibold text-slate-800">{user.createdAt}</p>
                </div>

                <div>
                  <p className="text-slate-400 font-medium mb-0.5">
                    {t('detail.personal.last_login', 'Lần đăng nhập cuối')}
                  </p>
                  <p className="font-semibold text-slate-800">{user.lastActive}</p>
                </div>

                <div>
                  <p className="text-slate-400 font-medium mb-0.5">
                    {t('detail.personal.address', 'Địa chỉ')}
                  </p>
                  <p className="text-slate-500">
                    {user.personalDetail?.bio || t('detail.personal.not_updated', 'Chưa cập nhật')}
                  </p>
                </div>

                <div>
                  <p className="text-slate-400 font-medium mb-0.5">
                    {t('forms.phone', 'Số điện thoại')}
                  </p>
                  <p className="text-slate-500">
                    {user.phone || t('detail.personal.not_updated', 'Chưa cập nhật')}
                  </p>
                </div>
              </div>
            </div>

            {/* Card: Ghi chú */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 text-blue-600 font-bold text-sm">
                <FileText className="w-4 h-4" />
                <span className="text-slate-900">
                  {t('detail.notes.title', 'Ghi chú')}
                </span>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={t('detail.notes.placeholder', 'Thêm ghi chú...')}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all placeholder:text-slate-400"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveNote}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold px-4 cursor-pointer shadow-xs"
                >
                  {noteSaved ? t('detail.notes.saved', 'Đã lưu') : t('detail.notes.save', 'Lưu')}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            {/* Card: Tiến độ học tập */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5 text-blue-600 font-bold text-sm">
                  <Bookmark className="w-4 h-4" />
                  <span className="text-slate-900">
                    {t('detail.tabs.learning_progress', 'Tiến độ học tập')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('learning')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>{t('actions.view_detail', 'Xem chi tiết')}</span>
                  <span>→</span>
                </button>
              </div>

              {/* Donut progress */}
              <div className="flex items-center gap-6 py-2">
                <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                  <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="#f1f5f9"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      stroke="#0d9488"
                      strokeWidth="8"
                      strokeDasharray={201}
                      strokeDashoffset={201 * (1 - overallProgress / 100)}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <span className="absolute font-bold text-sm text-slate-800">
                    {overallProgress}%
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {t('detail.metrics.completed_courses', 'Hoàn thành khóa học')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {coursesList.length > 0
                      ? t('detail.courses_completed_desc', {
                          completed: user.completedCoursesCount ?? 0,
                          total: coursesList.length,
                          defaultValue: `Đã hoàn thành ${user.completedCoursesCount ?? 0} / ${coursesList.length} lộ trình mục tiêu`,
                        })
                      : t('detail.no_courses_desc', 'Chưa có lộ trình nào được ghi nhận')}
                  </p>
                </div>
              </div>

              {/* Courses progress list */}
              <div className="space-y-4 pt-2">
                {coursesList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    {t('detail.no_lessons_desc', 'Chưa có bài học nào được ghi nhận.')}
                  </div>
                ) : (
                  coursesList.map((course: any) => (
                    <div key={course.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-6 h-6 rounded-md ${
                              course.color || 'bg-blue-600'
                            } text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                          >
                            {course.letter || course.title.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-800">
                            {course.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-slate-500 font-medium">
                          <span>
                            {course.progressText ||
                              t('detail.lessons_ratio', {
                                completed: course.completedItems || 0,
                                total: course.totalItems || 0,
                                defaultValue: `${course.completedItems || 0} / ${course.totalItems || 0} bài học`,
                              })}
                          </span>
                          <span className="font-bold text-slate-800 w-8 text-right">
                            {course.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${course.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card: Hoạt động gần đây */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5 text-blue-600 font-bold text-sm">
                  <Activity className="w-4 h-4" />
                  <span className="text-slate-900">
                    {t('detail.recent_activities_title', 'Hoạt động gần đây')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>{t('detail.view_all', 'Xem tất cả')}</span>
                  <span>→</span>
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                {activitiesList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    {t('detail.no_recent_activities', 'Chưa có hoạt động nào gần đây.')}
                  </div>
                ) : (
                  activitiesList.map((act: any) => {
                    let icon = <BookOpen className="w-4 h-4" />;
                    let bg = 'bg-blue-50 text-blue-600';

                    if (act.type === 'word') {
                      icon = <BookMarked className="w-4 h-4" />;
                      bg = 'bg-blue-50 text-blue-600';
                    } else if (act.type === 'login' || act.iconType === 'auth') {
                      icon = <LogIn className="w-4 h-4" />;
                      bg = 'bg-emerald-50 text-emerald-600';
                    } else if (act.type === 'profile' || act.iconType === 'profile') {
                      icon = <UserIcon className="w-4 h-4" />;
                      bg = 'bg-purple-50 text-purple-600';
                    } else if (act.type === 'lesson' || act.iconType === 'lesson') {
                      icon = <GraduationCap className="w-4 h-4" />;
                      bg = 'bg-blue-50 text-blue-600';
                    }

                    return (
                      <div
                        key={act.id}
                        className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`}
                          >
                            {icon}
                          </div>
                          <span className="font-semibold text-slate-800 truncate">
                            {act.title}
                          </span>
                        </div>
                        <span className="text-slate-400 font-medium shrink-0 whitespace-nowrap">
                          {act.time}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab 2: ACTIVITY HISTORY (Lịch sử hoạt động) */}
      {activeTab === 'activity' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              {t('detail.activity_log.heading', 'Nhật ký tương tác tài khoản')}
            </h3>
            <span className="text-xs text-slate-400">
              {t('detail.recent_events_count', {
                count: activitiesList.length,
                defaultValue: `${activitiesList.length} sự kiện gần nhất`,
              })}
            </span>
          </div>

          {activitiesList.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              {t('detail.no_activity_history', 'Chưa có lịch sử hoạt động nào được ghi nhận.')}
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {activitiesList.map((act: any) => (
                <div key={act.id} className="relative group">
                  <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-600 shadow-xs" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-800">
                      {act.title}
                    </p>
                    <p className="text-[11px] text-slate-400">{act.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Tab 3: LEARNING PROGRESS (Tiến độ học tập chi tiết) */}
      {activeTab === 'learning' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-2">
              <span className="text-xs text-slate-500 font-medium">
                {t('detail.learning_stats.accuracy', 'Tỷ lệ trả lời chính xác')}
              </span>
              <p className="text-2xl font-bold text-emerald-600">
                {user.learningStats?.accuracyRate ?? 0}%
              </p>
              <p className="text-[11px] text-slate-400">
                {t(
                  'detail.learning_stats.accuracy_sub',
                  'Tính trên các bài ôn tập flashcard'
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-2">
              <span className="text-xs text-slate-500 font-medium">
                {t('detail.learning_stats.avg_score', 'Điểm số trung bình')}
              </span>
              <p className="text-2xl font-bold text-blue-600">
                {user.learningStats?.testScoresAvg ?? 0} / 10
              </p>
              <p className="text-[11px] text-slate-400">
                {user.learningStats?.testScoresAvg && user.learningStats.testScoresAvg >= 8
                  ? t('detail.learning_stats.grade_excellent', 'Xếp loại: Xuất sắc')
                  : user.learningStats?.testScoresAvg && user.learningStats.testScoresAvg >= 5
                  ? t('detail.learning_stats.grade_passed', 'Xếp loại: Đạt')
                  : t('detail.learning_stats.no_grade', 'Chưa có xếp loại')}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-2">
              <span className="text-xs text-slate-500 font-medium">
                {t('detail.learning_stats.study_time', 'Tổng thời gian học')}
              </span>
              <p className="text-2xl font-bold text-purple-600">
                {Math.round((user.learningStats?.studyTimeMinutes ?? 0) / 60)}{' '}
                {t('detail.learning_stats.study_time_hours', 'giờ')}
              </p>
              <p className="text-[11px] text-slate-400">
                {t('detail.learning_stats.study_time_sub', {
                  minutes: user.learningStats?.studyTimeMinutes ?? 0,
                  defaultValue: `Tương đương ~${user.learningStats?.studyTimeMinutes ?? 0} phút`,
                })}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              {t('detail.enrolled_courses_title', 'Danh sách khóa học đã ghi danh')}
            </h4>
            {coursesList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                {t('detail.no_enrolled_courses', 'Chưa tham gia khóa học hoặc bài học nào.')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {coursesList.map((course: any) => (
                  <div
                    key={course.id}
                    className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/40 hover:bg-white hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg ${
                          course.color || 'bg-blue-600'
                        } text-white font-bold text-sm flex items-center justify-center shadow-xs`}
                      >
                        {course.letter || course.title.charAt(0)}
                      </div>
                      <div>
                        <h5 className="font-bold text-xs text-slate-900">
                          {course.title}
                        </h5>
                        <span className="text-[11px] text-slate-400">
                          {course.progressText}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                        <span>{t('detail.progress_label', 'Tiến độ')}</span>
                        <span>{course.percentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${course.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. Tab 4: OTHER INFO & SETTINGS (Thông tin khác & Quản trị) */}
      {activeTab === 'other' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              {t('detail.security.title', 'Chi tiết xác thực & Bảo mật')}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> {t('detail.security.auth_method', 'Phương thức đăng nhập')}
                </span>
                <p className="text-sm font-bold text-slate-900 capitalize">
                  {user.personalDetail?.authProvider || 'Google OAuth'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t('detail.security.email_verification', 'Xác thực email')}
                </span>
                <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> {t('detail.security.verified', 'Đã xác thực')}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> {t('detail.security.created_at', 'Ngày tạo tài khoản')}
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {user.createdAt}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> {t('detail.security.last_accessed', 'Lần truy cập gần nhất')}
                </span>
                <p className="text-sm font-bold text-slate-900">
                  {user.lastActive}
                </p>
              </div>
            </div>
          </div>

          {/* Danger Zone: Khóa / Xóa tài khoản */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              {t('detail.management_actions.heading', 'Thao tác quản trị tài khoản')}
            </h3>

            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">
                    {isBanned
                      ? t('detail.management_actions.unlock_title', 'Mở khóa tài khoản')
                      : t('detail.management_actions.lock_title', 'Khóa tài khoản người dùng')}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isBanned
                      ? t('detail.management_actions.unlock_desc', 'Khôi phục quyền truy cập ứng dụng cho người dùng')
                      : t('detail.management_actions.lock_desc', 'Vô hiệu hóa quyền đăng nhập của người dùng vào hệ thống')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleBan(user)}
                  className={`h-8 text-xs font-semibold cursor-pointer shrink-0 ${
                    isBanned
                      ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                      : 'text-rose-600 border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  {isBanned
                    ? t('detail.management_actions.unlock_btn', 'Mở khóa')
                    : t('detail.management_actions.lock_btn', 'Khóa tài khoản')}
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-rose-700">
                    {t('detail.management_actions.delete_title', 'Xóa vĩnh viễn tài khoản')}
                  </p>
                  <p className="text-[11px] text-rose-600/80">
                    {t('detail.management_actions.delete_desc', 'Xóa toàn bộ dữ liệu học tập và thông tin cá nhân khỏi hệ thống')}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onDelete(user)}
                  className="h-8 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white border-0 cursor-pointer shrink-0"
                >
                  {t('detail.management_actions.delete_btn', 'Xóa tài khoản')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

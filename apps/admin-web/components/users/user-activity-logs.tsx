'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { activityLogService } from '@/services/activity-log.service';
import { ActivityLogItem } from '@/types/activity-log';
import {
  Activity,
  LogIn,
  LogOut,
  UserPlus,
  Compass,
  BookOpen,
  GraduationCap,
  Headphones,
  Award,
  Clock,
  Globe,
  Monitor,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserActivityLogsProps {
  userId?: string;
  userEmail?: string;
  limit?: number;
  compact?: boolean;
}

export function UserActivityLogs({
  userId,
  userEmail,
  limit = 20,
  compact = false,
}: UserActivityLogsProps) {
  const { t, i18n } = useTranslation(['activityLog', 'users']);
  const currentLang = i18n.language || 'vi';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');

  // Load distinct filters for dropdowns
  const { data: filtersData } = useQuery({
    queryKey: ['activity-logs-filters', currentLang],
    queryFn: () => activityLogService.getFilters(currentLang),
    staleTime: 5 * 60 * 1000,
  });

  // Query activity logs for this user
  const {
    data: logsData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: [
      'user-activity-logs',
      userId,
      userEmail,
      page,
      limit,
      search,
      categoryFilter,
      actionFilter,
      currentLang,
    ],
    queryFn: () =>
      activityLogService.getAll({
        userId: userId || undefined,
        userEmail: !userId && userEmail ? userEmail : undefined,
        page,
        limit,
        search: search.trim() || undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        lang: currentLang,
      }),
    enabled: Boolean(userId || userEmail),
  });

  const logs = logsData?.items || [];
  const total = logsData?.total || 0;
  const totalPages = logsData?.totalPages || 1;

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(currentLang === 'vi' ? 'vi-VN' : 'en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Icon and badge styling per action
  const getActionBadge = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('LOGIN')) {
      return {
        icon: <LogIn className="w-3.5 h-3.5" />,
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    }
    if (act.includes('LOGOUT')) {
      return {
        icon: <LogOut className="w-3.5 h-3.5" />,
        bg: 'bg-slate-50 text-slate-700 border-slate-200',
        dot: 'bg-slate-400',
      };
    }
    if (act.includes('REGISTER')) {
      return {
        icon: <UserPlus className="w-3.5 h-3.5" />,
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        dot: 'bg-indigo-500',
      };
    }
    if (act.includes('VOCABULARY') || act.includes('VOCAB')) {
      return {
        icon: <BookOpen className="w-3.5 h-3.5" />,
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
      };
    }
    if (act.includes('DICTATION')) {
      return {
        icon: <Headphones className="w-3.5 h-3.5" />,
        bg: 'bg-violet-50 text-violet-700 border-violet-200',
        dot: 'bg-violet-500',
      };
    }
    if (act.includes('TOEIC') || act.includes('ASSESSMENT')) {
      return {
        icon: <Award className="w-3.5 h-3.5" />,
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    }
    if (act.includes('SESSION') || act.includes('PAGE_VIEW')) {
      return {
        icon: <Compass className="w-3.5 h-3.5" />,
        bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        dot: 'bg-cyan-500',
      };
    }
    return {
      icon: <Activity className="w-3.5 h-3.5" />,
      bg: 'bg-slate-50 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
    };
  };

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      {!compact && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-50/70 border border-slate-200 rounded">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search input */}
            <div className="relative min-w-[200px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t('activityLog:filters.search_placeholder', 'Tìm kiếm nhật ký...')}
                className="h-8 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded"
              />
            </div>

            {/* Category filter */}
            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs bg-white border border-slate-200 rounded">
                <SelectValue placeholder={t('activityLog:filters.all_categories', 'Tất cả danh mục')} />
              </SelectTrigger>
              <SelectContent className="rounded">
                <SelectItem value="ALL" className="text-xs">
                  {t('activityLog:filters.all_categories', 'Tất cả danh mục')}
                </SelectItem>
                {(filtersData?.categories || []).map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="text-xs">
                    {cat.label || cat.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Action filter */}
            <Select
              value={actionFilter}
              onValueChange={(val) => {
                setActionFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs bg-white border border-slate-200 rounded">
                <SelectValue placeholder={t('activityLog:filters.all_actions', 'Tất cả hành động')} />
              </SelectTrigger>
              <SelectContent className="rounded">
                <SelectItem value="ALL" className="text-xs">
                  {t('activityLog:filters.all_actions', 'Tất cả hành động')}
                </SelectItem>
                {(filtersData?.actions || []).map((act) => (
                  <SelectItem key={act.value} value={act.value} className="text-xs">
                    {act.label || act.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="h-8 px-2.5 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${isRefetching ? 'animate-spin text-blue-600' : 'text-slate-500'}`}
              />
              <span>{currentLang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Content List / Table */}
      {isLoading ? (
        <div className="p-8 border border-slate-200 rounded bg-white text-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">
            {currentLang === 'vi' ? 'Đang tải lịch sử hoạt động...' : 'Loading activity logs...'}
          </p>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-slate-200 rounded bg-white space-y-2">
          <Activity className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold text-slate-700">
            {t('activityLog:filters.no_logs', 'Không tìm thấy nhật ký hoạt động nào.')}
          </p>
          <p className="text-[11px] text-slate-400">
            {currentLang === 'vi'
              ? 'Người dùng chưa có hoạt động nào được ghi nhận trong tiêu chí đã chọn.'
              : 'No activities have been recorded for this user under the selected criteria.'}
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded bg-white overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100">
            {logs.map((item: ActivityLogItem) => {
              const badge = getActionBadge(item.action);
              const isSuccess = item.status === 'SUCCESS';

              return (
                <div
                  key={item._id}
                  className="p-3 sm:p-3.5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* Left: Action Icon + Info */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded border flex items-center justify-center shrink-0 ${badge.bg}`}
                    >
                      {badge.icon}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {item.actionLabel || item.action}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${badge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span>{item.categoryLabel || item.category}</span>
                        </span>

                        {item.status && item.status !== 'SUCCESS' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            <span>{item.statusLabel || item.status}</span>
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* Metadata badges: Duration, IP, User-Agent */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        {item.durationMs && item.durationMs > 0 ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {item.durationMs > 1000
                                ? `${(item.durationMs / 1000).toFixed(1)}s`
                                : `${item.durationMs}ms`}
                            </span>
                          </span>
                        ) : null}

                        {item.ipAddress && (
                          <span className="flex items-center gap-1 font-mono">
                            <Globe className="w-3 h-3 text-slate-400" />
                            <span>{item.ipAddress}</span>
                          </span>
                        )}

                        {item.metadata?.device && (
                          <span className="flex items-center gap-1">
                            <Monitor className="w-3 h-3 text-slate-400" />
                            <span>{item.metadata.device}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Timestamp */}
                  <div className="shrink-0 self-end sm:self-center text-right font-medium text-[11px] text-slate-400">
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination bar */}
          {!compact && totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
              <div>
                <span>
                  {currentLang === 'vi' ? 'Tổng số:' : 'Total:'}{' '}
                  <strong className="font-semibold text-slate-900">{total}</strong>{' '}
                  {currentLang === 'vi' ? 'hoạt động' : 'activities'}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 w-7 p-0 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>

                <span className="px-2 font-medium">
                  {page} / {totalPages}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 w-7 p-0 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

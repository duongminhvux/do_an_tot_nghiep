'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { userService } from '@/services/user.service';
import {
  CreateUserPayload,
  UpdateUserPayload,
  UserItem,
  UserRole,
  UserStatus,
} from '@/types/user';
import {
  Users,
  CheckCircle2,
  Clock,
  Ban,
  Search,
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  Sparkles,
  Activity,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CreateUserDialog } from '@/components/users/create-user-dialog';
import { EditUserDialog } from '@/components/users/edit-user-dialog';
import { ConfirmBanDialog } from '@/components/users/confirm-ban-dialog';
import { ConfirmDeleteDialog } from '@/components/users/confirm-delete-dialog';
import { UserAvatar } from '@/components/users/user-avatar';
import { UserActivityLogs } from '@/components/users/user-activity-logs';

export default function UsersPage() {
  const { t } = useTranslation('users');
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'vi';
  const queryClient = useQueryClient();

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Multi-select checkboxes
  const [selectedCheckboxIds, setSelectedCheckboxIds] = useState<string[]>([]);

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [banningUser, setBanningUser] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [viewingLogsUser, setViewingLogsUser] = useState<UserItem | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Query users directly from server
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', debouncedSearch, statusFilter, dateFilter, page],
    queryFn: () =>
      userService.getAll({
        search: debouncedSearch || undefined,
        status: statusFilter,
        dateRange: dateFilter,
        page,
        limit: 10,
      }),
  });

  const usersList = useMemo(() => usersData?.items || [], [usersData]);
  const total = usersData?.total || 0;
  const totalPages = usersData?.totalPages || 1;
  const startItem = total === 0 ? 0 : (page - 1) * 10 + 1;
  const endItem = Math.min(page * 10, total);

  const paginationRange = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const range: (number | string)[] = [];
    const delta = 1;
    for (
      let i = Math.max(2, page - delta);
      i <= Math.min(totalPages - 1, page + delta);
      i++
    ) {
      range.push(i);
    }

    if (page - delta > 2) {
      range.unshift('ellipsis-start');
    }
    if (page + delta < totalPages - 1) {
      range.push('ellipsis-end');
    }

    range.unshift(1);
    if (totalPages > 1) {
      range.push(totalPages);
    }

    return range;
  }, [page, totalPages]);

  // Handle multi-select checkboxes
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCheckboxIds(usersList.map((u) => u.id));
    } else {
      setSelectedCheckboxIds([]);
    }
  };

  const handleToggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCheckboxIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => userService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
      mongoId,
    }: {
      id: string;
      payload: UpdateUserPayload;
      mongoId?: string;
    }) => userService.update(id, payload, mongoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ id, mongoId }: { id: string; mongoId?: string }) =>
      userService.toggleBan(id, mongoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, mongoId }: { id: string; mongoId?: string }) =>
      userService.delete(id, mongoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedCheckboxIds((prev) => prev.filter((i) => i !== deletingUser?.id));
    },
  });

  return (
    <div className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
      {/* 1. Header: Title and subtitle */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {t('title', 'Quản lý người dùng')}
        </h1>
        <p className="text-sm text-slate-500">
          {t('subtitle', 'Xem và quản lý tất cả người dùng trong hệ thống')}
        </p>
      </div>

      {/* 2. Top Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng người dùng */}
        <div className="rounded border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-medium text-slate-500 truncate">
                {t('stats.total_users', 'Tổng người dùng')}
              </p>
              <p className="text-2xl font-bold tracking-tight text-slate-900">
                {usersData?.stats ? usersData.stats.totalUsers.toLocaleString() : '0'}
              </p>
              <p className="text-xs font-medium text-slate-400">
                {t('stats.all_system', 'Toàn bộ hệ thống')}
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Đang hoạt động */}
        <div className="rounded border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-medium text-slate-500 truncate">
                {t('stats.active_users', 'Đang hoạt động')}
              </p>
              <p className="text-2xl font-bold tracking-tight text-slate-900">
                {usersData?.stats ? usersData.stats.activeUsers.toLocaleString() : '0'}
              </p>
              <p className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{t('filters.active', 'Hoạt động')}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Tài khoản mới (7 ngày) */}
        <div className="rounded border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-medium text-slate-500 truncate">
                {t('stats.new_users_7d', 'Tài khoản mới (7 ngày)')}
              </p>
              <p className="text-2xl font-bold tracking-tight text-slate-900">
                {usersData?.stats ? usersData.stats.newUsers7d.toLocaleString() : '0'}
              </p>
              <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{t('filters.last_7_days', '7 ngày qua')}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Bị khóa */}
        <div className="rounded border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-500/20">
              <Ban className="w-6 h-6" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-medium text-slate-500 truncate">
                {t('stats.banned_users', 'Bị khóa')}
              </p>
              <p className="text-2xl font-bold tracking-tight text-slate-900">
                {usersData?.stats ? usersData.stats.bannedUsers.toLocaleString() : '0'}
              </p>
              <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
                <Ban className="w-3.5 h-3.5" />
                <span>{t('filters.banned', 'Bị khóa')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter & Action Toolbar */}
      <div className="rounded border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
          {/* Left search & filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={t(
                  'filters.search_placeholder',
                  'Tìm kiếm theo tên, email, ID...'
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded border-slate-200 text-xs sm:text-sm bg-slate-50/40 focus:bg-white"
              />
            </div>

            {/* Filter: Trạng thái */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-slate-500 whitespace-nowrap font-medium hidden xl:inline">
                {t('filters.status', 'Trạng thái')}:
              </span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-[125px] rounded text-xs font-medium">
                  <SelectValue placeholder={t('filters.status', 'Trạng thái')} />
                </SelectTrigger>
                <SelectContent className="rounded">
                  <SelectItem value="all">{t('filters.all', 'Tất cả')}</SelectItem>
                  <SelectItem value="active">{t('filters.active', 'Hoạt động')}</SelectItem>
                  <SelectItem value="banned">{t('filters.banned', 'Bị khóa')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter: Ngày đăng ký */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-slate-500 whitespace-nowrap font-medium hidden xl:inline">
                {t('filters.registered_date', 'Ngày đăng ký')}:
              </span>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-10 w-[130px] rounded text-xs font-medium">
                  <SelectValue placeholder={t('filters.registered_date', 'Ngày đăng ký')} />
                </SelectTrigger>
                <SelectContent className="rounded">
                  <SelectItem value="all">{t('filters.all', 'Tất cả')}</SelectItem>
                  <SelectItem value="today">{t('filters.today', 'Hôm nay')}</SelectItem>
                  <SelectItem value="7days">{t('filters.last_7_days', '7 ngày qua')}</SelectItem>
                  <SelectItem value="30days">{t('filters.last_30_days', '30 ngày qua')}</SelectItem>
                  <SelectItem value="year">{t('filters.this_year', 'Năm nay')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right Action: + Thêm người dùng */}
          <div className="shrink-0 flex items-center justify-end">
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="h-10 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-sm flex items-center gap-2 cursor-pointer transition-all hover:shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>{t('actions.add_user', 'Thêm người dùng')}</span>
            </Button>
          </div>
        </div>

        {/* 4. Table */}
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={
                      usersList.length > 0 &&
                      selectedCheckboxIds.length === usersList.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4 min-w-[180px]">{t('table.user_name', 'Tên người dùng')}</th>
                <th className="py-3 px-4 min-w-[200px]">{t('table.email', 'Email')}</th>
                <th className="py-3 px-4 min-w-[120px]">{t('table.status', 'Trạng thái')}</th>
                <th className="py-3 px-4 min-w-[130px] whitespace-nowrap">{t('table.registered_date', 'Ngày đăng ký')}</th>
                <th className="py-3 px-4 min-w-[160px] whitespace-nowrap">{t('table.last_active', 'Hoạt động cuối')}</th>
                <th className="py-3 px-4 text-center w-20">{t('table.actions', 'Hành động')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    {t('table.loading', 'Đang tải danh sách người dùng...')}
                  </td>
                </tr>
              ) : usersList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {t('table.no_users', 'Không tìm thấy người dùng phù hợp')}
                  </td>
                </tr>
              ) : (
                usersList.map((user) => {
                  const isChecked = selectedCheckboxIds.includes(user.id);
                  const isBanned = user.status === 'banned';

                  return (
                    <tr
                      key={user.id}
                      onClick={() => router.push(`/${locale}/users/${user._id || user.id}`)}
                      className="cursor-pointer transition-colors group hover:bg-blue-50/40"
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleToggleRow(user.id, e as any)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Tên người dùng with Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            avatarUrl={user.avatarUrl}
                            name={user.name}
                            email={user.email}
                            size="sm"
                          />
                          <span className="truncate text-slate-900 font-semibold group-hover:text-blue-600 transition-colors">
                            {user.name}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 text-slate-600 truncate max-w-[200px]">
                        {user.email}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3 px-4">
                        {isBanned ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                            {t('filters.banned', 'Bị khóa')}
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                            {t('filters.active', 'Hoạt động')}
                          </span>
                        )}
                      </td>

                      {/* Ngày đăng ký */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {user.createdAt}
                      </td>

                      {/* Hoạt động cuối */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {user.lastActive}
                      </td>

                      {/* Hành động */}
                      <td
                        className="py-3 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/${locale}/users/${user._id || user.id}`)
                              }
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600 mr-2" />
                              <span>{t('actions.view_detail', 'Xem chi tiết')}</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => setViewingLogsUser(user)}
                            >
                              <Activity className="w-3.5 h-3.5 text-blue-600 mr-2" />
                              <span>{t('actions.view_logs', 'Nhật ký hoạt động')}</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => setEditingUser(user)}
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-500 mr-2" />
                              <span>{t('actions.edit', 'Chỉnh sửa')}</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => setBanningUser(user)}
                              className={isBanned ? 'text-emerald-700' : 'text-amber-700'}
                            >
                              {isBanned ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-2" />
                                  <span>{t('actions.unlock_account', 'Mở khóa')}</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3.5 h-3.5 text-rose-600 mr-2" />
                                  <span>{t('actions.lock_account', 'Khóa tài khoản')}</span>
                                </>
                              )}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => setDeletingUser(user)}
                              className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />
                              <span>{t('actions.delete_user', 'Xóa người dùng')}</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
          <div>
            <span>
              {t('table.showing', 'Hiển thị')}{' '}
              <strong className="text-slate-700">
                {startItem} - {endItem}
              </strong>{' '}
              {t('table.of', 'trong')}{' '}
              <strong className="text-slate-700">
                {total.toLocaleString()}
              </strong>{' '}
              {t('table.users', 'người dùng')}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0 rounded text-slate-600 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {paginationRange.map((item, idx) => {
              if (item === 'ellipsis-start' || item === 'ellipsis-end') {
                return (
                  <span key={`${item}-${idx}`} className="px-1 text-slate-400">
                    ...
                  </span>
                );
              }

              const pageNum = item as number;
              const isActive = page === pageNum;

              return (
                <Button
                  key={pageNum}
                  type="button"
                  size="sm"
                  onClick={() => setPage(pageNum)}
                  className={`h-8 min-w-[32px] px-2 rounded text-xs font-semibold cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 p-0 rounded text-slate-600 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Activity Logs Modal */}
      {viewingLogsUser && (
        <Dialog
          open={!!viewingLogsUser}
          onOpenChange={(open) => !open && setViewingLogsUser(null)}
        >
          <DialogContent className="max-w-3xl rounded p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>
                  {t('activityLog:title', 'Nhật ký hoạt động')} - {viewingLogsUser.name}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {viewingLogsUser.email} (ID: {viewingLogsUser.id})
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 max-h-[65vh] overflow-y-auto pr-1">
              <UserActivityLogs
                userId={viewingLogsUser._id || viewingLogsUser.id}
                userEmail={viewingLogsUser.email}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modals & Dialogs */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={async (payload) => {
          await createMutation.mutateAsync(payload);
        }}
      />

      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSubmit={async (id, payload) => {
          await updateMutation.mutateAsync({ id, payload, mongoId: editingUser?._id });
        }}
      />

      <ConfirmBanDialog
        user={banningUser}
        open={!!banningUser}
        onOpenChange={(open) => !open && setBanningUser(null)}
        onConfirm={async (id) => {
          await banMutation.mutateAsync({ id, mongoId: banningUser?._id });
        }}
      />

      <ConfirmDeleteDialog
        user={deletingUser}
        open={!!deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        onConfirm={async (id) => {
          await deleteMutation.mutateAsync({ id, mongoId: deletingUser?._id });
        }}
      />
    </div>
  );
}
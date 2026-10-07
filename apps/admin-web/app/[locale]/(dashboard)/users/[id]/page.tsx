'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { userService } from '@/services/user.service';
import { UpdateUserPayload, UserItem } from '@/types/user';
import { ChevronLeft, Loader2, UserX, Pencil, Ban, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserDetailPanel } from '@/components/users/user-detail-panel';
import { EditUserDialog } from '@/components/users/edit-user-dialog';
import { ConfirmBanDialog } from '@/components/users/confirm-ban-dialog';
import { ConfirmDeleteDialog } from '@/components/users/confirm-delete-dialog';

export default function UserDetailPage() {
  const { t } = useTranslation('users');
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const userId = params?.id as string;
  const locale = (params?.locale as string) || 'vi';
  const initialTab = searchParams.get('tab') as any;

  // Dialog states
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [banningUser, setBanningUser] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);

  // Fetch user details from database
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => userService.getById(userId),
    enabled: !!userId,
  });

  // Mutations
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
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ id, mongoId }: { id: string; mongoId?: string }) =>
      userService.toggleBan(id, mongoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, mongoId }: { id: string; mongoId?: string }) =>
      userService.delete(id, mongoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      router.push(`/${locale}/users`);
    },
  });

  const notesMutation = useMutation({
    mutationFn: (notes: string) =>
      userService.updateNotes(user?._id || userId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] });
    },
  });

  return (
    <div className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header matching screenshot */}
      <div className="space-y-3">
        {/* Back Link */}
        <div>
          <Link
            href={`/${locale}/users`}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t('detail_page.back_to_list', 'Quay lại danh sách')}</span>
          </Link>
        </div>

        {/* Title & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            {t('detail_page.title', 'Chi tiết người dùng')}
          </h1>

          {user && (
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                onClick={() => setEditingUser(user)}
                className="h-9 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t('actions.edit', 'Chỉnh sửa')}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setBanningUser(user)}
                className={`h-9 px-4 rounded font-semibold text-xs border shadow-2xs flex items-center gap-2 cursor-pointer transition-all ${
                  user.status === 'banned'
                    ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    : 'border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-600'
                }`}
              >
                {user.status === 'banned' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('actions.unlock_account', 'Mở khóa')}</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5 text-rose-600" />
                    <span>{t('actions.lock_account', 'Khóa tài khoản')}</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content State */}
      {isLoading ? (
        <div className="rounded border border-slate-200 bg-white p-16 flex flex-col items-center justify-center text-center shadow-2xs">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <p className="text-sm font-medium text-slate-600">
            {t('detail_page.loading', 'Đang tải thông tin người dùng...')}
          </p>
        </div>
      ) : isError || !user ? (
        <div className="rounded border border-slate-200 bg-white p-12 text-center shadow-2xs space-y-4">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
            <UserX className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              {t('detail_page.not_found', 'Không tìm thấy người dùng này hoặc tài khoản đã bị xóa.')}
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              ID: <span className="font-mono">{userId}</span>
            </p>
          </div>
          <div>
            <Button
              type="button"
              onClick={() => router.push(`/${locale}/users`)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold px-4 cursor-pointer"
            >
              {t('detail_page.back_to_list', 'Quay lại danh sách người dùng')}
            </Button>
          </div>
        </div>
      ) : (
        <UserDetailPanel
          user={user}
          initialTab={initialTab}
          onEdit={(u) => setEditingUser(u)}
          onToggleBan={(u) => setBanningUser(u)}
          onDelete={(u) => setDeletingUser(u)}
          onSaveNotes={async (notes) => {
            await notesMutation.mutateAsync(notes);
          }}
        />
      )}

      {/* Action Dialogs */}
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

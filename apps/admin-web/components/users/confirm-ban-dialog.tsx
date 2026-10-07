'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserItem } from '@/types/user';
import { Ban, CheckCircle2, Loader2 } from 'lucide-react';

interface ConfirmBanDialogProps {
  user: UserItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<void>;
}

export function ConfirmBanDialog({
  user,
  open,
  onOpenChange,
  onConfirm,
}: ConfirmBanDialogProps) {
  const { t } = useTranslation('users');
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const isBanning = user.status === 'active';

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm(user.id);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] rounded">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded ${
                isBanning
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              {isBanning ? (
                <Ban className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {isBanning
                  ? t('confirm_ban.lock_title', 'Khóa tài khoản')
                  : t('confirm_ban.unlock_title', 'Mở khóa tài khoản')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {isBanning
                  ? t('confirm_ban.lock_desc', {
                      name: user.name,
                      email: user.email,
                      defaultValue: `Bạn có chắc chắn muốn khóa tài khoản "${user.name}" (${user.email})? Người dùng sẽ không thể đăng nhập vào ứng dụng.`,
                    })
                  : t('confirm_ban.unlock_desc', {
                      name: user.name,
                      email: user.email,
                      defaultValue: `Mở khóa cho người dùng "${user.name}" (${user.email}) và khôi phục quyền truy cập hệ thống.`,
                    })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-9 text-sm"
          >
            {t('actions.cancel', 'Hủy')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`h-9 text-sm ${
              isBanning
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isBanning
              ? t('confirm_ban.confirm_lock', 'Xác nhận khóa')
              : t('confirm_ban.confirm_unlock', 'Xác nhận mở khóa')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface ConfirmDeleteDialogProps {
  user: UserItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => Promise<void>;
}

export function ConfirmDeleteDialog({
  user,
  open,
  onOpenChange,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation('users');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!user) return null;

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setFailed(false);
      await onConfirm(user.id);
      onOpenChange(false);
    } catch (err) {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { setFailed(false); onOpenChange(value); }}>
      <DialogContent className="sm:max-w-[420px] rounded">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-red-50 text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {t('confirm_delete.title', 'Xóa tài khoản người dùng')}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {t('confirm_delete.desc', {
                  name: user.name,
                  id: user.id,
                  defaultValue: `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${user.name}" (${user.id})? Hành động này không thể hoàn tác.`,
                })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {failed && <p role="alert" className="text-xs text-red-600">{t("messages.delete_failed")}</p>}
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setFailed(false); onOpenChange(false); }}
            disabled={loading}
            className="h-9 text-sm"
          >
            {t('actions.cancel', 'Hủy')}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="h-9 text-sm bg-red-600 hover:bg-red-700 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('confirm_delete.confirm_delete', 'Xác nhận xóa')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

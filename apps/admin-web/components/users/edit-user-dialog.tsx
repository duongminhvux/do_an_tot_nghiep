'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UpdateUserPayload, UserItem, UserRole, UserStatus } from '@/types/user';
import { Pencil, Loader2 } from 'lucide-react';

interface EditUserDialogProps {
  user: UserItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, payload: UpdateUserPayload) => Promise<void>;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
}: EditUserDialogProps) {
  const { t } = useTranslation('users');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<UserStatus>('active');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone || '');
      setStatus(user.status);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !email.trim()) return;

    try {
      setLoading(true);
      await onSubmit(user.id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        status,
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {t('forms.edit_title', 'Chỉnh sửa người dùng')}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  {t('forms.edit_desc', { id: user.id, defaultValue: `Cập nhật thông tin chi tiết cho tài khoản ${user.id}.` })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t('forms.full_name', 'Họ và tên')} <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder={t('forms.full_name_placeholder', 'Ví dụ: Nguyễn Văn Nam')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t('forms.email', 'Địa chỉ Email')} <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                placeholder={t('forms.email_placeholder', 'namnguyen@example.com')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t('forms.phone', 'Số điện thoại')}
              </label>
              <Input
                placeholder={t('forms.phone_placeholder', '0912 345 678')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t('forms.status', 'Trạng thái tài khoản')}
              </label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as UserStatus)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t('filters.active', 'Hoạt động')}</SelectItem>
                  <SelectItem value="banned">{t('filters.banned', 'Bị khóa')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
              type="submit"
              disabled={loading || !name.trim() || !email.trim()}
              className="h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('forms.save_btn', 'Lưu thay đổi')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

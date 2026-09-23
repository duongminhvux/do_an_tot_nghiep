'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collectionService } from '@/services/vocabulary.service';
import { CollectionItem } from '@/types/vocabulary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteCollectionDialogProps {
  open: boolean;
  collection: CollectionItem | null;
  onOpenChange: (open: boolean) => void;
  onSuccessDeleted?: () => void;
}

export function DeleteCollectionDialog({
  open,
  collection,
  onOpenChange,
  onSuccessDeleted,
}: DeleteCollectionDialogProps) {
  const { t } = useTranslation('vocabulary');
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => collectionService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      setErrorMessage(null);
      onOpenChange(false);
      if (onSuccessDeleted) {
        onSuccessDeleted();
      }
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to delete collection. Please try again.';
      setErrorMessage(msg);
    },
  });

  const handleConfirmDelete = () => {
    if (!collection?._id) return;
    setErrorMessage(null);
    deleteMutation.mutate(collection._id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-6 rounded-2xl border border-slate-200 shadow-2xl bg-white space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>

          <div className="space-y-1.5 flex-1 pr-2">
            <DialogTitle className="text-base font-bold text-slate-900">
              {t('delete_collection_title', { defaultValue: 'Delete Collection' })}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              {t('delete_collection_desc', {
                name: collection?.name || '',
                defaultValue: `Are you sure you want to delete "${collection?.name}"? All lessons inside will be preserved, but the collection will be hidden.`,
              })}
            </DialogDescription>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
          >
            {t('cancel', { defaultValue: 'Cancel' })}
          </button>

          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            {deleteMutation.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            )}
            <span>
              {t('btn_confirm_delete', { defaultValue: 'Confirm Delete' })}
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

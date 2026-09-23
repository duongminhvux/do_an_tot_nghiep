'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { collectionService } from '@/services/vocabulary.service';
import { uploadService } from '@/services/upload.service';
import { CreateCollectionDto } from '@/types/vocabulary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccessCreated?: (id: string) => void;
  defaultOrder?: number;
}

export function CreateCollectionDialog({
  open,
  onOpenChange,
  onSuccessCreated,
  defaultOrder = 1,
}: CreateCollectionDialogProps) {
  const { t } = useTranslation('vocabulary');
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState<number>(defaultOrder > 0 ? defaultOrder : 1);
  const [isActive, setIsActive] = useState(true);
  const [coverUrl, setCoverUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track temporarily uploaded Cloudinary URLs during this session
  const tempUploadedUrls = useRef<Set<string>>(new Set());

  const cleanupTempUploads = () => {
    if (tempUploadedUrls.current.size > 0) {
      tempUploadedUrls.current.forEach((url) => {
        uploadService.deleteFile(url);
      });
      tempUploadedUrls.current.clear();
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (tempUploadedUrls.current.size > 0) {
        tempUploadedUrls.current.forEach((url) => {
          uploadService.deleteFile(url);
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupTempUploads();
    };
  }, []);

  // Sync default order when dialog opens or defaultOrder changes
  useEffect(() => {
    if (open) {
      setOrder(defaultOrder > 0 ? defaultOrder : 1);
    } else {
      cleanupTempUploads();
    }
  }, [open, defaultOrder]);

  const resetForm = (isCancel = false) => {
    if (isCancel) {
      cleanupTempUploads();
    }
    setName('');
    setDescription('');
    setOrder(defaultOrder > 0 ? defaultOrder : 1);
    setIsActive(true);
    setCoverUrl('');
    setErrorMessage(null);
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateCollectionDto) => collectionService.create(data),
    onSuccess: (res: any) => {
      // Clear temp tracking so newly created image is officially kept
      tempUploadedUrls.current.clear();
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      const newId = res?.data?._id;
      if (newId && onSuccessCreated) {
        onSuccessCreated(newId);
      }
      resetForm(false);
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create collection. Please try again.';
      setErrorMessage(msg);
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setErrorMessage(null);
      const res = await uploadService.uploadFile(file);
      if (res?.url) {
        // If replacing previously uploaded image in this session, delete previous image from Cloudinary immediately
        tempUploadedUrls.current.forEach((prevUrl) => {
          if (prevUrl !== res.url) {
            uploadService.deleteFile(prevUrl);
          }
        });
        tempUploadedUrls.current.clear();
        tempUploadedUrls.current.add(res.url);
        setCoverUrl(res.url);
      }
    } catch (err: any) {
      console.error('Image upload failed', err);
      setErrorMessage('Could not upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveCover = () => {
    tempUploadedUrls.current.forEach((url) => {
      uploadService.deleteFile(url);
    });
    tempUploadedUrls.current.clear();
    setCoverUrl('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Collection name is required.');
      return;
    }

    setErrorMessage(null);
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      coverUrl: coverUrl.trim() || undefined,
      order: Number(order) || 0,
      isActive,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm(true);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-xl w-full p-6 rounded-2xl border border-slate-200 shadow-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {t('add_collection', { defaultValue: 'Create New Collection' })}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {t('create_collection_desc', {
                  defaultValue: 'Group lessons and vocabulary words into a structured collection.',
                })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Cover Image Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {t('cover_image', { defaultValue: 'Cover Image (Optional)' })}
            </label>
            <div className="flex items-center gap-4">
              <div className="w-36 aspect-[16/9] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative group shadow-2xs">
                {coverUrl ? (
                  <>
                    <img
                      src={coverUrl}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <ImageIcon className="w-7 h-7 text-slate-400" />
                )}
              </div>

              <div className="space-y-2 flex-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>
                    {isUploading
                      ? t('uploading', { defaultValue: 'Uploading...' })
                      : t('upload_image', { defaultValue: 'Upload Image' })}
                  </span>
                </button>
                <p className="text-[11px] text-slate-400">
                  JPG, PNG, WebP supported.
                </p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('collection_name', { defaultValue: 'Collection Name' })} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oxford 3000, Destination B1"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              {t('description', { defaultValue: 'Description' })}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description or overview of this collection..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 items-start">
            {/* Order */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                {t('order', { defaultValue: 'Display Order' })}
              </label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Math.max(1, Number(e.target.value)))}
                min={1}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* IsActive */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                {t('status', { defaultValue: 'Status' })}
              </label>
              <div className="h-[38px] flex items-center">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    {isActive
                      ? t('active', { defaultValue: 'Active' })
                      : t('inactive', { defaultValue: 'Inactive' })}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                resetForm(true);
                onOpenChange(false);
              }}
              disabled={createMutation.isPending}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
            >
              {t('cancel', { defaultValue: 'Cancel' })}
            </button>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              {createMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              <span>
                {t('create_collection', { defaultValue: 'Create Collection' })}
              </span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

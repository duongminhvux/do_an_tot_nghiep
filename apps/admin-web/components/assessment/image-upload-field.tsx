'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { uploadService } from '@/services/upload.service';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  onUploaded: (url: string) => boolean;
  onBusyChange: (busy: boolean) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function ImageUploadField({ value, onChange, onUploaded, onBusyChange, onError, disabled }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const mountedRef = useRef(true);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const upload = async (file?: File) => {
    if (!file || disabled || uploadingRef.current) return;
    if (!file.type.startsWith('image/')) {
      onError('Vui lòng chọn file ảnh.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      onError('Ảnh không được vượt quá 25 MB.');
      return;
    }
    uploadingRef.current = true;
    setUploading(true);
    onBusyChange(true);
    try {
      const result = await uploadService.uploadFile(file);
      if (!result?.url) throw new Error('Không nhận được URL ảnh sau khi tải lên.');
      if (!mountedRef.current) {
        await uploadService.deleteFile(result.url);
        return;
      }
      if (onUploaded(result.url)) onChange(result.url);
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Không thể tải ảnh lên.';
      onError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      onBusyChange(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
        <ImageIcon className="h-4 w-4 text-blue-600" /> Hình ảnh
      </div>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); void upload(event.dataTransfer.files[0]); }}
        className="rounded border border-dashed border-slate-300 bg-slate-50 p-3"
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" disabled={disabled || uploading}
          onChange={(event) => void upload(event.target.files?.[0])} />
        <button type="button" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Đang tải ảnh lên…' : value ? 'Thay ảnh' : 'Tải ảnh lên'}
        </button>
        <span className="ml-2 text-xs text-slate-500">Hoặc kéo thả ảnh vào đây</span>
      </div>
      <label className="block text-[11px] text-slate-500">
        Hoặc dán URL ảnh
        <input type="url" value={value} disabled={disabled || uploading} onChange={(event) => onChange(event.target.value)}
          placeholder="https://…" className="mt-1 h-9 w-full rounded border border-slate-200 bg-white px-3 text-xs text-slate-800" />
      </label>
      {value && (
        <div className="space-y-2 rounded border border-slate-200 bg-white p-2">
          <img src={value} alt="Ảnh xem trước" className="mx-auto max-h-72 w-auto object-contain" />
          <button type="button" disabled={disabled || uploading} onClick={() => onChange('')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" /> Xoá ảnh
          </button>
        </div>
      )}
    </div>
  );
}

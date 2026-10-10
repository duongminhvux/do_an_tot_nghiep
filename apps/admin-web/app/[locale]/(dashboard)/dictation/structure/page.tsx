'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  FolderPlus,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { dictationService } from '@/services/dictation.service';
import { uploadService } from '@/services/upload.service';
import type { DictationSection, DictationTopic } from '@/types/dictation';

function unwrap<T>(value: any): T {
  return (value?.data ?? value) as T;
}

export default function DictationStructurePage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['dictation-hierarchy'],
    queryFn: () => dictationService.getHierarchy(),
  });
  const topics = unwrap<DictationTopic[]>(data) || [];

  const [topicTitle, setTopicTitle] = useState('');
  const [topicDescription, setTopicDescription] = useState('');
  const [topicOrder, setTopicOrder] = useState(0);
  const [topicImage, setTopicImage] = useState<File | null>(null);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const editingTopic = useMemo(
    () => topics.find((topic) => topic._id === editingTopicId) || null,
    [topics, editingTopicId],
  );

  const resetTopicForm = () => {
    setEditingTopicId(null);
    setTopicTitle('');
    setTopicDescription('');
    setTopicOrder(0);
    setTopicImage(null);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['dictation-hierarchy'] });

  const saveTopicMutation = useMutation({
    mutationFn: async () => {
      if (!topicTitle.trim()) throw new Error('Nhập tên Topic.');
      let thumbnailUrl = editingTopic?.thumbnailUrl || '';
      let thumbnailPublicId = editingTopic?.thumbnailPublicId || '';
      if (topicImage) {
        const uploaded = await uploadService.uploadFile(topicImage);
        thumbnailUrl = uploaded.url;
        thumbnailPublicId = uploaded.public_id;
      }
      const payload = {
        title: topicTitle.trim(),
        description: topicDescription.trim(),
        order: topicOrder,
        thumbnailUrl,
        thumbnailPublicId,
        isActive: editingTopic?.isActive ?? true,
      };
      return editingTopicId
        ? dictationService.updateTopic(editingTopicId, payload)
        : dictationService.createTopic(payload);
    },
    onSuccess: () => {
      setMessage(editingTopicId ? 'Đã cập nhật Topic.' : 'Đã tạo Topic.');
      resetTopicForm();
      refresh();
    },
    onError: (error: any) => setMessage(error?.response?.data?.message || error?.message || 'Không thể lưu Topic.'),
  });

  const removeTopicMutation = useMutation({
    mutationFn: (id: string) => dictationService.removeTopic(id),
    onSuccess: () => refresh(),
    onError: (error: any) => setMessage(error?.response?.data?.message || error?.message || 'Không thể xóa Topic.'),
  });

  const [sectionTopicId, setSectionTopicId] = useState('');
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDescription, setSectionDescription] = useState('');
  const [sectionOrder, setSectionOrder] = useState(0);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  const resetSectionForm = () => {
    setEditingSectionId(null);
    setSectionTitle('');
    setSectionDescription('');
    setSectionOrder(0);
  };

  const saveSectionMutation = useMutation({
    mutationFn: async () => {
      if (!sectionTopicId) throw new Error('Chọn Topic cho Section.');
      if (!sectionTitle.trim()) throw new Error('Nhập tên Section.');
      const payload = {
        topicId: sectionTopicId,
        title: sectionTitle.trim(),
        description: sectionDescription.trim(),
        order: sectionOrder,
        isActive: true,
      };
      return editingSectionId
        ? dictationService.updateSection(editingSectionId, payload)
        : dictationService.createSection(payload);
    },
    onSuccess: () => {
      setMessage(editingSectionId ? 'Đã cập nhật Section.' : 'Đã tạo Section.');
      resetSectionForm();
      refresh();
    },
    onError: (error: any) => setMessage(error?.response?.data?.message || error?.message || 'Không thể lưu Section.'),
  });

  const removeSectionMutation = useMutation({
    mutationFn: (id: string) => dictationService.removeSection(id),
    onSuccess: () => refresh(),
    onError: (error: any) => setMessage(error?.response?.data?.message || error?.message || 'Không thể xóa Section.'),
  });

  const editTopic = (topic: DictationTopic) => {
    setEditingTopicId(topic._id);
    setTopicTitle(topic.title);
    setTopicDescription(topic.description || '');
    setTopicOrder(topic.order || 0);
    setTopicImage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const editSection = (section: DictationSection) => {
    setEditingSectionId(section._id);
    setSectionTopicId(section.topicId);
    setSectionTitle(section.title);
    setSectionDescription(section.description || '');
    setSectionOrder(section.order || 0);
  };

  const submitTopic = (event: FormEvent) => {
    event.preventDefault();
    saveTopicMutation.mutate();
  };
  const submitSection = (event: FormEvent) => {
    event.preventDefault();
    saveSectionMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/dictation`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cấu trúc Dictation</h1>
            <p className="mt-1 text-sm text-slate-500">Quản lý 3 cấp Topic → Section → Lesson. Thumbnail được hiển thị ở thư viện học viên.</p>
          </div>
        </div>

        {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}

        <div className="grid gap-6 xl:grid-cols-2">
          <form onSubmit={submitTopic} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{editingTopicId ? 'Sửa Topic' : 'Tạo Topic'}</h2>
                <p className="mt-1 text-xs text-slate-400">Ảnh nên dùng tỷ lệ vuông hoặc 4:3, nội dung rõ ở kích thước nhỏ.</p>
              </div>
              {editingTopicId && <button type="button" onClick={resetTopicForm} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Hủy sửa</button>}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2 text-xs font-semibold text-slate-600">Tên Topic
                <input value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} placeholder="Conversations" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="sm:col-span-2 text-xs font-semibold text-slate-600">Mô tả
                <textarea value={topicDescription} onChange={(e) => setTopicDescription(e.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-semibold text-slate-600">Thứ tự
                <input type="number" min="0" value={topicOrder} onChange={(e) => setTopicOrder(Number(e.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="cursor-pointer text-xs font-semibold text-slate-600">Thumbnail
                <span className="mt-1.5 flex h-10 items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 font-medium text-slate-500 hover:border-blue-400">
                  <ImagePlus className="h-4 w-4" /> <span className="truncate">{topicImage?.name || (editingTopic?.thumbnailUrl ? 'Thay ảnh hiện tại' : 'Chọn ảnh')}</span>
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setTopicImage(e.target.files?.[0] || null)} />
              </label>
            </div>
            {(topicImage || editingTopic?.thumbnailUrl) && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <img src={topicImage ? URL.createObjectURL(topicImage) : editingTopic?.thumbnailUrl} alt="Topic preview" className="h-40 w-full object-cover" />
              </div>
            )}
            <button type="submit" disabled={saveTopicMutation.isPending || !topicTitle.trim()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {saveTopicMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTopicId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingTopicId ? 'Lưu Topic' : 'Tạo Topic'}
            </button>
          </form>

          <form onSubmit={submitSection} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{editingSectionId ? 'Sửa Section' : 'Tạo Section'}</h2>
                <p className="mt-1 text-xs text-slate-400">Mỗi Lesson phải thuộc đúng một Section.</p>
              </div>
              {editingSectionId && <button type="button" onClick={resetSectionForm} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Hủy sửa</button>}
            </div>
            <div className="mt-4 space-y-4">
              <label className="block text-xs font-semibold text-slate-600">Topic
                <select value={sectionTopicId} onChange={(e) => setSectionTopicId(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                  <option value="">Chọn Topic...</option>
                  {topics.map((topic) => <option key={topic._id} value={topic._id}>{topic.title}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">Tên Section
                <input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="Section 1" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Mô tả
                <textarea value={sectionDescription} onChange={(e) => setSectionDescription(e.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="block text-xs font-semibold text-slate-600">Thứ tự
                <input type="number" min="0" value={sectionOrder} onChange={(e) => setSectionOrder(Number(e.target.value))} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </label>
            </div>
            <button type="submit" disabled={saveSectionMutation.isPending || !sectionTopicId || !sectionTitle.trim()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 px-4 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
              {saveSectionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
              {editingSectionId ? 'Lưu Section' : 'Tạo Section'}
            </button>
          </form>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">Topic & Section hiện tại</h2>
          </div>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải...</div>
          ) : topics.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">Chưa có Topic. Tạo Topic đầu tiên ở phía trên.</div>
          ) : (
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              {topics.map((topic) => (
                <article key={topic._id} className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex gap-4 p-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      {topic.thumbnailUrl ? <img src={topic.thumbnailUrl} alt={topic.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><ImagePlus className="h-6 w-6" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div><h3 className="font-bold text-slate-900">{topic.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{topic.description || 'Chưa có mô tả.'}</p></div>
                        <div className="flex gap-1">
                          <button onClick={() => editTopic(topic)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => window.confirm(`Xóa Topic ${topic.title}?`) && removeTopicMutation.mutate(topic._id)} className="rounded-md p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 bg-slate-50/70 p-3">
                    <div className="space-y-2">
                      {(topic.sections || []).map((section) => (
                        <div key={section._id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div><p className="text-xs font-bold text-slate-700">{section.title}</p><p className="mt-0.5 text-[11px] text-slate-400">{section.lessonCount || 0} lesson · order {section.order}</p></div>
                          <div className="flex gap-1">
                            <button onClick={() => editSection(section)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => window.confirm(`Xóa ${section.title}?`) && removeSectionMutation.mutate(section._id)} className="rounded-md p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                      {(topic.sections || []).length === 0 && <p className="px-2 py-3 text-xs text-slate-400">Topic này chưa có Section.</p>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

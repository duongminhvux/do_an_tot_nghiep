'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Pilcrow,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Minus,
  Undo2,
  Redo2,
  RemoveFormatting,
  PlusCircle,
  Table as TableIcon,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  showToeicBlankHelper?: boolean;
  nextBlankNumber?: number | string;
  onInsertBlank?: (blankNum: string) => void;
  onSyncBlanks?: () => void;
}

export function TiptapEditor({
  value,
  onChange,
  placeholder = 'Nhập nội dung bài đọc tại đây...',
  disabled = false,
  minHeight = '180px',
  showToeicBlankHelper = true,
  nextBlankNumber,
  onInsertBlank,
  onSyncBlanks,
}: TiptapEditorProps) {
  const [blankNum, setBlankNum] = useState<string>(
    nextBlankNumber !== undefined && nextBlankNumber !== null ? String(nextBlankNumber) : '131'
  );
  const [showTableMenu, setShowTableMenu] = useState(false);
  const tableMenuRef = useRef<HTMLDivElement>(null);

  // Sync blankNum when nextBlankNumber prop updates
  useEffect(() => {
    if (nextBlankNumber !== undefined && nextBlankNumber !== null) {
      setBlankNum(String(nextBlankNumber));
    }
  }, [nextBlankNumber]);

  // Close table menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setShowTableMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'tiptap-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          'focus:outline-none p-3.5 text-xs text-slate-800 leading-relaxed font-sans max-w-none',
          'tiptap-content'
        ),
        style: `min-height: ${minHeight};`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // If editor only has empty paragraph, return empty string
      if (html === '<p></p>') {
        onChange('');
      } else {
        onChange(html);
      }
    },
    immediatelyRender: false,
  });

  // Keep editor content in sync when value changes from outside
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  // Keep editable state synced
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  if (!editor) {
    return null;
  }

  // Chèn ô trống dạng TOEIC: ví dụ: _____ [131] _____
  const insertToeicBlank = (numStr?: string) => {
    const targetNum = (numStr || blankNum || '131').trim();
    editor
      .chain()
      .focus()
      .insertContent(` <strong>_____ [${targetNum}] _____</strong> `)
      .run();

    // Gọi callback để đồng bộ tạo câu hỏi con bên dưới
    if (onInsertBlank) {
      onInsertBlank(targetNum);
    }

    // Tự động tăng số câu cho lần chèn tiếp theo
    const parsed = parseInt(targetNum, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      setBlankNum(String(parsed + 1));
    }
  };

  const isParagraphActive =
    editor.isActive('paragraph') &&
    !editor.isActive('heading') &&
    !editor.isActive('bulletList') &&
    !editor.isActive('orderedList') &&
    !editor.isActive('blockquote');

  const isInsideTable = editor.isActive('table');

  return (
    <div className="rounded border border-slate-200 bg-white overflow-hidden shadow-xs focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500/20 transition-all">
      {/* ── Main Toolbar ── */}
      <div className="flex items-center flex-wrap gap-1 p-1.5 bg-slate-50 border-b border-slate-200 text-slate-700 select-none">
        {/* Chữ thường (Paragraph) */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().setParagraph().run()}
          className={cn(
            'px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            isParagraphActive ? 'bg-teal-100 text-teal-800 font-semibold' : 'text-slate-700'
          )}
          title="Chữ thường (Paragraph)"
        >
          <Pilcrow className="h-3.5 w-3.5" />
          <span>Thường</span>
        </button>

        {/* In đậm */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            'px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            editor.isActive('bold') && 'bg-teal-100 text-teal-800 font-bold'
          )}
          title="In đậm (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
          <span>Đậm</span>
        </button>

        {/* In nghiêng */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            'px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            editor.isActive('italic') && 'bg-teal-100 text-teal-800 font-semibold italic'
          )}
          title="In nghiêng (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
          <span>Nghiêng</span>
        </button>

        {/* Gạch chân */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(
            'p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            editor.isActive('underline') && 'bg-teal-100 text-teal-800'
          )}
          title="Gạch chân (Ctrl+U)"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>

        {/* Gạch ngang */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            'p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            editor.isActive('strike') && 'bg-teal-100 text-teal-800'
          )}
          title="Gạch ngang chữ"
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </button>

        <span className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Chèn / Điền Bảng (Table) */}
        <div className="relative inline-block" ref={tableMenuRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowTableMenu((prev) => !prev)}
            className={cn(
              'px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
              isInsideTable ? 'bg-teal-100 text-teal-800 font-bold' : 'text-slate-700'
            )}
            title="Điền bảng / Chèn bảng biểu TOEIC Part 7"
          >
            <TableIcon className="h-3.5 w-3.5 text-teal-700" />
            <span>Điền bảng</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>

          {showTableMenu && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded shadow-lg py-1.5 z-50 text-xs">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                Chọn mẫu bảng biểu
              </div>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                  setShowTableMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-teal-50 hover:text-teal-900 transition cursor-pointer flex items-center justify-between"
              >
                <span>Bảng 3 hàng × 3 cột</span>
                <span className="text-[10px] text-teal-600 bg-teal-50 px-1 py-0.5 rounded border border-teal-200">Tiêu đề</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
                  setShowTableMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-teal-50 hover:text-teal-900 transition cursor-pointer flex items-center justify-between"
              >
                <span>Bảng 2 hàng × 2 cột</span>
                <span className="text-[10px] text-slate-400">Gọn</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run();
                  setShowTableMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-teal-50 hover:text-teal-900 transition cursor-pointer flex items-center justify-between"
              >
                <span>Bảng 4 hàng × 4 cột</span>
                <span className="text-[10px] text-slate-400">Lịch trình</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 5, cols: 2, withHeaderRow: true }).run();
                  setShowTableMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-teal-50 hover:text-teal-900 transition cursor-pointer flex items-center justify-between"
              >
                <span>Bảng 5 hàng × 2 cột</span>
                <span className="text-[10px] text-slate-400">Hóa đơn</span>
              </button>
            </div>
          )}
        </div>

        <span className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Heading 2 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            'p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            editor.isActive('heading', { level: 2 }) && 'bg-teal-100 text-teal-800'
          )}
          title="Tiêu đề lớn (H2)"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </button>

        {/* Heading 3 */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            'p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            editor.isActive('heading', { level: 3 }) && 'bg-teal-100 text-teal-800'
          )}
          title="Tiêu đề vừa (H3)"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </button>

        {/* Bullet List */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            'p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            editor.isActive('bulletList') && 'bg-teal-100 text-teal-800'
          )}
          title="Danh sách dấu đầu dòng"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        {/* Ordered List */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            'p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            editor.isActive('orderedList') && 'bg-teal-100 text-teal-800'
          )}
          title="Danh sách có số thứ tự"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>

        {/* Blockquote */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            'p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
            editor.isActive('blockquote') && 'bg-teal-100 text-teal-800'
          )}
          title="Trích dẫn đoạn văn"
        >
          <Quote className="h-3.5 w-3.5" />
        </button>

        {/* Horizontal Rule */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Thêm đường kẻ phân cách"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <span className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Clear formatting */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-slate-500 hover:text-red-600"
          title="Xóa định dạng"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
        </button>

        {/* Undo */}
        <button
          type="button"
          disabled={disabled || !editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          className="p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Hoàn tác (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>

        {/* Redo */}
        <button
          type="button"
          disabled={disabled || !editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          className="p-1.5 rounded hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title="Làm lại (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        {/* TOEIC Part 6 Blank Helper */}
        {showToeicBlankHelper && (
          <>
            <span className="w-px h-4 bg-slate-200 mx-0.5" />
            <div className="flex items-center gap-1 bg-teal-50/90 border border-teal-200/90 rounded px-1.5 py-0.5 shadow-2xs">
              <button
                type="button"
                disabled={disabled}
                onClick={() => insertToeicBlank()}
                className="text-[11px] font-bold text-teal-800 hover:text-teal-950 inline-flex items-center gap-1 cursor-pointer"
                title={`Chèn ô trống [${blankNum}] vào bài đọc và tự động tạo câu hỏi [${blankNum}] bên dưới`}
              >
                <PlusCircle className="h-3.5 w-3.5 text-teal-600" />
                <span>Chèn ô trống [{blankNum}]</span>
              </button>
              <input
                type="text"
                value={blankNum}
                disabled={disabled}
                onChange={(e) => setBlankNum(e.target.value)}
                className="w-10 h-5 text-[11px] font-bold text-center rounded border border-teal-300 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                title="Số thứ tự câu hỏi cần chèn"
              />
              {onSyncBlanks && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onSyncBlanks}
                  className="text-[10px] text-teal-700 hover:text-teal-950 font-semibold px-1 py-0.5 rounded hover:bg-teal-100 transition cursor-pointer border-l border-teal-200 ml-0.5 pl-1.5"
                  title="Quét lại toàn bộ ô trống [131], [132]... trong bài đọc để đồng bộ danh sách câu hỏi bên dưới"
                >
                  Quét lại
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Contextual Table Toolbar (Hiển thị khi con trỏ ở trong Bảng) ── */}
      {isInsideTable && (
        <div className="flex items-center flex-wrap gap-1 px-2 py-1 bg-teal-50/90 border-b border-teal-200/80 text-[11px] text-teal-950 animate-in fade-in duration-150">
          <span className="font-bold flex items-center gap-1 mr-1 text-teal-800">
            <TableIcon className="h-3.5 w-3.5" /> Thao tác bảng:
          </span>

          {/* Dòng */}
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowBefore().run()}
            className="px-1.5 py-0.5 rounded bg-white hover:bg-teal-100 border border-teal-200 text-slate-700 transition cursor-pointer"
            title="Thêm 1 hàng phía trên"
          >
            + Hàng trên
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="px-1.5 py-0.5 rounded bg-white hover:bg-teal-100 border border-teal-200 text-slate-700 transition cursor-pointer"
            title="Thêm 1 hàng phía dưới"
          >
            + Hàng dưới
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="px-1.5 py-0.5 rounded bg-white hover:bg-red-50 border border-teal-200 text-red-600 transition cursor-pointer"
            title="Xóa hàng đang chọn"
          >
            Xóa hàng
          </button>

          <span className="w-px h-3.5 bg-teal-300 mx-0.5" />

          {/* Cột */}
          <button
            type="button"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className="px-1.5 py-0.5 rounded bg-white hover:bg-teal-100 border border-teal-200 text-slate-700 transition cursor-pointer"
            title="Thêm 1 cột bên trái"
          >
            + Cột trái
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="px-1.5 py-0.5 rounded bg-white hover:bg-teal-100 border border-teal-200 text-slate-700 transition cursor-pointer"
            title="Thêm 1 cột bên phải"
          >
            + Cột phải
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="px-1.5 py-0.5 rounded bg-white hover:bg-red-50 border border-teal-200 text-red-600 transition cursor-pointer"
            title="Xóa cột đang chọn"
          >
            Xóa cột
          </button>

          <span className="w-px h-3.5 bg-teal-300 mx-0.5" />

          {/* Dòng tiêu đề */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            className="px-1.5 py-0.5 rounded bg-white hover:bg-teal-100 border border-teal-200 text-teal-800 font-medium transition cursor-pointer"
            title="Bật / tắt dòng tiêu đề in đậm"
          >
            Dòng tiêu đề
          </button>

          {/* Xóa toàn bộ bảng */}
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 border border-red-300 text-red-700 font-semibold transition cursor-pointer ml-auto flex items-center gap-1"
            title="Xóa toàn bộ bảng biểu này"
          >
            <Trash2 className="h-3 w-3" />
            <span>Xóa bảng</span>
          </button>
        </div>
      )}

      {/* ── Editor Canvas (Trực quan WYSIWYG) ── */}
      <div className="relative bg-white cursor-text" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>

      {/* Helper Footer */}
      <div className="px-3 py-1.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Hỗ trợ in đậm, nghiêng, chữ thường, điền bảng biểu (Part 7) và chèn ô trống (Part 6).</span>
        <span>{value ? value.replace(/<[^>]*>/g, '').length : 0} ký tự</span>
      </div>
    </div>
  );
}

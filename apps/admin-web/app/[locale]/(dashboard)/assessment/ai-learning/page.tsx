"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import apiClient from "@/lib/axios";

type Sample = {
  id: string; jobId: string; number: number; part: number; kind: string; status: string;
  before: unknown; after: unknown; reviewNote?: string;
  provenance: { examId?: string; testNumber?: number; sources?: Record<string, string>; legacyBaseline?: boolean;
    scriptPages?: number[]; sourcePages?: number[]; sourceImages?: { section: string; page: number; imageUrl: string }[] };
};
type Corpus = { counts: Record<string, number>; samples: Sample[]; total: number; queued: number };

export default function LearningPage() {
  const { locale } = useParams<{ locale: string }>();
  const [data, setData] = useState<Corpus>();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const res = await apiClient.get<{ data: Corpus }>("/admin/pdf-ai/learning");
    setData(res.data.data);
  };
  const fail = (e: any) => setError(e.response?.data?.message || e.message || "Không tải được dữ liệu.");
  useEffect(() => { load().catch(fail); }, []);
  const review = async (sample: Sample, status: string) => {
    setBusy(true); setError("");
    try {
      await apiClient.post(`/admin/pdf-ai/learning/${sample.id}/review`, { status, note: notes[sample.id] || "" });
      await load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-6xl space-y-5 p-6">
    <Link href={`/${locale}/assessment/create/ai`} className="text-blue-600">← Tạo đề bằng AI</Link>
    <h1 className="text-2xl font-bold">Dữ liệu sửa lỗi bộ đọc PDF</h1>
    <p>Mỗi lần lưu nội dung đã sửa tạo một mẫu chờ duyệt. Đối chiếu PDF trước khi xác nhận đúng; chỉ mẫu đã xác nhận mới được xuất để kiểm tra bộ đọc. Hệ thống chưa tự huấn luyện lại AI.</p>
    {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</p>}
    {data && <>
      <div className="flex flex-wrap gap-3">
        {[["pending", "Chờ đối chiếu"], ["gold", "Đã xác nhận đúng"], ["rejected", "Đã loại"], ["superseded", "Bản cũ"]].map(([key, label]) =>
          <button key={key} onClick={() => setFilter(key!)} className={`rounded border px-4 py-2 ${filter === key ? "bg-blue-600 text-white" : "bg-white"}`}>{label}: {data.counts[key!] || 0}</button>)}
      </div>
      {data.queued > 0 && <p className="rounded bg-amber-50 p-3">Có {data.queued} lượt sửa đang chờ chuyển sang kho dữ liệu.
        <button disabled={busy} className="ml-3 text-blue-600 underline" onClick={async () => {
          setBusy(true); try { await apiClient.post("/admin/pdf-ai/learning/retry"); await load(); } catch (e) { fail(e); } finally { setBusy(false); }
        }}>Thử chuyển lại</button></p>}
      <p className="text-sm text-slate-500">Hiển thị tối đa 300 mẫu gần nhất trên tổng {data.total} mẫu. PDF được giữ riêng trên máy, không đưa vào thư mục ảnh công khai.</p>
      {!data.samples.some(s => s.status === filter) && <p className="rounded border bg-white p-8">Chưa có mẫu trong mục này. Khi sửa và lưu đề AI, mẫu thay đổi sẽ xuất hiện ở đây.</p>}
      {data.samples.filter(s => s.status === filter).map(s => <article key={s.id} className="space-y-4 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="font-semibold">{s.provenance.testNumber ? `Test ${s.provenance.testNumber} · ` : ""}Part {s.part} · {s.kind === "group" ? "Bài đọc/lời thoại từ câu" : "Câu"} {s.number}</h2>
          {s.provenance.examId && <Link className="text-blue-600" href={`/${locale}/assessment/${s.provenance.examId}?editQuestion=${s.number}`}>Mở câu trong đề</Link>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><h3 className="mb-2 font-medium">Trước khi sửa</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-sm">{JSON.stringify(s.before, null, 2)}</pre></div>
          <div><h3 className="mb-2 font-medium">Sau khi sửa</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-emerald-50 p-3 text-sm">{JSON.stringify(s.after, null, 2)}</pre></div>
        </div>
        <details><summary className="cursor-pointer text-blue-600">Đối chiếu trang PDF nguồn</summary>
          <div className="mt-3 flex max-h-80 flex-wrap gap-3 overflow-auto">
            {(s.provenance.sourceImages || []).filter(p => {
              const wanted = p.section === "SCRIPT" ? s.provenance.scriptPages : s.provenance.sourcePages;
              return wanted?.length ? wanted.includes(p.page) : s.kind === "group" || p.section === "SCRIPT";
            }).map(p => <a key={`${p.section}-${p.page}`} href={p.imageUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600">{p.section} · trang {p.page}</a>)}
          </div>
          {s.provenance.legacyBaseline && <p className="mt-2 text-sm text-amber-700">Lượt cũ: bản đối chiếu là kết quả lưu gần nhất, không bảo đảm là lần đọc đầu tiên.</p>}
        </details>
        {s.reviewNote && <p className="text-sm">Ghi chú đã duyệt: {s.reviewNote}</p>}
        {s.status === "pending" && <>
          <label className="block text-sm">Ghi rõ trang PDF và nội dung đã kiểm tra
            <input className="mt-2 w-full rounded border p-3" value={notes[s.id] || ""} onChange={e => setNotes(v => ({ ...v, [s.id]: e.target.value }))} placeholder="Ví dụ: Đã đối chiếu script trang 8, đủ câu hỏi và A/B/C." />
          </label>
          <div className="flex gap-3">
            <button disabled={busy || (notes[s.id] || "").trim().length < 3} onClick={() => review(s, "gold")} className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-40">Đã đối chiếu PDF · Xác nhận đúng</button>
            <button disabled={busy || (notes[s.id] || "").trim().length < 3} onClick={() => review(s, "rejected")} className="rounded border px-4 py-2 disabled:opacity-40">Loại mẫu này</button>
          </div>
        </>}
      </article>)}
    </>}
  </main>;
}

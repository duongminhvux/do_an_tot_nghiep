"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { ExamItem } from "@/types";
import { examService } from "@/services/assessment.service";
import { ImportQuestionsWizard } from "@/components/assessment/import-questions-wizard";

export default function ImportQuestionsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = String(params.locale || "vi");
  const examId = String(params.id || "");
  const {
    data: exam,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["admin-exam", examId],
    queryFn: async () => (await examService.getById(examId)).data as ExamItem,
    enabled: Boolean(examId),
  });
  const en = locale === "en";
  if (isLoading)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  if (isError || !exam?._id)
    return (
      <div role="alert" className="space-y-3 p-8 text-sm text-red-600">
        <p>
          {en ? "Unable to load the exam." : "Không tải được thông tin đề thi."}
        </p>
        <button onClick={() => void refetch()} className="underline">
          {en ? "Retry" : "Thử lại"}
        </button>
      </div>
    );
  return (
    <div className="w-full min-w-0 max-w-none space-y-6 p-3 sm:p-4">
      <div className="space-y-2">
        <Link
          href={`/${locale}/assessment/${examId}`}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          {en ? "Return to exam" : "Quay về đề thi"}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">
          {en ? "Import questions" : "Import câu hỏi"}
        </h1>
        <p className="text-sm text-slate-500">{exam.name}</p>
      </div>
      <ImportQuestionsWizard
        key={examId}
        exam={exam}
        locale={locale}
        onSuccess={() => router.push(`/${locale}/assessment/${examId}`)}
      />
    </div>
  );
}

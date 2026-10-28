"use client";
import { useListPagination } from '@/hooks/use-list-pagination';
import { ListPagination } from '@/components/ui/list-pagination';
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { getMistakeStatistics } from "@/services/mistakes.service";
export default function MistakeStatisticsPage() {
  const { t } = useTranslation("common");
  const query = useQuery({
    queryKey: ["mistake-statistics"],
    queryFn: getMistakeStatistics,
  });
  const mistakePage = useListPagination(query.data?.items ?? [], '');
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">{t("mistakes.adminTitle")}</h1>
      <p className="text-sm text-slate-500">{t("mistakes.adminDescription")}</p>
      {query.isPending && (
        <div
          role="status"
          aria-label={t("mistakes.loading")}
          className="h-72 animate-pulse rounded-xl bg-slate-100"
        />
      )}
      {query.isError && (
        <div role="alert">
          <p>{t("mistakes.error")}</p>
          <Button onClick={() => void query.refetch()}>
            {t("mistakes.retry")}
          </Button>
        </div>
      )}
      {query.data && (
        <>
          <p className="text-sm">
            {t("mistakes.threshold", { count: query.data.minimumLearners })}
          </p>
          {!query.data.items.length ? (
            <p className="rounded-xl border bg-white p-8">
              {t("mistakes.adminEmpty")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "source",
                      "content",
                      "learners",
                      "samples",
                      "errors",
                      "rate",
                    ].map((key) => (
                      <th key={key} className="p-3">
                        {t(`mistakes.${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mistakePage.items.map((item) => (
                    <tr
                      key={`${item.sourceType}:${item.sourceItemId}`}
                      className="border-t"
                    >
                      <td className="p-3">
                        {t(`mistakes.${item.sourceType}`)}
                      </td>
                      <td className="max-w-64 break-all p-3 font-mono text-xs">
                        {item.title}
                        <span className="mt-1 block text-slate-400">
                          {item.sourceItemId}
                        </span>
                      </td>
                      <td className="p-3">{item.learners}</td>
                      <td className="p-3">{item.samples}</td>
                      <td className="p-3">{item.wrongCount}</td>
                      <td className="p-3">{item.errorRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ListPagination pagination={mistakePage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { CheckCircle2, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
export function ResultSummary({
  score,
  passed,
  threshold,
  detail,
}: {
  score: number;
  passed: boolean;
  threshold: number;
  detail: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 ${passed ? "border-green-200 bg-gradient-to-br from-green-50 to-white" : "border-red-200 bg-gradient-to-br from-red-50 to-white"}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {passed ? (
              <CheckCircle2 className="size-6 text-green-600" />
            ) : (
              <XCircle className="size-6 text-red-600" />
            )}
            <StatusBadge status={passed ? "TARGET MET" : "KEEP PRACTICING"} />
          </div>
          <h2 className="mt-4 text-4xl font-extrabold">
            Practice score: {score}%
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Exercise target: {threshold}% • {detail}
          </p>
        </div>
        <div
          className={`grid size-20 place-items-center rounded-full border-8 ${passed ? "border-green-500 text-green-700" : "border-red-500 text-red-700"}`}
        >
          <strong>{score}%</strong>
        </div>
      </div>
    </div>
  );
}

import { Check, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase(); const success = ["PASS", "COMPLETED", "ACTIVE"].includes(normalized); const danger = ["FAIL", "BLOCKED", "ERROR"].includes(normalized);
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide", success && "bg-green-100 text-green-700", danger && "bg-red-100 text-red-700", !success && !danger && "bg-blue-50 text-blue-700")}>{success && <Check className="size-3" />}{danger && <X className="size-3" />}{normalized === "LOCKED" && <Lock className="size-3" />}{normalized}</span>;
}

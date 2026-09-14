import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" };
export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return <button className={cn("inline-flex min-h-10 items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", variant === "primary" && "bg-blue-600 text-white shadow-sm hover:bg-blue-700", variant === "secondary" && "border border-blue-200 bg-white text-blue-700 hover:bg-blue-50", variant === "ghost" && "text-slate-600 hover:bg-slate-100", variant === "danger" && "bg-red-600 text-white hover:bg-red-700", size === "sm" && "px-3 py-2 text-sm", size === "md" && "px-4 py-2.5 text-sm", size === "lg" && "px-5 py-3 text-base", className)} {...props} />;
}

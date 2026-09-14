import { AudioLines } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) { return <Link href="/" aria-label="ListenUp home" className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight text-blue-700", className)}><span className="grid size-9 place-items-center rounded-lg bg-blue-50"><AudioLines className="size-5" /></span>{!compact && <span className="text-lg">ListenUp</span>}</Link>; }

import {
  BookOpen,
  FileCheck2,
  Gamepad2,
  Headphones,
  Swords,
  type LucideIcon,
} from "lucide-react";
import type { TFunction } from "i18next";
import type { LearningModule } from "@/services/learning-activity.service";

export const MODULES: LearningModule[] = [
  "VOCABULARY",
  "DICTATION",
  "TOEIC",
  "ARENA",
  "MINIGAME",
];

export const MODULE_META: Record<
  LearningModule,
  { icon: LucideIcon; tone: string; href: string }
> = {
  VOCABULARY: {
    icon: BookOpen,
    tone: "bg-blue-50 text-blue-600",
    href: "/vocabulary",
  },
  DICTATION: {
    icon: Headphones,
    tone: "bg-violet-50 text-violet-600",
    href: "/dictation",
  },
  TOEIC: {
    icon: FileCheck2,
    tone: "bg-emerald-50 text-emerald-600",
    href: "/toeic",
  },
  ARENA: { icon: Swords, tone: "bg-orange-50 text-orange-600", href: "/arena" },
  MINIGAME: {
    icon: Gamepad2,
    tone: "bg-pink-50 text-pink-600",
    href: "/games",
  },
};

export function moduleName(t: TFunction, module: LearningModule) {
  return t(`modules.${module.toLowerCase()}.name`);
}

/** "1 giờ 5 phút" / "12 phút" / "0 phút". */
export function formatStudyTime(t: TFunction, seconds = 0) {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? t("time.hours_minutes", { h, m }) : t("time.minutes", { m });
}

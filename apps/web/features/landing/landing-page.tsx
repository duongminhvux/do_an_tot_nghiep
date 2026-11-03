"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  Gamepad2,
  Headphones,
  Menu,
  Swords,
  Target,
  TrendingUp,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  normalizeLandingPageSettings,
  type LandingImageKey,
  type LandingPageSettings,
} from "@repo/shared-types/landing-page";
import { landingPageService } from "@/services/landing-page.service";
import { useSiteSettings } from "@/providers/site-settings-provider";
import { useAppSelector } from "@/redux/hooks";
import { SiteLogo } from "@/components/site-logo";
import LanguageSwitcher from "@/components/language-switcher";
import { StudyArtwork } from "@/components/study-artwork";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DictationPreview,
  FlashcardPreview,
  HeroChips,
  LandingImage,
} from "./landing-visuals";

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

type FeatureKey = "vocabulary" | "toeic" | "dictation" | "games" | "arena";
const FEATURES: Record<
  FeatureKey,
  { icon: LucideIcon; tone: string; href: string; image: LandingImageKey; fallback: ReactNode }
> = {
  vocabulary: {
    icon: BookOpen,
    tone: "bg-blue-50 text-blue-600",
    href: "/vocabulary",
    image: "vocabularyImageUrl",
    fallback: <ArtworkFallback kind="books" />,
  },
  toeic: {
    icon: FileCheck2,
    tone: "bg-emerald-50 text-emerald-600",
    href: "/toeic",
    image: "toeicImageUrl",
    fallback: <ArtworkFallback kind="exam" />,
  },
  dictation: {
    icon: Headphones,
    tone: "bg-violet-50 text-violet-600",
    href: "/dictation",
    image: "dictationImageUrl",
    fallback: <DictationPreview />,
  },
  games: {
    icon: Gamepad2,
    tone: "bg-pink-50 text-pink-600",
    href: "/games",
    image: "gamesImageUrl",
    fallback: <ArtworkFallback kind="games" />,
  },
  arena: {
    icon: Swords,
    tone: "bg-orange-50 text-orange-600",
    href: "/arena",
    image: "arenaImageUrl",
    fallback: (
      <img
        src="/images/arena/arena-hero.svg"
        alt=""
        aria-hidden
        className="h-full w-full bg-blue-50/60 object-contain p-4"
      />
    ),
  },
};
const ORDER: FeatureKey[] = ["vocabulary", "toeic", "dictation", "games", "arena"];

function ArtworkFallback({ kind }: { kind: "books" | "exam" | "games" }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#eff6ff]">
      <StudyArtwork kind={kind} className="h-full w-full" />
    </div>
  );
}

export function LandingPage({ initialImages }: { initialImages: LandingPageSettings }) {
  const { t } = useTranslation("landing");
  const params = useParams();
  const locale = (params?.locale as string) === "en" ? "en" : "vi";
  const settings = useSiteSettings();
  const { isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);
  const signedIn = isInitialized && isAuthenticated;
  const query = useQuery({
    queryKey: ["landing-page"],
    queryFn: landingPageService.read,
    initialData: initialImages,
    staleTime: 60_000,
  });
  const images = normalizeLandingPageSettings(query.data);
  const href = (path: string) => `/${locale}${path}`;
  // Signed-out visitors are invited to register; members go straight to the module.
  const moduleHref = (path: string) => (signedIn ? href(path) : href("/register"));

  return (
    <div className="landing-root flex min-h-dvh w-full flex-col bg-white text-slate-900">
      <LandingHeader href={href} signedIn={signedIn} />

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-100">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)] opacity-60"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-blue-400/15 blur-3xl"
          />
          <div className={cn(container, "relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24")}>
            <div className="animate-in fade-in slide-in-from-bottom-2 [--tw-duration:500ms]">
              <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {t("hero.eyebrow")}
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.5rem]">
                {t("hero.titleStart")}{" "}
                <span className="relative whitespace-nowrap text-blue-600">
                  {t("hero.titleHighlight")}
                  <svg
                    aria-hidden
                    viewBox="0 0 300 12"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1.5 left-0 h-2.5 w-full text-blue-200"
                  >
                    <path d="M2 9c60-6 180-9 296-3" stroke="currentColor" strokeWidth="6" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
                {t("hero.titleEnd")}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {t("hero.subtitle")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {signedIn ? (
                  <Button asChild size="lg" className="h-12 px-7 text-base">
                    <Link href={href("")}>
                      {t("hero.continue")}
                      <ArrowRight />
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg" className="h-12 px-7 text-base shadow-md shadow-blue-600/20">
                      <Link href={href("/register")}>
                        {t("hero.primary")}
                        <ArrowRight />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
                      <Link href={href("/login")}>{t("hero.secondary")}</Link>
                    </Button>
                  </>
                )}
              </div>
              <ul className="mt-8 flex flex-col gap-x-6 gap-y-2.5 text-sm font-medium text-slate-600 sm:flex-row sm:flex-wrap">
                {(["point1", "point2", "point3"] as const).map((key) => (
                  <li key={key} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                    {t(`hero.${key}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative mx-auto w-full max-w-xl animate-in fade-in zoom-in-95 [--tw-duration:600ms] lg:max-w-none">
              <LandingImage
                eager
                src={images.heroImageUrl}
                alt={t("hero.imageAlt")}
                fallback={<FlashcardPreview />}
                className="aspect-[4/3] rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-blue-900/10"
              />
              <HeroChips />
            </div>
          </div>
        </section>

        {/* Module shortcuts */}
        <nav aria-label={t("features.eyebrow")} className="border-b border-slate-100 bg-white">
          <ul className={cn(container, "flex gap-2 overflow-x-auto py-4 scrollbar-none sm:justify-center sm:gap-3")}>
            {ORDER.map((key) => {
              const { icon: Icon, tone } = FEATURES[key];
              return (
                <li key={key} className="shrink-0">
                  <a
                    href={`#feature-${key}`}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className={cn("flex size-7 items-center justify-center rounded-full", tone)}>
                      <Icon className="size-3.5" />
                    </span>
                    {t(`features.${key}.tag`)}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Features */}
        <section id="features" className="py-16 sm:py-24">
          <div className={container}>
            <SectionHeading
              eyebrow={t("features.eyebrow")}
              title={t("features.title")}
              subtitle={t("features.subtitle")}
            />
            <div className="mt-14 space-y-20 sm:mt-20 sm:space-y-28">
              {(["vocabulary", "toeic", "dictation"] as const).map((key, index) => {
                const feature = FEATURES[key];
                const Icon = feature.icon;
                return (
                  <article
                    key={key}
                    id={`feature-${key}`}
                    className="grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16"
                  >
                    <LandingImage
                      src={images[feature.image]}
                      alt={t(`features.${key}.imageAlt`)}
                      fallback={feature.fallback}
                      className={cn(
                        "aspect-[4/3] rounded-2xl border border-slate-200 bg-slate-50 shadow-lg shadow-slate-900/5",
                        index % 2 === 1 && "lg:order-2",
                      )}
                    />
                    <div className="max-w-xl">
                      <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide", feature.tone)}>
                        <Icon className="size-3.5" />
                        {t(`features.${key}.tag`)}
                      </span>
                      <h3 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
                        {t(`features.${key}.title`)}
                      </h3>
                      <p className="mt-4 text-base leading-relaxed text-slate-600">
                        {t(`features.${key}.body`)}
                      </p>
                      <ul className="mt-6 space-y-3">
                        {(["point1", "point2", "point3"] as const).map((point) => (
                          <li key={point} className="flex items-start gap-3 text-[15px] text-slate-700">
                            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-blue-600" />
                            {t(`features.${key}.${point}`)}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={moduleHref(feature.href)}
                        className="group mt-7 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        {t("features.explore")}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-20 grid gap-6 sm:mt-28 md:grid-cols-2">
              {(["games", "arena"] as const).map((key) => {
                const feature = FEATURES[key];
                const Icon = feature.icon;
                return (
                  <article
                    key={key}
                    id={`feature-${key}`}
                    className="group flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg hover:shadow-slate-900/5"
                  >
                    <LandingImage
                      src={images[feature.image]}
                      alt={t(`features.${key}.imageAlt`)}
                      fallback={feature.fallback}
                      className="aspect-[16/10] border-b border-slate-100 bg-slate-50"
                    />
                    <div className="flex flex-1 flex-col p-6 sm:p-7">
                      <span className={cn("inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide", feature.tone)}>
                        <Icon className="size-3.5" />
                        {t(`features.${key}.tag`)}
                      </span>
                      <h3 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">
                        {t(`features.${key}.title`)}
                      </h3>
                      <p className="mt-3 flex-1 text-[15px] leading-relaxed text-slate-600">
                        {t(`features.${key}.body`)}
                      </p>
                      <Link
                        href={moduleHref(feature.href)}
                        className="mt-6 inline-flex w-fit items-center gap-1.5 rounded text-sm font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      >
                        {t("features.explore")}
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-16 border-y border-slate-100 bg-slate-50 py-16 sm:py-24">
          <div className={container}>
            <SectionHeading eyebrow={t("how.eyebrow")} title={t("how.title")} />
            <div className="relative mt-14">
            <div aria-hidden className="absolute left-[16.66%] right-[16.66%] top-7 hidden border-t-2 border-dashed border-blue-200 md:block" />
            <ol className="relative grid gap-10 md:grid-cols-3 md:gap-6">
              {([
                { key: "step1", icon: UserPlus },
                { key: "step2", icon: Target },
                { key: "step3", icon: TrendingUp },
              ] as const).map(({ key, icon: Icon }, index) => (
                <li key={key} className="relative flex flex-col items-center text-center">
                  <span className="relative flex size-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                    <Icon className="size-6" />
                    <span className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border-2 border-slate-50 bg-white text-xs font-bold text-blue-700">
                      {index + 1}
                    </span>
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">{t(`how.${key}Title`)}</h3>
                  <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-slate-600">
                    {t(`how.${key}Body`)}
                  </p>
                </li>
              ))}
            </ol>
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="py-16 sm:py-24">
          <div className={container}>
            <div className="relative overflow-hidden rounded-3xl bg-blue-600 px-6 py-14 text-center sm:px-12 sm:py-16">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.18)_1px,transparent_0)] [background-size:22px_22px]"
              />
              <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-indigo-400/40 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-sky-300/30 blur-3xl" />
              <div className="relative mx-auto max-w-2xl">
                <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  {t("cta.title")}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-blue-100 sm:text-lg">
                  {t("cta.subtitle")}
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  {signedIn ? (
                    <Button asChild size="lg" className="h-12 bg-white px-7 text-base text-blue-700 hover:bg-blue-50">
                      <Link href={href("")}>
                        {t("hero.continue")}
                        <ArrowRight />
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild size="lg" className="h-12 bg-white px-7 text-base text-blue-700 hover:bg-blue-50 focus-visible:ring-white focus-visible:ring-offset-blue-600">
                        <Link href={href("/register")}>
                          {t("cta.primary")}
                          <ArrowRight />
                        </Link>
                      </Button>
                      <Button asChild size="lg" variant="ghost" className="h-12 border border-white/40 px-7 text-base text-white hover:bg-white/10 hover:text-white focus-visible:ring-white focus-visible:ring-offset-blue-600">
                        <Link href={href("/login")}>{t("cta.secondary")}</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 bg-white">
        <div className={cn(container, "flex flex-col items-center justify-between gap-4 py-8 text-center sm:flex-row sm:text-left")}>
          <div className="flex items-center gap-3">
            <Brand />
            {settings.siteDescription && (
              <p className="hidden max-w-sm text-sm text-slate-500 lg:block">{settings.siteDescription}</p>
            )}
          </div>
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} {settings.siteName}. {t("footer.rights")}
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-blue-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{subtitle}</p>}
    </div>
  );
}

function Brand() {
  const settings = useSiteSettings();
  return (
    <span className="flex items-center gap-2">
      <SiteLogo
        className="h-8 max-w-40"
        fallback={
          <>
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-extrabold text-white">
              {settings.siteName.charAt(0).toUpperCase()}
            </span>
            <span className="text-base font-bold tracking-tight text-slate-900">{settings.siteName}</span>
          </>
        }
      />
    </span>
  );
}

function LandingHeader({ href, signedIn }: { href: (path: string) => string; signedIn: boolean }) {
  const { t } = useTranslation("landing");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const links = [
    { href: "#features", label: t("nav.features") },
    { href: "#how", label: t("nav.how") },
  ];
  const actions = signedIn ? (
    <Button asChild>
      <Link href={href("")}>
        {t("nav.dashboard")}
        <ArrowRight />
      </Link>
    </Button>
  ) : (
    <>
      <Button asChild variant="ghost">
        <Link href={href("/login")}>{t("nav.login")}</Link>
      </Button>
      <Button asChild>
        <Link href={href("/register")}>{t("nav.register")}</Link>
      </Button>
    </>
  );
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-white/85 backdrop-blur-md transition-colors",
        scrolled || open ? "border-slate-200" : "border-transparent",
      )}
    >
      <div className={cn(container, "flex h-16 items-center justify-between gap-4")}>
        <Link href={href("/welcome")} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Brand />
        </Link>
        <nav aria-label={t("nav.main")} className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          {actions}
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="landing-mobile-menu"
          aria-label={open ? t("nav.close") : t("nav.menu")}
          className="flex size-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div id="landing-mobile-menu" className="border-t border-slate-100 bg-white md:hidden">
          <div className={cn(container, "space-y-4 py-4")}>
            <nav aria-label={t("nav.main")} className="flex flex-col">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="flex flex-col gap-2 [&>a]:h-11 [&>a]:w-full">{actions}</div>
            <div className="flex justify-center pt-1">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  CirclePlay,
  Headphones,
  Mic2,
  Play,
  Quote,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { Button } from "@/components/ui/button";
import { CourseCard } from "@/components/course/course-card";
import { publicApi } from "@/lib/api/client";
import { LoadingSkeleton } from "@/components/ui/states";
import { useState } from "react";

const features = [
  {
    icon: Mic2,
    title: "Dictation Practice",
    text: "Train your ear and spelling with precise feedback.",
  },
  {
    icon: Target,
    title: "TOEIC Practice",
    text: "Build test confidence with realistic listening sets.",
  },
  {
    icon: Headphones,
    title: "Audio Lessons",
    text: "Learn with focused, high-quality listening lessons.",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    text: "See your accuracy, habits, and growth at a glance.",
  },
];
const steps = [
  {
    n: "1",
    title: "Choose a course",
    text: "Pick a path that matches your goal.",
  },
  {
    n: "2",
    title: "Listen & practice",
    text: "Replay, dictate, and answer questions.",
  },
  { n: "3", title: "Test & improve", text: "Use feedback to fix weak spots." },
  {
    n: "4",
    title: "Track progress",
    text: "Build a streak and celebrate wins.",
  },
];
const faqs = [
  {
    q: "What is ListenUp?",
    a: "ListenUp is a focused English listening platform combining lessons, dictation, and TOEIC practice.",
  },
  {
    q: "How does dictation practice work?",
    a: "Listen to a short recording, type what you hear, and get clear word-level feedback.",
  },
  {
    q: "Is this good for TOEIC preparation?",
    a: "Yes. Practice supports TOEIC Listening Parts 1–4 with grouped questions and explanations.",
  },
  {
    q: "Can I track my progress?",
    a: "Your dashboard tracks lesson completion, listening accuracy, goals, and streaks.",
  },
];

export function LandingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-landing"],
    queryFn: publicApi.getLandingData,
    staleTime: 5 * 60 * 1000,
  });
  const hero = data?.sections.find(
    (section) => section.type === "HERO",
  )?.content;
  const heroTitle =
    typeof hero?.title === "string"
      ? hero.title
      : "Practice English Listening Smarter. Every Day.";
  const heroDescription =
    typeof hero?.description === "string"
      ? hero.description
      : "Build listening confidence with engaging audio, guided dictation, and TOEIC practice designed for real progress.";
  const [openFaq, setOpenFaq] = useState(0);
  return (
    <div className="bg-white">
      <PublicHeader />
      <main>
        <section className="relative overflow-hidden border-b border-slate-100">
          <div className="grid-dots absolute right-0 top-0 h-full w-1/2 opacity-40" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 md:px-6 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
                <Sparkles className="size-4" />
                Make every listen count
              </div>
              <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-[-.04em] text-slate-950 sm:text-5xl lg:text-[58px]">
                {heroTitle}
              </h1>
              <p className="mt-6 max-w-xl text-lg text-slate-600">
                {heroDescription}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register">
                  <Button size="lg">
                    Start Listening Now <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href="#courses">
                  <Button size="lg" variant="secondary">
                    Explore Courses
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-4">
                <div className="flex -space-x-2">
                  {["A", "M", "J", "K"].map((letter, i) => (
                    <span
                      key={letter}
                      className="grid size-9 place-items-center rounded-full border-2 border-white bg-gradient-to-br from-blue-100 to-amber-200 text-xs font-bold"
                      style={{ zIndex: 4 - i }}
                    >
                      {letter}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-slate-500">
                  A static preview of the listening experience
                </p>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl pb-8">
              <div className="hero-photo min-h-[410px] rounded-[28px] shadow-[0_30px_80px_rgba(15,42,102,.18)]" />
              <div className="surface absolute -left-4 top-8 w-[82%] p-4 shadow-xl sm:-left-10">
                <p className="text-xs font-semibold text-slate-400">
                  NOW PLAYING
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">Hiring Conversation</h3>
                    <p className="text-sm text-slate-500">
                      At the expert level
                    </p>
                  </div>
                  <button
                    disabled
                    title="Preview audio is not available."
                    className="grid size-11 place-items-center rounded-full bg-slate-300 text-white"
                    aria-label="Preview audio unavailable"
                  >
                    <Play className="size-4 fill-current" />
                  </button>
                </div>
                <div className="wave mt-4 h-8" />
              </div>
              <div className="surface absolute -bottom-1 right-1 w-64 p-5 shadow-xl sm:-right-7">
                <p className="text-xs font-semibold text-slate-500">
                  SAMPLE LISTENING SCORE
                </p>
                <div className="mt-1 flex items-end justify-between">
                  <strong className="text-4xl">87%</strong>
                  <svg viewBox="0 0 100 45" className="w-28">
                    <path
                      d="M2 41 C15 38 15 20 27 25 S40 33 49 18 S62 28 72 16 S83 8 98 2"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                    />
                    <path
                      d="M2 41 C15 38 15 20 27 25 S40 33 49 18 S62 28 72 16 S83 8 98 2 V45 H2Z"
                      fill="#eff6ff"
                    />
                  </svg>
                </div>
                <p className="mt-2 text-xs font-semibold text-green-600">
                  Example progress preview
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="courses" className="mx-auto max-w-7xl px-5 py-16 md:px-6">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <p className="text-sm font-bold text-blue-600">LEARN YOUR WAY</p>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight">
                Featured Courses
              </h2>
            </div>
            <Link
              href="/login?next=/app/courses"
              className="hidden items-center gap-1 text-sm font-bold text-blue-600 sm:flex"
            >
              View all courses <ArrowRight className="size-4" />
            </Link>
          </div>
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              {data?.courses.map((course) => (
                <CourseCard key={course.id} course={course} publicView />
              ))}
            </div>
          )}
        </section>
        <section className="bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-12 sm:grid-cols-2 md:px-6 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="surface p-5">
                <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section
          id="how-it-works"
          className="mx-auto max-w-7xl px-5 py-16 md:px-6"
        >
          <p className="text-sm font-bold text-blue-600">A SIMPLE ROUTINE</p>
          <h2 className="mt-1 text-3xl font-extrabold">How It Works</h2>
          <div className="mt-9 grid gap-8 md:grid-cols-4">
            {steps.map((step, index) => (
              <div className="relative" key={step.n}>
                <div className="flex items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-100 text-lg font-extrabold text-blue-700">
                    {step.n}
                  </span>
                  {index < 3 && (
                    <div className="hidden h-px flex-1 bg-slate-200 md:block" />
                  )}
                </div>
                <h3 className="mt-4 font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{step.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="pb-18 mx-auto grid max-w-7xl gap-5 px-5 md:grid-cols-[1.2fr_.8fr] md:px-6">
          <div className="surface p-5 md:p-7">
            <div className="flex items-center gap-2">
              <CirclePlay className="size-5 text-blue-600" />
              <h2 className="text-xl font-bold">Try a Demo Dictation</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to practice with published audio and receive real
              word-by-word feedback from a complete dictation exercise.
            </p>
            <Link href="/login?next=/app/courses" className="mt-5 inline-flex">
              <Button>
                Open listening practice <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
          <div className="surface p-5 md:p-7">
            <h2 className="text-xl font-bold">FAQ</h2>
            <div className="mt-4 divide-y divide-slate-200">
              {faqs.map((faq, index) => (
                <div key={faq.q}>
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                    className="min-h-13 flex w-full items-center justify-between py-3 text-left text-sm font-semibold"
                    aria-expanded={openFaq === index}
                  >
                    {faq.q}
                    <ChevronDown
                      className={`size-4 transition ${openFaq === index ? "rotate-180" : ""}`}
                    />
                  </button>
                  {openFaq === index && (
                    <p className="pb-4 text-sm text-slate-500">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-blue-50 p-5">
              <Quote className="size-5 text-blue-600" />
              <p className="mt-2 text-sm text-slate-700">
                “The short daily sessions made business calls much easier to
                follow.”
              </p>
              <p className="mt-2 text-xs font-bold text-blue-700">
                — Mina, B2 learner
              </p>
            </div>
          </div>
        </section>
        <section className="bg-blue-600">
          <div className="mx-auto flex max-w-5xl flex-col items-center px-5 py-14 text-center text-white">
            <Users className="size-9" />
            <h2 className="mt-4 text-3xl font-extrabold">
              Ready to hear your progress?
            </h2>
            <p className="mt-2 text-blue-100">
              Join thousands of learners building listening confidence every
              day.
            </p>
            <Link href="/register" className="mt-6">
              <Button
                className="bg-white text-blue-700 hover:bg-blue-50"
                size="lg"
              >
                Create your free account
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

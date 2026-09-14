"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  BarChart3,
  BookCheck,
  Clock3,
  Flame,
  MoreVertical,
  Play,
  TrendingUp,
} from "lucide-react";
import { dashboardApi } from "@/lib/api/client";
import { ErrorState, LoadingSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { CourseVisual } from "@/components/course/course-visual";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CourseCard } from "@/components/course/course-card";
import { format } from "date-fns";
const icons = [BookCheck, Clock3, BarChart3, Flame];
export function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get,
  });
  if (query.isLoading) return <LoadingSkeleton rows={5} />;
  if (query.error || !query.data)
    return (
      <ErrorState
        message="Dashboard data is temporarily unavailable."
        onRetry={() => query.refetch()}
      />
    );
  const d = query.data;
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          Welcome back, {d.userName}! <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Let’s continue your learning journey.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {d.stats.map((stat, index) => {
          const Icon = icons[index];
          return (
            <div key={stat.label} className="surface p-5">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="size-5" />
                </span>
                <TrendingUp className="size-4 text-green-500" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-500">
                {stat.label}
              </p>
              <strong className="mt-1 block text-2xl">{stat.value}</strong>
              <span className="text-xs font-semibold text-green-600">
                {stat.change}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <section className="surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Continue Learning</h2>
            <MoreVertical className="size-4 text-slate-400" />
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr]">
            <CourseVisual
              theme={d.continueLearning.theme}
              className="min-h-40"
            />
            <div className="flex flex-col">
              <span className="w-fit rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                {d.continueLearning.category}
              </span>
              <h3 className="mt-3 text-lg font-bold">
                {d.continueLearning.lessonTitle}
              </h3>
              <p className="text-sm text-slate-500">
                Lesson 3 • {d.continueLearning.duration} min
              </p>
              <div className="mt-auto pt-5">
                <div className="mb-2 flex justify-between text-xs font-semibold">
                  <span>Course progress</span>
                  <span>{d.continueLearning.progress}%</span>
                </div>
                <ProgressBar value={d.continueLearning.progress} />
                <Link
                  href={`/app/courses/${d.continueLearning.courseSlug}/lessons/${d.continueLearning.lessonSlug}`}
                >
                  <Button className="mt-4 w-full sm:float-right sm:w-auto">
                    <Play className="size-4 fill-current" />
                    Continue
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="surface min-h-80 p-5">
          <h2 className="font-bold">7-Day Progress</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={d.weeklyProgress}
                margin={{ left: -20, right: 6 }}
              >
                <defs>
                  <linearGradient id="blueArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#blueArea)"
                  dot={{
                    r: 4,
                    fill: "#2563eb",
                    stroke: "white",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="mt-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">My Courses</h2>
          <Link href="/app/courses" className="text-sm font-bold text-blue-600">
            View all
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {d.courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </section>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="surface p-5">
          <div className="flex justify-between">
            <h2 className="font-bold">Recent Activity</h2>
            <Link
              href="/app/history"
              className="text-xs font-bold text-blue-600"
            >
              View all
            </Link>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {d.recentActivity.length ? (
              d.recentActivity.map((item) => (
                <Link
                  href={`/app/exercises/${item.exerciseId}/results/${item.attemptId}`}
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {item.exerciseTitle}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(item.submittedAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${item.passed ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                  >
                    {item.score}%
                  </span>
                </Link>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                No activity yet
              </p>
            )}
          </div>
        </section>
        <section className="surface p-5">
          <h2 className="font-bold">Weekly Goal</h2>
          <div className="grid place-items-center py-5">
            <div
              className="relative grid size-36 place-items-center rounded-full"
              style={{
                background: `conic-gradient(#2563eb ${d.weeklyGoal * 3.6}deg, #e2e8f0 0)`,
              }}
            >
              <div className="grid size-28 place-items-center rounded-full bg-white text-center">
                <div>
                  <strong className="text-2xl">{d.weeklyGoal}%</strong>
                  <p className="text-xs text-slate-500">
                    {Math.round((d.weeklyGoal / 100) * 7)} / 7 active days
                  </p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-sm font-semibold text-blue-600">
            Based on submitted attempts in the last 7 days.
          </p>
        </section>
        <section className="surface p-5">
          <h2 className="font-bold">Listening Streak</h2>
          <div className="mt-5 grid grid-cols-7 gap-2">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
              <span
                key={`${day}-${i}`}
                className="text-center text-xs font-bold text-slate-400"
              >
                {day}
              </span>
            ))}
            {d.streak.map((active, i) => (
              <span
                key={i}
                className={`grid aspect-square place-items-center rounded-full text-xs font-bold ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Flame className="size-5 text-orange-500" />
            <strong>{d.streakDays} days</strong>
            <span className="text-sm text-slate-500">current streak</span>
          </div>
        </section>
      </div>
      <section className="surface mt-5 p-5">
        <div className="flex items-center gap-2">
          <Award className="size-5 text-amber-500" />
          <h2 className="font-bold">Achievements</h2>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {d.achievements.map((item) => (
            <div
              key={item.title}
              className={`flex items-center gap-4 rounded-xl p-4 ${item.tone === "gold" ? "bg-amber-50" : "bg-blue-50"}`}
            >
              <div
                className={`grid size-12 place-items-center rounded-full ${item.tone === "gold" ? "bg-amber-400 text-amber-950" : "bg-blue-600 text-white"}`}
              >
                <Award className="size-6" />
              </div>
              <div>
                <h3 className="font-bold">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  Save,
  Upload,
} from "lucide-react";
import { CourseVisibility, UserRole } from "@listenup/domain";
import {
  adminCoursesApi,
  adminLessonsApi,
  adminTeachersApi,
} from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { Button } from "@/components/ui/button";
import { ErrorState, TableSkeleton } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";

const tabs = [
  "Basic Info",
  "Display",
  "Assignments",
  "Lessons",
  "Publish Settings",
];

export function toggleTeacherAssignment(
  current: string[],
  teacherId: string,
  checked: boolean,
): string[] {
  return checked
    ? current.includes(teacherId)
      ? current
      : [...current, teacherId]
    : current.filter((id) => id !== teacherId);
}

export function CourseForm({
  id,
  view = false,
}: {
  id?: string;
  view?: boolean;
}) {
  const user = useAdminSession((state) => state.user)!;
  const router = useRouter();
  const client = useQueryClient();
  const courseQuery = useQuery({
    queryKey: ["admin-course", id, user.id],
    queryFn: () => adminCoursesApi.get(user, id!),
    enabled: Boolean(id),
    retry: false,
  });
  const teachersQuery = useQuery({
    queryKey: ["admin-teachers", user.id],
    queryFn: () => adminTeachersApi.list(user),
    enabled: user.role === UserRole.ADMIN,
  });
  const lessonsQuery = useQuery({
    queryKey: ["admin-lessons", id, user.id],
    queryFn: () => adminLessonsApi.list(user, id!),
    enabled: Boolean(id),
  });
  const [tab, setTab] = useState("Basic Info");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [level, setLevel] = useState("Beginner");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General English");
  const [visibility, setVisibility] = useState<CourseVisibility>(
    CourseVisibility.PUBLIC,
  );
  const [orderIndex, setOrderIndex] = useState(0);
  const [thumbnailMediaId, setThumbnailMediaId] = useState("");
  const [teachers, setTeachers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!courseQuery.data) return;
    setTitle(courseQuery.data.title);
    setSlug(courseQuery.data.slug ?? "");
    setLevel(courseQuery.data.level);
    setDescription(courseQuery.data.description ?? "");
    setCategory(courseQuery.data.category ?? "General English");
    setVisibility(courseQuery.data.visibility ?? CourseVisibility.PUBLIC);
    setOrderIndex(courseQuery.data.orderIndex ?? 0);
    setThumbnailMediaId(courseQuery.data.thumbnailMediaId ?? "");
    setTeachers(courseQuery.data.assignedTeacherIds);
  }, [courseQuery.data]);

  if (courseQuery.isLoading) return <TableSkeleton />;
  if (courseQuery.error)
    return <ErrorState message={courseQuery.error.message} />;

  const save = async () => {
    if (!title.trim() || !description.trim() || !category.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      const result = await adminCoursesApi.save(user, {
        id,
        title,
        slug,
        description,
        level,
        category,
        visibility,
        orderIndex,
        thumbnailMediaId: thumbnailMediaId || undefined,
        assignedTeacherIds: teachers,
      });
      await client.invalidateQueries({ queryKey: ["admin-courses"] });
      setSaved(true);
      if (!id) router.push(`/courses/${result.id}/edit`);
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!id) return;
    await adminCoursesApi.publish(user, id);
    await client.invalidateQueries({ queryKey: ["admin-course", id] });
  };

  return (
    <div>
      <Link
        href="/courses"
        className="mb-4 inline-flex items-center gap-1 font-semibold text-slate-500"
      >
        <ArrowLeft className="size-4" />
        Back to courses
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold">
              {view ? title : id ? "Edit Course" : "Create Course"}
            </h1>
            {courseQuery.data && (
              <StatusBadge status={courseQuery.data.status} />
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Configure course content, assignments, display, and publishing.
          </p>
        </div>
        <div className="flex gap-2">
          {id && (
            <Button variant="secondary" onClick={publish}>
              Publish
            </Button>
          )}
          <Button onClick={save} disabled={saving || view}>
            <Save className="size-4" />
            {saving ? "Saving…" : "Save Course"}
          </Button>
        </div>
      </div>
      <section className="admin-surface overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`min-h-12 min-w-32 border-b-2 px-4 text-xs font-bold ${
                tab === item
                  ? "border-blue-600 bg-blue-50/50 text-blue-600"
                  : "border-transparent text-slate-500"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="p-5 md:p-7">
          {tab === "Basic Info" && (
            <div className="grid gap-5 md:grid-cols-2">
              <TextField
                label="Course title *"
                value={title}
                onChange={setTitle}
                disabled={view}
                wide
              />
              <TextField
                label="Slug"
                value={slug}
                onChange={setSlug}
                disabled={view}
                placeholder="generated from title when blank"
              />
              <label>
                <span className="font-semibold">Level *</span>
                <select
                  disabled={view}
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3"
                >
                  <option>Beginner</option>
                  <option>Elementary</option>
                  <option>Pre Intermediate</option>
                  <option>Intermediate</option>
                  <option>Upper Intermediate</option>
                  <option>Advanced</option>
                </select>
              </label>
              <TextField
                label="Category *"
                value={category}
                onChange={setCategory}
                disabled={view}
              />
              <label>
                <span className="font-semibold">Visibility</span>
                <select
                  disabled={view}
                  value={visibility}
                  onChange={(event) =>
                    setVisibility(event.target.value as CourseVisibility)
                  }
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3"
                >
                  {Object.values(CourseVisibility).map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="font-semibold">Display order</span>
                <input
                  type="number"
                  min={0}
                  disabled={view}
                  value={orderIndex}
                  onChange={(event) =>
                    setOrderIndex(Number(event.target.value))
                  }
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3"
                />
              </label>
              <label className="md:col-span-2">
                <span className="font-semibold">Description *</span>
                <textarea
                  disabled={view}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-2 min-h-32 w-full rounded-lg border border-slate-200 p-3"
                />
              </label>
            </div>
          )}
          {tab === "Display" && (
            <div className="grid gap-5 md:grid-cols-[280px_1fr]">
              <div className="admin-photo grid min-h-48 place-items-center rounded-xl">
                <ImageIcon className="size-8 text-white" />
              </div>
              <div>
                <h2 className="font-bold">Course thumbnail</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Paste an uploaded media ID to attach an existing image.
                </p>
                <TextField
                  label="Thumbnail media ID"
                  value={thumbnailMediaId}
                  onChange={setThumbnailMediaId}
                  disabled={view}
                />
                <Link href="/media" className="mt-4 inline-flex">
                  <Button variant="secondary" type="button">
                    <Upload className="size-4" />
                    Open media manager
                  </Button>
                </Link>
              </div>
            </div>
          )}
          {tab === "Assignments" && (
            <div>
              <h2 className="font-bold">Assigned Teachers</h2>
              <p className="mt-1 text-sm text-slate-500">
                Only administrators can change course assignments.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(teachersQuery.data ?? []).map((teacher) => (
                  <label
                    key={teacher.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-4"
                  >
                    <input
                      type="checkbox"
                      disabled={view || user.role !== UserRole.ADMIN}
                      checked={teachers.includes(teacher.id)}
                      onChange={(event) =>
                        setTeachers((current) =>
                          toggleTeacherAssignment(
                            current,
                            teacher.id,
                            event.target.checked,
                          ),
                        )
                      }
                    />
                    <span className="grid size-9 place-items-center rounded-full bg-blue-50 font-bold text-blue-600">
                      {teacher.fullName.charAt(0)}
                    </span>
                    <strong>{teacher.fullName}</strong>
                  </label>
                ))}
              </div>
            </div>
          )}
          {tab === "Lessons" && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold">Course Lessons</h2>
                  <p className="text-sm text-slate-500">
                    Open a persisted lesson in the structured editor.
                  </p>
                </div>
                {id && (
                  <Link href={`/courses/${id}/lessons/new`}>
                    <Button>Add Lesson</Button>
                  </Link>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {(lessonsQuery.data ?? []).map((lesson, index) => (
                  <Link
                    href={`/courses/${id}/lessons/${lesson.id}/edit`}
                    key={lesson.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-slate-100 font-bold">
                      {index + 1}
                    </span>
                    <strong className="flex-1">{lesson.title}</strong>
                    <StatusBadge status={lesson.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
          {tab === "Publish Settings" && (
            <div className="max-w-2xl">
              <h2 className="font-bold">Publish checklist</h2>
              <p className="mt-2 text-sm text-slate-500">
                The API validates required content and at least one published
                lesson before publication.
              </p>
              <Button className="mt-5" onClick={publish} disabled={!id}>
                Publish Course
              </Button>
            </div>
          )}
        </div>
      </section>
      {saved && (
        <div
          role="status"
          className="fixed bottom-5 right-5 flex items-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white shadow-xl"
        >
          <CheckCircle2 className="size-4" />
          Course saved
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
  wide,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  wide?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={wide ? "md:col-span-2" : ""}>
      <span className="font-semibold">{label}</span>
      <input
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3"
        placeholder={placeholder}
      />
    </label>
  );
}

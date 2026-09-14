"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { adminCoursesApi, adminTeachersApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState, TableSkeleton } from "@/components/ui/states";

export function TeacherForm({ id }: { id?: string }) {
  const router = useRouter();
  const user = useAdminSession((state) => state.user)!;
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    status: "ACTIVE",
    notes: "",
    assignedCourseIds: [] as string[],
  });
  const [saveState, setSaveState] = useState("");
  const teacher = useQuery({
    queryKey: ["teacher", id],
    queryFn: () => adminTeachersApi.get(user, id!),
    enabled: Boolean(id),
  });
  const courses = useQuery({
    queryKey: ["courses", "teacher-form"],
    queryFn: () => adminCoursesApi.list(user),
  });
  useEffect(() => {
    if (!teacher.data) return;
    setForm({
      fullName: teacher.data.fullName,
      email: teacher.data.email,
      password: "",
      status: teacher.data.status,
      notes: teacher.data.notes,
      assignedCourseIds: teacher.data.assignedCourseIds,
    });
  }, [teacher.data]);
  const save = async () => {
    if (form.fullName.trim().length < 2 || !form.email.includes("@")) {
      setSaveState("Enter a valid name and email.");
      return;
    }
    if (!id && form.password.length < 10) {
      setSaveState("Temporary password must contain at least 10 characters.");
      return;
    }
    setSaveState("Saving…");
    try {
      const saved = await adminTeachersApi.save(user, { id, ...form });
      setSaveState("Saved");
      if (!id && saved) router.replace(`/teachers/${saved.id}`);
    } catch (error) {
      setSaveState(error instanceof Error ? error.message : "Unable to save teacher.");
    }
  };
  if (teacher.isLoading || courses.isLoading) return <TableSkeleton />;
  if (teacher.error || courses.error) {
    return (
      <ErrorState
        message={(teacher.error ?? courses.error)?.message ?? "Unable to load teacher."}
      />
    );
  }
  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/teachers"
        className="mb-4 inline-flex items-center gap-1 font-semibold text-slate-500"
      >
        <ArrowLeft className="size-4" />
        Back to teachers
      </Link>
      <PageHeader
        title={id ? "Edit Teacher" : "Create Teacher"}
        description="Teacher access is limited to explicitly assigned courses."
      />
      <section className="admin-surface p-5 md:p-7">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name">
            <input
              value={form.fullName}
              onChange={(event) =>
                setForm({ ...form, fullName: event.target.value })
              }
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              readOnly={Boolean(id)}
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </Field>
          {!id && (
            <Field label="Temporary password">
              <input
                type="password"
                minLength={10}
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
              />
            </Field>
          )}
          <Field label="Status">
            <select
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value })
              }
            >
              <option>ACTIVE</option>
              <option>INVITED</option>
              <option>BLOCKED</option>
            </select>
          </Field>
          <Field label="Assigned courses">
            <select
              multiple
              className="min-h-28"
              value={form.assignedCourseIds}
              onChange={(event) =>
                setForm({
                  ...form,
                  assignedCourseIds: Array.from(
                    event.currentTarget.selectedOptions,
                    (option) => option.value,
                  ),
                })
              }
            >
              {(courses.data ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes" wide>
            <textarea
              className="min-h-28 py-3"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </Field>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          {saveState && (
            <span
              className={`flex items-center gap-1 text-sm font-semibold ${
                saveState === "Saved" ? "text-green-600" : "text-slate-600"
              }`}
            >
              {saveState === "Saved" && <CheckCircle2 className="size-4" />}
              {saveState}
            </span>
          )}
          <Link href="/teachers">
            <Button variant="secondary">Cancel</Button>
          </Link>
          <Button onClick={() => void save()} disabled={saveState === "Saving…"}>
            {id ? "Save changes" : "Create teacher"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="font-semibold">{label}</span>
      <div className="mt-2 [&>*]:h-10 [&>*]:w-full [&>*]:rounded-lg [&>*]:border [&>*]:border-slate-200 [&>*]:px-3">
        {children}
      </div>
    </label>
  );
}

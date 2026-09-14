"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  GripVertical,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  adminLessonsApi,
  type LessonDraft,
} from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

const tabs = [
  "Basic Info",
  "Lesson Content",
  "Vocabulary & Expressions",
  "Media",
  "Listening Exercises",
  "Publish",
];
type SaveState = "Unsaved changes" | "Saving..." | "Saved" | "Save failed";
type Vocabulary = LessonDraft["vocabulary"][number];
type Expression = LessonDraft["expressions"][number];
type Resource = LessonDraft["resources"][number];

export function LessonEditor({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId?: string;
}) {
  const user = useAdminSession((state) => state.user)!;
  const router = useRouter();
  const [currentId, setCurrentId] = useState(lessonId);
  const [tab, setTab] = useState("Basic Info");
  const [saveState, setSaveState] = useState<SaveState>("Saved");
  const [status, setStatus] = useState("DRAFT");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(15);
  const [orderIndex, setOrderIndex] = useState(0);
  const [contentText, setContentText] = useState("");
  const [vocabulary, setVocabulary] = useState<Vocabulary[]>([]);
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [exercises, setExercises] = useState<LessonDraft["exercises"]>([]);

  useEffect(() => {
    if (!lessonId) return;
    let active = true;
    void adminLessonsApi
      .get(user, courseId, lessonId)
      .then((lesson) => {
        if (!active) return;
        setTitle(lesson.title);
        setSlug(lesson.slug);
        setDescription(lesson.description);
        setDuration(lesson.estimatedDurationMinutes);
        setOrderIndex(lesson.orderIndex);
        setContentText(contentToText(lesson.content));
        setVocabulary(lesson.vocabulary);
        setExpressions(lesson.expressions);
        setResources(lesson.resources);
        setExercises(lesson.exercises);
        setStatus(lesson.status);
      })
      .catch(() => active && setSaveState("Save failed"));
    return () => {
      active = false;
    };
  }, [courseId, lessonId, user]);

  const persist = useCallback(async () => {
    if (title.trim().length < 2 || !description.trim()) {
      setSaveState("Save failed");
      return;
    }
    setSaveState("Saving...");
    try {
      const lesson = await adminLessonsApi.save(
        user,
        courseId,
        {
          title,
          slug,
          description,
          content: {
            blocks: contentText
              .split(/\n{2,}/u)
              .filter(Boolean)
              .map((text) => ({ type: "paragraph", text })),
          },
          estimatedDurationMinutes: duration,
          orderIndex,
          vocabulary,
          expressions,
          resources,
        },
        currentId,
      );
      setCurrentId(lesson.id);
      setStatus(lesson.status);
      setSaveState("Saved");
      if (!currentId) {
        router.replace(
          `/courses/${courseId}/lessons/${lesson.id}/edit`,
        );
      }
    } catch {
      setSaveState("Save failed");
    }
  }, [
    contentText,
    courseId,
    currentId,
    description,
    duration,
    expressions,
    orderIndex,
    resources,
    router,
    slug,
    title,
    user,
    vocabulary,
  ]);

  useEffect(() => {
    if (saveState !== "Unsaved changes") return;
    const timer = setTimeout(() => void persist(), 700);
    return () => clearTimeout(timer);
  }, [persist, saveState]);

  const dirty = () => setSaveState("Unsaved changes");
  const publish = async () => {
    if (!currentId) return;
    const lesson = await adminLessonsApi.publish(user, courseId, currentId);
    setStatus(lesson.status);
  };

  return (
    <div>
      <Link
        href={`/courses/${courseId}/edit`}
        className="mb-4 inline-flex items-center gap-1 font-semibold text-slate-500"
      >
        <ArrowLeft className="size-4" />
        Back to course
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold">
              Lesson Editor: {title || "New Lesson"}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p
            className={`mt-1 text-xs font-semibold ${
              saveState === "Save failed"
                ? "text-red-600"
                : saveState === "Saved"
                  ? "text-green-600"
                  : "text-amber-600"
            }`}
            aria-live="polite"
          >
            {saveState}
          </p>
        </div>
        <Button onClick={() => void persist()}>
          <Save className="size-4" />
          Save Lesson
        </Button>
      </div>
      <section className="admin-surface overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-200">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`min-h-12 min-w-36 border-b-2 px-4 text-xs font-bold ${
                tab === item
                  ? "border-blue-600 bg-blue-50/50 text-blue-600"
                  : "border-transparent text-slate-500"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "Basic Info" && (
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Lesson title *"
                value={title}
                onChange={(value) => {
                  setTitle(value);
                  dirty();
                }}
                wide
              />
              <Input
                label="Slug"
                value={slug}
                onChange={(value) => {
                  setSlug(value);
                  dirty();
                }}
              />
              <NumberInput
                label="Duration (minutes)"
                value={duration}
                onChange={(value) => {
                  setDuration(value);
                  dirty();
                }}
              />
              <NumberInput
                label="Display order"
                value={orderIndex}
                onChange={(value) => {
                  setOrderIndex(value);
                  dirty();
                }}
              />
              <label className="md:col-span-2">
                <span className="font-semibold">Summary *</span>
                <textarea
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    dirty();
                  }}
                  className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 p-3"
                />
              </label>
            </div>
          )}
          {tab === "Lesson Content" && (
            <div>
              <h2 className="font-bold">Structured Lesson Content</h2>
              <p className="mt-1 text-sm text-slate-500">
                Separate paragraphs with a blank line.
              </p>
              <textarea
                value={contentText}
                onChange={(event) => {
                  setContentText(event.target.value);
                  dirty();
                }}
                className="mt-4 min-h-72 w-full rounded-lg border border-slate-200 p-4 outline-none focus:border-blue-500"
              />
            </div>
          )}
          {tab === "Vocabulary & Expressions" && (
            <div className="grid gap-4 xl:grid-cols-2">
              <EditableList
                title="Vocabulary"
                rows={vocabulary}
                columns={["word", "meaning", "ipa", "example"]}
                add={() => {
                  setVocabulary((items) => [
                    ...items,
                    { word: "", meaning: "", ipa: "", example: "" },
                  ]);
                  dirty();
                }}
                update={(index, key, value) => {
                  setVocabulary((items) =>
                    items.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, [key]: value } : item,
                    ),
                  );
                  dirty();
                }}
                remove={(index) => {
                  setVocabulary((items) =>
                    items.filter((_, itemIndex) => itemIndex !== index),
                  );
                  dirty();
                }}
              />
              <EditableList
                title="Useful Expressions"
                rows={expressions}
                columns={["expression", "meaning", "example"]}
                add={() => {
                  setExpressions((items) => [
                    ...items,
                    { expression: "", meaning: "", example: "" },
                  ]);
                  dirty();
                }}
                update={(index, key, value) => {
                  setExpressions((items) =>
                    items.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, [key]: value } : item,
                    ),
                  );
                  dirty();
                }}
                remove={(index) => {
                  setExpressions((items) =>
                    items.filter((_, itemIndex) => itemIndex !== index),
                  );
                  dirty();
                }}
              />
            </div>
          )}
          {tab === "Media" && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold">Lesson Resources</h2>
                  <p className="text-sm text-slate-500">
                    Attach uploaded media IDs or external URLs.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setResources((items) => [
                      ...items,
                      { type: "LINK", title: "", externalUrl: "" },
                    ]);
                    dirty();
                  }}
                >
                  <Plus className="size-4" />
                  Add Resource
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {resources.map((resource, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-4"
                  >
                    <select
                      value={resource.type}
                      onChange={(event) => {
                        setResources((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, type: event.target.value }
                              : item,
                          ),
                        );
                        dirty();
                      }}
                      className="h-10 rounded-lg border border-slate-200 px-3"
                    >
                      <option>LINK</option>
                      <option>DOCUMENT</option>
                      <option>AUDIO</option>
                      <option>VIDEO</option>
                    </select>
                    {(["title", "mediaId", "externalUrl"] as const).map(
                      (key) => (
                        <input
                          key={key}
                          value={resource[key] ?? ""}
                          placeholder={key}
                          onChange={(event) => {
                            setResources((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, [key]: event.target.value }
                                  : item,
                              ),
                            );
                            dirty();
                          }}
                          className="h-10 rounded-lg border border-slate-200 px-3"
                        />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "Listening Exercises" && (
            <div>
              <div className="flex justify-between">
                <h2 className="font-bold">Linked Listening Exercises</h2>
                <Link
                  href={`/exercises/new?courseId=${courseId}&lessonId=${currentId ?? ""}`}
                >
                  <Button disabled={!currentId}>
                    <Plus className="size-4" />
                    Create Exercise
                  </Button>
                </Link>
              </div>
              <div className="mt-4 space-y-2">
                {exercises.map((exercise, index) => (
                  <Link
                    href={`/exercises/${exercise.id}/edit`}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-4"
                    key={exercise.id}
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-blue-50 font-bold text-blue-600">
                      {index + 1}
                    </span>
                    <strong className="flex-1">{exercise.title}</strong>
                    <StatusBadge status={exercise.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
          {tab === "Publish" && (
            <div className="max-w-2xl">
              <h2 className="font-bold">Lesson publish checklist</h2>
              <div className="mt-4 space-y-2">
                {[
                  ["Basic information complete", Boolean(title && description)],
                  ["Structured content available", Boolean(contentText)],
                  ["Vocabulary reviewed", vocabulary.length > 0],
                  ["Exercises reviewed", true],
                ].map(([item, ready]) => (
                  <div
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                    key={String(item)}
                  >
                    <Check
                      className={`size-5 ${
                        ready ? "text-green-500" : "text-amber-500"
                      }`}
                    />
                    <strong>{item}</strong>
                  </div>
                ))}
              </div>
              <Button
                className="mt-5"
                onClick={() => void publish()}
                disabled={!currentId}
              >
                Publish Lesson
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  wide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "md:col-span-2" : ""}>
      <span className="font-semibold">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="font-semibold">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3"
      />
    </label>
  );
}

function EditableList<T extends Record<string, string | undefined>>({
  title,
  rows,
  columns,
  add,
  update,
  remove,
}: {
  title: string;
  rows: T[];
  columns: Array<keyof T>;
  add: () => void;
  update: (index: number, key: keyof T, value: string) => void;
  remove: (index: number) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <h2 className="font-bold">{title}</h2>
        <Button size="sm" onClick={add}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      <div className="space-y-2 p-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="flex items-start gap-2 rounded-lg border border-slate-100 p-2"
          >
            <GripVertical className="mt-2 size-4 shrink-0 text-slate-400" />
            <div className="grid flex-1 gap-2">
              {columns.map((key) => (
                <input
                  key={String(key)}
                  value={row[key] ?? ""}
                  placeholder={String(key)}
                  onChange={(event) => update(index, key, event.target.value)}
                  className="h-9 rounded border border-slate-200 px-2"
                />
              ))}
            </div>
            <button
              aria-label={`Delete ${title}`}
              onClick={() => remove(index)}
              className="grid size-9 place-items-center text-red-500"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function contentToText(content: Record<string, unknown>): string {
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  return blocks
    .map((block) =>
      block &&
      typeof block === "object" &&
      "text" in block &&
      typeof block.text === "string"
        ? block.text
        : "",
    )
    .filter(Boolean)
    .join("\n\n");
}

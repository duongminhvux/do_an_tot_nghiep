"use client";

import { useEffect, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  Monitor,
  Save,
  Smartphone,
  Tablet,
} from "lucide-react";
import type { LandingSectionDto } from "@listenup/domain";
import { adminLandingApi } from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { RequirePermission } from "@/components/security/require-permission";
import { Button } from "@/components/ui/button";
import { ErrorState, TableSkeleton } from "@/components/ui/states";

interface SortableSectionProps {
  item: LandingSectionDto;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (index: number, direction: number) => void;
  onEnabledChange: (enabled: boolean) => void;
}

function SortableSection({
  item,
  index,
  selected,
  onSelect,
  onMove,
  onEnabledChange,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 rounded-lg p-1 ${selected ? "bg-blue-50" : ""} ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <button
        type="button"
        aria-label={`Drag ${item.type} section`}
        className="grid size-8 shrink-0 cursor-grab touch-none place-items-center text-slate-400 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-h-10 min-w-0 flex-1 px-1 text-left"
      >
        <span className="block truncate text-xs font-semibold">
          {item.type}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onMove(index, -1)}
        className="grid size-8 place-items-center"
        aria-label="Move up"
      >
        <ArrowUp className="size-3" />
      </button>
      <button
        type="button"
        onClick={() => onMove(index, 1)}
        className="grid size-8 place-items-center"
        aria-label="Move down"
      >
        <ArrowDown className="size-3" />
      </button>
      <input
        aria-label={`Enable ${item.type} section`}
        type="checkbox"
        checked={item.enabled}
        onChange={(event) => onEnabledChange(event.target.checked)}
      />
    </div>
  );
}

export function LandingBuilder() {
  const user = useAdminSession((state) => state.user)!;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["landing"],
    queryFn: () => adminLandingApi.get(user),
    retry: false,
  });
  const [sections, setSections] = useState<LandingSectionDto[]>([]);
  const [selected, setSelected] = useState("");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const [saved, setSaved] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (query.data) {
      setSections(query.data);
      setSelected(query.data[0]?.id ?? "");
    }
  }, [query.data]);

  if (query.isLoading) return <TableSkeleton />;
  if (query.error) return <ErrorState message={query.error.message} />;

  const section = sections.find((item) => item.id === selected);

  const reorder = (index: number, direction: number) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    setSections(
      arrayMove(sections, index, target).map((item, orderIndex) => ({
        ...item,
        orderIndex,
      })),
    );
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((item) => item.id === active.id);
    const newIndex = sections.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setSections(
      arrayMove(sections, oldIndex, newIndex).map((item, orderIndex) => ({
        ...item,
        orderIndex,
      })),
    );
  };

  const save = async () => {
    await adminLandingApi.save(user, sections);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const publish = async () => {
    await adminLandingApi.save(user, sections);
    await adminLandingApi.publish(user);
    await client.invalidateQueries({ queryKey: ["landing"] });
  };

  return (
    <RequirePermission permission="landing:update">
      <div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">Landing Builder</h1>
            <p className="mt-1 text-sm text-slate-500">
              Edit draft → Preview → Validate → Publish. Published content
              remains immutable until the next publish.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={save}>
              <Save className="size-4" />
              Save Draft
            </Button>
            <Button onClick={publish}>
              <CheckCircle2 className="size-4" />
              Publish
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[240px_340px_1fr]">
          <aside className="admin-surface p-3">
            <h2 className="px-2 py-2 font-bold">Sections</h2>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sections.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {sections.map((item, index) => (
                    <SortableSection
                      key={item.id}
                      item={item}
                      index={index}
                      selected={selected === item.id}
                      onSelect={() => setSelected(item.id)}
                      onMove={reorder}
                      onEnabledChange={(enabled) =>
                        setSections((current) =>
                          current.map((candidate) =>
                            candidate.id === item.id
                              ? { ...candidate, enabled }
                              : candidate,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </aside>

          <section className="admin-surface p-5">
            <h2 className="font-bold">{section?.type} Editor</h2>
            <p className="mt-1 text-xs text-slate-500">
              Editing draft content only.
            </p>
            {section && (
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-bold">Title</span>
                  <input
                    value={section.draftContent.title ?? ""}
                    onChange={(event) =>
                      setSections((current) =>
                        current.map((item) =>
                          item.id === section.id
                            ? {
                                ...item,
                                draftContent: {
                                  ...item.draftContent,
                                  title: event.target.value,
                                },
                              }
                            : item,
                        ),
                      )
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold">Description</span>
                  <textarea
                    value={section.draftContent.description ?? ""}
                    onChange={(event) =>
                      setSections((current) =>
                        current.map((item) =>
                          item.id === section.id
                            ? {
                                ...item,
                                draftContent: {
                                  ...item.draftContent,
                                  description: event.target.value,
                                },
                              }
                            : item,
                        ),
                      )
                    }
                    className="mt-2 min-h-32 w-full rounded-lg border border-slate-200 p-3"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold">CTA label</span>
                  <input
                    value={section.draftContent.ctaLabel ?? ""}
                    onChange={(event) =>
                      setSections((current) =>
                        current.map((item) =>
                          item.id === section.id
                            ? {
                                ...item,
                                draftContent: {
                                  ...item.draftContent,
                                  ctaLabel: event.target.value,
                                },
                              }
                            : item,
                        ),
                      )
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3"
                  />
                </label>
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled
                  title="Image selection is not available in this editor yet."
                >
                  Choose image unavailable
                </Button>
              </div>
            )}
          </section>

          <section className="admin-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 p-3">
              <h2 className="font-bold">Live Preview</h2>
              <div className="flex rounded-lg border border-slate-200 p-1">
                {(
                  [
                    ["desktop", Monitor],
                    ["tablet", Tablet],
                    ["mobile", Smartphone],
                  ] as const
                ).map(([name, Icon]) => (
                  <button
                    type="button"
                    key={name}
                    aria-label={`${name} preview`}
                    onClick={() => setDevice(name)}
                    className={`grid size-8 place-items-center rounded ${device === name ? "bg-blue-600 text-white" : ""}`}
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="admin-grid min-h-[560px] p-5">
              <div
                className={`mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ${device === "mobile" ? "max-w-xs" : device === "tablet" ? "max-w-xl" : "max-w-4xl"}`}
              >
                <header className="flex h-14 items-center justify-between px-5">
                  <strong className="text-blue-700">ListenUp</strong>
                  <div className="hidden gap-4 text-xs sm:flex">
                    <span>Courses</span>
                    <span>TOEIC</span>
                    <span>Features</span>
                  </div>
                  <span className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">
                    Login
                  </span>
                </header>
                <div className="grid min-h-80 items-center gap-5 bg-blue-50 p-6 md:grid-cols-2">
                  <div>
                    <h3 className="text-3xl font-extrabold leading-tight">
                      {
                        sections.find((item) => item.type === "Hero")
                          ?.draftContent.title
                      }
                    </h3>
                    <p className="mt-3 text-sm text-slate-600">
                      {
                        sections.find((item) => item.type === "Hero")
                          ?.draftContent.description
                      }
                    </p>
                    <Button className="mt-5">
                      {sections.find((item) => item.type === "Hero")
                        ?.draftContent.ctaLabel || "Start Learning"}
                    </Button>
                  </div>
                  <div className="admin-photo min-h-60 rounded-2xl" />
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-3">
                  {sections
                    .filter((item) => item.enabled)
                    .slice(1, 4)
                    .map((item) => (
                      <div
                        className="rounded-lg border border-slate-200 p-3"
                        key={item.id}
                      >
                        <strong className="text-xs">
                          {item.draftContent.title}
                        </strong>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {item.draftContent.description}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </section>
        </div>
        {saved && (
          <div className="fixed bottom-5 right-5 rounded-lg bg-green-600 px-4 py-3 font-bold text-white">
            Draft saved
          </div>
        )}
      </div>
    </RequirePermission>
  );
}

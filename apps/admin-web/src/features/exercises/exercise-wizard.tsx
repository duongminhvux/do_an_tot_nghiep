"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileAudio,
  GripVertical,
  Monitor,
  Plus,
  RefreshCcw,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { TtsJobStatus } from "@listenup/domain";
import {
  adminCoursesApi,
  adminExercisesApi,
  adminLessonsApi,
  adminMediaApi,
  adminTtsApi,
  emptyExerciseDraft,
  type AdminLessonSummary,
  type ExerciseDraft,
  type TtsSettingsDto,
  type TtsVoiceDto,
} from "@/lib/api/client";
import type { AdminCourseDto } from "@listenup/domain";
import { useAdminSession } from "@/stores/admin-session";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { UnifiedAudioPlayer } from "@/components/audio/unified-audio-player";
import { cn } from "@/lib/utils";
import { useProtectedMediaUrl } from "@/lib/use-protected-media-url";
const steps = [
  { key: "basic", label: "1. Basic Info" },
  { key: "audio", label: "2. Script & Audio" },
  { key: "questions", label: "3. Questions & Answers" },
  { key: "preview", label: "4. Preview" },
  { key: "publish", label: "5. Publish" },
];
type Draft = ExerciseDraft;
const persistentUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const defaultInstructions: Record<string, string> = {
  DICTATION: "Listen and type exactly what you hear.",
  PART_1: "Select the statement that best describes the photograph.",
  PART_2: "Select the best response to each question or statement.",
  PART_3: "Listen to the conversation and answer the questions.",
  PART_4: "Listen to the talk and answer the questions.",
};

const isDefaultInstruction = (value: string) =>
  !value.trim() || Object.values(defaultInstructions).includes(value);

const optionCountForPart = (part: string | null) => (part === "PART_2" ? 3 : 4);

const normalizedOptions = (
  questionId: string,
  options: Draft["questions"][number]["options"],
  count: number,
) =>
  Array.from(
    { length: count },
    (_, index) =>
      options[index] ?? {
        id: `${questionId}-option-${index}-${Date.now()}`,
        text: "",
        correct: false,
      },
  );

const toeicDraftValid = (draft: Draft): boolean => {
  if (!draft.questions.length || !draft.groups.length) return false;
  const validQuestion = (question: Draft["questions"][number]) => {
    const expected = optionCountForPart(draft.toeicPart);
    return (
      question.options.length === expected &&
      question.options.every((option) => option.text.trim()) &&
      question.options.filter((option) => option.correct).length === 1 &&
      (draft.toeicPart === "PART_1" || Boolean(question.text.trim()))
    );
  };
  if (
    draft.questions.some(
      (question) =>
        !question.groupId ||
        !draft.groups.some((group) => group.id === question.groupId),
    )
  ) {
    return false;
  }
  if (draft.toeicPart === "PART_1" || draft.toeicPart === "PART_2") {
    return draft.groups.every((group) => {
      const questions = draft.questions.filter(
        (question) => question.groupId === group.id,
      );
      return (
        questions.length === 1 &&
        validQuestion(questions[0]) &&
        (draft.toeicPart !== "PART_1" ||
          Boolean(questions[0].imageMediaId || group.imageMediaId))
      );
    });
  }
  if (draft.toeicPart === "PART_3" || draft.toeicPart === "PART_4") {
    return (
      draft.groups.length > 0 &&
      draft.groups.every((group) => {
        const questions = draft.questions.filter(
          (question) => question.groupId === group.id,
        );
        return questions.length === 3 && questions.every(validQuestion);
      })
    );
  }
  return false;
};

const toeicScriptReady = (draft: Draft): boolean => {
  if (draft.toeicPart === "PART_1" || draft.toeicPart === "PART_2") {
    return toeicDraftValid(draft);
  }
  return (
    draft.groups.length > 0 &&
    draft.groups.every(
      (group) =>
        group.sharedScript.trim() ||
        draft.audioSegments.some(
          (segment) => segment.groupId === group.id && segment.text.trim(),
        ),
    )
  );
};

const draftAudioReady = (draft: Draft): boolean =>
  draft.type === "DICTATION"
    ? draft.audioReady
    : draft.groups.length > 0 &&
      draft.groups.every((group) => Boolean(group.sharedAudioMediaId));

export function ExerciseWizard({
  id,
  initialStep = "basic",
  previewOnly = false,
}: {
  id?: string;
  initialStep?: string;
  previewOnly?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAdminSession((s) => s.user)!;
  const [draft, setDraft] = useState<Draft>({ ...emptyExerciseDraft });
  const [savedId, setSavedId] = useState(id);
  const [step, setStep] = useState(previewOnly ? "preview" : initialStep);
  const [saveState, setSaveState] = useState("Saved");
  const [device, setDevice] = useState("desktop");
  const draftRef = useRef(draft);
  const savedIdRef = useRef(savedId);
  const editVersionRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const stepRef = useRef(step);
  const mountedRef = useRef(true);
  const coursesQuery = useQuery({
    queryKey: ["admin-courses", user.id],
    queryFn: () => adminCoursesApi.list(user),
  });
  const lessonsQuery = useQuery({
    queryKey: ["admin-lessons", draft.courseId, user.id],
    queryFn: () => adminLessonsApi.list(user, draft.courseId),
    enabled: Boolean(draft.courseId),
  });
  const ttsSettingsQuery = useQuery({
    queryKey: ["tts-settings"],
    queryFn: () => adminTtsApi.settings(user),
    refetchInterval: 5_000,
  });
  const ttsVoicesQuery = useQuery({
    queryKey: ["tts-voices"],
    queryFn: () => adminTtsApi.voices(user),
    refetchInterval: 10_000,
  });
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    savedIdRef.current = savedId;
  }, [savedId]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void adminExercisesApi
      .getDraft(user, id)
      .then((value) => {
        if (!active) return;
        draftRef.current = value;
        setDraft(value);
      })
      .catch(() => {
        if (active) setSaveState("Unable to load draft");
      });
    return () => {
      active = false;
    };
  }, [id, user.id]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    editVersionRef.current += 1;
    setDraft((current) => {
      const next = { ...current, [key]: value };
      draftRef.current = next;
      return next;
    });
    setSaveState("Unsaved changes");
  };
  const persist = useCallback(async () => {
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }
    const snapshot = draftRef.current;
    if (
      !snapshot.lessonId ||
      snapshot.title.trim().length < 2 ||
      !snapshot.instructions.trim()
    ) {
      setSaveState("Complete the required fields before saving");
      return;
    }

    const versionAtStart = editVersionRef.current;
    const targetId = savedIdRef.current;
    saveInFlightRef.current = true;
    setSaveState("Saving...");
    try {
      const saved = await adminExercisesApi.saveDraft(user, snapshot, targetId);
      const wasNew = !savedIdRef.current;
      if (saved.id) {
        savedIdRef.current = saved.id;
        if (mountedRef.current) setSavedId(saved.id);
      }

      if (!mountedRef.current) return;
      if (editVersionRef.current === versionAtStart) {
        draftRef.current = saved;
        setDraft(saved);
        setSaveState("Saved");
      } else {
        setDraft((current) => {
          const next = { ...current, id: saved.id ?? current.id };
          draftRef.current = next;
          return next;
        });
        setSaveState("Unsaved changes");
      }

      if (wasNew && saved.id) {
        router.replace(`/exercises/${saved.id}/edit?step=${stepRef.current}`);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setSaveState(
        error instanceof Error ? error.message : "Unable to save draft",
      );
    } finally {
      saveInFlightRef.current = false;
      if (
        mountedRef.current &&
        (saveQueuedRef.current || editVersionRef.current !== versionAtStart)
      ) {
        saveQueuedRef.current = false;
        queueMicrotask(() => void persist());
      }
    }
  }, [router, user]);
  useEffect(() => {
    if (saveState !== "Unsaved changes") return;
    const timer = setTimeout(() => void persist(), 700);
    return () => clearTimeout(timer);
  }, [draft, persist, saveState]);
  const go = (next: string) => {
    setStep(next);
    router.replace(
      `${savedId ? `/exercises/${savedId}/edit` : "/exercises/new"}?step=${next}`,
    );
  };
  const index = steps.findIndex((s) => s.key === step);
  const refreshDraftAfterMediaChange = async () => {
    const targetId = savedIdRef.current;
    if (!targetId) return;
    const fresh = await adminExercisesApi.getDraft(user, targetId);
    draftRef.current = fresh;
    setDraft(fresh);
    await queryClient.invalidateQueries({ queryKey: ["admin-exercises"] });
    await queryClient.invalidateQueries({ queryKey: ["tts-jobs"] });
  };
  const generate = async () => {
    if (saveInFlightRef.current) {
      setSaveState("Wait for the current save to finish before generating audio");
      return;
    }
    if (!draft.script.trim()) return;
    const targetId = savedIdRef.current;
    if (!targetId) {
      setSaveState("Save the exercise before requesting audio");
      return;
    }
    setSaveState("Generating with local Kokoro…");
    try {
      await persist();
      const result = await adminTtsApi.create(user, targetId, {
        targetType: "EXERCISE",
        text: draftRef.current.script,
      });
      update("ttsStatus", result.status);
      await refreshDraftAfterMediaChange();
      setSaveState("Kokoro audio generated");
    } catch (error) {
      setSaveState(
        error instanceof Error ? error.message : "Audio generation failed.",
      );
    }
  };
  const generateGroupAudio = async (groupId: string) => {
    if (saveInFlightRef.current) {
      setSaveState("Wait for the current save to finish before generating audio");
      return;
    }
    if (!persistentUuid(groupId)) {
      setSaveState("Wait for the new group to finish saving before generating audio");
      return;
    }
    const targetId = savedIdRef.current;
    if (!targetId) {
      setSaveState("Save the exercise before requesting group audio");
      return;
    }
    setSaveState("Generating group audio with local Kokoro…");
    try {
      await persist();
      await adminTtsApi.create(user, targetId, {
        targetType: "GROUP",
        groupId,
      });
      await refreshDraftAfterMediaChange();
      setSaveState("Group audio generated");
    } catch (error) {
      setSaveState(
        error instanceof Error ? error.message : "Group audio generation failed.",
      );
    }
  };
  const generateSegmentAudio = async (audioSegmentId: string) => {
    if (saveInFlightRef.current) {
      setSaveState("Wait for the current save to finish before generating audio");
      return;
    }
    if (!persistentUuid(audioSegmentId)) {
      setSaveState("Wait for the new segment to finish saving before generating audio");
      return;
    }
    const targetId = savedIdRef.current;
    if (!targetId) {
      setSaveState("Save the exercise before requesting segment audio");
      return;
    }
    setSaveState("Generating segment audio with local Kokoro…");
    try {
      await persist();
      await adminTtsApi.create(user, targetId, {
        targetType: "SEGMENT",
        audioSegmentId,
      });
      await refreshDraftAfterMediaChange();
      setSaveState("Segment audio generated");
    } catch (error) {
      setSaveState(
        error instanceof Error ? error.message : "Segment audio generation failed.",
      );
    }
  };

  const archiveExercise = async () => {
    if (!savedId) {
      setSaveState("Save the exercise before archiving it");
      return;
    }
    if (
      !globalThis.confirm(
        "Archive this exercise? Students will no longer see it.",
      )
    ) {
      return;
    }
    setSaveState("Archiving...");
    try {
      await adminExercisesApi.archive(user, savedId);
      await queryClient.invalidateQueries({ queryKey: ["admin-exercises"] });
      router.push("/exercises");
    } catch (error) {
      setSaveState(
        error instanceof Error ? error.message : "Unable to archive exercise",
      );
    }
  };
  const uploadAudio = async (file: File) => {
    if (!savedId) {
      setSaveState("Save the exercise before attaching audio");
      return;
    }
    setSaveState("Uploading audio…");
    try {
      const media = await adminMediaApi.upload(user, file);
      const saved = await adminExercisesApi.attachAudio(
        user,
        savedId,
        media.id,
      );
      setDraft(saved);
      setSaveState("Audio attached");
    } catch (error) {
      setSaveState(
        error instanceof Error ? error.message : "Unable to upload audio",
      );
    }
  };
  const uploadGroupAudio = async (groupId: string, file: File) => {
    if (!savedId) {
      setSaveState("Save the exercise before attaching group audio");
      return;
    }
    setSaveState("Uploading group audio…");
    try {
      const media = await adminMediaApi.upload(user, file);
      update(
        "groups",
        draftRef.current.groups.map((group) =>
          group.id === groupId
            ? { ...group, sharedAudioMediaId: media.id }
            : group,
        ),
      );
    } catch (error) {
      setSaveState(
        error instanceof Error ? error.message : "Unable to upload group audio",
      );
    }
  };
  const uploadGroupImage = async (groupId: string, file: File) => {
    setSaveState("Uploading group image…");
    try {
      const media = await adminMediaApi.upload(user, file);
      if (media.type !== "IMAGE") {
        throw new Error("The selected file is not a supported image.");
      }
      update(
        "groups",
        draftRef.current.groups.map((group) =>
          group.id === groupId ? { ...group, imageMediaId: media.id } : group,
        ),
      );
    } catch (error) {
      setSaveState(
        error instanceof Error ? error.message : "Unable to upload group image",
      );
    }
  };
  const uploadQuestionImage = async (questionId: string, file: File) => {
    setSaveState("Uploading question image…");
    try {
      const media = await adminMediaApi.upload(user, file);
      if (media.type !== "IMAGE") {
        throw new Error("The selected file is not a supported image.");
      }
      update(
        "questions",
        draftRef.current.questions.map((question) =>
          question.id === questionId
            ? { ...question, imageMediaId: media.id }
            : question,
        ),
      );
    } catch (error) {
      setSaveState(
        error instanceof Error ? error.message : "Unable to upload question image",
      );
    }
  };
  const checklist = useMemo(
    () => [
      {
        label: "Basic information complete",
        valid: Boolean(draft.title && draft.instructions),
        step: "basic",
      },
      {
        label: "Course selected",
        valid: Boolean(draft.courseId),
        step: "basic",
      },
      {
        label: "Lesson selected",
        valid: Boolean(draft.lessonId),
        step: "basic",
      },
      {
        label:
          draft.type === "DICTATION"
            ? "Audio available"
            : "Every group has playable audio",
        valid: draftAudioReady(draft),
        step: draft.type === "DICTATION" ? "audio" : "questions",
      },
      {
        label: "Script available",
        valid:
          draft.type === "DICTATION"
            ? Boolean(draft.script.trim())
            : toeicScriptReady(draft),
        step: draft.type === "DICTATION" ? "audio" : "questions",
      },
      {
        label:
          draft.type === "DICTATION"
            ? "Correct text configured"
            : "Questions valid",
        valid:
          draft.type === "DICTATION"
            ? Boolean(draft.correctText)
            : toeicDraftValid(draft),
        step: "questions",
      },
      {
        label: "Pass threshold valid",
        valid: draft.passThreshold >= 0 && draft.passThreshold <= 100,
        step: "basic",
      },
      {
        label: "Listen limit valid",
        valid: draft.maxListens > 0,
        step: "basic",
      },
      {
        label: "Attempt limit valid",
        valid: draft.maxAttempts > 0,
        step: "basic",
      },
    ],
    [draft],
  );
  const complete = checklist.every((i) => i.valid);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
            {savedId ? `Exercise ${savedId}` : "New exercise"}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">
            Five-Step Exercise Builder
          </h1>
          <p
            className={`mt-1 text-xs font-semibold ${saveState === "Saved" ? "text-green-600" : "text-amber-600"}`}
            aria-live="polite"
          >
            {saveState}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void persist()}>
            <Save className="size-4" />
            Save Draft
          </Button>
          {complete && savedId && (
            <Button
              onClick={() => void adminExercisesApi.publish(user, savedId)}
            >
              Publish
            </Button>
          )}
        </div>
      </div>
      <div className="admin-surface mb-4 flex overflow-x-auto">
        {steps.map((item) => {
          const active = item.key === step;
          return (
            <button
              key={item.key}
              onClick={() => go(item.key)}
              className={cn(
                "min-h-13 min-w-44 flex-1 border-b-2 px-4 text-xs font-bold",
                active
                  ? "border-blue-600 bg-blue-50 text-blue-600"
                  : "border-transparent text-slate-500 hover:bg-slate-50",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <section className="admin-surface p-5">
        {step === "basic" && (
          <BasicStep
            draft={draft}
            update={update}
            courses={coursesQuery.data ?? []}
            lessons={lessonsQuery.data ?? []}
          />
        )}{" "}
        {step === "audio" && (
          <AudioStep
            draft={draft}
            update={update}
            generate={generate}
            upload={uploadAudio}
            ttsSettings={ttsSettingsQuery.data}
          />
        )}{" "}
        {step === "questions" && (
          <QuestionsStep
            draft={draft}
            update={update}
            uploadGroupAudio={uploadGroupAudio}
            uploadGroupImage={uploadGroupImage}
            uploadQuestionImage={uploadQuestionImage}
            generateGroupAudio={generateGroupAudio}
            generateSegmentAudio={generateSegmentAudio}
            ttsReady={Boolean(ttsSettingsQuery.data?.providerHealthy)}
            ttsVoices={ttsVoicesQuery.data?.voices ?? []}
          />
        )}{" "}
        {step === "preview" && (
          <PreviewStep draft={draft} device={device} setDevice={setDevice} />
        )}{" "}
        {step === "publish" && (
          <PublishStep
            checklist={checklist}
            go={go}
            complete={complete}
            publish={() =>
              savedId
                ? adminExercisesApi.publish(user, savedId)
                : Promise.resolve()
            }
            archive={archiveExercise}
            save={persist}
          />
        )}
        <div className="mt-7 flex items-center justify-between border-t border-slate-200 pt-5">
          <Button
            variant="secondary"
            disabled={index === 0 || previewOnly}
            onClick={() => go(steps[index - 1].key)}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-xs text-slate-500">Step {index + 1} of 5</span>
          {index < steps.length - 1 ? (
            <Button
              onClick={() => go(steps[index + 1].key)}
              disabled={previewOnly}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              disabled={!complete || !savedId}
              onClick={() =>
                savedId
                  ? void adminExercisesApi.publish(user, savedId)
                  : undefined
              }
            >
              Publish Exercise
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
function BasicStep({
  draft,
  update,
  courses,
  lessons,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  courses: AdminCourseDto[];
  lessons: AdminLessonSummary[];
}) {
  return (
    <div>
      <h2 className="text-lg font-bold">Basic Information</h2>
      <p className="text-sm text-slate-500">
        Define scope, type, limits, and student instructions.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Course *">
          <select
            value={draft.courseId}
            onChange={(e) => {
              update("courseId", e.target.value);
              update("lessonId", "");
            }}
          >
            <option value="">Select a course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lesson *">
          <select
            value={draft.lessonId}
            onChange={(e) => update("lessonId", e.target.value)}
          >
            <option value="">Select a lesson</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Exercise type *">
          <select
            value={draft.type}
            onChange={(e) => {
              const nextType = e.target.value;
              update("type", nextType);
              update(
                "dictationMode",
                nextType === "DICTATION" ? "SENTENCE" : null,
              );
              const nextPart = nextType === "TOEIC" ? "PART_1" : null;
              update("toeicPart", nextPart);
              if (isDefaultInstruction(draft.instructions)) {
                update(
                  "instructions",
                  defaultInstructions[nextPart ?? "DICTATION"],
                );
              }
              if (nextType === "TOEIC") {
                update(
                  "questions",
                  draft.questions.map((question) => ({
                    ...question,
                    options: normalizedOptions(
                      question.id,
                      question.options,
                      4,
                    ),
                  })),
                );
              }
            }}
          >
            <option>DICTATION</option>
            <option>TOEIC</option>
          </select>
        </Field>
        {draft.type === "DICTATION" ? (
          <Field label="Dictation mode *">
            <select
              value={draft.dictationMode ?? ""}
              onChange={(e) => update("dictationMode", e.target.value)}
            >
              <option>SENTENCE</option>
              <option>PARAGRAPH</option>
            </select>
          </Field>
        ) : (
          <Field label="TOEIC Part *">
            <select
              value={draft.toeicPart ?? ""}
              onChange={(e) => {
                const nextPart = e.target.value;
                const removesAuthoredOption =
                  nextPart === "PART_2" &&
                  draft.questions.some(
                    (question) =>
                      question.options[3]?.text.trim() ||
                      question.options[3]?.correct,
                  );
                if (
                  removesAuthoredOption &&
                  !globalThis.confirm(
                    "Part 2 only supports A, B, and C. Switch parts and remove authored option D?",
                  )
                ) {
                  return;
                }
                update("toeicPart", nextPart);
                update(
                  "questions",
                  draft.questions.map((question) => ({
                    ...question,
                    options: normalizedOptions(
                      question.id,
                      question.options,
                      optionCountForPart(nextPart),
                    ),
                  })),
                );
                if (isDefaultInstruction(draft.instructions)) {
                  update("instructions", defaultInstructions[nextPart]);
                }
              }}
            >
              <option>PART_1</option>
              <option>PART_2</option>
              <option>PART_3</option>
              <option>PART_4</option>
            </select>
          </Field>
        )}
        <Field label="Difficulty">
          <select
            value={draft.difficulty}
            onChange={(e) => update("difficulty", e.target.value)}
          >
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </Field>
        <Field label="Pass threshold">
          <input
            type="number"
            value={draft.passThreshold}
            onChange={(e) => update("passThreshold", Number(e.target.value))}
          />
        </Field>
        <Field label="Order">
          <input
            type="number"
            min={0}
            value={draft.orderIndex}
            onChange={(e) => update("orderIndex", Number(e.target.value))}
          />
        </Field>
        <Field label="Title *" wide>
          <input
            value={draft.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Exercise title"
          />
        </Field>
        <Field label="Instructions *" wide>
          <textarea
            value={draft.instructions}
            onChange={(e) => update("instructions", e.target.value)}
          />
        </Field>
        <Field label="Maximum listens">
          <input
            type="number"
            value={draft.maxListens}
            onChange={(e) => update("maxListens", Number(e.target.value))}
          />
        </Field>
        <Field label="Maximum attempts">
          <input
            type="number"
            value={draft.maxAttempts}
            onChange={(e) => update("maxAttempts", Number(e.target.value))}
          />
        </Field>
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
          <input
            type="checkbox"
            checked={draft.showAnswer}
            onChange={(e) => update("showAnswer", e.target.checked)}
          />
          <span>
            <strong className="block">Show answer after submit</strong>
            <span className="text-xs text-slate-500">
              Reveal authoritative answer on result.
            </span>
          </span>
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-4">
          <input
            type="checkbox"
            checked={draft.showTranscript}
            onChange={(e) => update("showTranscript", e.target.checked)}
          />
          <span>
            <strong className="block">Show transcript</strong>
            <span className="text-xs text-slate-500">
              Reveal the configured transcript to students.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "md:col-span-2 xl:col-span-3" : ""}>
      <span className="font-semibold">{label}</span>
      <div className="mt-2 [&>*]:min-h-10 [&>*]:w-full [&>*]:rounded-lg [&>*]:border [&>*]:border-slate-200 [&>*]:px-3">
        {children}
      </div>
    </label>
  );
}
function AudioStep({
  draft,
  update,
  generate,
  upload,
  ttsSettings,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  generate: () => void;
  upload: (file: File) => Promise<void>;
  ttsSettings?: TtsSettingsDto;
}) {
  const audio = useProtectedMediaUrl(draft.audioUrl);
  const ttsReady = Boolean(ttsSettings?.providerHealthy);
  if (draft.type === "TOEIC") {
    return (
      <div>
        <h2 className="text-lg font-bold">TOEIC Script & Audio</h2>
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <FileAudio className="size-7 text-blue-600" />
          <h3 className="mt-3 font-bold text-blue-950">
            Audio is configured per stimulus group
          </h3>
          <p className="mt-2 text-sm text-blue-800">
            Open Step 3 to upload or generate the playable audio for each
            photograph, question-response item, conversation, or talk.
            Exercise-wide audio is not used as a TOEIC group fallback.
          </p>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Local TTS: {ttsReady ? "Kokoro is ready on the GPU." : "Kokoro is not ready. Check TTS Settings and the tts-service container."}
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section>
        <h2 className="text-lg font-bold">Script & Audio</h2>
        <p className="text-sm text-slate-500">
          Upload audio manually or synthesize the current script with local Kokoro.
        </p>
        <div className="mt-4 flex gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700">
            <Upload className="size-4" />
            Upload manually
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void upload(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        <label className="mt-5 block">
          <span className="font-semibold">Audio script *</span>
          <textarea
            value={draft.script}
            onChange={(e) => update("script", e.target.value)}
            className="mt-2 min-h-48 w-full rounded-lg border border-slate-200 p-3"
            placeholder="Enter the exact listening script..."
          />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="TTS provider">
            <input readOnly value={ttsSettings?.provider ?? "kokoro"} />
          </Field>
          <Field label="Default voice">
            <input readOnly value={ttsSettings?.defaultVoiceId ?? "af_heart"} />
          </Field>
          <Field label="Runtime">
            <input
              readOnly
              value={
                [ttsSettings?.device, ttsSettings?.gpuName]
                  .filter(Boolean)
                  .join(" · ") || "Waiting for service"
              }
            />
          </Field>
          <Field label="Default speed">
            <input readOnly value={`${ttsSettings?.defaultSpeed ?? 1}x`} />
          </Field>
        </div>
        <Button
          className="mt-4"
          onClick={generate}
          disabled={!ttsReady || !draft.script.trim()}
          title={!ttsReady ? "Local Kokoro service is not ready" : undefined}
        >
          <Volume2 className="size-4" />
          {draft.ttsStatus === TtsJobStatus.PROCESSING
            ? "Generating…"
            : "Generate with Kokoro"}
        </Button>
      </section>
      <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">TTS Job</h3>
          <StatusBadge status={draft.ttsStatus} />
        </div>
        {[TtsJobStatus.PENDING, TtsJobStatus.PROCESSING].includes(
          draft.ttsStatus as TtsJobStatus,
        ) && (
          <div className="mt-5">
            <p className="mt-2 text-xs text-slate-500">
              Local synthesis is running in the Kokoro container.
            </p>
          </div>
        )}
        {draft.audioReady ? (
          <div className="mt-5">
            <UnifiedAudioPlayer
              compact
              sourceUrl={audio.url}
              disabled={audio.loading || Boolean(audio.error)}
            />
            {audio.error && (
              <p className="mt-2 text-xs text-red-600">{audio.error}</p>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={generate}
                disabled={!ttsReady || !draft.script.trim()}
              >
                <RefreshCcw className="size-4" />
                Regenerate
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid min-h-40 place-items-center rounded-lg border-2 border-dashed border-slate-200 bg-white text-center">
            <div>
              <FileAudio className="mx-auto size-8 text-slate-400" />
              <p className="mt-2 text-sm text-slate-500">
                No playable audio yet
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function QuestionsStep({
  draft,
  update,
  uploadGroupAudio,
  uploadGroupImage,
  uploadQuestionImage,
  generateGroupAudio,
  generateSegmentAudio,
  ttsReady,
  ttsVoices,
}: {
  draft: Draft;
  update: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  uploadGroupAudio: (groupId: string, file: File) => Promise<void>;
  uploadGroupImage: (groupId: string, file: File) => Promise<void>;
  uploadQuestionImage: (questionId: string, file: File) => Promise<void>;
  generateGroupAudio: (groupId: string) => Promise<void>;
  generateSegmentAudio: (segmentId: string) => Promise<void>;
  ttsReady: boolean;
  ttsVoices: TtsVoiceDto[];
}) {
  if (draft.type === "DICTATION")
    return (
      <div>
        <h2 className="text-lg font-bold">Dictation Answer Configuration</h2>
        <label className="mt-5 block">
          <span className="font-semibold">Correct text *</span>
          <textarea
            value={draft.correctText}
            onChange={(e) => update("correctText", e.target.value)}
            className="mt-2 min-h-40 w-full rounded-lg border border-slate-200 p-3"
          />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(
            [
              ["ignoreCase", "Ignore case"],
              ["ignorePunctuation", "Ignore punctuation"],
              ["normalizeWhitespace", "Normalize whitespace"],
              ["allowMinorTypo", "Allow minor typo"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-4"
            >
              <input
                type="checkbox"
                checked={draft[key]}
                onChange={(e) => update(key, e.target.checked)}
              />
              <strong>{label}</strong>
            </label>
          ))}
        </div>
      </div>
    );
  const newQuestion = (groupId: string, stamp: string) => {
    const questionId = `question-${stamp}`;
    return {
      id: questionId,
      groupId,
      text: "",
      options: Array.from(
        { length: optionCountForPart(draft.toeicPart) },
        (_, index) => ({
          id: `${questionId}-option-${index}`,
          text: "",
          correct: false,
        }),
      ),
    };
  };
  const addItem = () => {
    const stamp = `${Date.now()}-${draft.groups.length}`;
    const group = {
      id: `group-${stamp}`,
      title: "",
      label: "",
      sharedScript: "",
      imageMediaId: "",
      sharedAudioMediaId: "",
    };
    update("groups", [...draft.groups, group]);
    update("questions", [...draft.questions, newQuestion(group.id, stamp)]);
  };
  const addGroup = () =>
    update("groups", [
      ...draft.groups,
      {
        id: `group-${Date.now()}`,
        title: "",
        label: "",
        sharedScript: "",
        imageMediaId: "",
        sharedAudioMediaId: "",
      },
    ]);
  const addQuestionToGroup = (groupId: string) => {
    const stamp = `${Date.now()}-${draft.questions.length}`;
    update("questions", [...draft.questions, newQuestion(groupId, stamp)]);
  };
  const addSegment = () =>
    update("audioSegments", [
      ...draft.audioSegments,
      {
        id: `segment-${Date.now()}`,
        groupId: undefined,
        segmentType:
          draft.toeicPart === "PART_3" || draft.toeicPart === "PART_4"
            ? "SPEAKER"
            : "NARRATION",
        speakerKey: draft.toeicPart === "PART_4" ? "main-speaker" : "",
        speakerLabel: draft.toeicPart === "PART_4" ? "Single Speaker" : "",
        text: "",
        voiceId: "",
        language: "en-US",
        speed: 1,
        pauseAfterMs: 0,
        mediaId: "",
      },
    ]);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">
            TOEIC Groups, Questions & Answers
          </h2>
          <p className="text-sm text-slate-500">
            Each question must have exactly one correct option.
          </p>
        </div>
        {draft.toeicPart === "PART_1" || draft.toeicPart === "PART_2" ? (
          <Button onClick={addItem}>
            <Plus className="size-4" />
            Add Item
          </Button>
        ) : (
          <Button variant="secondary" onClick={addGroup}>
            <Plus className="size-4" />
            Add Group
          </Button>
        )}
      </div>
      <section className="mt-5 space-y-3">
        {draft.groups.map((group, groupIndex) => (
          <article
            key={group.id}
            className="rounded-xl border border-blue-200 bg-blue-50/30 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-blue-600 font-bold text-white">
                {groupIndex + 1}
              </span>
              <input
                aria-label={`Group ${groupIndex + 1} title`}
                value={group.title}
                onChange={(event) =>
                  update(
                    "groups",
                    draft.groups.map((item, index) =>
                      index === groupIndex
                        ? { ...item, title: event.target.value }
                        : item,
                    ),
                  )
                }
                className="h-10 flex-1 rounded-lg border border-slate-200 px-3 font-semibold"
                placeholder="Group title"
              />
              <button
                aria-label={`Delete group ${groupIndex + 1}`}
                onClick={() => {
                  update(
                    "questions",
                    draft.questions.filter(
                      (question) => question.groupId !== group.id,
                    ),
                  );
                  update(
                    "audioSegments",
                    draft.audioSegments.filter(
                      (segment) => segment.groupId !== group.id,
                    ),
                  );
                  update(
                    "groups",
                    draft.groups.filter((_, index) => index !== groupIndex),
                  );
                }}
                className="grid size-10 place-items-center text-red-500"
              >
                <Trash2 className="size-4" />
              </button>
              {(draft.toeicPart === "PART_3" ||
                draft.toeicPart === "PART_4") && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => addQuestionToGroup(group.id)}
                >
                  <Plus className="size-4" />
                  Add question
                </Button>
              )}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                aria-label={`Group ${groupIndex + 1} label`}
                value={group.label}
                onChange={(event) =>
                  update(
                    "groups",
                    draft.groups.map((item, index) =>
                      index === groupIndex
                        ? { ...item, label: event.target.value }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
                placeholder="Short label"
              />
              <ImageMediaUpload
                label={
                  draft.toeicPart === "PART_1"
                    ? `Group ${groupIndex + 1} photograph`
                    : `Group ${groupIndex + 1} graphic`
                }
                mediaId={group.imageMediaId}
                upload={(file) => uploadGroupImage(group.id, file)}
                remove={() =>
                  update(
                    "groups",
                    draft.groups.map((item, index) =>
                      index === groupIndex
                        ? { ...item, imageMediaId: "" }
                        : item,
                    ),
                  )
                }
              />
              <GroupAudioUpload
                groupIndex={groupIndex}
                mediaId={group.sharedAudioMediaId}
                upload={(file) => uploadGroupAudio(group.id, file)}
                generate={() => generateGroupAudio(group.id)}
                ttsReady={ttsReady && persistentUuid(group.id)}
                remove={() =>
                  update(
                    "groups",
                    draft.groups.map((item, index) =>
                      index === groupIndex
                        ? { ...item, sharedAudioMediaId: "" }
                        : item,
                    ),
                  )
                }
              />
              <input
                aria-label={`Group ${groupIndex + 1} shared script`}
                value={group.sharedScript}
                onChange={(event) =>
                  update(
                    "groups",
                    draft.groups.map((item, index) =>
                      index === groupIndex
                        ? { ...item, sharedScript: event.target.value }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
                placeholder="Shared script"
              />
            </div>
          </article>
        ))}
      </section>
      <div className="mt-5 space-y-4">
        {draft.questions.map((question, qIndex) => (
          <article
            className="rounded-xl border border-slate-200 p-4"
            key={question.id}
          >
            <div className="flex items-center gap-3">
              <GripVertical className="size-4 text-slate-400" />
              <span className="grid size-8 place-items-center rounded-full bg-blue-50 font-bold text-blue-600">
                {qIndex + 1}
              </span>
              <input
                aria-label={`Question ${qIndex + 1} text`}
                value={question.text}
                onChange={(e) =>
                  update(
                    "questions",
                    draft.questions.map((q, i) =>
                      i === qIndex ? { ...q, text: e.target.value } : q,
                    ),
                  )
                }
                className="h-10 flex-1 rounded-lg border border-slate-200 px-3"
                placeholder={
                  draft.toeicPart === "PART_1"
                    ? "Optional internal item note"
                    : draft.toeicPart === "PART_2"
                      ? "Spoken question or statement"
                      : "Question shown to the student"
                }
              />
              <button
                onClick={() =>
                  update(
                    "questions",
                    draft.questions.filter((_, i) => i !== qIndex),
                  )
                }
                className="grid size-10 place-items-center text-red-500"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <select
                aria-label={`Question ${qIndex + 1} group`}
                value={question.groupId ?? ""}
                onChange={(event) =>
                  update(
                    "questions",
                    draft.questions.map((item, index) =>
                      index === qIndex
                        ? {
                            ...item,
                            groupId: event.target.value || undefined,
                          }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
              >
                <option value="">No group</option>
                {draft.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.title || "Untitled group"}
                  </option>
                ))}
              </select>
              <ImageMediaUpload
                label={`Question ${qIndex + 1} graphic`}
                mediaId={question.imageMediaId ?? ""}
                upload={(file) => uploadQuestionImage(question.id, file)}
                remove={() =>
                  update(
                    "questions",
                    draft.questions.map((item, index) =>
                      index === qIndex
                        ? { ...item, imageMediaId: undefined }
                        : item,
                    ),
                  )
                }
              />
              <input
                aria-label={`Question ${qIndex + 1} explanation`}
                value={question.explanation ?? ""}
                onChange={(event) =>
                  update(
                    "questions",
                    draft.questions.map((item, index) =>
                      index === qIndex
                        ? {
                            ...item,
                            explanation: event.target.value || undefined,
                          }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3 sm:col-span-2"
                placeholder="Explanation shown after submission"
              />
              {question.options.map((option, oIndex) => (
                <label
                  key={option.id}
                  className={`flex items-center gap-2 rounded-lg border p-3 ${option.correct ? "border-green-300 bg-green-50" : "border-slate-200"}`}
                >
                  <input
                    type="radio"
                    checked={option.correct}
                    onChange={() =>
                      update(
                        "questions",
                        draft.questions.map((q, i) =>
                          i === qIndex
                            ? {
                                ...q,
                                options: q.options.map((o, j) => ({
                                  ...o,
                                  correct: j === oIndex,
                                })),
                              }
                            : q,
                        ),
                      )
                    }
                  />
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {String.fromCharCode(65 + oIndex)}
                  </span>
                  <input
                    value={option.text}
                    onChange={(e) =>
                      update(
                        "questions",
                        draft.questions.map((q, i) =>
                          i === qIndex
                            ? {
                                ...q,
                                options: q.options.map((o, j) =>
                                  j === oIndex
                                    ? { ...o, text: e.target.value }
                                    : o,
                                ),
                              }
                            : q,
                        ),
                      )
                    }
                    className="h-9 flex-1 bg-transparent outline-none"
                  />
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
      {!draft.questions.length && (
        <div className="mt-5 grid min-h-48 place-items-center rounded-xl border-2 border-dashed border-slate-200 text-center">
          <div>
            <AlertTriangle className="mx-auto size-8 text-amber-500" />
            <p className="mt-2 text-sm text-slate-500">
              Add at least one valid question.
            </p>
          </div>
        </div>
      )}
      <section className="mt-7 border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">Audio Segments</h3>
            <p className="text-sm text-slate-500">
              Persist ordered speaker, narration, question, option, and pause
              segments. Kokoro uses these segments to create multi-speaker group audio.
            </p>
          </div>
          <Button variant="secondary" onClick={addSegment}>
            <Plus className="size-4" />
            Add Segment
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {draft.audioSegments.map((segment, segmentIndex) => (
            <article
              key={segment.id}
              className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-3"
            >
              <select
                aria-label={`Segment ${segmentIndex + 1} type`}
                value={segment.segmentType}
                onChange={(event) =>
                  update(
                    "audioSegments",
                    draft.audioSegments.map((item, index) =>
                      index === segmentIndex
                        ? { ...item, segmentType: event.target.value }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
              >
                {[
                  "INTRO",
                  "NARRATION",
                  "SPEAKER",
                  "QUESTION",
                  "OPTION",
                  "PAUSE",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <select
                aria-label={`Segment ${segmentIndex + 1} group`}
                value={segment.groupId ?? ""}
                onChange={(event) =>
                  update(
                    "audioSegments",
                    draft.audioSegments.map((item, index) =>
                      index === segmentIndex
                        ? {
                            ...item,
                            groupId: event.target.value || undefined,
                            questionId: undefined,
                          }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
              >
                <option value="">Exercise level</option>
                {draft.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.title || "Untitled group"}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Segment ${segmentIndex + 1} question`}
                value={segment.questionId ?? ""}
                onChange={(event) =>
                  update(
                    "audioSegments",
                    draft.audioSegments.map((item, index) =>
                      index === segmentIndex
                        ? {
                            ...item,
                            questionId: event.target.value || undefined,
                          }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
              >
                <option value="">No question</option>
                {draft.questions
                  .filter(
                    (question) =>
                      !segment.groupId || question.groupId === segment.groupId,
                  )
                  .map((question, questionIndex) => (
                    <option key={question.id} value={question.id}>
                      {questionIndex + 1}. {question.text}
                    </option>
                  ))}
              </select>
              <input
                aria-label={`Segment ${segmentIndex + 1} speaker key`}
                value={segment.speakerKey}
                onChange={(event) =>
                  update(
                    "audioSegments",
                    draft.audioSegments.map((item, index) =>
                      index === segmentIndex
                        ? { ...item, speakerKey: event.target.value }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
                placeholder={
                  draft.toeicPart === "PART_4" ? "main-speaker" : "speaker-a"
                }
              />
              <input
                aria-label={`Segment ${segmentIndex + 1} speaker label`}
                value={segment.speakerLabel}
                onChange={(event) =>
                  update(
                    "audioSegments",
                    draft.audioSegments.map((item, index) =>
                      index === segmentIndex
                        ? { ...item, speakerLabel: event.target.value }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
                placeholder="Speaker label"
              />
              <select
                aria-label={`Segment ${segmentIndex + 1} language`}
                value={segment.language}
                onChange={(event) =>
                  update(
                    "audioSegments",
                    draft.audioSegments.map((item, index) =>
                      index === segmentIndex
                        ? {
                            ...item,
                            language: event.target.value,
                            voiceId: "",
                          }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
              </select>
              <input
                aria-label={`Segment ${segmentIndex + 1} speed`}
                type="number"
                min={0.5}
                max={2}
                step={0.05}
                value={segment.speed}
                onChange={(event) =>
                  update(
                    "audioSegments",
                    draft.audioSegments.map((item, index) =>
                      index === segmentIndex
                        ? { ...item, speed: Number(event.target.value) }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
              />
              <select
                aria-label={`Segment ${segmentIndex + 1} voice`}
                value={segment.voiceId}
                disabled={!ttsReady}
                onChange={(event) =>
                  update(
                    "audioSegments",
                    draft.audioSegments.map((item, index) =>
                      index === segmentIndex
                        ? { ...item, voiceId: event.target.value }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-lg border border-slate-200 px-3"
              >
                <option value="">Use default voice</option>
                {ttsVoices
                  .filter((voice) => voice.language === segment.language)
                  .map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name} ({voice.id})
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <input
                  aria-label={`Segment ${segmentIndex + 1} generated media`}
                  readOnly
                  value={segment.mediaId ? "Audio generated" : "No segment audio"}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={
                    !ttsReady ||
                    !persistentUuid(segment.id) ||
                    segment.segmentType === "PAUSE" ||
                    !segment.text.trim()
                  }
                  onClick={() => void generateSegmentAudio(segment.id)}
                >
                  <Volume2 className="size-4" />
                  Generate
                </Button>
              </div>
              <div className="flex gap-2">
                <input
                  aria-label={`Segment ${segmentIndex + 1} pause milliseconds`}
                  type="number"
                  min={0}
                  value={segment.pauseAfterMs}
                  onChange={(event) =>
                    update(
                      "audioSegments",
                      draft.audioSegments.map((item, index) =>
                        index === segmentIndex
                          ? {
                              ...item,
                              pauseAfterMs: Number(event.target.value),
                            }
                          : item,
                      ),
                    )
                  }
                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3"
                />
                <button
                  aria-label={`Delete segment ${segmentIndex + 1}`}
                  onClick={() =>
                    update(
                      "audioSegments",
                      draft.audioSegments.filter(
                        (_, index) => index !== segmentIndex,
                      ),
                    )
                  }
                  className="grid size-10 place-items-center text-red-500"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <textarea
                aria-label={`Segment ${segmentIndex + 1} text`}
                value={segment.text}
                onChange={(event) =>
                  update(
                    "audioSegments",
                    draft.audioSegments.map((item, index) =>
                      index === segmentIndex
                        ? { ...item, text: event.target.value }
                        : item,
                    ),
                  )
                }
                className="min-h-24 rounded-lg border border-slate-200 p-3 md:col-span-3"
                placeholder="Segment text"
              />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
function ImageMediaUpload({
  label,
  mediaId,
  upload,
  remove,
}: {
  label: string;
  mediaId: string;
  upload: (file: File) => Promise<void>;
  remove: () => void;
}) {
  const source = useProtectedMediaUrl(
    mediaId ? `/media/files/${mediaId}` : undefined,
  );
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-slate-500">
            Upload a photograph or graphic directly; no media UUID is required.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-bold">
            <Upload className="size-4" />
            {mediaId ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void upload(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {mediaId ? (
            <Button size="sm" variant="secondary" onClick={remove}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      {mediaId ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {source.url ? (
            <img
              src={source.url}
              alt={label}
              className="max-h-48 w-full object-contain"
            />
          ) : (
            <p className="p-3 text-xs text-slate-500">
              {source.loading ? "Loading image…" : source.error || "Image unavailable"}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function GroupAudioUpload({
  groupIndex,
  mediaId,
  upload,
  generate,
  ttsReady,
  remove,
}: {
  groupIndex: number;
  mediaId: string;
  upload: (file: File) => Promise<void>;
  generate: () => Promise<void>;
  ttsReady: boolean;
  remove: () => void;
}) {
  const source = useProtectedMediaUrl(
    mediaId ? `/media/files/${mediaId}` : undefined,
  );
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            Group {groupIndex + 1} playable audio
          </p>
          <p className="text-xs text-slate-500">
            Upload the complete browser-playable stimulus for this group.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-bold">
            <Upload className="size-4" />
            {mediaId ? "Replace audio" : "Upload audio"}
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void upload(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <Button
            size="sm"
            variant="secondary"
            disabled={!ttsReady}
            onClick={() => void generate()}
            title={!ttsReady ? "Save this group and make sure Kokoro is ready" : undefined}
          >
            <Volume2 className="size-4" />
            {mediaId ? "Regenerate with Kokoro" : "Generate with Kokoro"}
          </Button>
          {mediaId ? (
            <Button size="sm" variant="secondary" onClick={remove}>
              Remove audio
            </Button>
          ) : null}
        </div>
      </div>
      {mediaId ? (
        <div className="mt-3">
          <UnifiedAudioPlayer
            key={mediaId}
            compact
            sourceUrl={source.url}
            disabled={source.loading || Boolean(source.error)}
          />
          {source.error ? (
            <p className="mt-2 text-xs text-red-600">{source.error}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs font-semibold text-amber-700">
          Playable group audio is required before publishing.
        </p>
      )}
    </div>
  );
}
function PreviewStep({
  draft,
  device,
  setDevice,
}: {
  draft: Draft;
  device: string;
  setDevice: (v: string) => void;
}) {
  const question = draft.questions[0];
  const group = draft.groups.find((item) => item.id === question?.groupId);
  const imageMediaId = question?.imageMediaId || group?.imageMediaId;
  const audioSource =
    draft.type === "TOEIC"
      ? group?.sharedAudioMediaId
        ? `/media/files/${group.sharedAudioMediaId}`
        : undefined
      : draft.audioUrl;
  const audio = useProtectedMediaUrl(audioSource);
  const image = useProtectedMediaUrl(
    imageMediaId ? `/media/files/${imageMediaId}` : undefined,
  );
  const hidesSpokenText =
    draft.toeicPart === "PART_1" || draft.toeicPart === "PART_2";
  const showsGraphic = draft.toeicPart !== "PART_2";
  const width =
    device === "mobile"
      ? "max-w-sm"
      : device === "tablet"
        ? "max-w-2xl"
        : "max-w-4xl";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Student Preview</h2>
          <p className="text-sm text-slate-500">
            Preview only—publishing is available in Step 5.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-1">
          {[
            ["desktop", Monitor],
            ["tablet", Tablet],
            ["mobile", Smartphone],
          ].map(([name, Icon]) => (
            <button
              key={name as string}
              onClick={() => setDevice(name as string)}
              className={`grid size-10 place-items-center rounded-md ${device === name ? "bg-blue-600 text-white" : "text-slate-500"}`}
              aria-label={`${name} preview`}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>
      <div className={`mx-auto mt-5 transition-all ${width}`}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-6">
          <div className="rounded-xl bg-[#0f2a66] p-5 text-white">
            <StatusBadge status={draft.type} />
            <h3 className="mt-3 text-xl font-bold">
              {draft.title || "Untitled listening exercise"}
            </h3>
            <p className="mt-1 text-sm text-blue-100">{draft.instructions}</p>
          </div>
          <div className="mt-4">
            <UnifiedAudioPlayer
              sourceUrl={audio.url}
              disabled={!audioSource || audio.loading || Boolean(audio.error)}
            />
            {!audioSource && (
              <p className="mt-2 text-xs text-amber-700">
                Audio is not available yet.
              </p>
            )}
            {audio.error && (
              <p className="mt-2 text-xs text-red-600">{audio.error}</p>
            )}
          </div>
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
            {draft.type === "DICTATION" ? (
              <>
                <h4 className="font-bold">Type what you hear</h4>
                <textarea
                  className="mt-3 min-h-32 w-full rounded-lg border border-slate-200 p-3"
                  placeholder="Student answer..."
                />
              </>
            ) : (
              <>
                {showsGraphic && image.url && (
                  <img
                    src={image.url}
                    alt="Current draft question graphic"
                    className="max-h-80 w-full rounded-lg border border-slate-200 object-contain"
                  />
                )}
                {showsGraphic && !image.url && (
                  <div className="grid min-h-36 place-items-center rounded-lg border-2 border-dashed border-slate-200 text-sm text-slate-500">
                    No graphic selected
                  </div>
                )}
                {!hidesSpokenText && (
                  <h4 className="mt-4 font-bold">
                    {question?.text || "No question text entered"}
                  </h4>
                )}
                {(question?.options ?? []).map((option, index) => (
                  <div
                    key={option.id}
                    className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    <span className="grid size-7 place-items-center rounded-full border border-slate-300 text-xs font-bold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {!hidesSpokenText && (
                      <span>{option.text || "No option text entered"}</span>
                    )}
                  </div>
                ))}
                {!question && (
                  <p className="text-sm text-slate-500">
                    No question has been added to this draft.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
function PublishStep({
  checklist,
  go,
  complete,
  publish,
  archive,
  save,
}: {
  checklist: { label: string; valid: boolean; step: string }[];
  go: (s: string) => void;
  complete: boolean;
  publish: () => Promise<unknown>;
  archive: () => Promise<void>;
  save: () => Promise<void>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <section>
        <h2 className="text-lg font-bold">Publish Checklist</h2>
        <p className="text-sm text-slate-500">
          Every required item must pass before publishing.
        </p>
        <div className="mt-5 space-y-2">
          {checklist.map((item) => (
            <button
              key={item.label}
              onClick={() => go(item.step)}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
            >
              {item.valid ? (
                <CheckCircle2 className="size-5 text-green-500" />
              ) : (
                <AlertTriangle className="size-5 text-amber-500" />
              )}
              <strong className="flex-1">{item.label}</strong>
              <span
                className={`text-xs font-bold ${item.valid ? "text-green-600" : "text-amber-600"}`}
              >
                {item.valid ? "READY" : "FIX"}
              </span>
            </button>
          ))}
        </div>
      </section>
      <aside
        className={`rounded-xl border p-5 ${complete ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}
      >
        <h3 className="font-bold">Publication status</h3>
        <p className="mt-2 text-sm text-slate-600">
          {complete
            ? "The exercise is ready for students."
            : "Complete the highlighted checklist items."}
        </p>
        <div className="mt-5 space-y-2">
          <Button
            className="w-full"
            disabled={!complete}
            onClick={() => void publish()}
          >
            Publish
          </Button>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => void save()}
          >
            Save Draft
          </Button>
          <Button
            className="w-full"
            variant="danger"
            onClick={() => void archive()}
          >
            Archive
          </Button>
        </div>
      </aside>
    </div>
  );
}

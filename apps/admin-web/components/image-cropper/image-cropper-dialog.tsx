"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Crop, RotateCw, Undo2, Upload, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ImageCropPreset } from "./image-crop-presets";
import {
  cropGeometry,
  exportCrop,
  initialCrop,
  loadCropImage,
  paintCrop,
  type CropState,
} from "./image-crop-utils";
export function ImageCropperDialog({
  file,
  preset,
  maxBytes,
  onConfirm,
  onCancel,
}: {
  file: File;
  preset: ImageCropPreset;
  maxBytes: number;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("imageCropper");
  const [source, setSource] = useState<Awaited<
      ReturnType<typeof loadCropImage>
    > | null>(null),
    [state, setState] = useState<CropState>(initialCrop),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    alive = useRef(true),
    pointer = useRef<{
      id: number;
      x: number;
      y: number;
      state: CropState;
    } | null>(null),
    replacement = useRef<HTMLInputElement>(null),
    [localFile, setLocalFile] = useState(file);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false,
      resource: Awaited<ReturnType<typeof loadCropImage>> | null = null;
    setSource(null);
    setError("");
    setState(initialCrop);
    void loadCropImage(localFile)
      .then((value) => {
        resource = value;
        if (cancelled) value.dispose();
        else setSource(value);
      })
      .catch((e) => {
        if (!cancelled) setError(t(e instanceof Error ? e.message : "decode"));
      });
    return () => {
      cancelled = true;
      resource?.dispose();
    };
  }, [localFile, t]);
  useEffect(() => {
    const target = canvas.current;
    if (source && target) {
      try {
        paintCrop(target, source.image, preset, state, true);
      } catch {
        setError(t("canvas"));
      }
    }
    return () => {
      if (target) {
        target.width = 0;
        target.height = 0;
      }
    };
  }, [source, preset, state, t]);
  const geometry = source
    ? cropGeometry(
        source.image.naturalWidth,
        source.image.naturalHeight,
        preset,
        state,
      )
    : null;
  const update = (key: "zoom" | "x" | "y", value: number) => {
    setError("");
    setState((previous) => ({ ...previous, [key]: value }));
  };
  async function confirm() {
    if (!source || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await exportCrop(localFile, source.image, preset, state);
      if (result.size > maxBytes) throw new Error("fileSize");
      if (alive.current) onConfirm(result);
    } catch (cause) {
      if (alive.current) {
        setError(
          t(
            cause instanceof Error && cause.message === "fileSize"
              ? "fileSize"
              : "canvas",
          ),
        );
        setSaving(false);
      }
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent
        className="z-[70] max-w-3xl gap-4 rounded-xl p-4 sm:p-6"
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="size-5 text-blue-600" aria-hidden />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="grid min-w-0 gap-4 sm:grid-cols-[1fr_9rem]">
          <div className="flex min-h-48 min-w-0 items-center justify-center overflow-hidden rounded-lg border border-slate-300 bg-slate-100 p-2 sm:min-h-72">
            {!source && !error ? (
              <span role="status" className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                {t("loading")}
              </span>
            ) : (
              source && (
                <div className="relative max-w-full" style={{ lineHeight: 0 }}>
                  <canvas
                    ref={canvas}
                    aria-label={t("preview")}
                    tabIndex={0}
                    className="max-h-[40dvh] max-w-full touch-none cursor-move rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    style={{
                      borderRadius:
                        preset.shape === "round" ? "50%" : undefined,
                    }}
                    onPointerDown={(event) => {
                      if (saving) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      pointer.current = {
                        id: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        state,
                      };
                    }}
                    onPointerUp={() => {
                      pointer.current = null;
                    }}
                    onPointerCancel={() => {
                      pointer.current = null;
                    }}
                    onPointerMove={(event) => {
                      const p = pointer.current;
                      if (!p || p.id !== event.pointerId || !geometry) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      setState({
                        ...p.state,
                        x: Math.max(
                          0,
                          Math.min(
                            1,
                            p.state.x -
                              ((event.clientX - p.x) * geometry.cw) /
                                (rect.width *
                                  Math.max(1, geometry.rw - geometry.cw)),
                          ),
                        ),
                        y: Math.max(
                          0,
                          Math.min(
                            1,
                            p.state.y -
                              ((event.clientY - p.y) * geometry.ch) /
                                (rect.height *
                                  Math.max(1, geometry.rh - geometry.ch)),
                          ),
                        ),
                      });
                    }}
                    onKeyDown={(event) => {
                      const directions: Record<string, [number, number]> = {
                        ArrowLeft: [-0.02, 0],
                        ArrowRight: [0.02, 0],
                        ArrowUp: [0, -0.02],
                        ArrowDown: [0, 0.02],
                      };
                      const move = directions[event.key];
                      if (move) {
                        event.preventDefault();
                        setState((previous) => ({
                          ...previous,
                          x: Math.max(0, Math.min(1, previous.x + move[0])),
                          y: Math.max(0, Math.min(1, previous.y + move[1])),
                        }));
                      }
                    }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 overflow-hidden rounded-sm"
                  >
                    {Array.from({ length: 9 }, (_, index) => (
                      <span key={index} className="border border-white/30" />
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
          <aside className="flex items-center gap-3 sm:flex-col sm:items-stretch">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-medium text-slate-500">
                {t("original")}
              </p>
              {source && (
                <img
                  src={source.url}
                  alt={t("original")}
                  className="h-20 w-full rounded-md border bg-slate-50 object-contain sm:h-28"
                />
              )}
            </div>
            <div className="text-xs leading-6 text-slate-600">
              <p className="break-all">{localFile.name}</p>
              {source && (
                <p>
                  {source.image.naturalWidth} × {source.image.naturalHeight}
                </p>
              )}
              <p className="font-medium text-slate-900">
                {t("output")}:{" "}
                {geometry ? `${geometry.width} × ${geometry.height}` : "—"}
              </p>
            </div>
          </aside>
        </div>
        {geometry?.small && (
          <p
            role="status"
            className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {t("small")}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          {(["zoom", "x", "y"] as const).map((key) => (
            <label
              key={key}
              className="space-y-2 text-xs font-medium text-slate-700"
            >
              {t(key)}
              <input
                type="range"
                aria-label={t(key)}
                min={key === "zoom" ? 1 : 0}
                max={key === "zoom" ? 4 : 1}
                step="0.01"
                value={state[key]}
                disabled={!source || saving}
                onChange={(event) => update(key, Number(event.target.value))}
                className="block h-8 w-full accent-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={saving || !source}
            onClick={() => setState(initialCrop)}
          >
            <Undo2 aria-hidden />
            {t("reset")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving || !source}
            onClick={() =>
              setState((previous) => ({
                ...initialCrop,
                rotation: (previous.rotation + 90) % 360,
              }))
            }
          >
            <RotateCw aria-hidden />
            {t("rotate")}
          </Button>
          <input
            ref={replacement}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const next = event.target.files?.[0];
              event.target.value = "";
              if (next) {
                if (!next.size || next.size > maxBytes) {
                  setError(t("fileSize"));
                  return;
                }
                setLocalFile(next);
              }
            }}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => replacement.current?.click()}
          >
            <Upload aria-hidden />
            {t("choose")}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={!source || saving || !!error}
              onClick={() => void confirm()}
            >
              {saving && <Loader2 className="animate-spin" aria-hidden />}
              {t("confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

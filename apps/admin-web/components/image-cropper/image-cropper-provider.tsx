"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useId,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { ImageCropperDialog } from "./image-cropper-dialog";
import {
  RASTER_TYPES,
  checkRasterHeader,
  validateImageFile,
} from "./image-crop-utils";
import type { ImageCropPreset } from "./image-crop-presets";
type Request = {
  id: number;
  file: File;
  preset: ImageCropPreset;
  owner: string;
  maxBytes: number;
  resolve: (value: File | null) => void;
};
type CropContext = {
  choose: (
    file: File,
    preset: ImageCropPreset,
    owner: string,
    maxBytes: number,
  ) => Promise<File | null>;
  cancel: (owner: string) => void;
};
const Context = createContext<CropContext | null>(null);
export function ImageCropperProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation("imageCropper");
  const [request, setRequest] = useState<Request | null>(null);
  const active = useRef<Request | null>(null),
    generation = useRef(0),
    pendingOwner = useRef<string | null>(null);
  const finish = useCallback((value: File | null) => {
    generation.current++;
    pendingOwner.current = null;
    const previous = active.current;
    active.current = null;
    setRequest(null);
    previous?.resolve(value);
  }, []);
  const cancel = useCallback(
    (owner: string) => {
      if (active.current?.owner === owner || pendingOwner.current === owner)
        finish(null);
    },
    [finish],
  );
  const choose = useCallback(
    async (
      file: File,
      preset: ImageCropPreset,
      owner: string,
      maxBytes: number,
    ) => {
      try {
        validateImageFile(file, maxBytes);
      } catch (error) {
        throw new Error(t(error instanceof Error ? error.message : "decode"));
      }
      finish(null);
      const version = generation.current;
      pendingOwner.current = owner;
      // Vector, GIF and ICO retain the original upload flow; never flatten them through canvas.
      if (!RASTER_TYPES.includes(file.type)) return file;
      try {
        await checkRasterHeader(file);
      } catch (error) {
        if (error instanceof Error && error.message === "animated")
          return generation.current === version ? file : null;
        throw new Error(t(error instanceof Error ? error.message : "decode"));
      }
      if (generation.current !== version) return null;
      return new Promise<File | null>((resolve) => {
        const next = { id: version, file, preset, owner, maxBytes, resolve };
        active.current = next;
        setRequest(next);
      });
    },
    [finish, t],
  );
  useEffect(
    () => () => {
      active.current?.resolve(null);
      active.current = null;
      generation.current++;
    },
    [],
  );
  return (
    <Context.Provider value={{ choose, cancel }}>
      {children}
      {request && (
        <ImageCropperDialog
          key={request.id}
          file={request.file}
          preset={request.preset}
          maxBytes={request.maxBytes}
          onConfirm={(value) => finish(value)}
          onCancel={() => finish(null)}
        />
      )}
    </Context.Provider>
  );
}
/** Owner teardown cancels a pending crop so closing its form cannot start a late upload. */
export function useImageCropper() {
  const context = useContext(Context),
    owner = useId();
  if (!context) throw Error("ImageCropperProvider is required");
  const { choose, cancel } = context;
  useEffect(() => () => cancel(owner), [cancel, owner]);
  return useCallback(
    (file: File, preset: ImageCropPreset, maxBytes = 5 * 1024 * 1024) =>
      choose(file, preset, owner, maxBytes),
    [choose, owner],
  );
}

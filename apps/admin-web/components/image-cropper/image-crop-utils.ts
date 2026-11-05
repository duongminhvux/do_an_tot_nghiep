import type { ImageCropPreset } from "./image-crop-presets";
export const RASTER_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_SOURCE_PIXELS = 40_000_000,
  MAX_SOURCE_EDGE = 16384;
export type CropState = {
  zoom: number;
  x: number;
  y: number;
  rotation: number;
};
export const initialCrop: CropState = { zoom: 1, x: 0.5, y: 0.5, rotation: 0 };
export function cropGeometry(
  width: number,
  height: number,
  preset: ImageCropPreset,
  state: CropState,
) {
  const swapped = state.rotation % 180 !== 0,
    rw = swapped ? height : width,
    rh = swapped ? width : height;
  const ratio =
    preset.aspectRatio === "original" ? rw / rh : preset.aspectRatio;
  if (
    !Number.isFinite(ratio) ||
    ratio <= 0 ||
    !Number.isInteger(preset.outputWidth) ||
    !Number.isInteger(preset.outputHeight) ||
    preset.outputWidth < 1 ||
    preset.outputHeight < 1 ||
    preset.outputWidth > 4096 ||
    preset.outputHeight > 4096
  )
    throw Error("Invalid crop preset");
  const cw = Math.min(rw, rh * ratio) / Math.max(1, Math.min(4, state.zoom)),
    ch = cw / ratio;
  const scale = Math.min(1, preset.outputWidth / cw, preset.outputHeight / ch);
  return {
    rw,
    rh,
    cw,
    ch,
    left: Math.max(0, Math.min(1, state.x)) * (rw - cw),
    top: Math.max(0, Math.min(1, state.y)) * (rh - ch),
    width: Math.max(1, Math.round(cw * scale)),
    height: Math.max(1, Math.round(ch * scale)),
    small: cw < preset.outputWidth && ch < preset.outputHeight,
  };
}
export function validateImageFile(file: File, maxBytes: number) {
  if (file.size === 0 || file.size > maxBytes) throw Error("fileSize");
  if (
    ![
      ...RASTER_TYPES,
      "image/svg+xml",
      "image/gif",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ].includes(file.type)
  )
    throw Error("fileType");
}
/** Reject oversized raster headers before browser decoding (no full-size rotation canvas). */
export async function checkRasterHeader(file: File) {
  const b = new Uint8Array(await file.arrayBuffer()),
    v = new DataView(b.buffer);
  let width = 0,
    height = 0;
  if (
    file.type === "image/png" &&
    b.length >= 24 &&
    v.getUint32(0) === 0x89504e47 &&
    v.getUint32(4) === 0x0d0a1a0a
  ) {
    width = v.getUint32(16);
    height = v.getUint32(20);
  } else if (file.type === "image/jpeg" && b[0] === 255 && b[1] === 216) {
    let i = 2;
    while (i + 8 < b.length) {
      if (b[i] !== 255) break;
      while (i < b.length && b[i] === 255) i++;
      if (i + 7 >= b.length) break;
      const marker = v.getUint8(i++);
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const size = v.getUint16(i);
      if (size < 2 || i + size > b.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        height = v.getUint16(i + 3);
        width = v.getUint16(i + 5);
        break;
      }
      i += size;
    }
  } else if (
    file.type === "image/webp" &&
    b.length >= 25 &&
    v.getUint32(0) === 0x52494646 &&
    v.getUint32(8) === 0x57454250
  ) {
    const kind = String.fromCharCode(...b.slice(12, 16));
    if (kind === "VP8X" && b.length >= 30) {
      if (v.getUint8(20) & 2) throw Error("animated");
      width =
        1 + v.getUint8(24) + (v.getUint8(25) << 8) + (v.getUint8(26) << 16);
      height =
        1 + v.getUint8(27) + (v.getUint8(28) << 8) + (v.getUint8(29) << 16);
    } else if (
      kind === "VP8 " &&
      b.length >= 30 &&
      b[23] === 0x9d &&
      v.getUint8(24) === 0x01 &&
      v.getUint8(25) === 0x2a
    ) {
      width = v.getUint16(26, true) & 0x3fff;
      height = v.getUint16(28, true) & 0x3fff;
    } else if (kind === "VP8L" && v.getUint8(20) === 0x2f) {
      const bits = v.getUint32(21, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
  }
  if (!width || !height) throw Error("decode");
  if (
    width * height > MAX_SOURCE_PIXELS ||
    Math.max(width, height) > MAX_SOURCE_EDGE
  )
    throw Error("dimensions");
  // APNG must keep its animation, just like GIF.
  if (file.type === "image/png") {
    let i = 8;
    while (i + 12 <= b.length) {
      const n = v.getUint32(i),
        type = v.getUint32(i + 4);
      if (type === 0x6163544c) throw Error("animated");
      if (n > b.length - i - 12) break;
      i += n + 12;
    }
  }
}
export async function loadCropImage(file: File) {
  await checkRasterHeader(file);
  const url = URL.createObjectURL(file),
    image = new Image();
  image.src = url;
  try {
    await image.decode();
    if (
      !image.naturalWidth ||
      image.naturalWidth * image.naturalHeight > MAX_SOURCE_PIXELS ||
      Math.max(image.naturalWidth, image.naturalHeight) > MAX_SOURCE_EDGE
    )
      throw Error("dimensions");
    return {
      image,
      url,
      dispose: () => {
        image.src = "";
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    image.src = "";
    URL.revokeObjectURL(url);
    throw error;
  }
}
export function paintCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  preset: ImageCropPreset,
  state: CropState,
  preview = false,
) {
  const g = cropGeometry(
      image.naturalWidth,
      image.naturalHeight,
      preset,
      state,
    ),
    factor = preview ? Math.min(1, 640 / g.width, 480 / g.height) : 1;
  canvas.width = Math.max(1, Math.round(g.width * factor));
  canvas.height = Math.max(1, Math.round(g.height * factor));
  const c = canvas.getContext("2d");
  if (!c) throw Error("canvas");
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.scale(canvas.width / g.cw, canvas.height / g.ch);
  c.translate(-g.left, -g.top);
  c.translate(g.rw / 2, g.rh / 2);
  c.rotate((state.rotation * Math.PI) / 180);
  c.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return g;
}
export async function exportCrop(
  file: File,
  image: HTMLImageElement,
  preset: ImageCropPreset,
  state: CropState,
) {
  const canvas = document.createElement("canvas");
  try {
    paintCrop(canvas, image, preset, state);
    const format =
      file.type === "image/png" ? "image/png" : preset.format || "image/webp";
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(Error("canvas"))),
        format,
        preset.quality ?? 0.9,
      ),
    );
    const ext =
      blob.type === "image/png"
        ? "png"
        : blob.type === "image/webp"
          ? "webp"
          : "jpg";
    return new File(
      [blob],
      file.name.replace(/\.[^.]+$/, "") + "-cropped." + ext,
      { type: blob.type, lastModified: Date.now() },
    );
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

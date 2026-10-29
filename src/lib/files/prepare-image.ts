import { detectKind, readHead } from "@/lib/files/detect-type";

export const MAX_IMAGE_MB = 20;

export type PreparedImage = { bytes: Uint8Array; format: "png" | "jpeg"; width: number; height: number };
export type PrepareResult = { ok: true; image: PreparedImage } | { ok: false; message: string };

// Reads the EXIF orientation (1-8) from a JPEG, or 1 when absent.
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
      // "Exif\0\0" then a TIFF header: byte order, magic, offset to the first directory.
      const tiff = offset + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const dir = tiff + view.getUint32(tiff + 4, little);
      const entries = view.getUint16(dir, little);
      for (let i = 0; i < entries; i++) {
        const entry = dir + 2 + i * 12;
        if (entry + 10 > view.byteLength) break;
        if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00) return 1;
    offset += 2 + length;
  }
  return 1;
}

async function encode(bitmap: ImageBitmap, type: "image/png" | "image/jpeg") {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob(type === "image/jpeg" ? { type, quality: 0.92 } : { type });
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Checks an image by its actual content and returns PDF-ready bytes (PNG or JPEG).
 * Other formats are converted to PNG; JPEGs with an orientation tag are re-drawn
 * upright, because PDFs ignore that tag while browsers obey it.
 */
export async function prepareImage(file: File): Promise<PrepareResult> {
  if (file.size === 0) return { ok: false, message: "This image file is empty." };
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) return { ok: false, message: `Images can be up to ${MAX_IMAGE_MB} MB.` };

  const kind = detectKind(await readHead(file));
  if (!["png", "jpeg", "webp", "gif", "bmp"].includes(kind)) {
    return { ok: false, message: "This file isn't a supported image. Use PNG, JPG, WEBP, GIF or BMP." };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file); // applies the orientation tag, as the user expects
  } catch {
    return { ok: false, message: "This image couldn't be opened. It may be damaged." };
  }

  try {
    const original = new Uint8Array(await file.arrayBuffer());
    if (kind === "png") return { ok: true, image: { bytes: original, format: "png", width: bitmap.width, height: bitmap.height } };
    if (kind === "jpeg") {
      const upright = jpegOrientation(original) <= 1;
      const bytes = upright ? original : await encode(bitmap, "image/jpeg");
      return { ok: true, image: { bytes, format: "jpeg", width: bitmap.width, height: bitmap.height } };
    }
    // WEBP, GIF (first frame) and BMP become PNG, which PDFs support without quality loss.
    return { ok: true, image: { bytes: await encode(bitmap, "image/png"), format: "png", width: bitmap.width, height: bitmap.height } };
  } finally {
    bitmap.close();
  }
}

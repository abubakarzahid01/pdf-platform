import type { ImageRecoder, SourceImage } from "@/lib/pdf/operations/compress";

function toImageData(image: Extract<SourceImage, { kind: "raw" }>) {
  const rgba = new Uint8ClampedArray(image.width * image.height * 4);
  for (let p = 0, s = 0; p < rgba.length; p += 4, s += image.components) {
    const r = image.pixels[s];
    rgba[p] = r;
    rgba[p + 1] = image.components === 3 ? image.pixels[s + 1] : r;
    rgba[p + 2] = image.components === 3 ? image.pixels[s + 2] : r;
    rgba[p + 3] = 255;
  }
  return new ImageData(rgba, image.width, image.height);
}

// Re-encodes images with the browser's own decoder and JPEG encoder (canvas).
export const browserRecoder: ImageRecoder = async (image, maxSide, quality) => {
  // PDF viewers ignore JPEG orientation (EXIF) tags, so the browser must too,
  // otherwise the recompressed image could appear rotated.
  const options = { imageOrientation: "none" } as unknown as ImageBitmapOptions;
  let bitmap: ImageBitmap;
  try {
    bitmap =
      image.kind === "jpeg"
        ? await createImageBitmap(new Blob([image.bytes as BlobPart], { type: "image/jpeg" }), options)
        : await createImageBitmap(toImageData(image), options);
  } catch {
    return null; // the browser couldn't decode it; leave the original
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height, components: 3 };
};

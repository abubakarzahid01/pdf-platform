import { unzlibSync } from "fflate";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, type PDFObject } from "pdf-lib";
import { baseName, type InputPdf, type OutputFile } from "./types";

export type CompressLevel = "low" | "recommended" | "high";

// Target resolution relative to the largest page, and JPEG quality (0-1).
export const levelSettings: Record<CompressLevel, { dpi: number; quality: number }> = {
  low: { dpi: 200, quality: 0.85 },
  recommended: { dpi: 150, quality: 0.72 },
  high: { dpi: 96, quality: 0.55 },
};

export type SourceImage =
  | { kind: "jpeg"; bytes: Uint8Array; width: number; height: number }
  // Decoded 8-bit pixels: 1 component (grey) or 3 (RGB) per pixel.
  | { kind: "raw"; pixels: Uint8Array; width: number; height: number; components: 1 | 3 };

export type RecodedImage = { bytes: Uint8Array; width: number; height: number; components: 1 | 3 };

/**
 * Re-encodes an image as JPEG, scaled down to fit within maxSide pixels.
 * Supplied by the caller: the browser uses canvas, tests use a pure-JS encoder.
 * Return null to leave the image unchanged.
 */
export type ImageRecoder = (image: SourceImage, maxSide: number, quality: number) => Promise<RecodedImage | null>;

export type CompressStats = { imagesFound: number; imagesRecompressed: number; originalSize: number; newSize: number };

// Images smaller than this aren't worth recompressing.
const MIN_IMAGE_BYTES = 20 * 1024;
// A recompressed image must save at least this share to replace the original.
const MIN_SAVING = 0.1;
// The whole file must shrink by at least this share, otherwise the original is kept.
const MIN_FILE_SAVING = 0.03;

function name(dict: PDFDict, key: string) {
  const value = dict.lookup(PDFName.of(key));
  return value instanceof PDFName ? value.asString() : undefined;
}

function number(dict: PDFDict, key: string) {
  const value = dict.lookup(PDFName.of(key));
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

// Number of colour components, or undefined for colour spaces we don't convert
// (CMYK, indexed, Lab, ...). ICC-based spaces with 1 or 3 components are treated as grey/RGB.
function components(dict: PDFDict, lookup: (o: PDFObject) => PDFObject | undefined): 1 | 3 | undefined {
  const cs = dict.lookup(PDFName.of("ColorSpace"));
  if (cs instanceof PDFName) {
    if (cs.asString() === "/DeviceRGB") return 3;
    if (cs.asString() === "/DeviceGray") return 1;
    return undefined;
  }
  if (cs instanceof PDFArray && cs.size() === 2 && cs.get(0) === PDFName.of("ICCBased")) {
    const profile = lookup(cs.get(1));
    const n = profile instanceof PDFRawStream ? number(profile.dict, "N") : undefined;
    return n === 3 ? 3 : n === 1 ? 1 : undefined;
  }
  return undefined;
}

// Returns the image in a form the recoder understands, or null if it should be left alone.
function readImage(stream: PDFRawStream, lookup: (o: PDFObject) => PDFObject | undefined): SourceImage | null {
  const dict = stream.dict;
  if (name(dict, "Subtype") !== "/Image") return null;
  if (stream.contents.length < MIN_IMAGE_BYTES) return null;
  // Transparency, masks, decode arrays and non-8-bit images are left untouched.
  if (dict.has(PDFName.of("SMask")) || dict.has(PDFName.of("Mask")) || dict.has(PDFName.of("Decode"))) return null;
  if (dict.lookup(PDFName.of("ImageMask"))?.toString() === "true") return null;
  if (number(dict, "BitsPerComponent") !== 8) return null;

  const width = number(dict, "Width");
  const height = number(dict, "Height");
  const comps = components(dict, lookup);
  if (!width || !height || !comps) return null;

  const filter = dict.lookup(PDFName.of("Filter"));
  const filterName =
    filter instanceof PDFName ? filter.asString() : filter instanceof PDFArray && filter.size() === 1 ? filter.get(0).toString() : undefined;

  if (filterName === "/DCTDecode") return { kind: "jpeg", bytes: stream.contents, width, height };

  if (filterName === "/FlateDecode") {
    // PNG-style predictors would need un-filtering; skip those images.
    if (dict.has(PDFName.of("DecodeParms"))) return null;
    try {
      const pixels = unzlibSync(stream.contents);
      if (pixels.length !== width * height * comps) return null;
      return { kind: "raw", pixels, width, height, components: comps };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Shrinks the images inside a PDF. Text and vector graphics are not changed.
 * Never returns a larger file: if the saving is too small, the original bytes are returned with a note.
 */
export async function compressPdf(
  input: InputPdf,
  level: CompressLevel,
  recode: ImageRecoder,
): Promise<OutputFile & { stats: CompressStats }> {
  const doc = await PDFDocument.load(input.bytes);
  const { dpi, quality } = levelSettings[level];

  // An image never needs more pixels than would cover the largest page at the target DPI.
  const largestSideInches = Math.max(...doc.getPages().map((p) => Math.max(p.getWidth(), p.getHeight()))) / 72;
  const maxSide = Math.round(largestSideInches * dpi);

  const lookup = (o: PDFObject) => (o instanceof PDFRef ? doc.context.lookup(o) : o);
  let imagesFound = 0;
  let imagesRecompressed = 0;

  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream) || name(object.dict, "Subtype") !== "/Image") continue;
    imagesFound++;
    const image = readImage(object, lookup);
    if (!image) continue;

    const recoded = await recode(image, maxSide, quality);
    if (!recoded || recoded.bytes.length > object.contents.length * (1 - MIN_SAVING)) continue;

    const dict = doc.context.obj({
      Type: "XObject",
      Subtype: "Image",
      Width: recoded.width,
      Height: recoded.height,
      ColorSpace: recoded.components === 3 ? "DeviceRGB" : "DeviceGray",
      BitsPerComponent: 8,
      Filter: "DCTDecode",
      Length: recoded.bytes.length,
    });
    // Keep optional properties that don't depend on the pixel data.
    for (const key of ["Interpolate", "Intent", "OC", "Metadata"]) {
      const value = object.dict.get(PDFName.of(key));
      if (value) dict.set(PDFName.of(key), value);
    }
    doc.context.assign(ref, PDFRawStream.of(dict, recoded.bytes));
    imagesRecompressed++;
  }

  const bytes = await doc.save({ useObjectStreams: true });
  const originalSize = input.bytes.length;
  const pageCount = doc.getPageCount();
  const outName = `${baseName(input.name)}-compressed.pdf`;

  if (bytes.length > originalSize * (1 - MIN_FILE_SAVING)) {
    return {
      name: input.name,
      bytes: input.bytes,
      pageCount,
      unchanged: true,
      note: "This PDF is already well optimised. Compressing it wouldn't make it noticeably smaller, so your original file is unchanged.",
      stats: { imagesFound, imagesRecompressed: 0, originalSize, newSize: originalSize },
    };
  }

  const saved = Math.round((1 - bytes.length / originalSize) * 100);
  return {
    name: outName,
    bytes,
    pageCount,
    note: `${saved}% smaller. ${imagesRecompressed} of ${imagesFound} image${imagesFound === 1 ? "" : "s"} recompressed; text and vector graphics unchanged.`,
    stats: { imagesFound, imagesRecompressed, originalSize, newSize: bytes.length },
  };
}

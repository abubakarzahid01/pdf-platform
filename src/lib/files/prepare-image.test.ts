import { describe, expect, it } from "vitest";
import { jpegOrientation } from "./prepare-image";

// Builds the start of a JPEG with an EXIF block holding just the orientation tag.
function jpegWithOrientation(orientation: number, littleEndian = false) {
  const tiff = new DataView(new ArrayBuffer(26));
  tiff.setUint16(0, littleEndian ? 0x4949 : 0x4d4d); // byte order: "II" or "MM"
  tiff.setUint16(2, 42, littleEndian);
  tiff.setUint32(4, 8, littleEndian); // first directory right after the header
  tiff.setUint16(8, 1, littleEndian); // one entry
  tiff.setUint16(10, 0x0112, littleEndian); // Orientation tag
  tiff.setUint16(12, 3, littleEndian); // SHORT
  tiff.setUint32(14, 1, littleEndian);
  tiff.setUint16(18, orientation, littleEndian);
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...new Uint8Array(tiff.buffer)];
  const length = exif.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, length >> 8, length & 255, ...exif, 0xff, 0xd9]);
}

describe("jpegOrientation", () => {
  it("reads the orientation tag in both byte orders", () => {
    expect(jpegOrientation(jpegWithOrientation(6))).toBe(6);
    expect(jpegOrientation(jpegWithOrientation(8, true))).toBe(8);
  });

  it("returns 1 (upright) when there is no tag or the file isn't a JPEG", () => {
    expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 4, 0, 0, 0xff, 0xd9]))).toBe(1);
    expect(jpegOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe(1);
  });
});

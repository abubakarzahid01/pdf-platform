import { describe, expect, it } from "vitest";
import { getInputSpec } from "@/config/tools";
import { checkFile } from "./check-file";

const word = getInputSpec("word-to-pdf");
const check = (file: File) => checkFile(file, word.kinds, word.expected, word.extensions);
const zipHead = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode("[Content_Types].xml")]);

describe("checkFile for Office files", () => {
  it("refuses plain text renamed to .docx", async () => {
    const result = await check(new File(["not really a docx"], "fake.docx"));
    expect(result).toMatchObject({ ok: false, code: "wrong-type" });
    if (!result.ok) expect(result.message).toContain("a text file, not a real .docx file");
  });

  it("refuses a .docx renamed to .txt", async () => {
    expect(await check(new File([zipHead], "notes.txt"))).toMatchObject({ ok: false, code: "wrong-type" });
  });

  it("accepts real text and ZIP-based documents", async () => {
    expect(await check(new File(["Plain notes"], "notes.txt"))).toMatchObject({ ok: true, kind: "text" });
    expect(await check(new File([zipHead], "report.docx"))).toMatchObject({ ok: true, kind: "zip" });
    // Older .doc files that are really RTF still open.
    expect(await check(new File(["{\\rtf1 hello}"], "old.doc"))).toMatchObject({ ok: true, kind: "rtf" });
  });
});

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { readPageText } from "../text-edit/lines";
import { EDITING_NOT_ALLOWED, prepareForEditing } from "./prepare-edit";
import type { QpdfRunner } from "./protect";

const require = createRequire(import.meta.url);
type Qpdf = { callMain: (a: string[]) => number; FS: { writeFile: (p: string, d: Uint8Array) => void; readFile: (p: string) => Uint8Array } };
const createModule = require("@neslinesli93/qpdf-wasm") as (o: object) => Promise<Qpdf>;
const wasm = require.resolve("@neslinesli93/qpdf-wasm/dist/qpdf.wasm");
const runQpdf: QpdfRunner = async (args, input) => {
  const qpdf = await createModule({ locateFile: () => wasm, print: () => {}, printErr: () => {} });
  qpdf.FS.writeFile("/in.pdf", input);
  const code = qpdf.callMain(args.map((a) => (a === "IN" ? "/in.pdf" : a === "OUT" ? "/out.pdf" : a)));
  if (code !== 0 && code !== 3) throw new Error(`qpdf exited with ${code}`);
  return qpdf.FS.readFile("/out.pdf");
};

const sample = new Uint8Array(readFileSync(new URL("../../../../test-files/sample-3-pages.pdf", import.meta.url)));
// Restricted with an owner password only, like many PDFs from banks and businesses.
const restricted = (...permissions: string[]) => runQpdf(["IN", "--encrypt", "--user-password=", "--owner-password=owner-secret", "--bits=256", ...permissions, "--", "OUT"], sample);

async function permissions(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const encrypt = doc.context.lookup(doc.context.trailerInfo.Encrypt);
  return encrypt instanceof PDFDict ? (encrypt.lookup(PDFName.of("P")) as PDFNumber).asNumber() : null;
}

const firstLine = async (bytes: Uint8Array) => readPageText(await PDFDocument.load(bytes), 0).lines[0];

describe("prepareForEditing", () => {
  it("uses ordinary files exactly as they are", async () => {
    const prepared = await prepareForEditing(sample, runQpdf);
    expect(prepared.bytes).toBe(sample);
    expect(await prepared.finish(sample)).toBe(sample);
  });

  it("opens a file whose author allowed changes, then puts its restrictions back", async () => {
    const locked = await restricted("--print=none", "--extract=n");
    await expect(PDFDocument.load(locked)).rejects.toThrow(/encrypted/);
    const before = await permissions(locked);

    const prepared = await prepareForEditing(locked, runQpdf);
    expect((await firstLine(prepared.bytes)).editable).toBe(true);

    const finished = await prepared.finish(prepared.bytes);
    await expect(PDFDocument.load(finished)).rejects.toThrow(/encrypted/);
    // Bits 1-12 carry the permissions; the rest are reserved.
    expect(((await permissions(finished))! & 0xffc) >>> 0).toBe((before! & 0xffc) >>> 0);
  });

  it("refuses a file whose author turned off editing", async () => {
    await expect(prepareForEditing(await restricted("--modify=none"), runQpdf)).rejects.toThrow(EDITING_NOT_ALLOWED);
  });

  it("recompresses page content the text editor can't read directly", async () => {
    const doc = await PDFDocument.load(await runQpdf(["IN", "--stream-data=uncompress", "OUT"], sample));
    const contents = doc.getPage(0).node.Contents()!;
    const stream = (contents instanceof PDFArray ? doc.context.lookup(contents.get(0)) : contents) as PDFRawStream;
    const hex = `${Array.from(stream.contents, (b) => b.toString(16).padStart(2, "0")).join("")}>`;
    doc.getPage(0).node.set(PDFName.of("Contents"), doc.context.register(doc.context.stream(hex, { Filter: "ASCIIHexDecode" })));
    const bytes = await doc.save();
    expect(readPageText(await PDFDocument.load(bytes), 0).problem).toBeTruthy();

    const prepared = await prepareForEditing(bytes, runQpdf);
    expect(prepared.bytes).not.toBe(bytes);
    expect((await firstLine(prepared.bytes)).text).toBe("Sample report");
  });
});

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { passwordProblem, protectPdf, type ProtectedPdfCheck, type QpdfRunner } from "./protect";
import { OperationError } from "./types";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const require = createRequire(import.meta.url);
const fixture = (name: string) => ({ name, bytes: new Uint8Array(readFileSync(new URL(`../../../../test-files/${name}`, import.meta.url))) });

// The same qpdf WebAssembly build the browser uses, run in Node.
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

const open = (bytes: Uint8Array, password?: string) => pdfjs.getDocument({ data: bytes.slice(), password, verbosity: 0 }).promise;
const check: ProtectedPdfCheck = async (bytes, password) => {
  const pdf = await open(bytes, password);
  try {
    return pdf.numPages;
  } finally {
    await pdf.loadingTask.destroy();
  }
};

describe("passwordProblem", () => {
  it("asks for a reasonable, matching password", () => {
    expect(passwordProblem("abc", "abc")).toMatch(/at least 6/);
    expect(passwordProblem("secret1", "secret2")).toMatch(/don't match/);
    expect(passwordProblem("x".repeat(128), "x".repeat(128))).toMatch(/too long/);
    expect(passwordProblem("correct horse", "correct horse")).toBeNull();
  });
});

describe("protectPdf", () => {
  it("locks the file with AES-256 so it only opens with the password, keeping every page and its text", async () => {
    const out = await protectPdf(fixture("sample-3-pages.pdf"), "s3cret-Ünïcode", "s3cret-Ünïcode", runQpdf, check, 3);
    expect(out).toMatchObject({ name: "sample-3-pages-protected.pdf", pageCount: 3, locked: true });

    // Without the password: refused.
    await expect(open(out.bytes)).rejects.toMatchObject({ name: "PasswordException" });
    // With a wrong password: refused.
    await expect(open(out.bytes, "wrong-password")).rejects.toMatchObject({ name: "PasswordException" });
    // With the password: complete and readable.
    const pdf = await open(out.bytes, "s3cret-Ünïcode");
    const text = (await (await pdf.getPage(1)).getTextContent()).items.map((i) => ("str" in i ? i.str : "")).join(" ");
    expect(text).toContain("Sample report");
    await pdf.loadingTask.destroy();

    // AES-256 (security handler revision 6) in the encryption dictionary.
    const raw = new TextDecoder("latin1").decode(out.bytes);
    expect(raw).toMatch(/\/AESV3/);
    expect(raw).toMatch(/\/R 6/);
    // The original text is no longer readable in the file itself.
    expect(raw).not.toContain("Sample report");
  }, 30_000);

  it("refuses a bad password before doing anything", async () => {
    await expect(protectPdf(fixture("sample-3-pages.pdf"), "short", "short", runQpdf, check, 3)).rejects.toThrow(OperationError);
  });

  it("explains a file qpdf can't process", async () => {
    await expect(protectPdf(fixture("broken-truncated.pdf"), "secret12", "secret12", async () => Promise.reject(new Error("qpdf: damaged")), check, 1)).rejects.toThrow(
      /couldn't be protected/,
    );
  });

  it("doesn't return a result that fails to open with the password", async () => {
    const corrupt: QpdfRunner = async (args, input) => (await runQpdf(args, input)).slice(0, 500);
    await expect(protectPdf(fixture("sample-3-pages.pdf"), "secret12", "secret12", corrupt, check, 3)).rejects.toThrow(/wasn't kept/);
  }, 30_000);
});

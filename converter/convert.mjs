// Office → PDF conversion with LibreOffice, used by converter/server.mjs.
// Plain Node (no packages), so the same file runs on a developer PC and on the server.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_BYTES = 50 * 1024 * 1024;
// Cloudflare gives up on a request after 100 seconds, so stop before that and send a clear error.
export const TIMEOUT_MS = 90_000;

// What each tool accepts: file extensions, and the container types their bytes may have.
export const KINDS = {
  word: { extensions: ["doc", "docx", "odt", "rtf", "txt"], containers: ["zip", "ole", "rtf", "text"], label: "a DOC, DOCX, ODT, RTF or TXT file" },
  excel: { extensions: ["xls", "xlsx", "ods"], containers: ["zip", "ole"], label: "an XLS, XLSX or ODS file" },
  powerpoint: { extensions: ["ppt", "pptx", "odp"], containers: ["zip", "ole"], label: "a PPT, PPTX or ODP file" },
};

// What the bytes may look like for each extension, so a plain-text file renamed to .docx is
// refused instead of being turned into a PDF of its text. Older .doc/.xls/.ppt files are
// sometimes really RTF or ZIP-based files with an old name, which LibreOffice opens fine.
export const EXTENSION_CONTAINERS = {
  docx: ["zip"],
  xlsx: ["zip"],
  pptx: ["zip"],
  odt: ["zip"],
  ods: ["zip"],
  odp: ["zip"],
  doc: ["ole", "rtf", "zip"],
  xls: ["ole", "zip"],
  ppt: ["ole", "zip"],
  rtf: ["rtf"],
  txt: ["text"],
};

function container(bytes) {
  const starts = (sig) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x50, 0x4b, 0x03, 0x04])) return "zip";
  if (starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  const head = Buffer.from(bytes.subarray(0, 512)).toString("latin1");
  if (head.startsWith("{\\rtf")) return "rtf";
  // Plain text: no NUL bytes and mostly printable.
  if (bytes.length > 0 && !bytes.subarray(0, 4096).includes(0)) return "text";
  return "unknown";
}

/** Checks an upload before LibreOffice sees it. Returns an error message, or null when fine. */
export function checkUpload(bytes, fileName, kind) {
  const spec = KINDS[kind];
  if (!spec) return "Unknown conversion type.";
  if (bytes.length === 0) return "This file is empty.";
  if (bytes.length > MAX_BYTES) return `Files can be up to ${MAX_BYTES / 1024 / 1024} MB.`;
  const ext = /\.([a-z0-9]+)$/i.exec(fileName ?? "")?.[1]?.toLowerCase();
  if (!ext || !spec.extensions.includes(ext)) return `This tool doesn't take this type of file. Use ${spec.label}.`;
  const found = container(bytes);
  if (!spec.containers.includes(found) || !(EXTENSION_CONTAINERS[ext] ?? spec.containers).includes(found)) return "This file's contents don't match its type. It may be damaged or renamed.";
  // ZIP-based documents name their format inside; a random ZIP renamed to .docx is refused.
  if (found === "zip") {
    const text = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 64 * 1024))).toString("latin1");
    if (!/\[Content_Types\]\.xml|mimetypeapplication\/vnd\.oasis\.opendocument/.test(text)) {
      return "This file isn't a valid Office document. It may be damaged or renamed.";
    }
  }
  return null;
}

/** Finds LibreOffice: the SOFFICE setting, or its usual install places. */
export function findSoffice(env = process.env) {
  const candidates = [
    env.SOFFICE,
    // On Windows the console launcher (soffice.com) waits for the conversion to finish.
    "C:\\Program Files\\LibreOffice\\program\\soffice.com",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com",
    "/usr/bin/soffice",
    "/usr/lib/libreoffice/program/soffice",
    "/opt/libreoffice/program/soffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** LibreOffice's output setting. Spreadsheets can put each sheet on a single page. */
export function pdfFilter(kind, options = {}) {
  if (kind === "excel" && options.fitSheets) return 'pdf:calc_pdf_Export:{"SinglePageSheets":{"type":"boolean","value":"true"}}';
  return "pdf";
}

export function sofficeArgs(profileDir, outDir, inputPath, filter) {
  return [
    // Each worker uses its own settings folder, so conversions can run side by side.
    `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
    "--headless",
    "--invisible",
    "--nologo",
    "--nodefault",
    "--norestore",
    "--nolockcheck",
    "--convert-to",
    filter,
    "--outdir",
    outDir,
    inputPath,
  ];
}

function run(soffice, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    // No shell: arguments are passed as-is, never interpreted.
    const child = spawn(soffice, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr = (stderr + d).slice(-2000)));
    const timer = setTimeout(() => {
      // Stop LibreOffice and anything it started.
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
      else child.kill("SIGKILL");
      reject(Object.assign(new Error("timeout"), { code: "TIMEOUT" }));
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

/**
 * Converts one document to PDF. Everything is written to a fresh temporary folder that is
 * deleted afterwards, whether the conversion worked or not.
 */
export async function convertToPdf({ bytes, fileName, kind, options, soffice, profileDir, timeoutMs = TIMEOUT_MS }) {
  const ext = /\.([a-z0-9]+)$/i.exec(fileName)[1].toLowerCase();
  const work = join(tmpdir(), `pdfconv-${randomBytes(8).toString("hex")}`);
  await mkdir(work, { recursive: true });
  try {
    // A fixed name inside our own folder: the user's file name never reaches the command.
    const input = join(work, `document.${ext}`);
    await writeFile(input, bytes);
    const { code } = await run(soffice, sofficeArgs(profileDir, work, input, pdfFilter(kind, options)), timeoutMs);
    const output = join(work, "document.pdf");
    if (!existsSync(output)) throw Object.assign(new Error(`LibreOffice produced no PDF (exit ${code})`), { code: "FAILED" });
    return await readFile(output);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

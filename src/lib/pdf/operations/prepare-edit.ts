import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";
import type { QpdfRunner } from "./protect";
import { OperationError } from "./types";

// Readies a PDF for the editor. Most files are used exactly as they are. Two kinds are
// first rewritten with qpdf, which changes how the file is stored but not what it shows:
// - encrypted files that open without a password (the author only restricted what can be
//   done with them), when the author allowed changes; and
// - files whose page content is compressed in ways the text editor can't read directly
//   (e.g. ASCII85, LZW), which qpdf recompresses in the standard way.
// After saving, `finish` puts an encrypted file's restrictions back.

export type PreparedPdf = { bytes: Uint8Array; finish: (bytes: Uint8Array) => Promise<Uint8Array> };

// Permission bits of the /P entry (PDF 32000-1, table 22).
const P = { print: 1 << 2, modify: 1 << 3, copy: 1 << 4, annotate: 1 << 5, forms: 1 << 8, accessibility: 1 << 9, assemble: 1 << 10, printHigh: 1 << 11 };

export const EDITING_NOT_ALLOWED = "The author of this PDF has turned off editing, so it can't be changed here.";
const UNREADABLE = "This PDF couldn't be prepared for editing. It may be damaged.";

// Page content and forms whose compression isn't plain Flate. Images keep their own formats.
function needsRecompressing(doc: PDFDocument) {
  return doc.context.enumerateIndirectObjects().some(([, obj]) => {
    if (!(obj instanceof PDFRawStream)) return false;
    const subtype = obj.dict.lookup(PDFName.of("Subtype"));
    if (subtype !== undefined && subtype !== PDFName.of("Form")) return false;
    const filter = obj.dict.lookup(PDFName.of("Filter"));
    const filters = filter instanceof PDFArray ? filter.asArray() : filter ? [filter] : [];
    return filters.some((f) => f !== PDFName.of("FlateDecode"));
  });
}

// The /P permissions of an encrypted file; rejects when the file isn't encrypted (so it
// failed to load for another reason).
async function permissionsOf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const encrypt = doc.context.lookup(doc.context.trailerInfo.Encrypt);
  if (!(encrypt instanceof PDFDict)) throw new Error("not encrypted");
  const p = encrypt.lookup(PDFName.of("P"));
  return p instanceof PDFNumber ? p.asNumber() : 0;
}

// qpdf options that set the same permissions again, with an owner password nobody knows.
function encryptArgs(p: number) {
  const allowed = (bit: number) => ((p & bit) !== 0 ? "y" : "n");
  const owner = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    "--encrypt",
    "--user-password=",
    `--owner-password=${owner}`,
    "--bits=256",
    `--print=${p & P.printHigh ? "full" : p & P.print ? "low" : "none"}`,
    `--extract=${allowed(P.copy)}`,
    `--accessibility=${allowed(P.accessibility)}`,
    `--assemble=${allowed(P.assemble)}`,
    `--annotate=${allowed(P.annotate)}`,
    `--form=${allowed(P.forms)}`,
    `--modify-other=${allowed(P.modify)}`,
    "--",
  ];
}

export async function prepareForEditing(bytes: Uint8Array, runQpdf: QpdfRunner): Promise<PreparedPdf> {
  const asIs: PreparedPdf = { bytes, finish: async (b) => b };
  let encrypted = false;
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    if (!needsRecompressing(doc)) return asIs;
  } catch {
    encrypted = true;
  }

  const permissions = encrypted ? await permissionsOf(bytes).catch(() => null) : -1;
  if (permissions === null) throw new OperationError(UNREADABLE);
  if (encrypted && (permissions & P.modify) === 0) throw new OperationError(EDITING_NOT_ALLOWED);

  let prepared: Uint8Array;
  try {
    // Decrypting needs no password here: these files open without one. qpdf rewrites
    // generally-compressed streams with Flate by default.
    prepared = await runQpdf(["IN", ...(encrypted ? ["--decrypt"] : []), "--decode-level=generalized", "OUT"], bytes);
  } catch {
    throw new OperationError(UNREADABLE);
  }

  // Every permission granted: nothing to restore.
  const all = P.print | P.printHigh | P.copy | P.accessibility | P.assemble | P.annotate | P.forms | P.modify;
  if (!encrypted || (permissions & all) === all) return { bytes: prepared, finish: async (b) => b };
  return {
    bytes: prepared,
    finish: async (edited) => {
      try {
        return await runQpdf(["IN", ...encryptArgs(permissions), "OUT"], edited);
      } catch {
        throw new OperationError("The edited PDF couldn't be given its original restrictions again, so it wasn't created.");
      }
    },
  };
}

import { OperationError, baseName, type InputPdf, type OutputFile } from "./types";

// Runs qpdf (compiled to WebAssembly) on one file: `args` refer to the input as IN and the
// output as OUT. Resolves with the output bytes, or rejects with qpdf's error text.
export type QpdfRunner = (args: string[], input: Uint8Array) => Promise<Uint8Array>;

// Opens a protected PDF with the password and returns its page count; rejects if it can't.
export type ProtectedPdfCheck = (bytes: Uint8Array, password: string) => Promise<number>;

export const MIN_PASSWORD = 6;
// AES-256 PDF passwords are limited to 127 bytes of UTF-8.
const MAX_PASSWORD_BYTES = 127;

export function passwordProblem(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use a password of at least ${MIN_PASSWORD} characters.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return "This password is too long. Use a shorter one.";
  if (password !== repeat) return "The two passwords don't match.";
  return null;
}

/**
 * Locks a PDF with a password using AES-256, the strongest standard PDF encryption.
 * The same password opens the file and allows everything (printing, copying, editing).
 * The result is opened again with the password before it is returned.
 */
export async function protectPdf(
  input: InputPdf,
  password: string,
  repeat: string,
  runQpdf: QpdfRunner,
  check: ProtectedPdfCheck,
  expectedPages: number,
): Promise<OutputFile> {
  const problem = passwordProblem(password, repeat);
  if (problem) throw new OperationError(problem);

  let bytes: Uint8Array;
  try {
    bytes = await runQpdf(["IN", "--encrypt", `--user-password=${password}`, `--owner-password=${password}`, "--bits=256", "--", "OUT"], input.bytes);
  } catch {
    throw new OperationError("This PDF couldn't be protected. It may be damaged or use features we can't handle yet.");
  }

  let pages: number;
  try {
    pages = await check(bytes, password);
  } catch {
    throw new OperationError("The protected file didn't open with your password, so it wasn't kept. Please try again.");
  }
  if (pages !== expectedPages) throw new OperationError("The protected file didn't come out complete, so it wasn't kept. Please try again.");

  return {
    name: `${baseName(input.name)}-protected.pdf`,
    bytes,
    pageCount: pages,
    locked: true,
    note: "Locked with AES-256. You'll need the password to open it, and it can't be recovered if it's lost.",
  };
}

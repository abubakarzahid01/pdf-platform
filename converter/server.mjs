// The conversion service: receives one Office file, returns it as a PDF.
// Run with `npm run converter` (port 4000). Settings come from environment variables:
//   PORT            port to listen on (default 4000)
//   HOST            address to listen on (default all; the live server uses 127.0.0.1 behind nginx)
//   ALLOWED_ORIGIN  the website allowed to call it (default http://localhost:3000)
//   SOFFICE         path to LibreOffice, if it isn't in a usual place
//   WORKERS         conversions at the same time (default 2)
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KINDS, MAX_BYTES, checkUpload, convertToPdf, findSoffice } from "./convert.mjs";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:3000";
const WORKERS = Math.max(1, Number(process.env.WORKERS ?? 2));
// Requests waiting beyond this are turned away, so a flood can't pile up forever.
const MAX_QUEUE = 20;

// Looked for again until found, so installing LibreOffice doesn't need a restart.
let soffice = findSoffice();

// Simple worker pool: each worker has its own LibreOffice settings folder.
const free = Array.from({ length: WORKERS }, (_, i) => join(tmpdir(), `pdfconv-profile-${PORT}-${i}`));
const waiting = [];
function acquire() {
  if (free.length) return Promise.resolve(free.pop());
  if (waiting.length >= MAX_QUEUE) return Promise.resolve(null);
  return new Promise((resolve) => waiting.push(resolve));
}
function release(profile) {
  const next = waiting.shift();
  if (next) next(profile);
  else free.push(profile);
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type,
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, X-File-Name",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(Object.assign(new Error("too large"), { code: "TOO_LARGE" }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  soffice ??= findSoffice();
  if (req.method === "OPTIONS") return send(res, 204, "", "text/plain");
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, libreoffice: Boolean(soffice) });
  if (req.method !== "POST" || url.pathname !== "/convert") return send(res, 404, { error: "Not found." });
  // Only the website may use the service from a browser.
  if (req.headers.origin && req.headers.origin !== ALLOWED_ORIGIN) return send(res, 403, { error: "Not allowed." });
  if (!soffice) return send(res, 503, { error: "The conversion service isn't set up yet (LibreOffice wasn't found)." });

  const kind = url.searchParams.get("kind") ?? "";
  if (!(kind in KINDS)) return send(res, 400, { error: "Unknown conversion type." });
  let fileName;
  try {
    fileName = decodeURIComponent(String(req.headers["x-file-name"] ?? ""));
  } catch {
    return send(res, 400, { error: "The file name couldn't be read." });
  }

  let bytes;
  try {
    bytes = await readBody(req);
  } catch (e) {
    return send(res, e.code === "TOO_LARGE" ? 413 : 400, { error: e.code === "TOO_LARGE" ? `Files can be up to ${MAX_BYTES / 1024 / 1024} MB.` : "The upload failed." });
  }
  const problem = checkUpload(bytes, fileName, kind);
  if (problem) return send(res, 400, { error: problem });

  const profile = await acquire();
  if (!profile) return send(res, 503, { error: "The converter is busy. Please try again in a minute." });
  const started = Date.now();
  try {
    const pdf = await convertToPdf({ bytes, fileName, kind, options: { fitSheets: url.searchParams.get("fitSheets") === "1" }, soffice, profileDir: profile });
    // Log size and timing only: never file names or contents.
    console.log(`converted ${kind} ${Math.round(bytes.length / 1024)} KB in ${Date.now() - started} ms`);
    send(res, 200, pdf, "application/pdf");
  } catch (e) {
    console.log(`failed ${kind} ${Math.round(bytes.length / 1024)} KB: ${e.code ?? e.message}`);
    send(res, e.code === "TIMEOUT" ? 504 : 422, {
      error: e.code === "TIMEOUT" ? "This file took too long to convert." : "This file couldn't be converted. It may be damaged, protected or use features LibreOffice can't read.",
    });
  } finally {
    release(profile);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Conversion service on http://${HOST ?? "localhost"}:${PORT} · LibreOffice: ${soffice ?? "NOT FOUND (install it, or set SOFFICE)"}`);
});

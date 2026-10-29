# [Brand] — Online PDF Platform

An all-in-one web platform to edit, convert, organise and extract data from PDF, Word, Excel and PowerPoint files.

> Status: **Phases 1–5 complete.** Upload checks, viewing, merge/split/rotate/organise/compress,
> and an editor with annotations, added text, images, shapes, links and existing-text editing.
> Phase 6 (smart extraction): PDF to text, Excel and CSV, invoice extraction with review, and OCR for
> scanned pages are done.

## Running locally

Requirements: Node.js 20+ (developed on 22) and npm.

```bash
npm install      # first time only
npm run dev      # start at http://localhost:3000
npm run lint     # check code for mistakes
npm test         # run automated tests on real PDF outputs
npm run build    # production build (run before committing larger changes)
```

## Architecture

The platform has three parts:

1. **Website (browser)** — Next.js + React + TypeScript + Tailwind CSS.
   Simple jobs run in the user's browser so files never leave their computer:
   viewing, merging, splitting, rotating, reordering, watermarks, page numbers.
2. **Conversion server (later phases)** — a separate service on a small VPS for work a
   browser cannot do: Office → PDF (LibreOffice), OCR (Tesseract), compression and
   password protection (qpdf). Kept separate because serverless hosting cannot run LibreOffice.
3. **Accounts and storage (Phase 8)** — Supabase for authentication, usage limits and private file storage.

The PDF text-editing engine will sit behind its own interface so it can be replaced
(for example by a commercial SDK) without rewriting the editor.

## Project structure

```
src/
  app/          Pages: homepage, /tools/[slug], /editor, /extract (preview)
  components/
    editor/       Editor workspace, viewer, drawing layer, properties panel
    tool/         Tool pages: workspace, options, results
  config/
    site.ts       Brand name, tagline and upload limits
    tools.ts      Tool catalogue and accepted file types per tool
  lib/
    files/        File checks (real type from bytes, limits), image preparation, downloads
    pdf/
      operations/ Merge, split, rotate, organise, compress, annotate, applyEdits (all tested)
      text-edit/  Existing-text editing: content tokenizer, font decoding, line finder, apply + verify
    tools/        Runs the right operation for each tool page
scripts/          make-test-pdfs.mjs (test files), probe-text-edit.mts (text-editing report for any PDF)
test-files/       Test PDFs incl. real-world-style Edge and Word exports (see test-files/README.md)
```

## Design tokens

Defined in `src/app/globals.css` and used as Tailwind classes:

| Token | Use | Example class |
|---|---|---|
| `brand` `#5A47E0` | Primary buttons, accents | `bg-brand` |
| `info` `#2E6BE6` | Informational notices | `text-info` |
| `ink` / `muted` / `subtle` | Text | `text-muted` |
| `line` / `canvas` / `surface-soft` | Borders and backgrounds | `border-line` |
| `warn` / `danger` / `success` (+ `-soft`) | Review states in extraction | `bg-warn-soft` |

Fonts: **Plus Jakarta Sans** for headings (`font-display`), **Inter** for body text (`font-sans`).
Both are self-hosted by `next/font`, so visitors' browsers never contact Google.

## Library and licence decisions

Every significant library must be safe for commercial, closed-source use.

| Purpose | Choice | Licence | Status |
|---|---|---|---|
| Framework | Next.js, React | MIT | ✅ installed |
| Styling | Tailwind CSS | MIT | ✅ installed |
| Icons | lucide-react | ISC | ✅ installed |
| PDF rendering | PDF.js (`pdfjs-dist` 6) | Apache-2.0 | ✅ installed (Phase 3) |
| PDF manipulation | pdf-lib | MIT | ✅ merge, split, rotate (Phase 4) |
| ZIP downloads | fflate | MIT | ✅ installed |
| Font embedding | @pdf-lib/fontkit | MIT | ✅ add text (Phase 5) |
| Font for added text | Inter via @expo-google-fonts/inter | OFL-1.1 (font), MIT (package) | ✅ embedded in full; subsetting damaged glyphs |
| Automated tests | Vitest | MIT | ✅ installed (dev only) |
| Excel / CSV export | Own small XLSX/CSV writer on fflate | MIT | ✅ PDF to Excel/CSV, invoice export (Phase 6) |
| Office → PDF | LibreOffice (headless, server) | MPL-2.0 | Conversion phase |
| OCR | tesseract.js 7 + tesseract.js-core; English data from @tesseract.js-data/eng | Apache-2.0 (engine), MIT (data package; Tesseract model Apache-2.0) | ✅ scanned pages, in the browser, served from /ocr (Phase 6) |
| Compression | pdf-lib + browser canvas (image recompression) | MIT | ✅ in the browser (Phase 4) |
| Test images | jpeg-js | BSD-3-Clause | ✅ installed (dev only) |
| Standard font metrics | @pdf-lib/standard-fonts | MIT | ✅ existing-text editing (Phase 5) |
| Script runner | vite-node | MIT | ✅ installed (dev only) |
| Passwords; large-file compression | qpdf (server) | Apache-2.0 | Later |

**Avoided:** Ghostscript and MuPDF are AGPL — using them in a web service would require
publishing our source code, unless a commercial licence is bought. Revisit only if needed.

**Existing-text editing:** start with our own engine (PDF.js + pdf-lib) that truly removes and
rewrites text in the content stream — never a white box over the original. Consider a commercial
SDK (Apryse, Nutrient, MuPDF commercial) once revenue justifies it.

## Development phases

1. ✅ Workspace and project setup
2. ✅ Premium UI (homepage, tool pages, editor layout)
3. ✅ Working PDF foundation (upload checks, rendering, navigation, zoom, download, errors)
4. ✅ Core PDF tools (merge, split, rotate, organise, compress, annotations)
5. ✅ PDF editing (add text, images, shapes, links; edit existing text with removal + verification)
6. **Smart extraction (text, tables, Excel/CSV, batch, OCR)** ← next
7. AI workflows
8. Accounts and monetisation
9. Security and production readiness
10. Deployment and launch

Each phase is tested and confirmed before the next one starts.

## Open decisions

- Brand name and domain (replace `[Brand]` in `src/config/site.ts`)
- Pricing, free-tier limits and file-retention period

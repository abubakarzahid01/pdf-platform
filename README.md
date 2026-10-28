# [Brand] — Online PDF Platform

An all-in-one web platform to edit, convert, organise and extract data from PDF, Word, Excel and PowerPoint files.

> Status: **Phase 1 — project foundation.** No PDF features are implemented yet.

## Running locally

Requirements: Node.js 20+ (developed on 22) and npm.

```bash
npm install      # first time only
npm run dev      # start at http://localhost:3000
npm run lint     # check code for mistakes
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
  app/          Pages and layouts (Next.js App Router)
    globals.css   Design tokens (colours, fonts, radii, shadows) as Tailwind theme
    layout.tsx    Root layout: fonts and site metadata
    page.tsx      Homepage (temporary Phase 1 placeholder)
  config/
    site.ts       Brand name, tagline and upload limits
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
| PDF rendering | PDF.js (`pdfjs-dist`) | Apache-2.0 | Phase 3 |
| PDF manipulation | pdf-lib | MIT | Phase 4 |
| Excel / CSV export | ExcelJS, PapaParse | MIT | Phase 6 |
| Office → PDF | LibreOffice (headless, server) | MPL-2.0 | Conversion phase |
| OCR | Tesseract | Apache-2.0 | Phase 6 |
| Compression, passwords | qpdf + sharp | Apache-2.0 | Phase 4 |

**Avoided:** Ghostscript and MuPDF are AGPL — using them in a web service would require
publishing our source code, unless a commercial licence is bought. Revisit only if needed.

**Existing-text editing:** start with our own engine (PDF.js + pdf-lib) that truly removes and
rewrites text in the content stream — never a white box over the original. Consider a commercial
SDK (Apryse, Nutrient, MuPDF commercial) once revenue justifies it.

## Development phases

1. **Workspace and project setup** ← current
2. Premium UI (homepage, tool pages, editor layout — prototypes clearly labelled)
3. Working PDF foundation (upload, rendering, navigation, zoom, download, errors)
4. Core PDF tools (merge, split, rotate, reorder, compress, annotations)
5. PDF editing (text, images, supported existing-text editing)
6. Smart extraction (text, tables, Excel/CSV, batch, OCR)
7. AI workflows
8. Accounts and monetisation
9. Security and production readiness
10. Deployment and launch

Each phase is tested and confirmed before the next one starts.

## Open decisions

- Brand name and domain (replace `[Brand]` in `src/config/site.ts`)
- Pricing, free-tier limits and file-retention period

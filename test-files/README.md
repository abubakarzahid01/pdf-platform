# Test files

Generated files for checking uploads, validation and rendering. Not real documents.

| File | What it tests | Expected result |
|---|---|---|
| `sample-3-pages.pdf` | Normal text PDF | Opens, 3 pages |
| `mixed-sizes.pdf` | A4 portrait, A4 landscape, rotated Letter page | Each page shows at its own size and rotation |
| `long-150-pages.pdf` | Long document within the limit | Opens; pages render as you scroll |
| `edge-invoice.pdf` | Real-world-style PDF from Microsoft Edge (`edge-invoice.html`): subset CID fonts, text stored as glyph codes | Every line found and editable; edits keep the original font when it has the letters |
| `invoice-bluefield.pdf` | Edge invoice: "Label: value" lines, ambiguous date 11/09/2026, totals in table rows, a VAT Reg No | All fields found; date and supplier marked unsure; VAT number ignored |
| `invoice-orchard.pdf` | Edge invoice: "From:" supplier, date in words, amounts with EUR, no invoice number | Invoice no. reported missing; totals balance |
| `invoice-kestrel.pdf` | Edge invoice: "Invoice #", ISO date, $ amounts, totals that don't add up | Mismatch flagged |
| `word-letter.pdf` | Exported by Microsoft Word: embedded subset Calibri, kerned TJ arrays, bold/italic runs, Symbol bullets, a table | 18 of 20 lines editable (bullets excluded); edits keep position |
| `scanned-page.pdf` | Only an image of a page, no real text | No editable text; editor explains OCR comes later |
| `images-heavy.pdf` | Two large photo-like images (JPEG and lossless) plus text | Compresses to a much smaller file; text unchanged |
| `too-many-pages-250.pdf` | Over the free page limit (200) | Rejected with a page-limit message |
| `broken-truncated.pdf` | A real PDF cut off halfway | Rejected as damaged |
| `fake-text-file.pdf` | A text file renamed to `.pdf` | Rejected as not a PDF |
| `protected-password-test1234.pdf` | Password protection (test password: `test1234`) | Reported as password-protected |

Regenerate the generated files with `node scripts/make-test-pdfs.mjs` (not the protected, Edge or Word files).

To check how the text editor copes with any PDF (yours included):
`npx vite-node scripts/probe-text-edit.mts path/to/file.pdf`
The protected file was made from `sample-3-pages.pdf` with pypdf (`PdfWriter.encrypt`, RC4-128).

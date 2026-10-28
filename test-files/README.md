# Test files

Generated files for checking uploads, validation and rendering. Not real documents.

| File | What it tests | Expected result |
|---|---|---|
| `sample-3-pages.pdf` | Normal text PDF | Opens, 3 pages |
| `mixed-sizes.pdf` | A4 portrait, A4 landscape, rotated Letter page | Each page shows at its own size and rotation |
| `long-150-pages.pdf` | Long document within the limit | Opens; pages render as you scroll |
| `too-many-pages-250.pdf` | Over the free page limit (200) | Rejected with a page-limit message |
| `broken-truncated.pdf` | A real PDF cut off halfway | Rejected as damaged |
| `fake-text-file.pdf` | A text file renamed to `.pdf` | Rejected as not a PDF |
| `protected-password-test1234.pdf` | Password protection (test password: `test1234`) | Reported as password-protected |

Regenerate the first five with `node scripts/make-test-pdfs.mjs`.
The protected file was made from `sample-3-pages.pdf` with pypdf (`PdfWriter.encrypt`, RC4-128).

// Search-facing copy for each tool page: the title and description shown in search results,
// an introduction, the steps, and common questions. Written for the phrases people search
// for ("edit pdf online free", "pdf to word converter") and kept true to what each tool does.

export type ToolSeo = {
  // Shown in the browser tab and as the search result's headline; the site name is added.
  title: string;
  // The search result's summary: about 150 characters.
  description: string;
  intro: string;
  steps: [string, string, string];
  faqs: { q: string; a: string }[];
};

// Answers shared by tools that work entirely in the browser.
const privateAnswer = {
  q: "Are my files uploaded?",
  a: "No. This tool works entirely in your browser, so your file never leaves your device and nobody else can see it.",
};
const freeAnswer = {
  q: "Is it free?",
  a: "Yes. There's no sign-up, no watermark and no limit on how many files you process. Files can be up to 50 MB.",
};
const officeUploadAnswer = {
  q: "Is my file kept on your server?",
  a: "No. Office files need office software to convert, so your file is sent over an encrypted connection to our conversion server, converted, and deleted straight away. It isn't stored or shared.",
};

export const toolSeo: Record<string, ToolSeo> = {
  "edit-pdf": {
    title: "Edit PDF Online Free – Change Text in a PDF",
    description:
      "Edit PDF text online for free: change existing words in the original font, add text, images, shapes, links, highlights and signatures. No sign-up, no watermark.",
    intro:
      "Change the words already in your PDF, not just write on top of them. Click a line, retype it, and it's saved in the PDF's own font wherever that font has your letters. You can also add new text, images, shapes, links, highlights, comments and signatures.",
    steps: ["Choose your PDF.", "Click a line to change it, or pick a tool to add text, images, shapes or a signature.", "Download the edited PDF."],
    faqs: [
      {
        q: "Can I edit the existing text in a PDF?",
        a: "Yes. The original line is removed from the file (not covered with a white box) and your new text is written in its place, in the same font when it includes every letter you typed.",
      },
      {
        q: "Can I edit a PDF in Urdu, Arabic, Hindi or Chinese?",
        a: "Yes. Text in Chinese, Japanese, Korean, Arabic, Urdu, Hebrew, Thai and Hindi is saved with a matching font, so it shows correctly in any PDF viewer.",
      },
      { q: "Can I edit a scanned PDF?", a: "A scanned page is a picture of text, so its words can't be changed directly. You can still add new text, images and signatures on top." },
      privateAnswer,
      freeAnswer,
    ],
  },
  "merge-pdf": {
    title: "Merge PDF Files Online Free – Combine PDFs",
    description: "Combine several PDF files into one in seconds and download a single PDF. Free, no sign-up, no watermark, and your files stay on your device.",
    intro: "Join several PDFs into one document. Add the files in the order you want them, and download a single PDF with every page.",
    steps: ["Choose the PDFs to combine, in the order you want them.", "Merge them.", "Download the merged PDF."],
    faqs: [
      { q: "How many PDFs can I merge?", a: "Up to 10 files at a time, each up to 50 MB. Merge the result with more files if you need to." },
      { q: "Do links and bookmarks survive?", a: "The pages, text and images are copied exactly. Bookmarks from the separate files aren't combined." },
      privateAnswer,
    ],
  },
  "split-pdf": {
    title: "Split PDF Online Free – Extract Pages from a PDF",
    description: "Split a PDF by page ranges, into single pages, or pull out just the pages you need. Free and private: your PDF never leaves your browser.",
    intro: "Break a PDF into smaller files. Choose page ranges (such as 1-3, 4-10), save every page as its own PDF, or extract only the pages you need into a new file.",
    steps: ["Choose your PDF.", "Pick page ranges, every page, or the pages to extract.", "Download the new PDFs."],
    faqs: [
      { q: "Can I save just a few pages of a PDF?", a: "Yes. Choose \"Extract pages\" and list the pages you want, for example 2, 5-7." },
      { q: "What do I get when I split into several files?", a: "One PDF for each range or page, which you can download together as a ZIP file." },
      privateAnswer,
    ],
  },
  "compress-pdf": {
    title: "Compress PDF Online Free – Reduce PDF File Size",
    description: "Make PDFs smaller for email and uploads. Choose low, recommended or high compression; text stays sharp. Free, no sign-up, works in your browser.",
    intro: "Reduce the size of a PDF so it's easier to email or upload. Images are recompressed to the level you choose, while text and vector graphics stay sharp.",
    steps: ["Choose your PDF.", "Pick a compression level.", "Download the smaller PDF."],
    faqs: [
      { q: "How much smaller will my PDF get?", a: "It depends on the content. PDFs with large photos shrink the most; a PDF that's already mostly text may only shrink a little. If it can't be made smaller, you're told and keep the original." },
      { q: "Does compression make text blurry?", a: "No. Only images are recompressed. Text stays real, sharp and selectable." },
      privateAnswer,
    ],
  },
  "organise-pages": {
    title: "Organise PDF Pages – Reorder, Rotate and Delete Pages",
    description: "Rearrange the pages of a PDF: drag to reorder, rotate, or delete pages, then save a new PDF. Free and private, right in your browser.",
    intro: "See every page of your PDF as a thumbnail. Drag pages into a new order, rotate the ones that are sideways, delete the ones you don't need, and save.",
    steps: ["Choose your PDF.", "Drag, rotate or delete pages.", "Save the new PDF."],
    faqs: [{ q: "Can I delete pages from a PDF?", a: "Yes. Remove any pages you don't want, then save; the rest keep their content and quality." }, privateAnswer, freeAnswer],
  },
  "rotate-pdf": {
    title: "Rotate PDF Online Free – Turn PDF Pages",
    description: "Rotate all pages of a PDF, or only odd or even pages, by 90 or 180 degrees and save it permanently. Free, no sign-up, nothing uploaded.",
    intro: "Fix sideways or upside-down pages. Rotate every page, or only the odd or even pages, and save the PDF so it opens the right way up everywhere.",
    steps: ["Choose your PDF.", "Pick the angle and which pages to turn.", "Download the rotated PDF."],
    faqs: [{ q: "Is the rotation saved in the file?", a: "Yes. The pages stay rotated when you open the PDF in any viewer." }, privateAnswer],
  },
  "crop-pdf": {
    title: "Crop PDF Online Free – Remove White Margins",
    description: "Trim the white margins from PDF pages automatically, or cut a set amount from each edge. Free, private and quick.",
    intro: "Remove wasted white space around your pages. Crop margins automatically to the content, or set exactly how much to trim from each edge.",
    steps: ["Choose your PDF.", "Remove white margins automatically, or set the margins.", "Download the cropped PDF."],
    faqs: [{ q: "Does cropping delete content?", a: "Cropping changes the visible area of each page. Content outside it is hidden, not edited." }, privateAnswer],
  },
  "add-page-numbers": {
    title: "Add Page Numbers to PDF Online Free",
    description: "Number the pages of a PDF in the position and style you choose: 1, 2, 3, \"Page 1 of N\" or roman numerals. Free and private.",
    intro: "Add page numbers to a PDF in a few clicks. Choose where they go and how they look, including \"Page 1 of 10\" and roman numerals.",
    steps: ["Choose your PDF.", "Pick the position and number style.", "Download the numbered PDF."],
    faqs: [{ q: "Which number styles are there?", a: "Plain numbers (1, 2, 3), \"Page 1 of N\", and lower-case roman numerals (i, ii, iii)." }, privateAnswer],
  },
  "add-watermark": {
    title: "Add Watermark to PDF Online Free",
    description: "Stamp text such as CONFIDENTIAL or DRAFT across every page of a PDF. Choose position and opacity. Free, no sign-up, nothing uploaded.",
    intro: "Mark a document as CONFIDENTIAL, DRAFT or COPY. Choose the text, where it sits and how strong it looks, and it's added to every page.",
    steps: ["Choose your PDF.", "Type the watermark and pick its position and opacity.", "Download the watermarked PDF."],
    faqs: [{ q: "Does EditBee add its own watermark?", a: "No. Your files are never stamped with our name. Only the watermark you choose is added." }, privateAnswer],
  },
  "word-to-pdf": {
    title: "Word to PDF Converter Online Free – DOCX to PDF",
    description: "Convert Word documents (DOC, DOCX) to PDF with headings, tables, images and page layout kept. Free, no sign-up, files deleted after converting.",
    intro: "Turn a Word document into a PDF that looks the same on every device. Pages, headers, tables and images are kept as laid out in your document.",
    steps: ["Choose your DOC or DOCX file.", "Convert it.", "Download the PDF."],
    faqs: [
      { q: "Will my formatting be kept?", a: "Yes. Pages, headers and footers, tables and images keep their layout. Fonts that aren't available are replaced with close matches." },
      officeUploadAnswer,
      freeAnswer,
    ],
  },
  "excel-to-pdf": {
    title: "Excel to PDF Converter Online Free – XLSX to PDF",
    description: "Convert Excel spreadsheets (XLS, XLSX) to PDF, every sheet included. Optionally fit each sheet on one page. Free, files deleted after converting.",
    intro: "Turn a spreadsheet into a PDF that's easy to share and print. Every sheet is included, and you can fit each one on a single page.",
    steps: ["Choose your XLS or XLSX file.", "Choose whether to fit each sheet on one page.", "Download the PDF."],
    faqs: [
      { q: "My sheet is wide. Will it be cut off?", a: "Tick \"Fit each sheet on one page\" to scale it down to one page. Otherwise each sheet follows its own page setup from Excel." },
      officeUploadAnswer,
    ],
  },
  "powerpoint-to-pdf": {
    title: "PowerPoint to PDF Converter Online Free – PPTX to PDF",
    description: "Convert PowerPoint presentations (PPT, PPTX) to PDF, one slide per page with images and charts kept. Free, no sign-up.",
    intro: "Share a presentation as a PDF anyone can open. Each slide becomes one page, with its images, charts and text.",
    steps: ["Choose your PPT or PPTX file.", "Convert it.", "Download the PDF."],
    faqs: [officeUploadAnswer, freeAnswer],
  },
  "images-to-pdf": {
    title: "JPG to PDF Converter Online Free – Images to PDF",
    description: "Combine JPG, PNG and other images into one PDF. Choose page size, orientation and margins. Free, private, works in your browser.",
    intro: "Turn photos, scans and screenshots into a single PDF, one image per page in the order you add them. Choose the page size, orientation and margins.",
    steps: ["Choose your images (JPG, PNG and more).", "Pick page size, orientation and margins.", "Download the PDF."],
    faqs: [
      { q: "Which image formats work?", a: "JPG, PNG, WebP, GIF and BMP." },
      { q: "Can I put each image on an A4 page?", a: "Yes. Choose A4 or Letter as the page size, or \"Fit to image\" to make each page the size of its image." },
      privateAnswer,
    ],
  },
  "pdf-to-word": {
    title: "PDF to Word Converter Online Free – PDF to DOCX",
    description: "Convert PDF to an editable Word document (DOCX) with paragraphs, headings, lists, tables and images. Scanned pages read with OCR. Free and private.",
    intro: "Turn a PDF into a Word document you can edit. Paragraphs, headings, bold and italic, lists, simple tables and images are kept, and scanned pages are read with text recognition (OCR).",
    steps: ["Choose your PDF.", "Convert it to Word.", "Download the DOCX file and edit it in Word or Google Docs."],
    faqs: [
      { q: "Can it convert a scanned PDF to Word?", a: "Yes. Scanned pages are read with text recognition (OCR), so you get editable text instead of a picture." },
      { q: "Will it look exactly like my PDF?", a: "The text and structure are kept so you can edit easily. Exact positions and multi-column or highly designed layouts aren't, so it works best for letters, reports and contracts." },
      privateAnswer,
      freeAnswer,
    ],
  },
  "pdf-to-excel": {
    title: "PDF to Excel Converter Online Free – PDF Tables to XLSX",
    description: "Pull tables from a PDF into an Excel spreadsheet, with amounts turned into real numbers you can add up. Free, private, no sign-up.",
    intro: "Get tables out of a PDF and into Excel. Each table goes to its own sheet (or all into one), and amounts such as £45.00 become real numbers.",
    steps: ["Choose your PDF.", "Pick one sheet per table, or all in one sheet.", "Download the XLSX file."],
    faqs: [{ q: "Do numbers stay as numbers?", a: "Yes. Amounts and figures become real numbers in Excel, so formulas and totals work straight away." }, privateAnswer],
  },
  "pdf-to-csv": {
    title: "PDF to CSV Converter Online Free",
    description: "Export tables from a PDF as CSV files for Excel, Google Sheets or any database. Free, private, works in your browser.",
    intro: "Export the tables in a PDF as CSV, the simple format every spreadsheet and database can import.",
    steps: ["Choose your PDF.", "Pick one file per table, or all in one file.", "Download the CSV."],
    faqs: [privateAnswer, freeAnswer],
  },
  "pdf-to-images": {
    title: "PDF to JPG Converter Online Free – PDF to PNG",
    description: "Save every page of a PDF as a JPG or PNG image, at screen, standard or high (300 DPI) quality. Free and private.",
    intro: "Turn PDF pages into images. Choose JPG or PNG and the quality, up to 300 DPI for printing.",
    steps: ["Choose your PDF.", "Pick JPG or PNG and the quality.", "Download the images."],
    faqs: [{ q: "Which quality should I choose?", a: "Standard (150 DPI) suits most uses; High (300 DPI) is for printing; Screen (72 DPI) gives the smallest files." }, privateAnswer],
  },
  "pdf-to-text": {
    title: "PDF to Text Converter Online Free – Extract Text from PDF",
    description: "Extract the text from any PDF into a plain text file, in reading order. Scanned pages are read with OCR. Free, private, in your browser.",
    intro: "Copy all the text out of a PDF in one go, in reading order. Scanned pages are read with text recognition (OCR) right in your browser.",
    steps: ["Choose your PDF.", "Choose to mark each page or get one continuous text.", "Download the text file."],
    faqs: [
      { q: "Does it work with scanned PDFs?", a: "Yes. Pages without text are read with text recognition (OCR) on your own device." },
      privateAnswer,
    ],
  },
  "invoice-to-excel": {
    title: "Invoice to Excel – Extract Invoice Data from PDF",
    description: "Pull the supplier, invoice number, date and totals from many PDF invoices into one Excel spreadsheet, with every value checked. Free and private.",
    intro: "Stop typing invoices by hand. Add PDF or scanned invoices and get the supplier, invoice number, date and totals in one spreadsheet, with anything uncertain marked for you to check.",
    steps: ["Add your invoices (PDF or scans).", "Review the values found, with doubtful ones highlighted.", "Download the Excel file."],
    faqs: [
      { q: "Does it guess values it can't find?", a: "No. Missing values are left empty and uncertain ones are marked, so nothing incorrect slips into your spreadsheet unnoticed." },
      { q: "Does it work with scanned invoices?", a: "Yes. Scans are read with text recognition (OCR) in your browser." },
      privateAnswer,
    ],
  },
  "protect-pdf": {
    title: "Protect PDF with Password Online Free",
    description: "Lock a PDF with a password using AES-256 encryption, the strongest standard PDF protection. Free, and your file never leaves your browser.",
    intro: "Add a password to a PDF so only people who know it can open it. The file is encrypted with AES-256.",
    steps: ["Choose your PDF.", "Type a password twice.", "Download the protected PDF."],
    faqs: [
      { q: "Can you recover my password if I forget it?", a: "No. The password is never sent to us, so keep it somewhere safe." },
      privateAnswer,
    ],
  },
};

// The home page's search-facing copy.
export const homeSeo = {
  title: "EditBee – Free Online PDF Editor and Converter",
  description:
    "Edit PDF text, convert PDF to Word and Excel, merge, split, compress and sign PDFs online for free. No sign-up, no watermark, and most tools never upload your files.",
};

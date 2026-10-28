import type { ExtractedRow } from "@/lib/extraction/validate";

// Sample results used to design the review screen. Not real documents.
// Each row deliberately shows one situation the review screen must handle.
export const sampleRows: ExtractedRow[] = [
  {
    id: "inv-01",
    fileName: "invoice-sep-01.pdf",
    page: 1,
    scanned: false,
    values: { supplier: "Northwind Supplies", invoiceNo: "INV-1042", date: "2026-09-03", subtotal: "£1,033.33", vat: "£206.67", total: "£1,240.00" },
    lowConfidence: [],
    verified: false,
  },
  {
    id: "inv-02",
    fileName: "invoice-sep-02.pdf",
    page: 1,
    scanned: false,
    values: { supplier: "Bluefield Print Co.", invoiceNo: "BP-77310", date: "2026-09-11", subtotal: "£322.08", vat: "£64.42", total: "£386.50" },
    lowConfidence: [],
    verified: false,
  },
  {
    // Invoice number not found in the document.
    id: "inv-03",
    fileName: "invoice-sep-03.pdf",
    page: 2,
    scanned: false,
    values: { supplier: "Orchard Logistics", invoiceNo: "", date: "2026-09-18", subtotal: "£1,679.33", vat: "£335.87", total: "£2,015.20" },
    lowConfidence: [],
    verified: false,
  },
  {
    // Scanned page read with OCR; date format was ambiguous.
    id: "inv-04",
    fileName: "invoice-sep-04.pdf",
    page: 1,
    scanned: true,
    values: { supplier: "Harbour Office Ltd", invoiceNo: "HO-2291", date: "24/09/26", subtotal: "£81.67", vat: "£16.33", total: "£98.00" },
    lowConfidence: ["date"],
    verified: false,
  },
  {
    // Subtotal + VAT does not equal the total printed on the invoice.
    id: "inv-05",
    fileName: "invoice-sep-05.pdf",
    page: 1,
    scanned: false,
    values: { supplier: "Kestrel IT Services", invoiceNo: "KIT-0558", date: "2026-09-29", subtotal: "£450.00", vat: "£90.00", total: "£560.00" },
    lowConfidence: [],
    verified: false,
  },
];

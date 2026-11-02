import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OperationError } from "@/lib/pdf/operations/types";
import { convertOffice } from "./convert-office";

const pdf = new Uint8Array(readFileSync(new URL("../../../test-files/sample-3-pages.pdf", import.meta.url)));
const input = { name: "Quarterly report.docx", bytes: new Uint8Array([1, 2, 3]) };

describe("convertOffice", () => {
  it("sends the file to the conversion service and returns the PDF with its page count", async () => {
    let sent: { url: string; init?: RequestInit } | undefined;
    const fetcher = (async (url: string, init?: RequestInit) => {
      sent = { url, init };
      return new Response(pdf as BodyInit, { status: 200 });
    }) as unknown as typeof fetch;
    const out = await convertOffice(input, "excel", { fitSheets: true }, fetcher);
    expect(sent?.url).toBe("http://localhost:4000/convert?kind=excel&fitSheets=1");
    expect((sent?.init?.headers as Record<string, string>)["X-File-Name"]).toBe("Quarterly%20report.docx");
    expect(out).toMatchObject({ name: "Quarterly report.pdf", pageCount: 3 });
  });

  it("shows the service's own explanation when it refuses a file", async () => {
    const fetcher = (async () => Response.json({ error: "This file's contents don't match its type." }, { status: 400 })) as unknown as typeof fetch;
    await expect(convertOffice(input, "word", {}, fetcher)).rejects.toThrow("This file's contents don't match its type.");
  });

  it("explains when the service can't be reached", async () => {
    const fetcher = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    await expect(convertOffice(input, "word", {}, fetcher)).rejects.toThrow(OperationError);
    await expect(convertOffice(input, "word", {}, fetcher)).rejects.toThrow(/can't be reached/);
  });

  it("refuses a damaged result", async () => {
    const fetcher = (async () => new Response(new Uint8Array([1, 2, 3]) as BodyInit, { status: 200 })) as unknown as typeof fetch;
    await expect(convertOffice(input, "word", {}, fetcher)).rejects.toThrow(/damaged/);
  });
});

// Checks what was typed into the page-number box. Only a whole number from 1 to the
// page count is accepted; anything else is rejected with a message, never adjusted.
export type PageNumberResult = { ok: true; page: number } | { ok: false; message: string };

export function parsePageNumber(value: string, pageCount: number): PageNumberResult {
  const range = pageCount === 1 ? "This PDF has only 1 page." : `Enter a page from 1 to ${pageCount}.`;
  const text = value.trim();
  if (!/^\d+$/.test(text)) return { ok: false, message: text ? `“${text}” isn't a page number. ${range}` : range };
  const page = Number(text);
  if (page < 1 || page > pageCount) return { ok: false, message: `There's no page ${page}. ${range}` };
  return { ok: true, page };
}

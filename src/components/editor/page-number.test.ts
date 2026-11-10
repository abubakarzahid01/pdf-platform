import { describe, expect, it } from "vitest";
import { parsePageNumber } from "./page-number";

describe("parsePageNumber", () => {
  it("accepts whole numbers from 1 to the page count", () => {
    expect(parsePageNumber("1", 12)).toEqual({ ok: true, page: 1 });
    expect(parsePageNumber("12", 12)).toEqual({ ok: true, page: 12 });
    expect(parsePageNumber(" 7 ", 12)).toEqual({ ok: true, page: 7 });
    expect(parsePageNumber("007", 12)).toEqual({ ok: true, page: 7 });
  });

  it.each(["0", "-1", "13", "100", "1.5", "2.0", "1e1", "abc", "3a", "+2", "", "  ", "½", "٣"])("rejects %j", (value) => {
    const result = parsePageNumber(value, 12);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("1 to 12");
  });

  it("names the page that doesn't exist", () => {
    expect(parsePageNumber("0", 3)).toEqual({ ok: false, message: "There's no page 0. Enter a page from 1 to 3." });
    expect(parsePageNumber("4", 1)).toEqual({ ok: false, message: "There's no page 4. This PDF has only 1 page." });
  });
});

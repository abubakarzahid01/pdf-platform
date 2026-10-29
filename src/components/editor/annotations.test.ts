import { describe, expect, it } from "vitest";
import { normaliseUrl } from "./annotations";

describe("normaliseUrl", () => {
  it("adds https:// or mailto: to what people usually type", () => {
    expect(normaliseUrl("example.com/page")).toBe("https://example.com/page");
    expect(normaliseUrl("  name@example.com ")).toBe("mailto:name@example.com");
    expect(normaliseUrl("http://example.com")).toBe("http://example.com");
  });

  it("rejects empty input and links that could run code or open local files", () => {
    expect(normaliseUrl("")).toBeNull();
    expect(normaliseUrl("javascript:alert(1)")).toBeNull();
    expect(normaliseUrl("file:///C:/secret.txt")).toBeNull();
    expect(normaliseUrl("data:text/html,hi")).toBeNull();
  });
});

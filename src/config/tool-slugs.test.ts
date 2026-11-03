import { describe, expect, it } from "vitest";
import { toolSlugs } from "./tool-slugs";
import { tools } from "./tools";

describe("toolSlugs", () => {
  it("lists exactly the tools that have a page, so the proxy lets them through", () => {
    expect([...toolSlugs].sort()).toEqual(tools.map((t) => t.slug).sort());
  });
});

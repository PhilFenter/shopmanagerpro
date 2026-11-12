import { describe, expect, it } from "vitest";
import { COUNTER_HOME, isCounterPath } from "./counterMode";

describe("counter-only login paths", () => {
  it("allows Counter Quote and Patch Pro", () => {
    expect(isCounterPath("/counter")).toBe(true);
    expect(isCounterPath("/patch-pro")).toBe(true);
    expect(isCounterPath("/counter/")).toBe(true);
    expect(COUNTER_HOME).toBe("/counter");
  });

  it("blocks the rest of Shop Manager", () => {
    for (const p of ["/", "/dashboard", "/action-items", "/customers", "/quotes", "/quotes/abc", "/financials", "/team", "/settings", "/leather", "/jobs", "/counter-admin", "/patch-pro/extra"]) {
      expect(isCounterPath(p)).toBe(false);
    }
  });
});

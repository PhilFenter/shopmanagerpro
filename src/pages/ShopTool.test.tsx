import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import ShopTool from "./ShopTool";

describe("ShopTool screen", () => {
  it("shows the tool page in a titled frame", () => {
    const { container } = render(<ShopTool src="/art-prep/index.html" title="Art Prep" />);
    const frame = container.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe("/art-prep/index.html");
    expect(frame.getAttribute("title")).toBe("Art Prep");
  });

  it.each(["art-prep", "proplace-prep"])("ships %s as a complete page", (tool) => {
    const html = readFileSync(`public/${tool}/index.html`, "utf8");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
  });
});

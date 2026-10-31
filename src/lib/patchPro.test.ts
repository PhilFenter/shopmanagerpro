import { describe, expect, it } from "vitest";
import { hatColorsFromSanMar } from "./patchPro";

describe("hatColorsFromSanMar", () => {
  it("keeps one entry per color and prefers the front flat photo", () => {
    const colors = hatColorsFromSanMar([
      { color: "Navy", frontFlat: "https://cdnm.sanmar.com/a.jpg", colorProductImage: "https://cdnm.sanmar.com/b.jpg" },
      { color: "Navy", frontFlat: "https://cdnm.sanmar.com/other-size.jpg" },
      { color: "Black", colorProductImage: "https://cdnm.sanmar.com/c.jpg", colorSquareImage: "https://cdnm.sanmar.com/sq.jpg" },
    ]);
    expect(colors).toEqual([
      { color: "Black", image: "https://cdnm.sanmar.com/c.jpg", swatch: "https://cdnm.sanmar.com/sq.jpg" },
      { color: "Navy", image: "https://cdnm.sanmar.com/a.jpg", swatch: "" },
    ]);
  });

  it("leaves out colors with no photo and copes with nothing", () => {
    expect(hatColorsFromSanMar([{ color: "Red" }, { catalogColor: "Wht", productImage: "https://cdnm.sanmar.com/w.jpg" }])).toEqual([
      { color: "Wht", image: "https://cdnm.sanmar.com/w.jpg", swatch: "" },
    ]);
    expect(hatColorsFromSanMar(undefined)).toEqual([]);
  });
});

// Helpers for the Patch Pro page (the patch designer at /patch-pro).

export interface SanMarInfoItem {
  color?: string;
  catalogColor?: string;
  frontFlat?: string;
  colorProductImage?: string;
  productImage?: string;
  frontModel?: string;
  colorSquareImage?: string;
}

export interface HatColor {
  color: string;
  image: string;
  swatch: string;
}

/**
 * Turns the sanmar-api getProductInfo items (one per color and size) into one entry per color
 * with the best photo for a mockup: the front flat shot when there is one, then the color's
 * product shot, then anything else. Colors without any photo are left out.
 */
export function hatColorsFromSanMar(items: SanMarInfoItem[] | null | undefined): HatColor[] {
  const byColor = new Map<string, HatColor>();
  for (const it of items ?? []) {
    const color = (it.color || it.catalogColor || "").trim();
    if (!color || byColor.has(color)) continue;
    const image = (it.frontFlat || it.colorProductImage || it.productImage || it.frontModel || "").trim();
    if (!image) continue;
    byColor.set(color, { color, image, swatch: (it.colorSquareImage || "").trim() });
  }
  return [...byColor.values()].sort((a, b) => a.color.localeCompare(b.color));
}

/** Only these pages can be opened from inside Patch Pro. */
export const PATCH_PRO_NAV_TARGETS = ["/leather", "/dashboard", "/jobs"] as const;

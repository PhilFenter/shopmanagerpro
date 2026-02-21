-- Drop old unique index that doesn't include color
DROP INDEX IF EXISTS idx_product_catalog_unique;

-- Create new unique index that includes color_group
CREATE UNIQUE INDEX idx_product_catalog_unique ON public.product_catalog (style_number, color_group, size_range, supplier);

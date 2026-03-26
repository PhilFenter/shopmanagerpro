
-- Fix PC54 garments: wholesale price is $2.44 for S-XL
UPDATE job_garments 
SET unit_cost = 2.44, total_cost = quantity * 2.44, updated_at = now()
WHERE item_number = 'PC54' AND (unit_cost IS NULL OR unit_cost != 2.44);

-- Fix PC54TT garments: wholesale price ~$2.76 for Athletic Heather
UPDATE job_garments 
SET unit_cost = 2.76, total_cost = quantity * 2.76, updated_at = now()
WHERE item_number = 'PC54TT' AND (unit_cost IS NULL OR unit_cost != 2.76);

-- Fix Lime in catalog
UPDATE product_catalog 
SET piece_price = 2.44, updated_at = now()
WHERE style_number = 'PC54' AND color_group = 'Lime' AND piece_price > 2.44;

-- Re-aggregate material_cost for all affected jobs
UPDATE jobs SET material_cost = sub.total, updated_at = now()
FROM (
  SELECT job_id, COALESCE(SUM(total_cost), 0) as total
  FROM job_garments
  WHERE total_cost > 0
  GROUP BY job_id
) sub
WHERE jobs.id = sub.job_id
AND jobs.id IN (
  SELECT DISTINCT job_id FROM job_garments WHERE item_number IN ('PC54', 'PC54TT')
);

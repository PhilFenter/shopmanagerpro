UPDATE job_garments jg
SET unit_sell_price = jg.unit_cost, unit_cost = 0, total_cost = 0
FROM jobs j
WHERE j.id = jg.job_id 
AND j.source = 'printavo' 
AND jg.unit_sell_price IS NULL 
AND jg.unit_cost > 0;
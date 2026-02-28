UPDATE job_garments 
SET unit_sell_price = unit_cost, unit_cost = 0, total_cost = 0
WHERE job_id = '9f02f15c-cdad-4095-b556-1b7f1572412f'
AND unit_sell_price IS NULL;
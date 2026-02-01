-- Drop the old foreign key FIRST
ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_worker_id_fkey;

-- Update existing time entries to use worker IDs instead of profile IDs
-- Map Phil Fenter's profile ID to his worker ID
UPDATE public.time_entries 
SET worker_id = '81e837a1-db3f-4239-bf07-b9c486df9063' 
WHERE worker_id = '0239185c-89fb-4a1a-868e-2745191ae588';

-- Set any remaining orphaned worker_ids to NULL
UPDATE public.time_entries 
SET worker_id = NULL 
WHERE worker_id IS NOT NULL 
AND worker_id NOT IN (SELECT id FROM workers);

-- Add new foreign key that references workers table
ALTER TABLE public.time_entries 
ADD CONSTRAINT time_entries_worker_id_fkey 
FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE SET NULL;

-- Add checklist (array of steps/sub-tasks) to action items
ALTER TABLE public.action_items
ADD COLUMN checklist jsonb DEFAULT '[]'::jsonb;

-- Add notes log for ongoing updates/challenges
ALTER TABLE public.action_items
ADD COLUMN notes text;

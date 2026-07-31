ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS payment_method text;
COMMENT ON COLUMN public.jobs.payment_method IS 'Payment method: card, cash, check, bank_transfer, echeck, other. Null = unknown (treated as card for fee estimates).';
CREATE INDEX IF NOT EXISTS idx_jobs_payment_method ON public.jobs(payment_method);
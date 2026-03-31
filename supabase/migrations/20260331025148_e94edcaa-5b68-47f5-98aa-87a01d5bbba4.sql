
-- Add approval token to quotes for public access
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS approval_token text UNIQUE;

-- Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_quotes_approval_token ON public.quotes(approval_token) WHERE approval_token IS NOT NULL;

-- Add approved_at timestamp
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Add stripe_payment_intent_id for payment tracking
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

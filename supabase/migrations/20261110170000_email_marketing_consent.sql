-- Email-marketing consent record for the Klaviyo connection.
-- Set only when someone actively says yes (website checkbox or counter).
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS email_marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_marketing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_marketing_consent_source text,
  ADD COLUMN IF NOT EXISTS email_marketing_consent_by uuid,
  ADD COLUMN IF NOT EXISTS klaviyo_synced_at timestamptz;

COMMENT ON COLUMN public.customers.email_marketing_consent IS
  'True only after an explicit yes to marketing email (website checkbox or counter). Not set by quotes or orders.';

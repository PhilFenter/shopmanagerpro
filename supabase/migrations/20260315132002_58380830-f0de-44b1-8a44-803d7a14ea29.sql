-- Create a sequence for quote numbers starting after existing count
CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq START WITH 1001;

-- Update the trigger function to use sequential numbers
CREATE OR REPLACE FUNCTION public.generate_quote_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  NEW.quote_number := 'Q-' || nextval('public.quote_number_seq')::text;
  RETURN NEW;
END;
$function$;
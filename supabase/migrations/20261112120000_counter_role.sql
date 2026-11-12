-- Counter-only login for the front-counter iMac.
--
-- Adds 'counter' to app_role. The app sends a counter login to Counter Quote and lets it open
-- only Counter Quote and Patch Pro (src/lib/counterMode.ts, ProtectedRoute).
--
-- public.is_staff(uid) is "has any role", so a counter login has the same database access as
-- Team. Counter Quote needs that to save customers, quotes and action items. Locking the
-- counter role down at the database level as well is a separate, larger change
-- (see DECISIONS.md, "Counter logins only see Counter Quote and Patch Pro").
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'counter';

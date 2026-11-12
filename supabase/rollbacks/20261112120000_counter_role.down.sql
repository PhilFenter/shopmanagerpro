-- Postgres can't drop an enum value. To undo the counter role, move any counter logins
-- back to Team (or remove them); the unused 'counter' value can stay in app_role.
UPDATE public.user_roles SET role = 'team' WHERE role = 'counter';

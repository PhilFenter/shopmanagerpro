# Deploying ShopManagerPro functions

## Automatic (after one-time setup)
Merging a PR into `main` that touches `supabase/functions/**` deploys only the functions that changed
(plus any function that imports a changed `_shared` file). See `.github/workflows/deploy-functions.yml`.
Watch it under the repo's **Actions** tab; a green check means it's live.

Manual deploy: **Actions → Deploy Supabase functions → Run workflow**, type function names
(e.g. `process-inbound-email`) or `all`.

Not automated on purpose: database migrations and secrets. Those stay with Drew (or Phil once he has access).

## One-time setup (Drew, ~15 min)
1. **Access token:** Supabase dashboard → your avatar → **Account preferences → Access Tokens** →
   *Generate new token* (name it `github-deploy`). Copy it.
2. **GitHub secret:** github.com/PhilFenter/shopmanagerpro → **Settings → Secrets and variables → Actions**
   → *New repository secret* → name `SUPABASE_ACCESS_TOKEN`, paste the token.
3. **Give Phil access:** Supabase → **Organization settings → Team → Invite** →
   `phil@hellscanyondesigns.com`, role **Administrator** (full project access including secrets and logs; can't change org settings or add owners).
   Developer is more limited and can't change project settings, which may include secrets.
   Phil accepts the invite email, then reconnects Supabase in Computer.
4. **Test:** Actions → Deploy Supabase functions → Run workflow → `process-inbound-email`. Green = done.

## Pending secret
`NEW_QUOTE_ALERT_EMAIL = phil@hellscanyondesigns.com` (new action item alerts by email).

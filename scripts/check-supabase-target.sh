#!/usr/bin/env bash
# Fails unless the app is pointed at our own Supabase project (HCD Confluence DB).
#
# Why: Lovable's bot has twice rewritten .env to the old Lovable Cloud project
# (cwwkkhcpbswvwghxbfgg): in August (fixed in 47394b0) and on 2026-11-10
# (58946c2, fixed in #71). A Lovable Publish of that build sends the live app's
# reads and writes to the wrong database. Run from the repo root.
#
#   bash scripts/check-supabase-target.sh
set -uo pipefail

EXPECTED_REF="${EXPECTED_REF:-fzkxeodjkaeqkwqhwcdv}"
problems=()

env_value() {
  grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"'\r"
}

if [ ! -f .env ]; then
  problems+=(".env is missing.")
else
  id=$(env_value VITE_SUPABASE_PROJECT_ID)
  url=$(env_value VITE_SUPABASE_URL)
  key=$(env_value VITE_SUPABASE_PUBLISHABLE_KEY)

  [ "$id" = "$EXPECTED_REF" ] ||
    problems+=(".env VITE_SUPABASE_PROJECT_ID is \"$id\", expected \"$EXPECTED_REF\".")
  [ "$url" = "https://$EXPECTED_REF.supabase.co" ] ||
    problems+=(".env VITE_SUPABASE_URL is \"$url\", expected \"https://$EXPECTED_REF.supabase.co\".")

  # Legacy JWT keys carry their project ref inside the token.
  if [[ "$key" == eyJ* ]]; then
    payload=$(printf '%s' "$key" | cut -d. -f2 | tr '_-' '/+')
    while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="$payload="; done
    key_ref=$(printf '%s' "$payload" | base64 -d 2>/dev/null | grep -o '"ref":"[^"]*"' | cut -d'"' -f4)
    [ "$key_ref" = "$EXPECTED_REF" ] ||
      problems+=(".env VITE_SUPABASE_PUBLISHABLE_KEY belongs to project \"${key_ref:-unknown}\", expected \"$EXPECTED_REF\".")
  elif [[ "$key" != sb_publishable_* ]]; then
    problems+=(".env VITE_SUPABASE_PUBLISHABLE_KEY is missing or not a Supabase publishable key.")
  fi
fi

config_ref=$(grep -E '^project_id' supabase/config.toml 2>/dev/null | head -1 | cut -d'"' -f2)
[ "$config_ref" = "$EXPECTED_REF" ] ||
  problems+=("supabase/config.toml project_id is \"$config_ref\", expected \"$EXPECTED_REF\".")

if [ ${#problems[@]} -gt 0 ]; then
  for p in "${problems[@]}"; do
    echo "::error::$p"
  done
  echo
  echo "The app is pointed at the wrong Supabase project. Do NOT click Publish in Lovable."
  echo "Fix: restore .env and supabase/config.toml to $EXPECTED_REF (see PR #71), then Publish."
  exit 1
fi

echo "OK: the app points at $EXPECTED_REF (HCD Confluence DB)."

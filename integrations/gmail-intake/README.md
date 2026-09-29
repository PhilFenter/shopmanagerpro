# Gmail → ShopManagerPro intake

Turns customer emails sent to info@ into ShopManagerPro action items and draft quotes. When info is missing, it saves a reply draft in Gmail. Phil reviews everything and pushes to Printavo. Nothing is sent automatically.

```
Customer email → info@ (Gmail)
      │  Apps Script, every hour
      ▼
process-inbound-email (Supabase)
      │  AI sorts it and pulls out the details
      ├─ vendor pitch / spam → label SMP/Ignored, nothing created
      └─ customer request →
           • customer found or created
           • draft quote + line items (or attached to their open quote if they're replying with more info)
           • action item: "✅ READY TO PRICE" or "❓ NEEDS INFO", with a checklist of what's missing
           • email alert to Phil (notify-new-action-item)
           • reply draft saved in the Gmail thread asking only for what's missing
```

## Deploy (Drew)

1. **Secrets** on project `fzkxeodjkaeqkwqhwcdv`:
   ```
   supabase secrets set INBOUND_EMAIL_SECRET=<long random string>
   # AI: the existing functions use LOVABLE_API_KEY with the Lovable AI gateway.
   # If that key doesn't work since the move off Lovable Cloud, point at any
   # OpenAI-compatible endpoint instead:
   # supabase secrets set AI_API_KEY=... AI_API_URL=https://api.openai.com/v1/chat/completions AI_MODEL=gpt-4.1-mini
   ```
2. **Deploy**
   ```
   supabase functions deploy process-inbound-email
   supabase functions deploy notify-new-action-item
   supabase functions deploy create-quote-action-item
   ```
3. **Apps Script** (signed in as info@hellscanyondesigns.com):
   - Go to script.google.com, click New project, and name it "HCD Intake". Paste in `Code.gs`.
   - In Project Settings, open Script properties and add:
     - `FUNCTION_URL` = `https://fzkxeodjkaeqkwqhwcdv.supabase.co/functions/v1/process-inbound-email`
     - `INTAKE_SECRET` = the same value as `INBOUND_EMAIL_SECRET`
     - `MAILBOX` = `info`
     - `CREATE_DRAFTS` = `true`
   - Run `testDryRun` and approve the Gmail permissions. The log shows what the AI pulled from the newest email. Nothing gets written.
   - Run `skipExistingInbox`. It marks the current inbox as already handled, so the first run doesn't flood ShopManagerPro.
   - Run `installTrigger`. The script now runs every hour.
4. **Optional, phil@hellscanyondesigns.com**: install the same script in that account with `MAILBOX` = `phil`. Leave `CREATE_DRAFTS` = `true` if Phil wants drafts there too.

## Turning it off

In Apps Script, go to Triggers and delete `processInbox`. That's it. No database changes were made; dedup uses a `gmail:<messageId>` marker in `action_items.notes`.

## Tuning

The shop rules and the tone of the reply drafts are in `SHOP_RULES` / `SYSTEM_PROMPT` at the top of `supabase/functions/process-inbound-email/index.ts`. Edit them in plain English.

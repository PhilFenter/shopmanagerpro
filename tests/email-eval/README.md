# Email draft tests

Real customer emails, each with what a correct reply draft must do under the HCD standard
(Good/Better/Best from the pricing code; pleasant, short and consistent — Phil, 2026-10-17).

- **Runs automatically** on every pull request that touches the email function, the pricing file or
  these tests. The scorecard is posted on the PR. Red = don't merge until it's fixed.
- **How it runs:** the PR's version of `process-inbound-email` is deployed as a test copy
  (`process-inbound-email-eval`) in **preview mode** — real AI, real prices, full draft, but it
  writes nothing (no customer, quote, action item or alert, no Gmail draft).
- **Run by hand:** Actions → "Email draft tests" → Run workflow.

## Adding a case
When a draft annoys you, it becomes a test. Copy a case in `cases.json`, paste the customer's email,
and write the checks:

| Check | Meaning |
|---|---|
| `draft: false` | paperwork/vendor: no draft at all |
| `contains` / `contains_any` / `contains_any_re` | must include these (prices like `"$27.00"`) |
| `not_contains` / `not_contains_re` | must not include these |
| `gbb: true` | must list three options with prices |
| `hat_sizes: false` | must not ask for hat sizes |
| `followup: true` | a reply in an existing thread: no "Thanks for reaching out" |
| `no_prices` / `no_date_promise` | as named |
| `flags` | the action item must carry a warning matching this |

Every draft is also checked for: no PVC unless asked, no filler, no repeated sentences, under 170 words
outside the price lines, and price before the first question on first replies.

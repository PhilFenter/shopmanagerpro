/**
 * HCD Gmail → ShopManagerPro intake
 *
 * Install this inside the info@hellscanyondesigns.com Google account
 * (script.google.com → New project → paste this file). See README.md.
 *
 * Every hour it looks at recent inbox mail, sends each new customer
 * email to the `process-inbound-email` Supabase function, labels the thread,
 * and — when info is missing — saves a reply DRAFT in the thread for Phil to
 * review. It never sends email by itself.
 */

// ── Settings ───────────────────────────────────────────────────────────────
// Set these in Project Settings → Script properties (not in code):
//   FUNCTION_URL  https://fzkxeodjkaeqkwqhwcdv.supabase.co/functions/v1/process-inbound-email
//   INTAKE_SECRET same value as the INBOUND_EMAIL_SECRET Supabase secret
//   MAILBOX       info   (use "phil" if installed in phil@hellscanyondesigns.com)
//   CREATE_DRAFTS true   (set to false to only create action items)
// Promotions/Social are NOT excluded: Gmail files real customer emails (e.g. from AOL)
// there. The AI already ignores marketing mail.
var SEARCH_QUERY = 'in:inbox newer_than:2d -from:me';
var MAX_THREADS_PER_RUN = 30;
var LABELS = {
  processed: 'SMP/Processed',
  ignored: 'SMP/Ignored',
  error: 'SMP/Error',
  needsInfo: 'SMP/Needs Info',
};
var OWN_DOMAINS = ['hellscanyondesigns.com', 'hellscanyonartglass.com'];

// ── Main job (runs on the timer) ─────────────────────────────────────────────
function processInbox() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('FUNCTION_URL');
  var secret = props.getProperty('INTAKE_SECRET');
  var mailbox = props.getProperty('MAILBOX') || 'info';
  var createDrafts = (props.getProperty('CREATE_DRAFTS') || 'true') === 'true';
  if (!url || !secret) throw new Error('Set FUNCTION_URL and INTAKE_SECRET in Script properties');

  var seen = loadSeen_();
  var threads = GmailApp.search(SEARCH_QUERY, 0, MAX_THREADS_PER_RUN);

  var started = Date.now();
  var smpLabels = Object.keys(LABELS).map(function (k) { return LABELS[k]; });
  for (var i = 0; i < threads.length; i++) {
    // Google stops a run at 6 minutes. Stop at 4 and save progress; the next run continues.
    if (Date.now() - started > 4 * 60 * 1000) { console.log('Time limit; will continue next run'); break; }
    var thread = threads[i];
    var messages = thread.getMessages();
    var msg = messages[messages.length - 1]; // newest message in the thread
    var id = msg.getId();
    if (seen[id]) continue;
    // Already labeled and no newer message since: skip without calling the AI again.
    var already = thread.getLabels().some(function (l) { return smpLabels.indexOf(l.getName()) !== -1; });
    if (already && messages.length === 1) { seen[id] = Date.now(); continue; }

    var from = parseFrom_(msg.getFrom());
    if (OWN_DOMAINS.indexOf(from.email.split('@')[1]) !== -1) {
      seen[id] = Date.now(); // our own reply is the newest — nothing to do
      continue;
    }

    var payload = {
      message_id: id,
      thread_id: thread.getId(),
      mailbox: mailbox,
      from_email: from.email,
      from_name: from.name,
      subject: msg.getSubject(),
      date: msg.getDate().toISOString(),
      body: msg.getPlainBody().slice(0, 8000),
      thread_context: messages.slice(Math.max(0, messages.length - 4), messages.length - 1)
        .map(function (m) { return 'From: ' + m.getFrom() + '\n' + m.getPlainBody().slice(0, 1500); })
        .join('\n---\n'),
      attachment_names: msg.getAttachments().map(function (a) { return a.getName(); }),
    };

    try {
      var res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-intake-secret': secret },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      var code = res.getResponseCode();
      var out = JSON.parse(res.getContentText() || '{}');

      if (code !== 200) throw new Error('HTTP ' + code + ': ' + res.getContentText().slice(0, 300));

      if (out.status === 'ignored') {
        thread.addLabel(label_(LABELS.ignored));
      } else if (out.status === 'created' || out.status === 'duplicate') {
        thread.addLabel(label_(LABELS.processed));
        if (out.status === 'created' && !out.ready_to_price) thread.addLabel(label_(LABELS.needsInfo));
        if (createDrafts && out.reply_draft) msg.createDraftReply(out.reply_draft);
      }
      seen[id] = Date.now();
    } catch (e) {
      console.error('Intake failed for ' + id + ': ' + e);
      thread.addLabel(label_(LABELS.error));
      seen[id] = Date.now(); // don't retry forever; the label shows it needs a look
    }
    saveSeen_(seen); // save after every email so a cut-off run doesn't redo work
  }

  saveSeen_(seen);
}

// ── Setup helpers (run once from the editor) ─────────────────────────────────
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processInbox') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processInbox').timeBased().everyHours(1).create();
  Object.keys(LABELS).forEach(function (k) { label_(LABELS[k]); });
  console.log('Trigger installed: processInbox every hour');
}

/** Optional: run once before installTrigger() to skip everything already in the inbox. */
function skipExistingInbox() {
  var seen = loadSeen_();
  GmailApp.search(SEARCH_QUERY, 0, 100).forEach(function (t) {
    var m = t.getMessages();
    seen[m[m.length - 1].getId()] = Date.now();
  });
  saveSeen_(seen);
  console.log('Marked ' + Object.keys(seen).length + ' messages as already handled');
}

/** Sends the newest inbox email as a dry run and logs what the AI pulled out. Writes nothing. */
function testDryRun() {
  var props = PropertiesService.getScriptProperties();
  var thread = GmailApp.search('in:inbox -from:me', 0, 1)[0];
  var msg = thread.getMessages().pop();
  var from = parseFrom_(msg.getFrom());
  var res = UrlFetchApp.fetch(props.getProperty('FUNCTION_URL'), {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-intake-secret': props.getProperty('INTAKE_SECRET') },
    payload: JSON.stringify({
      dry_run: true,
      message_id: msg.getId(),
      thread_id: thread.getId(),
      mailbox: props.getProperty('MAILBOX') || 'info',
      from_email: from.email,
      from_name: from.name,
      subject: msg.getSubject(),
      body: msg.getPlainBody().slice(0, 8000),
      attachment_names: msg.getAttachments().map(function (a) { return a.getName(); }),
    }),
    muteHttpExceptions: true,
  });
  console.log(msg.getSubject() + '\n' + res.getResponseCode() + '\n' + res.getContentText());
}

// ── Internals ─────────────────────────────────────────────────────────────
function parseFrom_(raw) {
  var m = String(raw).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: String(raw).trim().toLowerCase() };
}

function label_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function loadSeen_() {
  var raw = PropertiesService.getScriptProperties().getProperty('SEEN_IDS');
  var seen = raw ? JSON.parse(raw) : {};
  var cutoff = Date.now() - 7 * 24 * 3600 * 1000; // forget after a week
  Object.keys(seen).forEach(function (k) { if (seen[k] < cutoff) delete seen[k]; });
  return seen;
}

function saveSeen_(seen) {
  PropertiesService.getScriptProperties().setProperty('SEEN_IDS', JSON.stringify(seen));
}

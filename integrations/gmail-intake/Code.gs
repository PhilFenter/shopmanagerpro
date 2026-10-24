/**
 * HCD Gmail → ShopManagerPro intake
 *
 * Install this inside the info@hellscanyondesigns.com Google account
 * (script.google.com → New project → paste this file). See README.md.
 *
 * Every 5 minutes it looks at recent inbox mail, sends each new customer
 * email to the `process-inbound-email` Supabase function, labels the thread,
 * and saves a reply DRAFT in the thread for review. It never sends a reply by itself.
 * info@: drafts use the shop's reply templates (REPLY_STYLE template).
 * phil@: drafts are AI-written (REPLY_STYLE ai), and customer emails are also forwarded to
 * FORWARD_TO (info@) with the template reply ready, so the office can answer from info@.
 */

// ── Settings ───────────────────────────────────────────────────────────────
// Set these in Project Settings → Script properties (not in code):
//   FUNCTION_URL  https://fzkxeodjkaeqkwqhwcdv.supabase.co/functions/v1/process-inbound-email
//   INTAKE_SECRET same value as the INBOUND_EMAIL_SECRET Supabase secret
//   MAILBOX       info   (use "phil" if installed in phil@hellscanyondesigns.com)
//   CREATE_DRAFTS true   (set to false to only create action items)
//   REPLY_STYLE   template  (info@ default) or ai (phil@ default)
//   SIGN_AS       name the drafts are signed with, e.g. Jillian (default Phil)
//   FORWARD_TO    phil@ only: info@hellscanyondesigns.com to send customer emails to the office
//   ONLY_NEW_THREADS true  (use in phil@: only brand-new conversations, plus replies in threads
//                           the system already started; ongoing back-and-forth is left alone)
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
// Never send these to intake: Printavo customer messages are already tracked in Printavo.
var SKIP_DOMAINS = ['printavo.com', 'messages.printavo.com'];
// Bounce notices are never customers (a mailer-daemon bounce became a fake customer, Oct 2026).
var BOUNCE_FROM = /^(mailer-daemon|postmaster|mail-daemon)@/i;
var BOUNCE_SUBJECT = /^(delivery status notification|undeliverable|undelivered mail|mail delivery (failed|subsystem|failure)|returned mail|delivery failure|failure notice)/i;
// Only drafts this script made carry this footer line (Phil's own drafts sign "Phil Fenter / Owner").
var SYSTEM_DRAFT_MARKER = 'Company Online Stores \u00b7 Screen Printing';
// Forwards from phil@ to info@ carry these markers so info@ can build the reply draft.
var FWD_MARK = '[HCD-FWD]';
var FWD_START = '=== SUGGESTED REPLY ===';
var FWD_END = '=== END SUGGESTED REPLY ===';
var CUSTOMER_TYPES = ['new_quote_request', 'quote_follow_up', 'existing_customer_order'];

// ── Main job (runs on the timer) ─────────────────────────────────────────────
function processInbox() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('FUNCTION_URL');
  var secret = props.getProperty('INTAKE_SECRET');
  var mailbox = props.getProperty('MAILBOX') || 'info';
  var createDrafts = String(props.getProperty('CREATE_DRAFTS') || 'true').trim().toLowerCase() !== 'false';
  var onlyNew = String(props.getProperty('ONLY_NEW_THREADS') || 'false').trim().toLowerCase() === 'true';
  var replyStyle = String(props.getProperty('REPLY_STYLE') || (mailbox === 'info' ? 'template' : 'ai')).trim().toLowerCase();
  var signAs = String(props.getProperty('SIGN_AS') || '').trim();
  var forwardTo = String(props.getProperty('FORWARD_TO') || '').trim();
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
    // phil@ mode: skip conversations already in progress that the system didn't start.
    if (onlyNew && !already && messages.length > 1) { seen[id] = Date.now(); continue; }

    var from = parseFrom_(msg.getFrom());
    var domain = from.email.split('@')[1] || '';
    if (SKIP_DOMAINS.some(function (d) { return domain === d || domain.slice(-(d.length + 1)) === '.' + d; })) {
      seen[id] = Date.now();
      continue;
    }
    if (BOUNCE_FROM.test(from.email) || BOUNCE_SUBJECT.test(String(msg.getSubject() || '').replace(/^(re|fw|fwd):\s*/i, ''))) {
      thread.addLabel(label_(LABELS.ignored));
      seen[id] = Date.now();
      continue;
    }
    // info@: a customer email forwarded from phil@ — save the suggested reply as a draft (it goes to the customer).
    if (OWN_DOMAINS.indexOf(domain) !== -1 && String(msg.getPlainBody() || '').indexOf(FWD_MARK) !== -1) {
      var sugg = extractSuggested_(msg.getPlainBody());
      if (createDrafts && sugg) msg.createDraftReply(sugg, { htmlBody: textToHtml_(sugg) });
      thread.addLabel(label_(LABELS.processed));
      console.log(msg.getSubject() + ' → forwarded from phil@' + (sugg ? ', draft saved' : ', no suggested reply'));
      seen[id] = Date.now();
      saveSeen_(seen);
      continue;
    }
    if (OWN_DOMAINS.indexOf(domain) !== -1) {
      seen[id] = Date.now(); // our own reply is the newest — nothing to do
      continue;
    }

    var payload = {
      message_id: id,
      thread_id: thread.getId(),
      mailbox: mailbox,
      signer: signAs,
      from_email: from.email,
      from_name: from.name,
      subject: msg.getSubject(),
      date: msg.getDate().toISOString(),
      body: msg.getPlainBody().slice(0, 8000),
      thread_context: messages.slice(Math.max(0, messages.length - 4), messages.length - 1)
        .map(function (m) { return 'From: ' + m.getFrom() + '\n' + m.getPlainBody().slice(0, 1500); })
        .join('\n---\n'),
      attachment_names: msg.getAttachments().map(function (a) { return a.getName(); }),
      // File type + size so the shop can tell a print-ready logo from a tiny screenshot.
      attachment_meta: msg.getAttachments().map(function (a) {
        return { name: a.getName(), type: a.getContentType(), size: a.getSize() };
      }),
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

      // A newer customer message makes any earlier system draft in this thread stale: remove it so
      // there's only ever one draft per thread.
      if (out.status !== 'duplicate') deleteSystemDrafts_(thread.getId());

      if (out.status === 'ignored') {
        thread.addLabel(label_(LABELS.ignored));
        console.log(msg.getSubject() + ' → ignored (' + (out.classification || out.reason || '') + ')');
      } else if (out.status === 'created' || out.status === 'duplicate') {
        thread.addLabel(label_(LABELS.processed));
        if (out.status === 'created' && !out.ready_to_price) thread.addLabel(label_(LABELS.needsInfo));
        var draftText = replyStyle === 'template' ? out.template_draft : out.reply_draft;
        var draftHtml = replyStyle === 'template' ? out.template_draft_html : out.reply_draft_html;
        if (createDrafts && draftText) msg.createDraftReply(draftText, draftHtml ? { htmlBody: draftHtml } : {});
        var forwarded = false;
        if (forwardTo && out.status === 'created' && CUSTOMER_TYPES.indexOf(out.classification) !== -1) {
          forwarded = forwardToOffice_(msg, from, out, forwardTo);
        }
        console.log(msg.getSubject() + ' → ' + out.status + ' (' + (out.classification || '') + ')' +
          (out.quote_number ? ', quote ' + out.quote_number : '') +
          (draftText ? (createDrafts ? ', ' + replyStyle + ' draft saved' : ', draft skipped (CREATE_DRAFTS)') : ', no draft') +
          (forwarded ? ', forwarded to ' + forwardTo : ''));
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
  ScriptApp.newTrigger('processInbox').timeBased().everyMinutes(5).create(); // checks every 5 minutes
  Object.keys(LABELS).forEach(function (k) { label_(LABELS[k]); });
  console.log('Trigger installed: processInbox every 5 minutes');
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
/** Deletes drafts in this thread that this script created (footer marker). Leaves Phil's own drafts alone. */
function deleteSystemDrafts_(threadId) {
  try {
    GmailApp.getDrafts().forEach(function (d) {
      var m = d.getMessage();
      if (m.getThread().getId() !== threadId) return;
      if (String(m.getPlainBody() || '').indexOf(SYSTEM_DRAFT_MARKER) === -1 && String(m.getBody() || '').indexOf('Company Online Stores') === -1) return;
      d.deleteDraft();
    });
  } catch (e) {
    console.error('Could not clean old drafts for ' + threadId + ': ' + e);
  }
}

/** Sends a customer email on to the office inbox. Reply-To is the customer, so "Reply" in info@ answers them. */
function forwardToOffice_(msg, from, out, forwardTo) {
  try {
    var who = (from.name ? from.name + ' <' + from.email + '>' : from.email);
    var head = [
      FWD_MARK + ' Customer email forwarded from phil@. Replying goes to ' + who + '.',
      'Suggested reply: ' + (out.template_label || 'none') + (out.quote_number ? '   Quote: ' + out.quote_number : ''),
      'Phil may also have a draft for this in phil@. Only one of you should send.',
    ].join('\n');
    var sugg = out.template_draft ? [FWD_START, out.template_draft, FWD_END].join('\n') : '';
    var orig = ['---------- Original message ----------', 'From: ' + who, 'Date: ' + msg.getDate(), 'Subject: ' + msg.getSubject(), '', msg.getPlainBody()].join('\n');
    var plain = [head, sugg, orig].filter(String).join('\n\n');
    var atts = [];
    var total = 0;
    msg.getAttachments().forEach(function (a) {
      if (total + a.getSize() < 20 * 1024 * 1024) { atts.push(a.copyBlob().setName(a.getName())); total += a.getSize(); }
    });
    GmailApp.sendEmail(forwardTo, msg.getSubject() || '(no subject)', plain, {
      replyTo: from.email,
      name: (from.name || from.email) + ' via Phil',
      htmlBody: textToHtml_(head) + (sugg ? '<pre style="font-family:inherit;white-space:pre-wrap;background:#f5f5f5;padding:8px;">' + esc_(sugg) + '</pre>' : '') +
        '<hr>' + textToHtml_(orig.split('\n').slice(0, 5).join('\n')) + '<br>' + (msg.getBody() || ''),
      attachments: atts,
    });
    return true;
  } catch (e) {
    console.error('Forward to ' + forwardTo + ' failed: ' + e);
    return false;
  }
}

function extractSuggested_(plain) {
  var t = String(plain || '');
  var a = t.indexOf(FWD_START);
  var b = t.indexOf(FWD_END);
  if (a === -1 || b === -1 || b <= a) return '';
  return t.slice(a + FWD_START.length, b).trim();
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textToHtml_(t) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">' + esc_(t).replace(/\n/g, '<br>') + '</div>';
}

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

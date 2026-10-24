/**
 * HCD phil@ → info@ forwarder (separate file; install in the phil@ account only)
 *
 * Every 5 minutes it finds customer emails the main intake script already handled
 * (label SMP/Processed), asks ShopManagerPro for the office template reply, and
 * forwards the email to info@ with that reply ready. Reply-To is the customer, so
 * the info@ script turns it into a draft addressed to the customer.
 * It never replies to a customer by itself.
 *
 * Setup (phil@ project):
 *   1. Add a new file (+ → Script), name it Forward, paste this in, Save.
 *   2. Script properties: OFFICE_INBOX = info@hellscanyondesigns.com
 *      (FUNCTION_URL and INTAKE_SECRET are already set for the main script.)
 *      Optional: SIGN_AS = name for the template sign-off (default Phil).
 *   3. Pick installForwardTrigger in the function menu and click Run once. Allow access.
 *   Leave FORWARD_TO unset, or Code.gs would forward too.
 */

var FWDR_QUERY = 'label:SMP/Processed -label:SMP/Forwarded newer_than:2d';
var FWDR_LABEL = 'SMP/Forwarded';
var FWDR_OWN = ['hellscanyondesigns.com', 'hellscanyonartglass.com'];
var FWDR_MARK = '[HCD-FWD]';
var FWDR_START = '=== SUGGESTED REPLY ===';
var FWDR_END = '=== END SUGGESTED REPLY ===';
var FWDR_TYPES = ['new_quote_request', 'quote_follow_up', 'existing_customer_order'];

function forwardCustomerEmails() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('FUNCTION_URL');
  var secret = props.getProperty('INTAKE_SECRET');
  var to = String(props.getProperty('OFFICE_INBOX') || '').trim();
  var signAs = String(props.getProperty('SIGN_AS') || '').trim();
  if (!url || !secret || !to) throw new Error('Set FUNCTION_URL, INTAKE_SECRET and OFFICE_INBOX in Script properties');

  var label = GmailApp.getUserLabelByName(FWDR_LABEL) || GmailApp.createLabel(FWDR_LABEL);
  var threads = GmailApp.search(FWDR_QUERY, 0, 20);
  var started = Date.now();

  for (var i = 0; i < threads.length; i++) {
    if (Date.now() - started > 4 * 60 * 1000) break; // continue next run
    var thread = threads[i];
    var messages = thread.getMessages();
    // Newest message from the customer (not our own reply).
    var msg = null;
    for (var j = messages.length - 1; j >= 0; j--) {
      var em = fwdrParseFrom_(messages[j].getFrom()).email;
      if (FWDR_OWN.indexOf(em.split('@')[1] || '') === -1) { msg = messages[j]; break; }
    }
    if (!msg) { thread.addLabel(label); continue; }
    var from = fwdrParseFrom_(msg.getFrom());

    try {
      // Preview mode: real AI + pricing, writes nothing (the main script already made the action item).
      var res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-intake-secret': secret },
        payload: JSON.stringify({
          dry_run: 'draft',
          message_id: msg.getId(),
          thread_id: thread.getId(),
          mailbox: 'info',
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
          attachment_meta: msg.getAttachments().map(function (a) {
            return { name: a.getName(), type: a.getContentType(), size: a.getSize() };
          }),
        }),
        muteHttpExceptions: true,
      });
      var out = JSON.parse(res.getContentText() || '{}');
      if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
      if (out.classification && FWDR_TYPES.indexOf(out.classification) === -1) { thread.addLabel(label); continue; }

      var who = from.name ? from.name + ' <' + from.email + '>' : from.email;
      var head = [
        FWDR_MARK + ' Customer email forwarded from phil@. Replying goes to ' + who + '.',
        'Suggested reply: ' + (out.template_label || 'none'),
        'Phil may also have a draft for this in phil@. Only one of you should send.',
      ].join('\n');
      var sugg = out.template_draft ? [FWDR_START, out.template_draft, FWDR_END].join('\n') : '';
      var orig = ['---------- Original message ----------', 'From: ' + who, 'Date: ' + msg.getDate(),
        'Subject: ' + msg.getSubject(), '', msg.getPlainBody()].join('\n');

      var atts = [];
      var total = 0;
      msg.getAttachments().forEach(function (a) {
        if (total + a.getSize() < 20 * 1024 * 1024) { atts.push(a.copyBlob().setName(a.getName())); total += a.getSize(); }
      });

      GmailApp.sendEmail(to, msg.getSubject() || '(no subject)', [head, sugg, orig].filter(String).join('\n\n'), {
        replyTo: from.email,
        name: (from.name || from.email) + ' via Phil',
        htmlBody: fwdrHtml_(head) +
          (sugg ? '<pre style="font-family:inherit;white-space:pre-wrap;background:#f5f5f5;padding:8px;">' + fwdrEsc_(sugg) + '</pre>' : '') +
          '<hr>' + fwdrHtml_(orig.split('\n').slice(0, 5).join('\n')) + '<br>' + (msg.getBody() || ''),
        attachments: atts,
      });
      thread.addLabel(label);
      console.log(msg.getSubject() + ' → forwarded to ' + to + ' (' + (out.template_label || 'no template') + ')');
    } catch (e) {
      console.error('Forward failed for ' + msg.getSubject() + ': ' + e);
      thread.addLabel(label); // don't retry forever
    }
  }
}

/** Run once from the editor. */
function installForwardTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'forwardCustomerEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('forwardCustomerEmails').timeBased().everyMinutes(5).create();
  GmailApp.getUserLabelByName(FWDR_LABEL) || GmailApp.createLabel(FWDR_LABEL);
  console.log('Forward trigger installed: every 5 minutes');
}

/** Optional: run once to skip what's already processed so only NEW emails get forwarded. */
function skipAlreadyProcessed() {
  var label = GmailApp.getUserLabelByName(FWDR_LABEL) || GmailApp.createLabel(FWDR_LABEL);
  var n = 0;
  GmailApp.search(FWDR_QUERY, 0, 100).forEach(function (t) { t.addLabel(label); n++; });
  console.log('Marked ' + n + ' threads as already forwarded');
}

function fwdrParseFrom_(raw) {
  var m = String(raw).match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: String(raw).trim().toLowerCase() };
}

function fwdrEsc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fwdrHtml_(t) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;">' + fwdrEsc_(t).replace(/\n/g, '<br>') + '</div>';
}

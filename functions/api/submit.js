// Apex Steel Designs — contact form handler (Cloudflare Pages Function).
// Both forms on contact.html POST here as multipart/form-data.
//
// What it does with each submission:
//   1. Checks the required fields and the attachments.
//   2. Saves the entry in the D1 database (binding DB, table "submissions").
//   3. Saves each attached file in KV (binding UPLOADS), key "<submission id>/<file name>".
//   4. Sends the visitor to /thanks.html (or returns JSON when the page asked for it).
//   5. In the background, after the visitor is answered:
//      a. If Google Drive is set up (GDRIVE_* secrets), copies the files into a new folder
//         in Drive, records the links in D1, and removes the KV copies. If the copy fails,
//         the files stay in KV and the failure is noted in D1 and in the email.
//      b. If the RESEND_API_KEY secret is set, emails the details to NOTIFY_TO through
//         Resend. Until then entries are only stored; nothing is lost.

import { driveConfigured, copySubmissionToDrive } from '../_lib/google-drive.js';

const FORMS = {
  'consultation-request': {
    label: 'Free consultation request',
    thanks: '/thanks.html?form=consultation',
    required: ['name', 'company', 'email', 'phone'],
    files: true,
  },
  'general-contact': {
    label: 'General contact',
    thanks: '/thanks.html?form=general',
    required: ['name', 'company', 'email', 'message'],
    files: false,
  },
};

// Field labels for the notification email, in display order.
const LABELS = {
  name: 'Name', company: 'Company', role: 'Role', email: 'Email', phone: 'Phone',
  project_location: 'Project location', service: 'Service needed', software_cnc: 'Software / CNC line',
  project_size: 'Project size', needed_by: 'Needed by',
  change_wanted: 'What they would change about their current detailing process', message: 'Message',
};

const ALLOWED_EXT = /\.(pdf|dwg|dxf|zip)$/i;
const MAX_FILE_BYTES = 25 * 1024 * 1024;   // KV holds up to 25 MiB per file
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_FIELD = 5000;

export async function onRequestPost({ request, env, waitUntil }) {
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');

  let data;
  try {
    data = await request.formData();
  } catch (e) {
    return reply(wantsJson, 400, 'We could not read the form. Please try again.');
  }

  const formName = String(data.get('form-name') || '');
  const form = FORMS[formName];
  if (!form) return reply(wantsJson, 400, 'Unknown form.');

  // Honeypot: real visitors never fill this hidden field. Pretend success for bots.
  if (String(data.get('bot-field') || '').trim()) {
    return wantsJson ? Response.json({ ok: true, redirect: form.thanks }) : Response.redirect(new URL(form.thanks, request.url), 303);
  }

  // Collect text fields (checkbox groups like service[] are joined).
  const fields = {};
  for (const [key, value] of data.entries()) {
    if (typeof value !== 'string' || key === 'form-name' || key === 'bot-field') continue;
    const k = key.replace(/\[\]$/, '');
    const v = value.trim().slice(0, MAX_FIELD);
    if (!v) continue;
    fields[k] = fields[k] ? fields[k] + ', ' + v : v;
  }

  const missing = form.required.filter((k) => !fields[k]);
  if (missing.length) {
    return reply(wantsJson, 400, 'Please fill in: ' + missing.map((k) => LABELS[k] || k).join(', ') + '.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return reply(wantsJson, 400, 'Please enter a valid email address.');
  }

  // Attachments
  const files = form.files ? data.getAll('files').filter((f) => typeof f === 'object' && f && f.size > 0) : [];
  if (files.length > MAX_FILES) return reply(wantsJson, 400, `Please attach no more than ${MAX_FILES} files.`);
  let total = 0;
  for (const f of files) {
    if (!ALLOWED_EXT.test(f.name)) return reply(wantsJson, 400, `"${f.name}" is not a PDF, DWG, DXF, or ZIP file.`);
    if (f.size > MAX_FILE_BYTES) return reply(wantsJson, 400, `"${f.name}" is over 25 MB. Please email it or include a download link.`);
    total += f.size;
  }
  if (total > MAX_TOTAL_BYTES) return reply(wantsJson, 400, 'Attachments are over 50 MB in total. Please email larger files or include a download link.');

  const id = new Date().toISOString().slice(0, 10) + '-' + crypto.randomUUID().slice(0, 8);
  const createdAt = new Date().toISOString();

  // Save files to KV
  const saved = [];
  try {
    for (const f of files) {
      const safe = f.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
      const key = `${id}/${safe}`;
      await env.UPLOADS.put(key, await f.arrayBuffer(), {
        metadata: { name: f.name, type: f.type || 'application/octet-stream', size: f.size, submission: id },
      });
      saved.push({ key, name: f.name, size: f.size, type: f.type || '' });
    }
  } catch (e) {
    console.error('upload save failed', e);
    return reply(wantsJson, 500, 'We could not save your files. Please try again, or email them to contact@apexsteeldesigns.com.');
  }

  // Save the entry to D1
  try {
    await env.DB.prepare(
      `INSERT INTO submissions (id, created_at, form, name, company, email, phone, fields_json, files_json, ip_country)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    ).bind(
      id, createdAt, formName, fields.name || null, fields.company || null, fields.email || null, fields.phone || null,
      JSON.stringify(fields), JSON.stringify(saved), request.cf?.country || null
    ).run();
  } catch (e) {
    console.error('db insert failed', e);
    return reply(wantsJson, 500, 'Something went wrong on our side. Please try again, or email contact@apexsteeldesigns.com.');
  }

  // Drive copy and email run after the visitor gets their answer.
  const followUp = afterSubmit(env, { id, createdAt, form, fields, saved });
  if (typeof waitUntil === 'function') waitUntil(followUp);
  else await followUp;

  return wantsJson
    ? Response.json({ ok: true, redirect: form.thanks })
    : Response.redirect(new URL(form.thanks, request.url), 303);
}

async function afterSubmit(env, { id, createdAt, form, fields, saved }) {
  let drive = null;
  let driveError = null;

  if (saved.length && driveConfigured(env)) {
    try {
      drive = await copySubmissionToDrive(env, { id, fields, saved });
      const files = saved.map((f) => {
        const d = drive.files.find((x) => x.key === f.key) || {};
        return { ...f, driveId: d.driveId, driveLink: d.link };
      });
      await env.DB.prepare('UPDATE submissions SET files_json = ?1 WHERE id = ?2')
        .bind(JSON.stringify({ driveFolder: drive.folderLink, files }), id).run();
      for (const f of saved) await env.UPLOADS.delete(f.key); // Drive now holds the files
    } catch (e) {
      driveError = String(e && e.message ? e.message : e);
      console.error('drive copy failed', driveError);
      try {
        await env.DB.prepare('UPDATE submissions SET files_json = ?1 WHERE id = ?2')
          .bind(JSON.stringify({ driveError, files: saved }), id).run();
      } catch (e2) {
        console.error('db update failed', e2);
      }
    }
  }

  // Email notification through Resend (needs the RESEND_API_KEY secret)
  if (env.RESEND_API_KEY && env.NOTIFY_TO && env.NOTIFY_FROM) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Apex Steel Designs website <${env.NOTIFY_FROM}>`,
          to: [env.NOTIFY_TO],
          reply_to: fields.email,
          subject: `${form.label}: ${fields.name} (${fields.company})`,
          text: emailText(form.label, id, createdAt, fields, saved, drive, driveError),
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
      await env.DB.prepare('UPDATE submissions SET emailed = 1 WHERE id = ?1').bind(id).run();
    } catch (e) {
      console.error('notification email failed', e); // entry is already saved
    }
  }
}

// A plain visit to this address: send people to the contact page.
export async function onRequestGet({ request }) {
  return Response.redirect(new URL('/contact.html', request.url), 303);
}

function reply(wantsJson, status, message) {
  if (wantsJson) return Response.json({ ok: false, error: message }, { status });
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Form not sent | Apex Steel Designs</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:0 16px;line-height:1.5">
<h1 style="font-size:1.4rem">Your form was not sent</h1><p>${escapeHtml(message)}</p>
<p><a href="/contact.html">Back to the contact page</a></p></body>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function emailText(label, id, createdAt, fields, saved, drive, driveError) {
  const lines = [`${label} — ${createdAt}`, `Reference: ${id}`, ''];
  for (const k of Object.keys(LABELS)) if (fields[k]) lines.push(`${LABELS[k]}: ${fields[k]}`);
  for (const k of Object.keys(fields)) if (!LABELS[k]) lines.push(`${k}: ${fields[k]}`);
  if (saved.length && drive) {
    lines.push('', `Attachments (Google Drive folder): ${drive.folderLink}`);
    for (const f of drive.files) {
      const size = (saved.find((s) => s.key === f.key) || {}).size || 0;
      lines.push(`- ${f.name} (${(size / 1048576).toFixed(1)} MB) — ${f.link}`);
    }
  } else if (saved.length) {
    if (driveError) lines.push('', `Google Drive copy FAILED: ${driveError}`);
    lines.push('', 'Attachments (saved in Cloudflare KV namespace "apex-form-uploads"):');
    for (const f of saved) lines.push(`- ${f.name} (${(f.size / 1048576).toFixed(1)} MB) — key: ${f.key}`);
  }
  lines.push('', 'Reply to this email to answer the sender directly.');
  return lines.join('\n');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

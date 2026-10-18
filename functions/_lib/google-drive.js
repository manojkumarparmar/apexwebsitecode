// Apex Steel Designs — copy consultation uploads into Google Drive.
//
// Signs in as the Google account that owns the Drive (apexsteeldesigns@gmail.com) using an
// OAuth refresh token, with the "drive.file" scope: the website can only see and change the
// folders and files it creates itself, nothing else in the Drive.
//
// Settings (Cloudflare Pages > Settings > Variables and Secrets; see README "Google Drive uploads"):
//   GDRIVE_CLIENT_ID       secret  OAuth client ID
//   GDRIVE_CLIENT_SECRET   secret  OAuth client secret
//   GDRIVE_REFRESH_TOKEN   secret  refresh token for apexsteeldesigns@gmail.com, scope drive.file
//   GDRIVE_FOLDER_NAME     var     top-level folder the site creates (default "Apex Consultation Uploads")
//
// Each submission gets its own subfolder: "<reference> – <company> – <name>".

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const ROOT_CACHE_KEY = '_config/gdrive-root-folder';
const DEFAULT_ROOT_NAME = 'Apex Consultation Uploads';

export function driveConfigured(env) {
  return Boolean(env.GDRIVE_CLIENT_ID && env.GDRIVE_CLIENT_SECRET && env.GDRIVE_REFRESH_TOKEN);
}

// Copies the submission's files from KV to a new Drive folder.
// Returns { folderId, folderLink, files: [{ key, name, driveId, link }] }. Throws on failure.
export async function copySubmissionToDrive(env, { id, fields, saved }) {
  const token = await getAccessToken(env);
  const rootId = await getRootFolder(env, token);

  const folderName = [id, fields.company, fields.name].filter(Boolean).join(' – ').replace(/[\\/]/g, '-').slice(0, 200);
  const folder = await driveJson(token, `${FILES_URL}?fields=id,webViewLink`, {
    method: 'POST',
    body: JSON.stringify({
      name: folderName,
      mimeType: FOLDER_MIME,
      parents: [rootId],
      description: `Website consultation request ${id} from ${fields.name || ''} (${fields.email || ''})`,
    }),
  });

  const files = [];
  for (const f of saved) {
    const bytes = await env.UPLOADS.get(f.key, 'arrayBuffer');
    if (!bytes) throw new Error(`file missing in KV: ${f.key}`);
    const uploaded = await uploadFile(token, folder.id, f.name, f.type || 'application/octet-stream', bytes);
    files.push({ key: f.key, name: f.name, driveId: uploaded.id, link: uploaded.webViewLink });
  }

  // Also save the form answers as a text file, so the folder is complete on its own.
  const summary = new TextEncoder().encode(summaryText(id, fields, saved));
  await uploadFile(token, folder.id, `${id} – request details.txt`, 'text/plain', summary.buffer);

  return { folderId: folder.id, folderLink: folder.webViewLink, files };
}

async function getAccessToken(env) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GDRIVE_CLIENT_ID,
      client_secret: env.GDRIVE_CLIENT_SECRET,
      refresh_token: env.GDRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`Google sign-in failed (${res.status}): ${body.error || ''} ${body.error_description || ''}`.trim());
  }
  return body.access_token;
}

// Finds (or creates) the top-level upload folder and remembers its ID in KV.
async function getRootFolder(env, token) {
  const cached = await env.UPLOADS.get(ROOT_CACHE_KEY);
  if (cached) {
    const check = await fetch(`${FILES_URL}/${cached}?fields=id,trashed`, { headers: auth(token) });
    if (check.ok) {
      const info = await check.json();
      if (!info.trashed) return cached;
    }
  }

  const name = env.GDRIVE_FOLDER_NAME || DEFAULT_ROOT_NAME;
  const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false and 'root' in parents`;
  const found = await driveJson(token, `${FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`);
  let rootId = found.files && found.files[0] && found.files[0].id;
  if (!rootId) {
    const created = await driveJson(token, `${FILES_URL}?fields=id`, {
      method: 'POST',
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: ['root'] }),
    });
    rootId = created.id;
  }
  await env.UPLOADS.put(ROOT_CACHE_KEY, rootId);
  return rootId;
}

// Resumable upload: works for any size up to the site's 25 MB per-file limit.
async function uploadFile(token, parentId, name, mimeType, bytes) {
  const start = await fetch(`${UPLOAD_URL}?uploadType=resumable&fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      ...auth(token),
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': mimeType,
      'x-upload-content-length': String(bytes.byteLength),
    },
    body: JSON.stringify({ name, parents: [parentId] }),
  });
  if (!start.ok) throw new Error(`Drive upload start failed for "${name}" (${start.status}): ${await start.text()}`);
  const session = start.headers.get('location');
  if (!session) throw new Error(`Drive upload start returned no session for "${name}"`);

  const put = await fetch(session, {
    method: 'PUT',
    headers: { 'content-type': mimeType, 'content-length': String(bytes.byteLength) },
    body: bytes,
  });
  if (!put.ok) throw new Error(`Drive upload failed for "${name}" (${put.status}): ${await put.text()}`);
  return put.json();
}

async function driveJson(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { ...auth(token), ...(init.body ? { 'content-type': 'application/json; charset=UTF-8' } : {}) },
  });
  if (!res.ok) throw new Error(`Drive request failed (${res.status}) ${url.split('?')[0]}: ${await res.text()}`);
  return res.json();
}

function auth(token) {
  return { authorization: `Bearer ${token}` };
}

function summaryText(id, fields, saved) {
  const lines = [`Apex Steel Designs — free estimodeling consultation request`, `Reference: ${id}`, ''];
  for (const [k, v] of Object.entries(fields)) lines.push(`${k}: ${v}`);
  lines.push('', 'Files:');
  for (const f of saved) lines.push(`- ${f.name} (${(f.size / 1048576).toFixed(1)} MB)`);
  return lines.join('\n') + '\n';
}

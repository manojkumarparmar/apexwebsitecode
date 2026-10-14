# Apex Steel Designs — website

Static site for https://www.apexsteeldesigns.com. Plain HTML, one stylesheet, one small script. No build step.

## Files
- `index.html`, `services.html`, `projects.html`, `about.html`, `careers.html`, `contact.html` — the six pages
- `thanks.html` — where both contact forms land after sending (not indexed)
- `style.css` — all styles; brand colors are the variables at the top (`--blue` is the logo blue)
- `site.js` — menu, contact tabs, upload checks, sample-drawing filters
- `img/` — official logo files from Apex-Steel-Designs-Logo.zip and page images:
  `apex-horizontal-color.svg` (header, on white), `apex-horizontal-white.svg` (menu and footer, on dark),
  `apex-mark-color.svg` (favicon), `apex-mark-white.svg` (background watermark), `apple-touch-icon.png` (phone home-screen icon)
- `sitemap.xml`, `robots.txt`

## Placeholders
Anything still waiting on owner input is marked in the pages as `<span class="tbd">TBD: …</span>`
(it shows as a small yellow dashed tag). Search for `class="tbd"` to find them all. Remove each tag
when the real content goes in; none should remain at launch.

## Hosting (Cloudflare Pages)
The site is hosted on Cloudflare Pages, connected to this GitHub repo. Every change merged to `main`
goes live automatically; other branches get a preview address (`<branch>.apexwebsitecode.pages.dev`).
`wrangler.toml` holds the Pages settings and bindings — change bindings there, not in the dashboard.

## Forms (Cloudflare Pages Function)
Both forms on `contact.html` post to `/api/submit`, handled by `functions/api/submit.js`.
- `consultation-request` — free consultation / Help Desk, with file upload (PDF, DWG, DXF, ZIP; up to 25 MB per file, 50 MB in total, 10 files)
- `general-contact` — general questions

Each submission is saved in the Cloudflare D1 database `apex-forms` (table `submissions`), and attached
files are saved first in the KV namespace `apex-form-uploads` under `<submission id>/<file name>`.
Once Google Drive is set up (next section), the files are then copied to Drive and removed from KV.
View them in the Cloudflare dashboard: Storage & Databases → D1 → apex-forms → Console
(`SELECT * FROM submissions ORDER BY created_at DESC;`), and Storage & Databases → KV → apex-form-uploads.

Email notifications to contact@apexsteeldesigns.com are built in but switched off until the domain uses
Cloudflare DNS and is onboarded to Cloudflare Email Service. Then uncomment the `[[send_email]]` lines in
`wrangler.toml`. No automatic reply is sent to the person who submitted.

Spam protection is a hidden "bot-field" honeypot. Cloudflare Turnstile can be added later if spam gets through.

## Google Drive uploads
After a consultation request is sent, the site copies its files into Google Drive, in the
apexsteeldesigns@gmail.com account:

`My Drive / Apex Consultation Uploads / <reference> – <company> – <name> /`

Each folder holds the uploaded files plus a `request details.txt` with the form answers. The Drive
links are saved in D1 (`files_json`) and included in the notification email. This runs after the
visitor sees the thank-you page, so it never slows the form down. If the copy fails (for example,
the Google sign-in has expired), the files stay in KV, the error is saved in `files_json` as
`driveError`, and the email says "Google Drive copy FAILED". Until the three secrets below are added,
the form works as before and files stay in KV.

The site signs in as apexsteeldesigns@gmail.com with the `drive.file` permission. That lets it see
and change only the folders and files it created, nothing else in the Drive. (A Google service account
can't be used here: service accounts have no storage of their own in a personal Gmail Drive.)
Don't rename or move the "Apex Consultation Uploads" folder. If it is deleted, the site creates a new one.

### One-time setup (about 15 minutes, signed in as apexsteeldesigns@gmail.com)
1. **Google Cloud project.** Go to https://console.cloud.google.com, create a project
   (e.g. "Apex Website"), then open APIs & Services → Library → **Google Drive API** → Enable.
2. **Consent screen.** APIs & Services → OAuth consent screen (Google Auth Platform):
   app name "Apex Steel Designs website", user type **External**, support and contact email
   apexsteeldesigns@gmail.com. Under Data access, add the scope
   `https://www.googleapis.com/auth/drive.file`. Under Audience, click **Publish app** so it is
   "In production". (In "Testing" the sign-in expires after 7 days. `drive.file` does not need
   Google's verification review.)
3. **OAuth client.** APIs & Services → Credentials → Create credentials → OAuth client ID →
   type **Web application**. Under Authorized redirect URIs add
   `https://developers.google.com/oauthplayground`. Save, and copy the **Client ID** and **Client secret**.
4. **Refresh token.** Open https://developers.google.com/oauthplayground. Click the gear icon
   (top right), tick **Use your own OAuth credentials**, and paste the Client ID and secret.
   In "Input your own scopes" (Step 1), enter `https://www.googleapis.com/auth/drive.file` and click
   **Authorize APIs**. Sign in as apexsteeldesigns@gmail.com and allow access. If Google warns that
   the app isn't verified, choose Advanced → Go to the app. In Step 2, click
   **Exchange authorization code for tokens** and copy the **Refresh token**.
5. **Add the secrets in Cloudflare.** Dashboard → Workers & Pages → apexwebsitecode → Settings →
   Variables and Secrets. For **Production** (and Preview, if you want previews to upload too), add
   three variables of type **Secret**: `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `GDRIVE_REFRESH_TOKEN`.
6. **Redeploy** (Deployments → latest → Retry deployment) so the secrets take effect, then send a
   test consultation request with a small PDF. The folder "Apex Consultation Uploads" appears in
   My Drive with the test submission inside.

If the sign-in ever stops working (the email says "Google sign-in failed … invalid_grant"), repeat
step 4 to get a new refresh token and replace `GDRIVE_REFRESH_TOKEN`. Changing the Google account
password can cause this. Files from the failed period are still in KV.

## Sample drawings
The Projects page gallery currently loads thumbnails and PDFs from affsteel.com
(`https://www.affsteel.com/assets/images/...`). Before launch, copy those files into this repo
(for example `samples/`) and replace that base URL in `projects.html`, so the gallery doesn't depend
on another site.

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
files are saved in the KV namespace `apex-form-uploads` under `<submission id>/<file name>`.
View them in the Cloudflare dashboard: Storage & Databases → D1 → apex-forms → Console
(`SELECT * FROM submissions ORDER BY created_at DESC;`), and Storage & Databases → KV → apex-form-uploads.

Email notifications to contact@apexsteeldesigns.com are built in but switched off until the domain uses
Cloudflare DNS and is onboarded to Cloudflare Email Service. Then uncomment the `[[send_email]]` lines in
`wrangler.toml`. No automatic reply is sent to the person who submitted.

Spam protection is a hidden "bot-field" honeypot. Cloudflare Turnstile can be added later if spam gets through.

## Sample drawings
The Projects page gallery currently loads thumbnails and PDFs from affsteel.com
(`https://www.affsteel.com/assets/images/...`). Before launch, copy those files into this repo
(for example `samples/`) and replace that base URL in `projects.html`, so the gallery doesn't depend
on another site.

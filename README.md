# Apex Steel Designs — website

Static site for https://www.apexsteeldesigns.com. Plain HTML, one stylesheet, one small script. No build step.

## Files
- `index.html`, `services.html`, `projects.html`, `about.html`, `careers.html`, `contact.html` — the six pages
- `thanks.html` — where both contact forms land after sending (not indexed)
- `style.css` — all styles; brand colors are the variables at the top (`--blue` is the logo blue)
- `site.js` — menu, contact tabs, upload checks, sample-drawing filters
- `img/` — logo marks (`apex-mark-white.svg`, `apex-mark-color.svg`) and page images
- `sitemap.xml`, `robots.txt`

## Placeholders
Anything still waiting on owner input is marked in the pages as `<span class="tbd">TBD: …</span>`
(it shows as a small yellow dashed tag). Search for `class="tbd"` to find them all. Remove each tag
when the real content goes in; none should remain at launch.

## Forms (Netlify Forms)
Both forms on `contact.html` post to Netlify Forms, so the site must be hosted on Netlify.
- `consultation-request` — free consultation / Help Desk, with file upload (PDF, DWG, DXF, ZIP; 8 MB per submission is Netlify's limit)
- `general-contact` — general questions

After the first deploy: in Netlify → Forms, turn on email notifications to contact@apexsteeldesigns.com
for both forms. Netlify does not send an automatic reply to the person who submitted; that needs a
separate setup if wanted.

## Sample drawings
The Projects page gallery currently loads thumbnails and PDFs from affsteel.com
(`https://www.affsteel.com/assets/images/...`). Before launch, copy those files into this repo
(for example `samples/`) and replace that base URL in `projects.html`, so the gallery doesn't depend
on another site.

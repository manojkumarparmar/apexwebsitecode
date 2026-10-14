/* Apex Steel Designs — small page behaviors. Everything works without JavaScript; this only enhances. */
(function () {
  var hdr = document.querySelector('.site-header');

  // Header turns solid once you scroll past the top of the hero
  function onScroll() { hdr.classList.toggle('solid', window.scrollY > 30); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Full-screen menu (tablet and phone)
  var menu = document.getElementById('menu'), openBtn = hdr.querySelector('.menu-btn'), closeBtn = menu.querySelector('.close');
  function setMenu(open) {
    menu.classList.toggle('open', open);
    document.documentElement.classList.toggle('lock', open);
    openBtn.setAttribute('aria-expanded', open);
    if (open) closeBtn.focus(); else openBtn.focus();
  }
  openBtn.addEventListener('click', function () { setMenu(true); });
  closeBtn.addEventListener('click', function () { setMenu(false); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) { menu.classList.remove('open'); document.documentElement.classList.remove('lock'); openBtn.setAttribute('aria-expanded', false); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) setMenu(false); });

  // Contact page tabs: #consultation (default) and #general
  var tabs = [].slice.call(document.querySelectorAll('[role=tab]'));
  function pick(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { pick(t); history.replaceState(null, '', '#' + t.getAttribute('aria-controls')); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; pick(n, true); }
    });
  });
  function fromHash() {
    var h = location.hash.slice(1), t = tabs.filter(function (x) { return x.getAttribute('aria-controls') === h; })[0];
    if (t) { pick(t); document.getElementById('forms').scrollIntoView(); }
  }
  if (tabs.length) { window.addEventListener('hashchange', fromHash); fromHash(); }

  // Forms: check attachments, send in the background, and show any problem right on the form.
  // Without JavaScript the forms still post normally to /api/submit and land on the thank-you page.
  document.querySelectorAll('form[data-form]').forEach(function (f) {
    var err = f.querySelector('.form-error'), btn = f.querySelector('button[type=submit]'), label = btn.textContent;
    function fail(msg) { err.textContent = msg; err.hidden = false; err.scrollIntoView({ block: 'center' }); btn.disabled = false; btn.textContent = label; }
    f.addEventListener('submit', function (e) {
      err.hidden = true;
      var input = f.querySelector('input[type=file]');
      if (input && input.files.length) {
        var max = parseFloat(input.getAttribute('data-max-mb')) * 1048576, maxFile = parseFloat(input.getAttribute('data-max-file-mb')) * 1048576,
          total = 0, bad = [], big = [];
        [].forEach.call(input.files, function (file) {
          total += file.size;
          if (!/\.(pdf|dwg|dxf|zip)$/i.test(file.name)) bad.push(file.name);
          if (file.size > maxFile) big.push(file.name);
        });
        if (bad.length) { e.preventDefault(); return fail('These files are not PDF, DWG, DXF, or ZIP: ' + bad.join(', ') + '.'); }
        if (big.length) { e.preventDefault(); return fail('These files are over ' + input.getAttribute('data-max-file-mb') + ' MB: ' + big.join(', ') + '. Please email them to contact@apexsteeldesigns.com or include a download link in your message.'); }
        if (total > max) { e.preventDefault(); return fail('Your files total ' + (total / 1048576).toFixed(1) + ' MB. The limit is ' + input.getAttribute('data-max-mb') + ' MB — please email larger files to contact@apexsteeldesigns.com or include a download link in your message.'); }
      }
      if (!window.fetch || !window.FormData) { btn.disabled = true; btn.textContent = 'Sending…'; return; }
      e.preventDefault();
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch(f.action, { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (res) {
          if (res.ok) { location.href = res.redirect || '/thanks.html'; return; }
          fail(res.error || 'Your form could not be sent. Please try again, or email contact@apexsteeldesigns.com.');
        })
        .catch(function () { fail('Your form could not be sent. Please check your connection and try again, or email contact@apexsteeldesigns.com.'); });
    });
  });

  // Sample thumbnails: if a preview image can't load, show a plain sheet tile instead of broken-image text
  document.querySelectorAll('.sheet img').forEach(function (img) {
    function swap() { var t = img.parentNode; t.classList.add('noimg'); img.remove(); }
    if (img.complete && img.naturalWidth === 0) swap(); else img.addEventListener('error', swap);
  });

  // Sample drawing filters
  var bar = document.querySelector('.filters'), gallery = document.getElementById('gallery');
  if (bar && gallery) {
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.filter'); if (!b) return;
      bar.querySelectorAll('.filter').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      var v = b.getAttribute('data-filter');
      gallery.querySelectorAll('[data-cat]').forEach(function (s) { s.hidden = !(v === 'all' || s.getAttribute('data-cat') === v); });
    });
  }

  // Thank-you page: tailor the message to the form that was sent
  var ty = document.getElementById('ty-text');
  if (ty && /form=consultation/.test(location.search)) {
    ty.textContent = 'We’ve received your consultation request. A US-based project manager will reply within one business day, and written guidance typically follows within 24 to 48 hours.';
  }
})();

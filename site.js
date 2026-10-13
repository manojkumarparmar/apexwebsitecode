
(function(){
  var hdr=document.querySelector('.site-header'),ov=document.getElementById('overlay'),openBtn=document.querySelector('.site-header .menu-btn');
  function onScroll(){hdr.classList.toggle('solid',window.scrollY>40);}
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  function setMenu(o){ov.classList.toggle('open',o);document.documentElement.classList.toggle('lock',o);openBtn.setAttribute('aria-expanded',o);
    if(o)ov.querySelector('.close').focus();}
  openBtn.addEventListener('click',function(){setMenu(true);});
  ov.querySelector('.close').addEventListener('click',function(){setMenu(false);openBtn.focus();});
  ov.addEventListener('click',function(e){if(e.target.closest('a'))setMenu(false);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&ov.classList.contains('open')){setMenu(false);openBtn.focus();}});

  function note(f,cls,text){var old=f.querySelector('.sent');if(old)old.remove();
    var m=document.createElement('div');m.className='sent'+(cls?' '+cls:'');m.setAttribute('role','status');m.textContent=text;f.appendChild(m);}
  // FormSubmit forms post normally (needed for the customer auto-reply), then land on thanks.html
  document.querySelectorAll('form[data-formsubmit]').forEach(function(f){
    f.addEventListener('submit',function(){
      var next=f.querySelector('input[name=_next]');
      if(next&&/^https?:/.test(location.protocol))next.value=new URL('thanks.html?form='+f.getAttribute('data-formsubmit'),location.href).href;
      var btn=f.querySelector('button[type=submit]');btn.textContent='SENDING…';
    });
  });
  document.querySelectorAll('form:not([data-formsubmit])').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();
    var btn=f.querySelector('button[type=submit]');
    function done(){note(f,'','✓ '+f.getAttribute('data-ok'));f.reset();}
    if(!f.hasAttribute('data-netlify')){done();return;}
    var fd=new FormData(f);
    btn.disabled=true;var label=btn.textContent;btn.textContent='SENDING…';
    fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fd).toString()})
      .then(function(r){if(!r.ok)throw new Error(r.status);done();})
      .catch(function(){note(f,'err','Sorry, that did not send. Please try again or email contact@apexsteel.com.');})
      .then(function(){btn.disabled=false;btn.textContent=label;});
  });});


  document.querySelectorAll('.chips[data-for]').forEach(function(bar){var t=document.getElementById(bar.getAttribute('data-for'));
    bar.addEventListener('click',function(e){var b=e.target.closest('.chip');if(!b)return;
      bar.querySelectorAll('.chip').forEach(function(c){c.setAttribute('aria-pressed',c===b);});
      var v=b.getAttribute('data-filter');t.querySelectorAll('[data-cat]').forEach(function(r){r.hidden=!(v==='all'||r.getAttribute('data-cat')===v);});});});

  var tabs=[].slice.call(document.querySelectorAll('[role=tab]'));
  function pick(id){tabs.forEach(function(t){var on=t.id===id;t.setAttribute('aria-selected',on);document.getElementById(t.getAttribute('aria-controls')).hidden=!on;});}
  tabs.forEach(function(t){t.addEventListener('click',function(){pick(t.id);});});
  function hdHash(){if(location.hash==='#help-desk')pick('tab-hd');else if(location.hash==='#contact')pick('tab-inq');}
  window.addEventListener('hashchange',hdHash);hdHash();

  var pages=[].slice.call(document.querySelectorAll('.page'));
  if(pages.length){
    function show(id){pages.forEach(function(p){p.classList.toggle('active',p.id==='pg-'+id);});
      document.querySelectorAll('.nx').forEach(function(n){n.hidden=n.getAttribute('data-pg')!==id;});
      document.querySelectorAll('[data-nav]').forEach(function(a){if(a.getAttribute('data-nav')===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
    function current(){var a=document.querySelector('.page.active');return a?a.id.slice(3):null;}
    function route(){var h=(location.hash||'#home').slice(1);
      if(document.getElementById('pg-'+h)){if(current()!==h)show(h);window.scrollTo({top:0,behavior:'instant'});return;}
      var el=document.getElementById(h);if(!el){show('home');return;}
      var pg=el.closest('.page');if(pg&&current()!==pg.id.slice(3))show(pg.id.slice(3));
      if(!current())show('home');
      requestAnimationFrame(function(){el.scrollIntoView({behavior:'smooth'});});}
    window.addEventListener('hashchange',route);route();
  }
})();

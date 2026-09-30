/* Cloud Nine — form checking for the consultation request and the patient sign-in.
   Nothing here sends anything. Errors follow the GOV.UK pattern: a summary at the top that links to
   each field (focused on submit, so a screen reader hears it), and the same words beside the field,
   tied to it with aria-describedby and aria-invalid. After the first attempt, fields re-check as you
   fix them. */
window.C9Form = (function () {
  'use strict';
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;
  // UK numbers: 0 or +44 then 9–10 digits, spaces, dashes and brackets allowed
  const phoneDigits = v => v.replace(/[\s\-().]/g, '').replace(/^(?:\+44|0044)(?=\d)/, '0');
  const isUKPhone = v => /^0\d{9,10}$/.test(phoneDigits(v));
  const isEmail = v => EMAIL.test(v.trim());

  /* rules: [{ name, focus, check(form) -> '' or a message }]
     Each rule has a wrapper [data-field="name"] holding a <p class="err" id="name-err" hidden>. */
  function attach(form, rules, onValid) {
    const summary = form.querySelector('.errsum');
    const list = summary && summary.querySelector('ul');
    const baseTitle = document.title;
    let tried = false;

    const wrap = r => form.querySelector('[data-field="' + r.name + '"]');
    const controls = r => [...wrap(r).querySelectorAll('input, select, textarea')];

    function show(r, msg) {
      const w = wrap(r), err = w.querySelector('.err');
      w.classList.toggle('bad', !!msg);
      err.hidden = !msg;
      err.innerHTML = msg ? '<span class="vh">Error: </span>' + msg : '';
      controls(r).forEach(c => {
        const ids = (c.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x !== err.id);
        if (msg) { c.setAttribute('aria-invalid', 'true'); ids.push(err.id); }
        else c.removeAttribute('aria-invalid');
        if (ids.length) c.setAttribute('aria-describedby', ids.join(' ')); else c.removeAttribute('aria-describedby');
      });
    }

    function run(onlyShown) {
      const bad = [];
      rules.forEach(r => {
        const msg = r.check(form) || '';
        if (!onlyShown || wrap(r).classList.contains('bad') || msg === '') show(r, msg);
        if (msg) bad.push({ r, msg });
      });
      return bad;
    }

    function summarise(bad) {
      if (!summary) return;
      summary.hidden = !bad.length;
      list.innerHTML = bad.map(b => '<li><a href="#' + b.r.focus + '">' + b.msg + '</a></li>').join('');
      document.title = bad.length ? 'Error: ' + baseTitle : baseTitle;
    }

    if (summary) summary.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]'); if (!a) return;
      const el = document.getElementById(a.getAttribute('href').slice(1)); if (!el) return;
      e.preventDefault();
      (el.closest('.field') || el).scrollIntoView({ block: 'start' });
      el.focus({ preventScroll: true });
    });

    // after the first attempt, errors clear (and the summary shrinks) as each field is put right
    const recheck = () => {
      if (!tried) return;
      const bad = run(true).filter(b => wrap(b.r).classList.contains('bad'));
      if (summary && !summary.hidden) summarise(bad);
    };
    form.addEventListener('input', recheck);
    form.addEventListener('change', recheck);

    form.addEventListener('submit', e => {
      e.preventDefault();                      // nothing is ever sent
      tried = true;
      const bad = run(false);
      summarise(bad);
      if (bad.length) { summary ? summary.focus() : document.getElementById(bad[0].r.focus).focus(); return; }
      onValid(new FormData(form));
    });

    return {
      reset() {
        tried = false; form.reset();
        rules.forEach(r => show(r, ''));
        if (summary) { summary.hidden = true; list.innerHTML = ''; }
        document.title = baseTitle;
      }
    };
  }

  return { attach, isEmail, isUKPhone, phoneDigits };
})();

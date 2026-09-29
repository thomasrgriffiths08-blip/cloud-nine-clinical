/* Cloud Nine — the product list, shared by the walk, the jar pages, the index and the admin.
   One source of truth: data/products.json. Public pages only ever read it. */
window.C9 = (function () {
  'use strict';
  let cache = null;
  async function load(fresh) {
    if (cache && !fresh) return cache;
    const r = await fetch('data/products.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('products.json ' + r.status);
    const j = await r.json();
    cache = { updated: j.updated, products: (j.products || []).slice().sort((a, b) => a.slot - b.slot) };
    return cache;
  }
  const num = v => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const pct = v => (v > 0 && v < 1 ? '<1' : num(v)) + '%';
  const STOCK = { in: 'In stock at the clinic', low: 'Low stock', out: 'Out of stock' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const page = p => 'cultivar.html?id=' + encodeURIComponent(p.id);
  // where on the Indica–Sativa line: 100% indica sits at the Indica (left) end
  const lean = p => ({ at: 100 - p.indica, label: p.indica + ' / ' + (100 - p.indica) });

  /* ---- the side panel: a jar at a glance (its kind, its photograph, its description), "View more" for
     its whole page. One panel per page, shared by the walk's jars and the index cards. ---- */
  let dr = null, list = [], at = 0, back = null, closing = 0;
  const $d = id => dr.querySelector('#jd-' + id);
  function build() {
    dr = document.createElement('div');
    dr.className = 'jd'; dr.hidden = true;
    dr.innerHTML =
      '<div class="jd-scrim" data-close></div>' +
      '<aside class="jd-panel" role="dialog" aria-modal="true" aria-labelledby="jd-name" tabindex="-1">' +
        '<div class="jd-top"><p class="label" id="jd-slot"></p>' +
          '<div class="jd-step"><button type="button" data-step="-1" aria-label="Previous jar">←</button>' +
          '<button type="button" data-step="1" aria-label="Next jar">→</button>' +
          '<button type="button" class="jd-x" data-close aria-label="Close">×</button></div></div>' +
        '<div class="jd-scroll">' +
          '<figure class="jd-ph"><img id="jd-img" alt=""><span class="jd-flag" id="jd-flag" hidden></span></figure>' +
          '<div class="jd-body">' +
            '<p class="jd-kind"><b id="jd-type"></b><span id="jd-lean"></span></p>' +
            '<h2 id="jd-name"></h2>' +
            '<div class="jd-line" aria-hidden="true"><span>Indica</span><i><b id="jd-dot"></b></i><span>Sativa</span></div>' +
            '<p class="jd-desc" id="jd-desc"></p>' +
            '<p class="jd-credit" id="jd-credit"></p>' +
          '</div>' +
        '</div>' +
        '<div class="jd-foot"><a class="btn solid" id="jd-more" href="#">View more <span class="arr">→</span></a>' +
          '<small>THC, CBD, terpenes and how it was grown.</small></div>' +
      '</aside>';
    document.body.appendChild(dr);
    dr.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) return close();
      const s = e.target.closest('[data-step]'); if (s) show(at + Number(s.dataset.step));
    });
    document.addEventListener('keydown', e => {
      if (dr.hidden || !dr.classList.contains('open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') show(at + 1);
      else if (e.key === 'ArrowLeft') show(at - 1);
      else if (e.key === 'Tab') {            // keep focus inside the panel while it is open
        const f = [...dr.querySelectorAll('.jd-panel a[href], .jd-panel button')].filter(el => el.offsetParent);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
  function show(i) {
    if (!list.length) return;
    at = (i + list.length) % list.length;
    const p = list[at], cr = p.credit || {};
    $d('slot').textContent = 'Jar ' + String(p.slot).padStart(2, '0') + ' · ' + (at + 1) + ' of ' + list.length;
    const img = $d('img'); img.src = p.image; img.alt = 'Photograph of ' + p.name + ' (demonstration image)';
    const flag = $d('flag'); flag.hidden = p.stock === 'in'; flag.textContent = STOCK[p.stock] || '';
    $d('type').textContent = p.type;
    $d('lean').textContent = p.indica + '% indica · ' + (100 - p.indica) + '% sativa';
    $d('name').textContent = p.name;
    $d('dot').style.left = lean(p).at + '%';
    $d('desc').textContent = p.notes || '';
    $d('credit').textContent = cr.by ? (cr.source === 'Pexels' ? 'Demo photograph · ' + cr.by + ' on Pexels' : 'Photograph · ' + cr.by) : '';
    $d('more').href = page(p);
    $d('more').setAttribute('aria-label', 'View more about ' + p.name);
    dr.querySelector('.jd-scroll').scrollTop = 0;
    // warm the neighbours so stepping through the shelf never waits on a photograph
    [list[(at + 1) % list.length], list[(at - 1 + list.length) % list.length]].forEach(q => { const im = new Image(); im.src = q.image; });
  }
  function open(items, id, from) {
    if (!dr) build();
    clearTimeout(closing);
    list = items.slice(); back = from || document.activeElement;
    show(Math.max(0, list.findIndex(p => p.id === id)));
    dr.hidden = false; void dr.offsetWidth;          // unhide, flush, then slide in
    dr.classList.add('open');
    document.documentElement.classList.add('jd-lock');
    dr.querySelector('.jd-panel').focus({ preventScroll: true });
  }
  function close() {
    if (!dr || dr.hidden) return;
    dr.classList.remove('open');
    document.documentElement.classList.remove('jd-lock');
    closing = setTimeout(() => { dr.hidden = true; }, 420);
    if (back && back.focus) back.focus({ preventScroll: true });
  }
  // a plain click opens the panel; a modified click (new tab, new window) still follows the link
  function bind(root, items) {
    root.addEventListener('click', e => {
      const a = e.target.closest('a[data-id]');
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault(); open(typeof items === 'function' ? items() : items, a.dataset.id, a);
    });
  }

  return { load, pct, num, esc, page, lean, STOCK, drawer: { open, close, bind } };
})();

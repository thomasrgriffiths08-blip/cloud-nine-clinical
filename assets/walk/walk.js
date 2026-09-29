/* Cloud Nine — the walk.
 *
 * The film is not a <video>. Browsers seek video badly: every scroll tick becomes an async seek, and
 * seeks that arrive faster than they finish are dropped, which reads as stutter. Instead every frame
 * is its own AVIF, drawn to one canvas. Scroll sets a target, a time-based spring follows it, and the
 * renderer draws the frame under the playhead with the NEXT frame blended on top by the fractional
 * part — so the picture moves continuously between frames rather than stepping 24 times a second.
 *
 * Loading is coarse-to-fine: every 16th frame first, then 8th, 4th, 2nd, all. The walk is scrubbable
 * as soon as the first pass lands (~14 frames) and sharpens while you walk. Compressed frames stay in
 * memory as blobs (~100 KB each); only a window around the playhead is decoded to bitmaps (~5.8 MB
 * each at 1600px), so memory stays flat however long the walk is.
 *
 * Modes:
 *   'frames' — the full walk (default).
 *   'stills' — three still photographs that dissolve into each other as you scroll. Opacity changes,
 *              nothing moves forward. For prefers-reduced-motion, and for browsers without AVIF.
 */
(function () {
  'use strict';

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const AVIF_PROBE = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';

  let avifOk = null;
  function supportsAvif() {
    if (avifOk) return avifOk;
    avifOk = new Promise(res => {
      const img = new Image();
      img.onload = () => res(img.width > 0);
      img.onerror = () => res(false);
      img.src = AVIF_PROBE;
    });
    return avifOk;
  }

  function Walk(o) {
    /* o = { base, runway, stage, canvas, mode, pxPerFrame, dwell, lookAround,
             onProgress(u), onLoad(fraction, ready), onGeometry(rect) } */
    const self = this;
    const canvas = o.canvas, ctx = canvas.getContext('2d', { alpha: false });
    // ?walktest=set:d,dpr:1.5,smooth:low,hold:0,blend:1 — switches for measuring on real hardware
    const T = {}; (new URLSearchParams(location.search).get('walktest') || '').split(',').forEach(kv => { const [k, v] = kv.split(':'); if (k) T[k] = v; });
    let DPR = Math.min(window.devicePixelRatio || 1, T.dpr ? +T.dpr : 1.5);   // taste-check §7: never raw DPR
    const OVERSCAN = 1.045;                                      // room for the look-around
    const LOOK = 0.012;                                          // max look-around, fraction of width
    let m = null, mode = o.mode || 'frames';
    let count = 0, lut = null, set = 'd', ext = 'avif';
    let blobs = [], bitmaps = new Map(), decoding = new Set(), stills = [];
    // The hardware path: the walk as one all-keyframe H.264 file, decoded frame by frame on the GPU's
    // video decoder through WebCodecs. An AVIF frame costs a laptop CPU 15-30 ms to decode, so a
    // quick scroll outruns it; a hardware H.264 frame costs a few ms and never leaves the GPU.
    let vid = null;          // { v: manifest entry, cfg, dec, buf, got, avail }
    const hasData = i => i >= 0 && i < count && (vid ? i < vid.avail : !!blobs[i]);
    let target = 0, cur = 0, shown = -1, lastT = 0, running = false, inView = true, dir = 1, shownF = -1;
    let walkPx = 1, seenH = 0, seenW = 0, vhUsed = 0;
    let px = 0, py = 0, tx = 0, ty = 0;          // look-around: eased and target pointer
    let loaded = 0, readyFired = false, dirty = true;
    let w = 0, h = 0;

    self.progress = () => cur;

    /* ---- geometry: runway height is fixed pixels per frame, so the exchange rate between scroll
            and walk is identical on every screen ---- */
    const needsLayout = () => innerHeight !== seenH || innerWidth !== seenW;
    function layout() {
      // A phone's viewport grows when its address bar hides and shrinks when it shows. Using the
      // largest height seen (reset on a width change, i.e. rotation) means the page length changes
      // at most once, instead of twitching every time the bar moves mid-scroll.
      vhUsed = innerWidth !== seenW ? innerHeight : Math.max(vhUsed, innerHeight);
      seenH = innerHeight; seenW = innerWidth;
      const vh = vhUsed;
      const steps = mode === 'frames' ? (count - 1) : 2;
      const per = mode === 'frames' ? o.pxPerFrame : vh * 0.8;
      walkPx = Math.max(1, Math.round(steps * per));
      o.runway.style.height = Math.round(walkPx + vh * (1 + (o.dwell || 0.9))) + 'px';
      resize();
    }
    function resize() {
      const r = o.stage.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
      dirty = true;
    }
    function scrollProgress() {
      if (needsLayout()) layout();
      const r = o.runway.getBoundingClientRect();
      return clamp(-r.top / walkPx, 0, 1);
    }
    self.scrollTo = (u, smooth) => {
      const top = o.runway.getBoundingClientRect().top + scrollY + u * walkPx;
      window.scrollTo({ top: Math.round(top), behavior: smooth ? 'smooth' : 'auto' });
    };
    self.walkPx = () => walkPx;
    // for tests: is the frame under the playhead decoded, and which set is in use
    self.debug = () => ({ set, path: vid ? 'hardware ' + vid.cfg.codec : 'avif', want: frameAt(cur), shown: shownF, bitmaps: bitmaps.size, loaded, count, dpr: DPR });
    self.manifest = () => m;
    // jump the playhead without scrolling (console / tests); decodes the window around it first
    self.seek = u => { target = cur = clamp(u, 0, 1); if (mode === 'frames') manageWindow(Math.round(frameAt(cur))); self.redraw(); };

    /* ---- scroll → frame, via the motion table so every pixel of scroll covers the same distance ---- */
    function frameAt(u) {
      if (mode === 'stills') {
        // Hold each photograph, dissolve only through the middle 30% of its stretch: two framings of
        // the lodge at different distances superimpose as a muddy double exposure, so keep it brief.
        const x = u * 2, s = Math.min(1, Math.floor(x)), t = x - s;
        const d = clamp((t - 0.35) / 0.3, 0, 1);
        return s + d * d * (3 - 2 * d);
      }
      if (!lut) return u * (count - 1);
      const x = u * (lut.length - 1), i = Math.min(lut.length - 2, Math.floor(x)), f = x - i;
      return (lut[i] + (lut[i + 1] - lut[i]) * f) * (count - 1);
    }

    /* ---- frames ---- */
    const url = i => o.base + '/' + set + '/' + String(i).padStart(3, '0') + '.' + ext;
    function loadOrder(n) {
      const order = [], seen = new Uint8Array(n);
      const push = i => { if (i >= 0 && i < n && !seen[i]) { seen[i] = 1; order.push(i); } };
      push(0); push(n - 1);
      for (const s of [16, 8, 4, 2, 1]) for (let i = 0; i < n; i += s) push(i);
      return order;
    }
    function fetchAll() {
      const order = loadOrder(count);
      const firstPass = Math.ceil(count / 16) + 1;
      let next = 0, active = 0;
      const pump = () => {
        while (active < 6 && next < order.length) {
          const i = order[next++]; active++;
          fetch(url(i)).then(r => r.ok ? r.blob() : Promise.reject(r.status)).then(b => {
            blobs[i] = b; loaded++;
            if (Math.abs(i - Math.round(frameAt(cur))) < 14) decode(i);
          }).catch(() => {}).finally(() => {
            active--;
            const frac = loaded / count;
            if (!readyFired && loaded >= firstPass) { readyFired = true; o.onLoad && o.onLoad(frac, true); }
            else o.onLoad && o.onLoad(frac, readyFired);
            pump();
          });
        }
      };
      pump();
    }
    function decode(i) {
      if (vid) {
        if (!hasData(i) || bitmaps.has(i) || decoding.has(i) || decoding.size > 8 || !vid.dec || vid.dec.state !== 'configured') return;
        decoding.add(i);
        const v = vid.v;
        try { vid.dec.decode(new EncodedVideoChunk({ type: 'key', timestamp: i, data: vid.buf.subarray(v.pos[i], v.pos[i] + v.size[i]) })); }
        catch (e) { decoding.delete(i); toFrames(); }
        return;
      }
      if (!blobs[i] || bitmaps.has(i) || decoding.has(i) || decoding.size > 5) return;
      decoding.add(i);
      createImageBitmap(blobs[i]).then(bm => {
        bitmaps.set(i, bm); dirty = true;
      }).catch(() => {}).finally(() => decoding.delete(i));
    }
    // Decode far ahead in the direction of travel and a little behind, nearest first, so a quick
    // scroll finds its frames ready instead of stepping to whatever happens to be decoded.
    function manageWindow(center) {
      const ahead = vid ? 10 : 20, behind = vid ? 4 : 8, cap = vid ? 20 : 56, far = vid ? 12 : 32;
      for (let d = 0; d <= ahead; d++) { decode(center + dir * d); if (d <= behind) decode(center - dir * d); }
      if (bitmaps.size > cap) for (const [i, bm] of bitmaps) {
        if (Math.abs(i - center) > far && (vid || (i !== 0 && i !== count - 1))) { bm.close && bm.close(); bitmaps.delete(i); }
      }
    }
    function nearest(i) {
      if (bitmaps.has(i)) return i;
      for (let d = 1; d < count; d++) {
        if (bitmaps.has(i - d)) return i - d;
        if (bitmaps.has(i + d)) return i + d;
      }
      return -1;
    }

    /* ---- drawing: object-fit: cover, plus overscan and the look-around offset ---- */
    let geo = null;
    function coverRect(iw, ih) {
      const s = Math.max(w / iw, h / ih) * (mode === 'frames' ? OVERSCAN : 1);
      const dw = iw * s, dh = ih * s;
      const ox = mode === 'frames' ? px * LOOK * w : 0, oy = mode === 'frames' ? py * LOOK * 0.6 * h : 0;
      return { x: (w - dw) / 2 - ox, y: (h - dh) / 2 - oy, w: dw, h: dh };
    }
    function draw(f) {
      const src = mode === 'stills' ? stills : null;
      const i = Math.floor(f), a = f - i;
      let b0, b1, exact, blendA = 0;
      if (src) { b0 = src[clamp(i, 0, 2)]; b1 = src[clamp(i + 1, 0, 2)]; exact = true; }
      else {
        // Blend between the nearest decoded frames either side of the playhead, as long as they are
        // close (<=4 frames apart). Fully loaded, that is always i and i+1; while frames are still
        // arriving it bridges small gaps smoothly instead of stepping.
        const ci = clamp(i, 0, count - 1);
        let lo = -1, hi = -1;
        for (let d = 0; d <= 4 && lo < 0; d++) if (bitmaps.has(ci - d)) lo = ci - d;
        for (let d = 1; d <= 4 && hi < 0; d++) if (bitmaps.has(ci + d)) hi = ci + d;
        if (lo < 0) { const n = nearest(ci); if (n < 0) return false; lo = n; hi = -1; }
        b0 = bitmaps.get(lo);
        if (hi > lo) { b1 = bitmaps.get(hi); exact = true; blendA = clamp((f - lo) / (hi - lo), 0, 1); }
        else { b1 = null; exact = false; }
      }
      if (!b0) return false;
      const iw = b0.displayWidth || b0.width, ih = b0.displayHeight || b0.height, g = coverRect(iw, ih);
      const alpha = src ? a : blendA;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = T.smooth || 'high';   // reset by every canvas resize
      ctx.globalAlpha = 1;
      ctx.drawImage(b0, g.x, g.y, g.w, g.h);
      if (exact && b1 && alpha > 0.004 && T.blend !== '0') { ctx.globalAlpha = alpha; ctx.drawImage(b1, g.x, g.y, g.w, g.h); ctx.globalAlpha = 1; }
      if (!geo || geo.x !== g.x || geo.y !== g.y || geo.w !== g.w || geo.h !== g.h) {
        geo = g; o.onGeometry && o.onGeometry(g);
      }
      return true;
    }

    /* ---- the loop: runs only while the stage is on screen and the tab is visible ---- */
    function tick(t) {
      if (!running) return;
      // self-heal: never trust that a resize event arrived (embedded panes and some mobile browsers
      // resize the viewport silently). innerWidth/innerHeight reads do not force a layout flush.
      if (needsLayout()) { layout(); target = scrollProgress(); }
      const dt = Math.min(64, lastT ? t - lastT : 16); lastT = t;
      // critically damped follow: frame-rate independent, never overshoots
      const k = 1 - Math.exp(-dt / 95);
      cur += (target - cur) * k;
      if (Math.abs(target - cur) < 0.00015) cur = target;
      if (o.lookAround) {
        const kl = 1 - Math.exp(-dt / 420);
        px += (tx - px) * kl; py += (ty - py) * kl;
      }
      let f = frameAt(cur);
      if (mode === 'frames' && shownF >= 0 && T.hold !== '0') {
        // Never skip. A slow CPU decodes fewer frames a second than a quick scroll asks for; rather than
        // jump to whatever happens to be decoded, step through consecutive decoded frames from where we
        // are, so a fast flick trails for a moment and catches up instead of stuttering. A long jump
        // (the rail, a link to #counter) still goes straight there.
        const from = Math.floor(shownF), to = Math.floor(f);
        if (Math.abs(to - from) <= 48) {
          if (to > from) { let k = from; while (k < to && bitmaps.has(k + 1)) k++; if (k < to && hasData(k + 1)) f = k; }
          else if (to < from) { let k = from; while (k > to && bitmaps.has(k - 1)) k--; if (k > to && hasData(k - 1)) f = k; }
        }
      }
      if (mode === 'frames') manageWindow(Math.round(f));
      const key = Math.round(f * 1000) + ':' + Math.round(px * 1000) + ':' + Math.round(py * 1000);
      if (dirty || key !== shown) { if (draw(f)) { shown = key; shownF = f; dirty = false; } }
      o.onProgress && o.onProgress(cur);
      requestAnimationFrame(tick);
    }
    function start() { if (!running && inView && !document.hidden) { running = true; lastT = 0; requestAnimationFrame(tick); } }
    function stop() { running = false; }
    self.redraw = () => {
      if (needsLayout()) layout();
      dirty = true; if (!running) { draw(frameAt(cur)); o.onProgress && o.onProgress(cur); }
    };

    /* ---- input ---- */
    addEventListener('scroll', () => { const t = scrollProgress(); if (t !== target) dir = t > target ? 1 : -1; target = t; start(); }, { passive: true });
    addEventListener('resize', () => { layout(); target = scrollProgress(); self.redraw(); }, { passive: true });
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    new IntersectionObserver(es => { inView = es[0].isIntersecting; inView ? start() : stop(); }).observe(o.stage);
    if (o.lookAround) {
      // Pointer only, never touch: a hand on a phone is scrolling, not looking around.
      o.stage.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        tx = (e.clientX / w) * 2 - 1; ty = (e.clientY / h) * 2 - 1; start();
      }, { passive: true });
      o.stage.addEventListener('pointerleave', () => { tx = 0; ty = 0; start(); });
    }

    /* ---- boot ---- */
    self.setMode = next => {
      mode = next; px = py = tx = ty = 0; dirty = true;
      const keep = cur; layout(); target = cur = keep;
      if (mode === 'stills' && !stills.length) loadStills().then(() => self.redraw());
      if (mode === 'frames' && !loaded) fetchAll();
      self.redraw();
    };
    function loadStills() {
      return Promise.all(m.stills.map(k => new Promise(res => {
        const img = new Image();
        // createImageBitmap decodes off the main thread and, unlike img.decode(), does not wait for the
        // page to be rendering — a background tab would otherwise never draw the stills.
        img.onload = () => (window.createImageBitmap ? createImageBitmap(img).catch(() => img) : Promise.resolve(img)).then(res);
        img.onerror = () => res(null);
        img.src = o.base + '/still/' + String(k).padStart(3, '0') + '.jpg';
      }))).then(imgs => { stills = imgs.filter(Boolean); if (stills.length < 3) stills = [stills[0], stills[0], stills[0]].filter(Boolean); });
    }

    async function videoConfig(v) {
      const description = Uint8Array.from(atob(v.avcc), c => c.charCodeAt(0));
      for (const codec of [v.codec, v.codec.slice(0, 7) + '00' + v.codec.slice(9)]) {
        const c = { codec, description, codedWidth: v.w, codedHeight: v.h, hardwareAcceleration: 'prefer-hardware', optimizeForLatency: true };
        try { if ((await VideoDecoder.isConfigSupported(c)).supported) return c; } catch (e) {}
      }
      return null;
    }
    function startDecoder() {
      vid.dec = new VideoDecoder({
        output: fr => { const i = fr.timestamp; decoding.delete(i);
          if (!vid || bitmaps.has(i)) { fr.close(); return; } bitmaps.set(i, fr); dirty = true; },
        error: () => toFrames()
      });
      vid.dec.configure(vid.cfg);
    }
    // stream the file; every frame whose bytes have arrived can be decoded, so the walk starts at once
    async function fetchVideo() {
      const v = vid.v; vid.buf = new Uint8Array(v.bytes); vid.got = 0; vid.avail = 0;
      startDecoder();
      try {
        const r = await fetch(o.base + '/' + v.src); if (!r.ok || !r.body) throw 0;
        const reader = r.body.getReader();
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          if (!vid) return;
          vid.buf.set(value, vid.got); vid.got += value.length;
          let a = vid.avail; while (a < count && v.pos[a] + v.size[a] <= vid.got) a++;
          if (a !== vid.avail) {
            vid.avail = loaded = a; dirty = true;
            if (!readyFired && a >= Math.min(count, 12)) { readyFired = true; o.onLoad && o.onLoad(a / count, true); }
            else o.onLoad && o.onLoad(a / count, readyFired);
            if (Math.abs(a - Math.round(frameAt(cur))) < 24) manageWindow(Math.round(frameAt(cur)));
          }
        }
      } catch (e) { toFrames(); }
    }
    // anything goes wrong with the hardware path: drop to the AVIF frames, same pictures
    function toFrames() {
      if (!vid) return;
      const d = vid.dec; vid = null;
      try { d && d.state !== 'closed' && d.close(); } catch (e) {}
      for (const [, bm] of bitmaps) bm.close && bm.close();
      bitmaps.clear(); decoding.clear(); loaded = 0; readyFired = false; shownF = -1;
      DPR = Math.min(window.devicePixelRatio || 1, T.dpr ? +T.dpr : 1.5); layout();
      fetchAll();
    }
    self.ready = fetch(o.base + '/manifest.json', { cache: 'no-cache' }).then(r => r.json()).then(async manifest => {
      m = manifest; count = m.count; lut = m.lut; ext = m.ext || 'avif';
      // phones get 960px frames; laptops and desktops whose canvas is wider than the 1600px set get
      // the 1920px set when the walk has one (a Retina laptop otherwise upscales 1600px ~1.7x: soft)
      const cw = innerWidth * DPR;
      set = T.set || (cw <= 1100 ? 'm' : (cw > 1700 && m.sizes && m.sizes.h ? 'h' : 'd'));
      if (mode === 'frames' && m.video && T.codec !== '0' && window.VideoDecoder && window.EncodedVideoChunk) {
        const v = set === 'm' ? m.video.sd : m.video.hd, cfg = await videoConfig(v);
        if (cfg) vid = { v, cfg };   // measured on an Intel Iris laptop: DPR 2 drops to 43 fps, 1.5 holds 60
      }
      if (mode === 'frames' && !vid && !(await supportsAvif())) mode = 'stills';
      layout();
      target = cur = scrollProgress();
      if (mode === 'stills') { await loadStills(); o.onLoad && o.onLoad(1, true); }
      else if (vid) fetchVideo();
      else fetchAll();
      self.redraw(); start();
      return mode;
    });
  }

  window.CloudNineWalk = Walk;
})();

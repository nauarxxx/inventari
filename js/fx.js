/* Inventari de casa · fx.js — sons (WALL-E, avisos) i celebracions amb confeti */

/* =====================================================================
   🔊 So de WALL-E en obrir l'assistent de productes
   Fitxer: «Walle.mp3» (al costat de l'index.html, amb la W majúscula).
   Si no es pot carregar, sona un so robòtic de reserva.
   ===================================================================== */
const WALLE_SRC = "Walle.mp3";
let wAudio = null, wBad = false, wLast = 0, wCtx = null;
let wVer = 0;
function walleWarm(){
  if(wAudio && wVer !== cfgGet("wver")){ wAudio = null; wBad = false; }
  /* es crea dins d'un toc de l'usuari, perquè el navegador deixi sonar després */
  if(wAudio || wBad) return;
  try {
    wVer = cfgGet("wver"); wAudio = new Audio(WALLE_SRC + "?v=" + wVer); wAudio.preload = "auto"; wAudio.playsInline = true;
    wAudio.addEventListener("error", () => { wBad = true; });
    wAudio.load();
  } catch(e){ wBad = true; wAudio = null; }
}
function walleVol(){ return Math.max(0, Math.min(1, cfgGet("wvol") / 100)); }
function walleStop(){ try { if(wAudio){ wAudio.pause(); wAudio.currentTime = 0; } } catch(e){} }
/* so robòtic de reserva («WAL-LEE»), fet amb Web Audio: sense fitxers */
function walleSynth(vol){
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
    wCtx = wCtx || new AC(); if(wCtx.state === "suspended") wCtx.resume();
    const t0 = wCtx.currentTime + .02, g = wCtx.createGain(); g.connect(wCtx.destination);
    g.gain.setValueAtTime(0, t0);
    const note = (f0, f1, t, d, type) => {
      const o = wCtx.createOscillator(), e = wCtx.createGain(), bp = wCtx.createBiquadFilter();
      o.type = type || "sawtooth"; o.frequency.setValueAtTime(f0, t0 + t); o.frequency.exponentialRampToValueAtTime(f1, t0 + t + d);
      bp.type = "bandpass"; bp.frequency.value = 1100; bp.Q.value = 2.2;
      e.gain.setValueAtTime(0, t0 + t); e.gain.linearRampToValueAtTime(vol * .55, t0 + t + .03); e.gain.exponentialRampToValueAtTime(.0001, t0 + t + d);
      o.connect(bp); bp.connect(e); e.connect(g); o.start(t0 + t); o.stop(t0 + t + d + .05);
    };
    g.gain.setValueAtTime(1, t0);
    note(210, 330, 0, .22);          /* WAL */
    note(330, 520, .22, .12, "square");
    note(520, 300, .36, .34);        /* -LEE */
    note(300, 420, .36, .34, "triangle");
  } catch(e){}
}
function walleSay(force){
  const v = walleVol();
  if(v <= 0){ if(force) toast("El volum de WALL-E està a 0."); return; }
  const now = Date.now();
  if(!force && now - wLast < cfgGet("wgap")) return;
  wLast = now;
  walleWarm();
  if(!wAudio || wBad){ walleSynth(v); return; }
  try {
    wAudio.pause(); wAudio.currentTime = 0; wAudio.volume = v;
    const p = wAudio.play();
    if(p && p.catch) p.catch(err => {
      /* el navegador ha bloquejat el so: no es fa res. Si el fitxer no existeix o no es pot llegir: so de reserva */
      if(err && err.name !== "NotAllowedError" && err.name !== "AbortError"){ wBad = true; walleSynth(v); }
    });
  } catch(e){ wBad = true; walleSynth(v); }
}


/* ---- avís sonor del xat ---- */
function audioCtx(){
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
  wCtx = wCtx || new AC(); if(wCtx.state === "suspended") wCtx.resume();
  return wCtx;
}
function chatBeep(force){
  const v = cfgGet("chatVol") / 100;
  if(v <= 0){ if(force) toast("El volum de l'avís del xat està a 0."); return; }
  try {
    const c = audioCtx(); if(!c) return;
    const t0 = c.currentTime + .02;
    [[880, 0], [1318, .14]].forEach(([f, t]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + t); g.gain.linearRampToValueAtTime(v * .5, t0 + t + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + t + .24);
      o.connect(g); g.connect(c.destination); o.start(t0 + t); o.stop(t0 + t + .27);
    });
  } catch(e){}
}
/* el navegador només deixa sonar després d'un toc: es prepara en el primer toc quan l'avís està activat */
addEventListener("pointerdown", () => { if(cfgGet("chatVol") > 0){ try { audioCtx(); } catch(e){} } }, {passive:true});

/* ---------- confeti, cintes i celebració de Nau&Noa House ---------- */
const FX = {parts:[], sched:[], raf:0, last:0, until:0, W:0, H:0, dpr:1, cv:null, ctx:null, vt:3.4, run:false, rm:false};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const GOLD = ["#ffd23f", "#f5c242", "#ffe9a0", "#fff7d6", "#d9a21b", "#ffffff"];
const MULTI = ["#ff4d6d", "#ffd23f", "#4fe3d2", "#5ea0ff", "#b388ff", "#ff9f40", "#7ef0c4", "#ffffff"];
const NAUNOA = ["#4fe3d2", "#ff7eb6", "#ffd23f", "#ffffff", "#b388ff", "#8af7eb", "#ffb3d9", "#ffe08a"];
function fxPal(house){
  const p = cfgGet("fxPal"), cs = getComputedStyle(document.documentElement);
  const ac = (cs.getPropertyValue("--accent") || "#4fe3d2").trim(), hi = (cs.getPropertyValue("--accent-hi") || "#8af7eb").trim(), lo = (cs.getPropertyValue("--accent-lo") || "#2fc9b7").trim();
  if(p === 1) return MULTI; if(p === 2) return GOLD; if(p === 3) return [ac, hi, lo, "#ffffff", ac];
  return house ? NAUNOA : [ac, hi, "#ffd23f", "#ff6fb5", "#ffffff", "#b388ff", "#5ea0ff"];
}
function fxResize(){
  FX.dpr = Math.min(2, devicePixelRatio || 1); FX.W = innerWidth; FX.H = innerHeight;
  FX.cv.width = Math.round(FX.W * FX.dpr); FX.cv.height = Math.round(FX.H * FX.dpr);
  FX.ctx.setTransform(FX.dpr, 0, 0, FX.dpr, 0, 0);
}
function fxBegin(){
  const el = $("fx");
  if(!FX.cv){ FX.cv = $("fxc"); FX.ctx = FX.cv.getContext("2d"); }
  FX.rm = matchMedia("(prefers-reduced-motion: reduce)").matches; FX.cut = false; FX.n = (FX.n || 0) + 1;
  el.classList.add("on");
  try { if(el.showPopover && !el.matches(":popover-open")) el.showPopover(); } catch(_){}
  fxResize();
  if(!FX.run){ FX.run = true; FX.last = performance.now(); FX.raf = requestAnimationFrame(fxLoop); }
}
function fxEnd(){
  FX.run = false; cancelAnimationFrame(FX.raf); FX.parts.length = 0; FX.sched.length = 0;
  if(FX.ctx) FX.ctx.clearRect(0, 0, FX.W, FX.H);
  const el = $("fx"); el.classList.remove("on");
  try { if(el.hidePopover && el.matches(":popover-open")) el.hidePopover(); } catch(_){}
  $("fxban").hidden = true;
}
addEventListener("resize", () => { if(FX.run) fxResize(); });
/* partícules */
function pRect(x, y, vx, vy, col, sz, max){ FX.parts.push({k:0, x, y, vx, vy, col, w:sz * rnd(.55, 1), h:sz * rnd(1, 1.8), r:rnd(0, 6.28), vr:rnd(-.35, .35), tp:rnd(0, 6.28), tv:rnd(.08, .3), wob:rnd(0, 6.28), wa:rnd(.05, .5), g:.2, dr:.985, vt:FX.vt * rnd(.8, 1.15), life:0, max}); }
function pDot(x, y, vx, vy, col, sz, max){ FX.parts.push({k:1, x, y, vx, vy, col, w:sz * .45, r:0, vr:0, wob:rnd(0, 6.28), wa:rnd(.05, .4), g:.2, dr:.985, vt:FX.vt * rnd(.8, 1.1), life:0, max}); }
function pStar(x, y, vx, vy, col, sz, max){ FX.parts.push({k:2, x, y, vx, vy, col, w:sz * .8, r:rnd(0, 6.28), vr:rnd(-.2, .2), wob:rnd(0, 6.28), wa:rnd(.05, .4), g:.18, dr:.985, vt:FX.vt * rnd(.7, 1), life:0, max}); }
function pSpark(x, y, vx, vy, col, sz, max){ FX.parts.push({k:3, x, y, vx, vy, col, w:sz, g:.06, dr:.955, vt:6, life:0, max}); }
function pRib(x, y, vx, vy, col, w, n, max, g, dr){ FX.parts.push({k:4, x, y, vx, vy, col, w, n, hist:[], ph:rnd(0, 6.28), fr:rnd(.06, .12), am:rnd(.9, 2.6), tw:rnd(0, 6.28), g:g == null ? .05 : g, dr:dr || .992, vt:FX.vt * rnd(.45, .8), life:0, max}); }
function fxMake(x, y, vx, vy, pal, max, sc, star){
  const col = pick(pal), r = Math.random(), sz = rnd(6, 11) * sc, m = Math.round(max * rnd(.8, 1.1));
  if(star && r < .3) pStar(x, y, vx, vy, col, sz * 1.5, m);
  else if(r < .74) pRect(x, y, vx, vy, col, sz, m);
  else if(r < .9) pDot(x, y, vx, vy, col, sz, m);
  else pRect(x, y, vx, vy, col, sz * 1.25, m);
}
function fxAt(at, fn){ FX.sched.push({at, dur:0, n:1, done:0, fn}); }
function fxStream(at, dur, n, fn){ FX.sched.push({at, dur, n, done:0, fn}); }
function fxStep(p, dt){
  p.life += dt;
  if(p.k === 4){
    p.vx *= Math.pow(p.dr, dt); p.vy = Math.min(p.vt, p.vy + p.g * dt);
    p.x += p.vx * dt; p.y += p.vy * dt; p.ph += p.fr * dt; p.tw += .09 * dt;
    p.hist.push(p.x + Math.sin(p.ph) * p.am * 9, p.y);
    if(p.hist.length > p.n * 2) p.hist.splice(0, 2);
    return;
  }
  p.vx *= Math.pow(p.dr, dt); p.vy += p.g * dt; if(p.vy > p.vt) p.vy = p.vt;
  p.x += (p.vx + (p.wa ? Math.sin(p.wob) * p.wa : 0)) * dt; p.y += p.vy * dt;
  p.wob += .08 * dt; p.r += (p.vr || 0) * dt; if(p.tv) p.tp += p.tv * dt;
}
function fxDraw(c, p){
  const a = Math.max(0, Math.min(1, (p.max - p.life) / (p.max * .28)));
  if(p.k === 4){
    const h = p.hist, n = h.length / 2; if(n < 2) return;
    c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = p.col;
    for(let s = 0; s < n - 1; s += 6){
      const e = Math.min(n - 1, s + 6);
      c.globalAlpha = a * (.3 + .7 * s / n); c.lineWidth = p.w * (.3 + .7 * Math.abs(Math.cos(p.tw + s * .32)));
      c.beginPath(); c.moveTo(h[s * 2], h[s * 2 + 1]);
      for(let i = s + 1; i <= e; i++) c.lineTo(h[i * 2], h[i * 2 + 1]);
      c.stroke();
    }
    c.globalAlpha = 1; return;
  }
  c.globalAlpha = a; c.fillStyle = p.col;
  if(p.k === 0){
    c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.scale(1, Math.cos(p.tp)); c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
  } else if(p.k === 1){
    c.beginPath(); c.arc(p.x, p.y, p.w, 0, 6.2832); c.fill();
  } else if(p.k === 2){
    c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.beginPath();
    for(let i = 0; i < 10; i++){ const rr = i % 2 ? p.w * .45 : p.w, an = i * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    c.closePath(); c.fill(); c.restore();
  } else {
    c.globalCompositeOperation = "lighter"; c.beginPath(); c.arc(p.x, p.y, p.w * (.5 + a * .6), 0, 6.2832); c.fill(); c.globalCompositeOperation = "source-over";
  }
  c.globalAlpha = 1;
}
function fxLoop(ts){
  if(!FX.run) return;
  const dt = Math.min(2.2, (ts - FX.last) / 16.667 || 1); FX.last = ts;
  const c = FX.ctx, H = FX.H;
  c.clearRect(0, 0, FX.W, H);
  for(let i = FX.sched.length - 1; i >= 0; i--){
    const s = FX.sched[i]; if(ts < s.at) continue;
    const k = s.dur > 0 ? Math.min(1, (ts - s.at) / s.dur) : 1, want = Math.round(s.n * k);
    while(s.done < want){ s.done++; s.fn(); }
    if(s.done >= s.n) FX.sched.splice(i, 1);
  }
  const P = FX.parts;
  if(ts > FX.until && !FX.cut){ FX.cut = true; P.forEach(p => { p.max = Math.min(p.max, p.life + 30); }); }
  if(ts > FX.until + 2500){ fxEnd(); return; }
  for(let i = P.length - 1; i >= 0; i--){
    const p = P[i]; fxStep(p, dt);
    const gone = p.life > p.max || (p.k === 4 ? (p.hist.length > 1 && p.hist[1] > H + 40 && p.vy > 0) : (p.y > H + 70 && p.vy > 0));
    if(gone){ P.splice(i, 1); continue; }
    fxDraw(c, p);
  }
  if(!P.length && !FX.sched.length && ts > FX.until){ fxEnd(); return; }
  FX.raf = requestAnimationFrame(fxLoop);
}
function fxSound(house){
  const v = cfgGet("fxVol") / 100; if(v <= 0) return;
  try {
    const c = audioCtx(); if(!c) return;
    const t0 = c.currentTime + .02, notes = house ? [523, 659, 784, 1047, 1319, 1568, 2093] : [784, 988, 1175];
    notes.forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(), t = t0 + i * (house ? .1 : .08), d = house ? .6 : .32;
      o.type = house ? "triangle" : "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * (house ? .5 : .4), t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .03);
    });
  } catch(_){}
}
const fxScale = () => Math.max(.65, Math.min(1.5, Math.min(FX.W, FX.H) / 560));
/* celebració normal: article creat */
function fxCreate(force){
  if(!force && !cfgGet("fxOn")) return;
  fxBegin();
  const f = FX.rm ? .4 : 1, N = Math.max(10, Math.round(cfgGet("fxN") * f)), T = cfgGet("fxT"), W = FX.W, H = FX.H, now = performance.now(), sc = fxScale(), pal = fxPal(false), max = Math.round(T / 16.667);
  FX.vt = Math.max(1.5, Math.min(6.5, (H + 60) / (T / 16.667 * .85)));
  FX.until = Math.max(FX.until, now + T + 500);
  const nb = Math.round(N * .42), nc = Math.round(N * .14), nr = Math.max(0, N - nb - 2 * nc);
  for(let i = 0; i < nb; i++){ const a = -Math.PI / 2 + rnd(-2.1, 2.1), v = rnd(5, 17) * sc; fxMake(W / 2 + rnd(-30, 30), H * .56 + rnd(-20, 20), Math.cos(a) * v, Math.sin(a) * v, pal, max, sc); }
  [[0, -1.0], [W, -2.14]].forEach(([x, ang]) => { for(let i = 0; i < nc; i++){ const a = ang + rnd(-.28, .28), v = rnd(11, 25) * sc; fxMake(x, H * rnd(.78, .9), Math.cos(a) * v, Math.sin(a) * v, pal, max, sc); } });
  fxStream(now + 80, Math.min(900, T * .4), nr, () => fxMake(rnd(0, W), -14, rnd(-1.5, 1.5), rnd(.5, 3), pal, max, sc));
  fxSound(false);
}
/* celebració gran: article a Nau&Noa House */
function fxHouse(c, force){
  if(!force && !cfgGet("houseOn")) return;
  fxBegin();
  const f = FX.rm ? .4 : 1, N = Math.max(40, Math.round(cfgGet("houseN") * f)), T = cfgGet("houseT"), R = FX.rm ? 0 : cfgGet("houseR"), W = FX.W, H = FX.H, now = performance.now(), sc = fxScale(), pal = fxPal(true), max = Math.round(T / 16.667 * .95);
  FX.vt = Math.max(1.3, Math.min(5, (H + 60) / (T / 16.667 * .8)));
  FX.until = Math.max(FX.until, now + T + 700);
  /* flaix i cartell */
  const fl = $("fxflash"); fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go");
  const ban = $("fxban");
  if(cfgGet("houseBan")){
    ban.innerHTML = '<div class="e">🏡</div><b>Nau&amp;Noa House</b><small>' + (c ? '«' + esc(c.item) + '» ja és a casa!' : 'Benvinguts a casa!') + '</small>';
    ban.style.setProperty("--bt", Math.min(T / 1000, 4.6) + "s"); ban.hidden = false; ban.style.animation = "none"; void ban.offsetWidth; ban.style.animation = "";
  } else ban.hidden = true;
  const nb = Math.round(N * .24), nc = Math.round(N * .09), nv = Math.round(N * .05), nr = Math.max(0, N - nb - 2 * nc - 5 * (nv + nc));
  const boom = (x, y, n, v0, v1, star) => { for(let i = 0; i < n; i++){ const a = rnd(0, 6.2832), v = rnd(v0, v1) * sc; fxMake(x, y, Math.cos(a) * v, Math.sin(a) * v, pal, max, sc, star); } };
  const cannons = n => [[0, -1.0], [W, -2.14]].forEach(([x, ang]) => { for(let i = 0; i < n; i++){ const a = ang + rnd(-.3, .3), v = rnd(13, 28) * sc; fxMake(x, H * rnd(.78, .92), Math.cos(a) * v, Math.sin(a) * v, pal, max, sc, true); } });
  boom(W / 2, H * .5, nb, 5, 19, true); cannons(nc);
  for(let i = 0; i < 14 && !FX.rm; i++){ const a = rnd(0, 6.2832), v = rnd(2, 9) * sc; pSpark(W / 2, H * .5, Math.cos(a) * v, Math.sin(a) * v, "#ffe9a0", rnd(3, 6) * sc, 50); }
  [450, 900, 1400, 2000, 2800].forEach(dt => fxAt(now + dt, () => {
    if(dt > T * .8) return;
    cannons(nc >> 1);
    const x = rnd(W * .15, W * .85), y = rnd(H * .14, H * .46);
    boom(x, y, nv, 3, 12, true);
    for(let i = 0; i < 18; i++){ const a = rnd(0, 6.2832), v = rnd(2, 8) * sc; pSpark(x, y, Math.cos(a) * v, Math.sin(a) * v, pick(["#ffe9a0", "#ffffff", "#ff9ccb", "#8af7eb"]), rnd(2.5, 5) * sc, 46); }
  }));
  fxStream(now + 150, T * .7, nr, () => fxMake(rnd(0, W), -14, rnd(-1.4, 1.4), rnd(.4, 2.4), pal, max, sc, true));
  /* cintes: cauen de dalt i es llancen des dels racons */
  for(let j = 0; j < R; j++){
    fxAt(now + rnd(0, T * .45), () => {
      const n = Math.round(rnd(60, 110) * Math.min(1.3, sc));
      pRib(rnd(-10, W + 10), -rnd(10, 90), rnd(-.5, .5), rnd(.8, 2), pick(pal), rnd(5, 11) * sc, n, max + 60);
    });
  }
  for(let j = 0; j < Math.min(14, Math.round(R / 3)); j++){
    fxAt(now + 120 + j * 90, () => {
      const left = j % 2 === 0, a = left ? rnd(-1.25, -.75) : rnd(-2.4, -1.9), v = rnd(13, 21) * sc;
      pRib(left ? 0 : W, H * rnd(.82, .95), Math.cos(a) * v, Math.sin(a) * v, pick(pal), rnd(6, 11) * sc, Math.round(rnd(70, 120)), max + 40, .32, .975);
    });
  }
  fxSound(true);
  vib(30);
}
function celebrateNew(c){
  try { if(c && c.locs && c.locs.includes(HOUSE) && cfgGet("houseOn")) fxHouse(c); else fxCreate(); } catch(e){ console.error(e); }
}
function celebrateMove(c, prev){
  try { if(c && !prev.includes(HOUSE) && locsOf(c).includes(HOUSE)) fxHouse(c); } catch(e){ console.error(e); }
}
addEventListener("pointerdown", () => { if(cfgGet("fxVol") > 0){ try { audioCtx(); } catch(_){} } }, {passive:true});


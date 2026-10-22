/* Inventari de casa · core.js
   Eines generals que fan servir tots els altres fitxers: text, dates, avisos, ajustos (valors i límits),
   l'estat que es comparteix al núvol (meta/state) i els colors del tema.
   Ordre de càrrega dels scripts: core → data → photos → list → item → sync → chat → fx → assistants → dashboard → settings → tools → main */

const APP_VER = "6.5";

/* ---------- DOM i text ---------- */
const $ = id => document.getElementById(id);
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = s => String(s).replace(/[&<>"]/g, m => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;"}[m]));
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const deep = o => o == null ? null : JSON.parse(JSON.stringify(o));
/* JSON amb les claus ordenades: per comparar objectes */
function stable(o){
  if(o === undefined || o === null) return "null";
  if(Array.isArray(o)) return "[" + o.map(stable).join(",") + "]";
  if(typeof o === "object") return "{" + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + stable(o[k])).join(",") + "}";
  return JSON.stringify(o);
}
const isTouch = matchMedia("(pointer:coarse)").matches || /iPhone|iPad|Android/i.test(navigator.userAgent);
const vib = ms => { try { if(navigator.vibrate) navigator.vibrate(ms); } catch(_){} };

/* ---------- dates ---------- */
const fmtDate = ts => new Date(ts).toLocaleDateString("ca", {day:"numeric", month:"long", year:"numeric"});
const fmtSec = ms => String(Math.round(ms / 10) / 100).replace(".", ",") + " s";
const isToday = ts => new Date(ts).toDateString() === new Date().toDateString();
function ago(ts){
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if(s < 50) return "ara mateix";
  if(s < 3600) return "fa " + Math.round(s / 60) + " min";
  if(s < 86400) return "fa " + Math.round(s / 3600) + " h";
  const d = new Date(ts);
  return d.toLocaleDateString("ca", {day:"2-digit", month:"2-digit"}) + " " + d.toLocaleTimeString("ca", {hour:"2-digit", minute:"2-digit"});
}

/* ---------- persones ---------- */
const ALLOWED = ["arnaubalsellsc4@gmail.com", "ainhoaguerreroalejo2@gmail.com"];
const cloudAllowed = e => ALLOWED.includes(String(e || "").toLowerCase());
const WHO = {"arnaubalsellsc4@gmail.com":"Arnau", "ainhoaguerreroalejo2@gmail.com":"Ainhoa"};
const whoName = e => WHO[e] || String(e || "").split("@")[0];

/* ---------- avisos i efectes dels botons ---------- */
let toastT = null;
function toast(msg){
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  try { if(t.showPopover){ if(t.matches(":popover-open")) t.hidePopover(); t.showPopover(); } } catch(e){}
  clearTimeout(toastT);
  toastT = setTimeout(() => { try { if(t.matches && t.matches(":popover-open")) t.hidePopover(); } catch(e){} t.hidden = true; }, cfgGet("toast"));
}
/* efecte moneda: el botó es gira */
function hop(b){ b.classList.remove("hop"); void b.offsetWidth; b.classList.add("hop"); setTimeout(() => b.classList.remove("hop"), 950); }

/* ---------- cerca intel·ligent: ignora accents, apòstrofs, espais, lletres doblades i errors petits ---------- */
const loose = s => norm(s).replace(/[^a-z0-9]+/g, " ").replace(/ph/g, "f").replace(/h/g, "").replace(/v/g, "b").replace(/y/g, "i")
  .replace(/k/g, "c").replace(/z/g, "s").replace(/([a-z])\1+/g, "$1").replace(/\s+/g, " ").trim();
const IDX = new Map();
const idxOf = t => { let x = IDX.get(t); if(!x){ const s = loose(t); x = {s:" " + s + " ", c:s.replace(/ /g, ""), w:s.split(" ").filter(w => w.length > 2)}; IDX.set(t, x); } return x; };
function lev(a, b, max){
  if(Math.abs(a.length - b.length) > max) return max + 1;
  let p = Array.from({length:b.length + 1}, (_, j) => j);
  for(let i = 1; i <= a.length; i++){
    const c = [i]; let lo = i;
    for(let j = 1; j <= b.length; j++){ c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if(c[j] < lo) lo = c[j]; }
    if(lo > max) return max + 1; p = c;
  }
  return p[b.length];
}
let QC = {raw:null};
function compQ(q){ if(QC.raw !== q){ const s = loose(q); QC = {raw:q, t:s.split(" ").filter(Boolean), c:s.replace(/ /g, "")}; } return QC; }
/* el text conté la cerca? (per defecte, la cerca de la barra) */
function qText(text, q){
  q = compQ(q === undefined ? state.q : q); if(!q.c) return true;
  const x = idxOf(text);
  if(q.c.length >= 3 && x.c.includes(q.c)) return true;
  return q.t.every(t => (t.length <= 2 ? x.s.includes(" " + t) : x.s.includes(t)) || (t.length >= 4 && x.c.includes(t))
    || (t.length >= 4 && x.w.some(w => { const m = t.length >= 7 ? 2 : 1; return lev(t, w, m) <= m || lev(t, w.slice(0, t.length), m) <= m; })));
}

/* ---------- ajustos: valor per defecte, límits i nom de cadascun ----------
   Es desen al núvol (meta/state · inv_cfg) només els que són diferents del valor per defecte. */
const CFGD = {fxOn:1, fxN:160, fxT:3500, fxPal:0, fxVol:0, houseOn:1, houseShow:1, houseN:420, houseT:7000, houseR:34, houseBan:1, dialHold:350, dialS:46, dialR:140, dialMax:175, dialTap:1, dialVib:1, dashOn:1, dashDays:14, dashTop:5, dashAnim:1, sortMode:0, lph:76, rad:14, aiwait:450, smartbar:1, vib:0, toast:4500, coin:3000, cardmin:205, chatVol:0, newDays:3, hold:1000, dbl:600, tap:1200, histMax:100, histDays:3, aiMode:2, chatMax:300, bkMax:15, bkAuto:0, cols:3, wvol:60, wgap:2000, wver:1};
const CFGR = {fxOn:[0, 1], fxN:[20, 600], fxT:[1000, 12000], fxPal:[0, 3], fxVol:[0, 100], houseOn:[0, 1], houseShow:[0, 1], houseN:[50, 900], houseT:[2000, 15000], houseR:[0, 80], houseBan:[0, 1], dialHold:[150, 1500], dialS:[34, 64], dialR:[90, 220], dialMax:[110, 260], dialTap:[0, 1], dialVib:[0, 1], dashOn:[0, 1], dashDays:[7, 60], dashTop:[3, 15], dashAnim:[0, 1], sortMode:[0, 2], lph:[40, 120], rad:[4, 28], aiwait:[200, 1000], smartbar:[0, 1], vib:[0, 1], toast:[2000, 15000], coin:[1000, 10000], cardmin:[140, 400], chatVol:[0, 100], newDays:[0, 60], hold:[300, 5000], dbl:[200, 3000], tap:[400, 3000], histMax:[10, 500], histDays:[1, 90], aiMode:[0, 2], chatMax:[50, 1000], bkMax:[1, 50], bkAuto:[0, 60], cols:[2, 6], wvol:[0, 100], wgap:[500, 10000], wver:[1, 999]};
const CFG_LABEL = {hold:"Temps de mantenir premut", dbl:"Temps del doble toc", tap:"Temps del triple toc", histMax:"Canvis que guarda Desfés", histDays:"Dies que es guarden els canvis de Desfés", aiMode:"Assistents: text i veu", chatMax:"Missatges que guarda el xat", bkMax:"Còpies de seguretat que es guarden", bkAuto:"Dies entre còpies automàtiques", cols:"Articles per fila (vista Imatges)", wvol:"Volum de WALL-E", wgap:"Repetició mínima del so de WALL-E", wver:"Versió de l'àudio de WALL-E", toast:"Segons que es veu l'avís", coin:"Segons abans de bloquejar la moneda", cardmin:"Mida de les targetes (PC)", chatVol:"Volum de l'avís del xat", newDays:"Dies que es marca «NEW»", sortMode:"Ordre dels articles", lph:"Foto a la vista llista", rad:"Cantonades arrodonides", aiwait:"Espera del toc simple", smartbar:"Barra de cerca intel·ligent", vib:"Vibració en tocar", fxOn:"Confeti en crear", fxN:"Quantitat de confeti", fxT:"Durada del confeti", fxPal:"Colors del confeti", fxVol:"So de la celebració", houseOn:"Celebració de Nau&Noa House", houseShow:"Mostra sempre Nau&Noa House", houseN:"Confeti de la casa", houseT:"Durada de la celebració de la casa", houseR:"Cintes de la casa", houseBan:"Cartell de la casa", dialHold:"Temps per obrir el dial", dialS:"Mida dels botons del dial", dialR:"Radi del dial", dialMax:"Ampliació màxima del dial", dialTap:"Dial amb un toc simple", dialVib:"Vibració del dial", dashOn:"Botó del dashboard", dashDays:"Dies d'activitat del dashboard", dashTop:"Articles als rànquings", dashAnim:"Animacions del dashboard"};
/* ajustos que són temps (es mostren en segons i es desen en mil·lisegons) */
const cfgSec = k => ["hold", "dbl", "tap", "wgap", "toast", "coin", "aiwait", "fxT", "houseT", "dialHold"].includes(k);
function cfgRaw(){ const c = STATE.inv_cfg; return c && typeof c === "object" && !Array.isArray(c) ? c : {}; }
function cfgGet(k){ const v = cfgRaw()[k]; return typeof v === "number" && isFinite(v) && v >= CFGR[k][0] && v <= CFGR[k][1] ? v : CFGD[k]; }
/* només els ajustos vàlids i diferents del valor per defecte */
function cfgClean(o){
  const r = {};
  Object.keys(CFGD).forEach(k => {
    const v = o && o[k];
    if(typeof v === "number" && isFinite(v) && v >= CFGR[k][0] && v <= CFGR[k][1] && v !== CFGD[k]) r[k] = v;
  });
  return r;
}
/* els ajustos poden tenir subvalors («clau|id»): es tracten com una llista plana */
function cfgFlat(o){
  const r = {};
  if(!o || typeof o !== "object") return r;
  Object.keys(o).forEach(k => {
    const v = o[k];
    if(v && typeof v === "object" && !Array.isArray(v)) Object.keys(v).forEach(s => { r[k + "|" + s] = v[s]; });
    else r[k] = v;
  });
  return r;
}
function cfgSplit(p){ const i = p.indexOf("|"); return i < 0 ? [p, ""] : [p.slice(0, i), p.slice(i + 1)]; }
function cfgSet(o, p, v){
  const [k, id] = cfgSplit(p);
  if(!id){ if(v === undefined) delete o[k]; else o[k] = v; return; }
  if(!o[k] || typeof o[k] !== "object") o[k] = {};
  if(v === undefined) delete o[k][id]; else o[k][id] = v;
  if(!Object.keys(o[k]).length) delete o[k];
}
/* text per a ↶ Desfés: quins ajustos han canviat */
function cfgLabels(b, a){
  const B = cfgFlat(b), A = cfgFlat(a), L = [];
  new Set([...Object.keys(B), ...Object.keys(A)]).forEach(p => {
    if(stable(B[p]) === stable(A[p])) return;
    const [k] = cfgSplit(p);
    if(!(k in CFGD)) return;   /* ajustos antics que ja no existeixen */
    const fv = v => { v = v === undefined ? CFGD[k] : v; return cfgSec(k) ? fmtSec(v) : String(v); };
    L.push("⚙️ " + (CFG_LABEL[k] || k) + ": " + fv(B[p]) + " → " + fv(A[p]));
  });
  return L.join(" · ");
}

/* ---------- estat compartit al núvol (meta/state) i dades d'aquest dispositiu (localStorage) ---------- */
const KEYS_CLOUD = ["inv_tinc", "inv_pend_extra", "inv_pend_tret", "inv_cats", "inv_locs", "inv_cfg", "inv_theme", "inv_locicons"];
const STATE = {};
const pendKeys = new Set();   /* claus canviades aquí que encara no s'han enviat al núvol */
const load = (k, def) => {
  if(KEYS_CLOUD.includes(k)) return k in STATE ? deep(STATE[k]) : def;
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch(e){ return def; }
};
/* les claus del núvol passen per ↶ Desfés i s'envien a Firestore; la resta queden al dispositiu */
const store = (k, v) => {
  if(KEYS_CLOUD.includes(k)){
    const prev = STATE[k] === undefined ? null : deep(STATE[k]);
    STATE[k] = deep(v);
    histAdd({k:"meta", f:k, before:prev, after:deep(v)}); cloudQueueKey(k);
    return true;
  }
  try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){}
  return true;
};

/* ---------- colors del tema ---------- */
const THEME_KEYS = ["accent", "bg", "ink", "newc"];
const THEME_DEF = {accent:"#4fe3d2", bg:"#000000", ink:"#ffffff", newc:"#e5252a"};
const THEME_NAME = {accent:"Color principal", bg:"Color del fons", ink:"Color del text", newc:"Color del cartell NEW"};
const THEME_VARS = ["--bg", "--surface", "--surface2", "--line", "--ink", "--muted", "--accent", "--accent-rgb", "--accent-hi", "--accent-lo", "--accent-ink", "--newc"];
const THEME_PRESETS = {
  turquesa:{name:"Turquesa", accent:"#4fe3d2", bg:"#000000"},
  blau:{name:"Blau", accent:"#5ea0ff", bg:"#050b1a"},
  verd:{name:"Verd", accent:"#4ade80", bg:"#031208"},
  rosa:{name:"Rosa", accent:"#ff6fb5", bg:"#14040d"},
  taronja:{name:"Taronja", accent:"#ffa040", bg:"#140a02"},
  lila:{name:"Lila", accent:"#b388ff", bg:"#0b0516"},
  groc:{name:"Groc", accent:"#ffd23f", bg:"#120f00"},
  gris:{name:"Gris", accent:"#d4d4d8", bg:"#0a0a0a"},
  vermell:{name:"Vermell", accent:"#ff6b6b", bg:"#140303"}
};
const hexOk = h => /^#[0-9a-f]{6}$/i.test(String(h || ""));
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbHex = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lumOf = a => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(a[0]) + .7152 * f(a[1]) + .0722 * f(a[2]); };
const contrastOf = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function themeRaw(){ const t = STATE.inv_theme; return t && typeof t === "object" && !Array.isArray(t) ? t : {}; }
function themeVals(r){ r = r || themeRaw(); const o = {}; THEME_KEYS.forEach(k => { o[k] = hexOk(r[k]) ? String(r[k]).toLowerCase() : THEME_DEF[k]; }); return o; }
function themeClean(o){ const r = {}; THEME_KEYS.forEach(k => { if(o && hexOk(o[k]) && String(o[k]).toLowerCase() !== THEME_DEF[k]) r[k] = String(o[k]).toLowerCase(); }); return r; }
/* "" si els colors són vàlids; si no, el motiu */
function themeCheck(T){
  const bg = hexRgb(T.bg), ink = hexRgb(T.ink), ac = hexRgb(T.accent), nc = hexRgb(T.newc);
  if(lumOf(bg) > .2) return "El fons ha de ser fosc.";
  if(contrastOf(ink, bg) < 4.5) return "El color del text té massa poc contrast amb el fons.";
  if(contrastOf(ac, bg) < 2.5) return "El color principal té massa poc contrast amb el fons.";
  if(lumOf(nc) > .6) return "El color del cartell NEW és massa clar (el text és blanc).";
  return "";
}
function themeLabels(b, a){
  const B = themeVals(b || {}), A = themeVals(a || {}), L = [];
  THEME_KEYS.forEach(k => { if(B[k] !== A[k]) L.push("🎨 " + THEME_NAME[k] + ": " + B[k] + " → " + A[k]); });
  return L.join(" · ");
}
function themeApply(){
  const root = document.documentElement.style, r = themeRaw(), meta = document.querySelector('meta[name="theme-color"]');
  const custom = THEME_KEYS.some(k => hexOk(r[k]) && String(r[k]).toLowerCase() !== THEME_DEF[k]);
  const T = themeVals(r);
  try { localStorage.setItem("inv_theme_cache", JSON.stringify(custom ? T : null)); } catch(e){}
  if(!custom){ THEME_VARS.forEach(n => root.removeProperty(n)); if(meta) meta.setAttribute("content", "#000000"); return; }
  const bg = hexRgb(T.bg), ink = hexRgb(T.ink), ac = hexRgb(T.accent), W = [255, 255, 255], K = [0, 0, 0];
  const set = (n, v) => root.setProperty(n, v);
  set("--bg", T.bg); set("--surface", rgbHex(mixRgb(bg, W, .05))); set("--surface2", rgbHex(mixRgb(bg, W, .10)));
  set("--line", rgbHex(mixRgb(bg, W, .23))); set("--ink", T.ink); set("--muted", rgbHex(mixRgb(ink, bg, .24)));
  set("--accent", T.accent); set("--accent-rgb", ac.join(",")); set("--accent-hi", rgbHex(mixRgb(ac, W, .38))); set("--accent-lo", rgbHex(mixRgb(ac, K, .2)));
  set("--accent-ink", lumOf(ac) > .3 ? rgbHex(mixRgb(ac, K, .92)) : "#ffffff");
  set("--newc", T.newc);
  if(meta) meta.setAttribute("content", T.bg);
}
/* els colors s'apliquen de seguida (abans que arribin del núvol) amb els de l'última vegada */
try { const tc = JSON.parse(localStorage.getItem("inv_theme_cache") || "null"); if(tc && typeof tc === "object") STATE.inv_theme = tc; } catch(e){}
themeApply();

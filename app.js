/* Inventari de casa v6.0 · les dades viuen a Firestore (cloud.js); aquí hi ha tota la interfície */
const DATA = [];
const CATS = [
  {id:"cuina",label:"Cuina",short:"Cuina",icon:"🍳"},
  {id:"menjador",label:"Menjador",short:"Menjador",icon:"🍽️"},
  {id:"bany",label:"Bany",short:"Bany",icon:"🚽"},
  {id:"dormitori",label:"Dormitori",short:"Dormitori",icon:"🛏️"},
  {id:"office",label:"Office",short:"Office",icon:"💻"},
  {id:"eines",label:"Eines",short:"Eines",icon:"🧰"},
  {id:"electro",label:"Electrodomèstics",short:"Electro",icon:"🔌"},
  {id:"neteja",label:"Neteja",short:"Neteja",icon:"🧽"}
];
const PENDENTS = {"cuina": ["Paella gran", "Paella petita", "Olla gran", "Cassola", "Cassó per a llet o salses", "Colador / escorredor de pasta", "Ratllador", "Obrellaunes", "Llevataps", "Cullerot", "Varetes de batre", "Bàscula de cuina", "Gerra mesuradora", "Motlle per al forn", "Manyoples de forn", "Carmanyoles (tuppers)", "Escorreplats", "Plats plans i fondos (6 o més)", "Coberts de taula (6 o més)", "Gerra d'aigua", "Cubells de reciclatge"], "menjador": ["Taula de menjador", "Cadires", "Sofà", "Moble de TV", "Llum de peu o de sostre", "Catifa", "Cortines", "Coixins de sofà", "Manta de sofà", "Prestatgeria", "Rellotge de paret", "Quadres o decoració de paret"], "bany": ["Tovalloles de dutxa", "Tovalloles de mans", "Cortina o mampara de dutxa", "Penjador de tovalloles", "Portaraspalls de dents", "Mirall de bany", "Portarotlles de paper", "Bàscula de bany", "Termòmetre", "Gases i esparadrap", "Tisores d'ungles", "Organitzador de dutxa"], "dormitori": ["Llit i matalàs", "Protector de matalàs", "Coixins", "Jocs de llençols (2)", "Funda nòrdica i edredó", "Manta", "Tauletes de nit", "Llum de tauleta", "Cortines opaques", "Despertador", "Cistell de roba bruta", "Organitzadors d'armari"], "office": ["Taula d'escriptori", "Cadira d'oficina", "Llum d'escriptori", "Regleta amb interruptor", "Impressora", "Disc dur extern o USB", "Auriculars amb micròfon", "Webcam", "Cables HDMI / DisplayPort", "Paper DIN A4", "Grapadora", "Tisores", "Cinta adhesiva", "Notes adhesives", "Arxivadors i carpetes"], "eines": ["Martell", "Joc de tornavisos", "Alicates", "Clau anglesa", "Cinta mètrica", "Escala", "Tacs i cargols", "Brides", "Cinta americana", "Silicona i pistola", "Allargador elèctric", "Piles AA i AAA", "Bombetes de recanvi", "Detector de fum", "Extintor"], "electro": ["Nevera", "Rentadora", "Rentaplats", "Forn", "Microones", "Placa de cocció", "Campana extractora", "Torradora", "Bullidor d'aigua", "Planxa de roba", "Televisor", "Fregidora d'aire"], "neteja": ["Escombra i recollidor", "Pal de fregar i galleda", "Plomall per a la pols", "Guants de neteja", "Fregalls", "Estenedor de roba", "Pinces de roba", "Taula de planxar", "Desembussador", "Bosses d'escombraries", "Detergent de rentadora", "Rentavaixelles", "Lleixiu", "Netejador multiusos", "Netejavidres"]};
const ESTAT = {ok:"Verificat", conf:"Quantitat per confirmar", sin:"Sense foto"};
const FIAB = {alta:"Alta", mitjana:"Mitjana", baixa:"Baixa"};
const HOUSE = "Nau&Noa House";
const LOC_PRIORITY = ["Cunit","Garatge iaios"];
let LOCS = [];
function refreshLocs(){
  const set = new Set(DATA.filter(live).flatMap(c=>c.locs).concat(window.__userLocs||[]));
  if(cfgGet("houseShow")) set.add(HOUSE);
  LOCS = [...set].sort((a,b)=>{
    if(a===HOUSE) return b===HOUSE ? 0 : 1;
    if(b===HOUSE) return -1;
    const ia=LOC_PRIORITY.indexOf(a), ib=LOC_PRIORITY.indexOf(b);
    return (ia<0?99:ia)-(ib<0?99:ib) || a.localeCompare(b);
  });
}
const state = {q:"", cat:"all", loc:"all", review:false};
let order = [];
const $ = id => document.getElementById(id);
const norm = s => (s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const esc = s => String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
const needsReview = c => c.estado!=="ok" || c.pend>0 || c.fiab!=="alta";
const zoneOf = c => (CATS.find(z=>z.id===c.cat)||{label:""}).label;
const qtyBadge = q => typeof q==="number" ? "×"+q : String(q);
/* ---- v2.8: diverses ubicacions (compta a totes) i diverses zones (compta només a la primera) ---- */
const locsOf = c => (Array.isArray(c.locs) && c.locs.length ? c.locs : [c.loc]);
const catsOf = c => (Array.isArray(c.cats) && c.cats.length ? c.cats : [c.cat]);
const zonesOf = c => catsOf(c).map(id => (CATS.find(z=>z.id===id)||{}).label).filter(Boolean);
const zonesTxt = c => zonesOf(c).join(" · ");
const locsTxt = (c, sep) => locsOf(c).join(sep || " · ");
function fixItem(c){
  if(!c || typeof c !== "object") return c;
  c.item = String(c.item == null ? "" : c.item).trim() || "Sense nom";
  c.desc = c.desc == null ? "" : String(c.desc);
  c.note = c.note == null ? "" : String(c.note);
  c.photos = (Array.isArray(c.photos) ? c.photos : []).filter(p => typeof p === "string" && p);
  const uniq = a => [...new Set(a.map(x => String(x == null ? "" : x).trim()).filter(Boolean))];
  let L = uniq([c.loc].concat(Array.isArray(c.locs) ? c.locs : []));
  if(!L.length) L = ["Sense ubicació"];
  c.locs = L; c.loc = L[0];
  let Z = uniq([c.cat].concat(Array.isArray(c.cats) ? c.cats : []));
  if(!Z.length) Z = [CATS[0].id];
  c.cat = Z[0]; if(Z.length > 1) c.cats = Z; else delete c.cats;
  if(typeof c.qty === "string" && /^\s*\d+\s*$/.test(c.qty)) c.qty = parseInt(c.qty, 10);
  if(typeof c.qty === "number" && !(c.qty > 0)) c.qty = 1;
  if(c.qty == null || c.qty === "") c.qty = 1;
  if(!ESTAT[c.estado]) c.estado = c.photos.length ? "ok" : "sin";
  if(!FIAB[c.fiab]) c.fiab = "alta";
  c.pend = +c.pend || 0;
  return c;
}
DATA.forEach(fixItem);
const searchText = c => norm(c.item+" "+c.desc+" "+c.note+" "+locsOf(c).join(" ")+" "+zonesOf(c).join(" "));
const SEARCH = DATA.map(searchText);
const live = c => !c.deleted;

/* ---- v6.0: fotos optimitzades ----
   Cada article guarda la miniatura de les seves fotos (camp tm = {idFoto: miniatura}, ~10 KB cadascuna).
   La llista només fa servir miniatures; la foto completa (col·lecció photos) es baixa quan obres la fitxa o el visor.
   A c.photos hi ha, per a cada foto, la millor URL que es té: completa > miniatura > marcador «carregant». */
const PHR = new Map();        /* URL (completa, miniatura o marcador) -> id de la foto */
const PHF = new Map();        /* id -> foto completa ja baixada */
const PHT = new Map();        /* id -> miniatura (data URL, la que es desa) */
const PHB = new Map();        /* id -> miniatura en blob: URL curta per pintar les targetes */
const THUMB_OF = new Map();   /* foto completa nova -> la seva miniatura (es fa en reduir-la) */
const PHF_MAX = 60;           /* fotos completes que es guarden a la memòria */
const THUMB_PX = 320, THUMB_Q = .62;
function phHold(id){
  const u = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><!--' + id + '--><rect width="4" height="3" fill="#181818"/></svg>');
  PHR.set(u, id); return u;
}
function blobOf(dataUrl){
  try {
    const i = dataUrl.indexOf(","), mime = dataUrl.slice(5, dataUrl.indexOf(";")), bin = atob(dataUrl.slice(i + 1)), a = new Uint8Array(bin.length);
    for(let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
    return URL.createObjectURL(new Blob([a], {type:mime}));
  } catch(e){ return dataUrl; }
}
function phSetThumb(id, t){
  if(!t || PHT.get(id) === t) return;
  const old = PHT.get(id); if(old) PHR.delete(old);
  const ob = PHB.get(id); if(ob && ob.startsWith("blob:")) URL.revokeObjectURL(ob);
  PHT.set(id, t); PHR.set(t, id); PHB.delete(id);
}
const phUrl = id => PHF.get(id) || PHT.get(id) || phHold(id);
/* URL petita per a targetes, llistes i icones */
function thumbSrc(c, k){
  k = k || 0;
  const id = c._ph && c._ph[k];
  if(id && PHT.has(id)){ if(!PHB.has(id)) PHB.set(id, blobOf(PHT.get(id))); return PHB.get(id); }
  return THUMB_OF.get(c.photos[k]) || c.photos[k];
}
function phSetFull(id, d){
  PHF.delete(id); PHF.set(id, d); PHR.set(d, id);
  DATA.forEach(c => { const k = (c._ph || []).indexOf(id); if(k >= 0) c.photos[k] = d; });
  if(PHF.size > PHF_MAX){
    const keep = new Set(cur != null && DATA[cur] ? DATA[cur]._ph || [] : []);
    for(const old of PHF.keys()){
      if(PHF.size <= PHF_MAX) break;
      if(keep.has(old) || old === id) continue;
      PHR.delete(PHF.get(old)); PHF.delete(old);
      DATA.forEach(c => { const k = (c._ph || []).indexOf(old); if(k >= 0) c.photos[k] = phUrl(old); });
    }
  }
}
const PH_WAIT = new Map();
function fullPhoto(id){
  if(PHF.has(id)) return Promise.resolve(PHF.get(id));
  if(!window.cloud || !cloud.getPhoto) return Promise.resolve(null);
  if(!PH_WAIT.has(id)) PH_WAIT.set(id, cloud.getPhoto(id).then(d => { PH_WAIT.delete(id); if(d) phSetFull(id, d); return d || null; }, () => { PH_WAIT.delete(id); return null; }));
  return PH_WAIT.get(id);
}
/* baixa les fotos completes d'un article; diu si n'ha arribat alguna de nova */
async function ensureFull(c){
  const ids = (c && c._ph || []).filter(id => !PHF.has(id));
  if(!ids.length) return false;
  const r = await Promise.all(ids.map(fullPhoto));
  return r.some(Boolean);
}
function makeThumb(src){
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      try {
        const k = Math.min(1, THUMB_PX / Math.max(im.naturalWidth, im.naturalHeight));
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
        const x = cv.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingQuality = "high";
        x.drawImage(im, 0, 0, cv.width, cv.height);
        res(cv.toDataURL("image/jpeg", THUMB_Q));
      } catch(e){ res(""); }
    };
    im.onerror = () => res(""); im.src = src;
  });
}

/* ---- Cerca intel·ligent (v2.6): ignora accents, apòstrofs, espais, lletres doblades i errors petits ---- */
const loose = s => norm(s).replace(/[^a-z0-9]+/g," ").replace(/ph/g,"f").replace(/h/g,"").replace(/v/g,"b").replace(/y/g,"i")
  .replace(/k/g,"c").replace(/z/g,"s").replace(/([a-z])\1+/g,"$1").replace(/\s+/g," ").trim();
const IDX = new Map();
const idxOf = t => { let x = IDX.get(t); if(!x){ const s = loose(t); x = {s:" "+s+" ", c:s.replace(/ /g,""), w:s.split(" ").filter(w=>w.length>2)}; IDX.set(t, x); } return x; };
function lev(a, b, max){
  if(Math.abs(a.length-b.length) > max) return max+1;
  let p = Array.from({length:b.length+1}, (_,j)=>j);
  for(let i=1;i<=a.length;i++){
    const c = [i]; let lo = i;
    for(let j=1;j<=b.length;j++){ c[j] = Math.min(p[j]+1, c[j-1]+1, p[j-1]+(a[i-1]===b[j-1]?0:1)); if(c[j]<lo) lo = c[j]; }
    if(lo > max) return max+1; p = c;
  }
  return p[b.length];
}
let QC = {raw:null};
function compQ(q){ if(QC.raw!==q){ const s = loose(q); QC = {raw:q, t:s.split(" ").filter(Boolean), c:s.replace(/ /g,"")}; } return QC; }
function qText(text, q){
  q = compQ(q === undefined ? state.q : q); if(!q.c) return true;
  const x = idxOf(text);
  if(q.c.length >= 3 && x.c.includes(q.c)) return true;
  return q.t.every(t => (t.length <= 2 ? x.s.includes(" "+t) : x.s.includes(t)) || (t.length >= 4 && x.c.includes(t))
    || (t.length >= 4 && x.w.some(w => { const m = t.length >= 7 ? 2 : 1; return lev(t, w, m) <= m || lev(t, w.slice(0, t.length), m) <= m; })));
}
const qHit = i => qText(SEARCH[i]);



/* Filtres: cada grup compta amb els altres filtres aplicats */
const matches = (c,i,skip) => live(c)
  && (skip==="cat" || state.cat==="all" || catsOf(c).includes(state.cat))
  && (skip==="loc" || state.loc==="all" || c.locs.includes(state.loc))
  && (skip==="review" || !state.review || needsReview(c))
  && (!state.q || qHit(i));
const count = (skip, extra) => DATA.filter((c,i)=>matches(c,i,skip) && extra(c)).length;

/* v3.7: el % és la part dels articles totals que hi ha en cada ubicació o zona */
const totAll = () => DATA.filter(live).length;
const pctOf = (n, tot) => (!tot || !n) ? 0 : Math.max(1, Math.min(100, Math.round(n / tot * 100)));
/* v3.3: valors per defecte (els de la v3.2) i límits dels ajustos */
const CFGD = {fxOn:1, fxN:160, fxT:3500, fxPal:0, fxVol:0, houseOn:1, houseShow:1, houseN:420, houseT:7000, houseR:34, houseBan:1, dialHold:350, dialS:46, dialR:140, dialMax:175, dialTap:1, dialVib:1, dashOn:1, dashDays:14, dashTop:5, dashAnim:1, sortMode:0, lph:76, rad:14, aiwait:450, smartbar:1, vib:0, toast:4500, coin:3000, cardmin:205, chatVol:0, newDays:3, hold:1000, dbl:600, tap:1200, histMax:100, chatMax:300, bkMax:15, bkAuto:0, cols:3, wvol:60, wgap:2000, wver:1};
const CFGR = {fxOn:[0, 1], fxN:[20, 600], fxT:[1000, 12000], fxPal:[0, 3], fxVol:[0, 100], houseOn:[0, 1], houseShow:[0, 1], houseN:[50, 900], houseT:[2000, 15000], houseR:[0, 80], houseBan:[0, 1], dialHold:[150, 1500], dialS:[34, 64], dialR:[90, 220], dialMax:[110, 260], dialTap:[0, 1], dialVib:[0, 1], dashOn:[0, 1], dashDays:[7, 60], dashTop:[3, 15], dashAnim:[0, 1], sortMode:[0, 2], lph:[40, 120], rad:[4, 28], aiwait:[200, 1000], smartbar:[0, 1], vib:[0, 1], toast:[2000, 15000], coin:[1000, 10000], cardmin:[140, 400], chatVol:[0, 100], newDays:[0, 60], hold:[300, 5000], dbl:[200, 3000], tap:[400, 3000], histMax:[10, 500], chatMax:[50, 1000], bkMax:[1, 50], bkAuto:[0, 60], cols:[2, 6], wvol:[0, 100], wgap:[500, 10000], wver:[1, 999]};
function cfgRaw(){ const c = typeof STATE !== "undefined" ? STATE.inv_cfg : null; return c && typeof c === "object" && !Array.isArray(c) ? c : {}; }
function cfgGet(k){ const v = cfgRaw()[k]; return typeof v === "number" && isFinite(v) && v >= CFGR[k][0] && v <= CFGR[k][1] ? v : CFGD[k]; }
const totLoc = l => DATA.filter(c => live(c) && c.locs.includes(l)).length;
const totCat = id => DATA.filter(c => live(c) && catsOf(c).includes(id)).length;
/* v4.0: un article és NEW els primers dies (ord = moment de creació) fins que el treguis amb «Treu el NEW» */
const NEWCAT = {id:"__new", label:"Nous", short:"Nous", icon:"🆕"};
const isNew = c => { const d = cfgGet("newDays"); return d > 0 && !c.nouVist && typeof c.ord === "number" && c.ord > 1e12 && c.ord > Date.now() - d * 864e5; };
function renderChips(){ renderFilters(); }
function card(c,i){
  let ph;
  const qty = '<span class="qty">'+esc(qtyBadge(c.qty))+'</span>';
  const nw = isNew(c), NT = nw ? '<span class="newtag">NEW</span>' : '';
  if(c.photos.length){
    ph = '<div class="ph'+(nw?' isnew':'')+'"><img loading="lazy" decoding="async" alt="'+esc(c.item)+'" src="'+thumbSrc(c)+'">'+qty+NT+(c.photos.length>1?'<span class="more">'+c.photos.length+' fotos</span>':'')+'</div>';
  } else {
    ph = '<div class="ph empty'+(nw?' isnew':'')+'">'+qty+NT+'<span>'+(c.pend>0?'Foto pendent de tornar a enviar':'Encara sense foto')+'</span></div>';
  }
  let tags = locsOf(c).map(l => '<span class="tag loc-tag">📍 '+esc(l)+'</span>').join("");
  if(c.estado==="conf") tags += '<span class="tag conf">Quantitat per confirmar</span>';
  if(c.estado==="sin") tags += '<span class="tag sin">Sense foto</span>';
  if(c.pend>0) tags += '<span class="tag pend">Foto pendent</span>';
  return '<li class="card" data-i="'+i+'"><button class="card-btn" type="button" data-i="'+i+'" aria-label="Detalls de '+esc(c.item)+'">'+ph+'<div class="body"><h3>'+esc(c.item)+'</h3><p class="lmeta desc">Quantitat: <b>'+esc(c.qty)+'</b> · Fiabilitat: <b>'+esc(FIAB[c.fiab]||c.fiab)+'</b></p>'+(c.desc?'<p class="desc">'+esc(c.desc)+'</p>':'')+(c.note?'<p class="lnote">'+esc(c.note)+'</p>':'')+'<div class="tags">'+tags+'</div></div></button></li>';
}

/* Les targetes es construeixen una sola vegada; filtrar només amaga/mostra */
/* ---- v4.0: colors bàsics (tema) ---- */
const THEME_KEYS = ["accent", "bg", "ink", "newc"];
const THEME_DEF = {accent:"#4fe3d2", bg:"#000000", ink:"#ffffff", newc:"#e5252a"};
const THEME_NAME = {accent:"Color principal", bg:"Color del fons", ink:"Color del text", newc:"Color del cartell NEW"};
const THEME_VARS = ["--bg", "--surface", "--surface2", "--line", "--ink", "--muted", "--accent", "--accent-rgb", "--accent-hi", "--accent-lo", "--accent-ink", "--newc"];
const hexOk = h => /^#[0-9a-f]{6}$/i.test(String(h || ""));
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbHex = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lumOf = a => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(a[0]) + .7152 * f(a[1]) + .0722 * f(a[2]); };
const contrastOf = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function themeRaw(){ const t = STATE.inv_theme; return t && typeof t === "object" && !Array.isArray(t) ? t : {}; }
function themeVals(r){ r = r || themeRaw(); const o = {}; THEME_KEYS.forEach(k => { o[k] = hexOk(r[k]) ? String(r[k]).toLowerCase() : THEME_DEF[k]; }); return o; }
function themeClean(o){ const r = {}; THEME_KEYS.forEach(k => { if(o && hexOk(o[k]) && String(o[k]).toLowerCase() !== THEME_DEF[k]) r[k] = String(o[k]).toLowerCase(); }); return r; }
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

/* v3.0: les dades compartides es desen a Firestore (meta/state); la resta, al dispositiu (localStorage)
   v6.0: inv_compra = llista de la compra compartida */
const KEYS_CLOUD = ["inv_tinc","inv_pend_extra","inv_pend_tret","inv_cats","inv_locs","inv_cfg","inv_theme","inv_locicons","inv_compra"];
const STATE = {};
try { const tc = JSON.parse(localStorage.getItem("inv_theme_cache") || "null"); if(tc && typeof tc === "object") STATE.inv_theme = tc; } catch(e){}
themeApply();
const load = (k,def) => {
  if(KEYS_CLOUD.includes(k)) return k in STATE ? JSON.parse(JSON.stringify(STATE[k])) : def;
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch(e){ return def; }
};
const pendKeys = new Set();
const store = (k,v) => {
  if(KEYS_CLOUD.includes(k)){
    const prev = STATE[k] === undefined ? null : JSON.parse(JSON.stringify(STATE[k]));
    STATE[k] = JSON.parse(JSON.stringify(v));
    histAdd({k:"meta", f:k, before:prev, after:JSON.parse(JSON.stringify(v))}); cloudQueueKey(k);
    return true;
  }
  try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){}
  return true;
};
const have = load("inv_tinc", {});
const extra = load("inv_pend_extra", {});
const tret = load("inv_pend_tret", {});
const userCats = load("inv_cats", []);
const userLocs = load("inv_locs", []); window.__userLocs = userLocs;
CATS.push(...userCats);
/* v3.9: la targeta d'un article existeix a cada zona on és; a «Totes» només es mostra a la zona principal */
function dropCards(i){
  sections.forEach(s => { s.cards = s.cards.filter(li => { if(+li.dataset.i === i){ li.remove(); return false; } return true; }); });
}
function placeCards(i){
  const c = DATA[i], tmp = document.createElement("ul");
  catsOf(c).forEach(zid => {
    const sec = sections.find(s => s.cat.id === zid); if(!sec) return;
    tmp.innerHTML = card(c, i);
    const li = tmp.firstElementChild, next = sec.cards.find(x => +x.dataset.i > i);
    sec.grid.insertBefore(li, next || null);
    sec.cards.splice(next ? sec.cards.indexOf(next) : sec.cards.length, 0, li);
  });
}
function saveItem(i, patch){
  const prevLocs50 = locsOf(DATA[i]).slice();
  Object.assign(DATA[i], patch); if("cats" in patch && !patch.cats) delete DATA[i].cats; fixItem(DATA[i]); SEARCH[i] = searchText(DATA[i]);
  const ok = cloudSaveItem(DATA[i]);
  if(!ok) toast("No s'ha pogut desar la foto.");
  refreshLocs();
  /* torna a pintar la targeta, a la seva categoria */
  dropCards(i); placeCards(i);
  updateSub(); render();
  celebrateMove(DATA[i], prevLocs50);
}
const CORRECTE = {estado:"ok", fiab:"alta", pend:0};
function reasons(c){
  const r = [];
  if(c.estado==="conf") r.push("La quantitat està per confirmar");
  if(!c.photos.length) r.push(c.pend>0 ? "Falta tornar a enviar la foto" : "No té foto");
  else if(c.pend>0) r.push("Falta tornar a enviar alguna foto");
  if(c.fiab!=="alta") r.push("Fiabilitat " + (FIAB[c.fiab]||c.fiab).toLowerCase() + " de la informació");
  return r;
}
refreshLocs();
let view = load("inv_vista", "grid");
function setView(v){
  view = v; store("inv_vista", v);
  document.body.classList.toggle("list", v==="list");
  document.body.classList.toggle("check", v==="check");
  document.querySelectorAll(".views button, .vbar button").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.v===v)));
  if(typeof render==="function" && sections.length) render();
}
const VIEWS = '<span class="views" role="group" aria-label="Vista"><button type="button" data-v="grid">▦ Imatges</button><button type="button" data-v="list">☰ Llista</button><button type="button" data-v="check">☑ Check</button></span>';
document.addEventListener("click", e => { const b = e.target.closest(".views button, .vbar button"); if(b) setView(b.dataset.v); });
function updateSub(){
  const L = DATA.filter(live);
  $("sub").innerHTML = L.length + " articles · " + L.filter(c => c.photos.length).length + ' amb foto<span class="subhint">. Toca un article per veure\'n els detalls.</span>';
}
/* ---- v4.0: més pendents a cada zona (s'afegeixen al final: les marques que ja tinguis no es mouen) ---- */
const PEND_MORE = {
  cuina:["Safata de forn", "Joc de ganivets de cuina", "Taula de tallar", "Obridor de llaunes", "Pelador de verdures", "Espremedor de cítrics", "Premsa d'alls", "Setrilleres d'oli i vinagre", "Bols per a amanides", "Gots (6 o més)", "Tasses (6 o més)", "Draps de cuina", "Cullera de fusta i pala", "Paper d'alumini i film transparent", "Cafetera", "Mortaret", "Salers i pebrers", "Colador fi"],
  menjador:["Tovalles", "Estovalles individuals", "Setrilles de taula", "Gerro amb flors", "Espelmes i portaespelmes", "Aparador o bufet", "Moble de rebedor", "Tamboret o puf", "Plaid", "Reposapeus", "Llum ambiental", "Mirall decoratiu", "Ventilador de sostre", "Safata decorativa"],
  bany:["Alfombreta de bany", "Paperera de bany", "Raspall de vàter", "Dispensador de sabó", "Prestatge de bany", "Assecador de cabells", "Maquineta d'afaitar", "Pinta o raspall de cabell", "Farmaciola", "Ambientador", "Cistell de roba bruta", "Got per als raspalls de dents", "Cotó i bastonets", "Crema hidratant"],
  dormitori:["Armari", "Calaixera", "Mirall de peu", "Penjadors", "Capçal de llit", "Llum de lectura", "Llençols de recanvi", "Edredó d'estiu", "Coixí cervical", "Catifa de llit", "Estors o persianes", "Ventilador", "Humidificador", "Calçador"],
  office:["Teclat", "Ratolí", "Monitor", "Alfombreta de ratolí", "Suport per al portàtil", "Hub USB", "Carregador de mòbil", "Cables USB-C", "Rotuladors i bolígrafs", "Calculadora", "Paperera d'oficina", "Altaveus", "Repetidor Wi-Fi", "Targeta SD o pendrive", "Ventilador USB", "Organitzador de cables", "Calendari o agenda"],
  eines:["Serra", "Tenalles", "Llimes", "Cúter", "Nivell", "Trepant amb broques", "Assortiment de cargols i volanderes", "Cola d'encolar", "Cinta d'embalar", "Guants de treball", "Ulleres de protecció", "Escala plegable", "Caixa d'eines", "Cinta de teflon", "Llanterna", "Corda", "Inflador", "Soldador d'estany"],
  electro:["Cafetera", "Batedora o minipimer", "Aspiradora", "Aspiradora de mà", "Ventilador", "Estufa o radiador", "Aire condicionat", "Assecador de cabells", "Olla a pressió", "Robot de cuina", "Termo elèctric", "Rentadora-assecadora", "Humidificador", "Depuradora d'aire", "Torradora de pa", "Escalfador d'aigua"],
  neteja:["Fregalls de cuina", "Draps de microfibra", "Raspall de fregar", "Mopa", "Bossa d'aspiradora (recanvi)", "Esponges", "Netejador de forns", "Desinfectant", "Suavitzant", "Pastilles de rentaplats", "Sabó de mans (recanvi)", "Guants de goma", "Cubell amb escorredor", "Ambientadors", "Esprai antical", "Paper de cuina"]
};
Object.keys(PEND_MORE).forEach(k => { PENDENTS[k] = (PENDENTS[k] || []).concat(PEND_MORE[k]); });
/* zones creades per tu: pendents segons el nom; si el nom no és conegut, una llista general */
const PEND_LABEL = {
  jocs:["Jocs de taula", "Baralla de cartes", "Daus", "Puzles", "Consola", "Comandaments extra", "Jocs de consola", "Pilota", "Escacs o dames", "Dòmino", "Cartes UNO", "Cartes de pòquer", "Joc de dards", "Cables i carregadors de la consola"],
  altres:["Caixes d'emmagatzematge", "Etiquetes i retolador", "Bosses de plàstic", "Corda i brides", "Farmaciola", "Mantes de recanvi", "Piles de recanvi", "Llanterna d'emergència", "Documents i garanties", "Claus de recanvi", "Maleta de viatge", "Paraigua", "Detector de monòxid", "Extintor"],
  terrassa:["Taula exterior", "Cadires exteriors", "Para-sol", "Coixins d'exterior", "Barbacoa", "Estenedor exterior", "Llums solars", "Testos i plantes", "Mànega", "Regadora", "Tauleta auxiliar", "Hamaca o gandula", "Cubell d'escombraries exterior", "Tendal"],
  garatge:["Prestatgeries metàl·liques", "Caixes de plàstic", "Bicicleta", "Inflador", "Eines de jardí", "Estris de neteja del cotxe", "Bidons", "Escala", "Penjadors de paret", "Aspiradora de taller", "Oli i líquids del cotxe", "Cables de pont"],
  jardi:["Tisores de podar", "Regadora", "Mànega", "Pala i rasclet", "Guants de jardiner", "Testos", "Terra i abonament", "Carretó", "Desbrossadora", "Aspersors", "Cubell de compost", "Estris de jardineria"],
  habitacio:["Llit i matalàs", "Armari", "Taula de nit", "Llum", "Cortines", "Catifa", "Escriptori", "Cadira", "Penjadors", "Mirall"]
};
const PEND_GENERIC = ["Prestatgeria", "Caixes d'emmagatzematge", "Llum", "Regleta d'endolls", "Cistells", "Penjadors", "Cubell d'escombraries", "Etiquetes i retolador", "Caixa de primers auxilis", "Mirall"];
function pendBase(catId){
  if(PENDENTS[catId]) return PENDENTS[catId];
  const z = CATS.find(c => c.id === catId), k = z ? norm(z.label).trim() : "";
  if(PEND_LABEL[k]) return PEND_LABEL[k];
  const hit = Object.keys(PEND_LABEL).find(x => k.startsWith(x));
  return hit ? PEND_LABEL[hit] : PEND_GENERIC;
}

const sections = [];
const pendRows = catId => (pendBase(catId)).map((p,k)=>({key:catId+":"+k, name:p})).filter(r=>!tret[r.key])
  .concat((extra[catId]||[]).map(x=>({key:catId+":x"+x.id, name:x.name, own:x.id})));
const pdel = (catId, r) => '<button type="button" class="pdel" data-cat="'+catId+'" data-k="'+r.key+'"'+(r.own?' data-own="'+r.own+'"':'')+' aria-label="Elimina '+esc(r.name)+' dels pendents">✕</button>';
/* Creu vermella: elimina el pendent (els propis s'esborren; els suggerits s'amaguen i es poden restaurar) */
document.addEventListener("click", e => {
  const b = e.target.closest(".pdel, .prest"); if(!b) return;
  const cat = b.dataset.cat;
  if(b.classList.contains("prest")){
    Object.keys(tret).filter(k=>k.startsWith(cat+":")).forEach(k=>delete tret[k]);
  } else if(b.dataset.own){
    extra[cat] = (extra[cat]||[]).filter(x=>String(x.id)!==b.dataset.own);
  } else {
    tret[b.dataset.k] = true;
  }
  if(!b.classList.contains("prest")) delete have[b.dataset.k];
  store("inv_pend_extra", extra); store("inv_pend_tret", tret); store("inv_tinc", have); refreshPend(cat);
});
function refreshPend(catId){
  renderPend(sections.find(s=>s.cat.id===catId));
  if(view==="check") renderCheck();
}
function pendArt(key){ return DATA.findIndex(c => live(c) && c.pkey === key); }
function renderPend(sec){
  const cat = sec.cat, list = sec.el.querySelector(".pend-list");
  const rows = pendRows(cat.id);
  const todo = rows.filter(r => !have[r.key]), done = rows.filter(r => have[r.key]);
  let h = todo.map(r => '<li><label><input type="checkbox" data-k="'+r.key+'"><span>'+esc(r.name)+'</span></label>'+buyBtnHtml(cat.id, r)+pdel(cat.id, r)+'</li>').join("");
  if(!todo.length) h += '<li class="pall">🎉 No queda res pendent a '+esc(cat.label)+'.</li>';
  else if(todo.some(r => !buyHas(r.key))) h = '<li class="pbuyrow"><button type="button" class="sbtn pbuyall" data-cat="'+cat.id+'">🛒 Posa\'ls tots a la compra</button></li>' + h;
  if(done.length){
    h += '<li class="pdonewrap"><details class="pdone"'+(sec.doneOpen?' open':'')+'><summary>Ja aconseguits ('+done.length+')</summary><ul>'
      + done.map(r => {
          const ai = pendArt(r.key);
          const act = ai >= 0
            ? '<span class="ptg">A l\'inventari</span><button type="button" class="pact pview" data-i="'+ai+'">Veure fitxa</button>'
            : '<span class="ptg">Sense fitxa</span><button type="button" class="pact pmake" data-k="'+r.key+'" data-n="'+esc(r.name)+'">Crea la fitxa</button>';
          return '<li><span class="pdn">'+esc(r.name)+'</span>'+act+'<button type="button" class="pact pundo" data-k="'+r.key+'" data-n="'+esc(r.name)+'" title="Torna-ho a pendents">↩ Desfés</button></li>';
        }).join("") + '</ul></details></li>';
  }
  if(Object.keys(tret).some(k=>k.startsWith(cat.id+":"))) h += '<li><button type="button" class="prest" data-cat="'+cat.id+'">Restaura els suggerits eliminats</button></li>';
  list.innerHTML = h;
  const det = list.querySelector(".pdone"); if(det) det.ontoggle = () => { sec.doneOpen = det.open; };
  list.querySelectorAll('input[type="checkbox"]').forEach(b => {
    b.onchange = () => {
      const r = todo.find(x => x.key === b.dataset.k); b.checked = false; if(!r) return;
      if(pendArt(r.key) >= 0){ have[r.key] = "art"; store("inv_tinc", have); refreshPend(cat.id); toast("«" + r.name + "» ja tenia fitxa a l'inventari: l'he tornat a marcar com a aconseguit."); return; }
      openForm(cat.id, r.name, r.key);
    };
  });
  list.onclick = e => {
    const v = e.target.closest(".pview"), m = e.target.closest(".pmake"), u = e.target.closest(".pundo");
    if(v){ const i = +v.dataset.i; if(!order.includes(i)) resetFilters(); openDlg(i); }
    else if(m){ openForm(cat.id, m.dataset.n, m.dataset.k); }
    else if(u){
      const art = have[u.dataset.k] === "art" || pendArt(u.dataset.k) >= 0;
      delete have[u.dataset.k]; store("inv_tinc", have); refreshPend(cat.id);
      toast("«" + u.dataset.n + "» torna a pendents." + (art ? " L'article creat continua a l'inventari." : ""));
    }
  };
  const pb = sec.el.querySelector(".pend-btn");
  sec.el.querySelector(".pn").textContent = todo.length || "✓";
  pb.classList.toggle("alldone", !todo.length);
}
function buildSection(cat){
    const out = $("out");
    const items = DATA.map((c,i)=>({c,i})).filter(({c})=>catsOf(c).includes(cat.id));
    const s = document.createElement("section");
    s.innerHTML = '<h2><span aria-hidden="true">'+cat.icon+'</span>'+esc(cat.label)+'<span class="n"></span>'
      +'<button type="button" class="sbtn pend-btn" aria-expanded="false" aria-controls="pend-'+cat.id+'">Pendents <span class="pn"></span></button>'
      +VIEWS+'</h2>'
      +'<div class="pend-panel" id="pend-'+cat.id+'" hidden><p class="phelp"><span aria-hidden="true">💡</span><span>Coses que normalment calen a '+esc(cat.label.toLowerCase())+' i encara no tens. Quan en tinguis una, <b>marca-la</b>: s\'obrirà la fitxa i la confirmes amb el <b>botó verd</b>.</span></p><ul class="pend-list"></ul>'
      +'<form class="pend-add"><input type="text" placeholder="Afegeix un pendent, p. ex. tornavís" aria-label="Nou pendent a '+esc(cat.label)+'" required maxlength="80"><button class="sbtn" type="submit">Afegeix</button></form></div>'
      +'<ul class="grid">'+items.map(({c,i})=>card(c,i)).join("")+'</ul>';
    out.appendChild(s);
    const sec = {el:s, cat, n:s.querySelector("h2 .n"), grid:s.querySelector("ul.grid"), cards:[...s.querySelectorAll("li.card")]};
    sections.push(sec);
    const pb = s.querySelector(".pend-btn"), panel = s.querySelector(".pend-panel");
    pb.onclick = () => { const open = panel.hidden; panel.hidden = !open; pb.setAttribute("aria-expanded", String(open)); };
    s.querySelector(".pend-add").onsubmit = e => {
      e.preventDefault();
      const inp = e.target.querySelector("input"), name = inp.value.trim(); if(!name) return;
      (extra[cat.id] = extra[cat.id]||[]).push({id:Date.now(), name});
      store("inv_pend_extra", extra); inp.value = ""; refreshPend(cat.id);
    };
    renderPend(sec);
}
buildNewSection();
CATS.forEach(buildSection);

/* ---- Formulari per crear un article des de Pendents ---- */
let formCtx = null, formPhoto = null;
function fillFormSelects(catId){
  $("fLoc").innerHTML = LOCS.map(l=>'<option>'+esc(l)+'</option>').join("") + '<option value="__new">➕ Nova ubicació…</option>';
  $("fCat").innerHTML = CATS.map(c=>'<option value="'+c.id+'">'+c.icon+' '+esc(c.label)+'</option>').join("") + '<option value="__new">➕ Nova zona…</option>';
  $("fCat").value = catId;
  $("fNewLoc").hidden = true; $("fNewLoc").required = false;
  $("fNewCat").hidden = true; $("fCatName").required = false;
  $("fAuto").hidden = true;
  setFormPhoto(null);
  fillMulti([], []);
}
function fillMulti(selLocs, selCats){
  const pl = $("fLoc").value, pc = $("fCat").value;
  const lc = LOCS.filter(l => l !== pl), cc = CATS.filter(z => z.id !== pc);
  $("fLocs2").innerHTML = lc.map(l => '<label class="fchip"><input type="checkbox" value="'+esc(l)+'"'+(selLocs.includes(l)?' checked':'')+'><span>'+esc(l)+'</span></label>').join("")
    || '<span class="fnone">No hi ha cap altra ubicació</span>';
  $("fCats2").innerHTML = cc.map(z => '<label class="fchip"><input type="checkbox" value="'+esc(z.id)+'"'+(selCats.includes(z.id)?' checked':'')+'><span>'+z.icon+' '+esc(z.label)+'</span></label>').join("")
    || '<span class="fnone">No hi ha cap altra zona</span>';
}
const checkedOf = id => [...$(id).querySelectorAll("input:checked")].map(x => x.value);
function openEdit(i){
  const c = DATA[i];
  formCtx = {edit:i, editId:c.id}; formPhoto = null;
  $("fForm").reset(); fillFormSelects(c.cat);
  $("fTitle").textContent = "Edita l'article";
  $("fName").value = c.item; $("fDesc").value = c.desc || "";
  $("fQty").value = typeof c.qty==="number" ? c.qty : (qtyFromName(c.item) || "");
  $("fQty").placeholder = typeof c.qty==="number" ? "" : String(c.qty);
  if(LOCS.includes(c.loc)) $("fLoc").value = c.loc;
  fillMulti(locsOf(c).slice(1), catsOf(c).slice(1));
  $("fNoteL").hidden = false; $("fNote").value = c.note || "";
  formPhotoBase = c.photos.length ? '<img alt="" src="'+thumbSrc(c)+'">' : '<span>Sense foto</span>';
  $("fPrev").innerHTML = formPhotoBase;
  $("fOnly").hidden = true; $("fSave").textContent = "Desa i marca com a correcte"; $("fSave").classList.remove("go"); $("fHint").hidden = true;
  $("fdlg").showModal(); if(!isTouch) $("fName").focus(); else { try { document.activeElement.blur(); } catch(_){} }
}
function openForm(catId, name, key){
  formCtx = {catId, key}; formPhoto = null;
  const f = $("fForm"); f.reset();
  $("fTitle").textContent = "Nou article a " + zoneOf({cat:catId});
  $("fName").value = name;
  fillFormSelects(catId);
  $("fTitle").textContent = "Afegir «" + name + "» a l'inventari";
  $("fHint").textContent = "Ve de Pendents de " + zoneOf({cat:catId}) + ". Només el nom és obligatori: completa el que sàpigues i confirma amb el botó verd.";
  $("fHint").hidden = false;
  $("fNoteL").hidden = true; $("fOnly").hidden = false; $("fOnly").textContent = "Ja el tinc, no cal fitxa";
  $("fSave").textContent = "✓ Crea l'article"; $("fSave").classList.add("go"); $("fQty").placeholder = "";
  if(state.loc !== "all" && LOCS.includes(state.loc)) setTimeout(()=>{ $("fLoc").value = state.loc; fillMulti([], []); });
  formPhotoBase = '<span>Sense foto</span>'; $("fPrev").innerHTML = formPhotoBase;
  const q0 = qtyFromName(name); if(q0) $("fQty").value = q0;
  $("fdlg").showModal(); if(!isTouch) $("fName").focus(); else { try { document.activeElement.blur(); } catch(_){} }
}
/* v3.8: es pot pujar QUALSEVOL foto (càmera del mòbil, galeria o captura de pantalla, PNG o JPG, de qualsevol mida).
   Es redueix sola, sense que calgui configurar res, perquè càpiga al núvol (Firestore: menys d'1 MB per document).
   Es prova la millor qualitat primer i es va baixant només si cal. */
const PHOTO_MAX_CHARS = 800000;
const PHOTO_TIERS = [[8000, 5e6, .88], [6000, 4e6, .85], [4000, 3e6, .8], [3000, 2e6, .75], [2000, 1.3e6, .68], [1400, .8e6, .6], [1000, .5e6, .55], [700, .3e6, .5], [500, .2e6, .45], [320, .1e6, .4]];
function photoJpeg(src, sw, sh){
  const longest = Math.max(sw, sh), area = sw * sh;
  const draw = (w, h, q) => {
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const x = cv.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, w, h);   /* les captures amb transparència no es veuen negres */
    x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, w, h);
    return cv.toDataURL("image/jpeg", q);
  };
  let last = "";
  for(const [m, px, q] of PHOTO_TIERS){
    const k = Math.min(1, m / longest, Math.sqrt(px / area));
    last = draw(Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k)), q);
    if(last.length <= PHOTO_MAX_CHARS) break;
  }
  /* v6.0: miniatura per a la llista, feta ara que la imatge ja és a la memòria */
  try { const t = Math.min(1, THUMB_PX / longest); THUMB_OF.set(last, draw(Math.max(1, Math.round(sw * t)), Math.max(1, Math.round(sh * t)), THUMB_Q)); } catch(e){}
  return last;
}
function resizePhoto(file){
  return new Promise((ok, ko) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      try { ok(photoJpeg(img, img.naturalWidth || img.width, img.naturalHeight || img.height)); } catch(e){ ko(e); }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(); };
    img.src = url;
  });
}
/* ---- v2.7: foto adjunta o feta al moment ---- */
let formPhotoBase = '<span>Sense foto</span>';
function setFormPhoto(src){
  formPhoto = src || null;
  if(formPhoto) $("fPrev").innerHTML = '<img alt="Foto de l\'article" src="'+formPhoto+'">';
  $("fPhDel").hidden = !formPhoto;
}
async function takeFile(e){
  const file = e.target.files[0]; e.target.value = ""; if(!file) return;
  try { setFormPhoto(await resizePhoto(file)); }
  catch(err){ setFormPhoto(null); $("fPrev").innerHTML = '<span>No s\'ha pogut llegir la foto (format no compatible?)</span>'; }
}
$("fPhoto").onchange = takeFile;
$("fCam").onchange = takeFile;
$("fGalBtn").onclick = () => $("fPhoto").click();
$("fPhDel").onclick = () => { setFormPhoto(null); $("fPrev").innerHTML = formPhotoBase; };
const isTouch = matchMedia("(pointer:coarse)").matches || /iPhone|iPad|Android/i.test(navigator.userAgent);
let camStream = null, camFacing = "environment";
function camStop(){ if(camStream){ camStream.getTracks().forEach(t => t.stop()); camStream = null; } $("camVid").srcObject = null; }
async function camStart(){
  camStop();
  $("camMsg").hidden = false; $("camMsg").textContent = "Obrint la càmera…";
  $("camVid").hidden = false; $("camShot").hidden = true;
  $("camShoot").hidden = false; $("camShoot").disabled = true; $("camUse").hidden = true; $("camRetry").hidden = true;
  try {
    camStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:camFacing, width:{ideal:1920}, height:{ideal:1440}}, audio:false});
    $("camVid").srcObject = camStream; await $("camVid").play().catch(()=>{});
    $("camMsg").hidden = true; $("camShoot").disabled = false;
    navigator.mediaDevices.enumerateDevices().then(d => { $("camSwap").hidden = d.filter(x => x.kind === "videoinput").length < 2; }).catch(()=>{});
    return true;
  } catch(err){ camStop(); return false; }
}
$("fCamBtn").onclick = async () => {
  if(isTouch || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)){ $("fCam").click(); return; }
  $("camdlg").showModal();
  if(!await camStart()){
    $("camdlg").close();
    toast("No s'ha pogut obrir la càmera. Revisa el permís del navegador o adjunta una foto.");
    $("fCam").click();
  }
};
$("camShoot").onclick = () => {
  const v = $("camVid"), w = v.videoWidth, h = v.videoHeight; if(!w || !h) return;
  const cv = $("camShot"); cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
  camStop(); v.hidden = true; cv.hidden = false;
  $("camShoot").hidden = true; $("camUse").hidden = false; $("camRetry").hidden = false; $("camSwap").hidden = true;
};
$("camRetry").onclick = () => camStart();
$("camSwap").onclick = () => { camFacing = camFacing === "environment" ? "user" : "environment"; camStart(); };
$("camUse").onclick = () => { setFormPhoto(photoJpeg($("camShot"), $("camShot").width, $("camShot").height)); $("camdlg").close(); };
$("camCancel").onclick = () => $("camdlg").close();
$("camdlg").addEventListener("close", camStop);
$("fCat").onchange = () => { const nw = $("fCat").value === "__new"; $("fNewCat").hidden = !nw; $("fCatName").required = nw; if(nw) $("fCatName").focus(); };
/* Si el nom porta "x6", "x10"... és la quantitat */
const qtyFromName = n => { const m = /(?:^|\s)x\s?(\d+)\b/i.exec(n); return m ? +m[1] : null; };
$("fName").addEventListener("input", () => { const q = qtyFromName($("fName").value); if(q) $("fQty").value = q; });

/* ---- v6.0 🪄 zona automàtica segons el nom ----
   Aprèn dels articles que ja tens (on els has posat), dels pendents de cada zona i d'una llista de paraules habituals. */
const ZONE_WORDS = {
  cuina:"paella olla cassola casso ganivet tallar plat got tassa bol cullera forquilla coberts colador ratllador obrellaunes llevataps cullerot varetes gerra motlle manyopla carmanyola tupper escorreplats safata pelador espremedor premsa setrill drap alumini film cafetera mortaret saler pebrer copa ampolla tetera tapa pot sarten vaso taza plato cuchillo tenedor cuchara olla ensaladera",
  menjador:"taula cadira sofa moble televisio llum catifa cortina coixi manta prestatgeria rellotge quadre tovalles estovalles gerro espelma aparador puf plaid mirall decoracio sillon mesa silla",
  bany:"tovallola dutxa mampara raspall dents mirall vater termometre gases esparadrap ungles assecador cabells afaitar pinta farmaciola ambientador sabo xampu gel crema coto bastonets colonia perfum maquillatge toalla champu",
  dormitori:"llit matalas llencol nordica edredo coixi tauleta despertador armari calaixera penjador capcal pijama cama colchon sabana almohada",
  office:"escriptori monitor teclat ratoli impressora portatil ordinador usb hdmi cable auriculars webcam grapadora tisores boligraf llibreta carpeta arxivador calculadora router wifi carregador pendrive altaveu tablet movil",
  eines:"martell tornavis alicates clau anglesa metre escala tacs cargol brida cinta silicona allargador piles bombeta trepant broca serra llima cuter nivell taladro destornillador tenalles caixa eines llanterna corda soldador",
  electro:"nevera rentadora rentaplats forn microones placa campana torradora bullidor planxa televisor fregidora batedora minipimer aspiradora ventilador estufa radiador aire condicionat robot termo assecadora humidificador nespresso thermomix freidora lavadora",
  neteja:"escombra recollidor fregar galleda plomall guants fregall estenedor pinces desembussador escombraries detergent rentavaixelles lleixiu netejador netejavidres mopa esponja suavitzant baieta microfibra bossa escoba fregona lejia"
};
const zStem = w => w.length > 4 ? w.replace(/(es|s)$/, "") : w;
const zWords = t => loose(t).split(" ").filter(w => w.length > 2).map(zStem);
let ZIDX = null, ZIDX_N = -1;
function zoneIndex(){
  if(ZIDX && ZIDX_N === DATA.length + CATS.length * 1e6) return ZIDX;
  const idx = new Map();
  const add = (zid, text, w) => zWords(text).forEach(t => { let m = idx.get(t); if(!m){ m = new Map(); idx.set(t, m); } m.set(zid, (m.get(zid) || 0) + w); });
  CATS.forEach(z => {
    if(ZONE_WORDS[z.id]) add(z.id, ZONE_WORDS[z.id], 2);
    pendBase(z.id).forEach(p => add(z.id, p, 1.5));
    (extra[z.id] || []).forEach(x => add(z.id, x.name, 1.5));
    add(z.id, z.label, 2);
  });
  DATA.forEach(c => { if(live(c)) add(c.cat, c.item, 3); });
  ZIDX = idx; ZIDX_N = DATA.length + CATS.length * 1e6;
  return idx;
}
/* torna {z, why} amb la zona més probable, o null si no n'està prou segur */
function zoneGuess(name){
  const ws = zWords(name); if(!ws.length) return null;
  const idx = zoneIndex(), sc = new Map(), why = new Map();
  ws.forEach(t => {
    let m = idx.get(t), f = 1;
    if(!m && t.length >= 4){ for(const [k, v] of idx){ if(k.length >= 4 && (k.startsWith(t) || t.startsWith(k))){ m = v; f = .6; break; } } }
    if(!m) return;
    m.forEach((v, zid) => { sc.set(zid, (sc.get(zid) || 0) + v * f); if(!why.has(zid)) why.set(zid, t); });
  });
  const r = [...sc].filter(([zid]) => CATS.some(z => z.id === zid)).sort((a, b) => b[1] - a[1]);
  if(!r.length || r[0][1] < 1.5 || (r[1] && r[0][1] < r[1][1] * 1.3)) return null;
  return {z: CATS.find(z => z.id === r[0][0]), why: why.get(r[0][0])};
}
function zoneAuto(){
  if(!formCtx || !formCtx.auto || formCtx.catTouched) return;
  const g = zoneGuess($("fName").value);
  const h = $("fAuto");
  if(!g){ h.hidden = true; return; }
  if($("fCat").value !== g.z.id){ $("fCat").value = g.z.id; fillMulti(checkedOf("fLocs2"), checkedOf("fCats2").filter(x => x !== g.z.id)); }
  h.textContent = "🪄 Zona triada sola: " + g.z.icon + " " + g.z.label + ". Si no és aquesta, canvia-la.";
  h.hidden = false;
}
let zaT = 0;
$("fName").addEventListener("input", () => { clearTimeout(zaT); zaT = setTimeout(zoneAuto, 220); });
$("fCat").addEventListener("change", () => { if(formCtx) formCtx.catTouched = true; $("fAuto").hidden = true; });
$("fLoc").onchange = () => { const nw = $("fLoc").value==="__new"; $("fNewLoc").hidden = !nw; $("fNewLoc").required = nw; if(nw) $("fNewLoc").focus(); };
$("fCancel").onclick = () => $("fdlg").close();
$("fLoc").addEventListener("change", () => fillMulti(checkedOf("fLocs2"), checkedOf("fCats2")));
$("fCat").addEventListener("change", () => fillMulti(checkedOf("fLocs2"), checkedOf("fCats2")));
$("fOnly").onclick = () => { have[formCtx.key] = true; store("inv_tinc", have); afterPend(); $("fdlg").close(); toast("Marcat com a aconseguit, sense fitxa. El trobaràs a «Ja aconseguits», on li pots crear la fitxa quan vulguis."); };
function afterPend(){ refreshPend(formCtx.catId); return sections.find(s=>s.cat.id===formCtx.catId); }
$("fForm").onsubmit = e => {
  e.preventDefault();
  /* v2.7: zona i ubicació noves creades des del mateix formulari */
  if($("fCat").value === "__new"){
    const label = $("fCatName").value.trim().replace(/\s+/g, " ");
    if(!label){ $("fCatName").focus(); return; }
    let z = CATS.find(c => norm(c.label) === norm(label) || norm(c.short) === norm(label));
    if(!z){
      z = {id:"u" + Date.now(), label, short:label, icon:$("fIcon").value};
      userCats.push(z); store("inv_cats", userCats); CATS.push(z); buildSection(z); setView(view);
      toast("Zona «" + label + "» creada.");
    }
    const o = document.createElement("option"); o.value = z.id; o.textContent = z.icon + " " + z.label;
    if(![...$("fCat").options].some(x => x.value === z.id)) $("fCat").insertBefore(o, $("fCat").lastElementChild);
    $("fCat").value = z.id;
  }
  let loc = $("fLoc").value==="__new" ? $("fNewLoc").value.trim().replace(/\s+/g, " ") : $("fLoc").value;
  if(!loc){ $("fNewLoc").focus(); return; }
  if($("fLoc").value==="__new"){
    const dup = LOCS.find(l => norm(l) === norm(loc));
    if(dup) loc = dup;
    else { userLocs.push(loc); store("inv_locs", userLocs); refreshLocs(); }
  }
  const name = $("fName").value.trim().replace(/\s+/g, " ");
  if(!name){ $("fName").value = ""; $("fName").focus(); toast("Posa un nom a l'article."); return; }
  const qRaw = $("fQty").value.trim(), qty = parseInt(qRaw, 10);
  if(qRaw && !(qty > 0 && qty < 100000)){ $("fQty").focus(); toast("La quantitat ha de ser un número entre 1 i 99999."); return; }
  const L = [loc].concat(checkedOf("fLocs2").filter(l => l !== loc));
  const Z = [$("fCat").value].concat(checkedOf("fCats2").filter(z => z !== $("fCat").value && CATS.some(x => x.id === z)));
  if(formCtx.edit !== undefined){
    const i = formCtx.editId ? DATA.findIndex(x => x.id === formCtx.editId) : formCtx.edit, c = DATA[i];
    if(!c){ $("fdlg").close(); toast("Aquest article ja no existeix (potser s'ha eliminat des d'un altre dispositiu)."); return; }
    const patch = Object.assign({item:name, desc:$("fDesc").value.trim(), note:$("fNote").value.trim(), cat:Z[0], cats: Z.length > 1 ? Z : null,
      qty: qty>0 ? qty : c.qty, loc, locs: L}, CORRECTE);
    if(formPhoto) patch.photos = [formPhoto].concat(c.photos);
    $("fdlg").close(); saveItem(i, patch); afterReview(); return;
  }
  const c = {item:name, cat:Z[0], desc:$("fDesc").value.trim(), qty: qty>0 ? qty : 1,
    estado: formPhoto ? "ok" : "sin", fiab:"alta", note: formCtx.free ? $("fNote").value.trim() : "Afegit des de Pendents", photos: formPhoto ? [formPhoto] : [],
    pend:0, inv:0, loc, locs:L, nou:true, pkey: formCtx.key || undefined};
  if(Z.length > 1) c.cats = Z;
  c.ord = Date.now();
  if(cloudUser) c.by = String(cloudUser.email).toLowerCase();
  if(!cloudSaveItem(c)){ toast("No s'ha pogut desar l'article."); return; }
  if(formCtx.key){ have[formCtx.key] = "art"; store("inv_tinc", have); }
  DATA.push(c); SEARCH.push(searchText(c)); refreshLocs();
  const i = DATA.length - 1; if(formCtx.key) afterPend();
  if(formCtx.key && !formCtx.free) toast("«" + c.item + "» creat a " + zoneOf(c) + " · " + locsTxt(c, ", ") + ". Ja no és pendent ✓");
  if(formCtx.free) toast("Article «" + c.item + "» creat a " + zoneOf(c) + " · " + locsTxt(c, ", ") + ".");
  placeCards(i);
  updateSub(); render(); $("fdlg").close();
  celebrateNew(c);
};

/* ---- v4.0: ordre (els NEW sempre a dalt) i secció «Nous» ---- */
let ORD = new Map();
function applyOrder(){
  const L = [];
  DATA.forEach((c, i) => { if(live(c)) L.push({c, i}); });
  const mode = cfgGet("sortMode"), m = new Map();
  if(mode === 1) [...L].sort((a, b) => String(a.c.item).localeCompare(String(b.c.item), "ca", {sensitivity:"base", numeric:true})).forEach((x, k) => m.set(x.i, k));
  else if(mode === 2) [...L].sort((a, b) => (+b.c.ord || 0) - (+a.c.ord || 0) || b.i - a.i).forEach((x, k) => m.set(x.i, k));
  L.filter(x => isNew(x.c)).sort((a, b) => b.c.ord - a.c.ord).forEach((x, k) => m.set(x.i, -100000 + k));
  ORD = m;
  sections.forEach(sec => sec.cards.forEach(li => { li.style.order = m.get(+li.dataset.i) || 0; }));
}
function buildNewSection(){
  const s = document.createElement("section"); s.className = "sec-new";
  s.innerHTML = '<h2><span aria-hidden="true">🆕</span>Nous<span class="n"></span>' + VIEWS + '</h2><ul class="grid"></ul>';
  $("out").appendChild(s);
  sections.push({el:s, cat:NEWCAT, n:s.querySelector("h2 .n"), grid:s.querySelector("ul.grid"), cards:[]});
}
function syncNewCards(){
  const sec = sections[0]; if(!sec || sec.cat.id !== "__new") return;
  const want = []; DATA.forEach((c, i) => { if(live(c) && isNew(c)) want.push(i); });
  const have_ = sec.cards.map(li => +li.dataset.i);
  if(want.length === have_.length && want.every((x, k) => x === have_[k])) return;
  sec.cards.forEach(li => li.remove()); sec.cards = [];
  const tmp = document.createElement("ul");
  want.forEach(i => { tmp.innerHTML = card(DATA[i], i); const li = tmp.firstElementChild; sec.grid.appendChild(li); sec.cards.push(li); });
}
function render(){
  syncNewCards(); applyOrder();
  renderChips();
  let total = 0; order = [];
  sections.forEach(sec=>{
    let n = 0; const vis = [], isN = sec.cat.id === "__new";
    sec.cards.forEach((li, k)=>{
      const i = +li.dataset.i, c = DATA[i], nw = !!c && isNew(c);
      const ok = !!c && matches(c, i) && (isN ? (state.cat === "all" && nw) : state.cat === "all" ? (sec.cat.id === c.cat && !nw) : sec.cat.id === state.cat);
      li.hidden = !ok;
      if(ok){ n++; vis.push({i, o: +li.style.order || 0, k}); }
    });
    vis.sort((a, b) => a.o - b.o || a.k - b.k).forEach(v => order.push(v.i));
    sec.el.hidden = !n && state.cat!==sec.cat.id; sec.n.textContent = n; total += n;
  });
  $("none").hidden = total>0 || view==="check";
  if(view==="check") renderCheck();
  const actius = [];
  if(state.review) actius.push("Per revisar");
  if(state.loc!=="all") actius.push(state.loc);
  if(state.cat!=="all") actius.push(zoneOf({cat:state.cat}));
  if(state.q) actius.push("cerca «"+$("q").value.trim()+"»");
  $("reset").hidden = !actius.length;
  $("reset").textContent = actius.length ? "Filtre actiu: "+actius.join(" · ")+" — es veuen "+total+" de "+DATA.filter(live).length+". Treu els filtres" : "";
}
/* ---- Vista Check: tots els articles (ja tinguts) i els pendents, per columnes ---- */
const checkClosed = new Set(load("inv_check_closed", []));
function renderCheck(){
  const q = state.q, solo = state.cat !== "all";
  let tot = 0, fet = 0;
  let shown = 0;
  const seen = new Set();
  const cols = CATS.filter(cat=>state.cat==="all" || state.cat===cat.id).map(cat=>{
    const arts = DATA.map((c,i)=>({c,i})).filter(({c,i})=>catsOf(c).includes(cat.id) && matches(c,i)).sort((x, y) => ((ORD.get(x.i) || 0) - (ORD.get(y.i) || 0)) || x.i - y.i);
    const pend = state.loc==="all" && !state.review ? pendRows(cat.id).filter(r=>have[r.key]!=="art" && (!q || qText(norm(r.name)))) : [];
    const ok = arts.length + pend.filter(r=>have[r.key]).length, all = arts.length + pend.length;
    arts.forEach(({i}) => seen.add(i));
    tot += pend.length; fet += pend.filter(r=>have[r.key]).length;
    if(!all) return "";
    shown++;
    return '<details class="ccol'+(solo?' solo':'')+'" data-cat="'+cat.id+'"'+(solo || !checkClosed.has(cat.id) ? ' open' : '')+'><summary><h3><span aria-hidden="true">'+cat.icon+'</span>'+esc(cat.label)+'<span class="n">'+ok+' / '+all+'</span></h3></summary><ul>'
      + pend.filter(r=>!have[r.key]).map(r=>'<li class="cp"><label><input type="checkbox" data-cat="'+cat.id+'" data-k="'+r.key+'"><span>'+esc(r.name)+'</span></label><span class="ptag">Pendent</span>'+buyBtnHtml(cat.id, r)+pdel(cat.id, r)+'</li>').join("")
      + arts.map(({c,i})=>'<li><label><input type="checkbox" checked data-i="'+i+'"><span>'+esc(c.item)+(isNew(c)?'<em class="ntg">NEW</em>':'')+'</span></label><span class="cmeta">'+esc(qtyBadge(c.qty))+' · '+esc(locsTxt(c, ", "))+'</span></li>').join("")
      + pend.filter(r=>have[r.key]).map(r=>'<li><label><input type="checkbox" checked data-cat="'+cat.id+'" data-k="'+r.key+'"><span>'+esc(r.name)+'</span></label><span class="cmeta">Marcat</span>'+pdel(cat.id, r)+'</li>').join("")
      + '</ul></details>';
  }).join("");
  tot += seen.size; fet += seen.size;
  $("checkview").innerHTML = '<div class="chead"><h2>☑ Check <span class="n">'+fet+' de '+tot+' tinguts</span></h2><button type="button" class="sbtn pnew" id="pNewBtn">＋ Crear pendent</button>'+(!solo && shown > 1 ? '<button type="button" class="cfold" data-f="close">▸ Plega-les</button><button type="button" class="cfold" data-f="open">▾ Obre-les</button>' : '')+VIEWS+'</div>'
    + (cols ? '<div class="cgrid'+(shown===1?' solo':'')+'">'+cols+'</div>' : '<p class="empty-msg">Cap article coincideix amb els filtres.</p>');
  document.querySelectorAll("#checkview .views button").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.v===view)));
  if(!solo) $("checkview").querySelectorAll("details.ccol").forEach(d => d.addEventListener("toggle", () => {
    if(d.open) checkClosed.delete(d.dataset.cat); else checkClosed.add(d.dataset.cat);
    store("inv_check_closed", [...checkClosed]);
  }));
  $("checkview").querySelectorAll(".cfold").forEach(b => b.onclick = () => {
    const cl = b.dataset.f === "close";
    $("checkview").querySelectorAll("details.ccol").forEach(d => { if(cl) checkClosed.add(d.dataset.cat); else checkClosed.delete(d.dataset.cat); });
    store("inv_check_closed", [...checkClosed]); renderCheck();
  });
}
$("checkview").addEventListener("click", e => { const sm = e.target.closest("details.ccol.solo > summary"); if(sm) e.preventDefault(); });
$("checkview").addEventListener("change", e => {
  const b = e.target; if(b.type!=="checkbox") return;
  if(b.dataset.i){ b.checked = true; openDlg(+b.dataset.i); return; }
  const name = b.closest("li").querySelector("label span").textContent;
  if(b.checked){ b.checked = false; openForm(b.dataset.cat, name, b.dataset.k); }
  else { delete have[b.dataset.k]; store("inv_tinc", have); refreshPend(b.dataset.cat); toast("«" + name + "» torna a pendents."); }
});
/* ---- Crear pendent (amb opció de crear una zona nova de la casa) ---- */
document.addEventListener("click", e => {
  if(!e.target.closest("#pNewBtn")) return;
  $("pForm").reset();
  $("pCat").innerHTML = CATS.map(c=>'<option value="'+c.id+'">'+c.icon+' '+esc(c.label)+'</option>').join("") + '<option value="__new">➕ Nova zona…</option>';
  if(state.cat!=="all") $("pCat").value = state.cat;
  $("pNewCat").hidden = true; $("pCatName").required = false;
  $("pdlg").showModal(); $("pName").focus();
});
$("pCat").onchange = () => { const nw = $("pCat").value==="__new"; $("pNewCat").hidden = !nw; $("pCatName").required = nw; if(nw) $("pCatName").focus(); };
$("pCancel").onclick = () => $("pdlg").close();
$("pForm").onsubmit = e => {
  e.preventDefault();
  let catId = $("pCat").value;
  if(catId==="__new"){
    const label = $("pCatName").value.trim();
    const dup = CATS.find(c=>norm(c.label)===norm(label));
    if(dup) catId = dup.id;
    else {
      const cat = {id:"u"+Date.now(), label, short:label, icon:$("pIcon").value};
      userCats.push(cat); store("inv_cats", userCats); CATS.push(cat); buildSection(cat); catId = cat.id;
    }
  }
  (extra[catId] = extra[catId]||[]).push({id:Date.now(), name:$("pName").value.trim()});
  store("inv_pend_extra", extra);
  $("pdlg").close();
  setView(view); refreshPend(catId);
};
let toastT = null;
function toast(msg){
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  try { if(t.showPopover){ if(t.matches(":popover-open")) t.hidePopover(); t.showPopover(); } } catch(e){}
  clearTimeout(toastT);
  toastT = setTimeout(()=>{ try { if(t.matches && t.matches(":popover-open")) t.hidePopover(); } catch(e){} t.hidden = true; }, cfgGet("toast"));
}
function resetFilters(){
  state.q=""; state.cat="all"; state.loc="all"; state.review=false;
  $("q").value=""; render();
}

/* ---- Popup en cartes ---- */
let pos = 0, cur = null, idx = 0, opener = null, busy = false;
const box = $("box");
function showDlg(){
  const c = DATA[cur];
  const multi = c.photos.length > 1;
  $("dPhoto").className = "ph" + (multi ? " multi" : "");
  $("dPhoto").innerHTML = c.photos.length
    ? '<img alt="'+esc(c.item)+'" src="'+c.photos[idx]+'">' + (multi ? '<span class="more">Foto '+(idx+1)+' de '+c.photos.length+' · toca per ampliar</span>' : '')
    : '<span style="color:#c2c2c2;font-size:14px">'+(c.pend>0?'Foto pendent de tornar a enviar':'Encara sense foto')+'</span>';
  if(!c.photos.length) $("dPhoto").className = "ph empty";
  if(isNew(c)) $("dPhoto").insertAdjacentHTML("beforeend", '<span class="newtag">NEW</span>');
  $("dNew").hidden = !isNew(c);
  $("dLoc").textContent = "📍 " + locsTxt(c);
  $("dTitle").textContent = c.item;
  $("dQty").textContent = c.qty;
  $("dZone").textContent = zonesTxt(c);
  $("dFiab").textContent = FIAB[c.fiab] || c.fiab;
  $("dEstat").textContent = ESTAT[c.estado] || "";
  $("dDesc").textContent = c.desc || ""; $("dDesc").style.display = c.desc ? "" : "none";
  $("dNote").textContent = c.note || "";  $("dNote").style.display = c.note ? "" : "none";
  const why = needsReview(c) ? reasons(c) : [];
  $("dWhy").innerHTML = why.length ? 'Per revisar:<ul>'+why.map(r=>'<li>'+esc(r)+'</li>').join("")+'</ul>' : "";
  $("dWhy").hidden = !why.length; $("dOk").hidden = !why.length;
  $("dBreak").innerHTML = (c.breakdown||[]).map(b => "<div><b>"+esc(b.loc)+" · x"+esc(b.qty)+"</b><br>"+esc(b.text)+"</div>").join("");
  $("dPos").textContent = "Article " + (pos+1) + " de " + order.length;
  const one = order.length < 2;
  $("dPrev").disabled = one; $("dNext").disabled = one;
  /* v6: la foto completa es baixa ara; mentrestant es veu la miniatura */
  $("dPhoto").classList.toggle("loading", !!(c._ph && c._ph[idx] && !PHF.has(c._ph[idx])));
  ensureFull(c).then(got => { if(got && DATA[cur] === c && $("dlg").classList.contains("open")) showDlg(); else $("dPhoto").classList.remove("loading"); });
  if(!one) [order[(pos + 1) % order.length], order[(pos - 1 + order.length) % order.length]].forEach(i => { const n = DATA[i]; if(n && n._ph && n._ph[0]) fullPhoto(n._ph[0]); });
}
/* Després de corregir: es queda a la mateixa posició, que a Revisar ja és el següent article */
function afterReview(){
  if(!$("dlg").classList.contains("open")) return;
  if(!order.length){ closeDlg(); return; }
  pos = Math.min(pos, order.length-1);
  if(order.includes(cur) && order[pos]!==cur) pos = order.indexOf(cur);
  cur = order[pos]; idx = 0; showDlg(); box.scrollTop = 0;
}
$("dEdit").onclick = () => openEdit(cur);
/* ---- Afegir fotos des del popup (s'afegeixen, no substitueixen) ---- */
$("dAddPh").onclick = () => $("dPhIn").click();
$("dPhIn").onchange = async e => {
  const files = [...e.target.files]; e.target.value = "";
  if(!files.length || cur === null) return;
  const i = cur, c = DATA[i], add = [];
  for(const f of files){ try { add.push(await resizePhoto(f)); } catch(err){} }
  if(!add.length){ toast("No s'ha pogut llegir cap foto (format no compatible?). Prova amb JPG o PNG."); return; }
  const first = c.photos.length;
  const patch = {photos: c.photos.concat(add), pend: 0};
  if(c.estado === "sin") patch.estado = "ok";
  saveItem(i, patch);
  toast(add.length === 1 ? "Foto afegida." : add.length + " fotos afegides.");
  if(order.includes(i)){ pos = order.indexOf(i); cur = i; idx = first; showDlg(); }
  else afterReview();
};

$("dOk").onclick = () => { saveItem(cur, Object.assign({}, CORRECTE, {note: (DATA[cur].note ? DATA[cur].note + ". " : "") + "Revisat i correcte"})); afterReview(); };
function openDlg(i){
  opener = document.activeElement;
  pos = Math.max(0, order.indexOf(i)); cur = order[pos]; idx = 0;
  showDlg(); box.scrollTop = 0;
  $("dlg").classList.add("open"); document.body.classList.add("lock"); $("dClose").focus();
}
function closeDlg(){
  $("dlg").classList.remove("open"); document.body.classList.remove("lock");
  if(opener) opener.focus();
}
function go(dir){
  if(order.length < 2 || busy) return;
  const newPos = (pos + dir + order.length) % order.length;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const swap = () => { pos = newPos; cur = order[pos]; idx = 0; showDlg(); box.scrollTop = 0; };
  if(reduce){ swap(); return; }
  busy = true;
  const out = box.animate(
    [{transform:"translateX(0) rotate(0deg)", opacity:1},
     {transform:"translateX("+(-dir*28)+"%) rotate("+(-dir*34)+"deg)", opacity:0}],
    {duration:230, easing:"ease-in", fill:"forwards"});
  out.onfinish = () => {
    swap();
    const inn = box.animate(
      [{transform:"translateX("+(dir*28)+"%) rotate("+(dir*34)+"deg)", opacity:0},
       {transform:"translateX(0) rotate(0deg)", opacity:1}],
      {duration:290, easing:"cubic-bezier(.2,.8,.2,1)"});
    out.cancel();
    inn.onfinish = () => { busy = false; };
    inn.oncancel = () => { busy = false; };
  };
}
$("dClose").onclick = closeDlg;
$("dlg").addEventListener("click", e => { if(e.target === $("dlg") && dblOut($("dlg"))) closeDlg(); });
$("dPrev").onclick = () => go(-1);
$("dNext").onclick = () => go(1);
let swiped = false;
$("dPhoto").addEventListener("click", () => {
  if(swiped){ swiped = false; return; }
  const c = DATA[cur]; if(!c || !c.photos.length) return;
  lbOpen(c, idx, false);
});
let sx = null, sy = null;
box.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; swiped = false; });
box.addEventListener("pointercancel", () => { sx = null; });
box.addEventListener("pointerup", e => {
  if(sx === null) return;
  const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
  if(Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5){ swiped = true; go(dx < 0 ? 1 : -1); }
});
document.addEventListener("keydown", e => {
  if(e.target.closest && e.target.closest("#aiPanel")) return;
  if(!$("dlg").classList.contains("open") || $("fdlg").open || $("xdlg").open || $("sdlg").open || $("lpdlg").open) return;
  if(e.key === "Escape") closeDlg();
  if(e.key === "ArrowLeft") go(-1);
  if(e.key === "ArrowRight") go(1);
  if(e.key === "Tab"){
    /* manté el focus dins del popup */
    const f = [...$("dlg").querySelectorAll("button:not([disabled])")];
    const first = f[0], last = f[f.length-1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
});
let qt = null;
$("q").addEventListener("input", e => {
  clearTimeout(qt);
  qt = setTimeout(() => { const nq = norm(e.target.value.trim()); if(nq && !state.q){ state.cat="all"; state.loc="all"; state.review=false; } state.q = nq; render(); }, 120);
});
$("reset").onclick = resetFilters;
const filtersEl = $("chips");
addEventListener("scroll", () => { $("totop").hidden = scrollY < 600; }, {passive:true});
$("totop").onclick = () => { scrollTo({top:0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); };
$("none").querySelector("button").onclick = resetFilters;
$("out").addEventListener("click", e => { const b = e.target.closest(".card-btn[data-i]"); if(b) openDlg(+b.dataset.i); });

/* ---- Assistent de productes: respon preguntes sobre l'inventari (sense internet ni claus) ---- */
const AI_STOP = new Set("a al als amb de del dels d el els la les l lo los las en i o on es esta estan hi ha han tinc tenim tens quant quants quanta quantes que quin quina quins quines un una uns unes per pel com hem meu meva mi mis sobre donde tengo cuantos cuantas y".split(" "));
const aiWords = t => norm(t).replace(/[^a-z0-9ñç ]/g," ").split(/\s+/).filter(w=>w.length>1 && !AI_STOP.has(w));
const aiStem = w => w.length>4 ? w.replace(/(es|s)$/,"") : w;
function aiMsg(kind, text){
  const d = document.createElement("div"); d.className = "aimsg " + kind; d.textContent = text;
  $("aiMsgs").appendChild(d); $("aiMsgs").scrollTop = $("aiMsgs").scrollHeight; return d;
}
function aiItems(d, list){
  const box = document.createElement("div"); box.className = "aires";
  list.forEach(i => {
    const c = DATA[i], b = document.createElement("button"); b.type = "button";
    b.innerHTML = (c.photos.length ? '<img alt="" src="'+thumbSrc(c)+'">' : '<span class="noimg">📦</span>')
      + '<span><b>'+esc(c.item)+'</b> '+esc(qtyBadge(c.qty))+'<small>📍 '+esc(locsTxt(c, ", "))+' · '+esc(zonesTxt(c))+(c.desc?' · '+esc(c.desc):'')+'</small></span>';
    b.onclick = () => { if(!order.includes(i)) resetFilters(); aiOpen(false); openDlg(i); };
    box.appendChild(b);
  });
  d.appendChild(box); $("aiMsgs").scrollTop = $("aiMsgs").scrollHeight;
}
function aiSuggest(d, qs){
  const box = document.createElement("div"); box.className = "aisug";
  qs.forEach(q => { const b = document.createElement("button"); b.type="button"; b.className="sbtn"; b.textContent=q; b.onclick=()=>aiAsk(q); box.appendChild(b); });
  d.appendChild(box);
}
function aiAsk(text){
  aiMsg("me", text);
  const t = norm(text), words = aiWords(text);
  const zone = CATS.find(c => t.includes(norm(c.label)) || t.includes(norm(c.short)));
  const loc = LOCS.find(l => t.includes(norm(l)));
  const inScope = c => (!zone || catsOf(c).includes(zone.id)) && (!loc || locsOf(c).includes(loc));
  const all = DATA.map((c,i)=>i).filter(i=>live(DATA[i]) && inScope(DATA[i]));
  if(/compr/.test(t) && buyOpen().length){
    const d = aiMsg("bot", buyText() + "\n\nObre 🛒 Compra per marcar-ho quan ho tinguis.");
    aiSuggest(d, ["Què falta a la cuina?", "Quants articles tinc?"]);
    return;
  }
  if(/falt|pendent|necessit|compr/.test(t)){
    const zs = zone ? [zone] : CATS;
    const lines = zs.map(z => { const p = pendRows(z.id).filter(r=>!have[r.key]).map(r=>r.name); return p.length ? z.icon+" "+z.label+" ("+p.length+"): "+p.join(", ") : ""; }).filter(Boolean);
    aiMsg("bot", lines.length ? "Encara et falta:\n\n"+lines.join("\n\n") : "No tens res pendent"+(zone?" a "+zone.label:"")+". 👍");
    return;
  }
  if(/revis/.test(t)){
    const r = all.filter(i=>needsReview(DATA[i]));
    const d = aiMsg("bot", r.length ? r.length+" articles per revisar"+(zone?" a "+zone.label:"")+":" : "No hi ha res per revisar. 👍");
    if(r.length) aiItems(d, r.slice(0,12));
    return;
  }
  const extra = words.filter(w => !(zone && (norm(zone.label).includes(w) || norm(zone.short).includes(w))) && !(loc && norm(loc).includes(w)) && !/^(articl|product|coses?|tot|totes|resum|total)/.test(w));
  if(!extra.length && (zone || loc || /total|resum|quant|articl/.test(t))){
    const d = aiMsg("bot", "Tens "+all.length+" articles"+(zone?" a "+zone.label:"")+(loc?" a "+loc:"")+" ("+all.filter(i=>DATA[i].photos.length).length+" amb foto)."
      + (!zone && !loc ? "\n\n"+CATS.map(z=>z.icon+" "+z.label+": "+DATA.filter(c=>live(c) && catsOf(c).includes(z.id)).length).join("\n") : ""));
    if(zone || loc) aiItems(d, all.slice(0,15));
    return;
  }
  const scored = all.map(i => {
    const h = SEARCH[i], name = norm(DATA[i].item);
    let sc = 0; extra.forEach(w => { const st = aiStem(w); if(name.includes(st)) sc += 3; else if(h.includes(st)) sc += 1; });
    return {i, sc};
  }).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc);
  if(!scored.length){
    const d = aiMsg("bot", "No he trobat res amb «"+text+"». Prova amb una altra paraula (marca, color, zona…).");
    aiSuggest(d, ["Què falta a la cuina?", "Què cal revisar?", "Quants articles tinc?"]);
    return;
  }
  const top = scored.filter(x=>x.sc>=scored[0].sc-1).slice(0,8).map(x=>x.i);
  const c = DATA[top[0]];
  const d = aiMsg("bot", top.length===1
    ? c.item+": en tens "+qtyBadge(c.qty).replace("×","")+", a 📍 "+locsTxt(c, " i ")+" ("+zonesTxt(c)+")."+(c.note?"\nNota: "+c.note:"")
    : "He trobat "+top.length+" coincidències. Toca'n una per veure-la:");
  aiItems(d, top);
}
function aiOpen(open){
  if(!open && typeof walleStop === "function") walleStop();
  $("aiPanel").hidden = !open; $("aiFab").setAttribute("aria-expanded", String(open));
  if(!open) return;
  if(!$("aiMsgs").children.length){
    const d = aiMsg("bot", "Hola! Pregunta'm on és una cosa, quantes en tens, què falta o què cal revisar.");
    aiSuggest(d, ["On és la raclette?", "Què falta a la cuina?", "Què cal revisar?", "Quants articles tinc?"]);
  }
  clearTimeout(aiFocusT); aiFocusT = setTimeout(() => { if(!$("aiPanel").hidden) $("aiIn").focus(); }, isTouch ? 450 : 0);
}
let aiFocusT = 0;
$("aiFab").onclick = () => aiOpen($("aiPanel").hidden);
$("aiClose").onclick = () => aiOpen(false);
$("aiPanel").addEventListener("keydown", e => { if(e.key === "Escape"){ e.stopPropagation(); aiOpen(false); $("aiFab").focus(); } });
$("aiIn").addEventListener("keydown", e => { if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); $("aiForm").requestSubmit(); } });
$("aiForm").onsubmit = e => { e.preventDefault(); const q = $("aiIn").value.trim(); if(!q) return; $("aiIn").value = ""; aiAsk(q); };

/* ---- Tots els popups caben a la pantalla: si no hi caben, es redueixen (zoom) en lloc de fer scroll ---- */
const FIT_MIN = .5;
function fitModal(d){
  if(d && d.id === "fdlg"){ if(typeof fitForm === "function") fitForm(); return; }
  if(!d || !d.open || d.classList.contains("nofit")) return;
  const vh = innerHeight - 24, vw = Math.min(460, innerWidth - 24);
  d.style.maxHeight = "none"; d.style.maxWidth = "none"; d.style.overflow = "hidden";
  let k = 1;
  for(let n = 0; n < 5; n++){
    d.style.zoom = 1; d.style.width = (vw / k) + "px";
    const nk = Math.min(1, vh / d.scrollHeight);
    if(Math.abs(nk - k) < .004){ k = nk; break; }
    k = nk;
  }
  if(k < FIT_MIN){ k = FIT_MIN; d.style.maxHeight = (vh / k) + "px"; d.style.overflow = "auto"; }
  d.style.width = (vw / k) + "px"; d.style.zoom = k;
}
function fitCard(){
  const d = $("dlg"); if(!d.classList.contains("open")) return;
  const st = $("stage"), cs = getComputedStyle(d), pg = d.querySelector(".pager");
  const avail = d.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - pg.offsetHeight - 14;
  const W = Math.min(420, d.clientWidth - 32);
  box.style.maxHeight = "none"; box.style.overflow = "hidden"; st.style.maxWidth = "none"; st.style.flex = "none";
  let k = 1;
  for(let n = 0; n < 5; n++){
    st.style.zoom = 1; st.style.width = (W / k) + "px";
    const nk = Math.min(1, avail / (box.scrollHeight + 4));
    if(Math.abs(nk - k) < .004){ k = nk; break; }
    k = nk;
  }
  if(k < FIT_MIN){ k = FIT_MIN; box.style.maxHeight = (avail / k) + "px"; box.style.overflow = "auto"; }
  st.style.width = (W / k) + "px"; st.style.zoom = k;
}
const __showModal = HTMLDialogElement.prototype.showModal;
HTMLDialogElement.prototype.showModal = function(){ __showModal.call(this); fitModal(this); requestAnimationFrame(() => fitModal(this)); };
document.querySelectorAll("dialog").forEach(d => {
  let raf = 0;
  const refit = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => fitModal(d)); };
  new MutationObserver(refit).observe(d, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:["hidden"]});
  d.addEventListener("load", refit, true);
  d.addEventListener("change", refit);
});
const __showDlg = showDlg;
showDlg = function(){ __showDlg(); fitCard(); };
const __openDlg = openDlg;
openDlg = function(i){ __openDlg(i); fitCard(); };
$("dPhoto").addEventListener("load", fitCard, true);
let fitT = 0;
addEventListener("resize", () => { clearTimeout(fitT); fitT = setTimeout(() => { document.querySelectorAll("dialog[open]").forEach(fitModal); fitCard(); }, 80); });

/* ---- Eliminar un article des de la fitxa ---- */
window.DATA_LIVE = () => DATA.filter(live);
function deleteItem(i){
  const c = DATA[i]; if(!c || c.deleted) return;
  c.deleted = true; SEARCH[i] = "";
  cloudDeleteItem(c);
  /* si venia de Pendents, torna a ser pendent */
  if(c.pkey && have[c.pkey]){ delete have[c.pkey]; store("inv_tinc", have); }
  dropCards(i);
  refreshLocs(); updateSub();
  const sec = sections.find(s => s.cat.id === c.cat); if(sec) renderPend(sec);
  render();
  return c;
}
$("dDel").onclick = () => {
  const c = DATA[cur]; if(!c) return;
  $("xName").textContent = c.item;
  $("xMeta").textContent = qtyBadge(c.qty) + " · " + zoneOf(c) + " · 📍 " + locsTxt(c, ", ") + (c.photos.length ? " · " + c.photos.length + (c.photos.length > 1 ? " fotos" : " foto") : "");
  $("xPh").innerHTML = c.photos.length ? '<img alt="" src="' + thumbSrc(c) + '">' : "📦";
  $("xdlg").showModal(); $("xCancel").focus();
};
$("xCancel").onclick = () => $("xdlg").close();

$("xOk").onclick = () => {
  const i = cur, c = deleteItem(i);
  $("xdlg").close();
  if(!c) return;
  if(!order.length){ closeDlg(); }
  else { pos = Math.min(pos, order.length - 1); cur = order[pos]; idx = 0; showDlg(); box.scrollTop = 0; }
  toast("«" + c.item + "» eliminat. Ho pots desfer des de ↶ Desfés.");
};

/* ---- Botó Crea: article, ubicació o zona de la casa ---- */
function openNewArticle(){
  const catId = state.cat !== "all" ? state.cat : CATS[0].id;
  formCtx = {catId, free:true, auto: state.cat === "all"}; formPhoto = null;
  $("fForm").reset(); fillFormSelects(catId);
  $("fTitle").textContent = "Nou article";
  if(state.loc !== "all" && LOCS.includes(state.loc)) $("fLoc").value = state.loc;
  fillMulti([], []);
  $("fQty").value = 1; $("fQty").placeholder = "";
  $("fNoteL").hidden = false; $("fNote").value = "";
  $("fOnly").hidden = true; $("fSave").textContent = "✓ Crea l'article"; $("fSave").classList.add("go"); $("fHint").hidden = true;
  formPhotoBase = '<span>Sense foto</span>'; $("fPrev").innerHTML = formPhotoBase;
  $("fdlg").showModal(); if(!isTouch) $("fName").focus(); else { try { document.activeElement.blur(); } catch(_){} }
}
function openNewLoc(){
  $("lForm").reset();
  $("lHint").textContent = "Ubicacions actuals: " + LOCS.join(", ") + ".";
  $("ldlg").showModal(); $("lName").focus();
}
function openNewZone(){
  $("zForm").reset();
  $("zHint").textContent = "Zones actuals: " + CATS.map(c=>c.label).join(", ") + ".";
  $("zdlg").showModal(); $("zName").focus();
}
$("createBtn").onclick = () => $("cdlg").showModal();
$("createFab").onclick = () => { if(!$("aiPanel").hidden) aiOpen(false); $("cdlg").showModal(); };
$("cCancel").onclick = () => $("cdlg").close();
$("cdlg").addEventListener("click", e => {
  if(e.target === $("cdlg")) return;
  const b = e.target.closest(".copt"); if(!b) return;
  $("cdlg").close();
  ({art:openNewArticle, loc:openNewLoc, zona:openNewZone})[b.dataset.c]();
});
$("lCancel").onclick = () => $("ldlg").close();
$("lForm").onsubmit = e => {
  e.preventDefault();
  const name = $("lName").value.trim().replace(/\s+/g, " ");
  if(!name) return;
  const dup = LOCS.find(l => norm(l) === norm(name));
  if(dup){ toast("La ubicació «" + dup + "» ja existeix."); $("lName").focus(); return; }
  userLocs.push(name); store("inv_locs", userLocs);
  refreshLocs(); render(); $("ldlg").close();
  toast("Ubicació «" + name + "» creada. Ja la pots triar en crear o editar articles.");
};
$("zCancel").onclick = () => $("zdlg").close();
$("zForm").onsubmit = e => {
  e.preventDefault();
  const label = $("zName").value.trim().replace(/\s+/g, " ");
  if(!label) return;
  const dup = CATS.find(c => norm(c.label) === norm(label) || norm(c.short) === norm(label));
  if(dup){ toast("La zona «" + dup.label + "» ja existeix."); $("zName").focus(); return; }
  const cat = {id:"u" + Date.now(), label, short:label, icon:$("zIcon").value};
  userCats.push(cat); store("inv_cats", userCats); CATS.push(cat); buildSection(cat);
  state.cat = cat.id; state.review = false;
  setView(view); render(); $("zdlg").close();
  toast("Zona «" + label + "» creada. Hi pots afegir pendents o articles.");
};

/* miniatura per a l'exportació .html: la que ja té l'article o, si no, una de nova */
const thumbOf = (c, k) => { const id = c._ph && c._ph[k || 0]; return id && PHT.has(id) ? Promise.resolve(PHT.get(id)) : makeThumb(c.photos[k || 0]); };

/* ---- v2.6.2: tancar tocant fora requereix dos tocs seguits ---- */
const DBL_MS = 600;
let outEl = null, outT = 0, hintT = 0;
function disarm(){ if(outEl) outEl.classList.remove("armed", "armed-ai"); outEl = null; $("tapHint").classList.remove("on"); }
function dblOut(el){
  const now = Date.now();
  if(outEl === el && now - outT < cfgGet("dbl")){ disarm(); return true; }
  disarm(); outEl = el; outT = now;
  el.classList.add(el.tagName === "DIALOG" ? "armed" : "armed-ai");
  const h = $("tapHint");
  (el.tagName === "DIALOG" && el.open ? el : document.body).appendChild(h);
  h.classList.add("on"); clearTimeout(hintT); hintT = setTimeout(disarm, cfgGet("dbl") + 400);
  return false;
}
/* ---- v2.6: visor de fotos (es tanca clicant fora de la foto) ---- */
const LB = $("lbx");
let lb = null, lbSwipe = false;
function lbShow(){
  const ph = lb.c.photos, n = ph.length;
  $("lbxImg").hidden = !n; $("lbxEmpty").hidden = !!n;
  if(n) $("lbxImg").src = ph[lb.i];
  $("lbxImg").alt = lb.c.item;
  $("lbxCap").innerHTML = esc(lb.c.item) + '<small>' + (n > 1 ? 'Foto ' + (lb.i+1) + ' de ' + n + ' · ' : '') + '📍 ' + esc(locsTxt(lb.c, ", ")) + (lb.peek ? '' : ' · toca fora de la foto per tancar') + '</small>';
  $("lbxPrev").hidden = $("lbxNext").hidden = lb.peek || n < 2;
  const id = lb.c._ph && lb.c._ph[lb.i], me = lb;
  if(id && !PHF.has(id)) fullPhoto(id).then(d => { if(d && lb === me && lb.c._ph[lb.i] === id) $("lbxImg").src = d; });
}
function lbOpen(c, i, peek){
  lb = {c, i: i || 0, peek: !!peek};
  LB.classList.toggle("peek", !!peek);
  lbShow(); LB.hidden = false;
}
function lbClose(){
  if(!lb) return;
  const was = lb; lb = null; LB.hidden = true; LB.classList.remove("peek");
  if(!was.peek && $("dlg").classList.contains("open") && DATA[cur] === was.c){ idx = was.i; showDlg(); }
}
function lbGo(d){ if(!lb || lb.peek) return; const n = lb.c.photos.length; if(n < 2) return; lb.i = (lb.i + d + n) % n; lbShow(); }
$("lbxPrev").onclick = e => { e.stopPropagation(); lbGo(-1); };
$("lbxNext").onclick = e => { e.stopPropagation(); lbGo(1); };
LB.addEventListener("click", e => {
  if(!lb || lb.peek) return;
  if(lbSwipe){ lbSwipe = false; return; }
  if(e.target === $("lbxImg")){ lbGo(1); return; }
  if(dblOut(LB)) lbClose();
});
let lsx = null;
LB.addEventListener("pointerdown", e => { lsx = e.clientX; lbSwipe = false; });
LB.addEventListener("pointerup", e => { if(lsx === null || !lb || lb.peek) return; const dx = e.clientX - lsx; lsx = null; if(Math.abs(dx) > 50 && lb.c.photos.length > 1){ lbSwipe = true; lbGo(dx < 0 ? 1 : -1); } });
document.addEventListener("keydown", e => {
  if(!lb || lb.peek) return;
  if(e.key === "Escape"){ lbClose(); }
  else if(e.key === "ArrowLeft"){ lbGo(-1); }
  else if(e.key === "ArrowRight"){ lbGo(1); }
  else return;
  e.preventDefault(); e.stopPropagation();
}, true);

/* ---- v2.6: mantenir premut un article 1 s (Imatges, Llista i Check) mostra la foto mentre es manté ---- */
const HOLD_MS = 1000;
let hold = null, peekOn = false, eatClick = false, eatT = 0;
function holdTarget(t){
  if(!t || !t.closest) return null;
  const b = t.closest("#out .card-btn[data-i]");
  if(b) return {el: b.closest("li.card") || b, i: +b.dataset.i};
  const li = t.closest("#checkview li");
  const inp = li && li.querySelector("input[data-i]");
  return inp ? {el: li, i: +inp.dataset.i} : null;
}
function holdCancel(){ if(!hold) return; clearTimeout(hold.tm); hold.el.classList.remove("holding"); hold = null; }
function eatNextClick(){ eatClick = true; clearTimeout(eatT); eatT = setTimeout(() => { eatClick = false; }, 600); }
document.addEventListener("pointerdown", e => {
  if(e.button > 0 || lb || $("dlg").classList.contains("open")) return;
  const t = holdTarget(e.target); if(!t || !DATA[t.i]) return;
  holdCancel();
  t.el.classList.add("holding");
  hold = {x: e.clientX, y: e.clientY, el: t.el, tm: setTimeout(() => {
    hold.el.classList.remove("holding"); hold.tm = 0; peekOn = true; eatNextClick();
    lbOpen(DATA[t.i], 0, true);
    if(navigator.vibrate) try { navigator.vibrate(12); } catch(_){}
  }, cfgGet("hold"))};
});
document.addEventListener("pointermove", e => {
  if(hold && hold.tm && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) holdCancel();
}, {passive: true});
function holdEnd(){
  if(peekOn){ peekOn = false; lbClose(); eatNextClick(); }
  holdCancel();
}
document.addEventListener("pointerup", holdEnd);
document.addEventListener("pointercancel", holdEnd);
addEventListener("blur", holdEnd);
addEventListener("scroll", () => { if(hold && hold.tm) holdCancel(); }, {passive: true});
document.addEventListener("touchmove", e => { if(peekOn && e.cancelable) e.preventDefault(); }, {passive: false});
document.addEventListener("contextmenu", e => { if(peekOn || holdTarget(e.target)) e.preventDefault(); });
document.addEventListener("click", e => { if(eatClick){ eatClick = false; e.preventDefault(); e.stopPropagation(); } }, true);

/* ---- v2.6: qualsevol popup es tanca clicant fora (al fons on es veu la web) ---- */
document.querySelectorAll("dialog").forEach(d => {
  let downOn = null;
  d.addEventListener("pointerdown", e => { downOn = e.target; });
  d.addEventListener("click", e => { if(e.target === d && downOn === d && d.open && dblOut(d)) d.close(); downOn = null; });
});
/* Assistent: un clic fora del panell el tanca (i no activa el que hi ha a sota) */
document.addEventListener("click", e => {
  if($("aiPanel").hidden) return;
  if(e.target.closest("#aiPanel, #aiFab, #createFab, dialog, #dlg, #lbx")) return;
  e.preventDefault(); e.stopPropagation();
  if(dblOut($("aiPanel"))) aiOpen(false);
}, true);


/* =====================================================================
   v3.0 · Sincronització en temps real amb Firebase (Firestore + Google)
   items/{id}   -> article (sense fotos; ph = llista d'ids de foto; v6: tm = miniatures)
   photos/{id}  -> {d: dataURL, it: idArticle}   (v6: es baixen d'una en una, quan cal)
   meta/state   -> pendents, zones, ubicacions, ajustos i llista de la compra
   ===================================================================== */
const ALLOWED = ["arnaubalsellsc4@gmail.com", "ainhoaguerreroalejo2@gmail.com"];
const cloudAllowed = e => ALLOWED.includes(String(e || "").toLowerCase());
const BASE_CATS = CATS.length - userCats.length;
/* ids de totes les fotos que fan servir els articles */
const phIds = () => { const s = new Set(); RAW.forEach(d => (d.ph || []).forEach(p => s.add(p))); return s; };
const PH_AVG = 180000;   /* mida mitjana estimada d'una foto completa (per als càlculs d'espai) */
let RAW = new Map(), cloudLoaded = false, cloudUser = null, itemsCache = true, itemsPending = false, cloudFail = null, importing = false;
let everServer = false, srvDown = false, inflight = 0, hadOfflinePending = false, connT = 0;
/* sense connexió: el navegador ho diu, o Firebase només serveix dades guardades al dispositiu, o no ha arribat mai al servidor */
const netOffline = () => !navigator.onLine || srvDown || (everServer && itemsCache);

/* ---- estat del botó ---- */
function cloudSetStatus(){
  const b = $("saveBtn"); b.classList.remove("sync-ok", "sync-wait", "sync-off", "sync-err", "dirty");
  let t, c;
  const pend = inflight > 0 || itemsPending || pendKeys.size > 0;
  if(cloudFail){ t = "⚠️ Error de connexió"; c = "sync-err"; }
  else if(!cloudUser){ t = "☁️ Connectant…"; c = ""; }
  else if(netOffline()){ t = pend ? "📴 Sense connexió · canvis pendents" : "📴 Sense connexió"; c = "sync-off"; }
  else if(pend){ t = "⏳ Desant…"; c = "sync-wait"; }
  else if(!cloudLoaded){ t = "⏳ Carregant…"; c = "sync-wait"; }
  else { t = "☁️ Sincronitzat"; c = "sync-ok"; }
  const sp = t.indexOf(" ");
  b.innerHTML = '<span class="ic">' + t.slice(0, sp) + '</span> <span class="tx">' + t.slice(sp + 1) + '</span>';
  if(c) b.classList.add(c);
}
function cloudErr(e){
  console.error(e);
  const code = e && e.code || "";
  cloudFail = code; cloudSetStatus();
  toast(code === "permission-denied" ? "⛔ Aquest compte no té permís per modificar l'inventari." : "⚠️ No s'ha pogut desar al núvol (" + (code || "error") + "). Torna-ho a provar.");
  setTimeout(() => { cloudFail = null; cloudSetStatus(); }, 6000);
}

/* ---- escriptures ---- */
let pendT = 0;
function cloudQueueKey(k){ pendKeys.add(k); cloudSetStatus(); clearTimeout(pendT); pendT = setTimeout(cloudFlushKeys, 40); }
function cloudFlushKeys(){
  if(!window.cloud || !pendKeys.size) return;
  const fields = [...pendKeys], data = {};
  fields.forEach(k => { data[k] = STATE[k] === undefined ? null : STATE[k]; });
  pendKeys.clear(); cloudSetStatus();
  cloud.batch([{t:"set", col:"meta", id:"state", data, fields}]).catch(cloudErr);
}
function cleanItem(c, ph){
  const o = {};
  for(const [k, v] of Object.entries(c)){
    if(["photos", "deleted", "id", "_ph", "ph", "tm"].includes(k) || v === undefined || typeof v === "function") continue;
    o[k] = v;
  }
  if(ph) o.ph = ph;
  if(typeof o.ord !== "number") o.ord = Date.now();
  return JSON.parse(JSON.stringify(o));
}
/* miniatures conegudes de les fotos d'un article */
function tmOf(ph){ const tm = {}; (ph || []).forEach(id => { if(PHT.has(id)) tm[id] = PHT.get(id); }); return tm; }
function cloudSaveItem(c){
  if(!window.cloud || !cloudUser){ toast("Sense sessió: no es pot desar."); return false; }
  if(!c.id) c.id = cloud.newId();
  const ops = [], ph = [];
  for(const u of c.photos || []){
    let pid = PHR.get(u);
    if(!pid){
      pid = cloud.newId(); PHF.set(pid, u); PHR.set(u, pid);
      if(THUMB_OF.has(u)) phSetThumb(pid, THUMB_OF.get(u));
      ops.push({t:"set", col:"photos", id:pid, data:{d:u, it:c.id}});
    }
    ph.push(pid);
  }
  c._ph = ph;
  const after = cleanItem(c, ph), tm = tmOf(ph);
  if(Object.keys(tm).length) after.tm = tm;
  histAdd({k:"item", id:c.id, before: RAW.has(c.id) ? JSON.parse(JSON.stringify(RAW.get(c.id))) : null, after});
  ops.push({t:"set", col:"items", id:c.id, data:after});
  cloud.batch(ops).catch(cloudErr);
  return true;
}
function cloudDeleteItem(c){
  if(!window.cloud || !c.id) return;
  histAdd({k:"item", id:c.id, before: RAW.has(c.id) ? JSON.parse(JSON.stringify(RAW.get(c.id))) : null, after:null});
  cloud.batch([{t:"del", col:"items", id:c.id}]).catch(cloudErr);
}

/* ---- lectures (les crida el mòdul de Firebase) ---- */
function syncObj(o, n){ Object.keys(o).forEach(k => delete o[k]); Object.assign(o, n && typeof n === "object" && !Array.isArray(n) ? JSON.parse(JSON.stringify(n)) : {}); }
function syncArr(a, n){ a.length = 0; if(Array.isArray(n)) a.push(...JSON.parse(JSON.stringify(n))); }
function cloudMeta(m){
  m = m || {};
  KEYS_CLOUD.forEach(k => { if(pendKeys.has(k)) return; const v = m[k]; STATE[k] = v == null ? undefined : JSON.parse(JSON.stringify(v)); });
  if(!pendKeys.has("inv_tinc")) syncObj(have, m.inv_tinc);
  if(!pendKeys.has("inv_pend_extra")) syncObj(extra, m.inv_pend_extra);
  if(!pendKeys.has("inv_pend_tret")) syncObj(tret, m.inv_pend_tret);
  if(!pendKeys.has("inv_locs")) syncArr(userLocs, m.inv_locs);
  if(!pendKeys.has("inv_cats")){
    syncArr(userCats, (m.inv_cats || []).filter(z => z && z.id && z.label));
    CATS.length = BASE_CATS; CATS.push(...userCats);
  }
  scheduleRebuild();
}
function cloudItems(docs, meta){
  itemsCache = meta.cache; itemsPending = meta.pending;
  if(!meta.cache){ everServer = true; srvDown = false; clearTimeout(connT); }
  if(!meta.cache || docs.length) cloudLoaded = true;
  cloudSetStatus();
  if(!meta.changed && !(cloudLoaded && !DATA.length)) return;
  RAW = new Map(docs.map(d => [d.id, d.data]));
  scheduleRebuild();
  if(!meta.cache) setTimeout(thumbMigrate, 2500);
}

/* ---- v6.0: els articles antics (o els que ha desat la v5) reben les miniatures que els falten ----
   Es fa una sola vegada per foto, en segon pla i en grups petits. No passa per ↶ Desfés. */
let tmBusy = false;
const tmFail = new Set();
const tmMissing = d => (d.ph || []).filter(p => !(d.tm && d.tm[p]) && !tmFail.has(p));
async function thumbMigrate(){
  if(tmBusy || !window.cloud || !cloudUser || !cloudLoaded || itemsCache || importing || netOffline()) return;
  const todo = [...RAW].filter(([, d]) => tmMissing(d).length);
  if(!todo.length) return;
  tmBusy = true;
  const total = todo.reduce((n, [, d]) => n + tmMissing(d).length, 0); let done = 0;
  if(total > 6) toast("🖼️ Optimitzant " + total + " fotos perquè la web vagi més ràpida. Només es fa una vegada.");
  try {
    for(let k = 0; k < todo.length; k += 6){
      const ops = [];
      for(const [id, d0] of todo.slice(k, k + 6)){
        const d = RAW.get(id); if(!d) continue;
        const tm = Object.assign({}, d.tm || {});
        Object.keys(tm).forEach(p => { if(!(d.ph || []).includes(p)) delete tm[p]; });
        for(const p of tmMissing(d)){
          let t = PHT.get(p);
          if(!t){ const full = await fullPhoto(p); t = full ? await makeThumb(full) : ""; }
          if(t){ tm[p] = t; phSetThumb(p, t); done++; } else tmFail.add(p);
        }
        if(RAW.has(id) && stable(tm) !== stable(d.tm || {})) ops.push({t:"upd", col:"items", id, data:{tm}});
      }
      if(netOffline() || importing) break;
      scheduleRebuild();   /* les targetes ja mostren les miniatures noves, encara que no s'arribin a desar */
      if(ops.length) await cloud.batch(ops);
    }
    if(total > 6 && done) toast("✓ Fotos optimitzades (" + done + ").");
  } catch(e){ console.warn("miniatures", e); }
  finally { tmBusy = false; }
}

/* ---- reconstrucció de la pantalla amb les dades del núvol ---- */
let rbT = 0, rbWait = false;
function scheduleRebuild(){
  clearTimeout(rbT);
  rbT = setTimeout(() => {
    if(importing) return;
    const a = document.activeElement;
    if(a && a.closest && a.closest("#out") && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && a.type !== "checkbox"))){
      if(!rbWait){ rbWait = true; a.addEventListener("blur", () => { rbWait = false; scheduleRebuild(); }, {once:true}); }
      return;
    }
    if(peekOn || (hold && hold.tm)){ scheduleRebuild(); return; }
    rebuildFromCloud();
  }, 60);
}
function rebuildFromCloud(){
  const list = [...RAW].map(([id, d]) => Object.assign({}, d, {id}))
    .sort((a, b) => ((+a.ord || 0) - (+b.ord || 0)) || a.id.localeCompare(b.id));
  const dlgOpen = $("dlg").classList.contains("open");
  const keepId = dlgOpen && DATA[cur] ? DATA[cur].id : null;
  DATA.length = 0; SEARCH.length = 0;
  list.forEach(c => {
    c._ph = Array.isArray(c.ph) ? c.ph.slice() : [];
    if(c.tm && typeof c.tm === "object") Object.keys(c.tm).forEach(p => phSetThumb(p, c.tm[p]));
    c.photos = c._ph.map(phUrl);
    delete c.ph; delete c.tm;
    fixItem(c); DATA.push(c); SEARCH.push(searchText(c));
  });
  refreshLocs();
  const openP = new Set([...document.querySelectorAll("#out .pend-panel:not([hidden])")].map(p => p.id));
  const doneO = new Set(sections.filter(x => x.doneOpen).map(x => x.cat.id));
  const y = scrollY;
  if(state.cat !== "all" && !CATS.some(z => z.id === state.cat)) state.cat = "all";
  if(state.loc !== "all" && !LOCS.includes(state.loc)) state.loc = "all";
  $("out").innerHTML = ""; sections.length = 0;
  buildNewSection();
  CATS.forEach(buildSection);
  sections.forEach(x => {
    if(doneO.has(x.cat.id)){ x.doneOpen = true; renderPend(x); }
    const p = x.el.querySelector(".pend-panel");
    if(p && openP.has(p.id)){ p.hidden = false; x.el.querySelector(".pend-btn").setAttribute("aria-expanded", "true"); }
  });
  setView(view); updateSub();
  scrollTo(0, y);
  if(keepId){
    const ni = DATA.findIndex(c => c.id === keepId);
    if(ni < 0){ closeDlg(); toast("Aquest article s'ha eliminat des d'un altre dispositiu."); }
    else { cur = ni; const p = order.indexOf(ni); if(p >= 0) pos = p; if(idx >= DATA[ni].photos.length) idx = 0; showDlg(); }
  }
}
const __render3 = render;
render = function(){
  __render3();
  const empty = !DATA.length;
  if(empty) $("none").hidden = true;
  $("emptyCloud").hidden = !(empty && cloudLoaded && cloudUser);
  if(empty) $("sub").textContent = cloudLoaded ? "Encara no hi ha cap article al núvol." : "Carregant l'inventari…";
};

/* ---- sessió ---- */
function gate(mode, msg){
  const g = $("gate");
  g.hidden = mode === "ok";
  $("gMsg").textContent = msg || "";
  $("gIn").hidden = mode !== "in";
  $("gOut").hidden = mode !== "denied";
  document.body.classList.toggle("lock", mode !== "ok" || $("dlg").classList.contains("open"));
}
function cloudAuth(u){
  cloudUser = null; cloudLoaded = false; everServer = false; srvDown = false; clearTimeout(connT);
  if(!u){ gate("in", "Inicia sessió amb el teu compte de Google per veure i editar l'inventari."); cloudSetStatus(); return; }
  if(!cloudAllowed(u.email)){ gate("denied", "El compte " + u.email + " no té accés a aquest inventari."); cloudSetStatus(); return; }
  cloudUser = u; gate("ok"); cloudSetStatus(); render();
  connT = setTimeout(() => { if(!everServer){ srvDown = true; cloudSetStatus(); } }, 8000);
}
function cloudReady(){ gate("wait", "Comprovant la sessió…"); }
function cloudBootFail(e){
  console.error(e);
  gate("wait", "No s'ha pogut carregar Firebase. Revisa la connexió a internet i torna a obrir la pàgina.");
}
$("gIn").onclick = async () => {
  $("gIn").disabled = true; $("gMsg").textContent = "Obrint Google…";
  try { await cloud.signIn(); }
  catch(e){
    const c = e && e.code || "";
    $("gMsg").textContent = c === "auth/popup-blocked" ? "El navegador ha bloquejat la finestra. Permet les finestres emergents i torna-ho a provar."
      : c === "auth/unauthorized-domain" ? "Aquest domini no està autoritzat a Firebase (Authentication → Dominis autoritzats)."
      : /cancelled|closed/.test(c) ? "Inici de sessió cancel·lat." : "No s'ha pogut iniciar la sessió (" + (c || "error") + ").";
  }
  $("gIn").disabled = false;
};
$("gOut").onclick = () => cloud.signOut();

/* ---- menú del núvol: exportar, importar, tancar sessió ---- */
$("saveBtn").onclick = () => {
  $("sInfo").textContent = (cloudUser ? "Sessió: " + cloudUser.email + " · " : "") + DATA.length + " articles · " + phIds().size + " fotos al núvol.";
  $("sdlg").showModal();
};
$("sClose").onclick = () => $("sdlg").close();
$("sOut").onclick = () => { $("sdlg").close(); cloud.signOut(); };
$("sExp").onclick = () => { $("sdlg").close(); cloudExport(); };
$("eImp").onclick = () => $("impIn").click();
function parseBackup(text){
  text = String(text).replace(/^\uFEFF/, "");
  let items, keys = {};
  const m0 = text.indexOf('id="inv-data"');
  if(m0 >= 0){
    /* còpia exportada en .html (v3.6+): les dades són dins d'un bloc JSON */
    const a0 = text.indexOf(">", m0) + 1, b0 = text.indexOf("<" + "/script>", a0);
    if(a0 <= 0 || b0 < 0) throw new Error("Còpia incompleta");
    const j = JSON.parse(text.slice(a0, b0)); items = j.items; keys = j.keys || {};
  } else if(/^\s*\{/.test(text)){
    const j = JSON.parse(text); items = j.items; keys = j.keys || {};
  } else {
    const d0 = text.indexOf("\nconst DATA = "); if(d0 < 0) throw new Error("No és un fitxer de l'inventari");
    const d1 = text.indexOf(";\n", d0 + 14); items = JSON.parse(text.slice(d0 + 14, d1));
    const s0 = text.indexOf("\nconst SAVED = ");
    if(s0 >= 0){ const sv = JSON.parse(text.slice(s0 + 15, text.indexOf(";\n", s0 + 15))); keys = sv && sv.keys || {}; }
  }
  if(!Array.isArray(items)) throw new Error("Format desconegut");
  items = items.filter(c => c && typeof c === "object" && !c.deleted);
  return {items, keys};
}
function impShow(t, p){ $("impBar").hidden = false; $("impTxt").textContent = t; $("impFill").style.width = Math.round((p || 0) * 100) + "%"; }
async function shrinkPhoto(u){
  if(typeof u !== "string" || !u.startsWith("data:image")) return null;
  if(u.length <= PHOTO_MAX_CHARS) return u;
  return new Promise(res => { const im = new Image(); im.onload = () => { try { res(photoJpeg(im, im.naturalWidth || im.width, im.naturalHeight || im.height)); } catch(e){ res(null); } }; im.onerror = () => res(null); im.src = u; });
}
$("impIn").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  let pk;
  try { pk = parseBackup(await f.text()); } catch(err){ toast("⚠️ Aquest fitxer no és una còpia vàlida de l'inventari."); return; }
  const nPh = pk.items.reduce((n, c) => n + (Array.isArray(c.photos) ? c.photos.length : 0), 0);
  if(!pk.items.length){ toast("El fitxer no té cap article."); return; }
  if(!navigator.onLine){ toast("Cal connexió a internet per importar."); return; }
  if(!confirm("Importar «" + f.name + "»?\n\n" + pk.items.length + " articles i " + nPh + " fotos.\n" + (DATA.length ? "⚠️ Se substituiran els " + DATA.length + " articles que hi ha ara al núvol (també als altres dispositius) i s'esborrarà l'historial de canvis." : "El núvol ara és buit."))) return;
  importing = true;
  try {
    impShow("Preparant…", 0);
    const ops = [], old = await cloud.allPhotos();
    [...RAW.keys()].forEach(id => ops.push({t:"del", col:"items", id}));
    [...old.keys()].forEach(id => ops.push({t:"del", col:"photos", id}));
    HIST.forEach(h => ops.push({t:"del", col:"hist", id:h.id}));
    for(let k = 0; k < pk.items.length; k++){
      impShow("Preparant les fotos… " + (k + 1) + " / " + pk.items.length, .3 * k / pk.items.length);
      const c = fixItem(Object.assign({}, pk.items[k])), id = cloud.newId(), ph = [], tm = {};
      for(const u0 of c.photos){
        const u = await shrinkPhoto(u0); if(!u) continue;
        const pid = cloud.newId(); ph.push(pid); ops.push({t:"set", col:"photos", id:pid, data:{d:u, it:id}});
        const t = THUMB_OF.get(u) || await makeThumb(u); if(t) tm[pid] = t;
      }
      c.ord = k; const data = cleanItem(c, ph); if(Object.keys(tm).length) data.tm = tm;
      ops.push({t:"set", col:"items", id, data});
    }
    const meta = {};
    KEYS_CLOUD.forEach(k => { const v = pk.keys[k]; meta[k] = v != null ? v : (k === "inv_cats" || k === "inv_locs" ? [] : k === "inv_cfg" ? (cfgDeep(cfgRaw()) || {}) : {}); });
    ops.push({t:"set", col:"meta", id:"state", data:meta});
    await cloud.batch(ops, (d, t) => impShow("Pujant al núvol… " + d + " / " + t, d / t));
    impShow("✓ Importació completa", 1);
    toast("✓ Importats " + pk.items.length + " articles i " + nPh + " fotos.");
  } catch(err){
    console.error(err); toast("⚠️ La importació ha fallat (" + (err && err.code || "error") + "). Torna-ho a provar: el fitxer original no s'ha tocat.");
  } finally {
    importing = false; setTimeout(() => { $("impBar").hidden = true; }, 1800); scheduleRebuild();
  }
};

/* =====================================================================
   v3.1 · Historial de canvis i desfer (compartit entre dispositius)
   hist/{id} -> {ts, who, label, parts:[{k:"item",id,before,after} | {k:"meta",f,before,after}], undone, of}
   ===================================================================== */
let HIST_MAX = 100;
const WHO = {"arnaubalsellsc4@gmail.com":"Arnau", "ainhoaguerreroalejo2@gmail.com":"Ainhoa"};
let HIST = [], histLoaded = false, HG = null, histBusy = false, hcTarget = null, HTAG = "";
const deep = o => o == null ? null : JSON.parse(JSON.stringify(o));
function stable(o){
  if(o === undefined || o === null) return "null";
  if(Array.isArray(o)) return "[" + o.map(stable).join(",") + "]";
  if(typeof o === "object") return "{" + Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + stable(o[k])).join(",") + "}";
  return JSON.stringify(o);
}
/* v6: les miniatures (tm) no es guarden a l'historial: ocuparien massa */
const noTm = o => { if(!o || !o.tm) return o; const r = Object.assign({}, o); delete r.tm; return r; };
function histAdd(p){
  if(importing || histBusy || !cloudUser) return;
  if(p.k === "item") p = Object.assign({}, p, {before:noTm(p.before), after:noTm(p.after)});
  if(!HG){ HG = {parts:[], tag:HTAG}; setTimeout(histFlush, 400); }
  const ex = HG.parts.find(x => x.k === p.k && (p.k === "item" ? x.id === p.id : x.f === p.f));
  if(ex) ex.after = p.after; else HG.parts.push(p);
}
const pendName = key => {
  const cat = String(key).split(":")[0];
  const r = pendRows(cat).find(x => x.key === key);
  if(r) return r.name;
  const k = String(key).split(":")[1];
  return pendBase(cat)[+k] || key;
};
const catName = id => (CATS.find(z => z.id === id) || {}).label || id;
function partLabel(p){
  const b = p.before, a = p.after;
  if(p.k === "item"){
    if(!b && a) return "➕ Nou article «" + a.item + "»";
    if(b && !a) return "🗑️ Eliminat «" + b.item + "»";
    if(!a) return "";
    const ch = [];
    if(b.item !== a.item) ch.push("nom «" + b.item + "» → «" + a.item + "»");
    if(String(b.qty) !== String(a.qty)) ch.push("quantitat " + b.qty + " → " + a.qty);
    if(stable(b.locs) !== stable(a.locs) || b.loc !== a.loc) ch.push("ubicació → " + (a.locs || [a.loc]).join(", "));
    if(b.cat !== a.cat || stable(b.cats) !== stable(a.cats)) ch.push("zona → " + (a.cats || [a.cat]).map(catName).join(", "));
    if((b.desc || "") !== (a.desc || "")) ch.push("descripció");
    if((b.note || "") !== (a.note || "") && !/Revisat i correcte$/.test(a.note || "")) ch.push("nota");
    const nb = (b.ph || []).length, na = (a.ph || []).length;
    if(na > nb) ch.push("+" + (na - nb) + (na - nb > 1 ? " fotos" : " foto"));
    else if(na < nb) ch.push("foto treta");
    else if(stable(b.ph) !== stable(a.ph)) ch.push("foto canviada");
    if(!!b.nouVist !== !!a.nouVist) ch.push(a.nouVist ? "NEW tret" : "NEW restaurat");
    if(!ch.length && (b.estado !== a.estado || b.fiab !== a.fiab || (b.note || "") !== (a.note || ""))) ch.push("marcat com a correcte");
    return "✎ «" + a.item + "»: " + (ch.join(", ") || "editat");
  }
  const L = [];
  if(p.f === "inv_tinc" || p.f === "inv_pend_tret"){
    const B = b || {}, A = a || {};
    new Set([...Object.keys(B), ...Object.keys(A)]).forEach(k => {
      if(stable(B[k]) === stable(A[k])) return;
      if(p.f === "inv_tinc") L.push((A[k] ? "☑ Pendent aconseguit «" : "↩ Torna a pendents «") + pendName(k) + "»");
      else L.push((A[k] ? "✕ Pendent suggerit tret «" : "↺ Pendent suggerit restaurat «") + pendName(k) + "»");
    });
  } else if(p.f === "inv_pend_extra"){
    const B = b || {}, A = a || {};
    new Set([...Object.keys(B), ...Object.keys(A)]).forEach(c => {
      const bl = B[c] || [], al = A[c] || [];
      al.filter(x => !bl.some(y => y.id === x.id)).forEach(x => L.push("➕ Pendent afegit «" + x.name + "»"));
      bl.filter(x => !al.some(y => y.id === x.id)).forEach(x => L.push("✕ Pendent eliminat «" + x.name + "»"));
    });
  } else if(p.f === "inv_cats"){
    const bl = b || [], al = a || [];
    al.filter(x => !bl.some(y => y.id === x.id)).forEach(x => L.push("🏠 Zona creada «" + x.label + "»"));
    bl.filter(x => !al.some(y => y.id === x.id)).forEach(x => L.push("🏠 Zona eliminada «" + x.label + "»"));
  } else if(p.f === "inv_locs"){
    const bl = b || [], al = a || [];
    al.filter(x => !bl.includes(x)).forEach(x => L.push("📍 Ubicació creada «" + x + "»"));
    bl.filter(x => !al.includes(x)).forEach(x => L.push("📍 Ubicació eliminada «" + x + "»"));
  } else if(p.f === "inv_cfg"){
    L.push(cfgLabels(b, a));
  } else if(p.f === "inv_theme"){
    L.push(themeLabels(b, a));
  } else if(p.f === "inv_locicons"){
    const B = b || {}, A = a || {}, nm = k => (LOCICONS[k] ? LOCICONS[k].n : "automàtica");
    new Set([...Object.keys(B), ...Object.keys(A)]).forEach(k => { if(stable(B[k]) !== stable(A[k])) L.push("🖼️ Icona de «" + k + "»: " + nm(B[k]) + " → " + nm(A[k])); });
  } else if(p.f === "inv_compra"){
    const B = b || {}, A = a || {}, G = {"🛒 A la compra":[], "🛒 Tret de la compra":[], "🛒 Comprat":[], "🛒 Torna a la compra":[]};
    new Set([...Object.keys(B), ...Object.keys(A)]).forEach(k => {
      const x = A[k], y = B[k];
      if(stable(x) === stable(y)) return;
      if(x && !y) G["🛒 A la compra"].push(x.n);
      else if(!x && y) G["🛒 Tret de la compra"].push(y.n);
      else if(x.d && !y.d) G["🛒 Comprat"].push(x.n);
      else if(!x.d && y.d) G["🛒 Torna a la compra"].push(x.n);
    });
    Object.keys(G).forEach(t => { const n = G[t]; if(n.length) L.push(t + " «" + n.slice(0, 3).join("», «") + "»" + (n.length > 3 ? " i " + (n.length - 3) + " més" : "")); });
  }
  return L.join(" · ");
}
function histFlush(){
  const g = HG; HG = null;
  if(!g || !window.cloud || !cloudUser) return;
  const parts = g.parts.filter(p => stable(p.before) !== stable(p.after));
  if(!parts.length) return;
  const labels = parts.map(partLabel).filter(Boolean);
  if(!labels.length) return;
  const label = (g.tag || "") + [...new Set(labels)].join(" · ");
  cloud.batch([{t:"set", col:"hist", id:cloud.newId(), data:{ts:Date.now(), who:cloudUser.email, label, parts, undone:false}}]).catch(cloudErr);
}
/* Desfà un canvi de pendents/zones/ubicacions sense trepitjar els canvis posteriors */
function metaRevert(f, b, a, cur, keepCats){
  cur = deep(cur);
  if(f === "inv_cfg"){
    const o = cur && typeof cur === "object" && !Array.isArray(cur) ? cur : {}, B = cfgFlat(b), A = cfgFlat(a);
    new Set([...Object.keys(B), ...Object.keys(A)]).forEach(p => { if(stable(B[p]) !== stable(A[p])) cfgSet(o, p, B[p]); });
    return o;
  }
  if(f === "inv_tinc" || f === "inv_pend_tret" || f === "inv_theme" || f === "inv_locicons" || f === "inv_compra"){
    const o = cur && typeof cur === "object" && !Array.isArray(cur) ? cur : {}, B = b || {}, A = a || {};
    new Set([...Object.keys(B), ...Object.keys(A)]).forEach(k => { if(stable(B[k]) === stable(A[k])) return; if(B[k] === undefined) delete o[k]; else o[k] = deep(B[k]); });
    return o;
  }
  if(f === "inv_pend_extra"){
    const o = cur && typeof cur === "object" && !Array.isArray(cur) ? cur : {}, B = b || {}, A = a || {};
    new Set([...Object.keys(B), ...Object.keys(A)]).forEach(c => {
      const bl = B[c] || [], al = A[c] || [];
      let l = (o[c] || []).filter(x => !(al.some(y => y.id === x.id) && !bl.some(y => y.id === x.id)));
      bl.forEach(x => { if(!al.some(y => y.id === x.id) && !l.some(y => y.id === x.id)) l.push(deep(x)); });
      o[c] = l;
    });
    return o;
  }
  const key = f === "inv_cats" ? x => x.id : x => x;
  const bl = b || [], al = a || [];
  let l = Array.isArray(cur) ? cur : [];
  l = l.filter(x => !(al.some(y => key(y) === key(x)) && !bl.some(y => key(y) === key(x))) || (f === "inv_cats" && keepCats.has(x.id)));
  bl.forEach(x => { if(!al.some(y => key(y) === key(x)) && !l.some(y => key(y) === key(x))) l.push(deep(x)); });
  return l;
}
async function histUndo(h){
  if(!window.cloud || !cloudUser) return;
  const ops = [], parts = [], mdata = {}, fields = [];
  const gone = new Set(h.parts.filter(p => p.k === "item" && !p.before).map(p => p.id));
  const keepCats = new Set();
  DATA.filter(c => live(c) && !gone.has(c.id)).forEach(c => catsOf(c).forEach(z => keepCats.add(z)));
  h.parts.forEach(p => {
    if(p.k === "item"){
      const cur = RAW.has(p.id) ? deep(RAW.get(p.id)) : null;
      if(p.before){
        /* l'historial no guarda les miniatures: es tornen a posar les que ja es coneixen */
        const data = deep(p.before), tm = tmOf(data.ph); delete data.tm;
        if(Object.keys(tm).length) data.tm = tm;
        ops.push({t:"set", col:"items", id:p.id, data});
      }
      else ops.push({t:"del", col:"items", id:p.id});
      parts.push({k:"item", id:p.id, before:noTm(cur), after:noTm(deep(p.before))});
    } else {
      const cur = STATE[p.f] === undefined ? null : deep(STATE[p.f]);
      const nv = metaRevert(p.f, p.before, p.after, cur, keepCats);
      mdata[p.f] = nv; fields.push(p.f);
      parts.push({k:"meta", f:p.f, before:cur, after:deep(nv)});
    }
  });
  if(fields.length) ops.push({t:"set", col:"meta", id:"state", data:mdata, fields});
  const real = parts.filter(p => stable(p.before) !== stable(p.after));
  if(real.length) ops.push({t:"set", col:"hist", id:cloud.newId(), data:{ts:Date.now(), who:cloudUser.email, label:"↶ Desfet: " + h.label.replace(/^↶ Desfet: /, ""), parts:real, undone:false, of:h.id}});
  ops.push({t:"set", col:"hist", id:h.id, data:{undone:true}, fields:["undone"]});
  if(h.of && HIST.some(x => x.id === h.of)) ops.push({t:"set", col:"hist", id:h.of, data:{undone:false}, fields:["undone"]});
  histBusy = true;
  try { await cloud.batch(ops); toast("↶ Desfet: " + h.label.replace(/^↶ Desfet: /, "")); }
  catch(e){ cloudErr(e); }
  finally { histBusy = false; }
}
/* Les fotos que ja no fa servir cap article ni cap canvi de l'historial s'esborren.
   v6: només es miren les fotos dels canvis que surten de l'historial (no cal baixar-les totes). */
const histPh = list => { const s = new Set(); list.forEach(h => (h.parts || []).forEach(p => { if(p.k === "item") [p.before, p.after].forEach(o => o && (o.ph || []).forEach(x => s.add(x))); })); return s; };
function histGC(keep, old){
  if(!window.cloud || !cloudLoaded || itemsCache || !histLoaded || importing) return;
  const ref = histPh(keep);
  phIds().forEach(x => ref.add(x));
  DATA.forEach(c => (c._ph || []).forEach(x => ref.add(x)));
  const dead = [...histPh(old)].filter(x => !ref.has(x));
  if(dead.length) cloud.batch(dead.map(id => ({t:"del", col:"photos", id}))).catch(() => {});
}
function cloudHist(docs){
  HIST = docs.filter(h => h && Array.isArray(h.parts)).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  histLoaded = true;
  if(HIST.length > HIST_MAX && !importing){
    const keep = HIST.slice(0, HIST_MAX), old = HIST.slice(HIST_MAX);
    cloud.batch(old.map(h => ({t:"del", col:"hist", id:h.id}))).then(() => histGC(keep, old)).catch(() => {});
  }
  histBadge();
  if($("hdlg").open) histRender();
}
/* v3.8: el número del botó només compta els canvis fets durant el dia en curs (la llista de ↶ Desfés els té tots) */
const isToday = ts => new Date(ts).toDateString() === new Date().toDateString();
function histBadge(){
  const n = HIST.filter(h => !h.undone && isToday(h.ts)).length;
  $("histN").hidden = !n; $("histN").textContent = n > 99 ? "99+" : n;
  $("histBtn").title = n ? "Desfés · " + n + (n > 1 ? " canvis d'avui" : " canvi d'avui") : "Historial de canvis: desfés el que has fet";
}
let dayT = 0;
function histDayTimer(){   /* a mitjanit el número torna a 0 */
  clearTimeout(dayT);
  const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 2);
  dayT = setTimeout(() => { histBadge(); histDayTimer(); }, Math.max(1000, next - n));
}
histDayTimer();
document.addEventListener("visibilitychange", () => { if(!document.hidden) histBadge(); });
const whoName = e => WHO[e] || String(e || "").split("@")[0];
function ago(ts){
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if(s < 50) return "ara mateix";
  if(s < 3600) return "fa " + Math.round(s / 60) + " min";
  if(s < 86400) return "fa " + Math.round(s / 3600) + " h";
  const d = new Date(ts);
  return d.toLocaleDateString("ca", {day:"2-digit", month:"2-digit"}) + " " + d.toLocaleTimeString("ca", {hour:"2-digit", minute:"2-digit"});
}
function histRender(){
  const ul = $("hList");
  if(!histLoaded){ ul.innerHTML = '<li class="hempty">Carregant l\'historial…</li>'; return; }
  if(!HIST.length){ ul.innerHTML = '<li class="hempty">Encara no hi ha cap canvi.<br>Quan editis, creïs o eliminis alguna cosa, apareixerà aquí.</li>'; return; }
  ul.innerHTML = HIST.slice(0, HIST_MAX).map(h => '<li class="hi' + (h.undone ? ' undone' : '') + '"><div class="htx"><b>' + esc(h.label) + '</b><small>' + esc(ago(h.ts) + " · " + whoName(h.who)) + '</small></div>'
    + (h.undone ? '<span class="hdone">Desfet</span>' : '<button type="button" class="hund" data-id="' + esc(h.id) + '">↶ Desfés</button>') + '</li>').join("");
}
$("histBtn").onclick = () => { histRender(); $("hdlg").showModal(); };
$("hClose").onclick = () => $("hdlg").close();
$("hList").addEventListener("click", e => {
  const b = e.target.closest(".hund"); if(!b) return;
  const h = HIST.find(x => x.id === b.dataset.id); if(!h || h.undone) return;
  hcTarget = h.id;
  $("hcLabel").textContent = h.label;
  $("hcWhen").textContent = "Fet " + ago(h.ts) + " per " + whoName(h.who) + ".";
  const ids = new Set(h.parts.filter(p => p.k === "item").map(p => p.id));
  const later = HIST.filter(x => x.ts > h.ts && !x.undone && x.parts.some(p => p.k === "item" && ids.has(p.id))).length;
  $("hcWarn").hidden = !later;
  $("hcWarn").textContent = later ? "⚠️ Després d'aquest canvi n'hi ha " + later + (later > 1 ? " més" : " més") + " sobre el mateix article. Es tornarà a l'estat d'abans d'aquest canvi i també es perdran." : "";
  $("hcdlg").showModal();
});
$("hcNo").onclick = () => { hcTarget = null; $("hcdlg").close(); };
$("hcYes").onclick = async () => {
  const h = HIST.find(x => x.id === hcTarget); hcTarget = null;
  $("hcdlg").close();
  if(h && !h.undone) await histUndo(h);
};


/* =====================================================================
   v3.2 · Xat entre NAU (arnaubalsellsc4) i NOA (ainhoaguerreroalejo2)
   chat/{id}        -> {ts, from, text}
   chatread/{nau|noa} -> {ts}   (últim missatge vist per cada persona)
   El xat NO passa mai pel registre de «Desfés».
   ===================================================================== */
const CHAT_NAME = {"arnaubalsellsc4@gmail.com":"NAU", "ainhoaguerreroalejo2@gmail.com":"NOA"};
const chatName = e => CHAT_NAME[String(e || "").toLowerCase()] || String(e || "?").split("@")[0].toUpperCase();
let CHAT = [], chatLoaded = false, chatReadLoaded = false, chatReads = {}, chatSeen = new Set(), chatBoot = 0, chatNew = 0;
const chatMe = () => cloudUser ? String(cloudUser.email).toLowerCase() : "";
const chatMyKey = () => chatName(chatMe()).toLowerCase();
const chatOtherKey = () => { const o = ALLOWED.map(e => chatName(e).toLowerCase()).find(k => k !== chatMyKey()); return o || ""; };
const chatMyRead = () => +(chatReads[chatMyKey()] || 0);
function chatUnread(){
  if(!cloudUser || !chatLoaded || !chatReadLoaded) return 0;
  const t = chatMyRead(), me = chatMe();
  return CHAT.filter(m => m.from !== me && m.ts > t).length;
}
function chatBadge(){
  const n = chatUnread(), b = $("chatN");
  b.hidden = !n; b.textContent = n > 99 ? "99+" : n;
  $("chatBtn").title = n ? "Xat · " + n + (n > 1 ? " missatges sense llegir" : " missatge sense llegir") : "Xat entre NAU i NOA";
  document.title = (n ? "(" + n + ") " : "") + "Inventari de casa";
}
function chatReset(){
  CHAT = []; chatLoaded = false; chatReadLoaded = false; chatReads = {}; chatSeen = new Set(); chatBoot = 0; chatNew = 0;
  if($("chdlg").open) $("chdlg").close();
  chatBadge();
}
const __cloudAuth32 = cloudAuth;
cloudAuth = function(u){ chatReset(); __cloudAuth32(u); };

/* ---- dades que arriben del núvol ---- */
function cloudChat(docs){
  const first = !chatLoaded;
  CHAT = docs.map(d => ({id: d.id, ts: +d.ts || 0, from: String(d.from || "").toLowerCase(), text: String(d.text == null ? "" : d.text), pending: !!d.pending}))
    .sort((a, b) => (a.ts - b.ts) || a.id.localeCompare(b.id));
  chatLoaded = true;
  const open = $("chdlg").open, me = chatMe();
  if(first){ chatBoot = Date.now() - 30000; CHAT.forEach(m => chatSeen.add(m.id)); }
  else {
    const fresh = CHAT.filter(m => !chatSeen.has(m.id));
    fresh.forEach(m => chatSeen.add(m.id));
    const inc = fresh.filter(m => m.from !== me && m.ts > chatBoot);
    if(inc.length && !open){
      const m = inc[inc.length - 1];
      chatBeep();
      toast("💬 " + chatName(m.from) + ": " + (m.text.length > 70 ? m.text.slice(0, 70) + "…" : m.text));
    }
    if(open) chatNew += inc.length;
  }
  chatBadge();
  if(open){ chatRender(); chatMarkRead(); }
  chatTrim();
}
function cloudChatRead(docs){
  docs.forEach(d => { chatReads[d.id] = Math.max(+chatReads[d.id] || 0, +d.ts || 0); });
  chatReadLoaded = true;
  chatBadge();
  if($("chdlg").open){ chatMarkRead(); chatRender(); }
}
function chatMarkRead(){
  if(!cloudUser || !chatLoaded || !$("chdlg").open || !window.cloud || !CHAT.length) return;
  const mx = CHAT[CHAT.length - 1].ts;
  if(mx > chatMyRead()){
    chatReads[chatMyKey()] = mx; chatBadge();
    cloud.batch([{t:"set", col:"chatread", id:chatMyKey(), data:{ts:mx}}]).catch(() => {});
  }
}

/* ---- pintar els missatges ---- */
const CH_EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\s)+$/u;
function chatLinks(t){ return esc(t).replace(/(https?:\/\/[^\s<]+)/g, u => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>'); }
function chatDay(ts){
  const d = new Date(ts), t = new Date(), y = new Date(Date.now() - 864e5);
  if(d.toDateString() === t.toDateString()) return "Avui";
  if(d.toDateString() === y.toDateString()) return "Ahir";
  return d.toLocaleDateString("ca", {weekday:"long", day:"numeric", month:"long"});
}
const chatHM = ts => new Date(ts).toLocaleTimeString("ca", {hour:"2-digit", minute:"2-digit"});
function chatRender(forceBottom){
  const ul = $("chList"), me = chatMe();
  const dist = ul.scrollHeight - ul.scrollTop - ul.clientHeight;
  const stick = !!forceBottom || dist < 90 || !ul.children.length;
  if(!CHAT.length){
    ul.innerHTML = '<div class="chempty"><b>👋</b>Encara no hi ha missatges.<br>Escriu el primer!</div>';
    return;
  }
  const otherRead = +(chatReads[chatOtherKey()] || 0);
  let h = "", lastDay = "";
  CHAT.forEach((m, i) => {
    const day = new Date(m.ts).toDateString();
    if(day !== lastDay){ h += '<div class="chday"><span>' + esc(chatDay(m.ts)) + '</span></div>'; lastDay = day; }
    const prev = CHAT[i - 1], mine = m.from === me, who = chatName(m.from), k = who.toLowerCase();
    const grp = !!prev && new Date(prev.ts).toDateString() === day && prev.from === m.from && m.ts - prev.ts < 300000;
    const big = CH_EMOJI_ONLY.test(m.text) && (m.text.match(/\p{Extended_Pictographic}/gu) || []).length <= 3;
    const tick = mine ? '<span class="tk' + (otherRead >= m.ts ? ' seen' : '') + '" title="' + (m.pending ? 'Enviant…' : otherRead >= m.ts ? 'Vist' : 'Enviat') + '">' + (m.pending ? "🕓" : otherRead >= m.ts ? "✓✓" : "✓") + '</span>' : "";
    h += '<div class="cm ' + (mine ? "me" : "ot") + (grp ? " grp" : "") + '">'
      + '<span class="cm-av ' + k + (grp ? " ghost" : "") + '" aria-hidden="true">' + esc(who) + '</span>'
      + '<div class="cm-b">' + (grp ? "" : '<span class="cm-n ' + k + '">' + esc(who) + '</span>')
      + '<div class="cm-t' + (big ? " big" : "") + '">' + chatLinks(m.text) + '<span class="cm-m">' + chatHM(m.ts) + tick + '</span></div></div></div>';
  });
  ul.innerHTML = h;
  if(stick){ ul.scrollTop = ul.scrollHeight; chatNew = 0; $("chJump").hidden = true; }
  else if(chatNew > 0){ $("chJump").hidden = false; }
}
$("chList").addEventListener("scroll", () => {
  const u = $("chList");
  if(u.scrollHeight - u.scrollTop - u.clientHeight < 90){ chatNew = 0; $("chJump").hidden = true; }
}, {passive: true});
$("chJump").onclick = () => { const u = $("chList"); u.scrollTop = u.scrollHeight; chatNew = 0; $("chJump").hidden = true; };

/* ---- enviar ---- */
function chatGrow(){ const t = $("chIn"); t.style.height = "44px"; t.style.height = Math.min(120, Math.max(44, t.scrollHeight)) + "px"; }
function chatSyncSend(){ $("chSend").disabled = !$("chIn").value.trim(); }
function chatSend(){
  const ta = $("chIn"), text = ta.value.trim();
  if(!text || !cloudUser || !window.cloud) return;
  ta.value = ""; chatGrow(); chatSyncSend();
  $("chEmoji").hidden = true; $("chEmBtn").setAttribute("aria-expanded", "false");
  cloud.batch([{t:"set", col:"chat", id:cloud.newId(), data:{ts:Date.now(), from:chatMe(), text}}]).catch(cloudErr);
  const u = $("chList"); u.scrollTop = u.scrollHeight;
  ta.focus();
}
$("chForm").onsubmit = e => { e.preventDefault(); chatSend(); };
$("chIn").addEventListener("input", () => { chatGrow(); chatSyncSend(); });
$("chIn").addEventListener("keydown", e => {
  if(e.key === "Enter" && !e.shiftKey && !isTouch && !e.isComposing){ e.preventDefault(); chatSend(); }
});

/* ---- emoticones ---- */
const EMO = [
  ["😊", "Cares", "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😋 😛 😜 🤪 😝 🤗 🤭 🤔 🤨 😐 😑 😶 🙄 😏 😣 😥 😮 🤐 😯 😪 😫 🥱 😴 😎 🤓 🥳 🤩 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 😰 🤒 🤕 🥴 🤢 😷 🤠 😈 💀 👻 🤖"],
  ["👍", "Mans", "👍 👎 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 👏 🙌 🤝 🙏 💪 🫶 🫡 🤷 🙋 🙆 🙅 🤦 💃 🕺"],
  ["❤️", "Cors i festa", "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 ✨ ⭐ 🌟 💫 🔥 💯 ✅ ❌ ⚠️ ❓ ❗ 🎉 🎊 🎁 🎂 🥂 🍾 🏆 🥇"],
  ["🏠", "Casa", "🏠 🛋️ 🛏️ 🚽 🛁 🚿 🍳 🍽️ 🧽 🧺 🧰 🔌 💡 🔑 🚪 🪑 📦 🛒 🧹 🪴 🔧 🔨 🪜 🧴 🧻 🧼 🪣 🗑️ 📺 📱 💻 🖥️ 🎮 ⏰ 📅 📷"],
  ["🍕", "Menjar", "🍕 🍔 🍟 🌭 🌮 🌯 🍝 🍣 🍜 🥗 🥘 🍳 🥐 🥖 🧀 🥩 🍗 🍰 🍪 🍫 🍿 ☕ 🍵 🍺 🍷 🥤 🍎 🍌 🍇 🍉 🍓 🥑"],
  ["🚗", "Viatges", "🚗 🚙 🚲 🛵 ✈️ 🚆 🚌 ⛽ 🅿️ 📍 🗺️ 🧭 🏔️ ⛰️ ❄️ ⛷️ 🏖️ 🌞 ☀️ ⛅ 🌧️ ⛈️ 🌈 🌙 🐶 🐱 🐾 🌿 🌸"]
];
const emoRecent = () => { try { return JSON.parse(localStorage.getItem("inv_emoji_recent") || "[]").slice(0, 24); } catch(e){ return []; } };
let emoTab = 1;
function emoRender(){
  const tabs = [["🕘", "Recents"]].concat(EMO.map(t => [t[0], t[1]]));
  $("chTabs").innerHTML = tabs.map((t, i) => '<button type="button" class="chtab" role="tab" aria-selected="' + (i === emoTab) + '" title="' + esc(t[1]) + '" data-t="' + i + '">' + t[0] + '</button>').join("");
  const list = emoTab === 0 ? emoRecent() : EMO[emoTab - 1][2].split(" ");
  $("chGrid").innerHTML = list.length ? list.map(e => '<button type="button" data-e="' + e + '" aria-label="' + e + '">' + e + '</button>').join("") : '<p class="chnone">Aquí sortiran les emoticones que facis servir més.</p>';
  $("chGrid").scrollTop = 0;
}
$("chTabs").addEventListener("click", e => { const b = e.target.closest(".chtab"); if(!b) return; emoTab = +b.dataset.t; emoRender(); });
$("chGrid").addEventListener("click", e => {
  const b = e.target.closest("button[data-e]"); if(!b) return;
  const em = b.dataset.e, ta = $("chIn"), a = ta.selectionStart == null ? ta.value.length : ta.selectionStart, z = ta.selectionEnd == null ? a : ta.selectionEnd;
  if(ta.value.length + em.length > ta.maxLength) return;
  ta.value = ta.value.slice(0, a) + em + ta.value.slice(z);
  const p = a + em.length; ta.setSelectionRange(p, p);
  chatGrow(); chatSyncSend();
  try { const r = [em].concat(emoRecent().filter(x => x !== em)).slice(0, 24); localStorage.setItem("inv_emoji_recent", JSON.stringify(r)); } catch(_){}
  if(!isTouch) ta.focus();
});
$("chEmBtn").onclick = () => {
  const open = $("chEmoji").hidden;
  $("chEmoji").hidden = !open; $("chEmBtn").setAttribute("aria-expanded", String(open));
  if(open){ if(emoTab === 0 && !emoRecent().length) emoTab = 1; emoRender(); }
  const u = $("chList"); u.scrollTop = u.scrollHeight;
};

/* ---- obrir / tancar ---- */
function chatFit(){
  const d = $("chdlg"), vv = window.visualViewport;
  if(!d.open || !vv){ d.style.height = d.style.top = d.style.bottom = d.style.margin = ""; return; }
  if(vv.height < innerHeight - 120){ /* teclat obert al mòbil */
    d.style.margin = "0 auto"; d.style.top = (vv.offsetTop + 8) + "px"; d.style.bottom = "auto"; d.style.height = Math.min(780, vv.height - 16) + "px";
  } else { d.style.height = d.style.top = d.style.bottom = d.style.margin = ""; }
}
if(window.visualViewport){ visualViewport.addEventListener("resize", chatFit); visualViewport.addEventListener("scroll", chatFit); }
$("chatBtn").onclick = () => {
  if(!cloudUser){ toast("Cal iniciar sessió per fer servir el xat."); return; }
  $("chSub").textContent = "Ets " + chatName(chatMe()) + " · amb " + chatName(ALLOWED.find(e => e.toLowerCase() !== chatMe()) || "");
  chatNew = 0; $("chJump").hidden = true;
  $("chEmoji").hidden = true; $("chEmBtn").setAttribute("aria-expanded", "false");
  $("chdlg").showModal(); chatFit();
  $("chList").innerHTML = ""; chatRender(true); chatMarkRead(); chatGrow(); chatSyncSend();
  const u = $("chList"); u.scrollTop = u.scrollHeight;
  if(!isTouch) $("chIn").focus();
};
$("chClose").onclick = () => $("chdlg").close();
$("chdlg").addEventListener("close", () => { $("chEmoji").hidden = true; chatFit(); chatMarkRead(); chatBadge(); });
chatBadge();
/* =====================================================================
   v3.3 · Ajustos ⚙️ (triple toc per desbloquejar) i assistent d'ordres 🔴 (triple toc al robot)
   Els ajustos es desen a Firestore (meta/state · camp inv_cfg) i surten a ↶ Desfés.
   ===================================================================== */
let CHAT_MAX = 300;
const CFG_LABEL = {hold:"Temps de mantenir premut", dbl:"Temps del doble toc", tap:"Temps del triple toc", histMax:"Canvis que guarda Desfés", chatMax:"Missatges que guarda el xat", bkMax:"Còpies de seguretat que es guarden", bkAuto:"Dies entre còpies automàtiques", cols:"Articles per fila (vista Imatges)", wvol:"Volum de WALL-E", wgap:"Repetició mínima del so de WALL-E", wver:"Versió de l'àudio de WALL-E", toast:"Segons que es veu l'avís", coin:"Segons abans de bloquejar la moneda", cardmin:"Mida de les targetes (PC)", chatVol:"Volum de l'avís del xat", newDays:"Dies que es marca «NEW»", sortMode:"Ordre dels articles", lph:"Foto a la vista llista", rad:"Cantonades arrodonides", aiwait:"Espera del toc simple a l'assistent", smartbar:"Barra de cerca intel·ligent", vib:"Vibració en tocar", fxOn:"Confeti en crear", fxN:"Quantitat de confeti", fxT:"Durada del confeti", fxPal:"Colors del confeti", fxVol:"So de la celebració", houseOn:"Celebració de Nau&Noa House", houseShow:"Mostra sempre Nau&Noa House", houseN:"Confeti de la casa", houseT:"Durada de la celebració de la casa", houseR:"Cintes de la casa", houseBan:"Cartell de la casa", dialHold:"Temps per obrir el dial", dialS:"Mida dels botons del dial", dialR:"Radi del dial", dialMax:"Ampliació màxima del dial", dialTap:"Dial amb un toc simple", dialVib:"Vibració del dial", dashOn:"Botó del dashboard", dashDays:"Dies d'activitat del dashboard", dashTop:"Articles als rànquings", dashAnim:"Animacions del dashboard"};
const cfgSec = k => k === "hold" || k === "dbl" || k === "tap" || k === "wgap" || k === "toast" || k === "coin" || k === "aiwait" || k === "fxT" || k === "houseT" || k === "dialHold";
const cfgDeep = o => o == null ? null : JSON.parse(JSON.stringify(o));
const fmtSec = ms => String(Math.round(ms / 10) / 100).replace(".", ",") + " s";
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
function cfgLabels(b, a){
  const B = cfgFlat(b), A = cfgFlat(a), L = [];
  new Set([...Object.keys(B), ...Object.keys(A)]).forEach(p => {
    if(stable(B[p]) === stable(A[p])) return;
    const [k, id] = cfgSplit(p);
    if(!(k in CFGD)) return; /* ajustos antics que ja no existeixen */
    const dv = CFGD[k];
    const fv = v => { v = v === undefined ? dv : v; return cfgSec(k) ? fmtSec(v) : String(v); };
    const name = CFG_LABEL[k] || k;
    L.push("⚙️ " + name + ": " + fv(B[p]) + " → " + fv(A[p]));
  });
  return L.join(" · ");
}
function cfgClean(o){
  const r = {};
  ["hold", "dbl", "tap", "histMax", "chatMax", "bkMax", "bkAuto", "cols", "wvol", "wgap", "wver", "toast", "coin", "cardmin", "chatVol", "newDays", "sortMode", "lph", "rad", "aiwait", "smartbar", "vib", "fxOn", "fxN", "fxT", "fxPal", "fxVol", "houseOn", "houseShow", "houseN", "houseT", "houseR", "houseBan", "dialHold", "dialS", "dialR", "dialMax", "dialTap", "dialVib", "dashOn", "dashDays", "dashTop", "dashAnim"].forEach(k => {
    const v = o && o[k];
    if(typeof v === "number" && isFinite(v) && v >= CFGR[k][0] && v <= CFGR[k][1] && v !== CFGD[k]) r[k] = v;
  });
  return r;
}
function cfgCommit(fn){
  const cur = cfgDeep(cfgRaw()) || {};
  fn(cur);
  store("inv_cfg", cfgClean(cur));
  cfgApply();
  if($("cfdlg").open) cfgRender();
}
function cfgApply(){
  HIST_MAX = cfgGet("histMax"); CHAT_MAX = cfgGet("chatMax");
  const hm = $("hMaxN"); if(hm) hm.textContent = HIST_MAX;
  document.documentElement.style.setProperty("--hold", cfgGet("hold") + "ms");
  document.documentElement.style.setProperty("--cols", cfgGet("cols"));
  document.documentElement.style.setProperty("--cardmin", cfgGet("cardmin") + "px");
  document.documentElement.style.setProperty("--lph", cfgGet("lph") + "px");
  document.documentElement.style.setProperty("--rad", cfgGet("rad") + "px");
  themeApply();
  if(window.__lnd !== cfgGet("newDays")){ const first = window.__lnd === undefined; window.__lnd = cfgGet("newDays"); if(!first) scheduleRebuild(); }
  render();
  if(histLoaded) cloudHist(HIST);
  chatTrim();
}
function chatTrim(){
  if(!window.cloud || !cloudUser || !chatLoaded || importing) return;
  if(CHAT.length <= CHAT_MAX) return;
  const old = CHAT.slice(0, CHAT.length - CHAT_MAX).filter(m => !m.pending);
  if(old.length) cloud.batch(old.map(m => ({t:"del", col:"chat", id:m.id}))).catch(() => {});
}
const __cloudMeta33 = cloudMeta;
cloudMeta = function(m){ __cloudMeta33(m); cfgApply(); };

/* ---- efecte moneda (el botó es gira) ---- */
function hop(b){ b.classList.remove("hop"); void b.offsetWidth; b.classList.add("hop"); setTimeout(() => b.classList.remove("hop"), 950); }

/* ---- ⚙️ botó d'ajustos: bloquejat fins a 3 tocs ràpids ---- */
let cfgUnlocked = false, cfgLockT = 0;
const cfgTaps = [];
function cfgSetLock(lock){
  clearTimeout(cfgLockT);
  if(cfgUnlocked === !lock) return;
  cfgUnlocked = !lock;
  $("cfgBtn").classList.toggle("flipped", !lock);
  hop($("cfgBtn"));
  if(!lock) cfgLockT = setTimeout(() => cfgSetLock(true), cfgGet("coin"));
}
$("cfgBtn").addEventListener("click", () => {
  if(cfgUnlocked){ clearTimeout(cfgLockT); openCfg(); return; }
  const now = Date.now(), win = cfgGet("tap");
  cfgTaps.push(now);
  while(cfgTaps.length && now - cfgTaps[0] > win) cfgTaps.shift();
  if(cfgTaps.length >= 3){ cfgTaps.length = 0; cfgSetLock(false); }
});
function openCfg(){
  if(!cloudUser){ toast("Cal iniciar sessió."); return; }
  cfgRender();
  $("cfdlg").showModal();
}
$("cfClose").onclick = () => $("cfdlg").close();
$("cfdlg").addEventListener("close", () => cfgSetLock(true));

/* ---- ⚙️ panell d'ajustos (negre i vermell) ---- */
function cfgRender(){
  const c = cfgRaw();
  const row = (title, sub, attrs, val, unit) =>
    '<label class="cfrow"><span class="cft"><b>' + title + '</b><small>' + sub + '</small></span><span class="cfin"><input type="number" inputmode="decimal" ' + attrs + ' value="' + val + '" required><i>' + unit + '</i></span></label>';
  let h = cfgSummaryHtml();
  h += '</div><div class="cfg"><h3>⏱️ Funcionament</h3><p class="cfn">Temps en segons. Si poses un valor fora del rang, et marcarà el camp en vermell.</p>';
  h += row("Mantenir premut per veure la foto", "Entre 0,3 i 5 s · per defecte " + String(CFGD.hold / 1000).replace(".", ","), 'data-t="hold" min="0.3" max="5" step="0.1"', cfgGet("hold") / 1000, "s");
  h += row("Doble toc per tancar finestres", "Entre 0,2 i 3 s · per defecte " + String(CFGD.dbl / 1000).replace(".", ","), 'data-t="dbl" min="0.2" max="3" step="0.1"', cfgGet("dbl") / 1000, "s");
  h += row("Triple toc (ajustos i assistent)", "Entre 0,4 i 3 s · per defecte " + String(CFGD.tap / 1000).replace(".", ","), 'data-t="tap" min="0.4" max="3" step="0.1"', cfgGet("tap") / 1000, "s");
  h += row("Canvis que guarda ↶ Desfés", "Entre 10 i 500 · per defecte " + CFGD.histMax, 'data-t="histMax" min="10" max="500" step="1"', cfgGet("histMax"), "canvis");
  h += row("Missatges que guarda el xat", "Entre 50 i 1000 · per defecte " + CFGD.chatMax, 'data-t="chatMax" min="50" max="1000" step="1"', cfgGet("chatMax"), "missatges");
  h += cfgTimeRows(row);
  h += '</div><div class="cfg"><h3>🖼️ Aspecte</h3><p class="cfn">Com es veuen les targetes a la vista Imatges.</p>';
  h += row("Articles per fila (mòbil)", "Entre 2 i 6 · per defecte " + CFGD.cols, 'data-t="cols" min="2" max="6" step="1"', cfgGet("cols"), "per fila");
  h += cfgMoreHtml(row);
  h += cfgV5Html(row);
  h += cfgLocIconsHtml();
  h += '</div><div class="cfg"><h3>💾 Còpies de seguretat</h3><p class="cfn">Per crear-ne o restaurar-ne, toca el botó «Còpies de seguretat» de dalt.</p>';
  h += row("Còpies que es guarden", "Entre 1 i 50 · per defecte " + CFGD.bkMax + " · s'esborra la més antiga", 'data-t="bkMax" min="1" max="50" step="1"', cfgGet("bkMax"), "còpies");
  h += row("Còpia automàtica cada…", "Entre 0 i 60 dies · 0 = desactivada · per defecte 0", 'data-t="bkAuto" min="0" max="60" step="1"', cfgGet("bkAuto"), "dies");
  h += '</div><div class="cfg"><h3>🔊 So de WALL-E</h3><p class="cfn">Sona quan obres l\'assistent de productes (no en el mode d\'ordres). Fitxer: <b>Walle.mp3</b>.</p>';
  h += row("Volum de WALL-E", "Entre 0 i 100 · 0 = en silenci · per defecte " + CFGD.wvol, 'data-t="wvol" min="0" max="100" step="1"', cfgGet("wvol"), "%");
  h += row("Repetició mínima", "Entre 0,5 i 10 s · per defecte " + String(CFGD.wgap / 1000).replace(".", ","), 'data-t="wgap" min="0.5" max="10" step="0.1"', cfgGet("wgap") / 1000, "s");
  h += row("Versió de l'àudio", "Entre 1 i 999 · per defecte 1 · puja-la quan canviïs Walle.mp3 a GitHub", 'data-t="wver" min="1" max="999" step="1"', cfgGet("wver"), "versió");
  h += '<button type="button" class="wtest" id="wTest">▶ Prova el so</button>';
  h += '</div><div class="cfg"><h3>📱 Aquest dispositiu</h3><p class="cfn">Vista amb què s\'obre l\'inventari en aquest aparell.</p><div class="cfseg" id="cfView">'
    + [["grid", "▦ Imatges"], ["list", "☰ Llista"], ["check", "☑ Check"]].map(v => '<button type="button" data-v="' + v[0] + '" aria-pressed="' + (view === v[0]) + '">' + v[1] + '</button>').join("")
    + '</div></div>';
  const st0 = $("cfBody").scrollTop; $("cfBody").innerHTML = h; $("cfBody").scrollTop = st0;
}
$("cfBody").addEventListener("click", e => {
  if(e.target.closest("#wTest")){ walleSay(true); return; }
  const b = e.target.closest("#cfView button"); if(!b) return;
  setView(b.dataset.v);
  $("cfView").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.v === view)));
});
$("cfBody").addEventListener("input", e => { if(e.target.classList) e.target.classList.remove("bad"); });
function cfgCollect(){
  const body = $("cfBody"); let bad = null;
  const out = {};
  for(const inp of body.querySelectorAll("input[data-g], input[data-t]")){
    const v = inp.valueAsNumber, g = inp.dataset.g, t = inp.dataset.t;
    let ok, val;
    if(g){ ok = Number.isFinite(v) && v >= 1 && v <= 99999 && Math.floor(v) === v; val = v; }
    else { const r = CFGR[t], ms = cfgSec(t) ? Math.round(v * 1000) : v; ok = Number.isFinite(v) && ms >= r[0] && ms <= r[1] && (cfgSec(t) || Math.floor(v) === v); val = ms; }
    inp.classList.toggle("bad", !ok);
    if(!ok){ if(!bad) bad = inp; continue; }
    if(g) out[g][inp.dataset.id] = val; else out[t] = val;
  }
  if(bad){ bad.focus(); toast("⚠️ Revisa els camps en vermell: només números dins del rang indicat."); return null; }
  return cfgClean(out);
}
$("cfSave").onclick = () => {
  const r = cfgCollect(); if(!r) return;
  if(stable(cfgClean(cfgRaw())) === stable(r)){ toast("No hi ha cap canvi per desar."); return; }
  store("inv_cfg", r); cfgApply(); cfgRender();
  toast("✓ Ajustos desats. Ho pots desfer des de ↶ Desfés.");
};
$("cfReset").onclick = () => {
  if(!Object.keys(cfgClean(cfgRaw())).length){ toast("Ja estan tots els valors per defecte."); return; }
  if(!confirm("Restaurar TOTS els ajustos als valors per defecte?\n\nTots els valors tornaran a la configuració original. Ho podràs desfer des de ↶ Desfés.")) return;
  store("inv_cfg", {}); cfgApply(); cfgRender();
  toast("↺ Ajustos restaurats als valors per defecte.");
};

/* ---- 🔴 assistent d'ordres: el robot es gira amb 3 tocs ràpids ---- */
let adminOn = false;
$("rClose").onclick = adminClose;
$("rPanel").addEventListener("keydown", e => { if(e.key === "Escape"){ e.stopPropagation(); adminClose(); } });
$("rIn").addEventListener("keydown", e => { if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); $("rForm").requestSubmit(); } });
$("rForm").onsubmit = e => { e.preventDefault(); const q = $("rIn").value.trim(); if(!q) return; $("rIn").value = ""; rAsk(q); };
const __cloudAuth33 = cloudAuth;
cloudAuth = function(u){ adminClose(); cfgSetLock(true); if($("cfdlg").open) $("cfdlg").close(); __cloudAuth33(u); };

function rMsg(kind, text){
  const d = document.createElement("div"); d.className = "aimsg " + kind; d.textContent = text;
  $("rMsgs").appendChild(d); $("rMsgs").scrollTop = $("rMsgs").scrollHeight; return d;
}
function rBtns(d, items, cls){
  const box = document.createElement("div"); box.className = cls;
  items.forEach(it => { const b = document.createElement("button"); b.type = "button"; b.className = it.cls || "sbtn"; b.textContent = it.text; b.onclick = it.fn; box.appendChild(b); });
  d.appendChild(box); $("rMsgs").scrollTop = $("rMsgs").scrollHeight; return box;
}
function rSuggest(d, qs){ rBtns(d, qs.map(q => ({text:q, fn:() => rAsk(q)})), "aisug"); }
function rGreet(){
  const d = rMsg("bot", "Mode ordres activat 🔴\nPuc canviar ajustos i fer canvis a l'inventari. Sempre et demano confirmació abans de tocar res, i tot queda a ↶ Desfés.");
  rSuggest(d, ["Què puc fer?", "Resum de l'inventari", "Quins són els ajustos?"]);
}
function rConfirm(text, apply){
  const d = rMsg("bot", text);
  const yes = {text:"✓ Confirma", cls:"rok"}, no = {text:"✕ Cancel·la", cls:"rno"};
  let box;
  const lock = () => box.querySelectorAll("button").forEach(b => { b.disabled = true; });
  yes.fn = () => {
    if(box.querySelector("button").disabled) return;
    lock();
    let res;
    HTAG = "🤖 ";
    try { res = apply(); } catch(err){ console.error(err); res = "⚠️ No ho he pogut fer. Torna-ho a provar."; }
    finally { HTAG = ""; }
    rMsg("bot", res || "Fet ✓");
  };
  no.fn = () => { if(box.querySelector("button").disabled) return; lock(); rMsg("bot", "D'acord, no canvio res."); };
  box = rBtns(d, [yes, no], "rconf");
}
function needSession(){ if(cloudUser) return false; rMsg("bot", "Cal tenir la sessió iniciada per fer canvis."); return true; }

/* ---- eines de text ---- */
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rNorm = t => norm(t).replace(/['’`´]/g, " ").replace(/[^a-z0-9.,\- ]+/g, " ").replace(/\s+/g, " ").trim();
const rInt = s => { const m = String(s).match(/\d+/g); return m ? +m[m.length - 1] : null; };
const rNum = s => { const m = String(s).match(/\d+(?:[.,]\d+)?/g); return m ? parseFloat(m[m.length - 1].replace(",", ".")) : null; };
function rNames(){
  const L = LOCS.map(l => ({id:l, label:l, n:norm(l)}));
  if(LOCS.includes(HOUSE)) HOUSE_ALIAS.forEach(a => L.push({id:HOUSE, label:HOUSE, n:a}));
  const C = [];
  CATS.forEach(c => { [c.label, c.short].filter((x, i, a) => x && a.indexOf(x) === i).forEach(nm => C.push({id:c.id, label:c.label, n:norm(nm)})); });
  return {L, C};
}
function rFind(text, list){
  const nt = norm(text); let best = null;
  list.forEach(x => {
    if(!x.n) return;
    const re = new RegExp("(^|[^a-z0-9])(" + escRe(x.n) + ")(?![a-z0-9])", "g"); let m;
    while((m = re.exec(nt))){ const s = m.index + m[1].length, e = s + x.n.length; if(!best || e - s > best.e - best.s) best = {x, s, e}; }
  });
  return best;
}
function rCut(text, f){
  let s = f.s; const before = norm(text).slice(0, s);
  const m = /(?:\b(?:a|al|a la|en|cap a|cap al|cap a la|zona|ubicacio|la zona|la ubicacio)\s+)+$/.exec(before);
  if(m) s = before.length - m[0].length;
  return (text.slice(0, s) + " " + text.slice(f.e)).replace(/\s+/g, " ").trim();
}
const R_VERB = /^(?:si us plau\s+|sisplau\s+|pots\s+|podries\s+)?(?:mou|moure|passa|porta|trasllada|canvia|posa|fica|deixa|afegeix|desa|guarda|situa|elimina|esborra|borra|suprimeix)\s+/i;
const rClean = q => String(q).replace(R_VERB, "").replace(/\b(?:també|tambe|ara|tot|tots|totes)\b/gi, " ")
  .replace(/^(?:(?:el|la|els|les|l['’]|un|una|aquest|aquesta)\s*)+/i, "").replace(/\s+(?:a|al|en|de|del)\s*$/i, "").replace(/[\s,;:]+$/, "").replace(/\s+/g, " ").trim();
function rFindItems(q){
  q = String(q || "").replace(/^(?:(?:el|la|els|les|l['’]|un|una|de|del|d['’])\s*)+/i, "").trim();
  const nq = loose(q); if(!nq) return [];
  const sc = [];
  DATA.forEach((c, i) => {
    if(!live(c)) return;
    const n = loose(c.item); let s = 0;
    if(n === nq) s = 100;
    else if((" " + n + " ").includes(" " + nq + " ")) s = 70;
    else if(nq.length >= 3 && n.includes(nq)) s = 60;
    else if(n.length >= 3 && nq.includes(n)) s = 50;
    else { const t = nq.split(" ").filter(w => w.length > 2); if(t.length && t.every(w => n.includes(w))) s = 40; else if(nq.length >= 4 && qText(c.item, q)) s = 20; }
    if(s) sc.push({i, s});
  });
  if(!sc.length) return [];
  sc.sort((a, b) => b.s - a.s);
  return sc.filter(x => x.s === sc[0].s).slice(0, 8).map(x => x.i);
}
function rItemPick(q, then){
  const found = rFindItems(q);
  if(!found.length){ rMsg("bot", "No trobo cap article que s'assembli a «" + q + "». Escriu el nom tal com surt a l'inventari."); return; }
  if(found.length === 1){ then(DATA[found[0]].id); return; }
  const d = rMsg("bot", "He trobat " + found.length + " articles. Quin vols dir?");
  rBtns(d, found.map(i => ({text:DATA[i].item + " · " + DATA[i].loc, cls:"rpick", fn:() => then(DATA[i].id)})), "aires rlist");
}
const itemIdx = id => DATA.findIndex(c => c.id === id && live(c));
const itemDesc = c => qtyBadge(c.qty) + " · " + zonesTxt(c) + " · 📍 " + locsTxt(c, ", ");

/* ---- ordres ---- */
function rHelp(nt){
  if(!/^(?:ajuda|help|ordres|comandes)\b|que puc fer|que saps fer|que pots fer|com funciones/.test(nt)) return false;
  rMsg("bot", "Puc fer això (sempre et demano confirmació):\n\n⚙️ AJUSTOS\n• resum de l'inventari (% per ubicació i zona)\n• mantenir premut a 1,5 segons\n• doble toc a 0,8 · triple toc a 1\n• historial a 50 · xat a 200 missatges\n• volum de WALL-E a 30 (0 = silenci)\n• avisos a 6 segons · moneda a 4 segons\n• targetes a 250 (mida a PC) · nous durant 7 dies\n• volum del xat a 40\n• vista llista (en aquest dispositiu)\n• ordena per nom · ordena per recents · ordre original\n• cantonades a 20 · foto de la llista a 90\n• vibració activada · barra de cerca desactivada\n\n🎨 COLORS\n• posa el color principal a blau\n• color del fons blau fosc · color del text #ffeecc\n• color del cartell NEW taronja\n• tema verd (rosa, lila, groc, taronja, gris…)\n• restaura els colors\n\n• columnes a 2 (articles per fila)\n• còpies a 10 · còpia automàtica cada 7 dies\n• fes una còpia de seguretat\n• quines còpies hi ha?\n• restaura els ajustos\n• quins són els ajustos?\n\n🎉 CONFETI I NAU&NOA HOUSE\n• prova el confeti · prova la celebració de la casa\n• confeti a 300 · durada del confeti a 5 segons\n• desactiva el confeti · colors del confeti a 2\n• confeti de la casa a 600 · cintes de la casa a 50\n• durada de la celebració de la casa a 9 segons\n• volum del confeti a 40\n\n🎛️ FILTRES I DIAL\n• icona de Cunit a platja · icona de Garatge iaios automàtica\n• quines icones hi ha?\n• filtra per Cunit · mostra la zona Cuina · treu els filtres\n• temps del dial a 0,5 segons · ampliació del dial a 200\n• radi del dial a 160 · mida del dial a 50\n\n📊 DASHBOARD\n• obre el dashboard · tanca el dashboard\n• dies del dashboard a 30 · top del dashboard a 8\n\n🛒 COMPRA\n• afegeix llet a la compra\n• treu llet de la compra\n• què he de comprar?\n\n📦 ARTICLES\n• posa la quantitat de la raclette a 3\n• posa 3 a la raclette\n• mou la raclette a Cunit\n• afegeix la raclette també a Garatge iaios\n• posa la raclette a la zona Cuina\n• canvia el nom de raclette a Raclette Klarstein\n• elimina la raclette\n• crea l'article Gots x6 a Cunit zona Cuina (si no dius la zona, la trio jo 🪄)\n• crea la zona Terrassa\n• crea la ubicació Pis\n\nTot el que canvio queda a ↶ Desfés (amb 🤖).");
  return true;
}
function rShow(nt){
  if(!/(quins|quin|mostra|ensenya|veure|llista).*(ajust|objectiu|configuracio)|ajustos actuals|com estan (?:els )?ajustos/.test(nt)) return false;
  rMsg("bot", "⚙️ Ajustos actuals"
    + "\n\n⏱️ Mantenir premut: " + fmtSec(cfgGet("hold")) + " · Doble toc: " + fmtSec(cfgGet("dbl")) + " · Triple toc: " + fmtSec(cfgGet("tap"))
    + "\n↶ Desfés guarda " + cfgGet("histMax") + " canvis · 💬 el xat guarda " + cfgGet("chatMax") + " missatges"
    + "\n🔊 Volum de WALL-E: " + cfgGet("wvol") + "%"
    + "\n⏳ Avisos: " + fmtSec(cfgGet("toast")) + " · Moneda: " + fmtSec(cfgGet("coin")) + " · 🖼️ targetes PC: " + cfgGet("cardmin") + " px"
    + "\n🔔 Avís del xat: " + cfgGet("chatVol") + "% · NEW: " + (cfgGet("newDays") ? cfgGet("newDays") + " dies" : "desactivat")
    + "\n🎨 Colors: principal " + themeVals().accent + " · fons " + themeVals().bg + " · text " + themeVals().ink + " · NEW " + themeVals().newc
    + "\n↕ Ordre: " + ["original", "nom A→Z", "més recents primer"][cfgGet("sortMode")]
    + "\n🎉 Confeti: " + (cfgGet("fxOn") ? cfgGet("fxN") + " peces · " + fmtSec(cfgGet("fxT")) : "desactivat") + " · 🏡 Casa: " + (cfgGet("houseOn") ? cfgGet("houseN") + " peces · " + cfgGet("houseR") + " cintes · " + fmtSec(cfgGet("houseT")) : "desactivada")
    + "\n🎛️ Dial: " + fmtSec(cfgGet("dialHold")) + " per obrir · mida " + cfgGet("dialS") + " px · radi " + cfgGet("dialR") + " px · ampliació " + cfgGet("dialMax") + "% · 📊 Dashboard: " + (cfgGet("dashOn") ? cfgGet("dashDays") + " dies · top " + cfgGet("dashTop") : "botó amagat")
    + "\n💾 Còpies que es guarden: " + cfgGet("bkMax") + " · automàtica cada " + (cfgGet("bkAuto") ? cfgGet("bkAuto") + " dies" : "— (desactivada)") + " · 🖼️ " + cfgGet("cols") + " articles per fila");
  return true;
}
function rReset(nt){
  if(!/(restaura|reinicia|reseteja|torna).*(ajust|defecte|valors)|valors per defecte/.test(nt)) return false;
  if(needSession()) return true;
  if(!Object.keys(cfgClean(cfgRaw())).length){ rMsg("bot", "Ja estan tots els ajustos als valors per defecte."); return true; }
  rConfirm("Restauro TOTS els ajustos als valors per defecte (temps, fotos, xat, còpies…). Confirmes?", () => { store("inv_cfg", {}); cfgApply(); return "✓ Ajustos restaurats. Ho pots desfer des de ↶ Desfés."; });
  return true;
}
function rGoal(nt){
  if(!/objectiu/.test(nt)) return false;
  rMsg("bot", "Els objectius ja no existeixen. Ara el % de cada ubicació i de cada zona és el tant per cent d'articles que hi ha guardats allà respecte al total. Escriu «resum» per veure'ls.");
  return true;
}
function rTimes(nt){
  let k, name;
  const k5 = rKeys5(nt);
  if(k5){ k = k5[0]; name = k5[1]; }
  else if(/cantonad|arrodon|\bradi\b/.test(nt)){ k = "rad"; name = "les cantonades arrodonides"; }
  else if(/vibraci/.test(nt)){ k = "vib"; name = "la vibració en tocar"; }
  else if(/\bbarra\b/.test(nt) && /cerca|intel/.test(nt)){ k = "smartbar"; name = "la barra de cerca intel·ligent"; }
  else if(/\bfotos?\b/.test(nt) && /llista/.test(nt)){ k = "lph"; name = "la mida de la foto a la vista llista"; }
  else if(/espera|retard/.test(nt) && /assistent|toc simple/.test(nt)){ k = "aiwait"; name = "l'espera del toc simple a l'assistent"; }
  else if(/\bxat\b/.test(nt) && /\bvolum\b|\bso\b|avis/.test(nt) && /\d/.test(nt)){ k = "chatVol"; name = "el volum de l'avís del xat"; }
  else if(/\bavis(?:os)?\b|toast/.test(nt) && /\d/.test(nt)){ k = "toast"; name = "els segons que es veu l'avís"; }
  else if(/moneda|desbloque|bloqueja/.test(nt) && /\d/.test(nt)){ k = "coin"; name = "els segons abans de bloquejar la moneda"; }
  else if(/targetes?/.test(nt)){ k = "cardmin"; name = "la mida de les targetes (PC)"; }
  else if(/\bnous?\b|novetat/.test(nt) && /dies/.test(nt)){ k = "newDays"; name = "els dies que un article porta el cartell NEW"; }
  else if(/versio.*(audio|wall)|(audio|wall).*versio/.test(nt)){ k = "wver"; name = "la versió de l'àudio de WALL-E"; }
  else if(/wall[\s-]?e|\bvolum\b/.test(nt)){ k = "wvol"; name = "el volum de WALL-E"; }
  else if(/triple\s+(?:toc|clic|click)/.test(nt)){ k = "tap"; name = "el temps del triple toc"; }
  else if(/doble\s+(?:toc|clic|click)/.test(nt)){ k = "dbl"; name = "el temps del doble toc"; }
  else if(/mantenir|mantingui|mantenint|premut/.test(nt)){ k = "hold"; name = "el temps de mantenir premut"; }
  else if(/columna|columnes|per fila/.test(nt)){ k = "cols"; name = "els articles per fila a la vista Imatges"; }
  else if(/\bcopi(?:a|es)\b|backup/.test(nt) && /autom|cada|dies/.test(nt)){ k = "bkAuto"; name = "els dies entre còpies automàtiques"; }
  else if(/\bcopi(?:a|es)\b|backup/.test(nt)){ k = "bkMax"; name = "les còpies de seguretat que es guarden"; }
  else if(/historial|desfes/.test(nt) && /\d/.test(nt)){ k = "histMax"; name = "els canvis que guarda Desfés"; }
  else if(/\bxat\b|missatges/.test(nt) && /\d/.test(nt)){ k = "chatMax"; name = "els missatges que guarda el xat"; }
  else return false;
  if(needSession()) return true;
  let n = rNum(nt);
  if(n == null && (k === "vib" || k === "smartbar" || TOG5.includes(k))) n = /desactiv|apag|\bno\b|\boff\b|sense|treu/.test(nt) ? 0 : 1;
  if(n == null){ rMsg("bot", "Quin valor? Per exemple: «" + (cfgSec(k) ? "doble toc a 0,8 segons" : "historial a 50") + "»."); return true; }
  const v = cfgSec(k) ? (/\bms\b|mil[·.]?lisegon/.test(nt) ? Math.round(n) : Math.round(n * 1000)) : Math.round(n);
  const r = CFGR[k];
  if(v < r[0] || v > r[1]){ rMsg("bot", "Aquest valor ha d'estar entre " + (cfgSec(k) ? fmtSec(r[0]) + " i " + fmtSec(r[1]) : r[0] + " i " + r[1]) + "."); return true; }
  const cur = cfgGet(k);
  if(cur === v){ rMsg("bot", "Ja està així. No cal canviar res."); return true; }
  const f = x => cfgSec(k) ? fmtSec(x) : String(x);
  rConfirm("Canvio " + name + ": " + f(cur) + " → " + f(v) + ". Confirmes?", () => { cfgCommit(c => { c[k] = v; }); return "✓ Fet."; });
  return true;
}
function rView(nt){
  if(!/\bvista\b/.test(nt)) return false;
  const v = /imatge|grid|graella|foto/.test(nt) ? "grid" : /llista/.test(nt) ? "list" : /check/.test(nt) ? "check" : null;
  if(!v){ rMsg("bot", "Quina vista? Imatges, llista o check."); return true; }
  const nm = {grid:"Imatges", list:"Llista", check:"Check"};
  if(v === view){ rMsg("bot", "Aquest dispositiu ja està en vista " + nm[v] + "."); return true; }
  rConfirm("Canvio la vista d'aquest dispositiu a " + nm[v] + ". Confirmes?", () => { setView(v); return "✓ Fet. (Només afecta aquest dispositiu.)"; });
  return true;
}
function rCreate(nt, t0, n0){
  const m = /^(?:crea|crear|fes|nova|nou|afegeix|anota|registra|apunta)\s+(?:(?:una?|la|el|l|aquesta?)\s+)?(?:(?:nova|nou)\s+)?(zona|ubicacio|article|objecte|producte)\b\s*/.exec(n0);
  if(!m) return false;
  if(needSession()) return true;
  const kind = m[1];
  let rest = t0.slice(m[0].length).trim();
  rest = rest.replace(/^(?:de la casa\s+)?(?:anomenad[ao]|que es digui|que es diu|amb (?:el )?nom|de nom|:)\s*/i, "").replace(/^[«"'“]+|[»"'”.]+$/g, "").trim();
  if(kind === "zona" || kind === "ubicacio"){
    const name = rest.replace(/\s+/g, " ");
    if(!name){ rMsg("bot", "Com es diu? Per exemple: «crea la " + (kind === "zona" ? "zona Terrassa" : "ubicació Pis") + "»."); return true; }
    if(kind === "zona"){
      const dup = CATS.find(c => norm(c.label) === norm(name) || norm(c.short) === norm(name));
      if(dup){ rMsg("bot", "La zona «" + dup.label + "» ja existeix."); return true; }
      rConfirm("Creo la zona 🏠 «" + name + "». Confirmes?", () => {
        const cat = {id:"u" + Date.now(), label:name, short:name, icon:"🏠"};
        userCats.push(cat); store("inv_cats", userCats); CATS.push(cat); buildSection(cat); setView(view); render();
        return "✓ Zona «" + name + "» creada.";
      });
    } else {
      const dup = LOCS.find(l => norm(l) === norm(name));
      if(dup){ rMsg("bot", "La ubicació «" + dup + "» ja existeix."); return true; }
      rConfirm("Creo la ubicació 📍 «" + name + "». Confirmes?", () => {
        userLocs.push(name); store("inv_locs", userLocs); refreshLocs(); render();
        return "✓ Ubicació «" + name + "» creada.";
      });
    }
    return true;
  }
  /* article: «crea l'article NOM a UBICACIÓ zona ZONA quantitat N» */
  let r = rest, qty = null, loc = null, cat = null;
  const {L, C} = rNames();
  const mq = /(?:quantitat|unitats?)\s*(?:de\s*)?(\d+)|\b(\d+)\s*unitats?\b/i.exec(r);
  if(mq){ qty = +(mq[1] || mq[2]); r = (r.slice(0, mq.index) + " " + r.slice(mq.index + mq[0].length)).replace(/\s+/g, " ").trim(); }
  if(/\bzona\b/i.test(r)){ const fz = rFind(r, C); if(fz){ cat = fz.x; r = rCut(r, fz); } }
  const fl = rFind(r, L); if(fl){ loc = fl.x; r = rCut(r, fl); }
  let name = r.replace(/^(?:(?:el|la|els|les|l['’]|un|una)\s*)+/i, "").replace(/[\s,;:]+$/, "").replace(/\s+(?:a|al|en|de|i|amb)$/i, "").trim();
  name = name.charAt(0).toUpperCase() + name.slice(1);
  if(!name){ rMsg("bot", "Com es diu l'article? Per exemple: «crea l'article Gots a Cunit zona Cuina»."); return true; }
  let autoZ = "";
  if(!cat){ const g = zoneGuess(name); if(g){ cat = {id:g.z.id, label:g.z.label}; autoZ = " (zona triada sola 🪄)"; } }
  if(!loc || !cat){
    const d = rMsg("bot", "Per crear «" + name + "» em falta " + (!loc && !cat ? "la ubicació i la zona" : !loc ? "la ubicació" : "la zona") + ". Ubicacions: " + LOCS.join(", ") + ". Zones: " + CATS.map(z => z.label).join(", ") + ".\nExemple: crea l'article " + name + " a " + (loc ? loc.id : LOCS[0] || "Cunit") + " zona " + (cat ? cat.label : CATS[0].label));
    return true;
  }
  const q = qty || qtyFromName(name) || 1;
  if(q < 1 || q > 99999){ rMsg("bot", "La quantitat ha de ser entre 1 i 99.999."); return true; }
  rConfirm("Creo l'article «" + name + "» · ×" + q + " · " + cat.label + autoZ + " · 📍 " + loc.id + ". Confirmes?", () => {
    const c = {item:name, cat:cat.id, desc:"", qty:q, estado:"sin", fiab:"alta", note:"Afegit des de l'assistent", photos:[], pend:0, inv:0, loc:loc.id, locs:[loc.id], nou:true};
    c.ord = Date.now();
    if(cloudUser) c.by = String(cloudUser.email).toLowerCase();
    if(!cloudSaveItem(c)) return "⚠️ No s'ha pogut desar.";
    DATA.push(c); SEARCH.push(searchText(c)); refreshLocs();
    placeCards(DATA.length - 1);
    updateSub(); render();
    celebrateNew(c);
    return "✓ Article «" + name + "» creat (sense foto: la pots afegir des de la fitxa).";
  });
  return true;
}
function rDelete(nt, t0, n0){
  if(!/^(?:elimina|esborra|borra|suprimeix|elimino|esborro)\s+/.test(n0)) return false;
  if(needSession()) return true;
  if(/\b(?:zona|zones|ubicacio|ubicacions|pendent|pendents)\b/.test(n0)){ rMsg("bot", "De moment només puc eliminar articles. Les zones, ubicacions i pendents s'eliminen des de la web."); return true; }
  const q = rClean(t0);
  rItemPick(q, id => {
    const c = DATA[itemIdx(id)]; if(!c){ rMsg("bot", "Aquest article ja no existeix."); return; }
    rConfirm("Elimino «" + c.item + "» (" + itemDesc(c) + (c.photos.length ? " · " + c.photos.length + (c.photos.length > 1 ? " fotos" : " foto") : "") + "). Confirmes?", () => {
      const i = itemIdx(id); if(i < 0) return "Aquest article ja no existeix.";
      const nm = DATA[i].item; deleteItem(i);
      return "✓ «" + nm + "» eliminat. El pots recuperar des de ↶ Desfés.";
    });
  });
  return true;
}
function rRename(nt, t0, n0){
  const m = /^(?:canvia|posa|cambia|modifica)\s+(?:el\s+)?nom\s+(?:de\s+la\s+|del\s+|dels\s+|de\s+les\s+|de\s+|d\s+)?(.+?)\s+(?:a|per|com)\s+(.+)$/.exec(n0)
    || /^(?:reanomena|renombra|rebateja)\s+(?:el\s+|la\s+|l\s+)?(.+?)\s+(?:a|per|com)\s+(.+)$/.exec(n0);
  if(!m) return false;
  if(needSession()) return true;
  let nn = t0.slice(t0.length - m[2].length).replace(/^[«"'“]+|[»"'”.]+$/g, "").trim();
  nn = nn.charAt(0).toUpperCase() + nn.slice(1);
  if(!nn){ rMsg("bot", "Quin nom nou vols posar-li?"); return true; }
  rItemPick(m[1], id => {
    const c = DATA[itemIdx(id)]; if(!c){ rMsg("bot", "Aquest article ja no existeix."); return; }
    if(c.item === nn){ rMsg("bot", "Ja es diu així."); return; }
    rConfirm("Canvio el nom: «" + c.item + "» → «" + nn + "». Confirmes?", () => {
      const i = itemIdx(id); if(i < 0) return "Aquest article ja no existeix.";
      saveItem(i, {item:nn}); return "✓ Fet.";
    });
  });
  return true;
}
function rQty(nt){
  let m, q, n;
  if((m = /^(?:posa|canvia|fixa|deixa|fica|actualitza|modifica)\s+(\d+)\s+(?:unitats\s+)?(?:a|al|a la|de|del|de la|d)\s+(.+)$/.exec(nt))){ n = +m[1]; q = m[2]; }
  else if((m = /(?:quantitat|unitats)\s+(?:de\s+la\s+|del\s+|dels\s+|de\s+les\s+|de\s+|d\s+)?(.+?)\s+(?:a|en|per|=)\s+(\d+)\s*$/.exec(nt))){ q = m[1]; n = +m[2]; }
  else if((m = /(?:quantitat|unitats)\s+(?:a|en)\s+(\d+)\s+(?:de\s+la\s+|del\s+|de\s+|d\s+)(.+)$/.exec(nt))){ n = +m[1]; q = m[2]; }
  else return false;
  if(needSession()) return true;
  if(n < 1 || n > 99999){ rMsg("bot", "La quantitat ha de ser un número entre 1 i 99.999."); return true; }
  rItemPick(q, id => {
    const c = DATA[itemIdx(id)]; if(!c){ rMsg("bot", "Aquest article ja no existeix."); return; }
    if(c.qty === n){ rMsg("bot", "«" + c.item + "» ja té quantitat " + n + "."); return; }
    rConfirm("Canvio la quantitat de «" + c.item + "»: " + c.qty + " → " + n + ". Confirmes?", () => {
      const i = itemIdx(id); if(i < 0) return "Aquest article ja no existeix.";
      saveItem(i, {qty:n}); return "✓ Fet.";
    });
  });
  return true;
}
function rPlace(nt, t0){
  if(!/^(?:mou|moure|passa|porta|trasllada|canvia|posa|fica|deixa|afegeix|desa|guarda|situa)\b/.test(nt)) return false;
  const {L, C} = rNames();
  let rest = t0, zone = null, loc = null;
  if(/\bzona\b/.test(nt)){ const fz = rFind(rest, C); if(fz){ zone = fz.x; rest = rCut(rest, fz); } }
  const fl = rFind(rest, L); if(fl){ loc = fl.x; rest = rCut(rest, fl); }
  if(!zone && !loc){ const fz = rFind(rest, C); if(fz){ zone = fz.x; rest = rCut(rest, fz); } }
  if(!zone && !loc) return false;
  if(needSession()) return true;
  const add = /(?:^|\s)(?:tambe|a mes|ademes)(?:\s|$)|^afegeix\b/.test(nt);
  const q = rClean(rest);
  rItemPick(q, id => {
    const c = DATA[itemIdx(id)]; if(!c){ rMsg("bot", "Aquest article ja no existeix."); return; }
    const patch = {}, lines = [];
    if(loc){
      const nl = add ? [...new Set([...locsOf(c), loc.id])] : [loc.id];
      if(stable(nl) !== stable(locsOf(c))){ patch.loc = nl[0]; patch.locs = nl; lines.push("📍 " + locsOf(c).join(", ") + " → " + nl.join(", ")); }
    }
    if(zone){
      const nz = add ? [...new Set([...catsOf(c), zone.id])] : [zone.id];
      if(stable(nz) !== stable(catsOf(c))){ patch.cat = nz[0]; patch.cats = nz.length > 1 ? nz : null; lines.push("🏠 " + catsOf(c).map(catName).join(", ") + " → " + nz.map(catName).join(", ")); }
    }
    if(!lines.length){ rMsg("bot", "«" + c.item + "» ja hi és. No cal canviar res."); return; }
    rConfirm("Canvio «" + c.item + "»:\n" + lines.join("\n") + "\nConfirmes?", () => {
      const i = itemIdx(id); if(i < 0) return "Aquest article ja no existeix.";
      saveItem(i, patch); return "✓ Fet.";
    });
  });
  return true;
}
/* v6.0 · 🛒 «afegeix llet a la compra», «treu llet de la compra», «què he de comprar?» */
function rBuy(nt, t0){
  if(!/\bcompra\b|\bcomprar\b/.test(nt)) return false;
  const m = /^(?:afegeix|posa|apunta|anota|fica)\s+(.+?)\s+(?:a|al|en)\s+(?:la\s+)?(?:llista\s+de\s+la\s+)?compra$/.exec(nt);
  const x = /^(?:treu|elimina|esborra|borra)\s+(.+?)\s+(?:de|del)\s+(?:la\s+)?(?:llista\s+de\s+la\s+)?compra$/.exec(nt);
  if(m || x){
    if(needSession()) return true;
    const raw = t0.trim().replace(/^\S+\s+/, "").replace(/\s+(?:a|al|en|de|del)\s+(?:la\s+)?(?:llista\s+de\s+la\s+)?compra\.?$/i, "").trim();
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    if(!name){ rMsg("bot", "Què vols " + (m ? "afegir a" : "treure de") + " la compra?"); return true; }
    if(m){
      const g = zoneGuess(name);
      rConfirm("Afegeixo «" + name + "» a la llista de la compra" + (g ? " (" + g.z.label + ")" : "") + ". Confirmes?", () => { buyCommit(o => buyAdd(o, "f" + Date.now(), name, g ? g.z.id : "")); return "✓ Afegit a 🛒 Compra."; });
    } else {
      const hit = Object.entries(buyRaw()).find(([, e]) => e && loose(e.n) === loose(name)) || Object.entries(buyRaw()).find(([, e]) => e && loose(e.n).includes(loose(name)));
      if(!hit){ rMsg("bot", "No trobo «" + name + "» a la llista de la compra."); return true; }
      rConfirm("Trec «" + hit[1].n + "» de la llista de la compra. Confirmes?", () => { buyCommit(o => { delete o[hit[0]]; }); return "✓ Tret."; });
    }
    return true;
  }
  const l = buyOpen();
  rMsg("bot", l.length ? buyText() : "🛒 La llista de la compra és buida. Digues «afegeix llet a la compra».");
  return true;
}
function rAsk(text){
  rMsg("me", text);
  const t0 = text.trim(), n0 = norm(t0).replace(/['’`´]/g, " "), nt = rNorm(t0);
  if(/^(?:hola|bon dia|bones|ei|hey|salut)\b/.test(nt) && nt.split(" ").length < 4){ rMsg("bot", "Hola! Digues-me què vols canviar. Si t'ho vols mirar, escriu «què puc fer?»."); return; }
  const H = [rHelp, rBuy, rShow, rFx, rIcon, rStats, rFilter, rTheme, rSort, rReset, rGoal, rBackup, rTimes, rView, rCreate, rDelete, rRename, rQty, rPlace];
  for(const h of H){ if(h(nt, t0, n0) !== false) return; }
  const d = rMsg("bot", "No t'he entès 🤔 Prova amb una ordre com les d'aquests exemples:");
  rSuggest(d, ["Què puc fer?", "Resum de l'inventari", "Quins són els ajustos?"]);
}


/* =====================================================================
   v3.4 · Còpies de seguretat, vista mòbil/PC i monedes en 4 tocs
   bkmeta/{id}  -> {ts, name, who, ver, nItems, nPh, keys, chunks[], kind}
   bkdata/{id}  -> {b: id còpia, k: "i"|"p", n, v}   (articles / fotos, en blocs < 600 KB)
   ===================================================================== */
const APP_VER = "6.0";
const BK_SIZE = 600000;
let BK = [], bkLoaded = false, bkBusy = false, bkAutoDone = false, bkConfirm = null;
const bkWhen = ts => { const d = new Date(ts); return d.toLocaleDateString("ca", {day:"2-digit", month:"2-digit", year:"numeric"}) + " " + d.toLocaleTimeString("ca", {hour:"2-digit", minute:"2-digit"}); };
function bkShow(t, p){ $("bkProg").hidden = false; $("bkProgT").textContent = t; $("bkProgF").style.width = Math.round((p || 0) * 100) + "%"; }
function bkHide(ms){ setTimeout(() => { if(!bkBusy) $("bkProg").hidden = true; }, ms || 0); }
function bkLock(){ $("bkCreate").disabled = bkBusy; $("bkName").disabled = bkBusy; $("bkList").classList.toggle("busy", bkBusy); }
function bkPack(entries){
  const out = []; let cur = [], size = 0;
  entries.forEach(e => {
    const s = JSON.stringify(e[1]).length + String(e[0]).length + 12;
    if(cur.length && size + s > BK_SIZE){ out.push(cur); cur = []; size = 0; }
    cur.push(e); size += s;
  });
  if(cur.length) out.push(cur);
  return out;
}
/* Crea la còpia a partir de l'estat que hi ha ara a la memòria (articles, fotos, pendents, zones, ubicacions i ajustos) */
async function bkMake(name, o){
  o = o || {};
  const items = [...RAW].map(([id, d]) => Object.assign({}, deep(d), {id}));
  /* v6: les fotos completes es baixen ara, només per fer la còpia */
  if(o.prog) o.prog(0, 1);
  const all = o.photos || await cloud.allPhotos();
  const phs = new Map();
  /* si algun article apunta a una foto que ja no existeix, es treu la referència perquè la còpia sigui coherent */
  items.forEach(c => {
    if(Array.isArray(c.ph)) c.ph = c.ph.filter(p => { const u = all.get(p) || PHF.get(p); if(u) phs.set(p, u); return !!u; });
    if(c.tm) Object.keys(c.tm).forEach(p => { if(!(c.ph || []).includes(p)) delete c.tm[p]; });
  });
  const keys = {};
  KEYS_CLOUD.forEach(k => { keys[k] = STATE[k] === undefined ? (k === "inv_cats" || k === "inv_locs" ? [] : {}) : deep(STATE[k]); });
  const bid = cloud.newId(), ops = [], chunks = [];
  bkPack(items.map(c => [c.id, c])).forEach((g, n) => { const id = bid + "_i" + n; chunks.push(id); ops.push({t:"set", col:"bkdata", id, data:{b:bid, k:"i", n, v:g.map(e => e[1])}}); });
  bkPack([...phs]).forEach((g, n) => { const id = bid + "_p" + n; chunks.push(id); const v = {}; g.forEach(e => { v[e[0]] = e[1]; }); ops.push({t:"set", col:"bkdata", id, data:{b:bid, k:"p", n, v}}); });
  const meta = {ts:Date.now(), name:name || "", who:cloudUser.email, ver:APP_VER, nItems:items.length, nPh:phs.size, keys, chunks, kind:o.kind || "manual"};
  ops.push({t:"set", col:"bkmeta", id:bid, data:meta});
  await cloud.batch(ops, o.prog);
  return Object.assign({id:bid}, meta);
}
async function bkPrune(fresh, protect){
  const max = cfgGet("bkMax");
  const all = [fresh].concat(BK.filter(b => b.id !== fresh.id)).sort((a, b) => b.ts - a.ts);
  if(all.length <= max) return;
  const del = all.slice(max).filter(b => b.id !== protect && b.id !== fresh.id);
  if(!del.length) return;
  const ops = [];
  del.forEach(b => { (b.chunks || []).forEach(id => ops.push({t:"del", col:"bkdata", id})); ops.push({t:"del", col:"bkmeta", id:b.id}); });
  await cloud.batch(ops);
}
const bkErrTxt = e => e && e.code === "photos-loading" ? "Les fotos encara s'estan carregant. Torna-ho a provar d'aquí uns segons." : e && e.code === "backup-corrupt" ? "La còpia està incompleta o trencada: no s'ha tocat res." : "No s'ha pogut completar (" + (e && e.code || "error") + ").";
async function bkCreate(name, o){
  o = o || {};
  if(bkBusy) return null;
  if(!cloudUser || !window.cloud){ toast("Cal tenir la sessió iniciada."); return null; }
  if(!navigator.onLine){ toast("Cal connexió a internet per crear una còpia."); return null; }
  if(!cloudLoaded || itemsCache){ toast("Espera que s'acabi de carregar l'inventari."); return null; }
  bkBusy = true; bkLock();
  try {
    bkShow("Creant la còpia…", .02);
    const b = await bkMake(name, {kind:o.kind, prog:(d, t) => bkShow("Pujant la còpia… " + d + " / " + t, d / t)});
    bkShow("Netejant còpies velles…", 1); await bkPrune(b, o.protect);
    bkShow("✓ Còpia creada", 1);
    if(!o.quiet) toast("✓ Còpia creada: " + b.nItems + " articles i " + b.nPh + " fotos.");
    return b;
  } catch(e){ console.error(e); toast("⚠️ " + bkErrTxt(e)); return null; }
  finally { bkBusy = false; bkLock(); bkHide(1800); }
}
async function bkDelete(id){
  const b = BK.find(x => x.id === id); if(!b || bkBusy) return;
  bkBusy = true; bkLock();
  try {
    const ops = (b.chunks || []).map(c => ({t:"del", col:"bkdata", id:c})); ops.push({t:"del", col:"bkmeta", id});
    await cloud.batch(ops); toast("🗑️ Còpia eliminada.");
  } catch(e){ cloudErr(e); }
  finally { bkBusy = false; bkLock(); }
}
async function bkRestore(id){
  const b = BK.find(x => x.id === id); if(!b || bkBusy) return;
  if(!cloudUser || !window.cloud){ toast("Cal tenir la sessió iniciada."); return; }
  if(!navigator.onLine){ toast("Cal connexió a internet per restaurar."); return; }
  if(!cloudLoaded || itemsCache){ toast("Espera que s'acabi de carregar l'inventari."); return; }
  bkBusy = true; importing = true; bkLock();
  const label = b.name || "còpia del " + bkWhen(b.ts);
  try {
    bkShow("Llegint la còpia…", .03);
    const docs = await cloud.getBackup(id);
    const byId = new Map(docs.map(d => [d.id, d.data]));
    const itemsArr = [], phObj = {}; let okc = true;
    (b.chunks || []).forEach(cid => { const d = byId.get(cid); if(!d){ okc = false; return; } if(d.k === "i") itemsArr.push(...(d.v || [])); else Object.assign(phObj, d.v || {}); });
    if(!okc || itemsArr.length !== b.nItems || Object.keys(phObj).length !== b.nPh || itemsArr.some(c => !c.id || (c.ph || []).some(p => !phObj[p]))) throw {code:"backup-corrupt"};
    /* còpia automàtica de l'estat actual, per poder tornar enrere */
    bkShow("Guardant l'estat actual (còpia de seguretat)…", .1);
    const all = await cloud.allPhotos();
    const safe = await bkMake("Abans de restaurar «" + label + "»", {kind:"safe", photos:all});
    await bkPrune(safe, id);
    /* aplica la còpia: primer s'escriu tot el que cal, després s'esborra el que sobra */
    const owner = {}; itemsArr.forEach(c => (c.ph || []).forEach(p => { owner[p] = c.id; }));
    const ops = [], keep = new Set(itemsArr.map(c => c.id));
    itemsArr.forEach(c => {
      const o = Object.assign({}, c); delete o.id;
      const tm = Object.assign(tmOf(o.ph), o.tm || {}); delete o.tm;
      Object.keys(tm).forEach(p => { if(!(o.ph || []).includes(p)) delete tm[p]; });
      if(Object.keys(tm).length) o.tm = tm;
      ops.push({t:"set", col:"items", id:c.id, data:o});
    });
    Object.keys(phObj).forEach(pid => { if(all.get(pid) !== phObj[pid]) ops.push({t:"set", col:"photos", id:pid, data:{d:phObj[pid], it:owner[pid] || ""}}); });
    /* la llista de la compra no és a les còpies antigues (v5): es manté la d'ara */
    const meta = {}; KEYS_CLOUD.forEach(k => { const v = b.keys && b.keys[k]; meta[k] = v != null ? v : k === "inv_compra" ? deep(STATE.inv_compra) || {} : (k === "inv_cats" || k === "inv_locs" ? [] : {}); });
    ops.push({t:"set", col:"meta", id:"state", data:meta});
    [...RAW.keys()].filter(i => !keep.has(i)).forEach(i => ops.push({t:"del", col:"items", id:i}));
    [...all.keys()].filter(p => !(p in phObj)).forEach(p => ops.push({t:"del", col:"photos", id:p}));
    HIST.forEach(h => ops.push({t:"del", col:"hist", id:h.id}));
    await cloud.batch(ops, (d, t) => bkShow("Restaurant… " + d + " / " + t, .15 + .85 * d / t));
    bkShow("✓ Còpia restaurada", 1);
    toast("✓ Còpia restaurada: " + b.nItems + " articles i " + b.nPh + " fotos. Ja es veu a tots els dispositius.");
  } catch(e){ console.error(e); toast("⚠️ " + bkErrTxt(e)); bkShow("⚠️ " + bkErrTxt(e), 0); }
  finally { bkBusy = false; importing = false; bkLock(); bkHide(2500); scheduleRebuild(); }
}
function bkAutoCheck(){
  if(bkAutoDone || !cloudUser || !window.cloud || !bkLoaded || !cloudLoaded || itemsCache || !DATA.length) return;
  const days = cfgGet("bkAuto"); if(days <= 0) return;
  bkAutoDone = true;
  const due = () => Date.now() - (BK.length ? BK[0].ts : 0) >= days * 864e5;
  if(!due()) return;
  setTimeout(() => { if(due() && !bkBusy) bkCreate("Còpia automàtica", {kind:"auto", quiet:true}); }, 1500 + Math.random() * 4000);
}
function cloudBk(docs){
  BK = docs.filter(d => d && d.ts && Array.isArray(d.chunks)).sort((a, b) => b.ts - a.ts);
  bkLoaded = true;
  if($("bkdlg").open) bkRender();
  bkAutoCheck();
}
function bkRender(){
  const ul = $("bkList"), max = cfgGet("bkMax");
  $("bkSub").textContent = bkLoaded ? BK.length + " de " + max + " còpies" : "Carregant…";
  if(!bkLoaded){ ul.innerHTML = '<li class="bkempty">Carregant les còpies…</li>'; return; }
  if(!BK.length){ ul.innerHTML = '<li class="bkempty">Encara no hi ha cap còpia.<br>Crea\'n una amb el botó verd.</li>'; return; }
  ul.innerHTML = BK.map(b => {
    const tag = b.kind === "safe" ? ' <em>🛟 de seguretat</em>' : b.kind === "auto" ? ' <em>⏰ automàtica</em>' : "";
    return '<li class="bki"><button type="button" class="bkrow" data-id="' + esc(b.id) + '"><span class="bkd" aria-hidden="true">💾</span><span class="bkt"><b>' + esc(b.name || "Còpia de seguretat") + tag + '</b>'
      + '<small>' + esc(bkWhen(b.ts)) + ' · ' + b.nItems + ' articles · ' + b.nPh + ' fotos · ' + esc(whoName(b.who)) + (b.ver ? ' · v' + esc(b.ver) : '') + '</small></span><span class="bkr" aria-hidden="true">↶</span></button>'
      + '<button type="button" class="bkdel" data-id="' + esc(b.id) + '" aria-label="Elimina la còpia" title="Elimina la còpia">🗑️</button></li>';
  }).join("");
}
$("bkOpen").onclick = () => { bkRender(); bkLock(); $("bkdlg").showModal(); };
$("bkClose").onclick = () => $("bkdlg").close();
$("bkCreate").onclick = async () => { const b = await bkCreate($("bkName").value.trim().replace(/\s+/g, " ")); if(b) $("bkName").value = ""; };
$("bkName").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); $("bkCreate").click(); } });
$("bkList").addEventListener("click", e => {
  if(bkBusy) return;
  const d = e.target.closest(".bkdel"), r = e.target.closest(".bkrow"), el = d || r; if(!el) return;
  const b = BK.find(x => x.id === el.dataset.id); if(!b) return;
  bkConfirm = {id:b.id, mode:d ? "del" : "restore"};
  const info = b.nItems + " articles · " + b.nPh + " fotos · " + bkWhen(b.ts) + " · " + whoName(b.who);
  $("bkcLabel").textContent = b.name || "Còpia de seguretat";
  $("bkcInfo").textContent = info;
  if(d){
    $("bkcTitle").textContent = "Eliminar aquesta còpia?";
    $("bkcWarn").textContent = "S'esborrarà de manera definitiva. No es pot desfer.";
    $("bkcYes").textContent = "🗑️ Sí, elimina";
  } else {
    $("bkcTitle").textContent = "Restaurar aquesta còpia?";
    $("bkcWarn").textContent = "⚠️ Es substituiran TOTS els articles, fotos, pendents, zones, ubicacions i ajustos actuals per els d'aquesta còpia, també als altres dispositius. L'historial de ↶ Desfés s'esborrarà. Abans de restaurar es crea una còpia automàtica de l'estat actual, per poder tornar enrere.";
    $("bkcYes").textContent = "↶ Sí, restaura";
  }
  $("bkcdlg").showModal();
});
$("bkcNo").onclick = () => { bkConfirm = null; $("bkcdlg").close(); };
$("bkcYes").onclick = async () => {
  const c = bkConfirm; bkConfirm = null; $("bkcdlg").close(); if(!c) return;
  if(c.mode === "del") await bkDelete(c.id); else await bkRestore(c.id);
};
const __cloudAuth34 = cloudAuth;
cloudAuth = function(u){ BK = []; bkLoaded = false; bkAutoDone = false; aiDisarm(); if($("bkdlg").open) $("bkdlg").close(); __cloudAuth34(u); };
const __cloudItems34 = cloudItems;
cloudItems = function(d, m){ __cloudItems34(d, m); bkAutoCheck(); };
const __cfgApply34 = cfgApply;
cfgApply = function(){ __cfgApply34(); if($("bkdlg").open) bkRender(); bkAutoCheck(); };

/* ---- 🔴 assistent d'ordres: 3 tocs giren el robot, el 4t obre el panell (si no, torna sol als 3 s) ---- */
let aiArmed = false, aiArmT = 0, aiOpenT = 0;
const aiTaps = [];
function aiArm(){
  aiArmed = true; clearTimeout(aiArmT);
  $("aiFab").classList.add("flipped"); hop($("aiFab"));
  $("aiFab").setAttribute("aria-label", "Obre l'assistent d'ordres (toca una altra vegada)");
  aiArmT = setTimeout(aiDisarm, cfgGet("coin"));
}
function aiDisarm(){
  clearTimeout(aiArmT); clearTimeout(aiOpenT); aiTaps.length = 0;
  if(!aiArmed) return;
  aiArmed = false;
  if(!adminOn){ $("aiFab").classList.remove("flipped"); hop($("aiFab")); $("aiFab").setAttribute("aria-label", "Obre l'assistent de productes"); }
}
function adminOpen(){
  clearTimeout(aiArmT); aiArmed = false;
  if(!$("aiPanel").hidden) aiOpen(false);
  adminOn = true;
  $("aiFab").classList.add("flipped");
  $("aiFab").setAttribute("aria-label", "Tanca l'assistent d'ordres");
  $("rPanel").hidden = false;
  if(!$("rMsgs").children.length) rGreet();
  if(!isTouch) $("rIn").focus();
}
function adminClose(){
  aiDisarm();
  if(!adminOn) return;
  adminOn = false;
  $("rPanel").hidden = true;
  $("aiFab").classList.remove("flipped"); hop($("aiFab"));
  $("aiFab").setAttribute("aria-label", "Obre l'assistent de productes");
}
$("aiFab").onclick = () => {
  if(adminOn){ adminClose(); return; }
  if(aiArmed){ adminOpen(); return; }               /* 4t toc */
  if(!$("aiPanel").hidden){ clearTimeout(aiOpenT); aiTaps.length = 0; aiOpen(false); return; }
  const now = Date.now(), win = cfgGet("tap");
  while(aiTaps.length && now - aiTaps[0] > win) aiTaps.shift();
  aiTaps.push(now); clearTimeout(aiOpenT); walleWarm();
  if(aiTaps.length >= 3){ aiTaps.length = 0; aiArm(); return; }  /* 3 tocs: gira la moneda */
  aiOpenT = setTimeout(() => { aiTaps.length = 0; aiOpen(true); walleSay(); }, cfgGet("aiwait"));   /* toc simple: assistent normal */
};

/* ---- ordres noves per a l'assistent ---- */
function rBackup(nt, t0, n0){
  if(/^(?:fes|fer|crea|crear|genera|vull)\s+(?:me\s+)?(?:una\s+)?(?:nova\s+)?(?:copia|backup)\b/.test(n0)){
    if(needSession()) return true;
    rConfirm("Creo una còpia de seguretat de tot l'inventari (" + DATA.filter(live).length + " articles i " + phIds().size + " fotos). Confirmes?", () => {
      bkCreate("Còpia de l'assistent", {quiet:true}).then(b => rMsg("bot", b ? "✓ Còpia creada: " + b.nItems + " articles i " + b.nPh + " fotos." : "⚠️ No s'ha pogut crear la còpia."));
      return "⏳ Creant la còpia…";
    });
    return true;
  }
  if(/(quines|mostra|ensenya|llista|veure).*(copies|backups|copia)/.test(nt)){
    if(!bkLoaded){ rMsg("bot", "Encara estic carregant les còpies. Torna-ho a provar en un moment."); return true; }
    rMsg("bot", BK.length ? "💾 Còpies de seguretat (" + BK.length + " de " + cfgGet("bkMax") + "):\n\n" + BK.slice(0, 10).map(b => "• " + bkWhen(b.ts) + " · " + (b.name || "Còpia de seguretat") + " · " + b.nItems + " articles").join("\n") + "\n\nPer restaurar-ne una, obre ⚙️ → 💾 Còpies de seguretat." : "Encara no hi ha cap còpia. Digues «fes una còpia de seguretat».");
    return true;
  }
  return false;
}

/* ---- 📱🖥️ vista mòbil / vista PC ---- */
const isPhone = isTouch && Math.min(screen.width, screen.height) < 768;
const MQL = [];
function mqCollect(){
  if(MQL.length) return;
  for(const sh of document.styleSheets){ let rs; try { rs = sh.cssRules; } catch(e){ continue; } for(const r of rs){ if(typeof CSSMediaRule !== "undefined" && r instanceof CSSMediaRule) MQL.push({r, o:r.media.mediaText}); } }
}
function mqEval(t, w){
  let res = false;
  for(const p of t.split(",")){
    if(/prefers|pointer|hover|orientation|print|resolution|height/.test(p)) return null;
    const cs = [...p.matchAll(/\((max|min)-width:\s*([\d.]+)px\)/g)];
    if(!cs.length) return null;
    if(cs.every(c => c[1] === "max" ? w <= +c[2] : w >= +c[2])) res = true;
  }
  return res;
}
function mqForce(w){ mqCollect(); MQL.forEach(m => { const v = mqEval(m.o, w); m.r.media.mediaText = v === null ? m.o : (v ? "all" : "not all"); }); }
function mqReset(){ MQL.forEach(m => { m.r.media.mediaText = m.o; }); }
const vmSaved = () => { const v = load("inv_vm", "auto"); return v === "mobile" || v === "pc" ? v : "auto"; };
const vmNatural = () => isPhone ? "mobile" : "pc";
const vmEff = () => { const s = vmSaved(); return s === "auto" ? vmNatural() : s; };
function vmApply(){
  const mode = vmEff(), meta = document.querySelector('meta[name="viewport"]');
  const base = "width=device-width, initial-scale=1, viewport-fit=cover";
  mqReset(); document.body.classList.remove("vm-mobile"); document.documentElement.classList.remove("vm");
  if(isPhone){ meta.setAttribute("content", mode === "pc" ? "width=1280, viewport-fit=cover" : base); }
  else {
    meta.setAttribute("content", base);
    if(mode === "mobile"){ document.body.classList.add("vm-mobile"); document.documentElement.classList.add("vm"); mqForce(430); }
  }
  const b = $("vmBtn"); b.dataset.m = mode; b.setAttribute("aria-checked", String(mode === "pc"));
  b.title = mode === "pc" ? "Vista PC · toca per passar a vista mòbil" : "Vista mòbil · toca per passar a vista PC";
}
$("vmBtn").onclick = () => {
  const next = vmEff() === "pc" ? "mobile" : "pc";
  store("inv_vm", next === vmNatural() ? "auto" : next);
  vmApply();
  if(!isPhone && next === "pc" && innerWidth < 900) toast("La finestra és molt estreta: amplia-la per veure bé la vista PC.");
  else toast(next === "pc" ? "🖥️ Vista PC" : "📱 Vista mòbil");
};
vmApply();

/* =====================================================================
   v3.5 · So de WALL-E en obrir l'assistent de productes
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

/* =====================================================================
   v3.6 · Canvi d'ubicació des de la fitxa, treball sense connexió,
   exportació en .html i versió de l'àudio de WALL-E
   ===================================================================== */
/* ---- 📍 canviar la ubicació des del botó blau de la fitxa ---- */
let lpSel = [], lpId = null;
function lpRender(){
  const all = [...new Set([...LOCS, ...lpSel])];
  $("lpList").innerHTML = all.map(l => {
    const on = lpSel.includes(l);
    return '<button type="button" class="lpi' + (on ? ' on' : '') + '" data-l="' + esc(l) + '" aria-pressed="' + on + '"><span class="lpk" aria-hidden="true">' + (on ? '✓' : '') + '</span><span class="lpic">' + locIconSvg(locIconKey(l), 20) + '</span><span class="lpn">' + esc(l) + '</span>'
      + (on && lpSel.length > 1 && lpSel[0] === l ? '<em>principal</em>' : '') + '</button>';
  }).join("");
  $("lpSave").disabled = !lpSel.length;
}
$("dLoc").onclick = () => {
  const c = DATA[cur]; if(!c) return;
  lpId = c.id; lpSel = locsOf(c).slice();
  $("lpName").textContent = c.item; $("lpNew").value = "";
  lpRender(); $("lpdlg").showModal();
};
$("lpList").addEventListener("click", e => {
  const b = e.target.closest(".lpi"); if(!b) return;
  const l = b.dataset.l, k = lpSel.indexOf(l);
  if(k >= 0) lpSel.splice(k, 1); else lpSel.push(l);
  lpRender();
});
function lpAdd(){
  const name = $("lpNew").value.trim().replace(/\s+/g, " ");
  if(!name){ $("lpNew").focus(); return; }
  const dup = [...new Set([...LOCS, ...lpSel])].find(l => norm(l) === norm(name));
  const l = dup || name;
  if(!lpSel.includes(l)) lpSel.push(l);
  $("lpNew").value = ""; lpRender();
}
$("lpAdd").onclick = lpAdd;
$("lpNew").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); lpAdd(); } });
$("lpCancel").onclick = () => $("lpdlg").close();
$("lpSave").onclick = () => {
  const L = lpSel.slice(), i = DATA.findIndex(x => x.id === lpId && live(x));
  $("lpdlg").close();
  if(i < 0){ toast("Aquest article ja no existeix."); return; }
  const c = DATA[i];
  if(!L.length || stable(L) === stable(locsOf(c))) return;
  const fresh = L.filter(l => !LOCS.includes(l) && !userLocs.includes(l));
  if(fresh.length){ userLocs.push(...fresh); store("inv_locs", userLocs); }
  saveItem(i, {loc:L[0], locs:L});
  toast("📍 «" + c.item + "» ara és a " + L.join(", ") + ".");
  if(order.includes(i)){ pos = order.indexOf(i); cur = i; idx = 0; showDlg(); }
  else { toast("📍 «" + c.item + "» ara és a " + L.join(", ") + ". Ja no coincideix amb el filtre actual."); afterReview(); }
};

/* ---- 📴 treball sense connexió ---- */
function cloudPend(d){
  const was = inflight;
  inflight = Math.max(0, inflight + d);
  if(d > 0 && netOffline()) hadOfflinePending = true;
  if(inflight === 0 && was > 0 && hadOfflinePending && !netOffline()){
    hadOfflinePending = false;
    toast("✓ Connexió recuperada: els canvis fets sense connexió ja són al núvol.");
  }
  cloudSetStatus();
}
addEventListener("offline", () => {
  cloudSetStatus();
  if(cloudUser) toast("📴 Sense connexió. Pots seguir fent canvis: es sincronitzaran quan tornis a tenir internet.");
});
addEventListener("online", () => {
  cloudSetStatus();
  if(cloudUser && (inflight > 0 || itemsPending)) toast("🌐 Connexió recuperada. Sincronitzant els canvis…");
});
if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
  addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}

/* ---- ⬇️ exportar la còpia en format .html (es pot obrir en qualsevol navegador i es pot tornar a importar) ---- */
async function cloudExport(){
  if(!DATA.filter(live).length){ toast("No hi ha cap article per exportar."); return; }
  toast("Preparant el fitxer… (baixant les fotos)");
  try {
    const list = DATA.filter(live), all = await cloud.allPhotos();
    const full = c => (c._ph || []).map(p => all.get(p) || PHF.get(p)).filter(Boolean);
    const items = list.map(c => { const o = cleanItem(c); o.photos = full(c); return o; });
    const keys = {}; KEYS_CLOUD.forEach(k => { if(STATE[k] !== undefined) keys[k] = STATE[k]; });
    const now = new Date();
    const payload = JSON.stringify({app:"inventari-casa", version:APP_VER, exportedAt:now.toISOString(), items, keys}).replace(/</g, "\\u003c");
    const nPh = items.reduce((n, c) => n + c.photos.length, 0);
    const when = now.toLocaleDateString("ca", {day:"2-digit", month:"2-digit", year:"numeric"}) + " " + now.toLocaleTimeString("ca", {hour:"2-digit", minute:"2-digit"});
    let body = "";
    for(const z of CATS){
      const its = list.filter(c => catsOf(c)[0] === z.id);
      if(!its.length) continue;
      body += '<section><h2>' + z.icon + ' ' + esc(z.label) + ' <span>' + its.length + '</span></h2><div class="xg">';
      for(const c of its){
        const t = c.photos.length ? await thumbOf(c) : "";
        const s = norm(c.item + " " + c.desc + " " + c.note + " " + locsOf(c).join(" ") + " " + zonesOf(c).join(" "));
        body += '<article class="xc" data-s="' + esc(s) + '"><div class="xp">' + (t ? '<img alt="' + esc(c.item) + '" src="' + t + '">' : '📦') + '<b>' + esc(qtyBadge(c.qty)) + '</b></div>'
          + '<div class="xi"><h3>' + esc(c.item) + '</h3><p class="xl">📍 ' + esc(locsOf(c).join(" · ")) + (catsOf(c).length > 1 ? ' · 🏠 ' + esc(zonesOf(c).join(", ")) : '') + '</p>'
          + (c.desc ? '<p>' + esc(c.desc) + '</p>' : '') + (c.note ? '<p class="xn">' + esc(c.note) + '</p>' : '') + '</div></article>';
      }
      body += '</div></section>';
    }
    const css = 'body{margin:0;background:#000;color:#fff;font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}header{padding:16px 14px 10px;border-bottom:2px solid #3a3a3a}h1{margin:0;font-size:22px}header p{margin:4px 0 10px;color:#c2c2c2;font-size:14px}'
      + 'input{width:100%;box-sizing:border-box;font:inherit;padding:11px 14px;border-radius:12px;border:2px solid #3a3a3a;background:#0c0c0c;color:#fff}main{padding:6px 14px 40px}section{margin-top:22px}section h2{font-size:19px;margin:0 0 10px}section h2 span{font-size:14px;font-weight:500;color:#c2c2c2}'
      + '.xg{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}.xc{background:#0c0c0c;border:2px solid #3a3a3a;border-radius:14px;overflow:hidden}.xc[hidden],section[hidden]{display:none}'
      + '.xp{position:relative;aspect-ratio:4/3;background:#000;display:flex;align-items:center;justify-content:center;font-size:40px;overflow:hidden}.xp img{width:100%;height:100%;object-fit:cover}.xp b{position:absolute;left:8px;top:8px;background:#fff;color:#000;font-size:13px;padding:1px 9px;border-radius:999px}'
      + '.xi{padding:9px 11px 11px}.xi h3{margin:0 0 3px;font-size:15px}.xi p{margin:2px 0;font-size:13px;color:#c2c2c2}.xi .xl{color:#4fe3d2;font-weight:700}.xi .xn{color:#ffd166}';
    const js = '(function(){var q=document.getElementById("q");q.oninput=function(){var v=q.value.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"");document.querySelectorAll(".xc").forEach(function(c){c.hidden=!!v&&c.dataset.s.indexOf(v)<0});document.querySelectorAll("section").forEach(function(s){s.hidden=!s.querySelector(".xc:not([hidden])")})}})();';
    const html = '<!DOCTYPE html>\n<html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inventari de casa · còpia ' + esc(when) + '</title><style>' + css + '</style></head><body>'
      + '<header><h1>📦 Inventari de casa</h1><p>Còpia del ' + esc(when) + ' · ' + list.length + ' articles · ' + nPh + ' fotos · v' + APP_VER + '</p><input id="q" type="search" placeholder="Cerca a la còpia…" autocomplete="off"></header>'
      + '<main>' + body + '</main>'
      + '<script type="application/json" id="inv-data">' + payload + '<' + '/script><script>' + js + '<' + '/script></body></html>';
    const blob = new Blob([html], {type:"text/html"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "inventari_copia_" + now.toISOString().slice(0, 10) + ".html";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast("✓ Còpia descarregada (.html): " + list.length + " articles i " + nPh + " fotos.");
  } catch(e){ console.error(e); toast("⚠️ No s'ha pogut preparar el fitxer."); }
}

/* =====================================================================
   v3.7 · % d'articles per ubicació i zona (sense objectius), resum,
   nous ajustos i manteniment al panell de configuració
   ===================================================================== */
/* ---- estadístiques de l'inventari ---- */
const FREE_BYTES = 1073741824; /* 1 GiB: límit gratuït de Firestore */
const mbTxt = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace(".", ",");
function invStats(){
  const L = DATA.filter(live), tot = L.length;
  const units = L.reduce((s, c) => s + (typeof c.qty === "number" ? c.qty : 0), 0);
  /* v6: les fotos completes no són totes a la memòria; la mida es calcula amb la mitjana de les que s'han obert */
  const phN = phIds().size, seen = [...PHF.values()];
  const avg = seen.length >= 5 ? seen.reduce((s, u) => s + u.length, 0) / seen.length : PH_AVG;
  const thBytes = [...PHT.values()].reduce((s, u) => s + u.length, 0);
  const phBytes = phN * avg;
  const bkBytes = BK.reduce((s, b) => s + (b.nPh || 0) * avg + (b.nItems || 0) * 1500, 0);
  const bytes = phBytes + thBytes + tot * 1500 + bkBytes + HIST.length * 1200 + CHAT.length * 200;
  return {
    tot, units,
    withPh: L.filter(c => c.photos.length).length,
    rev: L.filter(needsReview).length,
    pend: CATS.reduce((s, z) => s + pendRows(z.id).filter(r => !have[r.key]).length, 0),
    byLoc: LOCS.map(l => ({name:l, n:totLoc(l), p:pctOf(totLoc(l), tot)})),
    byCat: CATS.map(z => ({name:z.icon + " " + z.label, n:totCat(z.id), p:pctOf(totCat(z.id), tot)})),
    phN, phBytes, bkBytes, bytes, bkN: BK.length
  };
}
function cfgSummaryHtml(){
  const s = invStats(), pct = Math.min(100, s.bytes / FREE_BYTES * 100), cls = pct >= 85 ? "bad" : pct >= 60 ? "warn" : "ok";
  const box = (v, l) => '<div class="cfstat"><b>' + v + '</b><small>' + l + '</small></div>';
  const orph = orphLast;
  return '<div class="cfg"><h3>📊 Resum</h3><p class="cfn">El % de cada ubicació i de cada zona és el tant per cent d\'articles que hi ha guardats allà respecte al total. Un article que és a dues zones (o ubicacions) compta a totes dues.</p>'
    + '<div class="cfstats">' + box(s.tot, "articles") + box(s.units, "unitats") + box(s.withPh, "amb foto") + box(s.rev, "per revisar") + box(s.pend, "pendents") + box(LOCS.length, LOCS.length === 1 ? "ubicació" : "ubicacions") + '</div>'
    + '<div class="cfspace"><span>💾 Espai al núvol (aprox.): <b>' + mbTxt(s.bytes) + ' MB</b> de 1024 MB (' + pct.toFixed(1).replace(".", ",") + ' %)</span>'
    + '<span class="cfbar" aria-hidden="true"><i class="' + cls + '" style="width:' + Math.max(1, pct).toFixed(1) + '%"></i></span>'
    + '<span>' + s.phN + ' fotos (' + mbTxt(s.phBytes) + ' MB) · ' + s.bkN + (s.bkN === 1 ? ' còpia' : ' còpies') + ' (~' + mbTxt(s.bkBytes) + ' MB)'
    + (orph && orph.length ? ' · <b>' + orph.length + (orph.length === 1 ? ' foto sense ús' : ' fotos sense ús') + '</b>' : '') + '</span></div>';
}
function cfgTimeRows(row){
  return row("Segons que es veu l'avís", "Entre 2 i 15 s · per defecte " + String(CFGD.toast / 1000).replace(".", ","), 'data-t="toast" min="2" max="15" step="0.5"', cfgGet("toast") / 1000, "s")
    + row("Segons abans de bloquejar la moneda", "Entre 1 i 10 s · per defecte " + String(CFGD.coin / 1000).replace(".", ","), 'data-t="coin" min="1" max="10" step="0.5"', cfgGet("coin") / 1000, "s");
}
function cfgMoreHtml(row){
  const th = themeVals();
  const sw = id => '<button type="button" class="thsw" data-p="' + id + '" title="' + THEME_PRESETS[id].name + '" aria-label="Tema ' + THEME_PRESETS[id].name + '" style="--sw:' + THEME_PRESETS[id].accent + '"></button>';
  const crow = (k, title, sub) => '<label class="cfrow"><span class="cft"><b>' + title + '</b><small>' + sub + '</small></span><span class="cfin"><input type="color" data-th="' + k + '" value="' + th[k] + '"><i class="hx">' + th[k] + '</i></span></label>';
  return row("Mida de les targetes (PC)", "Entre 140 i 400 px · per defecte " + CFGD.cardmin + " · més petit = més targetes per fila", 'data-t="cardmin" min="140" max="400" step="5"', cfgGet("cardmin"), "px")
    + row("Cartell NEW durant", "Entre 0 i 60 dies · 0 = desactivat · per defecte 3 · els articles nous surten amb el cartell NEW i a dalt de tot", 'data-t="newDays" min="0" max="60" step="1"', cfgGet("newDays"), "dies")
    + row("Ordre dels articles", "0 = ordre original · 1 = nom A→Z · 2 = més recents primer · per defecte 0 · els NEW sempre a dalt", 'data-t="sortMode" min="0" max="2" step="1"', cfgGet("sortMode"), "0–2")
    + row("Foto a la vista llista", "Entre 40 i 120 px · per defecte 76", 'data-t="lph" min="40" max="120" step="2"', cfgGet("lph"), "px")
    + row("Cantonades arrodonides", "Entre 4 i 28 px · per defecte 14", 'data-t="rad" min="4" max="28" step="1"', cfgGet("rad"), "px")
    + '</div><div class="cfg"><h3>🎨 Colors</h3><p class="cfn">Colors bàsics de la web. Es comparteixen entre dispositius i també els pots canviar amb l\'assistent d\'ordres («tema verd», «color del fons blau fosc»…).</p>'
    + '<div class="thpre">' + Object.keys(THEME_PRESETS).map(sw).join("") + '</div>'
    + crow("accent", "Color principal", "Botons, ubicacions, barres i filtres")
    + crow("bg", "Color del fons", "Només colors foscos")
    + crow("ink", "Color del text", "Ha de contrastar amb el fons")
    + crow("newc", "Color del cartell NEW", "Per defecte vermell")
    + '<button type="button" class="wtest" id="thReset">↺ Colors per defecte</button>'
    + '</div><div class="cfg"><h3>📱 Mòbil</h3><p class="cfn">Com es comporta la web al telèfon.</p>'
    + row("Barra de cerca intel·ligent", "1 = s'amaga en baixar i torna en pujar · 0 = sempre visible · per defecte 1", 'data-t="smartbar" min="0" max="1" step="1"', cfgGet("smartbar"), "0/1")
    + row("Vibració en tocar", "1 = una petita vibració als botons (Android) · per defecte 0", 'data-t="vib" min="0" max="1" step="1"', cfgGet("vib"), "0/1")
    + row("Espera del toc simple a l'assistent", "Entre 0,2 i 1 s · per defecte 0,45 · temps per distingir un toc d'un triple toc", 'data-t="aiwait" min="0.2" max="1" step="0.05"', cfgGet("aiwait") / 1000, "s")
    + '</div><div class="cfg"><h3>💬 Xat</h3><p class="cfn">So d\'avís quan t\'arriba un missatge amb el xat tancat (amb la pàgina oberta).</p>'
    + row("Volum de l'avís del xat", "Entre 0 i 100 · 0 = en silenci · per defecte " + CFGD.chatVol, 'data-t="chatVol" min="0" max="100" step="1"', cfgGet("chatVol"), "%")
    + '<button type="button" class="wtest" id="cTest">▶ Prova l\'avís</button>'
    + '</div><div class="cfg"><h3>🧹 Manteniment</h3><p class="cfn">Esborra les fotos que ja no fa servir cap article ni cap canvi de l\'historial. Ajuda a no omplir l\'espai gratuït del núvol.</p>'
    + '<button type="button" class="wtest" id="cClean">🧹 Neteja les fotos sense ús</button>';
}
/* ---- fotos sense ús ----
   v6: per saber-ho cal mirar totes les fotos del núvol; es fa només quan toques «Neteja». */
let orphLast = null;
function orphanPhotos(all){
  if(!cloudLoaded || itemsCache || !histLoaded) return null;
  const ref = phIds();
  const hist = o => o && (o.ph || []).forEach(x => ref.add(x));
  HIST.forEach(h => (h.parts || []).forEach(p => { if(p.k === "item"){ hist(p.before); hist(p.after); } }));
  if(HG) HG.parts.forEach(p => { if(p.k === "item"){ hist(p.before); hist(p.after); } });
  DATA.forEach(c => (c._ph || []).forEach(x => ref.add(x)));
  return [...all.keys()].filter(x => !ref.has(x));
}
async function photoClean(){
  if(!cloudUser || !window.cloud || netOffline() || inflight > 0 || itemsPending){ toast("Cal tenir connexió i cap canvi pendent de sincronitzar."); return; }
  if(!cloudLoaded || itemsCache || !histLoaded){ toast("Espera que s'acabi de carregar tot i torna-ho a provar."); return; }
  toast("🔎 Revisant les fotos del núvol…");
  let all;
  try { all = await cloud.allPhotos(); } catch(e){ cloudErr(e); return; }
  const dead = orphanPhotos(all) || [];
  orphLast = dead;
  if(!dead.length){ toast("✓ No hi ha cap foto sense ús."); if($("cfdlg").open) cfgRender(); return; }
  const bytes = dead.reduce((s, id) => s + (all.get(id) || "").length, 0);
  if(!confirm("Esborrar " + dead.length + (dead.length === 1 ? " foto" : " fotos") + " sense ús (≈ " + mbTxt(bytes) + " MB)?\n\nNo les fa servir cap article ni cap canvi de l'historial.")) return;
  cloud.batch(dead.map(id => ({t:"del", col:"photos", id})))
    .then(() => { orphLast = []; toast("🧹 " + dead.length + (dead.length === 1 ? " foto esborrada" : " fotos esborrades") + " (≈ " + mbTxt(bytes) + " MB)."); setTimeout(() => { if($("cfdlg").open) cfgRender(); }, 700); })
    .catch(cloudErr);
}
$("cfBody").addEventListener("click", e => {
  if(e.target.closest("#cClean")) photoClean();
  else if(e.target.closest("#cTest")) chatBeep(true);
});

/* ---- avís sonor del xat ---- */
function chatCtx(){
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
  wCtx = wCtx || new AC(); if(wCtx.state === "suspended") wCtx.resume();
  return wCtx;
}
function chatBeep(force){
  const v = cfgGet("chatVol") / 100;
  if(v <= 0){ if(force) toast("El volum de l'avís del xat està a 0."); return; }
  try {
    const c = chatCtx(); if(!c) return;
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
addEventListener("pointerdown", () => { if(cfgGet("chatVol") > 0){ try { chatCtx(); } catch(e){} } }, {passive:true});

/* ---- ordres noves de l'assistent ---- */
function rStats(nt){
  if(!/\bresum\b|estadistiqu|percentatge|ocupacio|quin espai|espai ocup|espai al nuvol/.test(nt)) return false;
  const s = invStats(), pct = Math.min(100, s.bytes / FREE_BYTES * 100).toFixed(1).replace(".", ",");
  rMsg("bot", "📊 Resum\n\nArticles: " + s.tot + " (" + s.units + " unitats) · amb foto " + s.withPh + " · per revisar " + s.rev + " · pendents " + s.pend
    + "\n\n📍 Ubicacions: " + (s.byLoc.map(x => x.name + " " + x.n + " (" + x.p + "%)").join(" · ") || "—")
    + "\n🏠 Zones: " + s.byCat.map(x => x.name + " " + x.n + " (" + x.p + "%)").join(" · ")
    + "\n\n💾 Espai al núvol (aprox.): " + mbTxt(s.bytes) + " MB de 1024 MB (" + pct + " %)");
  return true;
}

/* =====================================================================
   v4.0 · Cartell NEW i ordre, colors bàsics, més pendents i mòbil renovat
   ===================================================================== */
/* ---- 🆕 NEW: quan caduca, es treu de dalt de tot ---- */
let lastNewCount = -1;
setInterval(() => {
  const n = DATA.filter(c => live(c) && isNew(c)).length;
  if(lastNewCount < 0){ lastNewCount = n; return; }
  if(n !== lastNewCount){ lastNewCount = n; render(); }
}, 60000);
$("dNew").onclick = () => {
  const c = DATA[cur]; if(!c) return;
  saveItem(cur, {nouVist:true}); afterReview();
  toast("«" + c.item + "» ja no té el cartell NEW.");
};

/* ---- 🎨 colors al panell d'ajustos ---- */
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
function themeCommit(patch){
  const T = Object.assign(themeVals(), patch), err = themeCheck(T);
  if(err) return err;
  store("inv_theme", themeClean(T)); themeApply();
  if($("cfdlg").open) cfgRender();
  return "";
}
$("cfBody").addEventListener("change", e => {
  const t = e.target; if(!t.dataset || !t.dataset.th) return;
  const err = themeCommit({[t.dataset.th]: t.value});
  if(err){ toast("⚠️ " + err); cfgRender(); }
});
$("cfBody").addEventListener("click", e => {
  const sw = e.target.closest(".thsw");
  if(sw){ const p = THEME_PRESETS[sw.dataset.p]; if(!p) return; const err = themeCommit({accent:p.accent, bg:p.bg}); toast(err ? "⚠️ " + err : "🎨 Tema " + p.name.toLowerCase() + "."); return; }
  if(e.target.closest("#thReset")){
    if(!Object.keys(themeClean(themeRaw())).length){ toast("Ja estan els colors per defecte."); return; }
    store("inv_theme", {}); themeApply(); cfgRender(); toast("↺ Colors restaurats.");
  }
});

/* ---- 📱 mòbil: barra intel·ligent (s'amaga en baixar, torna en pujar) ---- */
(function(){
  const bar = $("fbar"); let lastY = scrollY;
  addEventListener("scroll", () => {
    const y = scrollY;
    if(getComputedStyle(bar).position !== "sticky" || !cfgGet("smartbar")){ bar.classList.remove("hide"); lastY = y; return; }
    if(y < 90 || y < lastY - 6) bar.classList.remove("hide");
    else if(y > lastY + 12 && !bar.contains(document.activeElement)) bar.classList.add("hide");
    lastY = y;
  }, {passive:true});
})();
/* vibració suau en tocar botons (Android) */
document.addEventListener("pointerdown", e => {
  if(!cfgGet("vib") || e.pointerType !== "touch" || !navigator.vibrate) return;
  if(e.target.closest && e.target.closest("button, .chip, .card-btn, label.cfrow")) { try { navigator.vibrate(8); } catch(_){} }
}, {passive:true});
/* centra el filtre de zona actiu a la fila horitzontal */
let chipKeyPrev = "";
function chipFocus(box){
  const key = state.cat + "|" + state.review;
  if(key === chipKeyPrev) return; chipKeyPrev = key;
  const b = box.querySelector('[aria-pressed="true"]');
  if(b && box.scrollWidth > box.clientWidth) box.scrollLeft = Math.max(0, b.offsetLeft - (box.clientWidth - b.offsetWidth) / 2);
}

/* ---- 🤖 assistent d'ordres: colors i ordre ---- */
const COLOR_NAMES = {
  "turquesa":"#4fe3d2", "turquesa fosc":"#1aa89a", "cian":"#22d3ee", "cyan":"#22d3ee",
  "blau":"#3b82f6", "azul":"#3b82f6", "blau cel":"#7dc4ff", "azul cielo":"#7dc4ff", "blau fosc":"#1e40af", "azul oscuro":"#1e40af", "marino":"#1e3a8a",
  "verd":"#2fd16b", "verde":"#2fd16b", "verd fosc":"#15803d", "verde oscuro":"#15803d", "verd llima":"#a3e635", "lima":"#a3e635",
  "groc":"#ffd23f", "amarillo":"#ffd23f", "taronja":"#ff8a1f", "naranja":"#ff8a1f", "vermell":"#ef3b3b", "rojo":"#ef3b3b",
  "rosa":"#ff6fb5", "fucsia":"#e11d9a", "lila":"#b388ff", "morat":"#a855f7", "morado":"#a855f7", "violeta":"#8b5cf6",
  "marro":"#a0622d", "marron":"#a0622d", "gris":"#9ca3af", "plata":"#d4d4d8", "blanc":"#ffffff", "blanco":"#ffffff", "negre":"#000000", "negro":"#000000",
  "or":"#f5c242", "oro":"#f5c242", "dorat":"#f5c242"
};
const COLOR_KEYS = Object.keys(COLOR_NAMES).sort((a, b) => b.length - a.length);
const PRESET_OF = {turquesa:"turquesa", cian:"blau", cyan:"blau", blau:"blau", azul:"blau", verd:"verd", verde:"verd", lima:"verd", rosa:"rosa", fucsia:"rosa", taronja:"taronja", naranja:"taronja", lila:"lila", morat:"lila", morado:"lila", violeta:"lila", groc:"groc", amarillo:"groc", gris:"gris", plata:"gris", vermell:"vermell", rojo:"vermell"};
function rColorFind(n0){
  const m = /#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/i.exec(n0);
  if(m){ let h = m[1].toLowerCase(); if(h.length === 3) h = h.split("").map(c => c + c).join(""); return {hex:"#" + h, label:"#" + h}; }
  for(const k of COLOR_KEYS){ if(new RegExp("(^|[^a-z])" + k + "($|[^a-z])").test(n0)) return {hex:COLOR_NAMES[k], label:k, key:k}; }
  return null;
}
function rTheme(nt, t0, n0){
  if(/confeti|celebraci/.test(nt)) return false;
  if(!/\bcolors?\b|\btema\b|\bpaleta\b|\bfons\b|\bfondo\b|\bcolour\b/.test(nt)) return false;
  const th = themeVals();
  if(/(restaura|reinicia|reseteja|torna|treu).*(color|colors|tema|paleta)|(colors?|tema|paleta) per defecte/.test(nt)){
    if(needSession()) return true;
    if(!Object.keys(themeClean(themeRaw())).length){ rMsg("bot", "Els colors ja són els originals (turquesa sobre negre)."); return true; }
    rConfirm("Restauro els colors originals (turquesa sobre negre). Confirmes?", () => { store("inv_theme", {}); themeApply(); if($("cfdlg").open) cfgRender(); return "✓ Colors restaurats."; });
    return true;
  }
  const col = rColorFind(n0);
  if(!col){
    rMsg("bot", "🎨 Colors actuals\n• principal: " + th.accent + "\n• fons: " + th.bg + "\n• text: " + th.ink + "\n• cartell NEW: " + th.newc
      + "\n\nPuc canviar-los així:\n• posa el color principal a blau\n• color del fons blau fosc\n• color del text #ffeecc\n• color del cartell NEW taronja\n• tema verd (rosa, lila, groc, taronja, gris, vermell…)\n• restaura els colors");
    return true;
  }
  if(needSession()) return true;
  if(/\b(tema|paleta)\b/.test(nt)){
    const pid = col.key && PRESET_OF[col.key];
    if(!pid){ rMsg("bot", "Temes disponibles: " + Object.values(THEME_PRESETS).map(p => p.name.toLowerCase()).join(", ") + ". Per exemple: «tema verd»."); return true; }
    const p = THEME_PRESETS[pid], T = Object.assign(themeVals(), {accent:p.accent, bg:p.bg}), err = themeCheck(T);
    if(err){ rMsg("bot", "⚠️ " + err); return true; }
    rConfirm("Poso el tema " + p.name.toLowerCase() + " (color principal " + p.accent + " sobre fons " + p.bg + "). Confirmes?", () => { const e = themeCommit({accent:p.accent, bg:p.bg}); return e ? "⚠️ " + e : "✓ Tema " + p.name.toLowerCase() + " aplicat a tots els dispositius."; });
    return true;
  }
  let tk = "accent";
  if(/\b(text|lletra|lletres|texto|letra)\b/.test(nt)) tk = "ink";
  else if(/\b(new|etiqueta|cartell|cartel|distintiu)\b/.test(nt)) tk = "newc";
  else if(/\b(fons|fondo|background)\b/.test(nt)) tk = "bg";
  let hex = col.hex, note = "";
  if(tk === "bg"){
    const rgb = hexRgb(hex);
    if(lumOf(rgb) > .6){ rMsg("bot", "El fons només pot ser fosc. Prova amb un color més fosc (per exemple «blau fosc» o «negre»)."); return true; }
    if(lumOf(rgb) > .012){ hex = rgbHex(mixRgb(rgb, [0, 0, 0], .88)); note = " (versió fosca de " + col.label + ")"; }
  }
  const err = themeCheck(Object.assign({}, th, {[tk]:hex}));
  if(err){ rMsg("bot", "⚠️ " + err + " Prova amb un altre color."); return true; }
  if(th[tk] === hex){ rMsg("bot", "Ja té aquest color."); return true; }
  rConfirm("Canvio el " + THEME_NAME[tk].toLowerCase().replace(" new", " NEW") + ": " + th[tk] + " → " + hex + note + ". Confirmes?", () => { const e = themeCommit({[tk]:hex}); return e ? "⚠️ " + e : "✓ Fet. Es veu a tots els dispositius."; });
  return true;
}
function rSort(nt){
  if(!/\b(ordena|ordenar|ordenats?|ordre)\b/.test(nt)) return false;
  const v = /alfab|\bnom\b|\ba z\b|a-z/.test(nt) ? 1 : /recent|nous|novetat|data|darrer|ultim/.test(nt) ? 2 : /original|defecte|normal|inici/.test(nt) ? 0 : null;
  if(v === null){ rMsg("bot", "Com els vols ordenar? «ordena per nom», «ordena per recents» o «ordre original»."); return true; }
  if(needSession()) return true;
  const nm = ["l'ordre original", "nom A→Z", "els més recents primer"];
  if(cfgGet("sortMode") === v){ rMsg("bot", "Ja estan ordenats així."); return true; }
  rConfirm("Poso l'ordre dels articles: " + nm[v] + ". Els NEW sempre surten a dalt. Confirmes?", () => { cfgCommit(c => { c.sortMode = v; }); return "✓ Fet."; });
  return true;
}

/* =====================================================================
   v5.0 · Filtres amb dial, Dashboard, confeti i Nau&Noa House
   ===================================================================== */
const TOG5 = ["fxOn", "houseOn", "houseBan", "houseShow", "dialTap", "dialVib", "dashOn", "dashAnim"];
const HOUSE_ALIAS = ["nau&noa house", "nau & noa house", "nau noa house", "nau i noa house", "nau&noa", "nau i noa", "nau noa"];
const vib = ms => { try { if(navigator.vibrate) navigator.vibrate(ms); } catch(_){} };
const ini = s => { const w = String(s).replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || "?").slice(0, 2)).toUpperCase(); };

/* ---------- botons de filtre: «Tot el món», «Totes» i «Revisar» ---------- */
const GLOBE_SVG = '<span class="globe" aria-hidden="true"><svg viewBox="0 0 34 34" fill="none" stroke="rgba(2,26,23,.55)" stroke-width="1.3"><path d="M2 12h30M1 17h32M2 22h30"/><g class="mer"><ellipse cx="17" cy="17" rx="6" ry="16"/><ellipse cx="17" cy="17" rx="12" ry="16"/><path d="M17 1v32"/><ellipse cx="51" cy="17" rx="6" ry="16"/><ellipse cx="-17" cy="17" rx="6" ry="16"/></g><path d="M8 9c3 1 4 4 2 6s1 4 4 4M22 6c-1 3 2 4 4 3M20 24c2-1 4 0 5 3" stroke="rgba(2,26,23,.85)" stroke-width="2.2" stroke-linecap="round"/></svg></span>';
let FB = null;
function buildFilters(){
  const box = $("chips"); box.innerHTML = "";
  const mk = (id, cls) => { const b = document.createElement("button"); b.type = "button"; b.id = id; b.className = "fbtn " + cls; box.appendChild(b); return b; };
  FB = {loc:mk("fLocBtn", "floc"), cat:mk("fCatBtn", "fcat"), rev:mk("fRevBtn", "frev")};
  FB.loc.setAttribute("aria-haspopup", "true"); FB.cat.setAttribute("aria-haspopup", "true");
  bindDial(FB.loc, "loc"); bindDial(FB.cat, "cat");
  FB.rev.onclick = () => { state.review = !state.review; state.cat = "all"; render(); };
}
function renderFilters(){
  if(!FB) buildFilters();
  const TOT = totAll(), fill = p => '<span class="fbg" aria-hidden="true"><i style="width:' + p + '%"></i></span>';
  /* ubicació */
  const la = state.loc === "all", nl = la ? TOT : totLoc(state.loc), pl = la ? 0 : pctOf(nl, TOT), hl = state.loc === HOUSE;
  FB.loc.setAttribute("aria-pressed", String(!la)); FB.loc.classList.toggle("house", hl && !la);
  FB.loc.innerHTML = fill(pl)
    + '<span class="fic' + (la ? '' : ' ini') + '">' + (la ? GLOBE_SVG : locIconSvg(locIconKey(state.loc), 24)) + '</span>'
    + '<span class="ft"><b>' + esc(la ? "Tot el món" : state.loc) + '</b><small>' + esc(la ? LOCS.length + (LOCS.length === 1 ? " ubicació" : " ubicacions") : nl + " art. · " + pl + "%") + '<span class="hint">' + esc(la ? " · mantén premut" : " · toca per treure") + '</span>' + '</small></span>'
    + '<span class="fn">' + nl + '</span>';
  FB.loc.setAttribute("aria-label", la ? "Tot el món. Toca o mantén premut per triar una ubicació" : "Ubicació: " + state.loc + ". Toca per treure el filtre");
  FB.loc.title = la ? "Mantén premut per triar una ubicació" : "Toca per treure el filtre · mantén premut per canviar";
  /* zona */
  const ca = state.cat === "all", z = ca ? null : CATS.find(x => x.id === state.cat), nc = ca || !z ? TOT : totCat(z.id), pc = ca || !z ? 0 : pctOf(nc, TOT);
  FB.cat.setAttribute("aria-pressed", String(!ca));
  FB.cat.innerHTML = fill(pc)
    + '<span class="fic">' + (ca || !z ? "📦" : z.icon) + '</span>'
    + '<span class="ft"><b>' + esc(ca || !z ? "Totes" : z.label) + '</b><small>' + esc(ca || !z ? CATS.length + (CATS.length === 1 ? " zona" : " zones") : nc + " art. · " + pc + "%") + '<span class="hint">' + esc(ca || !z ? " · mantén premut" : " · toca per treure") + '</span>' + '</small></span>'
    + '<span class="fn">' + nc + '</span>';
  FB.cat.setAttribute("aria-label", ca ? "Totes les zones. Toca o mantén premut per triar una zona" : "Zona: " + (z ? z.label : "") + ". Toca per treure el filtre");
  FB.cat.title = ca ? "Mantén premut per triar una zona" : "Toca per treure el filtre · mantén premut per canviar";
  /* revisar */
  const nr = DATA.filter((c, i) => live(c) && (state.loc === "all" || c.locs.includes(state.loc)) && (!state.q || qHit(i)) && needsReview(c)).length;
  FB.rev.setAttribute("aria-pressed", String(state.review));
  FB.rev.innerHTML = '<span class="fic" aria-hidden="true">⚠️</span><span class="fn">' + nr + '</span><small>Revisar</small>';
  FB.rev.setAttribute("aria-label", "Revisar: " + nr + " articles");
}

/* ---------- dial radial: mantén premut i llisca el dit ---------- */
const DL = {open:false, kind:"", mode:"", items:[], els:[], pos:[], act:-1, S:46, ox:0, oy:0, cx:0, cy:0, R:0, inner:40, multi:false, moved:false, px:null, py:null, hubEl:null, ptrEl:null, btn:null, down:null, timer:0, moving:false};
function dialItems(kind){
  const TOT = totAll(), out = [];
  if(kind === "loc"){
    const base = (c, i) => live(c) && (!state.review || needsReview(c)) && (state.cat === "all" || catsOf(c).includes(state.cat)) && (!state.q || qHit(i));
    out.push({id:"all", ik:"globe", label:"Tot el món", n:DATA.filter((c, i) => base(c, i)).length, g:TOT, p:100, sel:state.loc === "all", all:true});
    LOCS.forEach(l => { const g = totLoc(l); out.push({id:l, ik:locIconKey(l), label:l, n:DATA.filter((c, i) => base(c, i) && c.locs.includes(l)).length, g, p:pctOf(g, TOT), sel:state.loc === l, house:l === HOUSE}); });
  } else {
    const base = (c, i) => live(c) && (state.loc === "all" || c.locs.includes(state.loc)) && (!state.q || qHit(i));
    out.push({id:"all", icon:"📦", label:"Totes", n:DATA.filter((c, i) => base(c, i)).length, g:TOT, p:100, sel:state.cat === "all" && !state.review, all:true});
    CATS.forEach(z => { const g = totCat(z.id); out.push({id:z.id, icon:z.icon, label:z.label, n:DATA.filter((c, i) => base(c, i) && catsOf(c).includes(z.id)).length, g, p:pctOf(g, TOT), sel:!state.review && state.cat === z.id}); });
  }
  return out;
}
/* v5.1: cercle COMPLET. Tots els botons es reparteixen per igual al voltant d'un cercle (el primer, a dalt, en sentit horari).
   Si n'hi ha molts, els botons es fan més petits perquè hi càpiguen tots i, si encara no hi caben, es posa un segon anell. */
function dialGeom(n, ox, oy){
  const W = innerWidth, H = innerHeight, mx = cfgGet("dialMax") / 100, rad = a => a * Math.PI / 180;
  const half = Math.min(W, H) / 2 - 4, S0 = cfgGet("dialS"), R0 = cfgGet("dialR");
  const hf = s => s * (mx / 2 + (mx - 1) * .45) + 6;                 /* espai que cal perquè el botó ampliat no surti de la pantalla */
  const Rm = s => Math.max(46, half - hf(s));
  const cap = (r, s) => Math.max(1, Math.floor(2 * Math.PI * r / (s + 6)));
  let S = S0, rings = null;
  for(let s = S0; s >= 32 && !rings; s -= 2){                          /* 1 anell: es va reduint la mida i, si cal, s'agrandeix el radi */
    const rm = Rm(s);
    for(let r = Math.min(R0, rm); r <= rm + .1; r += 4){ if(cap(r, s) >= n){ S = s; rings = [{R:r, m:n}]; break; } }
  }
  const multi = s => {
    const rs = []; let r = Rm(s), tot = 0;
    while(rs.length < 5 && (r >= s * 1.15 + 14 || !rs.length) && tot < n){ const c = cap(r, s); rs.push({R:r, c}); tot += c; r -= s + 10; }
    return {rs, tot};
  };
  const dist = (rs, tot) => {
    const ms = rs.map(r => Math.min(r.c, Math.floor(n * r.c / tot)));
    let left = n - ms.reduce((a, b) => a + b, 0);
    for(let k = 0; left > 0 && k < 400; k++){ const i = k % rs.length; if(ms[i] < rs[i].c){ ms[i]++; left--; } }
    if(left > 0) ms[0] += left;
    return rs.map((r, i) => ({R:r.R, m:ms[i]})).filter(x => x.m > 0);
  };
  for(let s = Math.min(S0, 34); s >= 22 && !rings; s -= 2){            /* 2 o més anells concèntrics */
    const {rs, tot} = multi(s);
    if(tot >= n){ S = s; rings = dist(rs, tot); }
  }
  if(!rings){ S = 22; const {rs, tot} = multi(22); rings = dist(rs, Math.max(1, tot)); }
  const ext = rings[0].R + hf(S);
  const cx = 2 * ext >= W ? W / 2 : Math.max(ext, Math.min(W - ext, ox));
  const cy = 2 * ext >= H ? H / 2 : Math.max(ext, Math.min(H - ext, oy));
  const pos = [];
  rings.forEach((rg, k) => {
    const off = k % 2 ? 180 / rg.m : 0;
    for(let j = 0; j < rg.m; j++){ const th = rad(-90 + off + 360 * j / rg.m); pos.push({x:cx + Math.cos(th) * rg.R, y:cy + Math.sin(th) * rg.R, ux:Math.cos(th), uy:Math.sin(th), a:th, R:rg.R, k}); }
  });
  const Rin = rings[rings.length - 1].R, multiRing = rings.length > 1;
  return {S, pos, cx, cy, R:rings[0].R, Rin, multi:multiRing, inner:Math.max(26, Rin * (multiRing ? .5 : .42))};
}
function dialGlyph(it, size){ return it.ik ? locIconSvg(it.ik, size) : it.icon; }
function dialHub(i, sticky){
  const h = DL.hubEl; if(!h) return;
  if(i < 0 || !DL.items[i]){
    h.className = "dhub hint";
    h.innerHTML = '<div class="hi1">' + (DL.kind === "loc" ? locIconSvg("globe", 34) : "📦") + '</div><b>' + (DL.mode === "sticky" || sticky ? "Toca una opció" : "Llisca i deixa anar") + '</b><small>' + (DL.kind === "loc" ? "Filtra per ubicació" : "Filtra per zona") + '</small>';
    return;
  }
  const it = DL.items[i];
  h.className = "dhub" + (it.house ? " house" : "");
  h.innerHTML = '<div class="hi1">' + dialGlyph(it, 38) + '</div><b>' + esc(it.label) + '</b><small>' + it.n + (it.n === 1 ? ' article' : ' articles') + (it.all ? '' : (it.n !== it.g ? ' (de ' + it.g + ')' : ' · ' + it.p + '%')) + '</small>';
}
function dialUpdate(px, py){
  if(!DL.open) return;
  const mx = cfgGet("dialMax") / 100, S = DL.S, sig = S * 1.6;
  const dx = px - DL.cx, dy = py - DL.cy, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  if(!DL.moved && DL.mode === "hold" && Math.hypot(px - DL.ox, py - DL.oy) > 26) DL.moved = true;
  const live = DL.mode === "sticky" || DL.moved;
  const angular = !DL.multi && DL.mode === "hold";                       /* 1 anell mantenint premut: tria l'angle, el dit pot ser a qualsevol lloc del cercle */
  const amp = !live ? 0 : angular ? Math.max(0, Math.min(1, (d - DL.inner) / (DL.inner * .6 + 1))) : 1;
  let best = -1, bd = 1e9;
  DL.pos.forEach((p, i) => {
    let dd;
    if(angular){ const da = Math.atan2(Math.sin(ang - p.a), Math.cos(ang - p.a)); dd = Math.abs(da) * p.R; }
    else dd = Math.hypot(px - p.x, py - p.y);
    if(dd < bd){ bd = dd; best = i; }
    const g = live ? Math.exp(-(dd * dd) / (sig * sig)) * amp : 0, s = 1 + (mx - 1) * g, pop = (s - 1) * S * .45, el = DL.els[i];
    el.style.transform = "translate(-50%,-50%) translate(" + (p.ux * pop).toFixed(1) + "px," + (p.uy * pop).toFixed(1) + "px) scale(" + s.toFixed(3) + ")";
    el.style.zIndex = String(10 + Math.round(g * 100));
  });
  const lim = DL.R + S * 1.15;
  const act = !live ? -1 : angular ? (d > DL.inner * 1.25 && d < lim ? best : -1) : (bd <= S * .95 ? best : -1);
  if(act !== DL.act){
    DL.els.forEach((e, k) => e.classList.toggle("act", k === act));
    DL.act = act; dialHub(act);
    if(DL.ptrEl){
      if(act >= 0){ DL.ptrEl.style.transform = "rotate(" + (DL.pos[act].a * 180 / Math.PI).toFixed(1) + "deg)"; DL.ptrEl.classList.add("on"); }
      else DL.ptrEl.classList.remove("on");
    }
    if(act >= 0 && cfgGet("dialVib")) vib(6);
  }
}
function dialOpen(kind, btn, mode, px, py, fromKey){
  if(DL.open) return;
  const items = dialItems(kind); if(items.length < 2) return;
  const r = btn.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
  const g = dialGeom(items.length, ox, oy);
  Object.assign(DL, {open:true, kind, mode, items, pos:g.pos, S:g.S, cx:g.cx, cy:g.cy, R:g.R, inner:g.inner, multi:g.multi, moved:false, act:-1, ox, oy, btn, px:px == null ? null : px, py:py == null ? null : py});
  const el = $("dial"); el.innerHTML = ""; el.hidden = false;
  el.style.setProperty("--ox", (g.cx / innerWidth * 100) + "%"); el.style.setProperty("--oy", (g.cy / innerHeight * 100) + "%");
  const add = (cls, css) => { const d = document.createElement("div"); d.className = cls; Object.assign(d.style, css); el.appendChild(d); return d; };
  add("dbg", {});
  const D = 2 * (g.R + g.S * .85);
  add("ddisc", {left:g.cx + "px", top:g.cy + "px", width:D + "px", height:D + "px"});
  const Di = 2 * (g.Rin - g.S * .78); if(Di > 44) add("dinner", {left:g.cx + "px", top:g.cy + "px", width:Di + "px", height:Di + "px"});
  DL.ptrEl = add("dptr", {left:g.cx + "px", top:g.cy + "px", width:Math.max(20, g.Rin - g.S * .6) + "px"});
  if(Math.hypot(ox - g.cx, oy - g.cy) > g.inner * 1.1) add("dorg", {left:ox + "px", top:oy + "px"});   /* marca d'on has premut (s'amaga si coincideix amb el centre) */
  DL.hubEl = add("dhub hint", {left:g.cx + "px", top:g.cy + "px", width:Math.max(70, Math.min(150, 2 * (g.Rin - g.S * .75))) + "px"});
  DL.els = items.map((it, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "ditem" + (it.sel ? " sel" : "") + (it.house ? " house" : "");
    b.style.width = b.style.height = g.S + "px"; b.style.left = g.pos[i].x + "px"; b.style.top = g.pos[i].y + "px"; b.style.fontSize = Math.round(g.S * .5) + "px";
    b.dataset.i = i; b.setAttribute("aria-label", it.label + " · " + it.n + " articles");
    b.innerHTML = '<span class="di">' + dialGlyph(it, Math.round(g.S * .58)) + '</span><span class="dn">' + it.n + '</span>';
    b.style.opacity = "0"; b.style.transform = "translate(-50%,-50%) translate(" + (ox - g.pos[i].x) + "px," + (oy - g.pos[i].y) + "px) scale(.2)";
    el.appendChild(b); return b;
  });
  document.body.classList.add("dialing");
  dialHub(-1);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if(!DL.open) return;
    DL.els.forEach((b, i) => { b.style.transitionDelay = (i * 12) + "ms"; b.style.opacity = "1"; b.style.transform = "translate(-50%,-50%) scale(1)"; });
    setTimeout(() => { if(!DL.open) return; DL.els.forEach(b => { b.style.transitionDelay = "0ms"; b.classList.add("mv"); }); if(DL.px != null) dialUpdate(DL.px, DL.py); }, 430);
  }));
  window.addEventListener("pointermove", dialPM, {passive:true});
  window.addEventListener("pointerup", dialPU, true);
  window.addEventListener("pointercancel", dialPC, true);
  window.addEventListener("keydown", dialKey, true);
  if(cfgGet("dialVib")) vib(10);
  if(fromKey){ const k = Math.max(0, items.findIndex(x => x.sel)); DL.els[k].focus(); }
}
function dialPM(e){
  if(!DL.open) return;
  if(DL.mode === "hold" && DL.down && e.pointerId !== DL.down.id) return;
  DL.px = e.clientX; DL.py = e.clientY;
  if(DL.moving) return; DL.moving = true;
  requestAnimationFrame(() => { DL.moving = false; if(DL.open && DL.px != null) dialUpdate(DL.px, DL.py); });
}
function dialPU(e){
  if(!DL.open || DL.mode !== "hold") return;
  if(DL.down && e.pointerId !== DL.down.id) return;
  DL.px = e.clientX; DL.py = e.clientY; dialUpdate(DL.px, DL.py);
  const act = DL.act, moved = DL.moved;
  DL.down = null; eatNextClick();
  if(!moved){ DL.mode = "sticky"; dialHub(-1, true); dialUpdate(DL.px, DL.py); }   /* has deixat anar sense moure't: el dial es queda obert */
  else if(act >= 0) dialChoose(act);
  else dialClose();
}
function dialPC(e){ if(DL.open && DL.mode === "hold" && (!DL.down || e.pointerId === DL.down.id)) dialClose(); }
function dialKey(e){ if(e.key === "Escape" && DL.open){ e.preventDefault(); e.stopPropagation(); const b = DL.btn; dialClose(); if(b) b.focus(); } }
function dialChoose(i){
  const it = DL.items[i], kind = DL.kind; if(!it) return;
  dialClose();
  if(kind === "loc") state.loc = it.id; else { state.cat = it.id; state.review = false; }
  render();
  if(cfgGet("dialVib")) vib(14);
}
function dialClose(){
  if(!DL.open) return;
  DL.open = false; clearTimeout(DL.timer);
  const el = $("dial"); el.hidden = true; el.innerHTML = "";
  document.body.classList.remove("dialing");
  window.removeEventListener("pointermove", dialPM);
  window.removeEventListener("pointerup", dialPU, true);
  window.removeEventListener("pointercancel", dialPC, true);
  window.removeEventListener("keydown", dialKey, true);
  try { if(DL.btn && DL.down) DL.btn.releasePointerCapture(DL.down.id); } catch(_){}
  DL.down = null; DL.els = []; DL.hubEl = null; eatNextClick();
}
function dialTap(kind, btn, fromKey){
  const active = kind === "loc" ? state.loc !== "all" : state.cat !== "all";
  if(active){ if(kind === "loc") state.loc = "all"; else state.cat = "all"; render(); return; }
  if(cfgGet("dialTap") || fromKey) dialOpen(kind, btn, "sticky", null, null, fromKey);
}
function bindDial(btn, kind){
  const cancel = () => { clearTimeout(DL.timer); if(DL.down && !DL.open) DL.down = null; btn.classList.remove("pressing"); };
  btn.addEventListener("pointerdown", e => {
    if(e.button > 0 || DL.open) return;
    DL.down = {id:e.pointerId, x:e.clientX, y:e.clientY, kind, btn, long:false};
    btn.classList.add("pressing"); clearTimeout(DL.timer);
    DL.timer = setTimeout(() => {
      if(!DL.down || DL.down.btn !== btn) return;
      DL.down.long = true; btn.classList.remove("pressing");
      try { btn.setPointerCapture(DL.down.id); } catch(_){}
      dialOpen(kind, btn, "hold", DL.down.x, DL.down.y);
    }, cfgGet("dialHold"));
  });
  btn.addEventListener("pointermove", e => {
    if(DL.down && !DL.down.long && DL.down.btn === btn && Math.hypot(e.clientX - DL.down.x, e.clientY - DL.down.y) > 12) cancel();
  });
  btn.addEventListener("pointerup", e => {
    if(DL.open || !DL.down || DL.down.btn !== btn || DL.down.long) { btn.classList.remove("pressing"); return; }
    cancel(); eatNextClick(); dialTap(kind, btn, false);
  });
  btn.addEventListener("pointercancel", cancel);
  btn.addEventListener("pointerleave", e => { if(e.pointerType === "mouse") cancel(); });
  btn.addEventListener("click", e => { if(e.detail === 0 && !DL.open) dialTap(kind, btn, true); });
  btn.addEventListener("contextmenu", e => e.preventDefault());
}
$("dial").addEventListener("pointerdown", e => {
  if(!DL.open || DL.mode !== "sticky") return;
  e.preventDefault();
  const b = e.target.closest(".ditem"); eatNextClick();
  if(b){ dialUpdate(e.clientX, e.clientY); dialChoose(+b.dataset.i); } else { const bt = DL.btn; dialClose(); if(bt && !isTouch) bt.focus(); }
});
$("dial").addEventListener("click", e => { if(e.detail === 0 && DL.open){ const b = e.target.closest(".ditem"); if(b) dialChoose(+b.dataset.i); } });
$("dial").addEventListener("contextmenu", e => e.preventDefault());
let dialW = innerWidth;
addEventListener("resize", () => { if(DL.open && innerWidth !== dialW) dialClose(); dialW = innerWidth; });

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
    const c = chatCtx(); if(!c) return;
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
addEventListener("pointerdown", () => { if(cfgGet("fxVol") > 0){ try { chatCtx(); } catch(_){} } }, {passive:true});

/* ---------- dashboard ---------- */
let dashOpenF = false, dashSoonT = 0;
const DSC = ["#4fe3d2", "#5ea0ff", "#ffd23f", "#ff6fb5", "#b388ff", "#ffa040", "#4ade80", "#ff6b6b", "#22d3ee", "#a3e635", "#f472b6", "#fb7185"];
const dsP = (n, t) => t ? Math.round(n / t * 100) : 0;
const dsU = c => typeof c.qty === "number" ? c.qty : 0;
const dsN = n => Number(n).toLocaleString("ca");
function dsRing(p, col, size){
  const r = 26, C = 2 * Math.PI * r, L = C * Math.max(0, Math.min(100, p)) / 100;
  return '<svg class="dsring" viewBox="0 0 64 64" width="' + (size || 60) + '" height="' + (size || 60) + '" aria-hidden="true"><circle cx="32" cy="32" r="' + r + '" class="rb"/><circle cx="32" cy="32" r="' + r + '" class="rf" style="--L:' + L.toFixed(1) + ';--C:' + C.toFixed(1) + ';stroke:' + col + '" transform="rotate(-90 32 32)"/></svg>';
}
function dsDonut(segs, center, sub){
  const r = 56, C = 2 * Math.PI * r, T = segs.reduce((s, x) => s + x.n, 0) || 1;
  let acc = 0, h = '<svg viewBox="0 0 160 160" class="dn" aria-hidden="true"><circle cx="80" cy="80" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="26" style="stroke-dasharray:none;opacity:.5"/><g transform="rotate(-90 80 80)">';
  segs.forEach(s => { if(!s.n) return; const L = Math.max(.5, C * s.n / T - 2); h += '<circle cx="80" cy="80" r="' + r + '" style="--L:' + L.toFixed(1) + ';--C:' + C.toFixed(1) + ';--Cm:' + (C - L).toFixed(1) + ';stroke:' + s.col + ';stroke-dashoffset:' + (-acc).toFixed(1) + '"/>'; acc += C * s.n / T; });
  return h + '</g><text x="80" y="82" class="ctr">' + center + '</text><text x="80" y="98" class="cts">' + sub + '</text></svg>';
}
function dashDaily(L, n){
  const days = [], today = new Date(); today.setHours(0, 0, 0, 0);
  for(let i = n - 1; i >= 0; i--){ const d = new Date(today); d.setDate(d.getDate() - i); days.push({t:d.getTime(), cr:0, ed:0, lab:d.getDate(), mo:d.getMonth()}); }
  const idx = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); const k = Math.round((d.getTime() - days[0].t) / 864e5); return k >= 0 && k < n ? k : -1; };
  L.forEach(c => { if(typeof c.ord === "number" && c.ord > 1e12){ const k = idx(c.ord); if(k >= 0) days[k].cr++; } });
  HIST.forEach(h => {
    if(h.of) return;
    const creation = (h.parts || []).length && h.parts.every(p => p.k === "item" && !p.before && p.after);
    if(creation) return;
    const k = idx(h.ts); if(k >= 0) days[k].ed++;
  });
  return days;
}
function dsBars(days){
  const W = 320, G = 3, n = days.length, bw = (W - G * (n - 1)) / n, mx = Math.max(1, ...days.map(d => d.cr + d.ed)), HH = 96, step = Math.ceil(n / 8);
  let s = '<svg class="dsact" viewBox="0 0 ' + W + ' 112" role="img" aria-label="Activitat per dies">';
  [.25, .5, .75, 1].forEach(f => { s += '<line x1="0" x2="' + W + '" y1="' + (HH - HH * f).toFixed(1) + '" y2="' + (HH - HH * f).toFixed(1) + '" stroke="var(--line)" stroke-width=".5" opacity=".6"/>'; });
  days.forEach((d, i) => {
    const x = i * (bw + G), hc = d.cr / mx * HH, he = d.ed / mx * HH;
    s += '<g><title>' + d.lab + '/' + (d.mo + 1) + ' · ' + d.cr + ' creats · ' + d.ed + ' canvis</title>';
    if(d.ed) s += '<rect class="dsb" x="' + x.toFixed(1) + '" y="' + (HH - hc - he).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + he.toFixed(1) + '" rx="2" fill="rgba(255,255,255,.38)" style="transition-delay:' + (i * 25) + 'ms"/>';
    if(d.cr) s += '<rect class="dsb" x="' + x.toFixed(1) + '" y="' + (HH - hc).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hc.toFixed(1) + '" rx="2" fill="var(--accent)" style="transition-delay:' + (i * 25) + 'ms"/>';
    if(!d.cr && !d.ed) s += '<rect x="' + x.toFixed(1) + '" y="' + (HH - 2) + '" width="' + bw.toFixed(1) + '" height="2" rx="1" fill="var(--line)"/>';
    if((n - 1 - i) % step === 0) s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="108">' + d.lab + '</text>';
    s += '</g>';
  });
  return s + '</svg>';
}
function dashUsers(L){
  const idWho = {};
  [...HIST].reverse().forEach(h => (h.parts || []).forEach(p => { if(p.k === "item" && !p.before && p.after && !idWho[p.id]) idWho[p.id] = h.who; }));
  const cr = {}; let unk = 0;
  L.forEach(c => { const w = String(c.by || idWho[c.id] || "").toLowerCase(); if(w) cr[w] = (cr[w] || 0) + 1; else unk++; });
  const list = ALLOWED.map(e => {
    const mine = HIST.filter(h => String(h.who).toLowerCase() === e.toLowerCase());
    const msgs = CHAT.filter(m => m.from === e.toLowerCase()).length;
    const last = Math.max(0, ...mine.map(h => h.ts || 0), ...CHAT.filter(m => m.from === e.toLowerCase()).map(m => m.ts));
    return {e, name:chatName(e), who:whoName(e), cr:cr[e.toLowerCase()] || 0, ch:mine.filter(h => !h.of).length, un:mine.filter(h => h.of).length, msgs, last};
  });
  return {list, unk};
}
function dashData(){
  const L = DATA.filter(live), tot = L.length, d = {L, tot}, now = Date.now();
  d.units = L.reduce((s, c) => s + dsU(c), 0);
  d.withPh = L.filter(c => c.photos.length).length; d.rev = L.filter(needsReview).length; d.newN = L.filter(isNew).length;
  d.wk = L.filter(c => typeof c.ord === "number" && c.ord > 1e12 && c.ord > now - 7 * 864e5).length;
  let pd = 0, pt = 0; CATS.forEach(z => { const r = pendRows(z.id); pt += r.length; pd += r.filter(x => have[x.key]).length; }); d.pd = pd; d.pt = pt;
  d.byLoc = LOCS.map(l => { const it = L.filter(c => c.locs.includes(l)), zs = {}; it.forEach(c => catsOf(c).forEach(z => { zs[z] = (zs[z] || 0) + 1; })); return {id:l, n:it.length, units:it.reduce((s, c) => s + dsU(c), 0), ph:it.filter(c => c.photos.length).length, rev:it.filter(needsReview).length, zs, prim:L.filter(c => c.loc === l).length}; });
  d.byCat = CATS.map((z, k) => { const it = L.filter(c => catsOf(c).includes(z.id)), ls = {}; it.forEach(c => c.locs.forEach(l => { ls[l] = (ls[l] || 0) + 1; })); const rows = pendRows(z.id), top = Object.entries(ls).sort((a, b) => b[1] - a[1])[0]; return {z, k, n:it.length, units:it.reduce((s, c) => s + dsU(c), 0), rev:it.filter(needsReview).length, pd:rows.filter(x => have[x.key]).length, pt:rows.length, top:top ? top[0] : "", prim:L.filter(c => c.cat === z.id).length}; });
  d.house = L.filter(c => c.locs.includes(HOUSE));
  const rest = {}; L.filter(c => !c.locs.includes(HOUSE)).forEach(c => { rest[c.loc] = (rest[c.loc] || 0) + 1; });
  d.rest = Object.entries(rest).sort((a, b) => b[1] - a[1]);
  d.st = {ok:L.filter(c => c.estado === "ok").length, conf:L.filter(c => c.estado === "conf").length, sin:L.filter(c => c.estado === "sin").length};
  d.fi = {alta:L.filter(c => c.fiab === "alta").length, mitjana:L.filter(c => c.fiab === "mitjana").length, baixa:L.filter(c => c.fiab === "baixa").length};
  d.days = dashDaily(L, cfgGet("dashDays"));
  d.users = dashUsers(L);
  d.top = L.map((c, i) => ({c, i:DATA.indexOf(c)})).filter(x => dsU(x.c) > 0).sort((a, b) => dsU(b.c) - dsU(a.c)).slice(0, cfgGet("dashTop"));
  d.latest = L.map(c => ({c, i:DATA.indexOf(c)})).filter(x => typeof x.c.ord === "number" && x.c.ord > 1e12).sort((a, b) => b.c.ord - a.c.ord).slice(0, cfgGet("dashTop"));
  d.stats = invStats();
  return d;
}
const dsSec = (id, ico, title, note, body) => '<section class="dsec" id="ds-' + id + '"><h2><span aria-hidden="true">' + ico + '</span>' + title + '</h2>' + (note ? '<p class="ds-n">' + note + '</p>' : '') + body + '</section>';
const dsKpi = (ico, label, v, sub, p, col) => '<div class="dcard k"><div class="kt"><div class="dl"><span aria-hidden="true">' + ico + '</span>' + label + '</div><div class="dv"><span class="cu" data-v="' + v + '">' + dsN(v) + '</span></div><div class="ds">' + sub + '</div></div>' + (p == null ? '' : dsRing(p, col || 'var(--accent)', 58)) + '</div>';
function dashHtml(d){
  const tot = d.tot, nav = [];
  const sec = (id, label, html) => { nav.push([id, label]); return html; };
  let h = "";
  /* resum */
  h += sec("resum", "Resum", dsSec("resum", "✨", "Resum", "Una mirada ràpida a tot l'inventari.", '<div class="dsgrid k">'
    + dsKpi("📦", "Articles", tot, dsN(d.units) + " unitats en total", null)
    + dsKpi("📷", "Amb foto", d.withPh, dsP(d.withPh, tot) + "% de l'inventari", dsP(d.withPh, tot), "#4fe3d2")
    + dsKpi("⚠️", "Per revisar", d.rev, dsP(d.rev, tot) + "% de l'inventari", dsP(d.rev, tot), "#ffd166")
    + dsKpi("☑", "Pendents aconseguits", d.pd, d.pt - d.pd + " encara per aconseguir", dsP(d.pd, d.pt), "#7ef0c4")
    + dsKpi("🆕", cfgGet("newDays") ? "Nous (" + cfgGet("newDays") + " dies)" : "Creats (7 dies)", cfgGet("newDays") ? d.newN : d.wk, "Articles afegits fa poc", null)
    + dsKpi("🏡", "A Nau&amp;Noa House", d.house.length, dsP(d.house.length, tot) + "% ja és a casa", dsP(d.house.length, tot), "#ffd23f")
    + '</div>'));
  /* casa */
  const hp = dsP(d.house.length, tot), units = d.house.reduce((s, c) => s + dsU(c), 0);
  h += sec("casa", "Casa", dsSec("casa", "🏡", "Nau&amp;Noa House", "El destí final de tots els articles.",
    '<div class="dhero"><div class="hr">' + dsRing(hp, "#ffd23f", 104) + '</div><div class="ht"><h3>' + (tot ? (hp >= 100 ? "Tot és a casa! 🎉" : "La mudança va al " + hp + "%") : "Encara no hi ha articles") + '</h3>'
    + '<div class="big"><span class="cu" data-v="' + d.house.length + '">' + dsN(d.house.length) + '</span> <small style="font-size:15px;font-weight:700;color:#e8d9b0">de ' + dsN(tot) + ' articles · ' + dsN(units) + ' unitats</small></div>'
    + '<div class="dsbar gold"><i style="--w:' + hp + '%"></i></div>'
    + '<p>' + (d.rest.length ? 'Encara falten per portar: ' + d.rest.slice(0, 4).map(x => '<b>' + x[1] + '</b> de ' + esc(x[0])).join(' · ') + '.' : (tot ? 'No en queda cap per portar.' : '')) + '</p>'
    + '<div class="ft2"><button type="button" data-a="loc" data-v="' + esc(HOUSE) + '">Veure què hi ha a casa</button>'
    + (d.rest.length ? '<button type="button" data-a="loc" data-v="' + esc(d.rest[0][0]) + '">Falten a ' + esc(d.rest[0][0]) + '</button>' : '') + '<button type="button" class="confbtn" data-a="confh">🎉 Prova la celebració</button></div></div></div>'));
  /* ubicacions */
  h += sec("ubic", "Ubicacions", dsSec("ubic", "📍", "Ubicacions", "Toca'n una per veure els seus articles.", '<div class="dsgrid c">' + d.byLoc.map((l, k) => {
    const zs = Object.entries(l.zs).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const bar = zs.map(([z, n]) => '<i style="--w:' + dsP(n, l.n) + '%;background:' + DSC[CATS.findIndex(x => x.id === z) % DSC.length] + '"></i>').join("");
    return '<div class="dcard click' + (l.id === HOUSE ? ' house' : '') + '" data-a="loc" data-v="' + esc(l.id) + '" tabindex="0" role="button"><div class="dl"><span aria-hidden="true">' + locIconSvg(locIconKey(l.id), 18) + '</span>' + esc(l.id) + '</div>'
      + '<div class="dv"><span class="cu" data-v="' + l.n + '">' + dsN(l.n) + '</span> <small style="font-size:13px;color:var(--muted);font-weight:700">' + dsP(l.n, tot) + '%</small></div>'
      + '<div class="dsbar' + (l.id === HOUSE ? ' gold' : '') + '"><i style="--w:' + dsP(l.n, tot) + '%"></i></div>'
      + '<div class="dsbar" title="Zones">' + (bar || '') + '</div>'
      + '<div class="row2"><span><b>' + dsN(l.units) + '</b> unitats</span><span><b>' + dsP(l.ph, l.n) + '%</b> amb foto</span><span><b>' + l.rev + '</b> per revisar</span></div></div>';
  }).join("") + '</div>'));
  /* zones */
  const dz = d.byCat.map(x => ({n:x.prim, col:DSC[x.k % DSC.length], label:x.z.icon + " " + x.z.label}));
  const dl = d.byLoc.map((x, k) => ({n:x.prim, col:x.id === HOUSE ? "#ffd23f" : DSC[(k + 3) % DSC.length], label:x.id}));
  const leg = a => '<div class="leg">' + a.map(s => '<div><i style="background:' + s.col + '"></i>' + esc(s.label) + '<span>' + s.n + '</span></div>').join("") + '</div>';
  h += sec("zones", "Zones", dsSec("zones", "🏠", "Zones de la casa", "Distribució i pendents per aconseguir.",
    '<div class="dsgrid w"><div class="dcard"><div class="dl">Per zona principal</div><div class="dsdon">' + dsDonut(dz, tot, "articles") + leg(dz) + '</div></div>'
    + '<div class="dcard"><div class="dl">Per ubicació principal</div><div class="dsdon">' + dsDonut(dl, tot, "articles") + leg(dl) + '</div></div></div>'
    + '<div class="dsgrid c" style="margin-top:10px">' + d.byCat.map(x => '<div class="dcard click" data-a="cat" data-v="' + esc(x.z.id) + '" tabindex="0" role="button"><div class="dl"><span aria-hidden="true">' + x.z.icon + '</span>' + esc(x.z.label) + '</div>'
      + '<div class="dv"><span class="cu" data-v="' + x.n + '">' + dsN(x.n) + '</span> <small style="font-size:13px;color:var(--muted);font-weight:700">' + dsP(x.n, tot) + '%</small></div>'
      + '<div class="dsbar"><i style="--w:' + dsP(x.n, tot) + '%;background:' + DSC[x.k % DSC.length] + '"></i></div>'
      + '<div class="dsbar ok" title="Pendents aconseguits"><i style="--w:' + dsP(x.pd, x.pt) + '%"></i></div>'
      + '<div class="row2"><span><b>' + x.pd + '/' + x.pt + '</b> pendents</span><span><b>' + dsN(x.units) + '</b> unitats</span>' + (x.rev ? '<span><b>' + x.rev + '</b> per revisar</span>' : '') + (x.top ? '<span class="pill">📍 ' + esc(x.top) + '</span>' : '') + '</div></div>').join("") + '</div>'));
  /* mapa */
  const mxv = Math.max(1, ...d.byCat.flatMap(x => d.byLoc.map(l => d.L.filter(c => catsOf(c).includes(x.z.id) && c.locs.includes(l.id)).length)));
  let cells = '<div class="h"></div>' + d.byLoc.map(l => '<div class="h" title="' + esc(l.id) + '">' + esc(l.id === HOUSE ? "🏡" : (l.id.length > 9 ? l.id.slice(0, 8) + "…" : l.id)) + '</div>').join("");
  d.byCat.forEach(x => { cells += '<div class="r"><span aria-hidden="true">' + x.z.icon + '</span>' + esc(x.z.label.length > 11 ? x.z.short : x.z.label) + '</div>';
    d.byLoc.forEach(l => { const n = d.L.filter(c => catsOf(c).includes(x.z.id) && c.locs.includes(l.id)).length;
      cells += n ? '<div class="c" style="--a:' + (.12 + .7 * n / mxv).toFixed(2) + '" data-a="cell" data-l="' + esc(l.id) + '" data-z="' + esc(x.z.id) + '" role="button" tabindex="0" title="' + esc(x.z.label + " · " + l.id) + '">' + n + '</div>' : '<div class="c z">·</div>'; }); });
  h += sec("mapa", "Mapa", dsSec("mapa", "🗺️", "Mapa zona × ubicació", "Més intens = més articles. Toca una casella per filtrar-la.", '<div class="dcard"><div class="dsmx" style="grid-template-columns:auto repeat(' + d.byLoc.length + ',minmax(34px,1fr))">' + cells + '</div></div>'));
  /* activitat */
  const tcr = d.days.reduce((s, x) => s + x.cr, 0), ted = d.days.reduce((s, x) => s + x.ed, 0);
  h += sec("act", "Activitat", dsSec("act", "📈", "Activitat", "Últims " + d.days.length + " dies. Els articles antics no tenen data de creació.", '<div class="dcard">' + dsBars(d.days)
    + '<div class="dsleg"><span><i style="background:var(--accent)"></i>Articles creats <b>' + tcr + '</b></span><span><i style="background:rgba(255,255,255,.38)"></i>Altres canvis <b>' + ted + '</b></span></div></div>'));
  /* usuaris */
  const U = d.users, maxcr = Math.max(1, ...U.list.map(u => u.cr), U.unk);
  const when = ts => ts ? ago(ts) : "—";
  h += sec("usuaris", "Usuaris", dsSec("usuaris", "👥", "Qui fa què", "Articles creats, canvis fets i missatges al xat.", '<div class="dsgrid u">' + U.list.map(u => '<div class="dcard"><div class="dsusr"><div class="av ' + u.name.toLowerCase() + '">' + esc(u.name) + '</div><div class="ut"><div class="nm"><b>' + esc(u.who) + '</b><small>Última activitat: ' + esc(when(u.last)) + '</small></div>'
    + '<div class="dsbar"><i style="--w:' + dsP(u.cr, maxcr) + '%"></i></div><div class="st"><div><b class="cu" data-v="' + u.cr + '">' + u.cr + '</b><small>articles creats</small></div><div><b class="cu" data-v="' + u.ch + '">' + u.ch + '</b><small>canvis</small></div><div><b class="cu" data-v="' + u.msgs + '">' + u.msgs + '</b><small>missatges</small></div></div></div></div></div>').join("")
    + '</div>' + (U.unk ? '<p class="ds-n" style="margin-top:8px">' + U.unk + ' articles anteriors no tenen autor registrat. A partir d\'ara es guarda qui crea cada article.</p>' : '')));
  /* estat */
  const seg = (a, cols) => '<div class="dsbar">' + a.map((n, i) => '<i style="--w:' + dsP(n, tot) + '%;background:' + cols[i] + '"></i>').join("") + '</div>';
  h += sec("estat", "Estat", dsSec("estat", "🩺", "Estat de l'inventari", "", '<div class="dsgrid w"><div class="dcard"><div class="dl">Verificació</div>' + seg([d.st.ok, d.st.conf, d.st.sin], ["#7ef0c4", "#ffd166", "#ff8a7a"])
    + '<div class="row2"><span>Verificat <b>' + d.st.ok + '</b></span><span>Per confirmar <b>' + d.st.conf + '</b></span><span>Sense foto <b>' + d.st.sin + '</b></span></div></div>'
    + '<div class="dcard"><div class="dl">Fiabilitat de la informació</div>' + seg([d.fi.alta, d.fi.mitjana, d.fi.baixa], ["#4fe3d2", "#ffd166", "#ff8a7a"])
    + '<div class="row2"><span>Alta <b>' + d.fi.alta + '</b></span><span>Mitjana <b>' + d.fi.mitjana + '</b></span><span>Baixa <b>' + d.fi.baixa + '</b></span></div></div></div>'));
  /* tops */
  const li = (x, rank, sub) => '<button type="button" class="dsitem" data-a="item" data-v="' + x.i + '"><span class="th">' + (x.c.photos.length ? '<img alt="" src="' + thumbSrc(x.c) + '">' : '📦') + '</span><span class="tx"><b>' + esc(x.c.item) + '</b><small>' + sub + '</small></span><span class="rk">' + rank + '</span></button>';
  h += sec("tops", "Rànquings", dsSec("tops", "🏆", "Rànquings", "", '<div class="dsgrid w"><div><div class="dl" style="font-weight:800;margin:0 0 6px;color:var(--ink)">Amb més unitats</div><div class="dslist">'
    + (d.top.length ? d.top.map((x, k) => li(x, "×" + dsN(dsU(x.c)), '#' + (k + 1) + ' · ' + esc(locsTxt(x.c, ", ")))).join("") : '<div class="dsempty">Encara no hi ha articles.</div>') + '</div></div>'
    + '<div><div class="dl" style="font-weight:800;margin:0 0 6px;color:var(--ink)">Últims afegits</div><div class="dslist">'
    + (d.latest.length ? d.latest.map(x => li(x, ago(x.c.ord), esc(zonesTxt(x.c)) + ' · ' + esc(locsTxt(x.c, ", ")))).join("") : '<div class="dsempty">Cap article nou amb data.</div>') + '</div></div></div>'));
  /* núvol */
  const s = d.stats, pct = Math.min(100, s.bytes / FREE_BYTES * 100);
  h += sec("nuvol", "Núvol", dsSec("nuvol", "☁️", "Núvol i dades", "", '<div class="dcard"><div class="dl">Espai usat (aprox.)</div><div class="dv"><span>' + mbTxt(s.bytes) + ' MB</span> <small style="font-size:13px;color:var(--muted);font-weight:700">de 1024 MB · ' + pct.toFixed(1).replace(".", ",") + '%</small></div>'
    + '<div class="dsbar ' + (pct >= 85 ? '' : 'ok') + '"><i style="--w:' + Math.max(1, pct).toFixed(1) + '%"></i></div><div class="row2"><span><b>' + s.phN + '</b> fotos (' + mbTxt(s.phBytes) + ' MB)</span><span><b>' + s.bkN + '</b> còpies</span><span><b>' + HIST.length + '</b> canvis a Desfés</span><span><b>' + CHAT.length + '</b> missatges al xat</span></div></div>'));
  return {html:h, nav};
}
function dashRender(keep){
  const body = $("dashBody"), st = body.scrollTop, d = dashData(), r = dashHtml(d);
  body.className = "dbody" + (keep ? " go" : "") + (cfgGet("dashAnim") ? "" : " noanim");
  body.innerHTML = r.html;
  $("dashNav").innerHTML = r.nav.map(([id, l]) => '<button type="button" data-n="' + id + '">' + l + '</button>').join("");
  $("dashSub").textContent = d.tot + " articles · " + LOCS.length + " ubicacions · " + CATS.length + " zones";
  body.scrollTop = st; dashSpy();
  if(!keep){ requestAnimationFrame(() => requestAnimationFrame(() => { if(dashOpenF) body.classList.add("go"); })); dashCount(body); }
}
function dashCount(root){
  if(!cfgGet("dashAnim")) return;
  const els = [...root.querySelectorAll(".cu")], t0 = performance.now(), D = 900;
  els.forEach(e => { e.textContent = "0"; });
  const f = now => {
    const k = Math.min(1, (now - t0) / D), ez = 1 - Math.pow(1 - k, 3);
    els.forEach(e => { e.textContent = dsN(Math.round(+e.dataset.v * ez)); });
    if(k < 1 && dashOpenF) requestAnimationFrame(f); else els.forEach(e => { e.textContent = dsN(+e.dataset.v); });
  };
  requestAnimationFrame(f);
}
function dashSpy(){
  const body = $("dashBody"), top = body.getBoundingClientRect().top; let cur = "";
  body.querySelectorAll(".dsec").forEach(s => { if(s.getBoundingClientRect().top - top <= 60) cur = s.id.slice(3); });
  $("dashNav").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.n === (cur || "resum")));
}
function dashSoon(){ clearTimeout(dashSoonT); dashSoonT = setTimeout(() => { if(dashOpenF) dashRender(true); }, 250); }
function dashOpen(){
  dashOpenF = true; $("dash").hidden = false; document.body.classList.add("lock");
  $("dashBody").scrollTop = 0; dashRender(false);
  try { $("dashClose").focus({preventScroll:true}); } catch(_){}
}
function dashClose(){
  if(!dashOpenF) return;
  dashOpenF = false; $("dash").hidden = true;
  if(!$("dlg").classList.contains("open")) document.body.classList.remove("lock");
  try { $("dashBtn").focus({preventScroll:true}); } catch(_){}
}
function dashGo(loc, cat){
  dashClose(); resetFilters();
  if(loc) state.loc = loc; if(cat) state.cat = cat;
  render(); scrollTo({top:0, behavior:"auto"});
}
$("dashBtn").onclick = dashOpen;
$("dashClose").onclick = dashClose;
$("dashNav").addEventListener("click", e => {
  const b = e.target.closest("button[data-n]"); if(!b) return;
  const s = $("ds-" + b.dataset.n); if(s) s.scrollIntoView({behavior:"smooth", block:"start"});
});
$("dashBody").addEventListener("scroll", () => { clearTimeout(dashSpy.t); dashSpy.t = setTimeout(dashSpy, 60); }, {passive:true});
function dashAct(t){
  const a = t.dataset.a;
  if(a === "loc") dashGo(t.dataset.v, null);
  else if(a === "cat") dashGo(null, t.dataset.v);
  else if(a === "cell") dashGo(t.dataset.l, t.dataset.z);
  else if(a === "item"){ const i = +t.dataset.v; dashClose(); if(!order.includes(i)) resetFilters(); openDlg(i); }
  else if(a === "confh") fxHouse(null, true);
}
$("dashBody").addEventListener("click", e => { const t = e.target.closest("[data-a]"); if(t) dashAct(t); });
$("dashBody").addEventListener("keydown", e => { if((e.key === "Enter" || e.key === " ") && e.target.matches("[data-a][tabindex]")){ e.preventDefault(); dashAct(e.target); } });
document.addEventListener("keydown", e => {
  if(e.key === "Escape" && dashOpenF && !document.querySelector("dialog[open]") && !DL.open){ e.preventDefault(); dashClose(); }
});

/* ---------- ajustos nous ---------- */
function cfgV5Html(row){
  const sec = k => String(CFGD[k] / 1000).replace(".", ",");
  return '</div><div class="cfg"><h3>🎉 Confeti en crear un article</h3><p class="cfn">Pluja de confeti a tota la pantalla quan afegeixes un article. Les proves fan servir els valors ja desats.</p>'
    + row("Confeti en crear", "1 = activat · 0 = desactivat · per defecte 1", 'data-t="fxOn" min="0" max="1" step="1"', cfgGet("fxOn"), "0/1")
    + row("Quantitat de confeti", "Entre 20 i 600 peces · per defecte " + CFGD.fxN, 'data-t="fxN" min="20" max="600" step="10"', cfgGet("fxN"), "peces")
    + row("Durada del confeti", "Entre 1 i 12 s · per defecte " + sec("fxT"), 'data-t="fxT" min="1" max="12" step="0.5"', cfgGet("fxT") / 1000, "s")
    + row("Colors del confeti", "0 = automàtic · 1 = multicolor · 2 = daurat · 3 = color del tema · per defecte 0", 'data-t="fxPal" min="0" max="3" step="1"', cfgGet("fxPal"), "0–3")
    + row("So de la celebració", "Entre 0 i 100 · 0 = en silenci · per defecte 0", 'data-t="fxVol" min="0" max="100" step="1"', cfgGet("fxVol"), "%")
    + '<button type="button" class="wtest" id="fxTest">🎉 Prova el confeti</button>'
    + '</div><div class="cfg"><h3>🏡 Nau&amp;Noa House</h3><p class="cfn">Ubicació de destí de tots els articles. En posar-hi un article, la celebració és molt més gran: confeti, cintes, focs i un cartell.</p>'
    + row("Celebració de la casa", "1 = activada · 0 = desactivada · per defecte 1", 'data-t="houseOn" min="0" max="1" step="1"', cfgGet("houseOn"), "0/1")
    + row("Mostra sempre la ubicació", "1 = sempre visible, encara que sigui buida · 0 = només quan hi ha articles · per defecte 1", 'data-t="houseShow" min="0" max="1" step="1"', cfgGet("houseShow"), "0/1")
    + row("Confeti de la casa", "Entre 50 i 900 peces · per defecte " + CFGD.houseN, 'data-t="houseN" min="50" max="900" step="10"', cfgGet("houseN"), "peces")
    + row("Durada de la celebració", "Entre 2 i 15 s · per defecte " + sec("houseT"), 'data-t="houseT" min="2" max="15" step="0.5"', cfgGet("houseT") / 1000, "s")
    + row("Cintes", "Entre 0 i 80 · 0 = sense cintes · per defecte " + CFGD.houseR, 'data-t="houseR" min="0" max="80" step="1"', cfgGet("houseR"), "cintes")
    + row("Cartell de benvinguda", "1 = mostra «Nau&Noa House» al mig · 0 = amagat · per defecte 1", 'data-t="houseBan" min="0" max="1" step="1"', cfgGet("houseBan"), "0/1")
    + '<button type="button" class="wtest" id="fxTestH">🏡 Prova Nau&amp;Noa House</button>'
    + '</div><div class="cfg"><h3>🎛️ Dial dels filtres</h3><p class="cfn">Mantén premut «Tot el món» o «Totes» i llisca el dit: els botons creixen quan hi passes a sobre.</p>'
    + row("Temps per obrir el dial", "Entre 0,15 i 1,5 s · per defecte " + sec("dialHold"), 'data-t="dialHold" min="0.15" max="1.5" step="0.05"', cfgGet("dialHold") / 1000, "s")
    + row("Mida dels botons", "Entre 34 i 64 px · per defecte " + CFGD.dialS, 'data-t="dialS" min="34" max="64" step="1"', cfgGet("dialS"), "px")
    + row("Radi del dial", "Entre 90 i 220 px · per defecte " + CFGD.dialR, 'data-t="dialR" min="90" max="220" step="5"', cfgGet("dialR"), "px")
    + row("Ampliació màxima", "Entre 110 i 260 % · per defecte " + CFGD.dialMax, 'data-t="dialMax" min="110" max="260" step="5"', cfgGet("dialMax"), "%")
    + row("Obrir amb un toc simple", "1 = un toc al botó (sense filtre) també obre el dial · 0 = només mantenint premut · per defecte 1", 'data-t="dialTap" min="0" max="1" step="1"', cfgGet("dialTap"), "0/1")
    + row("Vibració al dial", "1 = vibra en passar per sobre d'un botó (Android) · per defecte 1", 'data-t="dialVib" min="0" max="1" step="1"', cfgGet("dialVib"), "0/1")
    + '</div><div class="cfg"><h3>📊 Dashboard</h3><p class="cfn">La pàgina d\'estadístiques que s\'obre amb el botó 📊 de dalt.</p>'
    + row("Botó del dashboard", "1 = visible · 0 = amagat · per defecte 1", 'data-t="dashOn" min="0" max="1" step="1"', cfgGet("dashOn"), "0/1")
    + row("Dies d'activitat", "Entre 7 i 60 dies · per defecte " + CFGD.dashDays, 'data-t="dashDays" min="7" max="60" step="1"', cfgGet("dashDays"), "dies")
    + row("Articles als rànquings", "Entre 3 i 15 · per defecte " + CFGD.dashTop, 'data-t="dashTop" min="3" max="15" step="1"', cfgGet("dashTop"), "articles")
    + row("Animacions", "1 = comptadors i barres animats · 0 = directe · per defecte 1", 'data-t="dashAnim" min="0" max="1" step="1"', cfgGet("dashAnim"), "0/1")
    + '<button type="button" class="wtest" id="dashTest">📊 Obre el dashboard</button>';
}
$("cfBody").addEventListener("click", e => {
  if(e.target.closest("#fxTest")) fxCreate(true);
  else if(e.target.closest("#fxTestH")) fxHouse(null, true);
  else if(e.target.closest("#dashTest")){ $("cfdlg").close(); dashOpen(); }
});

/* ---------- assistent d'ordres: confeti, casa, dial, dashboard i filtres ---------- */
function rKeys5(nt){
  const has = re => re.test(nt), num = /\d/.test(nt);
  if(has(/\bdial\b/)){
    if(has(/vibraci|haptic/)) return ["dialVib", "la vibració del dial"];
    if(has(/\btoc\b|clic|\btap\b|obrir amb/) && !has(/mantenir|premut/)) return ["dialTap", "obrir el dial amb un toc simple"];
    if(has(/temps|espera|durada|mantenir|premut|\bhold\b|segons/)) return ["dialHold", "el temps de mantenir premut per obrir el dial"];
    if(has(/ampliaci|zoom|escala|magnifi|creix|augment/)) return ["dialMax", "l'ampliació màxima del dial (%)"];
    if(has(/radi|radio|distancia|obertura|separaci/)) return ["dialR", "el radi del dial"];
    if(has(/mida|tamany|grandaria|boto|botons/)) return ["dialS", "la mida dels botons del dial"];
    return null;
  }
  const casa = has(/\b(casa|house)\b|nau.?noa|celebraci/);
  if(casa && has(/confeti|cint[ae]s?|serpentin|celebraci|banner|cartell|durada|particul|intensitat|mostra|amaga|visible/)){
    if(has(/cint[ae]s?|serpentin/)) return ["houseR", "les cintes de Nau&Noa House"];
    if(has(/banner|cartell|missatge/)) return ["houseBan", "el cartell de Nau&Noa House"];
    if(num && has(/durada|temps|segons/)) return ["houseT", "la durada de la celebració de Nau&Noa House"];
    if(num && has(/confeti|particul|intensitat|quantitat/)) return ["houseN", "el confeti de Nau&Noa House"];
    if(has(/mostra|amaga|visible|sempre/) && has(/ubicaci/)) return ["houseShow", "mostrar sempre la ubicació Nau&Noa House"];
    if(has(/celebraci|activ|desactiv|confeti/)) return ["houseOn", "la celebració de Nau&Noa House"];
    return null;
  }
  if(has(/confeti/)){
    if(has(/volum|\bso\b|sonor/)) return ["fxVol", "el volum de la celebració"];
    if(has(/paleta|colors?|tonalitat/)) return ["fxPal", "els colors del confeti (0 auto · 1 multicolor · 2 daurat · 3 tema)"];
    if(num && has(/durada|temps|segons/)) return ["fxT", "la durada del confeti"];
    if(num) return ["fxN", "la quantitat de confeti"];
    return ["fxOn", "el confeti en crear articles"];
  }
  if(has(/dashboard|quadre de comandament/)){
    if(has(/dies|periode|historic|activitat/)) return ["dashDays", "els dies d'activitat del dashboard"];
    if(has(/\btop\b|rank|millors|principals|llista/)) return ["dashTop", "els articles dels rànquings del dashboard"];
    if(has(/animaci|moviment/)) return ["dashAnim", "les animacions del dashboard"];
    return ["dashOn", "el botó del dashboard"];
  }
  return null;
}
function rFx(nt){
  const has = re => re.test(nt), num = /\d/.test(nt);
  if(has(/\bdashboard\b|quadre de comandament/)){
    if(has(/^(tanca|tancar|amaga|surt)\b/) && !has(/boto/)){ dashClose(); rMsg("bot", "Dashboard tancat."); return true; }
    if(has(/^(obre|obrir|mostra|ensenya|veure|vull veure|ves a|anem a|dashboard|quadre)\b/) && !num && !has(/dies|periode|\btop\b|rank|animaci|boto|desactiv|activa|amaga|visible/)){
      dashOpen(); rMsg("bot", "📊 Dashboard obert." + (cfgGet("dashOn") ? "" : " (El botó està amagat als ajustos, però l'obro igualment.)")); return true;
    }
    return false;
  }
  if(!num && has(/^(prova|proba|llanca|dispara|tira|fes|mostra|veure|celebra)\b/) && has(/confeti|celebraci|serpentin|cint[ae]s/)){
    if(has(/casa|house|nau.?noa|gran|imponent|^celebra/)){ fxHouse(null, true); rMsg("bot", "🏡 Celebració de Nau&Noa House!"); }
    else { fxCreate(true); rMsg("bot", "🎉 Confeti!"); }
    return true;
  }
  if(!num && has(/^celebra\b/)){ fxHouse(null, true); rMsg("bot", "🏡 Celebració de Nau&Noa House!"); return true; }
  return false;
}
function rFilter(nt, t0){
  if(/^(treu|neteja|esborra|reinicia|reseteja|restaura|sense)\b.*\bfiltres?\b/.test(nt)){ resetFilters(); rMsg("bot", "✓ He tret tots els filtres: es veu tot l'inventari."); return true; }
  if(!/^(filtra|filtre|mostra|ensenya|veure|vull veure|ves a|anem a|obre)\b/.test(nt)) return false;
  if(/ajust|configuraci|dashboard|estadistiq|copia|resum|vista|xat|historial|desfes/.test(nt)) return false;
  const {L, C} = rNames(), fl = rFind(t0, L), fz = rFind(t0, C);
  if(!fl && !fz) return false;
  resetFilters();
  if(fl) state.loc = fl.x.id;
  if(fz) state.cat = fz.x.id;
  render(); scrollTo({top:0, behavior:"auto"});
  rMsg("bot", "✓ Filtre aplicat: " + [fl ? "📍 " + fl.x.label : "", fz ? "🏠 " + fz.x.label : ""].filter(Boolean).join(" · ") + ".");
  return true;
}

/* ---------- connexió amb la resta de la web ---------- */
const __cfgApply50 = cfgApply;
cfgApply = function(){
  refreshLocs(); if(state.loc !== "all" && !LOCS.includes(state.loc)) state.loc = "all";
  __cfgApply50();
  $("dashBtn").hidden = !cfgGet("dashOn");
  if(dashOpenF) dashSoon();
};
const __render50 = render;
render = function(){ __render50(); if(dashOpenF) dashSoon(); };
$("dashBtn").hidden = !cfgGet("dashOn");

/* ---- v5.1: icones minimalistes de les ubicacions (SVG de línia, agafen el color del tema) ---- */
const LOCICONS = {
  globe:     {n:"Món",              p:'<circle cx="24" cy="24" r="17"/><ellipse cx="24" cy="24" rx="7.5" ry="17"/><path d="M7 24h34M10 14.5h28M10 33.5h28"/>'},
  house:     {n:"Casa",             p:'<path d="M6 23 24 8l18 15"/><path d="M11 20v20h26V20"/><path d="M20 40V28h8v12"/>'},
  seahouse:  {n:"Casa de platja",   p:'<path d="M9 21 24 8l15 13"/><path d="M13 19v13h22V19"/><path d="M21 32v-7h6v7"/><path d="M5 41q3.5-4.5 7 0t7 0 7 0 7 0 7 0"/>'},
  hearthouse:{n:"Casa amb cor",     p:'<path d="M6 23 24 8l18 15"/><path d="M11 20v20h26V20"/><path d="M24 35.5l-5.6-5.4a3.4 3.4 0 0 1 5.6-3.9 3.4 3.4 0 0 1 5.6 3.9z"/>'},
  garage:    {n:"Garatge",          p:'<path d="M6 40V19L24 8l18 11v21"/><path d="M13 40V26h22v14"/><path d="M13 31h22M13 36h22"/>'},
  bed:       {n:"Habitació",        p:'<path d="M6 11v29"/><path d="M6 32h36v8"/><path d="M42 32v-5a5 5 0 0 0-5-5H21v10"/><circle cx="13.5" cy="25" r="3.6"/>'},
  building:  {n:"Pis / edifici",    p:'<path d="M12 41V8h24v33"/><path d="M8 41h32"/><path d="M18 15h4M26 15h4M18 22h4M26 22h4M18 29h4M26 29h4"/><path d="M21 41v-6h6v6"/>'},
  box:       {n:"Magatzem",         p:'<path d="M24 7 8 15v18l16 8 16-8V15z"/><path d="M8 15l16 8 16-8M24 23v18"/>'},
  sofa:      {n:"Sala / menjador",  p:'<path d="M11 24v-5a5 5 0 0 1 5-5h16a5 5 0 0 1 5 5v5"/><path d="M6 27a4 4 0 0 1 8 0v5h20v-5a4 4 0 0 1 8 0v10H6z"/><path d="M12 37v4M36 37v4"/>'},
  pot:       {n:"Cuina",            p:'<path d="M10 22h28v12a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z"/><path d="M5 26h5M38 26h5"/><path d="M14 22a10 8 0 0 1 20 0"/><path d="M24 11V8"/>'},
  bath:      {n:"Bany",             p:'<path d="M6 26h36v4a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z"/><path d="M11 26V14a4.5 4.5 0 0 1 9 0"/><path d="M13 38l-2 4M35 38l2 4"/>'},
  desk:      {n:"Oficina",          p:'<rect x="7" y="9" width="34" height="23" rx="3"/><path d="M17 41h14M24 32v9"/>'},
  leaf:      {n:"Jardí / terrassa", p:'<path d="M24 41V22"/><path d="M24 29c-9 0-13-5.5-13-13 9 0 13 5.5 13 13z"/><path d="M24 24c6.5 0 10.5-4 10.5-10.5-6.5 0-10.5 4-10.5 10.5z"/><path d="M16 41h16"/>'},
  car:       {n:"Cotxe / parking",  p:'<path d="M8 29l4-10a3 3 0 0 1 3-2h18a3 3 0 0 1 3 2l4 10"/><path d="M6 29h36v9H6z"/><circle cx="14" cy="38" r="3.4"/><circle cx="34" cy="38" r="3.4"/>'},
  beach:     {n:"Platja",           p:'<path d="M7 24a17 17 0 0 1 34 0z"/><path d="M24 24v15"/><path d="M8 41q4-4 8 0t8 0 8 0 8 0"/>'},
  mountain:  {n:"Muntanya",         p:'<path d="M4 39 18 13l9 16 5-8 12 18z"/><path d="M14 20l4 5 4-3"/>'},
  tools:     {n:"Taller / eines",   p:'<rect x="7" y="18" width="34" height="21" rx="3"/><path d="M18 18v-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3"/><path d="M7 28h34"/><path d="M21 26h6v5h-6z"/>'},
  pin:       {n:"Xinxeta",          p:'<path d="M24 42s13-12 13-22a13 13 0 0 0-26 0c0 10 13 22 13 22z"/><circle cx="24" cy="20" r="4.6"/>'}
};
/* paraules (sense accents) que fan triar la icona sola segons el nom de la ubicació; la primera que coincideix guanya */
const LOCICON_AUTO = [
  ["hearthouse", /nau.?noa|\bhouse\b/],
  ["seahouse",   /\bcunit\b/],
  ["beach",      /platj|playa|\bmar\b|costa|beach|sitges|salou|cambrils/],
  ["garage",     /garatge|garaje|garage/],
  ["bed",        /habitaci|dormitori|dormitorio|cambra|llit|bedroom|\bhab\b/],
  ["bath",       /\bbany|\bbano|bath|lavabo/],
  ["pot",        /cuina|cocina|kitchen/],
  ["sofa",       /menjador|\bsala\b|salon|living|sofa|\bsaló\b/],
  ["desk",       /oficina|despatx|despacho|\boffice\b|escriptori|estudi\b/],
  ["leaf",       /jardi|\bhort\b|terrassa|terraza|balco|\bpati\b|patio|exterior/],
  ["car",        /cotxe|coche|\bcar\b|parking|aparcament|pàrquing/],
  ["tools",      /taller|eines|herramient|workshop|\bbricolatge/],
  ["box",        /magatzem|almacen|trasters?\b|trastero|storage|caixes|cajas/],
  ["mountain",   /andorra|muntanya|montana|xalet|chalet|cabana|pirineu|\bski\b|esqui/],
  ["building",   /\bpis\b|piso|apart|\bflat\b|edifici|\bbloc\b|oficines/],
  ["house",      /\bcasa\b|\bllar\b|hogar|\bhome\b|iaios|avis\b|abuel|\bpares\b|padres|familia/]
];
/* noms que l'assistent entén («icona de Cunit a platja») */
const LOCICON_WORDS = [
  ["seahouse", ["casa de platja", "casa platja", "casa al mar"]], ["hearthouse", ["casa amb cor", "casa cor"]],
  ["house", ["casa", "llar", "hogar"]], ["garage", ["garatge", "garaje"]], ["bed", ["habitacio", "dormitori", "cambra", "llit"]],
  ["building", ["edifici", "apartament", "pis", "bloc"]], ["box", ["magatzem", "trastero", "caixa", "caixes"]], ["sofa", ["menjador", "sofa", "sala"]],
  ["pot", ["cuina", "olla"]], ["bath", ["banyera", "bany"]], ["desk", ["escriptori", "oficina", "despatx"]], ["leaf", ["jardi", "terrassa", "planta", "balco", "hort"]],
  ["car", ["cotxe", "parking", "aparcament"]], ["beach", ["platja", "parasol", "para sol"]], ["mountain", ["muntanya", "xalet", "andorra", "pirineu"]],
  ["tools", ["taller", "eines"]], ["pin", ["xinxeta", "ubicacio", "pin"]], ["globe", ["globus", "planeta", "mon"]]
];
function locIconSvg(k, size){
  const d = LOCICONS[k] || LOCICONS.pin, z = size || 24;
  return '<svg class="lic" viewBox="0 0 48 48" width="' + z + '" height="' + z + '" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d.p + '</svg>';
}
function locIconAuto(l){
  if(l === HOUSE) return "hearthouse";
  const t = norm(l);
  for(const [k, re] of LOCICON_AUTO) if(re.test(t)) return k;
  return "pin";
}
function locIconOver(l){
  const m = STATE.inv_locicons;
  return m && typeof m === "object" && !Array.isArray(m) && LOCICONS[m[l]] ? m[l] : "";
}
const locIconKey = l => locIconOver(l) || locIconAuto(l);

/* =====================================================================
   v5.1 · Dial en cercle complet i icones de les ubicacions
   ===================================================================== */
/* ---- icones de les ubicacions: tria manual (es desa al núvol) ---- */
function locIconSet(l, key){
  const cur = deep(STATE.inv_locicons);
  const m = cur && typeof cur === "object" && !Array.isArray(cur) ? cur : {};
  if(key && LOCICONS[key]) m[l] = key; else delete m[l];
  store("inv_locicons", m);
  render();
  if($("cfdlg").open) cfgRender();
}
function cfgLocIconsHtml(){
  const opts = k => Object.keys(LOCICONS).map(x => '<option value="' + x + '"' + (x === k ? ' selected' : '') + '>' + esc(LOCICONS[x].n) + '</option>').join("");
  let h = '</div><div class="cfg"><h3>🖼️ Icones de les ubicacions</h3><p class="cfn">La imatge de cada ubicació al dial i al botó de filtre. Es tria sola segons el nom, i aquí la pots canviar. Les ubicacions noves reben la seva icona sola.</p>';
  LOCS.forEach(l => {
    const ov = locIconOver(l), cur = ov || locIconAuto(l);
    h += '<label class="cfrow"><span class="cft"><b>' + esc(l) + '</b><small>' + (ov ? 'Triada per tu' : 'Automàtica: ' + esc(LOCICONS[cur].n)) + '</small></span>'
      + '<span class="cfin"><span class="cficon">' + locIconSvg(cur, 26) + '</span><select data-li="' + esc(l) + '" aria-label="Icona de ' + esc(l) + '"><option value="">Automàtica</option>' + opts(ov) + '</select></span></label>';
  });
  if(!LOCS.length) h += '<p class="cfn">Encara no hi ha cap ubicació.</p>';
  return h;
}
$("cfBody").addEventListener("change", e => {
  const t = e.target; if(!t.dataset || t.dataset.li === undefined) return;
  locIconSet(t.dataset.li, t.value);
  toast(t.value ? "🖼️ Icona de «" + t.dataset.li + "»: " + LOCICONS[t.value].n + "." : "🖼️ «" + t.dataset.li + "» torna a la icona automàtica.");
});
/* ---- assistent d'ordres: «icona de Cunit a platja» ---- */
function rIcon(nt, t0, n0){
  if(!/\bicon[ae]s?\b|\bimatge\b|\bdibuix\b/.test(nt)) return false;
  const list = Object.keys(LOCICONS).map(k => LOCICONS[k].n).join(", ");
  if(/quines|llista|disponibles|opcions|quina icona hi ha/.test(nt) && !/\b(a|per|com)\s+\w+/.test(nt.replace(/quines icones.*/, ""))){
    rMsg("bot", "🖼️ Icones disponibles: " + list + ".\n\nPer exemple: «icona de Cunit a platja» o «icona de Garatge iaios automàtica».");
    return true;
  }
  if(/(restaura|reinicia|reseteja|torna|treu).*icon|icon.*(per defecte|originals|automatiques)\b.*\btotes\b|totes les icones.*(auto|defecte)/.test(nt)){
    if(needSession()) return true;
    const m = STATE.inv_locicons;
    if(!m || !Object.keys(m).length){ rMsg("bot", "Totes les ubicacions ja tenen la icona automàtica."); return true; }
    rConfirm("Poso totes les icones de les ubicacions en automàtic (" + Object.keys(m).length + " canvis). Confirmes?", () => { store("inv_locicons", {}); render(); if($("cfdlg").open) cfgRender(); return "✓ Fet."; });
    return true;
  }
  const {L} = rNames(), fl = rFind(t0, L);
  if(!fl){ rMsg("bot", "De quina ubicació? Ubicacions: " + (LOCS.join(", ") || "—") + ".\nExemple: «icona de " + (LOCS[0] || "Cunit") + " a platja»."); return true; }
  const nn = norm(t0), rest = " " + nn.slice(0, fl.s) + " " + nn.slice(fl.e) + " ";
  const auto = /\b(auto|automatic|automatica|defecte|original)\b/.test(rest);
  let key = null, bl = 0;
  if(!auto) LOCICON_WORDS.forEach(([k, ws]) => ws.forEach(w => { if(w.length > bl && new RegExp("(^|[^a-z])" + escRe(w) + "($|[^a-z])").test(rest)){ key = k; bl = w.length; } }));
  if(!auto && !key){ rMsg("bot", "Quina icona? Opcions: " + list + ".\nExemple: «icona de " + fl.x.label + " a platja»."); return true; }
  if(needSession()) return true;
  const id = fl.x.id, cur = locIconKey(id);
  const target = auto ? locIconAuto(id) : key;
  if(cur === target && (auto ? !locIconOver(id) : locIconOver(id) === key)){ rMsg("bot", "«" + id + "» ja té aquesta icona."); return true; }
  rConfirm("Poso la icona de «" + id + "»: " + LOCICONS[cur].n + " → " + LOCICONS[target].n + (auto ? " (automàtica)" : "") + ". Confirmes?", () => { locIconSet(id, auto ? "" : key); return "✓ Fet. Es veu a tots els dispositius."; });
  return true;
}

/* =====================================================================
   v5.2 · Formulari d'article ajustat a la pantalla (sense scroll, també a l'iPhone)
   - Disseny compacte: tot el contingut hi cap sense fer scroll.
   - «Més ubicacions» i «Més zones» s'escullen en un petit selector (no ocupen espai).
   - No es fa servir CSS zoom (a l'iPhone falla): si algun dia no hi cap, s'escala amb transform.
   - Amb el teclat obert, el formulari se subjecta a l'àrea visible.
   ===================================================================== */
function fitForm(){
  const d = $("fdlg"); if(!d || !d.open) return;
  const vv = window.visualViewport, ih = window.innerHeight;
  const kb = !!vv && vv.height < ih - 120;                       /* teclat obert */
  const H = (kb ? vv.height : ih) - 16;
  d.classList.remove("scaled", "kb");
  d.style.removeProperty("--fk"); d.style.top = d.style.bottom = d.style.margin = d.style.zoom = "";
  d.style.maxHeight = "none"; d.style.overflow = "hidden";
  const nh = d.scrollHeight;
  if(kb){
    d.classList.add("kb");
    d.style.maxHeight = H + "px"; d.style.overflowY = "auto";
    d.style.top = ((vv ? vv.offsetTop : 0) + 8) + "px"; d.style.bottom = "auto"; d.style.margin = "0 auto";
    return;
  }
  if(nh <= H){ d.style.maxHeight = H + "px"; d.style.overflow = "hidden"; return; }
  const k = Math.max(.6, H / nh);
  d.classList.add("scaled"); d.style.setProperty("--fk", k.toFixed(3));
  if(H / nh < .6){ d.style.maxHeight = (H / k) + "px"; d.style.overflowY = "auto"; }   /* només en pantalles diminutes */
  else { d.style.maxHeight = "none"; d.style.overflow = "hidden"; }
}
if(window.visualViewport){ visualViewport.addEventListener("resize", () => { if($("fdlg").open) fitForm(); }); visualViewport.addEventListener("scroll", () => { if($("fdlg").open && $("fdlg").classList.contains("kb")) fitForm(); }); }
addEventListener("orientationchange", () => setTimeout(() => { if($("fdlg").open) fitForm(); }, 250));
$("fdlg").addEventListener("focusin", e => { const t = e.target; if(t && t.scrollIntoView && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) setTimeout(() => { try { t.scrollIntoView({block:"nearest"}); } catch(_){} }, 320); });

/* ---- «Més ubicacions» / «Més zones»: selector petit ---- */
function pkUpdate(){
  const L = checkedOf("fLocs2"), Z = checkedOf("fCats2").map(id => (CATS.find(z => z.id === id) || {}).label).filter(Boolean);
  const set = (btn, txt, list) => { $(txt).textContent = list.length ? list.join(", ") : "Cap altra"; $(btn).classList.toggle("has", !!list.length); };
  set("fLocsBtn", "fLocsTxt", L); set("fCatsBtn", "fCatsTxt", Z);
}
const __fillMulti52 = fillMulti;
fillMulti = function(a, b){ __fillMulti52(a, b); pkUpdate(); };
let mpKind = "";
function mpOpen(kind){
  mpKind = kind;
  $("mpTitle").textContent = kind === "loc" ? "📍 Més ubicacions" : "🏠 Més zones";
  $("mpHint").textContent = kind === "loc" ? "L'article també comptarà a aquestes ubicacions." : "L'article també comptarà i es veurà a aquestes zones.";
  $("mpBody").appendChild($(kind === "loc" ? "fLocs2" : "fCats2"));
  $("mpdlg").showModal();
}
function mpBack(){ const c = $("mpBody").firstElementChild; if(c) $("fHold").appendChild(c); pkUpdate(); }
$("fLocsBtn").onclick = () => mpOpen("loc");
$("fCatsBtn").onclick = () => mpOpen("cat");
$("mpOk").onclick = () => $("mpdlg").close();
$("mpNone").onclick = () => { $("mpBody").querySelectorAll("input:checked").forEach(i => { i.checked = false; }); pkUpdate(); };
$("mpdlg").addEventListener("close", mpBack);
["fLocs2", "fCats2"].forEach(id => $(id).addEventListener("change", pkUpdate));
pkUpdate();

/* =====================================================================
   v6.0 · 🛒 Llista de la compra compartida (meta/state · camp inv_compra)
   inv_compra = {id: {n: nom, z: zona, k: clau del pendent (si en ve), t: quan s'ha afegit, b: qui, d: quan s'ha comprat (0 = encara no)}}
   Si ve d'un pendent, en comprar-lo el pendent queda com a aconseguit. Tot surt a ↶ Desfés.
   ===================================================================== */
function buyRaw(){ const o = STATE.inv_compra; return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }
function buyDone(e){ return !!e.d || !!(e.k && have[e.k]); }
function buyOpen(){ return Object.values(buyRaw()).filter(e => e && !buyDone(e)); }
function buyHas(key){ return !!buyRaw()[key] && !buyDone(buyRaw()[key]); }
function buyCommit(fn){
  if(!cloudUser){ toast("Cal iniciar sessió."); return; }
  const o = deep(buyRaw()) || {};
  fn(o);
  store("inv_compra", o);
  buyRefresh();
}
function buyAdd(o, id, name, zone, pkey){
  o[id] = {n:name, z:zone || "", t:Date.now(), b:chatName(chatMe()), d:0};
  if(pkey) o[id].k = pkey;
}
function buyBadge(){
  const n = buyOpen().length;
  $("buyN").hidden = !n; $("buyN").textContent = n > 99 ? "99+" : n;
  $("buyBtn").title = n ? "Llista de la compra · " + n + (n > 1 ? " coses per comprar" : " cosa per comprar") : "Llista de la compra";
}
function buyRefresh(){
  buyBadge();
  if($("buydlg").open) buyRender();
  sections.forEach(s => { if(s.cat.id !== "__new" && s.el.querySelector(".pend-list")) renderPend(s); });
  if(view === "check") renderCheck();
}
function buyRender(){
  const all = Object.entries(buyRaw()).filter(([, e]) => e && e.n);
  const todo = all.filter(([, e]) => !buyDone(e)).sort((a, b) => (a[1].z || "~").localeCompare(b[1].z || "~") || a[1].t - b[1].t);
  const done = all.filter(([, e]) => buyDone(e)).sort((a, b) => (b[1].d || 0) - (a[1].d || 0));
  $("buySub").textContent = todo.length ? todo.length + (todo.length > 1 ? " coses per comprar" : " cosa per comprar") + " · compartida entre NAU i NOA" : "Compartida entre NAU i NOA";
  const zl = id => { const z = CATS.find(x => x.id === id); return z ? z.icon + " " + z.label : "🛒 Altres"; };
  const row = ([id, e], on) => '<li class="bi' + (on ? ' done' : '') + '"><label><input type="checkbox" data-id="' + esc(id) + '"' + (on ? ' checked' : '') + '><span class="bn">' + esc(e.n) + '</span></label>'
    + '<small class="bm">' + esc(e.b || "") + (e.k ? ' · pendent' : '') + '</small><button type="button" class="bdel" data-del="' + esc(id) + '" aria-label="Treu ' + esc(e.n) + ' de la llista">✕</button></li>';
  let h = "", last = null;
  if(!todo.length) h += '<p class="buyempty">🎉 No cal comprar res.<br><small>Afegeix coses amb el camp de dalt o amb el botó 🛒 dels pendents.</small></p>';
  todo.forEach(x => { const z = x[1].z || ""; if(z !== last){ if(last !== null) h += '</ul>'; h += '<h3 class="bz">' + esc(zl(z)) + '</h3><ul class="bul">'; last = z; } h += row(x, false); });
  if(last !== null) h += '</ul>';
  if(done.length) h += '<details class="bdone"><summary>Comprat (' + done.length + ')</summary><ul class="bul">' + done.map(x => row(x, true)).join("") + '</ul><button type="button" class="bclean" id="buyClean">Treu els comprats de la llista</button></details>';
  $("buyList").innerHTML = h;
}
$("buyBtn").onclick = () => {
  if(!cloudUser){ toast("Cal iniciar sessió per fer servir la llista."); return; }
  buyRender(); $("buydlg").showModal();
  if(!isTouch) $("buyIn").focus();
};
$("buyClose").onclick = () => $("buydlg").close();
$("buyForm").onsubmit = e => {
  e.preventDefault();
  const name = $("buyIn").value.trim().replace(/\s+/g, " "); if(!name) return;
  const g = zoneGuess(name);
  buyCommit(o => buyAdd(o, "f" + Date.now(), name.charAt(0).toUpperCase() + name.slice(1), g ? g.z.id : ""));
  $("buyIn").value = ""; $("buyIn").focus();
};
$("buyList").addEventListener("change", e => {
  const b = e.target; if(b.type !== "checkbox") return;
  const id = b.dataset.id, x = buyRaw()[id]; if(!x) return;
  if(b.checked){
    buyCommit(o => { o[id].d = Date.now(); });
    if(x.k && !have[x.k]){ have[x.k] = true; store("inv_tinc", have); refreshPend(x.k.split(":")[0]); toast("✓ «" + x.n + "» comprat. Ja no és pendent: en pots crear la fitxa des de «Ja aconseguits»."); }
    else toast("✓ «" + x.n + "» comprat.");
  } else {
    buyCommit(o => { o[id].d = 0; });
    if(x.k && have[x.k] === true){ delete have[x.k]; store("inv_tinc", have); refreshPend(x.k.split(":")[0]); }
  }
});
$("buyList").addEventListener("click", e => {
  const d = e.target.closest("[data-del]");
  if(d){ const id = d.dataset.del; buyCommit(o => { delete o[id]; }); return; }
  if(e.target.closest("#buyClean")){ buyCommit(o => { Object.keys(o).forEach(id => { if(buyDone(o[id])) delete o[id]; }); }); toast("🧹 Comprats trets de la llista."); }
});
function buyText(){
  const todo = buyOpen().sort((a, b) => (a.z || "~").localeCompare(b.z || "~"));
  return "🛒 Llista de la compra\n" + todo.map(e => "• " + e.n).join("\n");
}
$("buyShare").onclick = async () => {
  if(!buyOpen().length){ toast("La llista és buida."); return; }
  const text = buyText();
  try { if(navigator.share){ await navigator.share({title:"Llista de la compra", text}); return; } } catch(e){ if(e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); toast("📋 Llista copiada: enganxa-la on vulguis."); } catch(e){ toast("No s'ha pogut copiar la llista."); }
};
/* «Des de pendents»: tria una zona i s'hi afegeixen tots els pendents que encara no hi són */
$("buyFromPend").onclick = () => {
  const zs = CATS.map(z => ({z, n:pendRows(z.id).filter(r => !have[r.key] && !buyHas(r.key)).length})).filter(x => x.n);
  if(!zs.length){ toast("No hi ha pendents per afegir."); return; }
  const box = document.createElement("div"); box.className = "buypick";
  box.innerHTML = '<p>Afegeix els pendents de:</p>' + zs.map(x => '<button type="button" class="sbtn" data-z="' + x.z.id + '">' + x.z.icon + ' ' + esc(x.z.label) + ' <b>' + x.n + '</b></button>').join("");
  box.onclick = e => {
    const b = e.target.closest("[data-z]"); if(!b) return;
    buyPendZone(b.dataset.z); box.remove();
  };
  const old = $("buyList").querySelector(".buypick"); if(old) old.remove();
  $("buyList").prepend(box);
};
function buyPendZone(zid){
  const rows = pendRows(zid).filter(r => !have[r.key] && !buyHas(r.key));
  if(!rows.length){ toast("No queda cap pendent per afegir."); return; }
  buyCommit(o => rows.forEach(r => buyAdd(o, r.key, r.name, zid, r.key)));
  toast("🛒 " + rows.length + (rows.length > 1 ? " pendents afegits" : " pendent afegit") + " a la compra.");
}
/* botó 🛒 al costat de cada pendent (panell de pendents i vista Check) */
function buyBtnHtml(catId, r){ return '<button type="button" class="pbuy' + (buyHas(r.key) ? ' on' : '') + '" data-cat="' + catId + '" data-k="' + r.key + '" data-n="' + esc(r.name) + '" aria-pressed="' + buyHas(r.key) + '" title="' + (buyHas(r.key) ? 'És a la llista de la compra (toca per treure-ho)' : 'Afegeix a la llista de la compra') + '">🛒</button>'; }
document.addEventListener("click", e => {
  const b = e.target.closest(".pbuy, .pbuyall"); if(!b) return;
  if(b.classList.contains("pbuyall")){ buyPendZone(b.dataset.cat); return; }
  const k = b.dataset.k;
  if(buyHas(k)){ buyCommit(o => { delete o[k]; }); toast("«" + b.dataset.n + "» tret de la compra."); }
  else { buyCommit(o => buyAdd(o, k, b.dataset.n, b.dataset.cat, k)); toast("🛒 «" + b.dataset.n + "» afegit a la compra."); }
});
const __cloudMeta60 = cloudMeta;
cloudMeta = function(m){ __cloudMeta60(m); buyBadge(); if($("buydlg").open) buyRender(); };

/* ---- v6.0 · dreceres de l'app instal·lada (mantén premuda la icona): ?obre=compra · ?obre=nou ---- */
let openParam = new URLSearchParams(location.search).get("obre");
function openFromParam(){
  if(!openParam || !cloudUser || !cloudLoaded) return;
  const p = openParam; openParam = null;
  try { history.replaceState(null, "", location.pathname); } catch(_){}
  if(p === "compra") $("buyBtn").click(); else if(p === "nou") openNewArticle();
}
const __cloudItems60 = cloudItems;
cloudItems = function(d, m){ __cloudItems60(d, m); if(openParam) setTimeout(openFromParam, 300); };

gate("wait", "Connectant…");
cloudSetStatus();

setView(view);
updateSub();
render();
document.documentElement.classList.add("js");

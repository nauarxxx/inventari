/* Inventari de casa · sync.js
   Sincronització en temps real amb Firestore (cloud.js), sessió de Google, botó del núvol, importar i exportar,
   historial ↶ Desfés, còpies de seguretat, miniatures i espai ocupat.
   items/{id}  -> article (sense fotos; ph = ids de les fotos; tm = miniatures)
   photos/{id} -> {d: foto en dataURL, it: id de l'article}   (es baixen d'una en una, quan cal)
   meta/state  -> pendents, zones, ubicacions, ajustos, colors i icones (KEYS_CLOUD)
   hist/{id}   -> canvis per desfer · bkmeta/bkdata -> còpies de seguretat · chat, chatread -> xat */

/* ids de totes les fotos que fan servir els articles */
const phIds = () => { const s = new Set(); RAW.forEach(d => (d.ph || []).forEach(p => s.add(p))); return s; };
const PH_AVG = 100000;   /* mida mitjana estimada d'una foto completa si encara no s'ha mesurat */
/* mida real de les fotos. Es mesura cada vegada que es baixen totes (reduir, netejar, exportar) i es guarda en aquest dispositiu */
function phStatSave(all){
  let b = 0; all.forEach(d => { b += d.length; });
  try { localStorage.setItem("inv_phstats", JSON.stringify({n:all.size, b, ts:Date.now()})); } catch(e){}
}
function phStat(){ try { const s = JSON.parse(localStorage.getItem("inv_phstats") || "null"); return s && s.n > 0 ? s : null; } catch(e){ return null; } }
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
  cfgApply();
}
function cloudItems(docs, meta){
  itemsCache = meta.cache; itemsPending = meta.pending;
  if(!meta.cache){ everServer = true; srvDown = false; clearTimeout(connT); }
  if(!meta.cache || docs.length) cloudLoaded = true;
  cloudSetStatus();
  bkAutoCheck();
  if(!meta.changed && !(cloudLoaded && !DATA.length)) return;
  RAW = new Map(docs.map(d => [d.id, d.data]));
  scheduleRebuild();
  if(!meta.cache) setTimeout(thumbMigrate, 2500);
  if(openParam) setTimeout(openFromParam, 300);
}

/* ---- els articles antics (o els que ha desat la v5) reben les miniatures que els falten ----
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
  let failed = 0, lastErr = null;
  try {
    /* si el núvol no deixa desar-les, es continuen fent igualment en aquest dispositiu perquè es vegin les fotos */
    for(let k = 0; k < todo.length; k += 6){
      const ops = [];
      for(const [id] of todo.slice(k, k + 6)){
        const d = RAW.get(id); if(!d) continue;
        const tm = Object.assign({}, d.tm || {});
        Object.keys(tm).forEach(p => { if(!(d.ph || []).includes(p)) delete tm[p]; });
        for(const p of tmMissing(d)){
          let t = PHT.get(p);
          if(!t){ try { const full = await fullPhoto(p); t = full ? await makeThumb(full) : ""; } catch(e){ t = ""; lastErr = e; } }
          if(t){ tm[p] = t; phSetThumb(p, t); phShow(p); done++; } else tmFail.add(p);
        }
        if(RAW.has(id) && stable(tm) !== stable(d.tm || {})) ops.push({t:"upd", col:"items", id, data:{tm}});
      }
      if(netOffline() || importing) break;
      if(ops.length && !tmBlocked){
        try { await cloud.batch(ops); }
        catch(e){ failed++; lastErr = e; console.warn("miniatures", e); if(e && e.code === "permission-denied") tmBlocked = true; }
      }
    }
  } catch(e){ lastErr = e; console.warn("miniatures", e); }
  finally { tmBusy = false; }
  if(tmBlocked){ if(tmWarned) return; tmWarned = true; toast("⚠️ Les miniatures no es poden desar al núvol (permís denegat a Firestore). Les fotos es veuran igualment, però carregaran més lentes."); }
  else if(failed) toast("⚠️ Algunes miniatures no s'han pogut desar (" + (lastErr && lastErr.code || "error") + "). Es tornarà a provar en obrir la web.");
  else if(total > 6 && done) toast("✓ Fotos optimitzades (" + done + ").");
}
let tmBlocked = false, tmWarned = false;



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


/* ---- sessió ---- */
function gate(mode, msg){
  const g = $("gate");
  g.hidden = mode === "ok";
  $("gMsg").textContent = msg || "";
  $("gIn").hidden = mode !== "in";
  $("gOut").hidden = mode !== "denied";
  document.body.classList.toggle("lock", mode !== "ok" || $("dlg").classList.contains("open"));
}
/* canvi de sessió (també en entrar): es tanca tot el que depèn del compte anterior */
function cloudAuth(u){
  BK = []; bkLoaded = false; bkAutoDone = false;
  ["bkdlg", "cfdlg", "basdlg", "sdlg"].forEach(id => { if($(id).open) $(id).close(); });
  aiDisarm(); adminClose(); cfgSetLock(true); chatReset();
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

/* ---- botó del núvol: doble toc = comprova la sincronització ----
   S'il·lumina 2 segons en verd si tot és al núvol o en vermell si no, amb un avís que en diu el motiu.
   Si hi ha canvis per enviar, primer els envia i espera un moment que arribin. */
let cloudTapT = 0, cloudFlashT = 0;
function cloudSyncState(){
  const pend = inflight > 0 || itemsPending || pendKeys.size > 0;
  if(cloudFail) return {ok:false, why:"Error de connexió amb el núvol (" + cloudFail + ")."};
  if(!cloudUser) return {ok:false, why:"No hi ha cap sessió iniciada."};
  if(netOffline()) return {ok:false, why:pend ? "Sense connexió: hi ha canvis pendents d'enviar. S'enviaran sols quan tornis a tenir internet." : "Sense connexió a internet."};
  if(!cloudLoaded) return {ok:false, why:"Encara s'està carregant l'inventari."};
  if(pend) return {ok:false, why:"Hi ha canvis que encara s'estan enviant al núvol."};
  return {ok:true, why:"Tot sincronitzat: " + DATA.filter(live).length + " articles al núvol."};
}
async function cloudCheck(){
  const b = $("saveBtn");
  b.classList.remove("flash-ok", "flash-bad"); b.classList.add("checking");
  if(pendKeys.size) cloudFlushKeys();
  for(let k = 0; k < 15 && cloudUser && !netOffline() && (inflight > 0 || itemsPending || pendKeys.size > 0); k++) await new Promise(r => setTimeout(r, 100));
  const s = cloudSyncState();
  b.classList.remove("checking"); void b.offsetWidth;
  b.classList.add(s.ok ? "flash-ok" : "flash-bad");
  toast((s.ok ? "✅ " : "❌ ") + s.why);
  vib(s.ok ? 15 : [30, 60, 30]);
  clearTimeout(cloudFlashT); cloudFlashT = setTimeout(() => b.classList.remove("flash-ok", "flash-bad"), 2000);
}
$("saveBtn").onclick = () => {
  if(cloudTapT){ clearTimeout(cloudTapT); cloudTapT = 0; cloudCheck(); return; }
  cloudTapT = setTimeout(() => { cloudTapT = 0; toast("☁️ Fes doble toc per comprovar si tot està sincronitzat."); }, cfgGet("dbl"));
};
/* ---- menú del núvol (des de ⚙️): exportar, tancar la sessió ---- */
function cloudMenuOpen(){
  $("sInfo").textContent = (cloudUser ? "Sessió: " + cloudUser.email + " · " : "") + DATA.filter(live).length + " articles · " + phIds().size + " fotos al núvol.";
  $("sdlg").showModal();
}
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
    /* les fotos antigues no s'esborren aquí (les poden fer servir les còpies): ho fa «Neteja les fotos sense ús» */
    const ops = [];
    [...RAW.keys()].forEach(id => ops.push({t:"del", col:"items", id}));
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
    KEYS_CLOUD.forEach(k => { const v = pk.keys[k]; meta[k] = v != null ? v : (k === "inv_cats" || k === "inv_locs" ? [] : k === "inv_cfg" ? (deep(cfgRaw()) || {}) : {}); });
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
   Historial de canvis i desfer (compartit entre dispositius)
   hist/{id} -> {ts, who, label, parts:[{k:"item",id,before,after} | {k:"meta",f,before,after}], undone, of}
   ===================================================================== */
let HIST_MAX = CFGD.histMax;

let HIST = [], histLoaded = false, HG = null, histBusy = false, hcTarget = null, HTAG = "";

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
    if((b.tipus || "") !== (a.tipus || "")) ch.push("tipus → " + (a.tipus || "automàtic"));
    if((b.dt || 0) !== (a.dt || 0)) ch.push(a.dt ? "data de la foto → " + fmtDate(a.dt) : "data de la foto treta");
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
  if(f === "inv_tinc" || f === "inv_pend_tret" || f === "inv_theme" || f === "inv_locicons"){
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
    } else if(KEYS_CLOUD.includes(p.f)){   /* canvis de dades que ja no existeixen (p. ex. la llista de la compra) no es desfan */
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
/* fotos que fan servir les còpies de seguretat noves (les còpies ja no dupliquen les fotos) */
const bkPh = () => { const s = new Set(); BK.forEach(b => (b.phs || []).forEach(x => s.add(x))); return s; };
/* tot el que encara necessita una foto: articles, historial, còpies i canvis per desar */
function phRefs(keep){
  const ref = histPh(keep || HIST);
  phIds().forEach(x => ref.add(x));
  bkPh().forEach(x => ref.add(x));
  DATA.forEach(c => (c._ph || []).forEach(x => ref.add(x)));
  if(HG) HG.parts.forEach(p => { if(p.k === "item") [p.before, p.after].forEach(o => o && (o.ph || []).forEach(x => ref.add(x))); });
  return ref;
}
/* esborra les fotos candidates que ja no necessita ningú */
function photoGC(cands, keep){
  if(!window.cloud || !cloudLoaded || itemsCache || !histLoaded || !bkLoaded || importing || bkBusy) return;
  const ref = phRefs(keep);
  const dead = [...cands].filter(x => !ref.has(x));
  if(dead.length) cloud.batch(dead.map(id => ({t:"del", col:"photos", id}))).catch(() => {});
}
function histGC(keep, old){ photoGC(histPh(old), keep); }
/* ↶ Desfés guarda els canvis dels últims N dies (per defecte 3) i com a màxim histMax */
function histTrim(){
  if(!histLoaded || importing || !window.cloud || !cloudUser) return;
  const lim = Date.now() - cfgGet("histDays") * 864e5;
  const keep = HIST.filter((h, i) => i < HIST_MAX && (h.ts || 0) >= lim), old = HIST.filter(h => !keep.includes(h));
  if(!old.length) return;
  cloud.batch(old.map(h => ({t:"del", col:"hist", id:h.id}))).then(() => histGC(keep, old)).catch(() => {});
}
function cloudHist(docs){
  HIST = docs.filter(h => h && Array.isArray(h.parts)).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  histLoaded = true;
  clearTimeout(cloudHist.t); cloudHist.t = setTimeout(histTrim, 1500);
  histBadge();
  if($("hdlg").open) histRender();
}
/* el número del botó només compta els canvis fets durant el dia en curs (la llista de ↶ Desfés els té tots) */
function histBadge(){
  const n = HIST.filter(h => !h.undone && isToday(h.ts)).length;
  $("histN").hidden = !n; $("histN").textContent = n > 99 ? "99+" : n;
  $("histBtn").title = n ? "Desfés · " + n + (n > 1 ? " canvis d'avui" : " canvi d'avui") : "Historial de canvis: desfés el que has fet";
}
let dayT = 0;
function histDayTimer(){   /* a mitjanit el número torna a 0 */
  clearTimeout(dayT);
  const n = new Date(), next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 2);
  dayT = setTimeout(() => { histBadge(); histTrim(); histDayTimer(); }, Math.max(1000, next - n));
}

document.addEventListener("visibilitychange", () => { if(!document.hidden) histBadge(); });

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
   💾 Còpies de seguretat
   bkmeta/{id}  -> {ts, name, who, ver, nItems, nPh, keys, chunks[], kind, phRef, phs[]}
   bkdata/{id}  -> {b: id còpia, k: "i"|"p", n, v}   (articles en blocs < 600 KB; les còpies antigues també hi tenen les fotos, «p»)
   ===================================================================== */

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
/* Crea la còpia a partir de l'estat que hi ha ara a la memòria (articles, pendents, zones, ubicacions i ajustos).
   les fotos NO es copien: la còpia apunta a les fotos (phs) i aquestes no s'esborren mentre alguna còpia les faci servir.
   Les fotos mai canvien de contingut (cada foto nova té un id nou), per això n'hi ha prou de guardar-ne l'id. */
async function bkMake(name, o){
  o = o || {};
  const items = [...RAW].map(([id, d]) => { const c = Object.assign({}, deep(d), {id}); delete c.tm; return c; });
  const phs = new Set(); items.forEach(c => (c.ph || []).forEach(p => phs.add(p)));
  const keys = {};
  KEYS_CLOUD.forEach(k => { keys[k] = STATE[k] === undefined ? (k === "inv_cats" || k === "inv_locs" ? [] : {}) : deep(STATE[k]); });
  const bid = cloud.newId(), ops = [], chunks = [];
  bkPack(items.map(c => [c.id, c])).forEach((g, n) => { const id = bid + "_i" + n; chunks.push(id); ops.push({t:"set", col:"bkdata", id, data:{b:bid, k:"i", n, v:g.map(e => e[1])}}); });
  const meta = {ts:Date.now(), name:name || "", who:cloudUser.email, ver:APP_VER, nItems:items.length, nPh:phs.size, keys, chunks, kind:o.kind || "manual", phRef:true, phs:[...phs]};
  ops.push({t:"set", col:"bkmeta", id:bid, data:meta});
  await cloud.batch(ops, o.prog);
  return Object.assign({id:bid}, meta);
}
/* esborra unes còpies i després les fotos que només feien servir elles */
async function bkDrop(list){
  if(!list.length) return;
  const ops = [], cands = new Set();
  list.forEach(b => { (b.chunks || []).forEach(id => ops.push({t:"del", col:"bkdata", id})); ops.push({t:"del", col:"bkmeta", id:b.id}); (b.phs || []).forEach(p => cands.add(p)); });
  await cloud.batch(ops);
  const gone = new Set(list.map(b => b.id));
  BK = BK.filter(b => !gone.has(b.id));
  if(cands.size) setTimeout(() => photoGC(cands), 1500);
}
async function bkPrune(fresh, protect){
  const max = cfgGet("bkMax");
  const all = [fresh].concat(BK.filter(b => b.id !== fresh.id)).sort((a, b) => b.ts - a.ts);
  if(all.length <= max) return;
  await bkDrop(all.slice(max).filter(b => b.id !== protect && b.id !== fresh.id));
}
const bkErrTxt = e => e && e.code === "backup-corrupt" ? "La còpia està incompleta o trencada: no s'ha tocat res." : "No s'ha pogut completar (" + (e && e.code || "error") + ").";
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
  try { await bkDrop([b]); toast("🗑️ Còpia eliminada."); }
  catch(e){ cloudErr(e); }
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
    /* còpies noves: les fotos són a la col·lecció photos (protegides); còpies antigues: les fotos són dins de la còpia */
    if(!okc || itemsArr.length !== b.nItems || itemsArr.some(c => !c.id) || (!b.phRef && (Object.keys(phObj).length !== b.nPh || itemsArr.some(c => (c.ph || []).some(p => !phObj[p]))))) throw {code:"backup-corrupt"};
    /* còpia automàtica de l'estat actual, per poder tornar enrere (ara és lleugera: no copia fotos) */
    bkShow("Guardant l'estat actual (còpia de seguretat)…", .1);
    const safe = await bkMake("Abans de restaurar «" + label + "»", {kind:"safe"});
    BK.unshift(safe);
    await bkPrune(safe, id);
    /* aplica la còpia. Les fotos que sobrin no s'esborren aquí: les neteja la caducitat de Desfés i de les còpies */
    const owner = {}; itemsArr.forEach(c => (c.ph || []).forEach(p => { owner[p] = c.id; }));
    const ops = [], keep = new Set(itemsArr.map(c => c.id));
    itemsArr.forEach(c => {
      const o = Object.assign({}, c); delete o.id;
      const tm = Object.assign(tmOf(o.ph), o.tm || {}); delete o.tm;
      Object.keys(tm).forEach(p => { if(!(o.ph || []).includes(p)) delete tm[p]; });
      if(Object.keys(tm).length) o.tm = tm;
      ops.push({t:"set", col:"items", id:c.id, data:o});
    });
    Object.keys(phObj).forEach(pid => ops.push({t:"set", col:"photos", id:pid, data:{d:phObj[pid], it:owner[pid] || ""}}));
    /* la llista de la compra no és a les còpies antigues (v5): es manté la d'ara */
    const meta = {}; KEYS_CLOUD.forEach(k => { const v = b.keys && b.keys[k]; meta[k] = v != null ? v : (k === "inv_cats" || k === "inv_locs" ? [] : {}); });
    ops.push({t:"set", col:"meta", id:"state", data:meta});
    [...RAW.keys()].filter(i => !keep.has(i)).forEach(i => ops.push({t:"del", col:"items", id:i}));
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
    const list = DATA.filter(live), all = await cloud.allPhotos(); phStatSave(all);
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
   📊 Espai ocupat, fotos sense ús i reduir fotos (manteniment de la configuració avançada)
   ===================================================================== */
/* ---- estadístiques de l'inventari ---- */
const FREE_BYTES = 1073741824; /* 1 GiB: límit gratuït de Firestore */
const mbTxt = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0).replace(".", ",");
function invStats(){
  const L = DATA.filter(live), tot = L.length;
  const units = L.reduce((s, c) => s + (typeof c.qty === "number" ? c.qty : 0), 0);
  /* v6: les fotos completes no són totes a la memòria; la mida es calcula amb la mitjana de les que s'han obert */
  const phN = phIds().size, seen = [...PHF.values()];
  const st = phStat();
  const avg = st ? st.b / st.n : seen.length >= 5 ? seen.reduce((s, u) => s + u.length, 0) / seen.length : PH_AVG;
  const thBytes = [...PHT.values()].reduce((s, u) => s + u.length, 0);
  const phBytes = phN * avg;
  /* les còpies noves no dupliquen fotos; les antigues (v5/v6.0) sí */
  /* còpies antigues: les fotos van en blocs de fins a 600 KB («_p»), així se'n sap la mida aproximada real */
  const bkBytes = BK.reduce((s, b) => s + (b.phRef ? (b.phs || []).length * 24 : (b.chunks || []).filter(c => /_p\d+$/.test(c)).length * BK_SIZE * .92) + (b.nItems || 0) * 700, 0);
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

/* ---- 🗜️ redueix les fotos antigues a la mida nova (mateix id: els articles, Desfés i les còpies no canvien) ---- */
let shrinkBusy = false;
function shrinkData(u){
  return new Promise(res => { const im = new Image(); im.onload = () => { try { const out = photoJpeg(im, im.naturalWidth || im.width, im.naturalHeight || im.height); THUMB_OF.delete(out); res(out); } catch(e){ res(null); } }; im.onerror = () => res(null); im.src = u; });
}
async function photoShrinkAll(){
  if(shrinkBusy) return;
  if(!cloudUser || !window.cloud || netOffline()){ toast("Cal tenir connexió."); return; }
  shrinkBusy = true;
  try {
    toast("🔎 Revisant les fotos del núvol…");
    const all = await cloud.allPhotos(); phStatSave(all);
    const big = [...all].filter(([, d]) => d.length > PHOTO_MAX_CHARS * 1.2);
    if(!big.length){ toast("✓ Totes les fotos ja tenen la mida nova."); if($("cfdlg").open) cfgRender(); return; }
    const before = big.reduce((s, [, d]) => s + d.length, 0);
    if(!confirm("Reduir " + big.length + (big.length === 1 ? " foto" : " fotos") + " (≈ " + mbTxt(before) + " MB)?\n\nEs veuran igual a la web però ocuparan molt menys. Pot trigar una estona: deixa la web oberta.")) return;
    let after = 0, done = 0;
    for(let k = 0; k < big.length; k += 10){
      const ops = [];
      for(const [id, d] of big.slice(k, k + 10)){
        const nd = await shrinkData(d);
        if(nd && nd.length < d.length * .9){ ops.push({t:"set", col:"photos", id, data:{d:nd}, fields:["d"]}); after += nd.length; all.set(id, nd); if(PHF.has(id)) phSetFull(id, nd); }
        else after += d.length;
        done++;
      }
      if(ops.length) await cloud.batch(ops);
      toast("🗜️ Reduint fotos… " + done + " / " + big.length);
    }
    phStatSave(all);
    toast("✓ Fotos reduïdes: " + mbTxt(before) + " MB → " + mbTxt(after) + " MB.");
    if($("cfdlg").open) cfgRender();
  } catch(e){ cloudErr(e); }
  finally { shrinkBusy = false; }
}
/* ---- fotos sense ús ----
   v6: per saber-ho cal mirar totes les fotos del núvol; es fa només quan toques «Neteja». */
let orphLast = null;
function orphanPhotos(all){
  if(!cloudLoaded || itemsCache || !histLoaded || !bkLoaded) return null;
  const ref = phRefs();
  return [...all.keys()].filter(x => !ref.has(x));
}
async function photoClean(){
  if(!cloudUser || !window.cloud || netOffline() || inflight > 0 || itemsPending){ toast("Cal tenir connexió i cap canvi pendent de sincronitzar."); return; }
  if(!cloudLoaded || itemsCache || !histLoaded){ toast("Espera que s'acabi de carregar tot i torna-ho a provar."); return; }
  toast("🔎 Revisant les fotos del núvol…");
  let all;
  try { all = await cloud.allPhotos(); phStatSave(all); } catch(e){ cloudErr(e); return; }
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
  else if(e.target.closest("#cShrink")) photoShrinkAll();
  else if(e.target.closest("#cTest")) chatBeep(true);
});



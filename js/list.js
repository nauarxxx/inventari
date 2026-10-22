/* Inventari de casa · list.js
   La llista d'articles: seccions per zona (i «Nous»), targetes, pendents de cada zona, vista Check,
   la barra de cerca i els filtres d'ubicació, zona i tipus amb el dial. */

/* cada secció: {el, cat, n, grid, cards}. Les targetes es construeixen una vegada; filtrar només les amaga o mostra */
const sections = [];

function card(c,i){
  let ph;
  const qty = '<span class="qty">'+esc(qtyBadge(c.qty))+'</span>';
  const nw = isNew(c), NT = nw ? '<span class="newtag">NEW</span>' : '';
  if(c.photos.length){
    const p0 = c._ph && c._ph[0], lz = p0 && !PHT.has(p0) && !PHF.has(p0) ? ' data-ph="'+esc(p0)+'"' : '';
    ph = '<div class="ph'+(nw?' isnew':'')+'"><img loading="lazy" decoding="async" alt="'+esc(c.item)+'" src="'+thumbSrc(c)+'"'+lz+'>'+qty+NT+(c.photos.length>1?'<span class="more">'+c.photos.length+' fotos</span>':'')+'</div>';
  } else {
    ph = '<div class="ph empty'+(nw?' isnew':'')+'">'+qty+NT+'<span>'+(c.pend>0?'Foto pendent de tornar a enviar':'Encara sense foto')+'</span></div>';
  }
  let tags = locsOf(c).map(l => '<span class="tag loc-tag">📍 '+esc(l)+'</span>').join("");
  if(c.estado==="conf") tags += '<span class="tag conf">Quantitat per confirmar</span>';
  if(c.estado==="sin") tags += '<span class="tag sin">Sense foto</span>';
  if(c.pend>0) tags += '<span class="tag pend">Foto pendent</span>';
  return '<li class="card" data-i="'+i+'"><button class="card-btn" type="button" data-i="'+i+'" aria-label="Detalls de '+esc(c.item)+'">'+ph+'<div class="body"><h3>'+esc(c.item)+'</h3><p class="lmeta desc">Quantitat: <b>'+esc(c.qty)+'</b>'+(typeOf(c)?' · '+typeIco(typeOf(c))+' <b>'+esc(typeOf(c))+'</b>':'')+'</p>'+(c.desc?'<p class="desc">'+esc(c.desc)+'</p>':'')+(c.note?'<p class="lnote">'+esc(c.note)+'</p>':'')+'<div class="tags">'+tags+'</div></div></button></li>';
}

/* la targeta d'un article existeix a cada zona on és; a «Totes» només es mostra a la zona principal */
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

let view = load("inv_vista", "grid");
function setView(v){
  view = v; store("inv_vista", v);
  document.body.classList.toggle("list", v==="list");
  document.body.classList.toggle("check", v==="check");
  document.querySelectorAll(".views button, .vbar button").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.v===v)));
  if(sections.length) render();
}
const VIEWS = '<span class="views" role="group" aria-label="Vista"><button type="button" data-v="grid">▦ Imatges</button><button type="button" data-v="list">☰ Llista</button><button type="button" data-v="check">☑ Check</button></span>';
document.addEventListener("click", e => { const b = e.target.closest(".views button, .vbar button"); if(b) setView(b.dataset.v); });
function updateSub(){
  const L = DATA.filter(live);
  $("sub").innerHTML = L.length + " articles · " + L.filter(c => c.photos.length).length + ' amb foto<span class="subhint">. Toca un article per veure\'n els detalls.</span>';
}


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
  let h = todo.map(r => '<li><label><input type="checkbox" data-k="'+r.key+'"><span>'+esc(r.name)+'</span></label>'+pdel(cat.id, r)+'</li>').join("");
  if(!todo.length) h += '<li class="pall">🎉 No queda res pendent a '+esc(cat.label)+'.</li>';
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

/* ---- ordre (els NEW sempre a dalt) i secció «Nous» ---- */
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
  renderFilters();
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
  if(state.tip!=="all") actius.push(typeIco(state.tip)+" "+state.tip);
  if(state.loc!=="all") actius.push(state.loc);
  if(state.cat!=="all") actius.push(zoneOf({cat:state.cat}));
  if(state.q) actius.push("cerca «"+$("q").value.trim()+"»");
  $("reset").hidden = !actius.length;
  $("reset").textContent = actius.length ? "Filtre actiu: "+actius.join(" · ")+" — es veuen "+total+" de "+DATA.filter(live).length+". Treu els filtres" : "";
  /* inventari buit: avís per importar (només quan ja ha arribat del núvol) */
  const empty = !DATA.length;
  if(empty) $("none").hidden = true;
  $("emptyCloud").hidden = !(empty && cloudLoaded && cloudUser);
  if(empty) $("sub").textContent = cloudLoaded ? "Encara no hi ha cap article al núvol." : "Carregant l'inventari…";
  if(dashOpenF) dashSoon();
  lazyScan();
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
      + pend.filter(r=>!have[r.key]).map(r=>'<li class="cp"><label><input type="checkbox" data-cat="'+cat.id+'" data-k="'+r.key+'"><span>'+esc(r.name)+'</span></label><span class="ptag">Pendent</span>'+pdel(cat.id, r)+'</li>').join("")
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

function resetFilters(){
  state.q=""; state.cat="all"; state.loc="all"; state.review=false; state.tip="all";
  $("q").value=""; render();
}

let qt = null;
$("q").addEventListener("input", e => {
  clearTimeout(qt);
  qt = setTimeout(() => { const nq = norm(e.target.value.trim()); if(nq && !state.q){ state.cat="all"; state.loc="all"; state.review=false; } state.q = nq; render(); }, 120);
});
$("reset").onclick = resetFilters;

addEventListener("scroll", () => { $("totop").hidden = scrollY < 600; }, {passive:true});
$("totop").onclick = () => { scrollTo({top:0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); };
$("none").querySelector("button").onclick = resetFilters;
$("out").addEventListener("click", e => { const b = e.target.closest(".card-btn[data-i]"); if(b) openDlg(+b.dataset.i); });

/* ---- 🆕 NEW: quan caduca, es treu de dalt de tot ---- */
let lastNewCount = -1;
setInterval(() => {
  const n = DATA.filter(c => live(c) && isNew(c)).length;
  if(lastNewCount < 0){ lastNewCount = n; return; }
  if(n !== lastNewCount){ lastNewCount = n; render(); }
}, 60000);

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

/* ---------- botons de filtre: «Tot el món», «Totes» i «Revisar» ---------- */
const GLOBE_SVG = '<span class="globe" aria-hidden="true"><svg viewBox="0 0 34 34" fill="none" stroke="rgba(2,26,23,.55)" stroke-width="1.3"><path d="M2 12h30M1 17h32M2 22h30"/><g class="mer"><ellipse cx="17" cy="17" rx="6" ry="16"/><ellipse cx="17" cy="17" rx="12" ry="16"/><path d="M17 1v32"/><ellipse cx="51" cy="17" rx="6" ry="16"/><ellipse cx="-17" cy="17" rx="6" ry="16"/></g><path d="M8 9c3 1 4 4 2 6s1 4 4 4M22 6c-1 3 2 4 4 3M20 24c2-1 4 0 5 3" stroke="rgba(2,26,23,.85)" stroke-width="2.2" stroke-linecap="round"/></svg></span>';
let FB = null;
function buildFilters(){
  const box = $("chips"); box.innerHTML = "";
  const mk = (id, cls) => { const b = document.createElement("button"); b.type = "button"; b.id = id; b.className = "fbtn " + cls; box.appendChild(b); return b; };
  /* el tercer botó (petit) és el filtre de tipus d'article, amb dial. «Revisar» és ara a ⚙️ (configuració bàsica) */
  FB = {loc:mk("fLocBtn", "floc"), cat:mk("fCatBtn", "fcat"), tip:mk("fTipBtn", "frev ftip")};
  FB.loc.setAttribute("aria-haspopup", "true"); FB.cat.setAttribute("aria-haspopup", "true"); FB.tip.setAttribute("aria-haspopup", "true");
  bindDial(FB.loc, "loc"); bindDial(FB.cat, "cat"); bindDial(FB.tip, "tip");
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
  /* tipus d'article (botó petit) */
  const ta = state.tip === "all", nt = ta ? DATA.filter((c, i) => matches(c, i, "tip")).length : DATA.filter((c, i) => matches(c, i)).length;
  FB.tip.setAttribute("aria-pressed", String(!ta));
  FB.tip.innerHTML = '<span class="fic" aria-hidden="true">' + (ta ? "🏷️" : typeIco(state.tip)) + '</span><span class="fn">' + nt + '</span><small>' + esc(ta ? "Tipus" : state.tip) + '</small>';
  FB.tip.setAttribute("aria-label", ta ? "Tipus d'article. Toca o mantén premut per triar-ne un" : "Tipus: " + state.tip + ". Toca per treure el filtre");
  FB.tip.title = ta ? "Mantén premut per triar un tipus d'article" : "Toca per treure el filtre · mantén premut per canviar";
}
/* tipus que hi ha a l'inventari, amb quants articles en té cadascun (els més comuns primer) */
function typeCounts(filter){
  const m = new Map();
  DATA.forEach((c, i) => { if(!filter(c, i)) return; const t = typeOf(c) || "Sense tipus"; m.set(t, (m.get(t) || 0) + 1); });
  return [...m].sort((a, b) => (a[0] === "Sense tipus") - (b[0] === "Sense tipus") || b[1] - a[1] || a[0].localeCompare(b[0], "ca"));
}

/* ---------- dial radial: mantén premut i llisca el dit ---------- */
const DL = {open:false, kind:"", mode:"", items:[], els:[], pos:[], act:-1, S:46, ox:0, oy:0, cx:0, cy:0, R:0, inner:40, multi:false, moved:false, px:null, py:null, hubEl:null, ptrEl:null, btn:null, down:null, timer:0, moving:false};
function dialItems(kind){
  const TOT = totAll(), out = [];
  const tipOk = c => state.tip === "all" || (typeOf(c) || "Sense tipus") === state.tip;
  if(kind === "tip"){
    const all = new Map(typeCounts(live)), here = new Map(typeCounts((c, i) => matches(c, i, "tip")));
    out.push({id:"all", icon:"🏷️", label:"Tots els tipus", n:DATA.filter((c, i) => matches(c, i, "tip")).length, g:TOT, p:100, sel:state.tip === "all", all:true});
    [...all.keys()].forEach(t => { const g = all.get(t); out.push({id:t, icon:t === "Sense tipus" ? "❔" : typeIco(t), label:t, n:here.get(t) || 0, g, p:pctOf(g, TOT), sel:state.tip === t}); });
    return out;
  }
  if(kind === "loc"){
    const base = (c, i) => live(c) && tipOk(c) && (!state.review || needsReview(c)) && (state.cat === "all" || catsOf(c).includes(state.cat)) && (!state.q || qHit(i));
    out.push({id:"all", ik:"globe", label:"Tot el món", n:DATA.filter((c, i) => base(c, i)).length, g:TOT, p:100, sel:state.loc === "all", all:true});
    LOCS.forEach(l => { const g = totLoc(l); out.push({id:l, ik:locIconKey(l), label:l, n:DATA.filter((c, i) => base(c, i) && c.locs.includes(l)).length, g, p:pctOf(g, TOT), sel:state.loc === l, house:l === HOUSE}); });
  } else {
    const base = (c, i) => live(c) && tipOk(c) && (state.loc === "all" || c.locs.includes(state.loc)) && (!state.q || qHit(i));
    out.push({id:"all", icon:"📦", label:"Totes", n:DATA.filter((c, i) => base(c, i)).length, g:TOT, p:100, sel:state.cat === "all" && !state.review, all:true});
    CATS.forEach(z => { const g = totCat(z.id); out.push({id:z.id, icon:z.icon, label:z.label, n:DATA.filter((c, i) => base(c, i) && catsOf(c).includes(z.id)).length, g, p:pctOf(g, TOT), sel:!state.review && state.cat === z.id}); });
  }
  return out;
}
/* cercle COMPLET. Tots els botons es reparteixen per igual al voltant d'un cercle (el primer, a dalt, en sentit horari).
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
    h.innerHTML = '<div class="hi1">' + (DL.kind === "loc" ? locIconSvg("globe", 34) : DL.kind === "tip" ? "🏷️" : "📦") + '</div><b>' + (DL.mode === "sticky" || sticky ? "Toca una opció" : "Llisca i deixa anar") + '</b><small>' + (DL.kind === "loc" ? "Filtra per ubicació" : DL.kind === "tip" ? "Filtra per tipus" : "Filtra per zona") + '</small>';
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
  if(kind === "loc") state.loc = it.id; else if(kind === "tip") state.tip = it.id; else { state.cat = it.id; state.review = false; }
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
  const active = kind === "loc" ? state.loc !== "all" : kind === "tip" ? state.tip !== "all" : state.cat !== "all";
  if(active){ if(kind === "loc") state.loc = "all"; else if(kind === "tip") state.tip = "all"; else state.cat = "all"; render(); return; }
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

/* ---- icones minimalistes de les ubicacions (SVG de línia, agafen el color del tema) ---- */
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


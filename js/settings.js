/* Inventari de casa · settings.js
   Botó ⚙️: un toc obre la configuració bàsica; 3 tocs giren la moneda i el 4t obre la configuració avançada (vermella).
   Els ajustos es desen al núvol (meta/state · inv_cfg) i surten a ↶ Desfés. També: vista mòbil/PC, colors, icones de les ubicacions i instal·lar l'app. */

/* ---------- aplicar els ajustos ---------- */
function cfgCommit(fn){
  const cur = deep(cfgRaw()) || {};
  fn(cur);
  store("inv_cfg", cfgClean(cur));
  cfgApply();
  if($("cfdlg").open) cfgRender();
}
/* s'aplica cada vegada que canvien els ajustos (aquí o des de l'altre dispositiu) */
let cfgNewDays = null;
function cfgApply(){
  refreshLocs(); if(state.loc !== "all" && !LOCS.includes(state.loc)) state.loc = "all";
  HIST_MAX = cfgGet("histMax"); CHAT_MAX = cfgGet("chatMax");
  const hm = $("hMaxN"); if(hm) hm.textContent = HIST_MAX;
  const hd = $("hDaysN"); if(hd) hd.textContent = cfgGet("histDays") + (cfgGet("histDays") === 1 ? " dia" : " dies");
  document.documentElement.style.setProperty("--hold", cfgGet("hold") + "ms");
  document.documentElement.style.setProperty("--cols", cfgGet("cols"));
  document.documentElement.style.setProperty("--cardmin", cfgGet("cardmin") + "px");
  document.documentElement.style.setProperty("--lph", cfgGet("lph") + "px");
  document.documentElement.style.setProperty("--rad", cfgGet("rad") + "px");
  themeApply();
  /* si canvien els dies del cartell NEW, cal tornar a pintar les targetes */
  if(cfgNewDays !== null && cfgNewDays !== cfgGet("newDays")) scheduleRebuild();
  cfgNewDays = cfgGet("newDays");
  $("dashBtn").hidden = !cfgGet("dashOn");
  render();
  if(histLoaded) cloudHist(HIST);
  chatTrim();
  micApply();
  bkAutoCheck();
  if($("bkdlg").open) bkRender();
  if($("basdlg").open) basicRender();
}

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
/* un toc = configuració bàsica (s'espera un moment per si en fas 3) · 3 tocs = gira la moneda · 4t toc = configuració avançada (vermella) */
let cfgOpenT = 0;
$("cfgBtn").addEventListener("click", () => {
  if(cfgUnlocked){ clearTimeout(cfgLockT); clearTimeout(cfgOpenT); openCfg(); return; }
  const now = Date.now(), win = cfgGet("tap");
  cfgTaps.push(now);
  while(cfgTaps.length && now - cfgTaps[0] > win) cfgTaps.shift();
  clearTimeout(cfgOpenT);
  if(cfgTaps.length >= 3){ cfgTaps.length = 0; cfgSetLock(false); return; }
  cfgOpenT = setTimeout(() => { cfgTaps.length = 0; if(!cfgUnlocked) basicOpen(); }, cfgGet("aiwait"));
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
  h += row("Dies que es guarden els canvis de ↶ Desfés", "Entre 1 i 90 dies · per defecte " + CFGD.histDays + " · en caducar, també s'esborren les fotos dels articles eliminats (allibera espai)", 'data-t="histDays" min="1" max="90" step="1"', cfgGet("histDays"), "dies");
  h += row("Canvis que guarda ↶ Desfés (màxim)", "Entre 10 i 500 · per defecte " + CFGD.histMax, 'data-t="histMax" min="10" max="500" step="1"', cfgGet("histMax"), "canvis");
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
  h += '</div><div class="cfg"><h3>🎤 Assistents per veu</h3><p class="cfn">Com parles amb els dos assistents (el de productes i el d\'ordres). Entenen el català; si els parles en castellà et demanaran que els parlis en català. ' + (voiceInfo()) + '</p>';
  h += row("Text o veu", "0 = només escrivint · 1 = només amb la veu (micròfon i respostes dites en veu alta) · 2 = les dues coses · per defecte 2", 'data-t="aiMode" min="0" max="2" step="1"', cfgGet("aiMode"), "0–2");
  h += '<button type="button" class="wtest" id="vTest">🔊 Prova la veu</button>';
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
    + '<button type="button" class="wtest" id="cClean">🧹 Neteja les fotos sense ús</button>'
    + '<p class="cfn" style="margin-top:12px">Les fotos pujades abans de la v6.1 poden ocupar fins a 8 vegades més. Això les torna a desar a la mida nova (~100 KB), sense canviar-ne res més.</p>'
    + '<button type="button" class="wtest" id="cShrink">🗜️ Redueix les fotos grans</button>';
}

/* ---- 🎨 colors al panell d'ajustos ---- */
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


/* =====================================================================
   🖼️ Icones de les ubicacions (tria manual a la configuració avançada)
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

/* =====================================================================
   ⚙️ Configuració bàsica (un toc al botó d'ajustos)
   La configuració avançada (vermella) continua amagada: 3 tocs al botó fan girar la moneda i el 4t l'obre.
   ===================================================================== */
function basicOpen(){
  if(!cloudUser){ toast("Cal iniciar sessió."); return; }
  basicRender(); $("basdlg").showModal();
}
function basicRender(){
  const seg = (k, opts, cur) => '<div class="bseg" role="group">' + opts.map(([v, l]) => '<button type="button" data-k="' + k + '" data-v="' + v + '" aria-pressed="' + (String(v) === String(cur)) + '">' + l + '</button>').join("") + '</div>';
  const sec = (ico, title, note, body) => '<section class="bsec"><h3><span aria-hidden="true">' + ico + '</span>' + title + '</h3>' + (note ? '<p class="bnote">' + note + '</p>' : '') + body + '</section>';
  const nr = DATA.filter(c => live(c) && needsReview(c)).length;
  const th = themeVals();
  let h = "";
  h += sec("⚠️", "Revisar", nr ? nr + (nr === 1 ? " article té" : " articles tenen") + " alguna cosa per revisar (sense foto, quantitat per confirmar…)." : "Cap article per revisar. 👍",
    '<button type="button" class="bbig' + (state.review ? ' on' : '') + '" data-k="review"' + (nr || state.review ? '' : ' disabled') + '>' + (state.review ? "✕ Treu el filtre «Revisar»" : "🔎 Mostra només els " + nr + " per revisar") + '</button>');
  h += sec("👁️", "Vista", "Només en aquest dispositiu.", seg("view", [["grid", "▦ Imatges"], ["list", "☰ Llista"], ["check", "☑ Check"]], view));
  h += sec("↕️", "Ordre dels articles", "Els NEW sempre surten a dalt.", seg("cfg:sortMode", [[0, "Original"], [1, "Nom A→Z"], [2, "Més recents"]], cfgGet("sortMode")));
  h += sec("🔢", "Articles per fila (mòbil)", "", seg("cfg:cols", [[2, "2"], [3, "3"], [4, "4"], [5, "5"]], cfgGet("cols")));
  h += sec("🎨", "Color", "Per a tots dos.", '<div class="thpre">' + Object.keys(THEME_PRESETS).map(id => '<button type="button" class="thsw" data-k="theme" data-v="' + id + '" title="' + THEME_PRESETS[id].name + '" aria-label="Tema ' + THEME_PRESETS[id].name + '" aria-pressed="' + (th.accent === THEME_PRESETS[id].accent) + '" style="--sw:' + THEME_PRESETS[id].accent + '"></button>').join("") + '</div>');
  h += sec("🆕", "Cartell NEW als articles nous", "", seg("cfg:newDays", [[0, "No"], [3, "3 dies"], [7, "7 dies"], [14, "14 dies"]], cfgGet("newDays")));
  h += sec("↶", "Desfés guarda els canvis", "En caducar, s'esborren també les fotos dels articles eliminats.", seg("cfg:histDays", [[1, "1 dia"], [3, "3 dies"], [7, "7 dies"], [30, "30 dies"]], cfgGet("histDays")));
  h += sec("🎤", "Assistents", SR ? (caVoice ? "Escolten i responen en català." : "Escolten en català. Aquest dispositiu no té veu catalana: responen amb text.") : "Aquest navegador no pot escoltar: només text.",
    seg("cfg:aiMode", [[0, "⌨️ Text"], [1, "🎤 Veu"], [2, "Tots dos"]], cfgGet("aiMode")));
  h += sec("🎉", "Efectes i sons", "", '<div class="brow"><span>Confeti en crear articles</span>' + seg("cfg:fxOn", [[1, "Sí"], [0, "No"]], cfgGet("fxOn")) + '</div>'
    + '<div class="brow"><span>So dels missatges del xat</span>' + seg("cfg:chatVol", [[60, "Sí"], [0, "No"]], cfgGet("chatVol") > 0 ? 60 : 0) + '</div>'
    + '<div class="brow"><span>Veu de WALL-E</span>' + seg("cfg:wvol", [[60, "Sí"], [0, "No"]], cfgGet("wvol") > 0 ? 60 : 0) + '</div>');
  h += sec("🧰", "Més", "", '<div class="bacts">'
    + (isStandalone() ? '' : '<button type="button" class="bbig" data-k="install">📲 Instal·la l\'app</button>')
    + '<button type="button" class="bbig" data-k="dates">📅 Recupera les dates de les fotos</button>'
    + '<button type="button" class="bbig" data-k="backup">💾 Còpies de seguretat</button>'
    + '<button type="button" class="bbig" data-k="cloud">☁️ Núvol, exportar i sessió</button></div>');
  $("basSub").textContent = (cloudUser ? whoName(cloudUser.email) + " · " : "") + "v" + APP_VER;
  const st = $("basBody").scrollTop; $("basBody").innerHTML = h; $("basBody").scrollTop = st;
}
$("basClose").onclick = () => $("basdlg").close();
$("basBody").addEventListener("click", e => {
  const b = e.target.closest("[data-k]"); if(!b || b.disabled) return;
  const k = b.dataset.k, v = b.dataset.v;
  if(k === "review"){ state.review = !state.review; state.cat = "all"; $("basdlg").close(); render(); scrollTo({top:0, behavior:"auto"}); return; }
  if(k === "view"){ setView(v); }
  else if(k.startsWith("cfg:")){ const n = k.slice(4), val = +v; if(cfgGet(n) !== val) cfgCommit(c => { c[n] = val; }); }
  else if(k === "theme"){ const p = THEME_PRESETS[v]; const err = p && themeCommit({accent:p.accent, bg:p.bg}); if(err) toast("⚠️ " + err); }
  else if(k === "install"){ $("basdlg").close(); $("instBtn").click(); return; }
  else if(k === "dates"){ $("basdlg").close(); datOpen(); return; }
  else if(k === "backup"){ $("basdlg").close(); bkRender(); bkLock(); $("bkdlg").showModal(); return; }
  else if(k === "cloud"){ $("basdlg").close(); cloudMenuOpen(); return; }
  basicRender();
});

/* ---------- 📲 instal·lar l'inventari com una app (el botó només surt si encara no ho està) ---------- */
let instEvt = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function instUpd(){ $("instBtn").hidden = isStandalone(); }
addEventListener("beforeinstallprompt", e => { e.preventDefault(); instEvt = e; instUpd(); });
addEventListener("appinstalled", () => { instEvt = null; instUpd(); toast("✓ Inventari instal·lat. Ja el tens a la pantalla d'inici."); });
$("instBtn").onclick = async () => {
  if(instEvt){ instEvt.prompt(); try { await instEvt.userChoice; } catch(_){} instEvt = null; instUpd(); return; }
  if(isIOS) toast("📲 A l'iPhone: obre-la amb Safari, toca Compartir ⬆️ i després «Afegeix a la pantalla d'inici».");
  else toast("📲 Obre el menú del navegador (⋮) i tria «Instal·la l'aplicació» o «Afegeix a la pantalla d'inici».");
};


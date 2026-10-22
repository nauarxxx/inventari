/* Inventari de casa · assistants.js
   Els dos assistents del robot (botó de baix a la dreta):
   - un toc: assistent de productes (respon preguntes sobre l'inventari, sense internet ni claus)
   - 3 tocs giren el robot i el 4t obre l'assistent d'ordres (canvia ajustos i articles, sempre amb confirmació)
   Tots dos entenen la veu en català (micròfon 🎤) i poden respondre en veu alta. */

/* =====================================================================
   🤖 Assistent de productes
   ===================================================================== */
const AI_STOP = new Set("a al als amb de del dels d el els la les l lo los las en i o on es esta estan hi ha han tinc tenim tens quant quants quanta quantes que quin quina quins quines un una uns unes per pel com hem meu meva mi mis sobre donde tengo cuantos cuantas y".split(" "));
const aiWords = t => norm(t).replace(/[^a-z0-9ñç ]/g," ").split(/\s+/).filter(w=>w.length>1 && !AI_STOP.has(w));
const aiStem = w => w.length>4 ? w.replace(/(es|s)$/,"") : w;
function aiMsg(kind, text){
  const d = document.createElement("div"); d.className = "aimsg " + kind; d.textContent = text;
  $("aiMsgs").appendChild(d); $("aiMsgs").scrollTop = $("aiMsgs").scrollHeight;
  if(kind === "bot" && (voiceTurn.ai || aiModeV() === 1)) say(text);
  return d;
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
/* byVoice = la pregunta s'ha dit amb el micròfon (llavors la resposta també es diu en veu alta) */
function aiAsk(text, byVoice){
  voiceTurn.ai = !!byVoice;
  aiMsg("me", text);
  if(isSpanish(text)){ aiMsg("bot", ES_REPLY); return; }
  const t = norm(text), words = aiWords(text);
  const zone = CATS.find(c => t.includes(norm(c.label)) || t.includes(norm(c.short)));
  const loc = LOCS.find(l => t.includes(norm(l)));
  const inScope = c => (!zone || catsOf(c).includes(zone.id)) && (!loc || locsOf(c).includes(loc));
  const all = DATA.map((c,i)=>i).filter(i=>live(DATA[i]) && inScope(DATA[i]));
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
  if(!open){ walleStop(); micStop(); sayStop(); }
  $("aiPanel").hidden = !open; $("aiFab").setAttribute("aria-expanded", String(open));
  if(!open) return;
  if(!$("aiMsgs").children.length){
    const d = aiMsg("bot", "Hola! Pregunta'm on és una cosa, quantes en tens, què falta o què cal revisar.");
    aiSuggest(d, ["On és la raclette?", "Què falta a la cuina?", "Què cal revisar?", "Quants articles tinc?"]);
  }
  clearTimeout(aiFocusT); aiFocusT = setTimeout(() => { if(!$("aiPanel").hidden) $("aiIn").focus(); }, isTouch ? 450 : 0);
}
let aiFocusT = 0;
$("aiClose").onclick = () => aiOpen(false);
$("aiPanel").addEventListener("keydown", e => { if(e.key === "Escape"){ e.stopPropagation(); aiOpen(false); $("aiFab").focus(); } });
$("aiIn").addEventListener("keydown", e => { if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); $("aiForm").requestSubmit(); } });
$("aiForm").onsubmit = e => { e.preventDefault(); const q = $("aiIn").value.trim(); if(!q) return; $("aiIn").value = ""; aiAsk(q); };

/* Assistent: un clic fora del panell el tanca (i no activa el que hi ha a sota) */
document.addEventListener("click", e => {
  if($("aiPanel").hidden) return;
  if(e.target.closest("#aiPanel, #aiFab, #createFab, dialog, #dlg, #lbx")) return;
  e.preventDefault(); e.stopPropagation();
  if(dblOut($("aiPanel"))) aiOpen(false);
}, true);

/* =====================================================================
   🔴 Assistent d'ordres
   ===================================================================== */
let adminOn = false;
$("rClose").onclick = () => adminClose();
$("rPanel").addEventListener("keydown", e => { if(e.key === "Escape"){ e.stopPropagation(); adminClose(); } });
$("rIn").addEventListener("keydown", e => { if(e.key === "Enter" && !e.shiftKey){ e.preventDefault(); $("rForm").requestSubmit(); } });
$("rForm").onsubmit = e => { e.preventDefault(); const q = $("rIn").value.trim(); if(!q) return; $("rIn").value = ""; rAsk(q); };

function rMsg(kind, text){
  const d = document.createElement("div"); d.className = "aimsg " + kind; d.textContent = text;
  $("rMsgs").appendChild(d); $("rMsgs").scrollTop = $("rMsgs").scrollHeight;
  if(kind === "bot" && (voiceTurn.r || aiModeV() === 1)) say(text);
  return d;
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
  rMsg("bot", "Puc fer això (sempre et demano confirmació):\n\n⚙️ AJUSTOS\n• resum de l'inventari (% per ubicació i zona)\n• mantenir premut a 1,5 segons\n• doble toc a 0,8 · triple toc a 1\n• historial a 50 · xat a 200 missatges\n• volum de WALL-E a 30 (0 = silenci)\n• avisos a 6 segons · moneda a 4 segons\n• targetes a 250 (mida a PC) · nous durant 7 dies\n• volum del xat a 40\n• vista llista (en aquest dispositiu)\n• ordena per nom · ordena per recents · ordre original\n• cantonades a 20 · foto de la llista a 90\n• vibració activada · barra de cerca desactivada\n\n🎨 COLORS\n• posa el color principal a blau\n• color del fons blau fosc · color del text #ffeecc\n• color del cartell NEW taronja\n• tema verd (rosa, lila, groc, taronja, gris…)\n• restaura els colors\n\n• columnes a 2 (articles per fila)\n• còpies a 10 · còpia automàtica cada 7 dies\n• fes una còpia de seguretat\n• quines còpies hi ha?\n• restaura els ajustos\n• quins són els ajustos?\n\n🎉 CONFETI I NAU&NOA HOUSE\n• prova el confeti · prova la celebració de la casa\n• confeti a 300 · durada del confeti a 5 segons\n• desactiva el confeti · colors del confeti a 2\n• confeti de la casa a 600 · cintes de la casa a 50\n• durada de la celebració de la casa a 9 segons\n• volum del confeti a 40\n\n🎛️ FILTRES I DIAL\n• icona de Cunit a platja · icona de Garatge iaios automàtica\n• quines icones hi ha?\n• filtra per Cunit · mostra la zona Cuina · treu els filtres\n• temps del dial a 0,5 segons · ampliació del dial a 200\n• radi del dial a 160 · mida del dial a 50\n\n📊 DASHBOARD\n• obre el dashboard · tanca el dashboard\n• dies del dashboard a 30 · top del dashboard a 8\n\n📦 ARTICLES\n• posa la quantitat de la raclette a 3\n• posa 3 a la raclette\n• mou la raclette a Cunit\n• afegeix la raclette també a Garatge iaios\n• posa la raclette a la zona Cuina\n• canvia el nom de raclette a Raclette Klarstein\n• elimina la raclette\n• crea l'article Gots x6 a Cunit zona Cuina (si no dius la zona, la trio jo 🪄)\n• crea la zona Terrassa\n• crea la ubicació Pis\n\nTot el que canvio queda a ↶ Desfés (amb 🤖).");
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
  else if(/historial|desfes/.test(nt) && /\bdies?\b/.test(nt)){ k = "histDays"; name = "els dies que es guarden els canvis de Desfés"; }
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

/* byVoice = l'ordre s'ha dit amb el micròfon */
function rAsk(text, byVoice){
  voiceTurn.r = !!byVoice;
  rMsg("me", text);
  /* «sí» / «no» responen la darrera pregunta de confirmació que encara està oberta */
  const box = [...$("rMsgs").querySelectorAll(".rconf")].pop(), open = box && !box.querySelector("button").disabled;
  const yn = norm(text).replace(/[^a-z' ]/g, " ").trim();
  if(open && /^(si|confirma|confirmo|d'acord|dacord|endavant|fes-ho|fes ho|vale|ok|correcte)\b/.test(yn)){ box.querySelector(".rok").click(); return; }
  if(open && /^(no|cancel|cancela|deixa-ho|deixa ho|para)\b/.test(yn)){ box.querySelector(".rno").click(); return; }
  if(isSpanish(text)){ rMsg("bot", ES_REPLY); return; }
  const t0 = text.trim(), n0 = norm(t0).replace(/['’`´]/g, " "), nt = rNorm(t0);
  if(/^(?:hola|bon dia|bones|ei|hey|salut)\b/.test(nt) && nt.split(" ").length < 4){ rMsg("bot", "Hola! Digues-me què vols canviar. Si t'ho vols mirar, escriu «què puc fer?»."); return; }
  const H = [rHelp, rShow, rFx, rIcon, rStats, rFilter, rTheme, rSort, rReset, rGoal, rBackup, rTimes, rView, rCreate, rDelete, rRename, rQty, rPlace];
  for(const h of H){ if(h(nt, t0, n0) !== false) return; }
  const d = rMsg("bot", "No t'he entès 🤔 Prova amb una ordre com les d'aquests exemples:");
  rSuggest(d, ["Què puc fer?", "Resum de l'inventari", "Quins són els ajustos?"]);
}

/* ---- el robot: un toc = assistent de productes · 3 tocs el giren · el 4t obre l'assistent d'ordres (si no, torna sol) ---- */
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
  aiDisarm(); micStop(); sayStop();
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


const TOG5 = ["fxOn", "houseOn", "houseBan", "houseShow", "dialTap", "dialVib", "dashOn", "dashAnim"];

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
  /* també per tipus d'article («filtra per alcohol») */
  const ft = rFind(t0, typeCounts(live).map(([t]) => ({id:t, label:t, n:norm(t)})));
  if(!fl && !fz && !ft) return false;
  resetFilters();
  if(fl) state.loc = fl.x.id;
  if(fz) state.cat = fz.x.id;
  if(ft) state.tip = ft.x.id;
  render(); scrollTo({top:0, behavior:"auto"});
  rMsg("bot", "✓ Filtre aplicat: " + [fl ? "📍 " + fl.x.label : "", fz ? "🏠 " + fz.x.label : "", ft ? typeIco(ft.x.id) + " " + ft.x.label : ""].filter(Boolean).join(" · ") + ".");
  return true;
}


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
   🎤 Veu, en català (tots dos assistents)
   - Escolta amb el reconeixement de veu del navegador (Chrome/Android i Safari/iPhone) en català (ca-ES).
   - Respon en veu alta si el dispositiu té una veu catalana; si no, només amb text.
   - Si li parles (o escrius) en castellà, et contesta «A mi parla'm en català».
   - Ajust «aiMode»: 0 = només text · 1 = només veu · 2 = les dues coses.
   ===================================================================== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const TTS = "speechSynthesis" in window;
const aiModeV = () => cfgGet("aiMode");
let recog = null, recFor = "", caVoice = null;
const voiceTurn = {ai:false, r:false};
function voicePick(){ try { const vs = speechSynthesis.getVoices(); caVoice = vs.find(v => /^ca([-_]|$)/i.test(v.lang)) || null; } catch(e){ caVoice = null; } }
if(TTS){ voicePick(); try { speechSynthesis.addEventListener("voiceschanged", voicePick); } catch(e){} }
function voiceInfo(){
  return (SR ? "🎤 Aquest navegador pot escoltar. " : "⚠️ Aquest navegador no pot escoltar (prova amb Chrome o Safari). ")
    + (caVoice ? "🔊 Té veu catalana per respondre." : "🔇 No té cap veu catalana instal·lada: les respostes seran només text (a Android: Ajustos → Text a veu → instal·la el català).");
}
/* diu el text en veu alta, només si hi ha veu catalana i l'ajust ho permet */
function say(text){
  if(!TTS || aiModeV() === 0 || !caVoice) return false;
  const t = String(text).replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, "").replace(/[•·→]/g, ",").replace(/\n+/g, ". ").replace(/\s+/g, " ").trim();
  if(!t) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t.length > 420 ? t.slice(0, t.lastIndexOf(" ", 420)) + "…" : t);
    u.voice = caVoice; u.lang = caVoice.lang; u.rate = 1.03;
    speechSynthesis.speak(u); return true;
  } catch(e){ return false; }
}
function sayStop(){ if(TTS) try { speechSynthesis.cancel(); } catch(_){} }
/* ---- castellà o català? es compten paraules que només són d'una de les dues llengües ---- */
const ES_ONLY = new Set("donde cuantos cuantas cuanto tengo tenemos tienes hay quiero puedes dime pon pones anade borra quita mueve cocina bano habitacion salon los las con por favor gracias buenos buenas ahora tambien muy esto eso cual como cuando nuevo nueva articulo articulos cosas falta faltan necesito encuentra eres hazme".split(" "));
const CA_ONLY = new Set("on quants quantes tinc tenim tens hi vull pots digues posa afegeix treu mou cuina bany habitacio els les amb per gracies bon ara tambe molt aixo aquest aquesta quin quina com quan nou nova article articles coses necessito troba ets fes".split(" "));
function isSpanish(text){
  const ws = norm(text).replace(/[^a-zñ ]/g, " ").split(/\s+/).filter(Boolean);
  if(ws.length < 2) return false;
  let es = 0, ca = 0;
  ws.forEach(w => { if(ES_ONLY.has(w.replace(/ñ/g, "n")) && !CA_ONLY.has(w)) es++; else if(CA_ONLY.has(w) && !ES_ONLY.has(w)) ca++; });
  return es >= 2 ? es > ca : (es === 1 && ca === 0 && (/ñ/i.test(text) || /\b(hay|donde|tengo|cuantos|cuantas|quiero|los|las|con|muy|anade|necesito|ahora)\b/.test(norm(text))));
}
const ES_REPLY = "A mi parla'm en català, si us plau. 😉";
/* ---- micròfon ---- */
function micApply(){
  const m = aiModeV();
  document.querySelectorAll(".aimic").forEach(b => { b.hidden = !SR || m === 0; });
  [["aiIn", "aiSend"], ["rIn", "rSend"]].forEach(([i, s]) => {
    const only = m === 1 && !!SR;
    $(i).readOnly = only; $(i).placeholder = only ? "Toca el micròfon i parla…" : $(i).dataset.ph || $(i).placeholder;
    $(s).hidden = only;
  });
}
["aiIn", "rIn"].forEach(i => { $(i).dataset.ph = $(i).placeholder; });
function micStop(){
  if(recog){ const r = recog; recog = null; try { r.abort(); } catch(_){} }
  document.querySelectorAll(".aimic.on").forEach(b => b.classList.remove("on"));
}
function micStart(which){
  if(!SR){ toast("🎤 Aquest navegador no pot escoltar. Prova amb Chrome o Safari."); return; }
  if(recog){ const was = recFor; micStop(); if(was === which) return; }
  sayStop(); walleStop();
  const r = new SR(), inp = $(which === "ai" ? "aiIn" : "rIn"), btn = document.querySelector('.aimic[data-for="' + which + '"]');
  r.lang = "ca-ES"; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
  recog = r; recFor = which; btn.classList.add("on");
  let final = "";
  r.onresult = e => { let txt = ""; for(const res of e.results){ txt += res[0].transcript; if(res.isFinal) final = txt; } inp.value = txt; };
  r.onerror = e => {
    if(e.error === "not-allowed" || e.error === "service-not-allowed") toast("🎤 Cal donar permís al micròfon al navegador.");
    else if(e.error === "no-speech") toast("🎤 No t'he sentit. Toca el micròfon i torna-ho a provar.");
    else if(e.error === "network") toast("🎤 El reconeixement de veu necessita connexió a internet.");
    else if(e.error !== "aborted") toast("🎤 Error del micròfon (" + e.error + ").");
  };
  r.onend = () => {
    btn.classList.remove("on");
    if(recog !== r) return;
    recog = null;
    const q = (final || inp.value).trim(); inp.value = "";
    if(q) (which === "ai" ? aiAsk : rAsk)(q, true);
  };
  try { r.start(); } catch(e){ micStop(); toast("🎤 No s'ha pogut obrir el micròfon."); }
}
document.addEventListener("click", e => { const b = e.target.closest(".aimic"); if(b){ e.preventDefault(); micStart(b.dataset.for); } });

/* botó «Prova la veu» de la configuració avançada */
$("cfBody").addEventListener("click", e => {
  if(!e.target.closest("#vTest")) return;
  if(!caVoice){ toast("🔇 Aquest dispositiu no té cap veu catalana. Les respostes seran només text."); return; }
  const m = aiModeV(); if(m === 0){ toast("Ara els assistents estan en mode només text (0)."); return; }
  say("Hola! Sóc l'assistent de l'inventari. Pregunta'm on és una cosa.");
});


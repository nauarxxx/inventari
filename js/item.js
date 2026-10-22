/* Inventari de casa · item.js — fitxa de l'article, formulari, càmera, visor de fotos i finestres de crear */

function saveItem(i, patch){
  const prevLocs50 = locsOf(DATA[i]).slice();
  Object.assign(DATA[i], patch); if("cats" in patch && !patch.cats) delete DATA[i].cats; if("tipus" in patch && !patch.tipus) delete DATA[i].tipus; fixItem(DATA[i]); SEARCH[i] = searchText(DATA[i]);
  const ok = cloudSaveItem(DATA[i]);
  if(!ok) toast("No s'ha pogut desar la foto.");
  refreshLocs();
  /* torna a pintar la targeta, a la seva categoria */
  dropCards(i); placeCards(i);
  updateSub(); render();
  celebrateMove(DATA[i], prevLocs50);
}

/* ---- Formulari per crear un article des de Pendents ---- */
let formCtx = null, formPhoto = null, formPhotoDt = 0;
function fillFormSelects(catId){
  $("fLoc").innerHTML = LOCS.map(l=>'<option>'+esc(l)+'</option>').join("") + '<option value="__new">➕ Nova ubicació…</option>';
  $("fCat").innerHTML = CATS.map(c=>'<option value="'+c.id+'">'+c.icon+' '+esc(c.label)+'</option>').join("") + '<option value="__new">➕ Nova zona…</option>';
  $("fCat").value = catId;
  $("fNewLoc").hidden = true; $("fNewLoc").required = false;
  $("fNewCat").hidden = true; $("fCatName").required = false;
  $("fAuto").hidden = true;
  tipusFill(); $("fTipus").value = ""; $("fTipus").placeholder = "Es tria sol segons el nom";
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
  pkUpdate();
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
  $("fTipus").value = c.tipus || ""; tipusHint();
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

/* ---- foto adjunta o feta al moment ---- */
let formPhotoBase = '<span>Sense foto</span>';
function setFormPhoto(src){
  formPhoto = src || null;
  if(!formPhoto) formPhotoDt = 0;
  if(formPhoto) $("fPrev").innerHTML = '<img alt="Foto de l\'article" src="'+formPhoto+'">';
  $("fPhDel").hidden = !formPhoto;
}
async function takeFile(e){
  const file = e.target.files[0]; e.target.value = ""; if(!file) return;
  /* data de la foto (EXIF) abans de reduir-la, que és quan es perden les metadades. Si la fas amb la càmera ara, és avui */
  try { const dt = await exifDate(file); setFormPhoto(await resizePhoto(file)); formPhotoDt = dt || (e.target.id === "fCam" ? Date.now() : 0); }
  catch(err){ setFormPhoto(null); $("fPrev").innerHTML = '<span>No s\'ha pogut llegir la foto (format no compatible?)</span>'; }
}
$("fPhoto").onchange = takeFile;
$("fCam").onchange = takeFile;
$("fGalBtn").onclick = () => $("fPhoto").click();
$("fPhDel").onclick = () => { setFormPhoto(null); $("fPrev").innerHTML = formPhotoBase; };

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
$("camUse").onclick = () => { formPhotoDt = Date.now(); setFormPhoto(photoJpeg($("camShot"), $("camShot").width, $("camShot").height)); $("camdlg").close(); };
$("camCancel").onclick = () => $("camdlg").close();
$("camdlg").addEventListener("close", camStop);
$("fCat").onchange = () => { const nw = $("fCat").value === "__new"; $("fNewCat").hidden = !nw; $("fCatName").required = nw; if(nw) $("fCatName").focus(); };

$("fName").addEventListener("input", () => { const q = qtyFromName($("fName").value); if(q) $("fQty").value = q; });

function tipusFill(){ $("tipusList").innerHTML = [...new Set(TYPES.map(t => t[0]).concat(DATA.filter(c => live(c) && c.tipus).map(c => c.tipus)))].map(t => '<option value="' + esc(t) + '">').join(""); }
function tipusHint(){ const g = typeGuess($("fName").value) || typeGuess($("fDesc").value); $("fTipus").placeholder = g ? "Automàtic: " + typeIco(g) + " " + g : "Es tria sol segons el nom"; }
$("fName").addEventListener("input", () => { clearTimeout(tipusHint.t); tipusHint.t = setTimeout(tipusHint, 250); });
$("fDesc").addEventListener("input", () => { clearTimeout(tipusHint.t); tipusHint.t = setTimeout(tipusHint, 250); });
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
  /* zona i ubicació noves creades des del mateix formulari */
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
    patch.tipus = $("fTipus").value.trim().replace(/\s+/g, " ") || null;
    if(formPhotoDt && !c.dt) patch.dt = formPhotoDt;
    $("fdlg").close(); saveItem(i, patch); afterReview(); return;
  }
  const c = {item:name, cat:Z[0], desc:$("fDesc").value.trim(), qty: qty>0 ? qty : 1,
    estado: formPhoto ? "ok" : "sin", fiab:"alta", note: formCtx.free ? $("fNote").value.trim() : "Afegit des de Pendents", photos: formPhoto ? [formPhoto] : [],
    pend:0, inv:0, loc, locs:L, nou:true, pkey: formCtx.key || undefined};
  if(Z.length > 1) c.cats = Z;
  const tp = $("fTipus").value.trim().replace(/\s+/g, " "); if(tp) c.tipus = tp;
  if(formPhoto && formPhotoDt) c.dt = formPhotoDt;
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
  /* tipus d'article i data de creació (de la foto); si no se sap, el camp no surt */
  /* el tipus sempre es veu i es pot tocar per canviar-lo */
  const ty = typeOf(c);
  $("dTipus").innerHTML = (ty ? esc(typeIco(ty) + " " + ty) + (c.tipus ? "" : ' <small>auto</small>') : '❔ Sense tipus <small>posa-n\'hi un</small>') + ' <span aria-hidden="true">✎</span>';
  $("dTipus").classList.toggle("none", !ty);
  const dd = dateInfo(c);
  $("dDateT").textContent = dd ? dd.label : ""; $("dDate").textContent = dd ? dd.text : "";
  $("dDate").hidden = $("dDateT").hidden = !dd;
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
  fitCard();
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
  const i = cur, c = DATA[i], add = []; let dt = 0;
  for(const f of files){ try { const d = await exifDate(f); add.push(await resizePhoto(f)); if(d && (!dt || d < dt)) dt = d; } catch(err){} }
  if(!add.length){ toast("No s'ha pogut llegir cap foto (format no compatible?). Prova amb JPG o PNG."); return; }
  const first = c.photos.length;
  const patch = {photos: c.photos.concat(add), pend: 0};
  if(dt && !c.dt) patch.dt = dt;   /* la data de la foto més antiga, si l'article encara no en té */
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
  fitCard();
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
$("dPhoto").addEventListener("load", fitCard, true);
let fitT = 0;
addEventListener("resize", () => { clearTimeout(fitT); fitT = setTimeout(() => { document.querySelectorAll("dialog[open]").forEach(fitModal); fitCard(); }, 80); });


/* ---- Eliminar un article des de la fitxa ---- */

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

/* ---- tancar tocant fora requereix dos tocs seguits ---- */

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
/* ---- visor de fotos (es tanca clicant fora de la foto) ---- */
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

/* ---- mantenir premut un article 1 s (Imatges, Llista i Check) mostra la foto mentre es manté ---- */

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

/* ---- qualsevol popup es tanca clicant fora (al fons on es veu la web) ---- */
document.querySelectorAll("dialog").forEach(d => {
  let downOn = null;
  d.addEventListener("pointerdown", e => { downOn = e.target; });
  d.addEventListener("click", e => { if(e.target === d && downOn === d && d.open && dblOut(d)) d.close(); downOn = null; });
});

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


$("dNew").onclick = () => {
  const c = DATA[cur]; if(!c) return;
  saveItem(cur, {nouVist:true}); afterReview();
  toast("«" + c.item + "» ja no té el cartell NEW.");
};


/* =====================================================================
   Formulari d'article ajustat a la pantalla (sense scroll, també a l'iPhone)
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
$("mpNone").onclick = () => { $("mpBody").querySelectorAll("input:checked").forEach(i => { i.checked = false; }); pkUpdate(); $("mpdlg").close(); };
$("mpdlg").addEventListener("close", mpBack);
["fLocs2", "fCats2"].forEach(id => $(id).addEventListener("change", pkUpdate));


/* =====================================================================
   🏷️ canviar el tipus des de la fitxa (toca el tipus)
   Truc per posar tipus ràpid: filtra per «❔ Sense tipus», obre el primer article, tria'n el tipus i passarà sol al següent.
   ===================================================================== */
let tpId = null;
function tpOpen(){
  const c = DATA[cur]; if(!c) return;
  tpId = c.id;
  const auto = typeGuess(c.item) || typeGuess(c.desc || ""), curT = c.tipus || "";
  const names = [...new Set(TYPES.map(t => t[0]).concat(DATA.filter(x => live(x) && x.tipus).map(x => x.tipus)))].sort((a, b) => a.localeCompare(b, "ca"));
  $("tpName").textContent = c.item;
  $("tpList").innerHTML = '<button type="button" class="tpi' + (!curT ? ' on' : '') + '" data-t="">✨ Automàtic' + (auto ? ': ' + esc(typeIco(auto) + " " + auto) : ' (no en sé cap)') + '</button>'
    + names.map(t => '<button type="button" class="tpi' + (curT === t ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(typeIco(t) + " " + t) + '</button>').join("");
  $("tpNew").value = "";
  $("tpdlg").showModal();
}
function tpSave(t){
  const i = DATA.findIndex(x => x.id === tpId && live(x)); $("tpdlg").close();
  if(i < 0){ toast("Aquest article ja no existeix."); return; }
  const c = DATA[i];
  if((c.tipus || "") === t) return;
  saveItem(i, {tipus:t || null});
  toast(t ? typeIco(t) + " «" + c.item + "» ara és " + t + "." : "«" + c.item + "» torna al tipus automàtic.");
  if(order.includes(i)){ pos = order.indexOf(i); cur = i; idx = 0; showDlg(); }
  else afterReview();   /* p. ex. amb el filtre «Sense tipus»: passa al següent */
}
$("dTipus").onclick = tpOpen;
$("tpList").addEventListener("click", e => { const b = e.target.closest(".tpi"); if(b) tpSave(b.dataset.t); });
$("tpAdd").onclick = () => { const t = $("tpNew").value.trim().replace(/\s+/g, " "); if(!t){ $("tpNew").focus(); return; } tpSave(t.charAt(0).toUpperCase() + t.slice(1)); };
$("tpNew").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); $("tpAdd").click(); } });
$("tpCancel").onclick = () => $("tpdlg").close();


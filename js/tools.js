/* Inventari de casa · tools.js
   📅 Recupera dates des de les fotos originals de la galeria
   Les fotos de la web no tenen data (es van reduir sense metadades), però les originals del mòbil sí.
   Tries moltes fotos de la galeria; la web en llegeix la data i les compara visualment (empremta dHash de 64 bits)
   amb les fotos dels articles. No es puja cap foto: només es desa la data als articles que coincideixen.
   ===================================================================== */
/* Empremta de cada foto: forma (dHash de 16×16 = 256 bits) + colors (mitjana RGB en una graella de 6×6).
   Perquè es consideri la mateixa foto han de coincidir totes dues coses i les proporcions. */
const DAT_MAX = 36, DAT_COL = 14;
function imgHash(src){
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      try {
        const cv = document.createElement("canvas"); cv.width = 17; cv.height = 16;
        const x = cv.getContext("2d", {willReadFrequently:true}); x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, 17, 16);
        const p = x.getImageData(0, 0, 17, 16).data, g = [], h = new Uint8Array(256);
        for(let k = 0; k < 272; k++) g.push(p[k * 4] * .299 + p[k * 4 + 1] * .587 + p[k * 4 + 2] * .114);
        for(let y = 0; y < 16; y++) for(let c = 0; c < 16; c++) h[y * 16 + c] = g[y * 17 + c] > g[y * 17 + c + 1] ? 1 : 0;
        const cc = document.createElement("canvas"); cc.width = 6; cc.height = 6;
        const y2 = cc.getContext("2d", {willReadFrequently:true}); y2.imageSmoothingQuality = "high"; y2.drawImage(im, 0, 0, 6, 6);
        const col = Uint8Array.from(y2.getImageData(0, 0, 6, 6).data.filter((_, k) => k % 4 !== 3));
        res({h, col, ar:(im.naturalWidth || 1) / (im.naturalHeight || 1)});
      } catch(e){ res(null); }
    };
    im.onerror = () => res(null); im.src = src;
  });
}
const hamming = (a, b) => { let d = 0; for(let k = 0; k < a.length; k++) if(a[k] !== b[k]) d++; return d; };
const colDist = (a, b) => { let s = 0; for(let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]); return s / a.length; };
let DAT = null;   /* {arts:[{i, id, h, ar}], found:Map(id -> {dt, d}), seen, noDate} */
function datOpen(){
  if(!cloudUser){ toast("Cal iniciar sessió."); return; }
  DAT = null; datRender(); $("datdlg").showModal();
}
function datRender(prog){
  const none = DATA.filter(c => live(c) && c._ph && c._ph.length && !c.dt).length;
  let h = "";
  if(prog){ h = '<div class="datprog"><b>' + esc(prog.t) + '</b><span class="ibar"><i style="width:' + Math.round(prog.p * 100) + '%"></i></span></div>'; }
  else if(!DAT || !DAT.found){
    h = '<p class="bnote" style="font-size:14px">Tria les fotos <b>originals</b> de la galeria del mòbil (pots seleccionar-ne moltes de cop, per exemple tot un mes). La web les compara amb les fotos dels articles i, si coincideixen, hi posa la data en què es va fer la foto.</p>'
      + '<p class="bnote">🔒 No es puja cap foto: només es llegeix la data. Les fotos rebudes o enviades per WhatsApp no tenen data i no serviran.</p>'
      + '<p class="bnote"><b>' + none + '</b> articles amb foto encara no tenen la data de la foto.</p>'
      + '<button type="button" class="bbig on" id="datPick">🖼️ Tria fotos de la galeria</button>';
  } else {
    const L = [...DAT.found].map(([id, f]) => ({c:DATA.find(x => x.id === id), f})).filter(x => x.c && live(x.c)).sort((a, b) => a.f.s - b.f.s);
    h = '<p class="bnote" style="font-size:14px">He mirat <b>' + DAT.seen + '</b> fotos (' + DAT.noDate + ' sense data). ' + (L.length ? 'He trobat <b>' + L.length + '</b> articles. Revisa-ho i desa:' : 'No n\'he trobat cap que coincideixi.') + '</p>'
      + (L.length ? '<ul class="datlist">' + L.map(({c, f}) => '<li><label><input type="checkbox" data-id="' + esc(c.id) + '"' + (f.s <= 30 ? ' checked' : '') + '><span class="dth">' + (c.photos.length ? '<img alt="" src="' + thumbSrc(c) + '">' : '📦') + '</span><span class="dtx"><b>' + esc(c.item) + '</b><small>📅 ' + esc(fmtDate(f.dt)) + ' · ' + (f.s <= 15 ? 'mateixa foto' : f.s <= 30 ? 'molt semblant' : 'semblant: comprova-ho') + ' (' + f.sim + '%)' + '</small></span></label></li>').join("") + '</ul>'
        + '<button type="button" class="bbig on" id="datSave">💾 Desa les dates marcades</button>' : '')
      + '<button type="button" class="bbig" id="datPick">🖼️ Tria més fotos</button>';
  }
  $("datBody").innerHTML = h;
}
async function datRun(files){
  if(!DAT){
    DAT = {arts:[], found:new Map(), seen:0, noDate:0};
    const list = DATA.filter(c => live(c) && c._ph && c._ph.length && !c.dt);
    for(let k = 0; k < list.length; k++){
      const c = list[k];
      if(k % 5 === 0) datRender({t:"Preparant les fotos dels articles… " + (k + 1) + " / " + list.length, p:.3 * k / list.length});
      for(const pid of c._ph){
        const src = PHT.get(pid) || await fullPhoto(pid);
        const hs = src && await imgHash(src);
        if(hs) DAT.arts.push({id:c.id, h:hs.h, col:hs.col, ar:hs.ar});
      }
    }
  }
  for(let k = 0; k < files.length; k++){
    if(k % 2 === 0) datRender({t:"Comparant fotos de la galeria… " + (k + 1) + " / " + files.length, p:.3 + .7 * k / files.length});
    const f = files[k]; DAT.seen++;
    const dt = await exifDate(f);
    if(!dt){ DAT.noDate++; continue; }
    const url = URL.createObjectURL(f), hs = await imgHash(url); URL.revokeObjectURL(url);
    if(!hs) continue;
    /* puntuació: forma + colors; només compten les que passen tots dos llindars i tenen les mateixes proporcions */
    const cands = [];
    DAT.arts.forEach(a => {
      if(Math.abs(Math.log(a.ar / hs.ar)) > .06) return;
      const d = hamming(a.h, hs.h), cd = colDist(a.col, hs.col);
      if(d <= DAT_MAX && cd <= DAT_COL) cands.push({a, d, cd, s:d + cd * 3});
    });
    if(!cands.length) continue;
    cands.sort((p, q) => p.s - q.s);
    const best = cands[0], second = cands.find(x => x.a.id !== best.a.id);
    if(second && second.s - best.s < 8) continue;   /* s'assembla massa a dos articles: no se sap quin és */
    const sim = Math.max(0, Math.round(100 - best.s / 1.5));
    const old = DAT.found.get(best.a.id);
    if(!old || best.s < old.s || (best.s === old.s && dt < old.dt)) DAT.found.set(best.a.id, {dt, d:best.d, s:best.s, sim});
  }
  datRender();
}
$("datBody").addEventListener("click", e => {
  if(e.target.closest("#datPick")) $("datIn").click();
  else if(e.target.closest("#datSave")){
    const ids = [...$("datBody").querySelectorAll("input[data-id]:checked")].map(x => x.dataset.id);
    if(!ids.length){ toast("No n'has marcat cap."); return; }
    let n = 0;
    HTAG = "📅 ";
    try {
      ids.forEach(id => { const c = DATA.find(x => x.id === id && live(x)), f = DAT.found.get(id); if(!c || !f) return; c.dt = f.dt; if(cloudSaveItem(c)) n++; });
    } finally { HTAG = ""; }
    toast("📅 Data recuperada a " + n + (n === 1 ? " article." : " articles."));
    DAT = null; $("datdlg").close(); render();
  }
});
$("datIn").onchange = async e => {
  const files = [...e.target.files]; e.target.value = "";
  if(!files.length) return;
  try { await datRun(files); } catch(err){ console.error(err); toast("⚠️ No s'han pogut llegir les fotos."); datRender(); }
};
$("datClose").onclick = () => $("datdlg").close();

/* Inventari de casa · photos.js — fotos: miniatures, fotos completes sota demanda, reducció i data EXIF */

/* ---- fotos optimitzades ----
   Cada article guarda la miniatura de les seves fotos (camp tm = {idFoto: miniatura}, ~10 KB cadascuna).
   La llista només fa servir miniatures; la foto completa (col·lecció photos) es baixa quan obres la fitxa o el visor.
   A c.photos hi ha, per a cada foto, la millor URL que es té: completa > miniatura > marcador «carregant». */
const PHR = new Map();        /* URL (completa, miniatura o marcador) -> id de la foto */
const PHF = new Map();        /* id -> foto completa ja baixada */
const PHT = new Map();        /* id -> miniatura (data URL, la que es desa) */
const PHB = new Map();        /* id -> miniatura en blob: URL curta per pintar les targetes */
const THUMB_OF = new Map();   /* foto completa nova -> la seva miniatura (es fa en reduir-la) */
const PHF_MAX = 60;           /* fotos completes que es guarden a la memòria */
const THUMB_PX = 260, THUMB_Q = .55;   /* ~7 KB per miniatura */
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

/* es pot pujar QUALSEVOL foto (càmera del mòbil, galeria o captura de pantalla, PNG o JPG, de qualsevol mida).
   Es redueix sola, sense que calgui configurar res, perquè càpiga al núvol (Firestore: menys d'1 MB per document).
   Es prova la millor qualitat primer i es va baixant només si cal. */
/* fotes d'inventari, no de galeria: ~100 KB cadascuna (abans fins a 800 KB). Així hi caben milers al pla gratuït (1 GB). */
const PHOTO_MAX_CHARS = 140000;
const PHOTO_TIERS = [[1280, 1.3e6, .72], [1280, 1.3e6, .62], [1024, .8e6, .62], [900, .6e6, .58], [720, .4e6, .55], [560, .25e6, .5], [400, .14e6, .45]];
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
  /* miniatura per a la llista, feta ara que la imatge ja és a la memòria */
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

/* ---- 📅 data de creació: la data en què es va fer la foto (metadades EXIF del fitxer original) ---- */
async function exifDate(file){
  try {
    if(!file || !/jpe?g|heic|heif/i.test(file.type || file.name || "")) return 0;
    const v = new DataView(await file.slice(0, 262144).arrayBuffer());
    if(v.getUint16(0) !== 0xFFD8) return 0;
    let o = 2;
    while(o + 4 < v.byteLength){
      const m = v.getUint16(o), len = v.getUint16(o + 2);
      if(m === 0xFFE1 && o + 10 < v.byteLength && v.getUint32(o + 4) === 0x45786966) return tiffDate(v, o + 10);
      if((m & 0xFF00) !== 0xFF00 || m === 0xFFDA) break;
      o += 2 + len;
    }
  } catch(e){}
  return 0;
}
function tiffDate(v, t){
  const le = v.getUint16(t) === 0x4949, u16 = p => v.getUint16(p, le), u32 = p => v.getUint32(p, le);
  const ifd = p => { const n = u16(p), r = {}; for(let i = 0; i < n; i++){ const e = p + 2 + i * 12; r[u16(e)] = {cnt:u32(e + 4), val:e + 8}; } return r; };
  const str = en => { const off = en.cnt > 4 ? t + u32(en.val) : en.val; let s = ""; for(let i = 0; i < en.cnt - 1 && off + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(off + i)); return s; };
  const i0 = ifd(t + u32(t + 4));
  let d = null;
  if(i0[0x8769]){ const ex = ifd(t + u32(i0[0x8769].val)); d = ex[0x9003] || ex[0x9004]; }   /* DateTimeOriginal / DateTimeDigitized */
  if(!d) d = i0[0x0132];                                                                       /* DateTime */
  if(!d) return 0;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(str(d)); if(!m) return 0;
  const ts = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  return ts > 946684800000 && ts < Date.now() + 864e5 ? ts : 0;
}

/* ---- cada targeta visible sense miniatura en fa una ella mateixa (no depèn de la migració) ---- */
function phShow(id){
  const src = thumbSrc({_ph:[id], photos:[phUrl(id)]});
  document.querySelectorAll('img[data-ph="' + id + '"]').forEach(im => { im.src = src; im.removeAttribute("data-ph"); });
}
const lazyIO = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if(!e.isIntersecting) return;
  lazyIO.unobserve(e.target);
  const im = e.target.matches("img[data-ph]") ? e.target : e.target.querySelector("img[data-ph]");
  const id = im && im.dataset.ph; if(!id) return;
  if(PHT.has(id)){ phShow(id); return; }
  fullPhoto(id).then(full => full ? makeThumb(full) : "").then(t => { if(t){ phSetThumb(id, t); phShow(id); } }).catch(() => {});
}), {rootMargin:"400px 0px"}) : null;
function lazyScan(){
  if(!lazyIO) return;
  /* s'observa la targeta sencera: dins de content-visibility la imatge no té mida fins que es pinta */
  document.querySelectorAll("img[data-ph]:not([data-obs])").forEach(im => { im.dataset.obs = "1"; lazyIO.observe(im.closest("li.card") || im); });
}

/* miniatura per a l'exportació .html: la que ja té l'article o, si no, una de nova */
const thumbOf = (c, k) => { const id = c._ph && c._ph[k || 0]; return id && PHT.has(id) ? Promise.resolve(PHT.get(id)) : makeThumb(c.photos[k || 0]); };

async function shrinkPhoto(u){
  if(typeof u !== "string" || !u.startsWith("data:image")) return null;
  if(u.length <= PHOTO_MAX_CHARS) return u;
  return new Promise(res => { const im = new Image(); im.onload = () => { try { res(photoJpeg(im, im.naturalWidth || im.width, im.naturalHeight || im.height)); } catch(e){ res(null); } }; im.onerror = () => res(null); im.src = u; });
}


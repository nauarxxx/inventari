/* Inventari de casa · service worker (v6.0)
   - La web s'obre a l'instant i funciona sense connexió (les dades ja les guarda Firebase al dispositiu).
   - La pàgina es demana primer a internet (així sempre tens l'última versió) i, si no hi ha connexió, es fa servir la guardada.
   - CSS, JS i icones: es mostren els guardats i s'actualitzen en segon pla.
   - Firebase (gstatic, versió fixa) i les fonts: es guarden la primera vegada i ja no es tornen a baixar.
   - Firestore, l'inici de sessió i l'àudio no passen per aquí. */
const VER = "6.1";
const CACHE = "inv-" + VER;
const SHELL = ["./", "index.html", "style.css?v=" + VER, "app.js?v=" + VER, "cloud.js?v=" + VER, "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("inv-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (req, res) => { if(res && res.ok && (res.type === "basic" || res.type === "cors")){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; };

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  /* pàgina: primer internet (amb un límit de temps), després la guardada */
  if(req.mode === "navigate"){
    e.respondWith((async () => {
      const net = fetch(req).then(r => put("index.html", r));
      const timeout = new Promise(r => setTimeout(r, 3500));
      try { const r = await Promise.race([net, timeout]); if(r) return r; } catch(_){}
      const c = await caches.match("index.html");
      return c || net;
    })());
    return;
  }
  /* Firebase SDK i fonts: tenen la versió a l'adreça, no canvien mai */
  if(url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/") || url.hostname === "fonts.gstatic.com" || url.hostname === "fonts.googleapis.com"){
    e.respondWith(caches.match(req).then(c => c || fetch(req).then(r => put(req, r))));
    return;
  }
  if(url.origin !== location.origin || /\.mp3$/i.test(url.pathname)) return;
  /* fitxers de la web: el guardat a l'instant i s'actualitza en segon pla */
  e.respondWith(caches.match(req).then(c => {
    const net = fetch(req).then(r => put(req, r)).catch(() => c);
    return c || net;
  }));
});

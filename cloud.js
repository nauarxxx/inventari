/* Firebase (pla gratuït Spark) · projecte web-inventari
   v6.0: les fotos completes ja no s'escolten totes en temps real: es llegeixen d'una en una quan cal (getPhoto)
   i totes juntes només per fer còpies, exportar o netejar (allPhotos). La llista fa servir les miniatures dels articles. */
const B = "https://www.gstatic.com/firebasejs/12.19.0/";
const cfg = {
  apiKey: "AIzaSyDY_88gmy6W_IqkApk0uMs1Kgnb1chZzh4",
  authDomain: "web-inventari.firebaseapp.com",
  projectId: "web-inventari",
  storageBucket: "web-inventari.firebasestorage.app",
  messagingSenderId: "738769723363",
  appId: "1:738769723363:web:e91e050ac36a9031a78ad6"
};
try {
  const [{initializeApp}, A, F] = await Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js"), import(B + "firebase-firestore.js")]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  let db;
  try { db = F.initializeFirestore(app, {ignoreUndefinedProperties: true, localCache: F.persistentLocalCache({cacheSizeBytes: 262144000, tabManager: F.persistentMultipleTabManager()})}); }
  catch(e){ db = F.initializeFirestore(app, {ignoreUndefinedProperties: true}); }
  const ref = (c, id) => F.doc(db, c, id);
  window.cloud = {
    signIn(){ const p = new A.GoogleAuthProvider(); p.setCustomParameters({prompt: "select_account"}); return A.signInWithPopup(auth, p); },
    signOut(){ return A.signOut(auth); },
    newId(){ return F.doc(F.collection(db, "items")).id; },
    getBackup(bid){ return F.getDocs(F.query(F.collection(db, "bkdata"), F.where("b", "==", bid))).then(s => s.docs.map(d => ({id: d.id, data: d.data()}))); },
    /* una foto completa: primer la del dispositiu (instantània i sense connexió), si no, la del núvol */
    async getPhoto(id){
      try { const s = await F.getDocFromCache(ref("photos", id)); if(s.exists()) return s.data().d || null; } catch(e){}
      const s = await F.getDoc(ref("photos", id));
      return s.exists() ? (s.data().d || null) : null;
    },
    /* totes les fotos, directament del núvol (perquè la llista sigui completa) */
    async allPhotos(){
      const s = await F.getDocsFromServer(F.collection(db, "photos")), m = new Map();
      s.docs.forEach(d => { const v = d.data().d; if(v) m.set(d.id, v); });
      return m;
    },
    async batch(ops, onProg){
      if(window.cloudPend) window.cloudPend(1);
      try { return await this._batch(ops, onProg); } finally { if(window.cloudPend) window.cloudPend(-1); }
    },
    async _batch(ops, onProg){
      let b = F.writeBatch(db), n = 0, bytes = 0, done = 0;
      const flush = async () => { if(!n) return; const k = n; await b.commit(); done += k; if(onProg) onProg(done, ops.length); b = F.writeBatch(db); n = 0; bytes = 0; };
      for(const o of ops){
        const sz = o.t === "del" ? 80 : JSON.stringify(o.data).length + 200;
        if(n >= 400 || (n && bytes + sz > 5e6)) await flush();
        if(o.t === "del") b.delete(ref(o.col, o.id));
        else if(o.t === "upd") b.update(ref(o.col, o.id), o.data);   /* només si el document existeix */
        else if(o.fields) b.set(ref(o.col, o.id), o.data, {mergeFields: o.fields});
        else b.set(ref(o.col, o.id), o.data);
        n++; bytes += sz;
      }
      await flush();
    }
  };
  let unsubs = [];
  A.onAuthStateChanged(auth, u => {
    unsubs.forEach(f => f()); unsubs = [];
    cloudAuth(u ? {email: u.email, name: u.displayName} : null);
    if(!u || !cloudAllowed(u.email)) return;
    const err = e => cloudErr(e);
    unsubs.push(F.onSnapshot(ref("meta", "state"), s => cloudMeta(s.exists() ? s.data() : null), err));
    unsubs.push(F.onSnapshot(F.collection(db, "items"), {includeMetadataChanges: true},
      s => cloudItems(s.docs.map(d => ({id: d.id, data: d.data()})), {changed: s.docChanges().length > 0, pending: s.metadata.hasPendingWrites, cache: s.metadata.fromCache}), err));
    unsubs.push(F.onSnapshot(F.query(F.collection(db, "hist"), F.orderBy("ts", "desc")), s => cloudHist(s.docs.map(d => Object.assign({id: d.id}, d.data()))), err));
    unsubs.push(F.onSnapshot(F.query(F.collection(db, "chat"), F.orderBy("ts", "desc"), F.limit(1100)), {includeMetadataChanges: true},
      s => cloudChat(s.docs.map(d => Object.assign({id: d.id}, d.data(), {pending: d.metadata.hasPendingWrites}))), err));
    unsubs.push(F.onSnapshot(F.collection(db, "chatread"), s => cloudChatRead(s.docs.map(d => ({id: d.id, ts: d.data().ts}))), err));
    unsubs.push(F.onSnapshot(F.query(F.collection(db, "bkmeta"), F.orderBy("ts", "desc")), s => cloudBk(s.docs.map(d => Object.assign({id: d.id}, d.data()))), err));
  });
  cloudReady();
} catch(e){ cloudBootFail(e); }

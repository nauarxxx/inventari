/* Inventari de casa · main.js
   Arrencada: s'executa l'últim, quan tots els altres fitxers ja han definit les seves funcions.
   Després, cloud.js (Firebase) inicia la sessió i va cridant cloudAuth, cloudItems, cloudMeta…, que omplen la pantalla. */

/* ---- dreceres de l'app instal·lada (mantén premuda la icona): ?obre=nou ---- */
let openParam = new URLSearchParams(location.search).get("obre");
function openFromParam(){
  if(!openParam || !cloudUser || !cloudLoaded) return;
  const p = openParam; openParam = null;
  try { history.replaceState(null, "", location.pathname); } catch(_){}
  if(p === "nou") openNewArticle();
}

/* ---- primera pintada (buida fins que arriben les dades del núvol) ---- */
refreshLocs();
buildNewSection();
CATS.forEach(buildSection);
cfgApply();
setView(view);
updateSub();
vmApply();
instUpd();
pkUpdate();
chatBadge();
histDayTimer();
gate("wait", "Connectant…");
cloudSetStatus();
document.documentElement.classList.add("js");

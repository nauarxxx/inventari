/* Inventari de casa · data.js
   Model de dades: articles (DATA), zones (CATS), ubicacions (LOCS), pendents, filtres actius (state)
   i les funcions que endevinen la zona, el tipus i la data de cada article. */

/* ---------- articles ----------
   Cada article: {id, item, cat, cats?, loc, locs, qty, desc, note, photos, _ph, tipus?, dt?, ord, estado, fiab, pend, nouVist?, pkey?, by?}
   photos = URL de cada foto (completa, miniatura o marcador) · _ph = ids de les fotos a Firestore (mateix ordre) */
const DATA = [];
const SEARCH = [];   /* text de cerca de cada article (mateix índex que DATA) */
const live = c => !c.deleted;
const CATS = [
  {id:"cuina",label:"Cuina",short:"Cuina",icon:"🍳"},
  {id:"menjador",label:"Menjador",short:"Menjador",icon:"🍽️"},
  {id:"bany",label:"Bany",short:"Bany",icon:"🚽"},
  {id:"dormitori",label:"Dormitori",short:"Dormitori",icon:"🛏️"},
  {id:"office",label:"Office",short:"Office",icon:"💻"},
  {id:"eines",label:"Eines",short:"Eines",icon:"🧰"},
  {id:"electro",label:"Electrodomèstics",short:"Electro",icon:"🔌"},
  {id:"neteja",label:"Neteja",short:"Neteja",icon:"🧽"}
];
const PENDENTS = {"cuina": ["Paella gran", "Paella petita", "Olla gran", "Cassola", "Cassó per a llet o salses", "Colador / escorredor de pasta", "Ratllador", "Obrellaunes", "Llevataps", "Cullerot", "Varetes de batre", "Bàscula de cuina", "Gerra mesuradora", "Motlle per al forn", "Manyoples de forn", "Carmanyoles (tuppers)", "Escorreplats", "Plats plans i fondos (6 o més)", "Coberts de taula (6 o més)", "Gerra d'aigua", "Cubells de reciclatge"], "menjador": ["Taula de menjador", "Cadires", "Sofà", "Moble de TV", "Llum de peu o de sostre", "Catifa", "Cortines", "Coixins de sofà", "Manta de sofà", "Prestatgeria", "Rellotge de paret", "Quadres o decoració de paret"], "bany": ["Tovalloles de dutxa", "Tovalloles de mans", "Cortina o mampara de dutxa", "Penjador de tovalloles", "Portaraspalls de dents", "Mirall de bany", "Portarotlles de paper", "Bàscula de bany", "Termòmetre", "Gases i esparadrap", "Tisores d'ungles", "Organitzador de dutxa"], "dormitori": ["Llit i matalàs", "Protector de matalàs", "Coixins", "Jocs de llençols (2)", "Funda nòrdica i edredó", "Manta", "Tauletes de nit", "Llum de tauleta", "Cortines opaques", "Despertador", "Cistell de roba bruta", "Organitzadors d'armari"], "office": ["Taula d'escriptori", "Cadira d'oficina", "Llum d'escriptori", "Regleta amb interruptor", "Impressora", "Disc dur extern o USB", "Auriculars amb micròfon", "Webcam", "Cables HDMI / DisplayPort", "Paper DIN A4", "Grapadora", "Tisores", "Cinta adhesiva", "Notes adhesives", "Arxivadors i carpetes"], "eines": ["Martell", "Joc de tornavisos", "Alicates", "Clau anglesa", "Cinta mètrica", "Escala", "Tacs i cargols", "Brides", "Cinta americana", "Silicona i pistola", "Allargador elèctric", "Piles AA i AAA", "Bombetes de recanvi", "Detector de fum", "Extintor"], "electro": ["Nevera", "Rentadora", "Rentaplats", "Forn", "Microones", "Placa de cocció", "Campana extractora", "Torradora", "Bullidor d'aigua", "Planxa de roba", "Televisor", "Fregidora d'aire"], "neteja": ["Escombra i recollidor", "Pal de fregar i galleda", "Plomall per a la pols", "Guants de neteja", "Fregalls", "Estenedor de roba", "Pinces de roba", "Taula de planxar", "Desembussador", "Bosses d'escombraries", "Detergent de rentadora", "Rentavaixelles", "Lleixiu", "Netejador multiusos", "Netejavidres"]};
/* estat i fiabilitat (de les primeres versions): decideixen què surt a «Revisar» */
const ESTAT = {ok:"Verificat", conf:"Quantitat per confirmar", sin:"Sense foto"};
const FIAB = {alta:"Alta", mitjana:"Mitjana", baixa:"Baixa"};
const CORRECTE = {estado:"ok", fiab:"alta", pend:0};

/* ---------- ubicacions ---------- */
const HOUSE = "Nau&Noa House";
const HOUSE_ALIAS = ["nau&noa house", "nau & noa house", "nau noa house", "nau i noa house", "nau&noa", "nau i noa", "nau noa"];
const LOC_PRIORITY = ["Cunit", "Garatge iaios"];
let LOCS = [];
/* les ubicacions dels articles + les creades a mà; Nau&Noa House sempre al final */
function refreshLocs(){
  const set = new Set(DATA.filter(live).flatMap(c => c.locs).concat(userLocs));
  if(cfgGet("houseShow")) set.add(HOUSE);
  LOCS = [...set].sort((a,b)=>{
    if(a===HOUSE) return b===HOUSE ? 0 : 1;
    if(b===HOUSE) return -1;
    const ia=LOC_PRIORITY.indexOf(a), ib=LOC_PRIORITY.indexOf(b);
    return (ia<0?99:ia)-(ib<0?99:ib) || a.localeCompare(b);
  });
}
/* ---------- filtres actius i ordre dels articles visibles ---------- */
const state = {q:"", cat:"all", loc:"all", review:false, tip:"all"};
let order = [];   /* índexs de DATA que es veuen ara, en l'ordre de la pantalla (per passar de fitxa en fitxa) */

/* ---------- ajudes per article ----------
   Un article pot ser a diverses ubicacions (compta a totes) i a diverses zones (es pinta a totes; la principal és la primera) */
const zoneOf = c => (CATS.find(z => z.id === c.cat) || {label:""}).label;
const qtyBadge = q => typeof q === "number" ? "×" + q : String(q);
const needsReview = c => c.estado !== "ok" || c.pend > 0 || c.fiab !== "alta";
function reasons(c){
  const r = [];
  if(c.estado === "conf") r.push("La quantitat està per confirmar");
  if(!c.photos.length) r.push(c.pend > 0 ? "Falta tornar a enviar la foto" : "No té foto");
  else if(c.pend > 0) r.push("Falta tornar a enviar alguna foto");
  if(c.fiab !== "alta") r.push("Fiabilitat " + (FIAB[c.fiab] || c.fiab).toLowerCase() + " de la informació");
  return r;
}
/* NEW: els primers dies després de crear-lo (ord = moment de creació), fins que es treu a mà */
const NEWCAT = {id:"__new", label:"Nous", short:"Nous", icon:"🆕"};
const isNew = c => { const d = cfgGet("newDays"); return d > 0 && !c.nouVist && typeof c.ord === "number" && c.ord > 1e12 && c.ord > Date.now() - d * 864e5; };
/* el % és la part dels articles totals que hi ha en cada ubicació o zona */
const totAll = () => DATA.filter(live).length;
const totLoc = l => DATA.filter(c => live(c) && c.locs.includes(l)).length;
const totCat = id => DATA.filter(c => live(c) && catsOf(c).includes(id)).length;
const pctOf = (n, tot) => (!tot || !n) ? 0 : Math.max(1, Math.min(100, Math.round(n / tot * 100)));
const locsOf = c => (Array.isArray(c.locs) && c.locs.length ? c.locs : [c.loc]);
const catsOf = c => (Array.isArray(c.cats) && c.cats.length ? c.cats : [c.cat]);
const zonesOf = c => catsOf(c).map(id => (CATS.find(z=>z.id===id)||{}).label).filter(Boolean);
const zonesTxt = c => zonesOf(c).join(" · ");
const locsTxt = (c, sep) => locsOf(c).join(sep || " · ");
function fixItem(c){
  if(!c || typeof c !== "object") return c;
  c.item = String(c.item == null ? "" : c.item).trim() || "Sense nom";
  c.desc = c.desc == null ? "" : String(c.desc);
  c.note = c.note == null ? "" : String(c.note);
  c.photos = (Array.isArray(c.photos) ? c.photos : []).filter(p => typeof p === "string" && p);
  const uniq = a => [...new Set(a.map(x => String(x == null ? "" : x).trim()).filter(Boolean))];
  let L = uniq([c.loc].concat(Array.isArray(c.locs) ? c.locs : []));
  if(!L.length) L = ["Sense ubicació"];
  c.locs = L; c.loc = L[0];
  let Z = uniq([c.cat].concat(Array.isArray(c.cats) ? c.cats : []));
  if(!Z.length) Z = [CATS[0].id];
  c.cat = Z[0]; if(Z.length > 1) c.cats = Z; else delete c.cats;
  if(typeof c.qty === "string" && /^\s*\d+\s*$/.test(c.qty)) c.qty = parseInt(c.qty, 10);
  if(typeof c.qty === "number" && !(c.qty > 0)) c.qty = 1;
  if(c.qty == null || c.qty === "") c.qty = 1;
  if(!ESTAT[c.estado]) c.estado = c.photos.length ? "ok" : "sin";
  if(!FIAB[c.fiab]) c.fiab = "alta";
  c.pend = +c.pend || 0;
  return c;
}

const searchText = c => norm(c.item + " " + c.desc + " " + c.note + " " + locsOf(c).join(" ") + " " + zonesOf(c).join(" ") + " " + typeOf(c));
const qHit = i => qText(SEARCH[i]);

/* filtres: skip = el grup que no es mira (per comptar quants n'hi hauria a cada opció) */
const matches = (c,i,skip) => live(c)
  && (skip==="cat" || state.cat==="all" || catsOf(c).includes(state.cat))
  && (skip==="loc" || state.loc==="all" || c.locs.includes(state.loc))
  && (skip==="review" || !state.review || needsReview(c))
  && (skip==="tip" || state.tip==="all" || (typeOf(c) || "Sense tipus")===state.tip)
  && (!state.q || qHit(i));

/* ---------- dades compartides (arriben del núvol a cloudMeta) ----------
   have = pendents aconseguits · extra = pendents afegits a mà · tret = pendents suggerits que s'han tret */
const have = load("inv_tinc", {});
const extra = load("inv_pend_extra", {});
const tret = load("inv_pend_tret", {});
const userCats = load("inv_cats", []);
const userLocs = load("inv_locs", []);
const BASE_CATS = CATS.length;   /* les zones de sèrie; les creades a mà van darrere */
CATS.push(...userCats);

/* ---------- pendents: el que normalment cal a cada zona ----------
   Els de PEND_MORE s'afegeixen al final: així les marques que ja tinguis no es mouen. */
const PEND_MORE = {
  cuina:["Safata de forn", "Joc de ganivets de cuina", "Taula de tallar", "Obridor de llaunes", "Pelador de verdures", "Espremedor de cítrics", "Premsa d'alls", "Setrilleres d'oli i vinagre", "Bols per a amanides", "Gots (6 o més)", "Tasses (6 o més)", "Draps de cuina", "Cullera de fusta i pala", "Paper d'alumini i film transparent", "Cafetera", "Mortaret", "Salers i pebrers", "Colador fi"],
  menjador:["Tovalles", "Estovalles individuals", "Setrilles de taula", "Gerro amb flors", "Espelmes i portaespelmes", "Aparador o bufet", "Moble de rebedor", "Tamboret o puf", "Plaid", "Reposapeus", "Llum ambiental", "Mirall decoratiu", "Ventilador de sostre", "Safata decorativa"],
  bany:["Alfombreta de bany", "Paperera de bany", "Raspall de vàter", "Dispensador de sabó", "Prestatge de bany", "Assecador de cabells", "Maquineta d'afaitar", "Pinta o raspall de cabell", "Farmaciola", "Ambientador", "Cistell de roba bruta", "Got per als raspalls de dents", "Cotó i bastonets", "Crema hidratant"],
  dormitori:["Armari", "Calaixera", "Mirall de peu", "Penjadors", "Capçal de llit", "Llum de lectura", "Llençols de recanvi", "Edredó d'estiu", "Coixí cervical", "Catifa de llit", "Estors o persianes", "Ventilador", "Humidificador", "Calçador"],
  office:["Teclat", "Ratolí", "Monitor", "Alfombreta de ratolí", "Suport per al portàtil", "Hub USB", "Carregador de mòbil", "Cables USB-C", "Rotuladors i bolígrafs", "Calculadora", "Paperera d'oficina", "Altaveus", "Repetidor Wi-Fi", "Targeta SD o pendrive", "Ventilador USB", "Organitzador de cables", "Calendari o agenda"],
  eines:["Serra", "Tenalles", "Llimes", "Cúter", "Nivell", "Trepant amb broques", "Assortiment de cargols i volanderes", "Cola d'encolar", "Cinta d'embalar", "Guants de treball", "Ulleres de protecció", "Escala plegable", "Caixa d'eines", "Cinta de teflon", "Llanterna", "Corda", "Inflador", "Soldador d'estany"],
  electro:["Cafetera", "Batedora o minipimer", "Aspiradora", "Aspiradora de mà", "Ventilador", "Estufa o radiador", "Aire condicionat", "Assecador de cabells", "Olla a pressió", "Robot de cuina", "Termo elèctric", "Rentadora-assecadora", "Humidificador", "Depuradora d'aire", "Torradora de pa", "Escalfador d'aigua"],
  neteja:["Fregalls de cuina", "Draps de microfibra", "Raspall de fregar", "Mopa", "Bossa d'aspiradora (recanvi)", "Esponges", "Netejador de forns", "Desinfectant", "Suavitzant", "Pastilles de rentaplats", "Sabó de mans (recanvi)", "Guants de goma", "Cubell amb escorredor", "Ambientadors", "Esprai antical", "Paper de cuina"]
};
Object.keys(PEND_MORE).forEach(k => { PENDENTS[k] = (PENDENTS[k] || []).concat(PEND_MORE[k]); });
/* zones creades per tu: pendents segons el nom; si el nom no és conegut, una llista general */
const PEND_LABEL = {
  jocs:["Jocs de taula", "Baralla de cartes", "Daus", "Puzles", "Consola", "Comandaments extra", "Jocs de consola", "Pilota", "Escacs o dames", "Dòmino", "Cartes UNO", "Cartes de pòquer", "Joc de dards", "Cables i carregadors de la consola"],
  altres:["Caixes d'emmagatzematge", "Etiquetes i retolador", "Bosses de plàstic", "Corda i brides", "Farmaciola", "Mantes de recanvi", "Piles de recanvi", "Llanterna d'emergència", "Documents i garanties", "Claus de recanvi", "Maleta de viatge", "Paraigua", "Detector de monòxid", "Extintor"],
  terrassa:["Taula exterior", "Cadires exteriors", "Para-sol", "Coixins d'exterior", "Barbacoa", "Estenedor exterior", "Llums solars", "Testos i plantes", "Mànega", "Regadora", "Tauleta auxiliar", "Hamaca o gandula", "Cubell d'escombraries exterior", "Tendal"],
  garatge:["Prestatgeries metàl·liques", "Caixes de plàstic", "Bicicleta", "Inflador", "Eines de jardí", "Estris de neteja del cotxe", "Bidons", "Escala", "Penjadors de paret", "Aspiradora de taller", "Oli i líquids del cotxe", "Cables de pont"],
  jardi:["Tisores de podar", "Regadora", "Mànega", "Pala i rasclet", "Guants de jardiner", "Testos", "Terra i abonament", "Carretó", "Desbrossadora", "Aspersors", "Cubell de compost", "Estris de jardineria"],
  habitacio:["Llit i matalàs", "Armari", "Taula de nit", "Llum", "Cortines", "Catifa", "Escriptori", "Cadira", "Penjadors", "Mirall"]
};
const PEND_GENERIC = ["Prestatgeria", "Caixes d'emmagatzematge", "Llum", "Regleta d'endolls", "Cistells", "Penjadors", "Cubell d'escombraries", "Etiquetes i retolador", "Caixa de primers auxilis", "Mirall"];
function pendBase(catId){
  if(PENDENTS[catId]) return PENDENTS[catId];
  const z = CATS.find(c => c.id === catId), k = z ? norm(z.label).trim() : "";
  if(PEND_LABEL[k]) return PEND_LABEL[k];
  const hit = Object.keys(PEND_LABEL).find(x => k.startsWith(x));
  return hit ? PEND_LABEL[hit] : PEND_GENERIC;
}

/* pendents d'una zona: els suggerits que no s'han tret + els afegits a mà */
const pendRows = catId => pendBase(catId).map((p, k) => ({key:catId + ":" + k, name:p})).filter(r => !tret[r.key])
  .concat((extra[catId] || []).map(x => ({key:catId + ":x" + x.id, name:x.name, own:x.id})));

/* si el nom porta «x6», «x10»… és la quantitat */
const qtyFromName = n => { const m = /(?:^|\s)x\s?(\d+)\b/i.exec(n); return m ? +m[1] : null; };

/* ---------- 🪄 zona automàtica segons el nom ----------
   Aprèn dels articles que ja tens (on els has posat), dels pendents de cada zona i d'una llista de paraules habituals. */
const ZONE_WORDS = {
  cuina:"paella olla cassola casso ganivet tallar plat got tassa bol cullera forquilla coberts colador ratllador obrellaunes llevataps cullerot varetes gerra motlle manyopla carmanyola tupper escorreplats safata pelador espremedor premsa setrill drap alumini film cafetera mortaret saler pebrer copa ampolla tetera tapa pot sarten vaso taza plato cuchillo tenedor cuchara olla ensaladera",
  menjador:"taula cadira sofa moble televisio llum catifa cortina coixi manta prestatgeria rellotge quadre tovalles estovalles gerro espelma aparador puf plaid mirall decoracio sillon mesa silla",
  bany:"tovallola dutxa mampara raspall dents mirall vater termometre gases esparadrap ungles assecador cabells afaitar pinta farmaciola ambientador sabo xampu gel crema coto bastonets colonia perfum maquillatge toalla champu",
  dormitori:"llit matalas llencol nordica edredo coixi tauleta despertador armari calaixera penjador capcal pijama cama colchon sabana almohada",
  office:"escriptori monitor teclat ratoli impressora portatil ordinador usb hdmi cable auriculars webcam grapadora tisores boligraf llibreta carpeta arxivador calculadora router wifi carregador pendrive altaveu tablet movil",
  eines:"martell tornavis alicates clau anglesa metre escala tacs cargol brida cinta silicona allargador piles bombeta trepant broca serra llima cuter nivell taladro destornillador tenalles caixa eines llanterna corda soldador",
  electro:"nevera rentadora rentaplats forn microones placa campana torradora bullidor planxa televisor fregidora batedora minipimer aspiradora ventilador estufa radiador aire condicionat robot termo assecadora humidificador nespresso thermomix freidora lavadora",
  neteja:"escombra recollidor fregar galleda plomall guants fregall estenedor pinces desembussador escombraries detergent rentavaixelles lleixiu netejador netejavidres mopa esponja suavitzant baieta microfibra bossa escoba fregona lejia"
};
const zStem = w => w.length > 4 ? w.replace(/(es|s)$/, "") : w;
const zWords = t => loose(t).split(" ").filter(w => w.length > 2).map(zStem);
let ZIDX = null, ZIDX_N = -1;
function zoneIndex(){
  if(ZIDX && ZIDX_N === DATA.length + CATS.length * 1e6) return ZIDX;
  const idx = new Map();
  const add = (zid, text, w) => zWords(text).forEach(t => { let m = idx.get(t); if(!m){ m = new Map(); idx.set(t, m); } m.set(zid, (m.get(zid) || 0) + w); });
  CATS.forEach(z => {
    if(ZONE_WORDS[z.id]) add(z.id, ZONE_WORDS[z.id], 2);
    pendBase(z.id).forEach(p => add(z.id, p, 1.5));
    (extra[z.id] || []).forEach(x => add(z.id, x.name, 1.5));
    add(z.id, z.label, 2);
  });
  DATA.forEach(c => { if(live(c)) add(c.cat, c.item, 3); });
  ZIDX = idx; ZIDX_N = DATA.length + CATS.length * 1e6;
  return idx;
}
/* torna {z, why} amb la zona més probable, o null si no n'està prou segur */
function zoneGuess(name){
  const ws = zWords(name); if(!ws.length) return null;
  const idx = zoneIndex(), sc = new Map(), why = new Map();
  ws.forEach(t => {
    let m = idx.get(t), f = 1;
    if(!m && t.length >= 4){ for(const [k, v] of idx){ if(k.length >= 4 && (k.startsWith(t) || t.startsWith(k))){ m = v; f = .6; break; } } }
    if(!m) return;
    m.forEach((v, zid) => { sc.set(zid, (sc.get(zid) || 0) + v * f); if(!why.has(zid)) why.set(zid, t); });
  });
  const r = [...sc].filter(([zid]) => CATS.some(z => z.id === zid)).sort((a, b) => b[1] - a[1]);
  if(!r.length || r[0][1] < 1.5 || (r[1] && r[0][1] < r[1][1] * 1.3)) return null;
  return {z: CATS.find(z => z.id === r[0][0]), why: why.get(r[0][0])};
}
/* ---------- 🏷️ tipus d'article (Alcohol, Vaixella, Eines…) ----------
   Si no l'has triat a mà (camp tipus), es dedueix del nom i la informació: així funciona amb tots els articles, vells i nous.
   També aprèn dels tipus que poses a mà: els articles amb paraules semblants reben el mateix tipus. */
const TYPES = [
  ["Alcohol", "🍷", "vi vino vins cava xampany champagne cervesa cerveza birra rom ron rum vodka ginebra gin whisky whiskey licor licors tequila vermut vermouth sangria brandy conyac cognac orujo pacharan aperol campari bacardi havana barcelo legendario beefeater tanqueray hendricks smirnoff baileys jagermeister martini moet bumbu absolut ratafia mezcal sake sidra"],
  ["Begudes", "🥤", "aigua agua refresc refresco cocacola fanta suc zumo llet leche cafe infusio cacau batut"],
  ["Menjar", "🥫", "arros arroz pasta macarrons espaguetis oli aceite sucre azucar farina harina llauna conserva tonyina atun galetes galletas xocolata chocolate cereals especies vinagre salsa ketchup maionesa mel"],
  ["Vaixella", "🍽️", "plat plats plato got gots vaso tassa taza bol copa copes gerra safata xupito chupito vaixella vajilla tetera ampolla ampolles"],
  ["Coberts", "🍴", "cullera culleres cuchara forquilla tenedor ganivet ganivets cuchillo coberts cubiertos culleretes"],
  ["Estris de cuina", "🍳", "paella sarten olla cassola casso colador ratllador obrellaunes llevataps cullerot varetes motlle tupper carmanyola tallar pelador premsa espremedor escorreplats manyopla bascula pizza"],
  ["Electrodomèstic", "🔌", "nevera rentadora rentaplats forn microones placa campana torradora bullidor planxa fregidora batedora minipimer aspiradora ventilador estufa radiador cafetera nespresso thermomix raclette assecador assecadora humidificador"],
  ["Electrònica", "💻", "monitor teclat ratoli impressora portatil ordinador usb hdmi cable auriculars webcam router wifi carregador pendrive altaveu tablet mobil televisor consola comandament bateria"],
  ["Eines", "🧰", "martell tornavis tornavisos destornillador alicates anglesa trepant broca serra llima cuter nivell tenalles cargols tacs brida silicona llanterna escala soldador"],
  ["Neteja", "🧽", "escombra recollidor fregona mopa galleda fregall esponja esponges baieta detergent lleixiu lejia fregar netejador netejavidres suavitzant rentavaixelles drap draps microfibra escombraries"],
  ["Higiene", "🧴", "xampu champu gel sabo jabon crema raspall dents dentifric desodorant colonia perfum maquillatge afaitar maquineta coto bastonets tovalloletes"],
  ["Tèxtil de la llar", "🧺", "tovallola tovalloles toalla llencol llencols sabana nordica edredo manta coixi coixins almohada cortina cortines catifa alfombra tovalles estovalles funda"],
  ["Roba", "👕", "samarreta camiseta pantalo pantalon jersei jaqueta abric sabates zapatos mitjons calcetines gorra bufanda vestit faldilla"],
  ["Mobles", "🛋️", "taula mesa cadira cadires silla sofa armari calaixera prestatgeria llit cama moble tauleta escriptori tamboret puf"],
  ["Decoració", "🖼️", "quadre cuadro gerro jarron espelma vela mirall rellotge figura decoracio imans iman imant"],
  ["Il·luminació", "💡", "llum lampara bombeta bombilla led"],
  ["Papereria", "📎", "llibreta boligraf llapis retolador grapadora carpeta arxivador adhesiva calculadora"],
  ["Jocs i oci", "🎮", "joc jocs juego puzle baralla cartes daus pilota escacs domino lego peluix"],
  ["Festa", "🎉", "barret festa globus confeti disfressa guirnalda serpentina pinata"],
  ["Medicaments", "💊", "medicament ibuprofe paracetamol farmaciola termometre tiretes esparadrap gases pastilles xarop"],
  ["Esport", "⚽", "bicicleta bici raqueta peses manuella esterilla casc patins"],
  ["Jardí", "🌿", "planta regadora manguera manega podar adob gespa"],
  ["Organització", "🧷", "penjador penjadors perxa caixa caixes organitzador cistell capsa"]
];
const typeIco = t => { const x = TYPES.find(y => y[0] === t); return x ? x[1] : "🏷️"; };
let TIDX = null, TIDX_N = -1;
function typeIndex(){
  const sig = DATA.length + DATA.filter(c => c.tipus).length * 1e6;
  if(TIDX && TIDX_N === sig) return TIDX;
  const idx = new Map();
  const add = (t, text, w) => zWords(text).forEach(k => { let m = idx.get(k); if(!m){ m = new Map(); idx.set(k, m); } m.set(t, (m.get(t) || 0) + w); });
  /* les begudes alcohòliques i les marques pesen més; «joc» és una paraula massa general */
  TYPES.forEach(([t, , words]) => add(t, words, t === "Alcohol" ? 3.5 : t === "Jocs i oci" ? 1.5 : 2));
  DATA.forEach(c => { if(live(c) && c.tipus) add(c.tipus, c.item, 4); });
  TIDX = idx; TIDX_N = sig;
  return idx;
}
function typeGuess(text){
  const ws = zWords(text); if(!ws.length) return "";
  const idx = typeIndex(), sc = new Map();
  ws.forEach((t, n) => {
    let m = idx.get(t), f = n === 0 ? 1.2 : 1;   /* la primera paraula del nom pesa una mica més */
    if(!m && t.length >= 5){ for(const [k, v] of idx){ if(k.length >= 5 && (k.startsWith(t) || t.startsWith(k))){ m = v; f *= .6; break; } } }
    if(m) m.forEach((v, ty) => sc.set(ty, (sc.get(ty) || 0) + v * f));
  });
  const r = [...sc].sort((a, b) => b[1] - a[1]);
  return r.length && r[0][1] >= 1.5 && !(r[1] && r[0][1] < r[1][1] * 1.1) ? r[0][0] : "";
}
/* el tipus que es mostra: el triat a mà o el deduït del nom (si no, de la informació) */
const typeOf = c => c.tipus || typeGuess(c.item) || typeGuess(c.desc || "");

/* ---------- 📅 quina data es mostra a la fitxa ----------
   1) dt  = data de la foto original (exacta: metadades del fitxer, o recuperada de la galeria)
   2) ord = quan es va afegir a l'inventari (exacta, articles creats des de la v4.0)
   3) la resta es van registrar a les primeres versions de l'inventari: entre el 18 i el 21 d'octubre de 2026 (aproximada) */
function dateInfo(c){
  if(c.dt) return {label:"Data de creació", text:fmtDate(c.dt), exact:true};
  if(typeof c.ord === "number" && c.ord > 1e12) return {label:"Afegit a l'inventari", text:fmtDate(c.ord), exact:true};
  return {label:"Afegit a l'inventari", text:"entre el 18 i el 21 d'octubre de 2026 (aprox.)", exact:false};
}

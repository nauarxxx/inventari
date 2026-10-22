/* Inventari de casa · dashboard.js — estadístiques */

let dashOpenF = false, dashSoonT = 0;
const DSC = ["#4fe3d2", "#5ea0ff", "#ffd23f", "#ff6fb5", "#b388ff", "#ffa040", "#4ade80", "#ff6b6b", "#22d3ee", "#a3e635", "#f472b6", "#fb7185"];
const dsP = (n, t) => t ? Math.round(n / t * 100) : 0;
const dsU = c => typeof c.qty === "number" ? c.qty : 0;
const dsN = n => Number(n).toLocaleString("ca");
function dsRing(p, col, size){
  const r = 26, C = 2 * Math.PI * r, L = C * Math.max(0, Math.min(100, p)) / 100;
  return '<svg class="dsring" viewBox="0 0 64 64" width="' + (size || 60) + '" height="' + (size || 60) + '" aria-hidden="true"><circle cx="32" cy="32" r="' + r + '" class="rb"/><circle cx="32" cy="32" r="' + r + '" class="rf" style="--L:' + L.toFixed(1) + ';--C:' + C.toFixed(1) + ';stroke:' + col + '" transform="rotate(-90 32 32)"/></svg>';
}
function dsDonut(segs, center, sub){
  const r = 56, C = 2 * Math.PI * r, T = segs.reduce((s, x) => s + x.n, 0) || 1;
  let acc = 0, h = '<svg viewBox="0 0 160 160" class="dn" aria-hidden="true"><circle cx="80" cy="80" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="26" style="stroke-dasharray:none;opacity:.5"/><g transform="rotate(-90 80 80)">';
  segs.forEach(s => { if(!s.n) return; const L = Math.max(.5, C * s.n / T - 2); h += '<circle cx="80" cy="80" r="' + r + '" style="--L:' + L.toFixed(1) + ';--C:' + C.toFixed(1) + ';--Cm:' + (C - L).toFixed(1) + ';stroke:' + s.col + ';stroke-dashoffset:' + (-acc).toFixed(1) + '"/>'; acc += C * s.n / T; });
  return h + '</g><text x="80" y="82" class="ctr">' + center + '</text><text x="80" y="98" class="cts">' + sub + '</text></svg>';
}
function dashDaily(L, n){
  const days = [], today = new Date(); today.setHours(0, 0, 0, 0);
  for(let i = n - 1; i >= 0; i--){ const d = new Date(today); d.setDate(d.getDate() - i); days.push({t:d.getTime(), cr:0, ed:0, lab:d.getDate(), mo:d.getMonth()}); }
  const idx = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); const k = Math.round((d.getTime() - days[0].t) / 864e5); return k >= 0 && k < n ? k : -1; };
  L.forEach(c => { if(typeof c.ord === "number" && c.ord > 1e12){ const k = idx(c.ord); if(k >= 0) days[k].cr++; } });
  HIST.forEach(h => {
    if(h.of) return;
    const creation = (h.parts || []).length && h.parts.every(p => p.k === "item" && !p.before && p.after);
    if(creation) return;
    const k = idx(h.ts); if(k >= 0) days[k].ed++;
  });
  return days;
}
function dsBars(days){
  const W = 320, G = 3, n = days.length, bw = (W - G * (n - 1)) / n, mx = Math.max(1, ...days.map(d => d.cr + d.ed)), HH = 96, step = Math.ceil(n / 8);
  let s = '<svg class="dsact" viewBox="0 0 ' + W + ' 112" role="img" aria-label="Activitat per dies">';
  [.25, .5, .75, 1].forEach(f => { s += '<line x1="0" x2="' + W + '" y1="' + (HH - HH * f).toFixed(1) + '" y2="' + (HH - HH * f).toFixed(1) + '" stroke="var(--line)" stroke-width=".5" opacity=".6"/>'; });
  days.forEach((d, i) => {
    const x = i * (bw + G), hc = d.cr / mx * HH, he = d.ed / mx * HH;
    s += '<g><title>' + d.lab + '/' + (d.mo + 1) + ' · ' + d.cr + ' creats · ' + d.ed + ' canvis</title>';
    if(d.ed) s += '<rect class="dsb" x="' + x.toFixed(1) + '" y="' + (HH - hc - he).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + he.toFixed(1) + '" rx="2" fill="rgba(255,255,255,.38)" style="transition-delay:' + (i * 25) + 'ms"/>';
    if(d.cr) s += '<rect class="dsb" x="' + x.toFixed(1) + '" y="' + (HH - hc).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hc.toFixed(1) + '" rx="2" fill="var(--accent)" style="transition-delay:' + (i * 25) + 'ms"/>';
    if(!d.cr && !d.ed) s += '<rect x="' + x.toFixed(1) + '" y="' + (HH - 2) + '" width="' + bw.toFixed(1) + '" height="2" rx="1" fill="var(--line)"/>';
    if((n - 1 - i) % step === 0) s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="108">' + d.lab + '</text>';
    s += '</g>';
  });
  return s + '</svg>';
}
function dashUsers(L){
  const idWho = {};
  [...HIST].reverse().forEach(h => (h.parts || []).forEach(p => { if(p.k === "item" && !p.before && p.after && !idWho[p.id]) idWho[p.id] = h.who; }));
  const cr = {}; let unk = 0;
  L.forEach(c => { const w = String(c.by || idWho[c.id] || "").toLowerCase(); if(w) cr[w] = (cr[w] || 0) + 1; else unk++; });
  const list = ALLOWED.map(e => {
    const mine = HIST.filter(h => String(h.who).toLowerCase() === e.toLowerCase());
    const msgs = CHAT.filter(m => m.from === e.toLowerCase()).length;
    const last = Math.max(0, ...mine.map(h => h.ts || 0), ...CHAT.filter(m => m.from === e.toLowerCase()).map(m => m.ts));
    return {e, name:chatName(e), who:whoName(e), cr:cr[e.toLowerCase()] || 0, ch:mine.filter(h => !h.of).length, un:mine.filter(h => h.of).length, msgs, last};
  });
  return {list, unk};
}
function dashData(){
  const L = DATA.filter(live), tot = L.length, d = {L, tot}, now = Date.now();
  d.units = L.reduce((s, c) => s + dsU(c), 0);
  d.withPh = L.filter(c => c.photos.length).length; d.rev = L.filter(needsReview).length; d.newN = L.filter(isNew).length;
  d.wk = L.filter(c => typeof c.ord === "number" && c.ord > 1e12 && c.ord > now - 7 * 864e5).length;
  let pd = 0, pt = 0; CATS.forEach(z => { const r = pendRows(z.id); pt += r.length; pd += r.filter(x => have[x.key]).length; }); d.pd = pd; d.pt = pt;
  d.byLoc = LOCS.map(l => { const it = L.filter(c => c.locs.includes(l)), zs = {}; it.forEach(c => catsOf(c).forEach(z => { zs[z] = (zs[z] || 0) + 1; })); return {id:l, n:it.length, units:it.reduce((s, c) => s + dsU(c), 0), ph:it.filter(c => c.photos.length).length, rev:it.filter(needsReview).length, zs, prim:L.filter(c => c.loc === l).length}; });
  d.byCat = CATS.map((z, k) => { const it = L.filter(c => catsOf(c).includes(z.id)), ls = {}; it.forEach(c => c.locs.forEach(l => { ls[l] = (ls[l] || 0) + 1; })); const rows = pendRows(z.id), top = Object.entries(ls).sort((a, b) => b[1] - a[1])[0]; return {z, k, n:it.length, units:it.reduce((s, c) => s + dsU(c), 0), rev:it.filter(needsReview).length, pd:rows.filter(x => have[x.key]).length, pt:rows.length, top:top ? top[0] : "", prim:L.filter(c => c.cat === z.id).length}; });
  d.house = L.filter(c => c.locs.includes(HOUSE));
  const rest = {}; L.filter(c => !c.locs.includes(HOUSE)).forEach(c => { rest[c.loc] = (rest[c.loc] || 0) + 1; });
  d.rest = Object.entries(rest).sort((a, b) => b[1] - a[1]);
  d.st = {ok:L.filter(c => c.estado === "ok").length, conf:L.filter(c => c.estado === "conf").length, sin:L.filter(c => c.estado === "sin").length};
  d.fi = {alta:L.filter(c => c.fiab === "alta").length, mitjana:L.filter(c => c.fiab === "mitjana").length, baixa:L.filter(c => c.fiab === "baixa").length};
  d.days = dashDaily(L, cfgGet("dashDays"));
  d.users = dashUsers(L);
  d.top = L.map((c, i) => ({c, i:DATA.indexOf(c)})).filter(x => dsU(x.c) > 0).sort((a, b) => dsU(b.c) - dsU(a.c)).slice(0, cfgGet("dashTop"));
  d.latest = L.map(c => ({c, i:DATA.indexOf(c)})).filter(x => typeof x.c.ord === "number" && x.c.ord > 1e12).sort((a, b) => b.c.ord - a.c.ord).slice(0, cfgGet("dashTop"));
  d.stats = invStats();
  return d;
}
const dsSec = (id, ico, title, note, body) => '<section class="dsec" id="ds-' + id + '"><h2><span aria-hidden="true">' + ico + '</span>' + title + '</h2>' + (note ? '<p class="ds-n">' + note + '</p>' : '') + body + '</section>';
const dsKpi = (ico, label, v, sub, p, col) => '<div class="dcard k"><div class="kt"><div class="dl"><span aria-hidden="true">' + ico + '</span>' + label + '</div><div class="dv"><span class="cu" data-v="' + v + '">' + dsN(v) + '</span></div><div class="ds">' + sub + '</div></div>' + (p == null ? '' : dsRing(p, col || 'var(--accent)', 58)) + '</div>';
function dashHtml(d){
  const tot = d.tot, nav = [];
  const sec = (id, label, html) => { nav.push([id, label]); return html; };
  let h = "";
  /* resum */
  h += sec("resum", "Resum", dsSec("resum", "✨", "Resum", "Una mirada ràpida a tot l'inventari.", '<div class="dsgrid k">'
    + dsKpi("📦", "Articles", tot, dsN(d.units) + " unitats en total", null)
    + dsKpi("📷", "Amb foto", d.withPh, dsP(d.withPh, tot) + "% de l'inventari", dsP(d.withPh, tot), "#4fe3d2")
    + dsKpi("⚠️", "Per revisar", d.rev, dsP(d.rev, tot) + "% de l'inventari", dsP(d.rev, tot), "#ffd166")
    + dsKpi("☑", "Pendents aconseguits", d.pd, d.pt - d.pd + " encara per aconseguir", dsP(d.pd, d.pt), "#7ef0c4")
    + dsKpi("🆕", cfgGet("newDays") ? "Nous (" + cfgGet("newDays") + " dies)" : "Creats (7 dies)", cfgGet("newDays") ? d.newN : d.wk, "Articles afegits fa poc", null)
    + dsKpi("🏡", "A Nau&amp;Noa House", d.house.length, dsP(d.house.length, tot) + "% ja és a casa", dsP(d.house.length, tot), "#ffd23f")
    + '</div>'));
  /* casa */
  const hp = dsP(d.house.length, tot), units = d.house.reduce((s, c) => s + dsU(c), 0);
  h += sec("casa", "Casa", dsSec("casa", "🏡", "Nau&amp;Noa House", "El destí final de tots els articles.",
    '<div class="dhero"><div class="hr">' + dsRing(hp, "#ffd23f", 104) + '</div><div class="ht"><h3>' + (tot ? (hp >= 100 ? "Tot és a casa! 🎉" : "La mudança va al " + hp + "%") : "Encara no hi ha articles") + '</h3>'
    + '<div class="big"><span class="cu" data-v="' + d.house.length + '">' + dsN(d.house.length) + '</span> <small style="font-size:15px;font-weight:700;color:#e8d9b0">de ' + dsN(tot) + ' articles · ' + dsN(units) + ' unitats</small></div>'
    + '<div class="dsbar gold"><i style="--w:' + hp + '%"></i></div>'
    + '<p>' + (d.rest.length ? 'Encara falten per portar: ' + d.rest.slice(0, 4).map(x => '<b>' + x[1] + '</b> de ' + esc(x[0])).join(' · ') + '.' : (tot ? 'No en queda cap per portar.' : '')) + '</p>'
    + '<div class="ft2"><button type="button" data-a="loc" data-v="' + esc(HOUSE) + '">Veure què hi ha a casa</button>'
    + (d.rest.length ? '<button type="button" data-a="loc" data-v="' + esc(d.rest[0][0]) + '">Falten a ' + esc(d.rest[0][0]) + '</button>' : '') + '<button type="button" class="confbtn" data-a="confh">🎉 Prova la celebració</button></div></div></div>'));
  /* ubicacions */
  h += sec("ubic", "Ubicacions", dsSec("ubic", "📍", "Ubicacions", "Toca'n una per veure els seus articles.", '<div class="dsgrid c">' + d.byLoc.map((l, k) => {
    const zs = Object.entries(l.zs).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const bar = zs.map(([z, n]) => '<i style="--w:' + dsP(n, l.n) + '%;background:' + DSC[CATS.findIndex(x => x.id === z) % DSC.length] + '"></i>').join("");
    return '<div class="dcard click' + (l.id === HOUSE ? ' house' : '') + '" data-a="loc" data-v="' + esc(l.id) + '" tabindex="0" role="button"><div class="dl"><span aria-hidden="true">' + locIconSvg(locIconKey(l.id), 18) + '</span>' + esc(l.id) + '</div>'
      + '<div class="dv"><span class="cu" data-v="' + l.n + '">' + dsN(l.n) + '</span> <small style="font-size:13px;color:var(--muted);font-weight:700">' + dsP(l.n, tot) + '%</small></div>'
      + '<div class="dsbar' + (l.id === HOUSE ? ' gold' : '') + '"><i style="--w:' + dsP(l.n, tot) + '%"></i></div>'
      + '<div class="dsbar" title="Zones">' + (bar || '') + '</div>'
      + '<div class="row2"><span><b>' + dsN(l.units) + '</b> unitats</span><span><b>' + dsP(l.ph, l.n) + '%</b> amb foto</span><span><b>' + l.rev + '</b> per revisar</span></div></div>';
  }).join("") + '</div>'));
  /* zones */
  const dz = d.byCat.map(x => ({n:x.prim, col:DSC[x.k % DSC.length], label:x.z.icon + " " + x.z.label}));
  const dl = d.byLoc.map((x, k) => ({n:x.prim, col:x.id === HOUSE ? "#ffd23f" : DSC[(k + 3) % DSC.length], label:x.id}));
  const leg = a => '<div class="leg">' + a.map(s => '<div><i style="background:' + s.col + '"></i>' + esc(s.label) + '<span>' + s.n + '</span></div>').join("") + '</div>';
  h += sec("zones", "Zones", dsSec("zones", "🏠", "Zones de la casa", "Distribució i pendents per aconseguir.",
    '<div class="dsgrid w"><div class="dcard"><div class="dl">Per zona principal</div><div class="dsdon">' + dsDonut(dz, tot, "articles") + leg(dz) + '</div></div>'
    + '<div class="dcard"><div class="dl">Per ubicació principal</div><div class="dsdon">' + dsDonut(dl, tot, "articles") + leg(dl) + '</div></div></div>'
    + '<div class="dsgrid c" style="margin-top:10px">' + d.byCat.map(x => '<div class="dcard click" data-a="cat" data-v="' + esc(x.z.id) + '" tabindex="0" role="button"><div class="dl"><span aria-hidden="true">' + x.z.icon + '</span>' + esc(x.z.label) + '</div>'
      + '<div class="dv"><span class="cu" data-v="' + x.n + '">' + dsN(x.n) + '</span> <small style="font-size:13px;color:var(--muted);font-weight:700">' + dsP(x.n, tot) + '%</small></div>'
      + '<div class="dsbar"><i style="--w:' + dsP(x.n, tot) + '%;background:' + DSC[x.k % DSC.length] + '"></i></div>'
      + '<div class="dsbar ok" title="Pendents aconseguits"><i style="--w:' + dsP(x.pd, x.pt) + '%"></i></div>'
      + '<div class="row2"><span><b>' + x.pd + '/' + x.pt + '</b> pendents</span><span><b>' + dsN(x.units) + '</b> unitats</span>' + (x.rev ? '<span><b>' + x.rev + '</b> per revisar</span>' : '') + (x.top ? '<span class="pill">📍 ' + esc(x.top) + '</span>' : '') + '</div></div>').join("") + '</div>'));
  /* mapa */
  const mxv = Math.max(1, ...d.byCat.flatMap(x => d.byLoc.map(l => d.L.filter(c => catsOf(c).includes(x.z.id) && c.locs.includes(l.id)).length)));
  let cells = '<div class="h"></div>' + d.byLoc.map(l => '<div class="h" title="' + esc(l.id) + '">' + esc(l.id === HOUSE ? "🏡" : (l.id.length > 9 ? l.id.slice(0, 8) + "…" : l.id)) + '</div>').join("");
  d.byCat.forEach(x => { cells += '<div class="r"><span aria-hidden="true">' + x.z.icon + '</span>' + esc(x.z.label.length > 11 ? x.z.short : x.z.label) + '</div>';
    d.byLoc.forEach(l => { const n = d.L.filter(c => catsOf(c).includes(x.z.id) && c.locs.includes(l.id)).length;
      cells += n ? '<div class="c" style="--a:' + (.12 + .7 * n / mxv).toFixed(2) + '" data-a="cell" data-l="' + esc(l.id) + '" data-z="' + esc(x.z.id) + '" role="button" tabindex="0" title="' + esc(x.z.label + " · " + l.id) + '">' + n + '</div>' : '<div class="c z">·</div>'; }); });
  h += sec("mapa", "Mapa", dsSec("mapa", "🗺️", "Mapa zona × ubicació", "Més intens = més articles. Toca una casella per filtrar-la.", '<div class="dcard"><div class="dsmx" style="grid-template-columns:auto repeat(' + d.byLoc.length + ',minmax(34px,1fr))">' + cells + '</div></div>'));
  /* activitat */
  const tcr = d.days.reduce((s, x) => s + x.cr, 0), ted = d.days.reduce((s, x) => s + x.ed, 0);
  h += sec("act", "Activitat", dsSec("act", "📈", "Activitat", "Últims " + d.days.length + " dies. Els articles antics no tenen data de creació.", '<div class="dcard">' + dsBars(d.days)
    + '<div class="dsleg"><span><i style="background:var(--accent)"></i>Articles creats <b>' + tcr + '</b></span><span><i style="background:rgba(255,255,255,.38)"></i>Altres canvis <b>' + ted + '</b></span></div></div>'));
  /* usuaris */
  const U = d.users, maxcr = Math.max(1, ...U.list.map(u => u.cr), U.unk);
  const when = ts => ts ? ago(ts) : "—";
  h += sec("usuaris", "Usuaris", dsSec("usuaris", "👥", "Qui fa què", "Articles creats, canvis fets i missatges al xat.", '<div class="dsgrid u">' + U.list.map(u => '<div class="dcard"><div class="dsusr"><div class="av ' + u.name.toLowerCase() + '">' + esc(u.name) + '</div><div class="ut"><div class="nm"><b>' + esc(u.who) + '</b><small>Última activitat: ' + esc(when(u.last)) + '</small></div>'
    + '<div class="dsbar"><i style="--w:' + dsP(u.cr, maxcr) + '%"></i></div><div class="st"><div><b class="cu" data-v="' + u.cr + '">' + u.cr + '</b><small>articles creats</small></div><div><b class="cu" data-v="' + u.ch + '">' + u.ch + '</b><small>canvis</small></div><div><b class="cu" data-v="' + u.msgs + '">' + u.msgs + '</b><small>missatges</small></div></div></div></div></div>').join("")
    + '</div>' + (U.unk ? '<p class="ds-n" style="margin-top:8px">' + U.unk + ' articles anteriors no tenen autor registrat. A partir d\'ara es guarda qui crea cada article.</p>' : '')));
  /* tipus d'article */
  const tc = typeCounts(live), tTop = tc.slice(0, 11), tRest = tc.slice(11).reduce((s, x) => s + x[1], 0);
  const dt = tTop.map((x, k) => ({n:x[1], col:x[0] === "Sense tipus" ? "#555" : DSC[k % DSC.length], label:(x[0] === "Sense tipus" ? "❔" : typeIco(x[0])) + " " + x[0]})).concat(tRest ? [{n:tRest, col:"#888", label:"Altres tipus"}] : []);
  h += sec("tipus", "Tipus", dsSec("tipus", "🏷️", "Tipus d'article", "Es dedueix del nom de cada article (o el que hi posis a mà). Toca'n un per filtrar.",
    '<div class="dsgrid w"><div class="dcard"><div class="dl">Distribució</div><div class="dsdon">' + dsDonut(dt, tc.length, tc.length === 1 ? "tipus" : "tipus") + leg(dt) + '</div></div>'
    + '<div class="dslist">' + tc.map(([t, n]) => '<button type="button" class="dsitem" data-a="tip" data-v="' + esc(t) + '"><span class="th">' + (t === "Sense tipus" ? "❔" : typeIco(t)) + '</span><span class="tx"><b>' + esc(t) + '</b><small>' + dsP(n, tot) + '% de l\'inventari · ' + dsN(d.L.filter(c => (typeOf(c) || "Sense tipus") === t).reduce((s, c) => s + dsU(c), 0)) + ' unitats</small></span><span class="rk">' + n + '</span></button>').join("") + '</div></div>'));
  /* estat */
  const seg =(a, cols) => '<div class="dsbar">' + a.map((n, i) => '<i style="--w:' + dsP(n, tot) + '%;background:' + cols[i] + '"></i>').join("") + '</div>';
  h += sec("estat", "Estat", dsSec("estat", "🩺", "Estat de l'inventari", "", '<div class="dsgrid w"><div class="dcard"><div class="dl">Verificació</div>' + seg([d.st.ok, d.st.conf, d.st.sin], ["#7ef0c4", "#ffd166", "#ff8a7a"])
    + '<div class="row2"><span>Verificat <b>' + d.st.ok + '</b></span><span>Per confirmar <b>' + d.st.conf + '</b></span><span>Sense foto <b>' + d.st.sin + '</b></span></div></div>'
    + '<div class="dcard"><div class="dl">Fiabilitat de la informació</div>' + seg([d.fi.alta, d.fi.mitjana, d.fi.baixa], ["#4fe3d2", "#ffd166", "#ff8a7a"])
    + '<div class="row2"><span>Alta <b>' + d.fi.alta + '</b></span><span>Mitjana <b>' + d.fi.mitjana + '</b></span><span>Baixa <b>' + d.fi.baixa + '</b></span></div></div></div>'));
  /* tops */
  const li = (x, rank, sub) => '<button type="button" class="dsitem" data-a="item" data-v="' + x.i + '"><span class="th">' + (x.c.photos.length ? '<img alt="" src="' + thumbSrc(x.c) + '">' : '📦') + '</span><span class="tx"><b>' + esc(x.c.item) + '</b><small>' + sub + '</small></span><span class="rk">' + rank + '</span></button>';
  h += sec("tops", "Rànquings", dsSec("tops", "🏆", "Rànquings", "", '<div class="dsgrid w"><div><div class="dl" style="font-weight:800;margin:0 0 6px;color:var(--ink)">Amb més unitats</div><div class="dslist">'
    + (d.top.length ? d.top.map((x, k) => li(x, "×" + dsN(dsU(x.c)), '#' + (k + 1) + ' · ' + esc(locsTxt(x.c, ", ")))).join("") : '<div class="dsempty">Encara no hi ha articles.</div>') + '</div></div>'
    + '<div><div class="dl" style="font-weight:800;margin:0 0 6px;color:var(--ink)">Últims afegits</div><div class="dslist">'
    + (d.latest.length ? d.latest.map(x => li(x, ago(x.c.ord), esc(zonesTxt(x.c)) + ' · ' + esc(locsTxt(x.c, ", ")))).join("") : '<div class="dsempty">Cap article nou amb data.</div>') + '</div></div></div>'));
  /* núvol */
  const s = d.stats, pct = Math.min(100, s.bytes / FREE_BYTES * 100);
  h += sec("nuvol", "Núvol", dsSec("nuvol", "☁️", "Núvol i dades", "", '<div class="dcard"><div class="dl">Espai usat (aprox.)</div><div class="dv"><span>' + mbTxt(s.bytes) + ' MB</span> <small style="font-size:13px;color:var(--muted);font-weight:700">de 1024 MB · ' + pct.toFixed(1).replace(".", ",") + '%</small></div>'
    + '<div class="dsbar ' + (pct >= 85 ? '' : 'ok') + '"><i style="--w:' + Math.max(1, pct).toFixed(1) + '%"></i></div><div class="row2"><span><b>' + s.phN + '</b> fotos (' + mbTxt(s.phBytes) + ' MB)</span><span><b>' + s.bkN + '</b> còpies</span><span><b>' + HIST.length + '</b> canvis a Desfés</span><span><b>' + CHAT.length + '</b> missatges al xat</span></div></div>'));
  return {html:h, nav};
}
function dashRender(keep){
  const body = $("dashBody"), st = body.scrollTop, d = dashData(), r = dashHtml(d);
  body.className = "dbody" + (keep ? " go" : "") + (cfgGet("dashAnim") ? "" : " noanim");
  body.innerHTML = r.html;
  $("dashNav").innerHTML = r.nav.map(([id, l]) => '<button type="button" data-n="' + id + '">' + l + '</button>').join("");
  $("dashSub").textContent = d.tot + " articles · " + LOCS.length + " ubicacions · " + CATS.length + " zones";
  body.scrollTop = st; dashSpy();
  if(!keep){ requestAnimationFrame(() => requestAnimationFrame(() => { if(dashOpenF) body.classList.add("go"); })); dashCount(body); }
}
function dashCount(root){
  if(!cfgGet("dashAnim")) return;
  const els = [...root.querySelectorAll(".cu")], t0 = performance.now(), D = 900;
  els.forEach(e => { e.textContent = "0"; });
  const f = now => {
    const k = Math.min(1, (now - t0) / D), ez = 1 - Math.pow(1 - k, 3);
    els.forEach(e => { e.textContent = dsN(Math.round(+e.dataset.v * ez)); });
    if(k < 1 && dashOpenF) requestAnimationFrame(f); else els.forEach(e => { e.textContent = dsN(+e.dataset.v); });
  };
  requestAnimationFrame(f);
}
function dashSpy(){
  const body = $("dashBody"), top = body.getBoundingClientRect().top; let cur = "";
  body.querySelectorAll(".dsec").forEach(s => { if(s.getBoundingClientRect().top - top <= 60) cur = s.id.slice(3); });
  $("dashNav").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.n === (cur || "resum")));
}
function dashSoon(){ clearTimeout(dashSoonT); dashSoonT = setTimeout(() => { if(dashOpenF) dashRender(true); }, 250); }
function dashOpen(){
  dashOpenF = true; $("dash").hidden = false; document.body.classList.add("lock");
  $("dashBody").scrollTop = 0; dashRender(false);
  try { $("dashClose").focus({preventScroll:true}); } catch(_){}
}
function dashClose(){
  if(!dashOpenF) return;
  dashOpenF = false; $("dash").hidden = true;
  if(!$("dlg").classList.contains("open")) document.body.classList.remove("lock");
  try { $("dashBtn").focus({preventScroll:true}); } catch(_){}
}
function dashGo(loc, cat){
  dashClose(); resetFilters();
  if(loc) state.loc = loc; if(cat) state.cat = cat;
  render(); scrollTo({top:0, behavior:"auto"});
}
$("dashBtn").onclick = dashOpen;
$("dashClose").onclick = dashClose;
$("dashNav").addEventListener("click", e => {
  const b = e.target.closest("button[data-n]"); if(!b) return;
  const s = $("ds-" + b.dataset.n); if(s) s.scrollIntoView({behavior:"smooth", block:"start"});
});
$("dashBody").addEventListener("scroll", () => { clearTimeout(dashSpy.t); dashSpy.t = setTimeout(dashSpy, 60); }, {passive:true});
function dashAct(t){
  const a = t.dataset.a;
  if(a === "loc") dashGo(t.dataset.v, null);
  else if(a === "cat") dashGo(null, t.dataset.v);
  else if(a === "cell") dashGo(t.dataset.l, t.dataset.z);
  else if(a === "tip"){ dashGo(null, null); state.tip = t.dataset.v; render(); }
  else if(a === "item"){ const i = +t.dataset.v; dashClose(); if(!order.includes(i)) resetFilters(); openDlg(i); }
  else if(a === "confh") fxHouse(null, true);
}
$("dashBody").addEventListener("click", e => { const t = e.target.closest("[data-a]"); if(t) dashAct(t); });
$("dashBody").addEventListener("keydown", e => { if((e.key === "Enter" || e.key === " ") && e.target.matches("[data-a][tabindex]")){ e.preventDefault(); dashAct(e.target); } });
document.addEventListener("keydown", e => {
  if(e.key === "Escape" && dashOpenF && !document.querySelector("dialog[open]") && !DL.open){ e.preventDefault(); dashClose(); }
});

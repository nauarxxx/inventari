/* Inventari de casa · chat.js — xat entre NAU i NOA */

/* =====================================================================
   Xat entre NAU (arnaubalsellsc4) i NOA (ainhoaguerreroalejo2)
   chat/{id}        -> {ts, from, text}
   chatread/{nau|noa} -> {ts}   (últim missatge vist per cada persona)
   El xat NO passa mai pel registre de «Desfés».
   ===================================================================== */
const CHAT_NAME = {"arnaubalsellsc4@gmail.com":"NAU", "ainhoaguerreroalejo2@gmail.com":"NOA"};
const chatName = e => CHAT_NAME[String(e || "").toLowerCase()] || String(e || "?").split("@")[0].toUpperCase();
let CHAT = [], chatLoaded = false, chatReadLoaded = false, chatReads = {}, chatSeen = new Set(), chatBoot = 0, chatNew = 0;
const chatMe = () => cloudUser ? String(cloudUser.email).toLowerCase() : "";
const chatMyKey = () => chatName(chatMe()).toLowerCase();
const chatOtherKey = () => { const o = ALLOWED.map(e => chatName(e).toLowerCase()).find(k => k !== chatMyKey()); return o || ""; };
const chatMyRead = () => +(chatReads[chatMyKey()] || 0);
function chatUnread(){
  if(!cloudUser || !chatLoaded || !chatReadLoaded) return 0;
  const t = chatMyRead(), me = chatMe();
  return CHAT.filter(m => m.from !== me && m.ts > t).length;
}
function chatBadge(){
  const n = chatUnread(), b = $("chatN");
  b.hidden = !n; b.textContent = n > 99 ? "99+" : n;
  $("chatBtn").title = n ? "Xat · " + n + (n > 1 ? " missatges sense llegir" : " missatge sense llegir") : "Xat entre NAU i NOA";
  document.title = (n ? "(" + n + ") " : "") + "Inventari de casa";
}
function chatReset(){
  CHAT = []; chatLoaded = false; chatReadLoaded = false; chatReads = {}; chatSeen = new Set(); chatBoot = 0; chatNew = 0;
  if($("chdlg").open) $("chdlg").close();
  chatBadge();
}

/* ---- dades que arriben del núvol ---- */
function cloudChat(docs){
  const first = !chatLoaded;
  CHAT = docs.map(d => ({id: d.id, ts: +d.ts || 0, from: String(d.from || "").toLowerCase(), text: String(d.text == null ? "" : d.text), pending: !!d.pending}))
    .sort((a, b) => (a.ts - b.ts) || a.id.localeCompare(b.id));
  chatLoaded = true;
  const open = $("chdlg").open, me = chatMe();
  if(first){ chatBoot = Date.now() - 30000; CHAT.forEach(m => chatSeen.add(m.id)); }
  else {
    const fresh = CHAT.filter(m => !chatSeen.has(m.id));
    fresh.forEach(m => chatSeen.add(m.id));
    const inc = fresh.filter(m => m.from !== me && m.ts > chatBoot);
    if(inc.length && !open){
      const m = inc[inc.length - 1];
      chatBeep();
      toast("💬 " + chatName(m.from) + ": " + (m.text.length > 70 ? m.text.slice(0, 70) + "…" : m.text));
    }
    if(open) chatNew += inc.length;
  }
  chatBadge();
  if(open){ chatRender(); chatMarkRead(); }
  chatTrim();
}
function cloudChatRead(docs){
  docs.forEach(d => { chatReads[d.id] = Math.max(+chatReads[d.id] || 0, +d.ts || 0); });
  chatReadLoaded = true;
  chatBadge();
  if($("chdlg").open){ chatMarkRead(); chatRender(); }
}
function chatMarkRead(){
  if(!cloudUser || !chatLoaded || !$("chdlg").open || !window.cloud || !CHAT.length) return;
  const mx = CHAT[CHAT.length - 1].ts;
  if(mx > chatMyRead()){
    chatReads[chatMyKey()] = mx; chatBadge();
    cloud.batch([{t:"set", col:"chatread", id:chatMyKey(), data:{ts:mx}}]).catch(() => {});
  }
}

/* ---- pintar els missatges ---- */
const CH_EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\s)+$/u;
function chatLinks(t){ return esc(t).replace(/(https?:\/\/[^\s<]+)/g, u => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>'); }
function chatDay(ts){
  const d = new Date(ts), t = new Date(), y = new Date(Date.now() - 864e5);
  if(d.toDateString() === t.toDateString()) return "Avui";
  if(d.toDateString() === y.toDateString()) return "Ahir";
  return d.toLocaleDateString("ca", {weekday:"long", day:"numeric", month:"long"});
}
const chatHM = ts => new Date(ts).toLocaleTimeString("ca", {hour:"2-digit", minute:"2-digit"});
function chatRender(forceBottom){
  const ul = $("chList"), me = chatMe();
  const dist = ul.scrollHeight - ul.scrollTop - ul.clientHeight;
  const stick = !!forceBottom || dist < 90 || !ul.children.length;
  if(!CHAT.length){
    ul.innerHTML = '<div class="chempty"><b>👋</b>Encara no hi ha missatges.<br>Escriu el primer!</div>';
    return;
  }
  const otherRead = +(chatReads[chatOtherKey()] || 0);
  let h = "", lastDay = "";
  CHAT.forEach((m, i) => {
    const day = new Date(m.ts).toDateString();
    if(day !== lastDay){ h += '<div class="chday"><span>' + esc(chatDay(m.ts)) + '</span></div>'; lastDay = day; }
    const prev = CHAT[i - 1], mine = m.from === me, who = chatName(m.from), k = who.toLowerCase();
    const grp = !!prev && new Date(prev.ts).toDateString() === day && prev.from === m.from && m.ts - prev.ts < 300000;
    const big = CH_EMOJI_ONLY.test(m.text) && (m.text.match(/\p{Extended_Pictographic}/gu) || []).length <= 3;
    const tick = mine ? '<span class="tk' + (otherRead >= m.ts ? ' seen' : '') + '" title="' + (m.pending ? 'Enviant…' : otherRead >= m.ts ? 'Vist' : 'Enviat') + '">' + (m.pending ? "🕓" : otherRead >= m.ts ? "✓✓" : "✓") + '</span>' : "";
    h += '<div class="cm ' + (mine ? "me" : "ot") + (grp ? " grp" : "") + '">'
      + '<span class="cm-av ' + k + (grp ? " ghost" : "") + '" aria-hidden="true">' + esc(who) + '</span>'
      + '<div class="cm-b">' + (grp ? "" : '<span class="cm-n ' + k + '">' + esc(who) + '</span>')
      + '<div class="cm-t' + (big ? " big" : "") + '">' + chatLinks(m.text) + '<span class="cm-m">' + chatHM(m.ts) + tick + '</span></div></div></div>';
  });
  ul.innerHTML = h;
  if(stick){ ul.scrollTop = ul.scrollHeight; chatNew = 0; $("chJump").hidden = true; }
  else if(chatNew > 0){ $("chJump").hidden = false; }
}
$("chList").addEventListener("scroll", () => {
  const u = $("chList");
  if(u.scrollHeight - u.scrollTop - u.clientHeight < 90){ chatNew = 0; $("chJump").hidden = true; }
}, {passive: true});
$("chJump").onclick = () => { const u = $("chList"); u.scrollTop = u.scrollHeight; chatNew = 0; $("chJump").hidden = true; };

/* ---- enviar ---- */
function chatGrow(){ const t = $("chIn"); t.style.height = "44px"; t.style.height = Math.min(120, Math.max(44, t.scrollHeight)) + "px"; }
function chatSyncSend(){ $("chSend").disabled = !$("chIn").value.trim(); }
function chatSend(){
  const ta = $("chIn"), text = ta.value.trim();
  if(!text || !cloudUser || !window.cloud) return;
  ta.value = ""; chatGrow(); chatSyncSend();
  $("chEmoji").hidden = true; $("chEmBtn").setAttribute("aria-expanded", "false");
  cloud.batch([{t:"set", col:"chat", id:cloud.newId(), data:{ts:Date.now(), from:chatMe(), text}}]).catch(cloudErr);
  const u = $("chList"); u.scrollTop = u.scrollHeight;
  ta.focus();
}
$("chForm").onsubmit = e => { e.preventDefault(); chatSend(); };
$("chIn").addEventListener("input", () => { chatGrow(); chatSyncSend(); });
$("chIn").addEventListener("keydown", e => {
  if(e.key === "Enter" && !e.shiftKey && !isTouch && !e.isComposing){ e.preventDefault(); chatSend(); }
});

/* ---- emoticones ---- */
const EMO = [
  ["😊", "Cares", "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😋 😛 😜 🤪 😝 🤗 🤭 🤔 🤨 😐 😑 😶 🙄 😏 😣 😥 😮 🤐 😯 😪 😫 🥱 😴 😎 🤓 🥳 🤩 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 😰 🤒 🤕 🥴 🤢 😷 🤠 😈 💀 👻 🤖"],
  ["👍", "Mans", "👍 👎 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 👏 🙌 🤝 🙏 💪 🫶 🫡 🤷 🙋 🙆 🙅 🤦 💃 🕺"],
  ["❤️", "Cors i festa", "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 ✨ ⭐ 🌟 💫 🔥 💯 ✅ ❌ ⚠️ ❓ ❗ 🎉 🎊 🎁 🎂 🥂 🍾 🏆 🥇"],
  ["🏠", "Casa", "🏠 🛋️ 🛏️ 🚽 🛁 🚿 🍳 🍽️ 🧽 🧺 🧰 🔌 💡 🔑 🚪 🪑 📦 🛒 🧹 🪴 🔧 🔨 🪜 🧴 🧻 🧼 🪣 🗑️ 📺 📱 💻 🖥️ 🎮 ⏰ 📅 📷"],
  ["🍕", "Menjar", "🍕 🍔 🍟 🌭 🌮 🌯 🍝 🍣 🍜 🥗 🥘 🍳 🥐 🥖 🧀 🥩 🍗 🍰 🍪 🍫 🍿 ☕ 🍵 🍺 🍷 🥤 🍎 🍌 🍇 🍉 🍓 🥑"],
  ["🚗", "Viatges", "🚗 🚙 🚲 🛵 ✈️ 🚆 🚌 ⛽ 🅿️ 📍 🗺️ 🧭 🏔️ ⛰️ ❄️ ⛷️ 🏖️ 🌞 ☀️ ⛅ 🌧️ ⛈️ 🌈 🌙 🐶 🐱 🐾 🌿 🌸"]
];
const emoRecent = () => { try { return JSON.parse(localStorage.getItem("inv_emoji_recent") || "[]").slice(0, 24); } catch(e){ return []; } };
let emoTab = 1;
function emoRender(){
  const tabs = [["🕘", "Recents"]].concat(EMO.map(t => [t[0], t[1]]));
  $("chTabs").innerHTML = tabs.map((t, i) => '<button type="button" class="chtab" role="tab" aria-selected="' + (i === emoTab) + '" title="' + esc(t[1]) + '" data-t="' + i + '">' + t[0] + '</button>').join("");
  const list = emoTab === 0 ? emoRecent() : EMO[emoTab - 1][2].split(" ");
  $("chGrid").innerHTML = list.length ? list.map(e => '<button type="button" data-e="' + e + '" aria-label="' + e + '">' + e + '</button>').join("") : '<p class="chnone">Aquí sortiran les emoticones que facis servir més.</p>';
  $("chGrid").scrollTop = 0;
}
$("chTabs").addEventListener("click", e => { const b = e.target.closest(".chtab"); if(!b) return; emoTab = +b.dataset.t; emoRender(); });
$("chGrid").addEventListener("click", e => {
  const b = e.target.closest("button[data-e]"); if(!b) return;
  const em = b.dataset.e, ta = $("chIn"), a = ta.selectionStart == null ? ta.value.length : ta.selectionStart, z = ta.selectionEnd == null ? a : ta.selectionEnd;
  if(ta.value.length + em.length > ta.maxLength) return;
  ta.value = ta.value.slice(0, a) + em + ta.value.slice(z);
  const p = a + em.length; ta.setSelectionRange(p, p);
  chatGrow(); chatSyncSend();
  try { const r = [em].concat(emoRecent().filter(x => x !== em)).slice(0, 24); localStorage.setItem("inv_emoji_recent", JSON.stringify(r)); } catch(_){}
  if(!isTouch) ta.focus();
});
$("chEmBtn").onclick = () => {
  const open = $("chEmoji").hidden;
  $("chEmoji").hidden = !open; $("chEmBtn").setAttribute("aria-expanded", String(open));
  if(open){ if(emoTab === 0 && !emoRecent().length) emoTab = 1; emoRender(); }
  const u = $("chList"); u.scrollTop = u.scrollHeight;
};

/* ---- obrir / tancar ---- */
function chatFit(){
  const d = $("chdlg"), vv = window.visualViewport;
  if(!d.open || !vv){ d.style.height = d.style.top = d.style.bottom = d.style.margin = ""; return; }
  if(vv.height < innerHeight - 120){ /* teclat obert al mòbil */
    d.style.margin = "0 auto"; d.style.top = (vv.offsetTop + 8) + "px"; d.style.bottom = "auto"; d.style.height = Math.min(780, vv.height - 16) + "px";
  } else { d.style.height = d.style.top = d.style.bottom = d.style.margin = ""; }
}
if(window.visualViewport){ visualViewport.addEventListener("resize", chatFit); visualViewport.addEventListener("scroll", chatFit); }
$("chatBtn").onclick = () => {
  if(!cloudUser){ toast("Cal iniciar sessió per fer servir el xat."); return; }
  $("chSub").textContent = "Ets " + chatName(chatMe()) + " · amb " + chatName(ALLOWED.find(e => e.toLowerCase() !== chatMe()) || "");
  chatNew = 0; $("chJump").hidden = true;
  $("chEmoji").hidden = true; $("chEmBtn").setAttribute("aria-expanded", "false");
  $("chdlg").showModal(); chatFit();
  $("chList").innerHTML = ""; chatRender(true); chatMarkRead(); chatGrow(); chatSyncSend();
  const u = $("chList"); u.scrollTop = u.scrollHeight;
  if(!isTouch) $("chIn").focus();
};
$("chClose").onclick = () => $("chdlg").close();
$("chdlg").addEventListener("close", () => { $("chEmoji").hidden = true; chatFit(); chatMarkRead(); chatBadge(); });

let CHAT_MAX = 300;

function chatTrim(){
  if(!window.cloud || !cloudUser || !chatLoaded || importing) return;
  if(CHAT.length <= CHAT_MAX) return;
  const old = CHAT.slice(0, CHAT.length - CHAT_MAX).filter(m => !m.pending);
  if(old.length) cloud.batch(old.map(m => ({t:"del", col:"chat", id:m.id}))).catch(() => {});
}


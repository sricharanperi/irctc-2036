/* IRCTC 2036 (student concept). Frontend only; sample data; no backend. */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- state ---------- */
const KEY = 'irctc2036-v1';
const DEF = { lang: 'en', scale: 1, theme: 'auto', autonomy: 'big', cap: 3000, booked: [], approved: [], dismissed: [], standing: { fri: true, appa: true }, src: { calendar: true, mail: true, location: false }, log: [] };
let S;
try { if (new URLSearchParams(location.search).has('reset')) { localStorage.removeItem(KEY); history.replaceState(null, '', location.pathname + location.hash); } S = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { S = { ...DEF }; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: keep working */ } };

/* ---------- language ---------- */
const L = (en, hi, te) => ({ en, hi: hi || en, te: te || en }[S.lang] || en);
const LO = o => (o && (o[S.lang] || o.en)) || '';
const cn = k => cityName(k, S.lang);

/* ---------- time ---------- */
const t0 = Date.now();
const simNow = () => addMin(SIM0, Math.min(Math.floor((Date.now() - t0) / 1000), 240)); // 1 real second = 1 simulated minute
const p2 = n => String(n).padStart(2, '0');
const hm = d => p2(d.getHours()) + ':' + p2(d.getMinutes());
const dayName = d => d.toLocaleDateString(S.lang === 'hi' ? 'hi-IN' : S.lang === 'te' ? 'te-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const dayLong = d => d.toLocaleDateString(S.lang === 'hi' ? 'hi-IN' : S.lang === 'te' ? 'te-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const dur = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();

/* ---------- icons (inline, stroke) ---------- */
const ic = d => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  cab: ic('<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>'),
  tap: ic('<path d="M9 11V5a2 2 0 014 0v6"/><path d="M13 11V9a2 2 0 014 0v5a6 6 0 01-6 6 5 5 0 01-4-2l-3-4a1.6 1.6 0 012.4-2L9 14"/>'),
  train: ic('<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14"/><circle cx="9" cy="14.5" r=".6"/><circle cx="15" cy="14.5" r=".6"/><path d="M8 21l2-4M16 21l-2-4"/>'),
  mic: ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>'),
  check: ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  clock: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  person: ic('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0114 0"/>'),
  shield: ic('<path d="M12 3l8 3v6c0 4.5-3.4 7.6-8 9-4.6-1.4-8-4.5-8-9V6z"/><path d="M9 12l2.2 2.2L15 10.5"/>'),
  undo: ic('<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 010 12" transform="translate(0 -4)"/>'),
  chev: ic('<path d="M9 6l6 6-6 6"/>'),
};
const MODE_ICON = { cab: ICON.cab, tap: ICON.tap, hs: ICON.train, sl: ICON.train, ex: ICON.train };

/* ---------- derived content ---------- */
const NAME = 'Harsha';
const modeLabel = m => ({ cab: L('Shared cab', 'साझा कैब', 'షేర్డ్ క్యాబ్'), tap: L('Walk on', 'सीधे चढ़ें', 'నేరుగా ఎక్కండి'), hs: L('High-speed 200', 'हाई-स्पीड 200', 'హై-స్పీడ్ 200'), sl: L('Vande Bharat Sleeper', 'वंदे भारत स्लीपर', 'వందే భారత్ స్లీపర్'), ex: L('Express', 'एक्सप्रेस', 'ఎక్స్‌ప్రెస్') }[m]);
const statusPill = o => o.conf === 'confirmed'
  ? `<span class="pill ok">${ICON.check}${L('Seat held', 'सीट रुकी है', 'సీటు ఆపబడింది')}</span>`
  : `<span class="pill warn">${ICON.clock}${L('Likely', 'संभावित', 'అవకాశం')} ${o.pct}%</span>`;

let proposals = seedProposals();
const today = todayJourney();
let lastPlan = null;

function pendingProposals() { return proposals.filter(p => !S.approved.includes(p.id) && !S.dismissed.includes(p.id)); }
const bookedList = () => S.booked.map(b => ({ ...b, legs: b.legs.map(l => ({ ...l, dep: new Date(l.dep), arr: new Date(l.arr) })) }));

/* ---------- shared pieces ---------- */
function strip(legs) {
  const segs = legs.map(l => Math.max(12, (l.arr - l.dep) / 60000));
  return `<div class="strip" role="img" aria-label="${esc(legs.map(l => modeLabel(l.mode) + ' ' + hm(l.dep)).join(', '))}">` +
    legs.map((l, i) => `<span class="seg k-${l.kind} m-${l.mode}" style="flex:${l.kind === 'tap' ? 6 : segs[i]}"></span>`).join('') + '</div>';
}
function legList(legs, opts = {}) {
  return `<ol class="legs">` + legs.map(l => {
    const ride = l.kind === 'ride';
    const dep = hm(l.dep), arr = hm(l.arr);
    const next = l.arr.getDate() !== l.dep.getDate() ? ` <span class="nextday">${L('next day', 'अगले दिन', 'మరుసటి రోజు')}</span>` : '';
    return `<li class="leg k-${l.kind}${opts.doneUntil && l.arr <= opts.doneUntil ? ' done' : ''}${opts.nowId === l.dep.getTime() ? ' now' : ''}">
      <span class="when">${l.kind === 'tap' ? dep : `${dep}<span class="to"> – ${arr}</span>${next}`}</span>
      <span class="node m-${l.mode}" aria-hidden="true">${MODE_ICON[l.mode] || ''}</span>
      <span class="what"><b>${esc(ride ? modeLabel(l.mode) : modeLabel(l.mode))}</b><span class="route">${esc(l.from)}${l.from !== l.to ? ' → ' + esc(l.to) : ''}</span><span class="sub">${esc(legNote(l))}${l.price ? ' · ' + inr(l.price) : ''}</span></span>
    </li>`;
  }).join('') + '</ol>';
}
function legNote(l) {
  if (l.mode === 'cab') return l.kind === 'door' && /Home/.test(l.from) ? L('Picks you up at your door', 'आपके दरवाज़े से लेगी', 'మీ ఇంటి వద్ద ఎక్కించుకుంటుంది') : L('Waits at the station exit', 'स्टेशन के निकास पर इंतज़ार', 'స్టేషన్ ఎగ్జిట్ వద్ద వేచి ఉంటుంది');
  if (l.mode === 'tap') return L('Palm at the gate, nothing to show', 'गेट पर हथेली, कुछ दिखाना नहीं', 'గేటు వద్ద అరచేయి, ఏమీ చూపక్కర్లేదు');
  return l.note;
}
const total = legs => legs.reduce((s, l) => s + l.price, 0);

/* the proposal card: the one object the whole site is built around */
function proposalCard(p, o = {}) {
  const c = p.choices[p.pick]; const legs = cardLegs(p);
  const title = p.title ? LO(p.title) : `${cn(p.it.from)} → ${cn(p.it.to)}`;
  const out = c.legs; const first = out[0].dep, last = out[out.length - 1].arr;
  const fb = c.o.conf === 'confirmed'
    ? L('If the train is late or cancelled, I rebook the next one at no extra cost and move your cabs. I tell you after.', 'अगर ट्रेन देर से या रद्द हो, तो मैं अगली ट्रेन बिना अतिरिक्त शुल्क बुक कर दूँगी और कैब बदल दूँगी। बाद में आपको बताऊँगी।', 'రైలు ఆలస్యమైనా రద్దైనా, అదనపు ఖర్చు లేకుండా తదుపరి రైలు బుక్ చేసి క్యాబ్‌లు మారుస్తాను. తర్వాత మీకు చెబుతాను.')
    : L('This seat is not certain yet. If it is not confirmed by the chart, you get everything back within 10 minutes and I show the next way.', 'यह सीट अभी पक्की नहीं है। चार्ट तक पक्की न हुई तो 10 मिनट में पूरा पैसा लौट जाएगा और मैं अगला रास्ता दिखाऊँगी।', 'ఈ సీటు ఇంకా ఖాయం కాలేదు. చార్ట్ వరకు ఖాయం కాకపోతే 10 నిమిషాల్లో మొత్తం తిరిగి వస్తుంది, తదుపరి మార్గం చూపిస్తాను.');
  const needsOther = !!p.who;
  const expanded = o.open !== false;
  const id = p.id;
  return `<article class="prop${expanded ? ' open' : ''}" id="prop-${id}" aria-labelledby="pt-${id}" data-id="${id}">
    <header class="prop-h">
      <div><h3 id="pt-${id}">${esc(title)}</h3>
      <p class="prop-sum">${dayName(first)}, ${hm(first)} ${L('leave', 'निकलें', 'బయలుదేరండి')} · ${L('arrive', 'पहुँचें', 'చేరండి')} ${hm(last)} · ${dur(Math.round((last - first) / 60000))}</p></div>
      <div class="prop-price"><strong>${inr(total(legs))}</strong><span>${L('all in', 'सब मिलाकर', 'అన్నీ కలిపి')}</span></div>
    </header>
    ${strip(legs)}
    ${p.why ? `<p class="why">${esc(LO(p.why))}</p>` : ''}
    ${addonHTML(p)}
    <div class="prop-meta">${statusPill(c.o)}<span class="asof">${L('Checked at', 'जाँच का समय', 'తనిఖీ సమయం')} <time>${hm(simNow())}</time></span>
      <span class="hold">${ICON.clock}${L('I hold this seat for 2 hours', 'मैं यह सीट 2 घंटे रोके रखूँगी', 'ఈ సీటును 2 గంటలు ఆపి ఉంచుతాను')}</span></div>
    <details class="how"${expanded && o.details ? ' open' : ''}><summary>${L('See every step and the price', 'हर चरण और कीमत देखें', 'ప్రతి దశ, ధర చూడండి')}</summary>
      ${legList(legs)}
      <p class="fb">${ICON.shield}<span>${fb}</span></p>
      ${needsOther ? `<p class="fb">${ICON.person}<span>${L(p.who + ' approves on their own phone: I call them in Telugu and they say yes. Nothing is booked until they do.', p.who + ' अपने फ़ोन पर मंज़ूरी देंगे/देंगी: मैं तेलुगु में फ़ोन करती हूँ और हाँ कहने तक कुछ बुक नहीं होगा।', p.who + ' తమ ఫోన్‌లో ఆమోదిస్తారు: నేను తెలుగులో ఫోన్ చేస్తాను. వారు ఔను అనే వరకు ఏదీ బుక్ కాదు.')}</span></p>` : ''}
    </details>
    <div class="prop-act" data-act="${id}">
      <button class="btn primary" data-approve="${id}">${L('Approve', 'मंज़ूर करें', 'ఆమోదించండి')} ${inr(total(legs))}</button>
      <button class="btn" data-change="${id}">${L('Change', 'बदलें', 'మార్చండి')}</button>
      <button class="btn quiet" data-dismiss="${id}">${L('Not now', 'अभी नहीं', 'ఇప్పుడు వద్దు')}</button>
      <p class="pay-note">${L('Pays from Savings ending 4821. Free to cancel for 10 minutes.', 'बचत खाते (4821) से भुगतान। 10 मिनट तक रद्द करना मुफ़्त।', 'సేవింగ్స్ (4821) నుండి చెల్లింపు. 10 నిమిషాల వరకు ఉచిత రద్దు.')}</p>
    </div>
    <div class="alts" id="alts-${id}" hidden></div>
  </article>`;
}

const cardLegs = p => p.choices[p.pick].legs.concat(p.retOn && p.ret ? p.ret.choices[0].legs : []);
function addonHTML(p) {
  if (!p.ret) return '';
  const r = p.ret.choices[0]; const l = r.legs; const first = l[0].dep, last = l[l.length - 1].arr;
  return `<label class="addon"><input type="checkbox" data-ret="${p.id}"${p.retOn ? ' checked' : ''}><span><b>${L('Add the way back', 'वापसी भी जोड़ें', 'తిరుగు ప్రయాణం కూడా జోడించండి')}</b> <span class="sub">${dayName(first)}, ${hm(first)} → ${hm(last)} · ${modeLabel(r.o.prod.key)} · ${inr(total(l))}</span></span></label>`;
}
function altsHTML(p) {
  return `<fieldset class="alt-set"><legend>${L('Other ways to go', 'जाने के और तरीके', 'వెళ్లడానికి ఇతర మార్గాలు')}</legend>` + p.choices.map((c, i) => {
    const lbl = c.rank === 'best' ? L('Recommended', 'सुझाया गया', 'సిఫార్సు') : c.rank === 'fastest' ? L('Arrives first', 'सबसे पहले पहुँचे', 'ముందుగా చేరుతుంది') : c.rank === 'cheapest' ? L('Cheapest', 'सबसे सस्ता', 'అతి తక్కువ') : L('Another option', 'एक और विकल्प', 'మరో ఎంపిక');
    const last = c.legs[c.legs.length - 1].arr;
    return `<label class="alt"><input type="radio" name="alt-${p.id}" value="${i}"${i === p.pick ? ' checked' : ''}>
      <span class="alt-b"><b>${lbl}</b> · ${modeLabel(c.o.prod.key)}, ${hm(c.legs[0].dep)} → ${hm(last)}</span>
      <span class="alt-p">${inr(total(c.legs))} · ${c.o.conf === 'confirmed' ? L('seat held', 'सीट रुकी', 'సీటు ఆపబడింది') : L('likely', 'संभावित', 'అవకాశం') + ' ' + c.o.pct + '%'}</span></label>`;
  }).join('') + `</fieldset>`;
}

/* ---------- views ---------- */
function greeting() { const h = simNow().getHours(); return h < 12 ? L('Good morning', 'सुप्रभात', 'శుభోదయం') : h < 17 ? L('Good afternoon', 'नमस्कार', 'శుభ మధ్యాహ్నం') : L('Good evening', 'शुभ संध्या', 'శుభ సాయంత్రం'); }

function askBar(val = '') {
  return `<form class="ask" id="ask-form" role="search" aria-label="${L('Plan a journey', 'यात्रा की योजना', 'ప్రయాణ ప్రణాళిక')}">
    <label for="ask" class="sr">${L('Where do you need to be, and when?', 'आपको कहाँ पहुँचना है, और कब?', 'మీరు ఎక్కడికి, ఎప్పుడు చేరాలి?')}</label>
    <input id="ask" name="q" type="text" autocomplete="off" value="${esc(val)}" placeholder="${esc(L('Where do you need to be?', 'आपको कहाँ पहुँचना है?', 'మీరు ఎక్కడికి చేరాలి?'))}">
    <button type="button" class="mic" id="mic" aria-pressed="false" aria-label="${L('Speak instead of typing', 'टाइप करने की जगह बोलें', 'టైప్ చేయకుండా మాట్లాడండి')}">${ICON.mic}</button>
    <button class="btn primary go" type="submit">${L('Plan it', 'योजना बनाएँ', 'ప్రణాళిక వేయండి')}</button>
  </form>`;
}
function chips() {
  const list = [
    [L('Amma to Tirupati next Monday', 'अगले सोमवार अम्मा को तिरुपति', 'వచ్చే సోమవారం అమ్మను తిరుపతికి'), 'Amma to Tirupati next Monday'],
    [L('Home for Ugadi, two of us', 'उगादी के लिए घर, हम दो', 'ఉగాదికి ఇంటికి, ఇద్దరం'), 'Home to Hyderabad for Ugadi, two of us'],
    [L('Hospital in Chennai, urgent', 'चेन्नई अस्पताल, तुरंत', 'చెన్నై ఆసుపత్రి, అత్యవసరం'), 'Hospital in Chennai, urgent']
  ];
  return `<ul class="chips" aria-label="${L('Examples', 'उदाहरण', 'ఉదాహరణలు')}">` + list.map(([t, q]) => `<li><button class="chip" type="button" data-ask="${esc(q)}">${esc(t)}</button></li>`).join('') + '</ul>';
}

function standingRow(key, title, sub) {
  return `<li class="row"><div><b>${title}</b><span class="sub">${sub}</span></div>
    <label class="switch"><input type="checkbox" data-standing="${key}"${S.standing[key] ? ' checked' : ''}><span class="knob"></span><span class="sr">${title}</span></label></li>`;
}

function todayCard() {
  const n = simNow();
  return `<section class="today" id="today" aria-labelledby="today-h" aria-live="off">
    <h2 id="today-h">${L('Today', 'आज', 'ఈరోజు')}</h2>
    <div id="today-body">${todayBody(n)}</div></section>`;
}
function todayLegs(n) {
  const delayed = n >= today.events[0].at ? 9 : 0;
  return today.legsPlanned.map(l => ({ ...l, dep: addMin(l.dep, delayed), arr: addMin(l.arr, delayed) }));
}
function todayBody(n, full) {
  const legs = todayLegs(n);
  const ev = today.events.filter(e => e.at <= n);
  const nxt = legs.find(l => l.dep > n && l.kind !== 'ride') || legs.find(l => l.dep > n);
  let head;
  if (n < legs[0].dep) head = L('Leave at', 'निकलने का समय', 'బయలుదేరే సమయం') + ' ' + hm(legs[0].dep);
  else if (n < legs[2].dep) head = L('Boarding at', 'बोर्डिंग', 'బోర్డింగ్') + ' ' + hm(legs[2].dep) + ' · ' + today.platform;
  else if (n < legs[2].arr) head = L('On the train', 'ट्रेन में', 'రైలులో') + ' · ' + L('arrive', 'पहुँचें', 'చేరండి') + ' ' + hm(legs[2].arr);
  else head = L('Arrived', 'पहुँच गए', 'చేరుకున్నారు');
  const mins = Math.max(0, Math.round((legs[0].dep - n) / 60000));
  const count = n < legs[0].dep ? `<p class="count"><b id="cnt-n">${mins}</b> ${L('minutes until your cab', 'मिनट में आपकी कैब', 'నిమిషాల్లో మీ క్యాబ్')}</p>` : '';
  const feed = `<ul class="feed" aria-label="${L('What I did for you', 'मैंने आपके लिए क्या किया', 'నేను మీ కోసం ఏమి చేశాను')}">${ev.slice().reverse().map(e => `<li><time>${hm(e.at)}</time>${LO(e.t)}</li>`).join('') || `<li class="empty">${L('Nothing needs you. I am watching the train.', 'आपको कुछ नहीं करना। मैं ट्रेन पर नज़र रखे हूँ।', 'మీరు ఏమీ చేయనవసరం లేదు. రైలును గమనిస్తున్నాను.')}</li>`}</ul>`;
  const steps = full ? legList(legs, { doneUntil: n }) : `<details class="how"><summary>${L('See every step', 'हर चरण देखें', 'ప్రతి దశ చూడండి')}</summary>${legList(legs, { doneUntil: n })}</details>`;
  return `<p class="today-t">${LO(today.title)}</p>
    <p class="today-h" id="today-head">${head}</p>${count}
    <p class="seat">${today.seat} · ${modeLabel('hs')}</p>
    ${feed}${strip(legs)}${steps}`;
}

function viewHome() {
  const pend = pendingProposals();
  const standing = [
    standingRow('fri', L('Every Friday evening, Bengaluru to Hyderabad', 'हर शुक्रवार शाम, बेंगलुरु से हैदराबाद', 'ప్రతి శుక్రవారం సాయంత్రం, బెంగళూరు నుండి హైదరాబాద్'), L('Booked 7 days ahead, up to ₹2,200. You can skip any week.', '7 दिन पहले बुक, ₹2,200 तक। आप कोई भी हफ़्ता छोड़ सकते हैं।', '7 రోజుల ముందు బుక్, ₹2,200 వరకు. ఏ వారమైనా వదిలేయవచ్చు.')),
    standingRow('appa', L("Appa's check-up, every month", 'अप्पा की जाँच, हर महीने', 'నాన్న చెకప్, ప్రతి నెల'), L('I ask him and you first. Senior concession, station helper.', 'पहले उनसे और आपसे पूछती हूँ। वरिष्ठ रियायत, स्टेशन सहायक।', 'ముందుగా ఆయనను, మిమ్మల్ని అడుగుతాను. సీనియర్ రాయితీ, స్టేషన్ సహాయకుడు.')),
  ].join('');
  return `<div class="home">
    <section class="intro"><h1 id="page-h" tabindex="-1">${greeting()}, ${NAME}.</h1>
      <p class="date">${dayLong(simNow())}</p>
      ${askBar()}${chips()}<p class="status" id="ask-status" role="status"></p></section>
    <div class="cols">
      <div class="main">
        <section aria-labelledby="yes-h"><h2 id="yes-h">${L('Needs your yes', 'आपकी हाँ चाहिए', 'మీ ఆమోదం కావాలి')} <span class="count-b">${pend.length}</span></h2>
          ${pend.length ? pend.map((p, i) => proposalCard(p, { open: true, details: false })).join('') : `<p class="empty">${L('Nothing is waiting for you. I will tell you when something needs a yes.', 'आपकी हाँ का इंतज़ार कुछ नहीं है। ज़रूरत होगी तो बताऊँगी।', 'మీ ఆమోదం కోసం ఏదీ వేచి లేదు. అవసరమైతే చెబుతాను.')}</p>`}
        </section>
        <section aria-labelledby="stand-h"><h2 id="stand-h">${L('Arranged for you', 'आपके लिए तय', 'మీ కోసం ఏర్పాటు')}</h2>
          <ul class="rows">${standing}</ul>
          <p class="more"><a href="#/controls">${L('Change what I may do on my own', 'मैं अपने आप क्या कर सकती हूँ, बदलें', 'నేను స్వయంగా ఏమి చేయగలనో మార్చండి')}</a></p></section>
      </div>
      <aside class="side">${todayCard()}</aside>
    </div></div>`;
}

function viewPlan(q) {
  const it = parseAsk(q);
  if (it.lang && it.lang !== S.lang) { S.lang = it.lang; save(); setLang(); }
  const need = [];
  if (!it.to) need.push('to');
  const head = `<div class="plan-top"><h1 id="page-h" tabindex="-1">${L('Your journey', 'आपकी यात्रा', 'మీ ప్రయాణం')}</h1>${askBar(q)}<p class="status" id="ask-status" role="status"></p></div>`;
  if (need.length) {
    return `<div class="plan">${head}<section class="clar" aria-labelledby="cl-h"><h2 id="cl-h">${L('Where do you want to go?', 'आप कहाँ जाना चाहते हैं?', 'మీరు ఎక్కడికి వెళ్లాలనుకుంటున్నారు?')}</h2>
      <p>${L('I could not find a city in what you said. Pick one, or say it again.', 'आपके वाक्य में शहर नहीं मिला। एक चुनें, या दोबारा बोलें।', 'మీరు చెప్పినదాంట్లో నగరం కనిపించలేదు. ఒకటి ఎంచుకోండి లేదా మళ్లీ చెప్పండి.')}</p>
      <ul class="chips">${Object.keys(CITIES).filter(k => k !== HOME_CITY).slice(0, 8).map(k => `<li><button class="chip" data-ask="${esc(q + ' to ' + CITIES[k].n)}">${cn(k)}</button></li>`).join('')}</ul></section></div>`;
  }
  if (it.from === it.to) it.from = it.to === HOME_CITY ? FAMILY_CITY : HOME_CITY;
  const assumed = !it.date;
  it.destLabel = it.purpose === 'urgent' ? L('Hospital, ', 'अस्पताल, ', 'ఆసుపత్రి, ') + cn(it.to) : it.purpose === 'wedding' ? L('Wedding hall, ', 'विवाह स्थल, ', 'పెళ్లి మందిరం, ') + cn(it.to) : (cn(it.to));
  if (it.elder && /amma|appa|mom|mother|dad|father/i.test(q)) it.who = /appa|dad|father/i.test(q) ? 'Appa' : 'Amma';
  const p = buildProposal(it, 'plan');
  lastPlan = p;
  if (it.elder) p.choices.forEach(c => { const r = c.legs.find(l => l.kind === 'ride'); const cut = Math.round(r.price * 0.4); r.price -= cut; r.note += ', senior concession'; });
  p.title = { en: `${CITIES[it.from].n} to ${CITIES[it.to].n}${it.who ? ' for ' + it.who : ''}`, hi: `${cn(it.from)} से ${cn(it.to)}${it.who ? ', ' + it.who : ''}`, te: `${cn(it.from)} నుండి ${cn(it.to)}${it.who ? ', ' + it.who : ''}` };
  p.who = it.who || null;
  const cityOpts = sel => Object.keys(CITIES).map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${cn(k)}</option>`).join('');
  const bits = [
    `${cn(it.from)} → ${cn(it.to)}`,
    it.date ? dayName(it.date) : dayName(addMin(startOfDay(SIM0), 1440)) + ' (' + L('assumed', 'अनुमान', 'అంచనా') + ')',
    it.pax === 1 ? L('1 traveller', '1 यात्री', '1 ప్రయాణికుడు') : it.pax + ' ' + L('travellers', 'यात्री', 'ప్రయాణికులు'),
  ];
  p.why = { en: (it.urgent ? 'The soonest seat that is already confirmed. I looked at the live seat count at ' + hm(simNow()) + '.' : 'The best confirmed seat for what you said.') + (assumed ? ' You did not say when, so I assumed tomorrow. Change it below if that is wrong.' : '') + (p.who ? ' Booked in ' + p.who + "'s name. " + p.who + ' approves on their own phone first.' : ''), hi: (it.urgent ? 'सबसे जल्दी मिलने वाली पक्की सीट। मैंने ' + hm(simNow()) + ' पर सीटों की स्थिति देखी।' : 'आपके बताए अनुसार सबसे अच्छी पक्की सीट।') + (assumed ? ' आपने समय नहीं बताया, इसलिए मैंने कल मान लिया। गलत हो तो नीचे बदलें।' : ''), te: (it.urgent ? 'ఇప్పటికే ఖాయమైన అత్యంత త్వరిత సీటు. ' + hm(simNow()) + 'కి సీట్ల స్థితి చూశాను.' : 'మీరు చెప్పినదానికి ఉత్తమ ఖాయమైన సీటు.') + (assumed ? ' మీరు ఎప్పుడో చెప్పలేదు, కాబట్టి రేపు అనుకున్నాను. తప్పైతే క్రింద మార్చండి.' : '') };
  const dateVal = (it.date || addMin(startOfDay(SIM0), 1440)); const iso = `${dateVal.getFullYear()}-${p2(dateVal.getMonth() + 1)}-${p2(dateVal.getDate())}`;
  const rec = it.recurring ? `<section class="recur" aria-labelledby="rc-h"><h2 id="rc-h">${L('Make this a standing arrangement', 'इसे स्थायी व्यवस्था बनाएँ', 'దీన్ని స్థిర ఏర్పాటుగా చేయండి')}</h2><p>${L('I book it 7 days ahead and tell you. You can skip any week, and I stop the moment you say.', 'मैं 7 दिन पहले बुक करूँगी और आपको बताऊँगी। आप कोई भी हफ़्ता छोड़ सकते हैं।', 'నేను 7 రోజుల ముందు బుక్ చేసి మీకు చెబుతాను. ఏ వారమైనా వదిలేయవచ్చు.')}</p><button class="btn" id="make-standing">${L('Yes, repeat it', 'हाँ, दोहराएँ', 'అవును, పునరావృతం చేయండి')}</button></section>` : '';
  return `<div class="plan">${head}
    <p class="assume">
      <label class="fld"><span>${L('From', 'कहाँ से', 'ఎక్కడి నుండి')}</span><select id="plan-from">${cityOpts(it.from)}</select></label>
      <label class="fld"><span>${L('To', 'कहाँ तक', 'ఎక్కడికి')}</span><select id="plan-to">${cityOpts(it.to)}</select></label>
      <label class="fld"><span>${L('Date', 'तारीख़', 'తేదీ')}</span><input type="date" id="plan-date" value="${iso}" min="2036-02-12"></label>
      <label class="fld"><span>${L('Travellers', 'यात्री', 'ప్రయాణికులు')}</span><select id="plan-pax">${[1, 2, 3, 4].map(n => `<option${n === it.pax ? ' selected' : ''}>${n}</option>`).join('')}</select></label>${assumed ? `<span class="assumed">${L('You did not say when, so I assumed tomorrow.', 'आपने समय नहीं बताया, मैंने कल मान लिया।', 'మీరు ఎప్పుడో చెప్పలేదు, రేపు అనుకున్నాను.')}</span>` : ''}</p>
    <div id="plan-card" aria-busy="true"><div class="skeleton" aria-hidden="true"><i></i><i></i><i></i></div></div>${rec}</div>`;
}

function viewJourneys() {
  const booked = bookedList();
  const rows = [];
  rows.push({ id: 'today', t: LO(today.title), d: startOfDay(SIM0), s: L('Today, in progress', 'आज, जारी', 'ఈరోజు, కొనసాగుతోంది'), pr: 1500, k: 'live' });
  booked.forEach(b => rows.push({ id: b.id, t: LO(b.title) || b.title, d: new Date(b.legs[0].dep), s: L('Confirmed', 'पक्का', 'ఖాయం'), pr: b.price, k: 'ok' }));
  const past = [
    { t: L('Hyderabad to Bengaluru', 'हैदराबाद से बेंगलुरु', 'హైదరాబాద్ నుండి బెంగళూరు'), d: new Date(2036, 1, 9), pr: 1310 },
    { t: L('Bengaluru to Hyderabad', 'बेंगलुरु से हैदराबाद', 'బెంగళూరు నుండి హైదరాబాద్'), d: new Date(2036, 1, 7), pr: 1310 },
    { t: L('Bengaluru to Chennai, for work', 'बेंगलुरु से चेन्नई, काम के लिए', 'బెంగళూరు నుండి చెన్నై, పని కోసం'), d: new Date(2036, 0, 29), pr: 1500 },
  ];
  const pend = pendingProposals();
  const tr = r => `<tr><th scope="row">${r.id ? `<a href="#/journey/${r.id}">${esc(r.t)}</a>` : esc(r.t)}</th><td>${dayName(r.d)}</td><td>${r.s ? `<span class="pill ${r.k === 'live' ? 'live' : 'ok'}">${esc(r.s)}</span>` : L('Completed', 'पूरा हुआ', 'పూర్తయింది')}</td><td class="num">${inr(r.pr)}</td></tr>`;
  return `<div class="page"><h1 id="page-h" tabindex="-1">${L('Journeys', 'यात्राएँ', 'ప్రయాణాలు')}</h1>
    ${pend.length ? `<p class="callout"><b>${pend.length}</b> ${L('waiting for your yes.', 'आपकी हाँ का इंतज़ार।', 'మీ ఆమోదం కోసం వేచి ఉన్నాయి.')} <a href="#/">${L('Open', 'खोलें', 'తెరవండి')}</a></p>` : ''}
    <table class="tbl"><caption class="sr">${L('Your journeys', 'आपकी यात्राएँ', 'మీ ప్రయాణాలు')}</caption>
      <thead><tr><th scope="col">${L('Journey', 'यात्रा', 'ప్రయాణం')}</th><th scope="col">${L('Date', 'तारीख़', 'తేదీ')}</th><th scope="col">${L('Status', 'स्थिति', 'స్థితి')}</th><th scope="col" class="num">${L('Paid', 'भुगतान', 'చెల్లింపు')}</th></tr></thead>
      <tbody>${rows.map(tr).join('')}${past.map(tr).join('')}</tbody></table></div>`;
}

function viewJourney(id) {
  if (id === 'today') {
    const n = simNow();
    return `<div class="page narrow"><p class="crumb"><a href="#/journeys">${L('Journeys', 'यात्राएँ', 'ప్రయాణాలు')}</a></p><h1 id="page-h" tabindex="-1">${LO(today.title)}</h1><div class="panel" id="today-body">${todayBody(n, true)}</div>${walkonPanel()}</div>`;
  }
  const b = bookedList().find(x => x.id === id);
  if (!b) return `<div class="page narrow"><h1 id="page-h" tabindex="-1">${L('Journey not found', 'यात्रा नहीं मिली', 'ప్రయాణం కనబడలేదు')}</h1><p><a href="#/journeys">${L('Back to journeys', 'यात्राओं पर लौटें', 'ప్రయాణాలకు తిరిగి వెళ్లండి')}</a></p></div>`;
  const first = b.legs[0].dep, last = b.legs[b.legs.length - 1].arr;
  return `<div class="page narrow"><p class="crumb"><a href="#/journeys">${L('Journeys', 'यात्राएँ', 'ప్రయాణాలు')}</a></p>
    <h1 id="page-h" tabindex="-1">${esc(LO(b.title) || b.title)}</h1>
    <p class="done-b"><span class="pill ok">${ICON.check}${L('Booked', 'बुक हो गया', 'బుక్ అయింది')}</span> ${dayLong(first)}, ${hm(first)} → ${hm(last)} · ${inr(b.price)}</p>
    <div class="panel">${strip(b.legs)}${legList(b.legs)}
      <p class="fb">${ICON.shield}<span>${L('Nothing more to do. I watch the train, and if anything changes I fix it and tell you. You can undo any change for 10 minutes.', 'अब कुछ करना नहीं है। मैं ट्रेन पर नज़र रखूँगी, कुछ बदला तो ठीक करके बताऊँगी। किसी भी बदलाव को 10 मिनट तक पलट सकते हैं।', 'ఇక ఏమీ చేయనవసరం లేదు. రైలును గమనిస్తాను, ఏదైనా మారితే సరిచేసి చెబుతాను. ఏ మార్పునైనా 10 నిమిషాల వరకు రద్దు చేయవచ్చు.')}</span></p></div>
    <div class="btn-row"><button class="btn" data-share>${L('Share with family', 'परिवार को भेजें', 'కుటుంబంతో పంచుకోండి')}</button><button class="btn" data-cancel="${b.id}">${L('Cancel (free for 10 minutes)', 'रद्द करें (10 मिनट तक मुफ़्त)', 'రద్దు (10 నిమిషాల వరకు ఉచితం)')}</button></div></div>`;
}

function walkonPanel() {
  return `<section class="panel" aria-labelledby="wk-h"><h2 id="wk-h">${L('Your pass', 'आपका पास', 'మీ పాస్')}</h2>
    <p>${L('Your palm is your ticket. At the gate, hold your hand over the reader. Works offline too.', 'आपकी हथेली ही आपका टिकट है। गेट पर रीडर के ऊपर हाथ रखें। ऑफ़लाइन भी चलता है।', 'మీ అరచేయే మీ టికెట్. గేటు వద్ద రీడర్ పై చేయి ఉంచండి. ఆఫ్‌లైన్‌లోనూ పనిచేస్తుంది.')}</p>
    <button class="btn" id="tap-sim" aria-describedby="tap-out">${ICON.tap}${L('Try the gate', 'गेट आज़माएँ', 'గేటు ప్రయత్నించండి')}</button><p id="tap-out" class="status" role="status"></p></section>`;
}

function viewPasses() {
  return `<div class="page narrow"><h1 id="page-h" tabindex="-1">${L('Passes', 'पास', 'పాస్‌లు')}</h1>
    ${walkonPanel()}
    <section class="panel" aria-labelledby="walk-h"><h2 id="walk-h">${L('Walk-on trains', 'वॉक-ऑन ट्रेनें', 'వాక్-ఆన్ రైళ్లు')}</h2>
      <p>${L('Short trips need no booking. Tap in, tap out, and I charge the fare at the end of the day, never more than ₹110 a day on this line.', 'छोटी यात्राओं के लिए बुकिंग नहीं चाहिए। अंदर टैप करें, बाहर टैप करें, किराया दिन के अंत में लगेगा, इस लाइन पर ₹110 प्रतिदिन से ज़्यादा नहीं।', 'చిన్న ప్రయాణాలకు బుకింగ్ అవసరం లేదు. లోపల ట్యాప్, బయట ట్యాప్, రోజు చివరన ఛార్జీ, ఈ లైన్‌లో రోజుకు ₹110 కంటే ఎక్కువ కాదు.')}</p></section>
    <section class="panel" aria-labelledby="fam-h"><h2 id="fam-h">${L('People I can book for', 'जिनके लिए मैं बुक कर सकती हूँ', 'నేను ఎవరి కోసం బుక్ చేయగలను')}</h2>
      <table class="tbl"><thead><tr><th scope="col">${L('Person', 'व्यक्ति', 'వ్యక్తి')}</th><th scope="col">${L('Language', 'भाषा', 'భాష')}</th><th scope="col">${L('Help on the journey', 'यात्रा में मदद', 'ప్రయాణంలో సహాయం')}</th><th scope="col">${L('Concession', 'रियायत', 'రాయితీ')}</th></tr></thead><tbody>
        <tr><th scope="row">Appa</th><td>తెలుగు</td><td>${L('Station helper, lower berth', 'स्टेशन सहायक, निचली बर्थ', 'స్టేషన్ సహాయకుడు, కింది బెర్త్')}</td><td>${L('Senior, 40% off', 'वरिष्ठ, 40% छूट', 'సీనియర్, 40% తగ్గింపు')}</td></tr>
        <tr><th scope="row">Amma</th><td>తెలుగు</td><td>${L('Station helper, wheelchair at gate', 'स्टेशन सहायक, गेट पर व्हीलचेयर', 'స్టేషన్ సహాయకుడు, గేటు వద్ద వీల్‌చైర్')}</td><td>${L('Senior, 40% off', 'वरिष्ठ, 40% छूट', 'సీనియర్, 40% తగ్గింపు')}</td></tr>
        <tr><th scope="row">Sneha</th><td>English</td><td>${L('None needed', 'ज़रूरत नहीं', 'అవసరం లేదు')}</td><td>${L('None', 'कोई नहीं', 'ఏదీ లేదు')}</td></tr></tbody></table></section></div>`;
}

function viewControls() {
  const levels = [
    ['ask', L('Ask me every time', 'हर बार मुझसे पूछें', 'ప్రతిసారీ నన్ను అడగండి'), L('I plan, you approve each booking and each change.', 'मैं योजना बनाती हूँ, हर बुकिंग और बदलाव पर आप मंज़ूरी देते हैं।', 'నేను ప్రణాళిక వేస్తాను, ప్రతి బుకింగ్, మార్పును మీరు ఆమోదిస్తారు.')],
    ['big', L('Ask me only for big things', 'सिर्फ़ बड़ी बातों पर पूछें', 'పెద్ద విషయాలకే అడగండి'), L('I fix delays on my own. I ask before a new booking, a change of day, or anything over your limit.', 'देरी मैं खुद सुलझाती हूँ। नई बुकिंग, तारीख़ बदलने या आपकी सीमा से ऊपर की बात पर पूछती हूँ।', 'ఆలస్యాలను నేనే సరిచేస్తాను. కొత్త బుకింగ్, తేదీ మార్పు, మీ పరిమితి దాటితే అడుగుతాను.')],
    ['handle', L('Handle it within my limit', 'मेरी सीमा में खुद संभालें', 'నా పరిమితిలో మీరే చూసుకోండి'), L('I book standing arrangements and rebook cancelled trains up to your limit, and tell you after.', 'स्थायी व्यवस्थाएँ बुक करती हूँ और रद्द ट्रेनें आपकी सीमा तक दोबारा बुक करती हूँ, बाद में बताती हूँ।', 'స్థిర ఏర్పాట్లను బుక్ చేసి, రద్దైన రైళ్లను మీ పరిమితి వరకు మళ్లీ బుక్ చేసి, తర్వాత చెబుతాను.')],
  ];
  const src = [['calendar', L('Calendar', 'कैलेंडर', 'క్యాలెండర్'), L('So I can see when you need to be somewhere.', 'ताकि मैं देख सकूँ कि आपको कब कहाँ पहुँचना है।', 'మీరు ఎప్పుడు ఎక్కడ ఉండాలో నేను చూడగలగడానికి.')], ['mail', L('Invitations in email', 'ईमेल में निमंत्रण', 'ఈమెయిల్‌లో ఆహ్వానాలు'), L('Weddings, interviews and bookings. I read nothing else.', 'शादी, इंटरव्यू और बुकिंग। इसके अलावा कुछ नहीं पढ़ती।', 'పెళ్లిళ్లు, ఇంటర్వ్యూలు, బుకింగ్‌లు. మరేదీ చదవను.')], ['location', L('Where you are right now', 'आप अभी कहाँ हैं', 'మీరు ఇప్పుడు ఎక్కడ ఉన్నారు'), L('Off. I will ask each time instead.', 'बंद। मैं हर बार पूछूँगी।', 'ఆఫ్. ప్రతిసారీ అడుగుతాను.')]];
  return `<div class="page narrow"><h1 id="page-h" tabindex="-1">${L('Your controls', 'आपके नियंत्रण', 'మీ నియంత్రణలు')}</h1>
    <section class="panel" aria-labelledby="au-h"><h2 id="au-h">${L('What I may do on my own', 'मैं अपने आप क्या कर सकती हूँ', 'నేను స్వయంగా ఏమి చేయగలను')}</h2>
      <fieldset class="dial"><legend class="sr">${L('How much I do on my own', 'मैं कितना खुद करूँ', 'నేను ఎంత స్వయంగా చేయాలి')}</legend>${levels.map(([k, t, d]) => `<label class="dial-o"><input type="radio" name="au" value="${k}"${S.autonomy === k ? ' checked' : ''}><span><b>${t}</b><span class="sub">${d}</span></span></label>`).join('')}</fieldset>
      <label class="fld wide"><span>${L('Never spend more than this on one trip without asking', 'पूछे बिना एक यात्रा पर इससे ज़्यादा खर्च नहीं', 'అడగకుండా ఒక ప్రయాణంపై దీనికంటే ఎక్కువ ఖర్చు చేయవద్దు')}</span><select id="cap">${[1500, 3000, 5000, 10000].map(v => `<option value="${v}"${S.cap === v ? ' selected' : ''}>${inr(v)}</option>`).join('')}</select></label></section>
    <section class="panel" aria-labelledby="sr-h"><h2 id="sr-h">${L('What I may look at', 'मैं क्या देख सकती हूँ', 'నేను ఏమి చూడవచ్చు')}</h2>
      <ul class="rows">${src.map(([k, t, d]) => `<li class="row"><div><b>${t}</b><span class="sub">${d}</span></div><label class="switch"><input type="checkbox" data-src="${k}"${S.src[k] ? ' checked' : ''}><span class="knob"></span><span class="sr">${t}</span></label></li>`).join('')}</ul></section>
    <section class="panel" aria-labelledby="ds-h"><h2 id="ds-h">${L('Language and display', 'भाषा और दिखावट', 'భాష, ప్రదర్శన')}</h2>
      <div class="fld-row"><label class="fld"><span>${L('Language', 'भाषा', 'భాష')}</span><select id="set-lang"><option value="en"${S.lang === 'en' ? ' selected' : ''}>English</option><option value="hi"${S.lang === 'hi' ? ' selected' : ''}>हिन्दी</option><option value="te"${S.lang === 'te' ? ' selected' : ''}>తెలుగు</option></select></label>
      <label class="fld"><span>${L('Text size', 'अक्षर का आकार', 'అక్షర పరిమాణం')}</span><select id="set-scale"><option value="1"${S.scale === 1 ? ' selected' : ''}>${L('Normal', 'सामान्य', 'సాధారణం')}</option><option value="1.2"${S.scale === 1.2 ? ' selected' : ''}>${L('Large', 'बड़ा', 'పెద్దది')}</option><option value="1.4"${S.scale === 1.4 ? ' selected' : ''}>${L('Largest', 'सबसे बड़ा', 'అతి పెద్దది')}</option></select></label>
      <label class="fld"><span>${L('Colours', 'रंग', 'రంగులు')}</span><select id="set-theme"><option value="auto"${S.theme === 'auto' ? ' selected' : ''}>${L('Follow my device', 'मेरे डिवाइस जैसा', 'నా పరికరం ప్రకారం')}</option><option value="light"${S.theme === 'light' ? ' selected' : ''}>${L('Light', 'हल्का', 'లైట్')}</option><option value="dark"${S.theme === 'dark' ? ' selected' : ''}>${L('Dark', 'गहरा', 'డార్క్')}</option><option value="contrast"${S.theme === 'contrast' ? ' selected' : ''}>${L('High contrast', 'उच्च कंट्रास्ट', 'అధిక కాంట్రాస్ట్')}</option></select></label></div></section>
    <section class="panel" aria-labelledby="lg-h"><h2 id="lg-h">${L('What I did for you', 'मैंने आपके लिए क्या किया', 'నేను మీ కోసం ఏమి చేశాను')}</h2>
      <ul class="feed">${(S.log.length ? S.log : []).slice(0, 8).map(e => `<li><time>${esc(e.t)}</time>${esc(e.m)}</li>`).join('') || `<li class="empty">${L('Nothing yet. Everything I do is listed here, with a way to undo it.', 'अभी कुछ नहीं। मैं जो भी करती हूँ यहाँ दिखेगा, पलटने के तरीके के साथ।', 'ఇంకా ఏమీ లేదు. నేను చేసేదంతా ఇక్కడ కనిపిస్తుంది, రద్దు చేసే మార్గంతో.')}</li>`}</ul></section></div>`;
}

/* ---------- router ---------- */
const app = $('#app');
function route() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?'); const parts = path.split('/').filter(Boolean);
  let html, nav = '/';
  if (!parts.length) html = viewHome();
  else if (parts[0] === 'plan') { html = viewPlan(decodeURIComponent((new URLSearchParams(qs || '')).get('q') || '')); nav = '/'; }
  else if (parts[0] === 'journeys') { html = viewJourneys(); nav = '/journeys'; }
  else if (parts[0] === 'journey') { html = viewJourney(parts[1]); nav = '/journeys'; }
  else if (parts[0] === 'passes') { html = viewPasses(); nav = '/passes'; }
  else if (parts[0] === 'controls') { html = viewControls(); nav = '/controls'; }
  else html = viewHome();
  app.innerHTML = html;
  $$('.nav a').forEach(a => a.removeAttribute('aria-current')); const cur = $(`.nav a[data-r="${nav}"]`); if (cur) cur.setAttribute('aria-current', 'page');
  document.title = ($('#page-h') ? $('#page-h').textContent + ' · ' : '') + 'IRCTC';
  if (parts[0] === 'plan') mountPlan();
  window.scrollTo(0, 0);
  const hh = $('#page-h'); if (hh && (parts.length || window.__focusH)) hh.focus({ preventScroll: true });
  window.__focusH = true;
}
function mountPlan() {
  const slot = $('#plan-card'); if (!slot || !lastPlan) return;
  setTimeout(() => {
    if (!slot.isConnected) return;
    slot.setAttribute('aria-busy', 'false');
    slot.innerHTML = proposalCard(lastPlan, { open: true, details: true });
    $('#ask-status') && ($('#ask-status').textContent = L('Here is your plan. Nothing is booked yet.', 'यह रही आपकी योजना। अभी कुछ बुक नहीं हुआ।', 'ఇదిగో మీ ప్రణాళిక. ఇంకా ఏదీ బుక్ కాలేదు.'));
    const alts = $('#alts-plan'); if (alts) { alts.innerHTML = altsHTML(lastPlan); }
  }, 650);
}

/* ---------- actions ---------- */
function say(msg) { const r = $('#live'); r.textContent = ''; setTimeout(() => r.textContent = msg, 30); }
function logEv(m) { S.log.unshift({ t: hm(simNow()), m }); S.log = S.log.slice(0, 30); }
function findProposal(id) { return id === 'plan' ? lastPlan : proposals.find(p => p.id === id); }

function approve(id) {
  const p = findProposal(id); if (!p) return;
  const card = $('#prop-' + id); const act = card.querySelector('.prop-act'); const c = p.choices[p.pick];
  act.innerHTML = `<ol class="stages" aria-live="polite"><li class="on">${L('Holding your seat', 'आपकी सीट रोकी जा रही है', 'మీ సీటును ఆపుతున్నాము')}</li><li>${L('Confirming with the railway', 'रेलवे से पुष्टि', 'రైల్వేతో నిర్ధారణ')}</li><li>${L('Issuing your pass', 'आपका पास जारी हो रहा है', 'మీ పాస్ జారీ అవుతోంది')}</li></ol>`;
  const lis = $$('.stages li', act); let i = 0;
  const step = () => { if (i > 0) lis[i - 1].classList.replace('on', 'done'); if (i < lis.length) { lis[i].classList.add('on'); i++; setTimeout(step, 750); } else finish(); };
  const finish = () => {
    const bid = 'b' + Date.now().toString(36);
    const all = cardLegs(p); const entry = { id: bid, title: p.title ? p.title : { en: `${cn(p.it.from)} → ${cn(p.it.to)}` }, price: total(all), legs: all.map(l => ({ ...l, dep: l.dep.toISOString(), arr: l.arr.toISOString() })) };
    S.booked.unshift(entry); if (id !== 'plan') S.approved.push(id); logEv(L('Booked: ', 'बुक हुआ: ', 'బుక్ అయింది: ') + LO(entry.title)); save();
    act.innerHTML = `<p class="booked">${ICON.check}<span><b>${L('Booked.', 'बुक हो गया।', 'బుక్ అయింది.')}</b> ${L('Your pass is on your palm. There is nothing more to do.', 'आपका पास आपकी हथेली पर है। अब कुछ करना नहीं है।', 'మీ పాస్ మీ అరచేతిలో ఉంది. ఇక ఏమీ చేయనవసరం లేదు.')} <a href="#/journey/${bid}">${L('Open the journey', 'यात्रा खोलें', 'ప్రయాణాన్ని తెరవండి')}</a></span></p>`;
    say(L('Booked.', 'बुक हो गया।', 'బుక్ అయింది.'));
    if (id !== 'plan') { const cnt = $('.count-b'); if (cnt) cnt.textContent = pendingProposals().length; }
  };
  step();
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button, a'); if (!t) return;
  if (t.dataset.approve) approve(t.dataset.approve);
  else if (t.dataset.dismiss) { const id = t.dataset.dismiss; if (id !== 'plan') { S.dismissed.push(id); save(); } const el = $('#prop-' + id); if (el) el.remove(); const cnt = $('.count-b'); if (cnt) cnt.textContent = pendingProposals().length; say(L('Set aside. You can ask again any time.', 'अलग रख दिया। आप कभी भी फिर पूछ सकते हैं।', 'పక్కన పెట్టాను. ఎప్పుడైనా మళ్లీ అడగవచ్చు.')); }
  else if (t.dataset.change) { const a = $('#alts-' + t.dataset.change); if (a) { if (a.hidden) { a.innerHTML = altsHTML(findProposal(t.dataset.change)); a.hidden = false; const f = a.querySelector('input:checked'); f && f.focus(); } else a.hidden = true; } }
  else if (t.dataset.ask) { $('#ask') ? ($('#ask').value = t.dataset.ask) : 0; go(t.dataset.ask); }
  else if (t.id === 'make-standing') { S.standing.fri = true; logEv(L('Standing arrangement created', 'स्थायी व्यवस्था बनी', 'స్థిర ఏర్పాటు సృష్టించబడింది')); save(); t.textContent = L('Done. See it on Home.', 'हो गया। होम पर देखें।', 'పూర్తైంది. హోమ్‌లో చూడండి.'); t.disabled = true; say(L('Standing arrangement saved', 'स्थायी व्यवस्था सहेजी गई', 'స్థిర ఏర్పాటు సేవ్ అయింది')); }
  else if (t.dataset.share !== undefined) { say(L('Shared with Amma and Appa by voice message in Telugu.', 'अम्मा और अप्पा को तेलुगु में वॉइस संदेश भेजा।', 'అమ్మ, నాన్నకు తెలుగులో వాయిస్ సందేశం పంపాను.')); t.textContent = L('Shared with Amma and Appa', 'अम्मा और अप्पा को भेजा', 'అమ్మ, నాన్నకు పంపాను'); }
  else if (t.dataset.cancel) { S.booked = S.booked.filter(b => b.id !== t.dataset.cancel); logEv(L('Cancelled, full refund', 'रद्द, पूरा पैसा वापस', 'రద్దు, పూర్తి వాపసు')); save(); location.hash = '#/journeys'; say(L('Cancelled. Full refund to Savings ending 4821.', 'रद्द। बचत खाते 4821 में पूरा पैसा वापस।', 'రద్దు. సేవింగ్స్ 4821కి పూర్తి వాపసు.')); }
  else if (t.id === 'tap-sim') { const o = $('#tap-out'); const n = simNow(); o.textContent = L(`Gate opened at ${hm(n)}. Palm recognised, no ticket needed. Welcome aboard.`, `${hm(n)} पर गेट खुला। हथेली पहचानी गई, टिकट नहीं चाहिए। शुभ यात्रा।`, `${hm(n)}కి గేటు తెరుచుకుంది. అరచేయి గుర్తించబడింది, టికెట్ అవసరం లేదు. శుభ ప్రయాణం.`); }
  else if (t.id === 'help-btn') openHelp();
  else if (t.id === 'mic') toggleMic(t);
  else if (t.dataset.close !== undefined) $('#help').close();
});
document.addEventListener('submit', e => { if (e.target.id === 'ask-form') { e.preventDefault(); const v = $('#ask').value.trim(); if (!v) { const s = $('#ask-status'); s.textContent = L('Tell me where you need to be, for example: Hyderabad on Friday evening.', 'बताइए आपको कहाँ पहुँचना है, जैसे: शुक्रवार शाम हैदराबाद।', 'మీరు ఎక్కడికి చేరాలో చెప్పండి, ఉదా: శుక్రవారం సాయంత్రం హైదరాబాద్.'); $('#ask').focus(); return; } go(v); } });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.name && t.name.startsWith('alt-')) { const p = findProposal(t.name.slice(4)); p.pick = +t.value; const card = $('#prop-' + p.id); const open = $('.how', card).open; card.outerHTML = proposalCard(p, { open: true, details: open }); const a = $('#alts-' + p.id); a.innerHTML = altsHTML(p); a.hidden = false; $('input:checked', a).focus(); }
  else if (t.dataset.ret) { const p = findProposal(t.dataset.ret); p.retOn = t.checked; const card = $('#prop-' + p.id); const open = $('.how', card).open; card.outerHTML = proposalCard(p, { open: true, details: open }); const nb = $('#prop-' + p.id + ' input[data-ret]'); nb && nb.focus(); say(t.checked ? L('Return added', 'वापसी जोड़ी गई', 'తిరుగు ప్రయాణం జోడించబడింది') : L('Return removed', 'वापसी हटाई गई', 'తిరుగు ప్రయాణం తీసివేయబడింది')); }
  else if (t.dataset.standing) { S.standing[t.dataset.standing] = t.checked; save(); say(t.checked ? L('Arrangement on', 'व्यवस्था चालू', 'ఏర్పాటు ఆన్') : L('Arrangement off', 'व्यवस्था बंद', 'ఏర్పాటు ఆఫ్')); }
  else if (t.dataset.src) { S.src[t.dataset.src] = t.checked; save(); say(t.checked ? L('Allowed', 'अनुमति दी', 'అనుమతించారు') : L('Switched off', 'बंद किया', 'ఆఫ్ చేశాను')); }
  else if (t.name === 'au') { S.autonomy = t.value; save(); say(L('Saved', 'सहेजा गया', 'సేవ్ అయింది')); }
  else if (t.id === 'cap') { S.cap = +t.value; save(); }
  else if (t.id === 'set-lang' || t.id === 'lang-sel') { S.lang = t.value; save(); setLang(); route(); }
  else if (t.id === 'set-scale') { S.scale = +t.value; save(); applyDisplay(); }
  else if (t.id === 'set-theme') { S.theme = t.value; save(); applyDisplay(); }
  else if (t.id === 'plan-date' || t.id === 'plan-pax' || t.id === 'plan-from' || t.id === 'plan-to') {
    const q = new URLSearchParams((location.hash.split('?')[1] || '')).get('q') || ''; const old = parseAsk(q); const dt = new Date($('#plan-date').value + 'T00:00:00');
    const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][dt.getMonth()];
    const who = /appa|dad|father/i.test(q) ? 'Appa ' : /amma|mom|mother/i.test(q) ? 'Amma ' : '';
    go(`${who}${CITIES[$('#plan-from').value].n} to ${CITIES[$('#plan-to').value].n} ${dt.getDate()} ${mon} ${$('#plan-pax').value} people${old.urgent ? ' urgent' : ''}${old.tpref ? ' ' + old.tpref : ''}${old.purpose === 'wedding' ? ' wedding' : ''}`);
  }
});
function go(q) { location.hash = '#/plan?q=' + encodeURIComponent(q); }
window.addEventListener('hashchange', route);

/* voice: real speech recognition where the browser has it */
let rec = null;
function toggleMic(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const st = $('#ask-status');
  if (!SR) { st.textContent = L('Voice is not available in this browser. Type instead.', 'इस ब्राउज़र में आवाज़ उपलब्ध नहीं। टाइप करें।', 'ఈ బ్రౌజర్‌లో వాయిస్ లేదు. టైప్ చేయండి.'); return; }
  if (rec) { rec.stop(); return; }
  rec = new SR(); rec.lang = { en: 'en-IN', hi: 'hi-IN', te: 'te-IN' }[S.lang]; rec.interimResults = true;
  btn.setAttribute('aria-pressed', 'true'); st.textContent = L('Listening…', 'सुन रही हूँ…', 'వింటున్నాను…');
  rec.onresult = ev => { $('#ask').value = [...ev.results].map(r => r[0].transcript).join(' '); };
  rec.onend = () => { btn.setAttribute('aria-pressed', 'false'); rec = null; const v = $('#ask').value.trim(); if (v) go(v); else st.textContent = ''; };
  rec.onerror = () => { st.textContent = L('I could not hear you. Try again or type.', 'सुन नहीं पाई। फिर कोशिश करें या टाइप करें।', 'వినబడలేదు. మళ్లీ ప్రయత్నించండి లేదా టైప్ చేయండి.'); };
  rec.start();
}

/* help: a person, always one tap away */
function openHelp() {
  const d = $('#help'); const j = location.hash.includes('journey') || location.hash === '' || location.hash === '#/' ? L('Your Bengaluru to Chennai journey is open on their screen.', 'आपकी बेंगलुरु-चेन्नई यात्रा उनकी स्क्रीन पर खुली है।', 'మీ బెంగళూరు-చెన్నై ప్రయాణం వారి స్క్రీన్‌పై తెరిచి ఉంది.') : '';
  $('#help-body').innerHTML = `<p>${L('A trained person joins in about two minutes. They already see your journey, so you never explain it twice.', 'एक प्रशिक्षित व्यक्ति लगभग दो मिनट में जुड़ता है। उन्हें आपकी यात्रा पहले से दिखती है, इसलिए दो बार समझाना नहीं पड़ता।', 'శిక్షణ పొందిన వ్యక్తి సుమారు రెండు నిమిషాల్లో కలుస్తారు. వారికి మీ ప్రయాణం ముందే కనిపిస్తుంది, రెండుసార్లు చెప్పనవసరం లేదు.')} ${j}</p>
    <p class="note">${L('In this student concept no one will actually call.', 'इस छात्र कॉन्सेप्ट में कोई फ़ोन नहीं करेगा।', 'ఈ విద్యార్థి కాన్సెప్ట్‌లో ఎవరూ ఫోన్ చేయరు.')}</p>`;
  d.showModal();
}

/* ---------- display ---------- */
function applyDisplay() {
  const r = document.documentElement; r.style.setProperty('--scale', S.scale); r.dataset.theme = S.theme === 'auto' ? '' : S.theme;
  if (S.theme === 'auto') r.removeAttribute('data-theme');
}
function setLang() {
  document.documentElement.lang = S.lang;
  const ls = $('#lang-sel'); if (ls) ls.value = S.lang;
  $('#nav-home').textContent = L('Home', 'होम', 'హోమ్'); $('#nav-j').textContent = L('Journeys', 'यात्राएँ', 'ప్రయాణాలు'); $('#nav-p').textContent = L('Passes', 'पास', 'పాస్‌లు'); $('#nav-c').textContent = L('Your controls', 'आपके नियंत्रण', 'మీ నియంత్రణలు');
  $('#help-btn').innerHTML = L('Talk to a person', 'किसी व्यक्ति से बात करें', 'ఒక వ్యక్తితో మాట్లాడండి');
  $('#skip').textContent = L('Skip to main content', 'मुख्य सामग्री पर जाएँ', 'ప్రధాన కంటెంట్‌కు వెళ్లండి');
  $('#foot').textContent = L('Student concept for a class project. Sample data. Not affiliated with IRCTC or Indian Railways.', 'कक्षा परियोजना के लिए छात्र कॉन्सेप्ट। नमूना डेटा। IRCTC या भारतीय रेल से संबद्ध नहीं।', 'తరగతి ప్రాజెక్ట్ కోసం విద్యార్థి కాన్సెప్ట్. నమూనా డేటా. IRCTC లేదా భారతీయ రైల్వేతో సంబంధం లేదు.');
  $('#help-title').textContent = L('A person will help you', 'एक व्यक्ति आपकी मदद करेगा', 'ఒక వ్యక్తి మీకు సహాయం చేస్తారు');
  $('#help-close').textContent = L('Close', 'बंद करें', 'మూసివేయండి');
  const av = $('#avatar'); if (av) av.setAttribute('aria-label', L('Your controls', 'आपके नियंत्रण', 'మీ నియంత్రణలు'));
}

/* live clock: one simulated minute per second, only the live widgets update */
let lastHead = '';
setInterval(() => {
  const body = $('#today-body'); if (!body) return;
  const n = simNow(); const full = !!body.closest('.panel'); const html = todayBody(n, full); const key = html.replace(/<b id="cnt-n">\d+<\/b>/, '');
  if (key !== lastHead) {
    const open = !!body.querySelector('details[open]'); const had = body.querySelectorAll('.feed li time').length; const first = lastHead === '';
    body.innerHTML = html; lastHead = key; if (open) { const dt = body.querySelector('details'); if (dt) dt.open = true; }
    const now = (html.match(/<time>/g) || []).length; if (!first && now > had) { const f = today.events.filter(e => e.at <= n).pop(); if (f) say(LO(f.t)); }
  }
  const cn_ = $('#cnt-n'); if (cn_) cn_.textContent = Math.max(0, Math.round((todayLegs(n)[0].dep - n) / 60000));
  $$('.asof time').forEach(el => el.textContent = hm(n));
}, 1000);

/* ---------- start ---------- */
applyDisplay(); setLang();
$('#lang-sel').addEventListener('change', e => { S.lang = e.target.value; save(); setLang(); route(); });
route();
window.__app = { S, parseAsk, buildProposal, simNow };

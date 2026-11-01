/* World model for the 2036 sample: cities, train products, intent parsing and the proposal engine.
   Everything here is SAMPLE data and rule-based stand-ins for a real planning service. */
'use strict';
const HOME_CITY = 'bengaluru';       // where the sample traveller lives and works
const FAMILY_CITY = 'hyderabad';     // "home" in the phrase "going home"
const SIM0 = new Date(2036, 1, 12, 7, 42, 0); // the sample "now": Tuesday 12 February 2036, 07:42

const CITIES = {
  bengaluru: { n: 'Bengaluru', stn: 'KSR Bengaluru', lat: 12.97, lon: 77.59, hi: 'बेंगलुरु', te: 'బెంగళూరు' },
  hyderabad: { n: 'Hyderabad', stn: 'Secunderabad Jn', lat: 17.38, lon: 78.48, hi: 'हैदराबाद', te: 'హైదరాబాద్' },
  chennai: { n: 'Chennai', stn: 'Chennai Central', lat: 13.08, lon: 80.27, hi: 'चेन्नई', te: 'చెన్నై' },
  vijayawada: { n: 'Vijayawada', stn: 'Vijayawada Jn', lat: 16.51, lon: 80.65, hi: 'विजयवाड़ा', te: 'విజయవాడ' },
  warangal: { n: 'Warangal', stn: 'Warangal', lat: 17.97, lon: 79.6, hi: 'वारंगल', te: 'వరంగల్' },
  tirupati: { n: 'Tirupati', stn: 'Tirupati', lat: 13.63, lon: 79.42, hi: 'तिरुपति', te: 'తిరుపతి' },
  visakhapatnam: { n: 'Visakhapatnam', stn: 'Visakhapatnam', lat: 17.69, lon: 83.22, hi: 'विशाखापत्तनम', te: 'విశాఖపట్నం' },
  kochi: { n: 'Kochi', stn: 'Ernakulam Jn', lat: 9.97, lon: 76.28, hi: 'कोच्चि', te: 'కొచ్చి' },
  mumbai: { n: 'Mumbai', stn: 'Mumbai CSMT', lat: 18.94, lon: 72.84, hi: 'मुंबई', te: 'ముంబై' },
  pune: { n: 'Pune', stn: 'Pune Jn', lat: 18.53, lon: 73.87, hi: 'पुणे', te: 'పూణే' },
  delhi: { n: 'Delhi', stn: 'New Delhi', lat: 28.64, lon: 77.22, hi: 'दिल्ली', te: 'ఢిల్లీ' },
  jaipur: { n: 'Jaipur', stn: 'Jaipur Jn', lat: 26.92, lon: 75.79, hi: 'जयपुर', te: 'జైపూర్' },
  kolkata: { n: 'Kolkata', stn: 'Howrah Jn', lat: 22.58, lon: 88.34, hi: 'कोलकाता', te: 'కోల్‌కతా' },
  goa: { n: 'Goa', stn: 'Madgaon', lat: 15.27, lon: 73.96, hi: 'गोवा', te: 'గోవా' },
  coimbatore: { n: 'Coimbatore', stn: 'Coimbatore Jn', lat: 11.0, lon: 76.97, hi: 'कोयंबटूर', te: 'కోయంబత్తూరు' },
  nagpur: { n: 'Nagpur', stn: 'Nagpur Jn', lat: 21.15, lon: 79.09, hi: 'नागपुर', te: 'నాగపూర్' },
};
const ALIAS = { vizag: 'visakhapatnam', bangalore: 'bengaluru', bombay: 'mumbai', madras: 'chennai', cochin: 'kochi', secunderabad: 'hyderabad', calcutta: 'kolkata', 'new delhi': 'delhi' };
const cityName = (k, lang) => { const c = CITIES[k]; return (lang === 'hi' && c.hi) || (lang === 'te' && c.te) || c.n; };

const rad = x => x * Math.PI / 180;
function railKm(a, b) {
  const A = CITIES[a], B = CITIES[b];
  const d = 2 * 6371 * Math.asin(Math.sqrt(Math.sin(rad(B.lat - A.lat) / 2) ** 2 + Math.cos(rad(A.lat)) * Math.cos(rad(B.lat)) * Math.sin(rad(B.lon - A.lon) / 2) ** 2));
  return Math.max(60, Math.round(d * 1.28 / 5) * 5);
}
const addMin = (d, m) => new Date(d.getTime() + m * 60000);
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const atTime = (day, h, m) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0);
const roundUp = (d, step = 5) => { const x = new Date(d); x.setSeconds(0, 0); x.setMinutes(Math.ceil(x.getMinutes() / step) * step); return x; };
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

/* Train products of the 2036 sample (speculative network; times and prices are invented). */
const PRODUCTS = {
  hs: { key: 'hs', name: 'High-speed 200', sp: 150, rate: 3.1, times: [[6, 30], [9, 30], [13, 0], [17, 30]], maxKm: 1500, conf: 'confirmed' },
  sl: { key: 'sl', name: 'Vande Bharat Sleeper', sp: 88, rate: 1.8, times: [[21, 30]], maxKm: 3500, conf: 'confirmed' },
  ex: { key: 'ex', name: 'Express', sp: 56, rate: 0.75, times: [[18, 45], [5, 40]], maxKm: 3500, conf: 'likely' },
};

/* ---------- reading what the person typed or said ---------- */
function detectLang(text) { if (/[ఀ-౿]/.test(text)) return 'te'; if (/[ऀ-ॿ]/.test(text)) return 'hi'; return null; }
const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseAsk(raw) {
  let text = ' ' + raw.toLowerCase() + ' ';
  for (const k in CITIES) { const c = CITIES[k]; if (c.hi) text = text.split(c.hi).join(' ' + k + ' '); if (c.te) text = text.split(c.te).join(' ' + k + ' '); }
  for (const a in ALIAS) text = text.split(a).join(' ' + ALIAS[a] + ' ');
  const found = [];
  for (const k in CITIES) { const i = text.indexOf(' ' + k); if (i >= 0) found.push([i, k]); }
  found.sort((a, b) => a[0] - b[0]);
  const cities = found.map(f => f[1]);
  const goingHome = /\bhome\b|ఇంటికి|घर/.test(text) && !cities.length ? true : /going home|go home|back home|home for/.test(text) && cities.length < 2;
  let from = HOME_CITY, to = null;
  if (cities.length >= 2) { from = cities[0]; to = cities[1]; }
  else if (cities.length === 1) { to = cities[0]; if (to === HOME_CITY) { from = FAMILY_CITY; } }
  else if (goingHome) to = FAMILY_CITY;
  const urgent = /urgent|emergency|hospital|asap|right now|immediately|accident|unwell|ambulance|అత్యవసరం|तुरंत|अस्पताल|ఆసుపత్రి/.test(text);
  const today = startOfDay(SIM0);
  let date = null, dateWord = null;
  if (/today|tonight|right now|asap|आज|ఈరోజు/.test(text) || (urgent && !/tomorrow|कल|రేపు/.test(text))) { date = today; dateWord = 'today'; }
  else if (/tomorrow|कल|రేపు/.test(text)) { date = addMin(today, 1440); dateWord = 'tomorrow'; }
  else {
    const dm = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    const wi = WD.findIndex(w => text.includes(w));
    if (dm) { const d = new Date(2036, MON.indexOf(dm[2]), +dm[1]); date = d < today ? new Date(2037, d.getMonth(), d.getDate()) : d; dateWord = 'date'; }
    else if (wi >= 0) { const diff = ((wi - today.getDay() + 7) % 7) || 7; date = addMin(today, diff * 1440 + (/next /.test(text) && diff < 4 ? 7 * 1440 : 0)); dateWord = 'weekday'; }
  }
  const tpref = /morning/.test(text) ? 'morning' : /evening/.test(text) ? 'evening' : /night|overnight/.test(text) ? 'night' : null;
  let pax = 1; const pm = text.match(/(\d)\s*(people|of us|travell?ers|passengers|tickets)/);
  if (pm) pax = +pm[1]; else if (/two of us|\bus\b|wife|husband|partner|couple|honeymoon/.test(text)) pax = 2;
  const elder = /amma|appa|mom|mother|dad|father|parents|grand|नानी|दादी|पिता|माँ|అమ్మ|నాన్న|అప్ప|అమ్మమ్మ/.test(text);
  const recurring = /every (mon|tue|wed|thu|fri|sat|sun|week)|each (mon|tue|wed|thu|fri)|weekly|हर सप्ताह|ప్రతి/.test(text);
  let purpose = urgent ? 'urgent' : /wedding|marriage|शादी|పెళ్లి/.test(text) ? 'wedding' : /diwali|ugadi|sankranti|festival|pongal|holi|eid/.test(text) ? 'festival' : /honeymoon/.test(text) ? 'honeymoon' : /meeting|work|office|interview/.test(text) ? 'work' : null;
  return { raw, from, to, date, dateWord, tpref, pax, elder, recurring, urgent, purpose, cities, lang: detectLang(raw) };
}

/* ---------- the proposal engine ---------- */
function hash(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
const DOOR = { out: { mins: 40, price: 260 }, back: { mins: 30, price: 190 } };

function buildOptions(it, opts = {}) {
  const from = it.from, to = it.to, km = railKm(from, to);
  const day = it.date || addMin(startOfDay(SIM0), 1440);
  const ready = addMin(it.urgent ? SIM0 : atTime(day, 0, 0), it.urgent ? DOOR.out.mins + 10 : 0);
  const out = [];
  for (const p of Object.values(PRODUCTS)) {
    if (km > p.maxKm) continue;
    let times = p.times.map(([h, m]) => atTime(day, h, m)).filter(d => d >= ready).sort((a, b) => a - b);
    if (!times.length) times = p.times.map(([h, m]) => atTime(addMin(day, 1440), h, m)).sort((a, b) => a - b);
    let dep = times[0];
    if (!it.urgent) {
      const pref = it.tpref === 'morning' ? 10 : it.tpref === 'evening' ? 17 : it.tpref === 'night' ? 21 : (p.key === 'hs' ? 9 : 0);
      if (pref) dep = times.reduce((best, d) => Math.abs(d.getHours() - pref) < Math.abs(best.getHours() - pref) ? d : best, times[0]);
      if (opts.depAfter) { const c = times.find(d => d >= opts.depAfter); if (c) dep = c; }
    }
    const mins = Math.round(km / p.sp * 60 / 5) * 5;
    const pct = p.conf === 'confirmed' ? 100 : 62 + (hash(from + to + p.key) % 24);
    const ticket = Math.round((km * p.rate * (p.key === 'hs' && it.urgent ? 1.0 : 1)) / 5) * 5;
    out.push({ prod: p, dep, arr: addMin(dep, mins), mins, ticket, pct, conf: p.conf, km });
  }
  return out;
}

function pickRecommended(opts, it) {
  const byArr = [...opts].sort((a, b) => a.arr - b.arr);
  if (it.urgent) return byArr.find(o => o.conf === 'confirmed') || byArr[0];
  const conf = opts.filter(o => o.conf === 'confirmed');
  const km = opts[0] ? opts[0].km : 0;
  if (km > 700 && !it.tpref) return conf.find(o => o.prod.key === 'sl') || conf[0];
  if (it.tpref === 'night') return conf.find(o => o.prod.key === 'sl') || conf[0];
  return conf.find(o => o.prod.key === 'hs') || conf[0];
}

/* a leg: {kind: door|ride|tap, label, from, to, dep, arr, price, note} */
function legsFromOption(o, it) {
  const f = CITIES[it.from], t = CITIES[it.to];
  const destLabel = it.destLabel || ('your destination in ' + t.n);
  const board = addMin(o.dep, -0), cabDep = addMin(o.dep, -(DOOR.out.mins + 20));
  const legs = [
    { kind: 'door', mode: 'cab', from: it.fromLabel || ('Home, ' + f.n), to: f.stn, dep: cabDep, arr: addMin(cabDep, DOOR.out.mins), price: DOOR.out.price, note: 'Shared cab, picks you up at your door' },
    { kind: 'tap', mode: 'tap', from: f.stn, to: f.stn, dep: addMin(o.dep, -12), arr: addMin(o.dep, -12), price: 0, note: 'Walk on, no ticket to show' },
    { kind: 'ride', mode: o.prod.key, from: f.stn, to: t.stn, dep: board, arr: o.arr, price: o.ticket * it.pax, note: o.prod.name + (o.conf === 'confirmed' ? ', seat held' : ', waitlist ' + Math.round((100 - o.pct) / 8)) },
    { kind: 'door', mode: 'cab', from: t.stn, to: destLabel, dep: addMin(o.arr, 10), arr: addMin(o.arr, 10 + DOOR.back.mins), price: DOOR.back.price, note: 'Cab waits at the station exit' },
  ];
  return legs;
}

function buildProposal(it, id) {
  const opts = buildOptions(it);
  if (!opts.length) return null;
  const rec = pickRecommended(opts, it);
  const rank = (o) => o === rec ? 'best' : (o === [...opts].sort((a, b) => a.arr - b.arr)[0] ? 'fastest' : (o === [...opts].sort((a, b) => a.ticket - b.ticket)[0] ? 'cheapest' : 'other'));
  const mk = (o) => { const legs = legsFromOption(o, it); return { o, rank: rank(o), legs, total: legs.reduce((s, l) => s + l.price, 0) }; };
  const all = opts.map(mk).sort((a, b) => (a.rank === 'best' ? -1 : b.rank === 'best' ? 1 : a.o.arr - b.o.arr));
  return { id: id || 'p' + hash(JSON.stringify([it.from, it.to, +it.date, it.pax, it.urgent, it.purpose])).toString(36), it, choices: all, pick: 0 };
}

/* the two proposals already waiting on the home page (made before the person opened the site) */
function seedProposals() {
  const wedItem = { from: 'bengaluru', to: 'vijayawada', date: new Date(2036, 1, 22), pax: 1, tpref: 'evening', purpose: 'wedding', destLabel: 'Wedding hall, Vijayawada', urgent: false, elder: false };
  const wed = buildProposal(wedItem, 'wedding');
  wed.title = { en: "Sneha's wedding, Vijayawada", hi: 'स्नेहा की शादी, विजयवाड़ा', te: 'స్నేహ పెళ్లి, విజయవాడ' };
  wed.why = { en: 'From the invitation in your email (you let me read invitations). The wedding is Saturday 23 February, so I planned Friday, with the evening free.', hi: 'आपके ईमेल के निमंत्रण से (आपने मुझे निमंत्रण पढ़ने दिए हैं)। शादी शनिवार 23 फ़रवरी को है, इसलिए मैंने शुक्रवार की यात्रा रखी।', te: 'మీ ఈమెయిల్‌లోని ఆహ్వానం నుండి (ఆహ్వానాలు చదవడానికి మీరు అనుమతించారు). పెళ్లి శనివారం 23 ఫిబ్రవరి, కాబట్టి శుక్రవారం ప్రయాణం ప్లాన్ చేశాను.' };
  wed.ret = buildProposal({ from: 'vijayawada', to: 'bengaluru', date: new Date(2036, 1, 24), pax: 1, tpref: 'evening', purpose: 'wedding', fromLabel: 'Wedding hall, Vijayawada', destLabel: 'Home, Bengaluru', urgent: false, elder: false }, 'wedding-ret');
  const appItem = { from: 'warangal', to: 'hyderabad', date: new Date(2036, 1, 18), pax: 1, tpref: 'morning', purpose: 'health', destLabel: 'City hospital, Hyderabad', urgent: false, elder: true, who: 'Appa' };
  const app = buildProposal(appItem, 'appa');
  app.title = { en: "Appa's monthly check-up", hi: 'अप्पा की मासिक जाँच', te: 'నాన్న నెలవారీ చెకప్' };
  app.why = { en: 'Same visit as every month. Senior concession applied. A station helper meets Appa at the gate.', hi: 'हर महीने जैसी ही यात्रा। वरिष्ठ नागरिक रियायत लगी है। स्टेशन पर सहायक गेट पर मिलेगा।', te: 'ప్రతి నెలలాగే ప్రయాణం. సీనియర్ రాయితీ వర్తించింది. స్టేషన్ సహాయకుడు గేటు వద్ద కలుస్తారు.' };
  app.who = 'Appa';
  // senior concession on the ride leg
  app.choices.forEach(c => { const r = c.legs.find(l => l.kind === 'ride'); const cut = Math.round(r.price * 0.4); r.price -= cut; r.note += ', senior concession'; c.total = c.legs.reduce((s, l) => s + l.price, 0); });
  return [wed, app];
}

/* the journey in progress this morning (sample, scripted against the simulated clock) */
function todayJourney() {
  const d = startOfDay(SIM0);
  const T = (h, m) => atTime(d, h, m);
  return {
    id: 'today', from: 'bengaluru', to: 'chennai', title: { en: 'Bengaluru to Chennai, for work', hi: 'बेंगलुरु से चेन्नई, काम के लिए', te: 'బెంగళూరు నుండి చెన్నై, పని కోసం' },
    ride: 'High-speed 200', seat: 'Coach C4, seat 22 (window)', platform: 'Platform 3',
    legsPlanned: [
      { kind: 'door', mode: 'cab', from: 'Home, Bengaluru', to: 'KSR Bengaluru', dep: T(8, 22), arr: T(9, 2), price: 260, note: 'Shared cab' },
      { kind: 'tap', mode: 'tap', from: 'KSR Bengaluru', to: 'KSR Bengaluru', dep: T(9, 0), arr: T(9, 0), price: 0, note: 'Walk on' },
      { kind: 'ride', mode: 'hs', from: 'KSR Bengaluru', to: 'Chennai Central', dep: T(9, 12), arr: T(11, 38), price: 1050, note: 'High-speed 200' },
      { kind: 'door', mode: 'cab', from: 'Chennai Central', to: 'Meeting, Guindy', dep: T(11, 48), arr: T(12, 18), price: 190, note: 'Cab waits at the exit' },
    ],
    // events keyed to simulated clock (minutes after SIM0)
    events: [
      { at: T(7, 46), t: { en: 'The train will leave 9 minutes late. I moved your cab to 08:31. You do not need to do anything.', hi: 'ट्रेन 9 मिनट देर से चलेगी। मैंने आपकी कैब 08:31 पर कर दी है। आपको कुछ करना नहीं है।', te: 'రైలు 9 నిమిషాలు ఆలస్యంగా బయలుదేరుతుంది. మీ క్యాబ్‌ను 08:31కి మార్చాను. మీరు ఏమీ చేయనవసరం లేదు.' } },
      { at: T(8, 31), t: { en: 'Your cab is at the door.', hi: 'आपकी कैब दरवाज़े पर है।', te: 'మీ క్యాబ్ మీ ఇంటి వద్దకు వచ్చింది.' } },
      { at: T(9, 4), t: { en: 'Tapped in at KSR Bengaluru, gate 3. Welcome aboard.', hi: 'KSR बेंगलुरु, गेट 3 पर प्रवेश हो गया। यात्रा शुभ हो।', te: 'KSR బెంగళూరు, గేట్ 3 వద్ద ప్రవేశించారు. శుభ ప్రయాణం.' } },
    ],
  };
}

Object.assign(window, { HOME_CITY, FAMILY_CITY, SIM0, CITIES, PRODUCTS, cityName, railKm, addMin, startOfDay, atTime, roundUp, inr, detectLang, parseAsk, buildOptions, buildProposal, seedProposals, todayJourney });

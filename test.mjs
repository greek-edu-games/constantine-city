// Δοκιμές λογικής: node test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const code = html.match(/<script id="logic">([\s\S]*?)<\/script>/)[1];
const m = { exports: {} }; new Function('module', code)(m); const L = m.exports;
let n = 0; const ok = (c, msg) => { n++; assert.ok(c, msg); };
const eq = (a, b, msg) => { n++; assert.deepEqual(a, b, msg); };

// --- δεδομένα ---
eq(L.YEARS.length, 7, '7 χρονιές'); eq(L.YEARS[0], 324); eq(L.YEARS[6], 330);
eq(L.COUNCIL_BY_YEAR.length, 7);
const flat = L.COUNCIL_BY_YEAR.flat(); eq(new Set(flat).size, L.COUNCIL.length, 'κάθε ερώτημα συμβουλίου σε ακριβώς μία χρονιά'); eq(flat.length, L.COUNCIL.length);
L.COUNCIL_BY_YEAR.forEach(y => ok(y.length >= 2 && y.length <= 3, '2–3 ερωτήματα/χρονιά'));
for (const it of [...L.COUNCIL, ...L.REVIEW]) {
  ok(it.opts.length === 3, it.id + ' 3 επιλογές'); ok(new Set(it.opts).size === 3, it.id + ' μοναδικές επιλογές');
  ok(it.a === 0 && it.opts[it.a], it.id + ' ακριβώς μία σωστή'); ok(it.ex && it.ex.length > 15, it.id + ' εξήγηση');
  ok(Number.isInteger(it.ch) && it.ch >= 1 && it.ch <= 12, it.id + ' κεφάλαιο 1–12');
  ok(!/undefined|NaN/.test(JSON.stringify(it)), it.id);
  for (let seed = 0; seed < 50; seed++) { const p = L.orderFor(it.id, seed); eq([...p].sort(), [0, 1, 2], 'μετάθεση'); ok(p.indexOf(0) >= 0, 'σωστή υπάρχει'); }
}
L.COUNCIL.forEach(c => ok(c.kind === 'council'));
for (const f of L.FACTS) { ok(Number.isInteger(f.ch) && f.ch >= 1 && f.ch <= 12, f.id + ' κεφ.'); ok(f.t.length > 20, f.id); }
for (const b of L.BUILDINGS) { ok(L.FACTS.some(f => f.b === b.id), b.id + ' έχει «Ήξερες ότι»'); ok(b.ch >= 1 && b.ch <= 12); b.after.forEach(a => ok(L.B[a], 'prereq')); }
L.YEAR_INTRO.forEach(y => ok(y.ch >= 1 && y.ch <= 12)); eq(L.YEAR_INTRO.length, 7);
// τίποτα μετά το κεφ. 12 (Ιουστινιανός/Νίκα/Αγία Σοφία Β΄)
const alltext = JSON.stringify([L.COUNCIL, L.REVIEW, L.FACTS, L.YEAR_INTRO, L.EVENTS.map(e => e.text + e.title), L.SCENES]);
ok(!/Ιουστινιαν|Νίκα\b|Νίκας|Ισλάμ|Άραβ|Σταυροφορ|1453/.test(alltext), 'χωρίς περιεχόμενο εκτός ύλης');
// σκηνές
eq(L.SCENES.length, 8);
L.SCENES.forEach(s => { eq(s.props.filter(p => p.ana).length, 1, s.id + ' ακριβώς ένας αναχρονισμός'); ok(s.why.length > 10); ok(s.props.length >= 6); const pos = s.props.map(p => p.x + ',' + p.y); eq(new Set(pos).size, pos.length); });
// κάρτες απρόοπτου
ok(L.EVENTS.length >= 14, '≥14 κάρτες'); ok(new Set(L.EVENTS.map(e => e.id)).size === L.EVENTS.length);

// --- βοηθητικά για προσομοίωση ---
function rint(r, n) { return Math.floor(r() * n); }
function lcg(seed) { let x = seed >>> 0 || 1; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; }
function checkInv(s) {
  ok(s.soldia >= 0 && Number.isFinite(s.soldia), 'σολδία ≥ 0');
  ok(s.mess >= 0 && s.mess <= 3); ok(new Set(s.built).size === s.built.length); ok(s.medals >= 0);
  ok(!/NaN|undefined/.test(JSON.stringify(s)));
}
// bot: policy 'rand' | 'best' | 'worst' ; build: 'rand'|'none'|'greedy'
function play(seed, pol, bld, cb) {
  const r = lcg(seed * 7 + 1); const s = L.newGame(seed); let steps = 0; const yearsSeen = new Set();
  while (s.phase !== 'done') {
    ok(++steps < 2000, 'βρόχος');
    yearsSeen.add(s.yi); checkInv(s);
    if (s.phase === 'council') {
      const it = L.currentCouncil(s); ok(it); const perm = L.orderFor(it.id, s.seed);
      const k = pol === 'best' ? perm.indexOf(0) : pol === 'worst' ? (perm.indexOf(0) + 1 + rint(r, 2)) % 3 : rint(r, 3);
      const res = L.answerCouncil(s, k); ok(res.ex && res.ch); eq(res.ok, pol === 'best' ? true : pol === 'worst' ? false : res.ok);
    } else if (s.phase === 'build') {
      const want = bld === 'none' ? 0 : 5;
      for (let t = 0; t < want; t++) {
        const opts = L.BUILDINGS.filter(b => L.canPlace(s, b.id) === 'ok'); if (!opts.length) break;
        const b = bld === 'greedy' ? opts[0] : opts[rint(r, opts.length)];
        const before = s.soldia; const res = L.placeBuilding(s, b.id); ok(res.ok); ok(s.soldia === before - (before - s.soldia) && s.soldia >= 0);
      }
      // κανόνες απόρριψης
      L.BUILDINGS.forEach(b => { const w = L.canPlace(s, b.id); if (w !== 'ok') { const p = JSON.stringify(s); const res = L.placeBuilding(s, b.id); ok(!res.ok && JSON.stringify(s) === p, 'η αδύνατη τοποθέτηση δεν αλλάζει κατάσταση'); } });
      ok(s.placed <= L.MAX_BUILDS_PER_YEAR); L.endBuild(s);
    } else if (s.phase === 'event') {
      const e = L.EV[s.ev]; ok(e, 'υπάρχει κάρτα'); ok(e.min <= s.yi);
      const res = e.type === 'task' ? { pass: r() < .5 } : e.type === 'quiz' ? { n: rint(r, 4) } : {};
      if (e.type === 'quiz') { eq(s.evq.length, 3); eq(new Set(s.evq).size, 3); s.evq.forEach(id => ok(L.ITEMS[id])); }
      const out = L.resolveEvent(s, res); ok(out && out.msg && ['good', 'meh', 'bad'].includes(out.tone), e.id); ok(s.soldia >= 0);
      eq(L.resolveEvent(s, res), out, 'idempotent'); L.afterEvent(s);
    } else if (s.phase === 'anach') {
      const sc = L.SCENES[s.scene]; ok(sc); const g = L.resolveScene(s, r() < .5); ok(g === 0 || g === 20);
    }
    if (cb) cb(s);
  }
  eq(yearsSeen.size, 7, 'όλες οι χρονιές προσπελάστηκαν'); checkInv(s);
  ok(s.final && s.final.stars >= 1 && s.final.stars <= 3 && s.final.score >= 0);
  return s;
}

// --- σενάρια ---
for (const pol of ['rand', 'best', 'worst']) for (const bld of ['rand', 'none', 'greedy']) { for (let i = 0; i < 30; i++) play(i + 11, pol, bld); }
// 500 προσομοιωμένες εκστρατείες
let completed = 0; const starHist = [0, 0, 0, 0];
for (let i = 0; i < 500; i++) { const s = play(1000 + i, ['rand', 'best', 'worst'][i % 3], ['rand', 'greedy', 'none'][(i >> 1) % 3]); completed++; starHist[s.final.stars]++; }
eq(completed, 500);
// τέλειο παιχνίδι: 3 αστέρια και 10/10 είναι εφικτά
let perfect = 0; for (let i = 0; i < 40; i++) { const s = play(5000 + i, 'best', 'greedy'); if (s.final.stars === 3) perfect++; }
ok(perfect >= 30, 'το τέλειο παιχνίδι δίνει συνήθως 3 αστέρια (' + perfect + '/40)');
// χειρότερο παιχνίδι ποτέ δεν μπλοκάρει: και χωρίς κτίρια ολοκληρώνεται
const nob = play(77, 'worst', 'none'); eq(nob.built.length, 0); eq(nob.final.stars, 1);

// κάθε κάρτα επιλύσιμη σε κάθε νόμιμη κατάσταση πόλης (εξαντλητικά: υποσύνολα κτιρίων × σολδία × σημαίες)
function lawful(mask) { // μάσκα κτιρίων σεβόμενη προαπαιτούμενα
  const built = L.BUILDINGS.filter((b, i) => mask >> i & 1).map(b => b.id);
  return built.every(id => L.B[id].after.every(a => built.includes(a))) ? built : null;
}
let states = 0;
for (let mask = 0; mask < 1 << L.BUILDINGS.length; mask++) {
  const built = lawful(mask); if (!built) continue;
  for (const sold of [0, 7, 40, 300]) for (const tol of [false, true]) for (const mess of [0, 3]) for (const statues of [false, true]) for (const e of L.EVENTS) for (const res of e.type === 'task' ? [{ pass: true }, { pass: false }] : e.type === 'quiz' ? [{ n: 0 }, { n: 1 }, { n: 3 }] : [{}]) {
    const s = L.newGame(3); s.built = built.slice(); s.unlocked = built.slice(); s.soldia = sold; s.flags.tolerant = tol; s.mess = mess; s.statues = statues; s.yi = Math.max(e.min, 3); s.phase = 'event'; s.ev = e.id;
    const out = L.resolveEvent(s, res); states++;
    ok(out && out.msg && s.soldia >= 0 && Number.isFinite(s.soldia) && s.mess <= 3 && s.mess >= 0, e.id + ' mask ' + mask);
    s.built.forEach(id => ok(L.B[id]));
    L.afterEvent(s); ok(s.phase === 'council' || s.phase === 'anach');
  }
}
ok(states > 10000, 'εξαντλητικός έλεγχος κάρτα×κατάσταση: ' + states);
// κάθε κάρτα μπορεί να τραβηχτεί σε κάθε χρονιά που είναι επιλέξιμη, και η τράπουλα δεν στερεύει
for (let y = 0; y < 6; y++) { const el = L.EVENTS.filter(e => e.min <= y).length; ok(el >= 6, 'επαρκής τράπουλα στη χρονιά ' + y); }
const seenEv = new Set(); for (let i = 0; i < 300; i++) { const s = L.newGame(i); s.phase = 'build'; L.endBuild(s); seenEv.add(s.ev); }
ok(seenEv.size >= 8, 'ποικιλία καρτών στην 1η χρονιά');
// φωτιά καταστρέφει το φόρουμ → ξαναχτίζεται με μισό κόστος
{ const s = L.newGame(1); s.built = ['walls', 'forum']; s.unlocked = ['walls', 'forum']; s.soldia = 100; s.yi = 1; s.phase = 'event'; s.ev = 'fire'; const out = L.resolveEvent(s, { pass: false });
  eq(out.lostB, 'forum'); ok(!s.built.includes('forum')); s.phase = 'build'; eq(L.buildCost(s, 'forum'), 23); ok(L.canPlace(s, 'column') === 'ok' ? true : L.canPlace(s, 'column') !== 'locked', 'εξαρτημένα κτίρια παραμένουν ξεκλείδωτα'); eq(L.placeBuilding(s, 'forum').ok, true); eq(s.soldia, 77); }
// συνέπειες: τείχη/δεξαμενές/ανεξιθρησκία αλλάζουν αποτέλεσμα
{ const mk = (b, id) => { const s = L.newGame(1); s.built = b; s.unlocked = b; s.soldia = 100; s.phase = 'event'; s.ev = id; s.yi = 3; return s; };
  const a = mk(['walls'], 'goths'), c = mk([], 'goths'); L.resolveEvent(a); L.resolveEvent(c); ok(a.soldia > 100 && c.soldia < 100, 'τείχη: σώζουν');
  const d = mk(['walls', 'forum', 'aqueduct', 'cisterns'], 'drought'), e = mk([], 'drought'); L.resolveEvent(d); L.resolveEvent(e); ok(d.soldia > 100 && e.soldia < 100, 'δεξαμενές σώζουν'); }

// --- οικονομία: ποτέ αρνητικά σολδία, εγκρατής απόδοση ---
{ const s = L.newGame(9); s.soldia = 3; L.BUILDINGS.forEach(b => { const w = L.canPlace(Object.assign(s, { phase: 'build' }), b.id); ok(w !== 'ok'); const r = L.placeBuilding(s, b.id); ok(!r.ok && s.soldia === 3); }); }

// --- σωστό σε σύγκριση με λάθος ---
{ const s1 = L.newGame(4), s2 = L.newGame(4); const it = L.currentCouncil(s1); const perm = L.orderFor(it.id, s1.seed);
  const r1 = L.answerCouncil(s1, perm.indexOf(0)), r2 = L.answerCouncil(s2, (perm.indexOf(0) + 1) % 3); ok(r1.gain > r2.gain && r1.ok && !r2.ok); ok(s2.mess === 1 && s1.mess === 0); }
// Η «ανεξιθρησκία» επιλογή θέτει σημαία
{ const s = L.newGame(2); s.yi = 1; s.ci = 0; const it = L.currentCouncil(s); eq(it.id, 'c-temples'); L.answerCouncil(s, L.orderFor(it.id, s.seed).indexOf(0)); ok(s.flags.tolerant); }

// --- αποθήκευση/συνέχεια χωρίς απώλειες ---
for (let i = 0; i < 60; i++) {
  const r = lcg(i + 3); const s = L.newGame(i);
  const stop = rint(r, 40); let steps = 0;
  play(i, 'rand', 'rand', st => {
    if (steps++ === stop) { const back = L.loadState(L.saveState(st)); eq(back, JSON.parse(JSON.stringify(st)), 'roundtrip'); eq(L.saveState(back), L.saveState(st)); }
  });
}
// συνέχεια: αν συνεχίσουμε από αποθηκευμένη κατάσταση, το αποτέλεσμα είναι ίδιο με το αδιάκοπο παιχνίδι (ντετερμινισμός)
{ function run(s, resumeAt) {
    let k = 0; const r = lcg(42);
    while (s.phase !== 'done') {
      if (k++ === resumeAt) s = L.loadState(L.saveState(s));
      if (s.phase === 'council') { const it = L.currentCouncil(s); L.answerCouncil(s, L.orderFor(it.id, s.seed).indexOf(0)); }
      else if (s.phase === 'build') { const o = L.BUILDINGS.find(b => L.canPlace(s, b.id) === 'ok'); if (o) L.placeBuilding(s, o.id); else L.endBuild(s); }
      else if (s.phase === 'event') { L.resolveEvent(s, { pass: true, n: 3 }); L.afterEvent(s); }
      else if (s.phase === 'anach') L.resolveScene(s, true);
    } return s; }
  eq(run(L.newGame(8), -1), run(L.newGame(8), 12), 'συνέχεια = αδιάκοπο'); }
eq(L.loadState('garbage'), null); eq(L.loadState('{"v":99}'), null); eq(L.loadState(JSON.stringify(Object.assign(L.newGame(1), { phase: 'xx' }))), null);

// --- Γρήγορη Επιθεώρηση ---
{ const sp = L.newSprint(5); const ids = new Set(); for (let i = 0; i < 200; i++) { const q = L.sprintQuestion(sp); ok(q.item.opts[q.perm[q.best]] === q.item.opts[0]); ok(q.best >= 0 && q.best < 3); ids.add(q.item.id); } ok(ids.size === L.COUNCIL.length + L.REVIEW.length, 'η επιθεώρηση καλύπτει όλες τις ερωτήσεις'); }
// ντετερμινισμός rnd
{ const a = { rs: 5 }, b = { rs: 5 }; eq([L.rnd(a), L.rnd(a)], [L.rnd(b), L.rnd(b)]); }
// κάλυψη κεφαλαίων 1–12
const covered = new Set([...L.COUNCIL, ...L.REVIEW].map(i => i.ch)); for (let c = 1; c <= 12; c++) ok(covered.has(c), 'κεφ. ' + c + ' καλύπτεται');
console.log('OK — ' + n + ' έλεγχοι · 500 εκστρατείες ολοκληρώθηκαν · αστέρια(1/2/3)=' + starHist.slice(1).join('/') + ' · καταστάσεις κάρτα×πόλη=' + states);

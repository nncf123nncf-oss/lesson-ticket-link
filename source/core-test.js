// 計算・リンクの検算（node）。実行: node source/core-test.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const core = /<script id="core">([\s\S]*?)<\/script>/.exec(html)[1];
const m = { exports: {} }; new Function('module', core)(m); const LT = m.exports;
let ng = 0; const ok = (n, c, i) => { if (!c) ng++; console.log((c ? 'OK ' : 'NG ') + n + (i !== undefined && !c ? ' ' + JSON.stringify(i) : '')); };
LT.now = new Date(2026, 10, 1); // 2026-11-01
const b64 = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const H = a => '#v1=' + b64(JSON.stringify(a));
const yui = { id: 'a', name: 'ゆい', total: '10', bought: '2026-09-06', exp: '2026-12-31', used: ['2026-10-18', '2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04'] };
// S1
let r = LT.toConfig('ことのはヨガ', yui, [yui]);
ok('S1 cfg', r.cfg && r.cfg.used.join() === '2026-09-06,2026-09-13,2026-09-20,2026-09-27,2026-10-04,2026-10-18', r.errors);
let st = LT.status(r.cfg);
ok('S1 left/days', st.left === 4 && st.days === 60 && st.exp === 'left' && !st.marks.length, st);
ok('S1 remainText', LT.remainText(r.cfg, st) === 'ゆいさん 残り4回（10回券）');
const want = '【ことのはヨガ 回数券】\nゆい さん\n10回券（2026年9月6日に購入）\n使った回数 6回／残り 4回\n有効期限 2026年12月31日（あと60日）\n使った日 9/6・9/13・9/20・9/27・10/4・10/18\n（2026年11月1日 時点）\nくわしくはこちら\nhttps://x/#a';
ok('S1 message', LT.message(r.cfg, 'https://x/#a') === want, LT.message(r.cfg, 'https://x/#a'));
// S2
const riku = { id: 'b', name: 'りく', total: '5', bought: '2026-10-04', exp: '2026-11-30', used: ['2026-10-04', '2026-10-11', '2026-10-18', '2026-11-01'] };
const hana = { id: 'c', name: 'はな', total: '8', bought: '2026-07-05', exp: '2026-10-31', used: ['2026-07-05', '2026-07-19', '2026-08-02', '2026-08-23', '2026-09-13', '2026-10-11'] };
const sota = { id: 'd', name: 'そうた', total: '12', bought: '2026-10-25', exp: '', used: ['2026-10-25'] };
const all = [yui, riku, hana, sota];
const row = s => { const c = LT.toConfig('', s, all).cfg, t = LT.status(c); return [t.left, LT.listExpText(t), t.marks.join('|')].join(' '); };
ok('S2 riku', row(riku) === '1 期限まで29日 残り1回', row(riku));
ok('S2 hana', row(hana) === '2 期限切れ 期限切れ', row(hana));
ok('S2 sota', row(sota) === '11 期限なし ', row(sota));
ok('S2 yui', row(yui) === '4 期限まで60日 ', row(yui));
// S3
const base = { id: 'e', name: 'テスト', total: '10', bought: '2026-01-01', exp: '', used: [] };
st = LT.status(LT.toConfig('', base, []).cfg); ok('S3 zero used', st.left === 10);
const full = Object.assign({}, base, { used: Array.from({ length: 10 }, (_, i) => '2026-01-' + String(i + 1).padStart(2, '0')) });
let c = LT.toConfig('', full, []).cfg; st = LT.status(c);
ok('S3 used up', st.left === 0 && LT.remainText(c, st) === 'テストさん 10回券を使い切りました' && st.marks[0] === '使い切り');
ok('S3 over total', LT.toConfig('', Object.assign({}, full, { used: full.used.concat(['2026-02-01']) }), []).cfg === null);
ok('S3 1回券', LT.toConfig('', Object.assign({}, base, { total: '1', used: ['2026-01-02'] }), []).cfg !== null);
const f50 = Object.assign({}, base, { total: '50', name: 'あいうえおかきくけこ', used: Array.from({ length: 50 }, (_, i) => '2026-' + String(1 + Math.floor(i / 28)).padStart(2, '0') + '-' + String(i % 28 + 1).padStart(2, '0')) });
c = LT.toConfig('ことのはヨガことのはヨガことのはヨガ12', f50, []).cfg;
const u50 = c ? LT.makeUrl('https://nncf123nncf-oss.github.io/lesson-ticket-link/', c) : '';
ok('S3 50 used up url len', c && u50.length < 2000, u50.length); console.log('   50回券を使い切ったURLの長さ', u50.length);
ok('S3 total 0/51', isNaN(LT.parseTotal('0')) && isNaN(LT.parseTotal('51')) && LT.parseTotal('５０') === 50);
// S4
const ex = e => LT.status(LT.toConfig('', Object.assign({}, base, { bought: '2026-10-01', exp: e }), []).cfg);
ok('S4 none', ex('').exp === 'none');
ok('S4 today', ex('2026-11-01').exp === 'today' && LT.expText({ exp: '2026-11-01' }, ex('2026-11-01')) === '有効期限 2026年11月1日（今日まで）');
ok('S4 expired', ex('2026-10-31').exp === 'expired' && ex('2026-10-31').days === -1);
ok('S4 soon 14', ex('2026-11-15').marks.join() === '期限まであと14日' && ex('2026-11-16').marks.length === 0);
ok('S4 exp<=bought', LT.toConfig('', Object.assign({}, base, { exp: '2026-01-01' }), []).cfg === null && LT.toConfig('', Object.assign({}, base, { exp: '2025-12-31' }), []).cfg === null);
LT.now = new Date(2028, 1, 28);
ok('S4 leap', LT.validDate('2028-02-29') && !LT.validDate('2027-02-29') && LT.status(LT.toConfig('', Object.assign({}, base, { exp: '2028-03-01' }), []).cfg).days === 2);
LT.now = new Date(2026, 10, 1);
// S5
ok('S5 before bought', LT.toConfig('', Object.assign({}, base, { used: ['2025-12-31'] }), []).cfg === null);
c = LT.toConfig('', Object.assign({}, base, { used: ['2026-03-01', '2026-03-01', '2026-02-01'] }), []).cfg;
ok('S5 same day twice + sorted', c.used.join() === '2026-02-01,2026-03-01,2026-03-01');
ok('S5 year shown when crosses', LT.shortDates(['2026-12-28', '2027-01-04'], '2026-10-01').join() === '2026/12/28,2027/1/4');
// S6 往復
for (const t of [['', 'ゆい', '2026-09-06', '2026-12-31', ['2026-09-06']], ['教室😀𠮷', '𠮷野🙂', '2026-09-06', '', []], ['＃ピアノ（２Ｆ）', 'ゆい（月曜）', '2026-09-06', '', ['2026-09-07', '2026-09-07']]]) {
  const s = { id: 'z', name: t[1], total: '10', bought: t[2], exp: t[3], used: t[4] };
  const cc = LT.toConfig(t[0], s, []).cfg; const back = cc && LT.decodeHash('#' + LT.encode(cc));
  ok('S6 roundtrip ' + t[1], back && JSON.stringify(back) === JSON.stringify(cc), [cc, back]);
}
// S7 壊れたハッシュ
const good = [1, '', 'ゆい', 10, '2026-09-06', '', ['2026-09-06'], '2026-11-01'];
ok('S7 good', LT.decodeHash(H(good)) !== null);
const w = (i, v) => { const a = good.slice(); a[i] = v; return H(a); };
const bad = {
  empty: '', cut: H(good).slice(0, 20), v2: '#v2=' + H(good).slice(4), notarr: H({ a: 1 }),
  totalStr: w(3, '10'), total0: w(3, 0), total51: w(3, 51), totalFloat: w(3, 2.5), totalNeg: w(3, -1),
  tooMany: H([1, '', 'ゆい', 1, '2026-09-06', '', ['2026-09-06', '2026-09-07'], '2026-11-01']), feb30: w(6, ['2026-02-30']),
  beforeBought: w(6, ['2026-09-05']), unsorted: w(6, ['2026-09-08', '2026-09-07']), usedNum: w(6, [20260907]),
  expBefore: w(5, '2026-09-06'), nameEmpty: w(2, ''), nameLink: w(2, 'a.com'), nameCtl: w(2, 'ゆ\u0000い'),
  madeBad: w(7, 'x'), len7: H(good.slice(0, 7)), big: '#v1=' + 'A'.repeat(4001), hugeUsed: w(6, Array(300).fill('2026-09-06'))
};
for (const k in bad) ok('S7 ' + k, LT.decodeHash(bad[k]) === null);
// S8 文字の制限
const blk = s => LT.toConfig('', Object.assign({}, base, { name: s }), []).cfg === null;
for (const s of ['example.com', 'a@b', '09012345678', '090-1234-5678', '1234567', '振込はこちら', '口座', 'みずほ銀行', 'LINE ID']) ok('S8 block ' + s, blk(s));
for (const s of ['ゆい（月曜）', 'あいうえおかきくけこ']) ok('S8 pass ' + s, !blk(s));
ok('S8 name 11', blk('あいうえおかきくけこさ'));
for (const s of ['ことのはヨガ', 'ピアノ教室 2F']) ok('S8 pass cls ' + s, LT.toConfig(s, base, []).cfg !== null);
ok('S8 cls 20/21', LT.toConfig('あ'.repeat(20), base, []).cfg !== null && LT.toConfig('あ'.repeat(21), base, []).cfg === null);
ok('S8 dup name', LT.toConfig('', Object.assign({}, base, { name: 'ＹＵＩ' }), [{ id: 'q', name: 'yui' }]).cfg === null);
// S9 XSS の文字は core では止めない（画面側は textContent で出す。check.js で確かめる）
const x = LT.toConfig('', Object.assign({}, base, { name: '<b>&"x' }), []);
ok('S9 xss kept as text', x.cfg && x.cfg.name === '<b>&"x');
// 保存データの型そろえ
ok('store sanitize null', LT.sanitizeStore({}) === null && LT.sanitizeStore(null) === null);
const ss = LT.sanitizeStore({ cls: 1, students: [{ id: 'a', name: 'x', total: 10, used: ['2026-01-01', 3, 'bad'] }, { id: 'a', name: 'y' }, 5], sel: 'zz' });
ok('store sanitize', ss.students.length === 2 && ss.students[0].used.length === 1 && ss.students[1].id !== 'a' && ss.sel === 'a', ss);
// 生徒の記録への戻し（S11の芯）
c = LT.toConfig('ことのはヨガ', yui, []).cfg; const sf = LT.studentFrom(c, 'k');
ok('studentFrom', LT.encode(LT.toConfig('ことのはヨガ', sf, [], c.made).cfg) === LT.encode(c));
ok('san', LT.san('ゆいさん') === 'ゆいさん' && LT.san('ゆい') === 'ゆいさん');
// 乱数: 有効な記録はかならず往復し、残り＝回数−件数
let rnd = 0;
for (let i = 0; i < 2000; i++) {
  const total = 1 + Math.floor(Math.random() * 50), n = Math.floor(Math.random() * (total + 1)), b = 20000 + Math.floor(Math.random() * 3000);
  const d = k => new Date((b + k) * 86400000).toISOString().slice(0, 10);
  const s = { id: 'r', name: 'ゆい', total: String(total), bought: d(0), exp: Math.random() < .5 ? '' : d(1 + Math.floor(Math.random() * 400)), used: Array.from({ length: n }, () => d(Math.floor(Math.random() * 300))) };
  const cc = LT.toConfig('', s, []).cfg; const back = cc && LT.decodeHash('#' + LT.encode(cc));
  if (!cc || !back || JSON.stringify(back) !== JSON.stringify(cc) || LT.status(back).left !== total - n) rnd++;
}
ok('random 2000 roundtrip', rnd === 0, rnd);
// レビュー①で足した止める言葉・呼び名の重なり・期限後の印
for (const t of ['未払い5000円', '請求書', '至急お支払い', '¥5000', '5000円', 'PayPay', '督促', '料金']) ok('R1 block ' + t, LT.toConfig(t, base, []).cfg === null);
for (const t of ['円山ヨガ', 'ことのはヨガ', 'ピアノ教室 2F']) ok('R1 pass ' + t, LT.toConfig(t, base, []).cfg !== null);
ok('R1 dup ゆい/ゆいさん', LT.toConfig('', Object.assign({}, base, { name: 'ゆいさん' }), [{ id: 'q', name: 'ゆい' }]).cfg === null && LT.nameKey('先生') === '先生');
ok('R1 afterExp', LT.afterExp({ exp: '2026-10-01' }, '2026-10-20') && !LT.afterExp({ exp: '2026-10-01' }, '2026-10-01') && !LT.afterExp({ exp: '' }, '2026-10-20'));
console.log(ng ? 'NG ' + ng : 'ALL OK'); process.exit(ng ? 1 : 0);

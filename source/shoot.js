// 投稿カード用の素材を撮る（Chrome headless / CDP・DPR2）。実行: node source/shoot.js <出力フォルダ> [--probe]
// 01-x-primary: 見る画面（生徒がリンクを開いたところ）。Card1の値（ゆい・10回券・6回使用）で、教室名〜残りの枠〜期限〜使った日まで
// 02-make-1000: 作る画面 1000px・2列。Card2の値（サンプル4人・りくを選んで今日の1回を記録した直後）で、左に一覧、右に入力と残りの枠
//   （リンクは作らない。共有用URLの欄に撮影用サーバーのアドレスが出るため、写さない）
// 見本はすべて架空。日付は 2026-11-01 を今日として撮る（仕様カード第6節）
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./cdp');
const OUT = path.resolve(process.argv[2] || 'shots');
const PROBE = process.argv.includes('--probe');
fs.mkdirSync(OUT, { recursive: true });
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'));
const PORT = 8796, ORIGIN = 'http://127.0.0.1:' + PORT + '/';
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(HTML); }).listen(PORT);
const rectEv = js => `(()=>{const e=${js};const r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height}})()`;
const union = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
const pad = (a, p) => ({ x: Math.max(0, a.x - p), y: Math.max(0, a.y - p), width: a.w + p * 2, height: a.h + p * 2 });
const click = t => `[...document.querySelectorAll('button')].find(x=>x.textContent===${JSON.stringify(t)}).click()`;
const report = (name, c) => console.log(name, JSON.stringify({ w: Math.round(c.width), h: Math.round(c.height), ratio: +(c.width / c.height).toFixed(3) }));
const NOW = `LT.now=new Date(2026,10,1);window.confirm=()=>true;`;

(async () => {
  const b = await launch(9477);
  await b.send('Network.enable');
  await b.send('Network.setBlockedURLs', { urls: ['*cloudflareinsights.com*'] });

  // 02: 作る画面 1000px（先に作って、ゆいのリンクもここで作る）
  await b.open(ORIGIN, 1000, 2400, 2, false, 'light');
  await b.ev(`localStorage.clear();` + NOW + `LTUI.route()`);
  await b.ev(click('サンプルを入れる')); await b.sleep(150);
  await b.ev(click('今日の1回を記録')); await b.sleep(150);
  const head = await b.ev(rectEv(`document.querySelector('.layout')`));
  const remain = await b.ev(rectEv(`document.querySelector('.layout > div:last-child .remain')`));
  const exp = await b.ev(rectEv(`document.querySelector('.layout > div:last-child .exp-line')`));
  const c2 = pad(union({ x: head.x, y: head.y, w: head.w, h: 1 }, union(remain, exp)), 8); c2.x = 0; c2.width = 1000;
  report('02-make-1000', c2);
  if (!PROBE) await b.shot(path.join(OUT, '02-make-1000.png'), c2);
  // ゆいのリンク
  const url = await b.ev(`LT.makeUrl(${JSON.stringify(ORIGIN)}, LT.toConfig('ことのはヨガ', LTUI.sampleStore().students[0], []).cfg)`);

  // 01: 見る画面。幅600px（本文は最大520px）。375pxだと縦に長くなり、1:1のカードでスクショの占有率が60%に届かないため
  await b.open(url, 600, 1600, 2, true, 'light');
  await b.ev(NOW + `LTUI.route()`); await b.sleep(150);
  const top = await b.ev(rectEv(`document.querySelector('.v-cls')`));
  const days = await b.ev(rectEv(`document.querySelector('.days')`));
  const c1 = pad(union(top, days), 14);
  report('01-x-primary', c1);
  if (!PROBE) await b.shot(path.join(OUT, '01-x-primary.png'), c1);

  b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });

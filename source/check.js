// 実画面の確認（Chrome headless / CDP）。実行: node source/check.js <出力フォルダ>
// 一覧→記録→残り→リンク→開く、375px/880px/1000pxの矩形、ライト/ダーク、使い切り、取り消し、端末の保存（再読み込み・壊れた保存・保存できない端末）、
// 取り込み、共有ボタンの出し分け、XSS、壊れたリンク、最長の値、外部への通信
const fs = require('fs'), path = require('path'), http = require('http');
const { launch } = require('./cdp');
const OUT = path.resolve(process.argv[2] || 'check-out');
fs.mkdirSync(OUT, { recursive: true });
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'));
const PORT = 8786, ORIGIN = 'http://127.0.0.1:' + PORT + '/';
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(HTML); }).listen(PORT);
let ng = 0;
const ok = (name, cond, info) => { if (!cond) ng++; console.log((cond ? 'OK ' : 'NG ') + name + (info !== undefined && !cond ? ' ' + JSON.stringify(info) : '')); };
const measure = `(()=>{const out={sw:document.documentElement.scrollWidth,iw:innerWidth,over:[],small:[]};
  document.querySelectorAll('main *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&r.right>innerWidth+0.5)out.over.push(e.tagName+'.'+e.className)});
  document.querySelectorAll('main button:not([hidden]), main input[type=text], main input[type=date]').forEach(e=>{const r=e.getBoundingClientRect();if(r.width&&(r.height<43.5||r.width<43.5))out.small.push((e.textContent||e.type||e.tagName).slice(0,14)+':'+Math.round(r.width)+'x'+Math.round(r.height))});
  out.over=[...new Set(out.over)].slice(0,8);out.small=out.small.slice(0,8);return out})()`;
const click = t => `(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent===${JSON.stringify(t)});if(!b)throw new Error('no button '+${JSON.stringify(t)});b.click();return true})()`;
const pick = n => `(()=>{const b=[...document.querySelectorAll('.roster button')].find(x=>x.querySelector('.rn').textContent===${JSON.stringify(n)});b.click();return true})()`;
const NOW = `LT.now=new Date(2026,10,1);`;
const remain = `document.querySelector('.remain .rl').textContent`;
const roster = `[...document.querySelectorAll('.roster button')].map(b=>b.innerText.replace(/\\s+/g,' ').trim())`;
const setStore = s => `localStorage.setItem('lesson-ticket-link-v1', ${JSON.stringify(JSON.stringify(s))})`;
const val = (sel, v) => `(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input'));return true})()`;

(async () => {
  const b = await launch(9438);
  const reqs = [];
  b.on(m => { if (m.method === 'Network.requestWillBeSent') reqs.push(m.params.request.url); });
  await b.send('Network.enable');
  await b.send('Network.setBlockedURLs', { urls: ['*cloudflareinsights.com*'] }); // 本番の計測に検算の閲覧を混ぜない
  const errs = [];
  b.on(m => { if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text + ' ' + JSON.stringify(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description)); });
  const reopen = async (url, w, h, dark) => { await b.open(url || ORIGIN, w || 375, h || 900, 2, (w || 375) < 768, dark ? 'dark' : 'light'); await b.ev(NOW + 'window.confirm=()=>true;window.alert=()=>{};LTUI.route()'); await b.sleep(150); };

  // 1) 空の作る画面 375px
  await b.open(ORIGIN, 375, 900, 2, true, 'light'); await b.ev(`localStorage.clear()`); await reopen();
  let m = await b.ev(measure); ok('empty 375 no overflow', m.sw <= 375 && !m.over.length, m); ok('empty 375 targets>=44', !m.small.length, m.small);
  ok('empty roster hint', /まだ生徒がいません/.test(await b.ev(`document.body.innerText`)));
  // 2) サンプル → Card2 の状態（りくを選んで今日の1回を記録）
  await b.ev(click('サンプルを入れる')); await b.sleep(200);
  ok('sample riku before', await b.ev(remain) === 'りくさん 残り2回（5回券）', await b.ev(remain));
  await b.ev(click('今日の1回を記録')); await b.sleep(200);
  let ro = await b.ev(roster);
  ok('card2 roster', JSON.stringify(ro) === JSON.stringify(['ゆい 残り4回／10回券 期限まで60日', 'りく 残り1回／5回券 期限まで29日 残り1回', 'はな 残り2回／8回券 期限切れ', 'そうた 残り11回／12回券 期限なし']), ro);
  ok('card2 riku remain', await b.ev(remain) === 'りくさん 残り1回（5回券）' && /あと29日/.test(await b.ev(`document.querySelector('.exp-line').textContent`)));
  ok('card2 recorded msg', /2026年11月1日（日）の1回を記録しました/.test(await b.ev(`document.body.innerText`)));
  m = await b.ev(measure); ok('sample 375 no overflow', m.sw <= 375 && !m.over.length, m); ok('sample 375 targets', !m.small.length, m.small);
  // 3) 使い切り → それ以上は記録しない → 取り消すで戻る
  await b.ev(click('今日の1回を記録')); await b.sleep(150);
  ok('used up', await b.ev(remain) === 'りくさん 5回券を使い切りました' && /使い切り/.test((await b.ev(roster))[1]));
  await b.ev(click('今日の1回を記録')); await b.sleep(150);
  ok('used up stops', /5回券は5回まで記録できます/.test(await b.ev(`document.body.innerText`)) && (await b.ev(`document.querySelectorAll('.used li').length`)) === 5);
  await b.ev(`document.querySelector('.used li button').click()`); await b.sleep(150);
  ok('undo', await b.ev(remain) === 'りくさん 残り1回（5回券）');
  // 4) 日付を指定して足す（買った日より前は止まる）
  await b.ev(val('.addday input', '2026-10-01')); await b.ev(click('足す')); await b.sleep(120);
  ok('before bought stops', /買った日より前の日は記録できません/.test(await b.ev(`document.body.innerText`)));
  // 5) ゆい → Card1 の値・送る文・リンク
  await b.ev(pick('ゆい')); await b.sleep(150);
  ok('card1 remain', await b.ev(remain) === 'ゆいさん 残り4回（10回券）');
  ok('card1 dots', JSON.stringify(await b.ev(`[document.querySelectorAll('.dots li').length,document.querySelectorAll('.dots li.on').length]`)) === '[10,6]');
  const want = '【ことのはヨガ 回数券】\nゆい さん\n10回券（2026年9月6日に購入）\n使った回数 6回／残り 4回\n有効期限 2026年12月31日（あと60日）\n使った日 9/6・9/13・9/20・9/27・10/4・10/18\n（2026年11月1日 時点）';
  ok('card1 message', await b.ev(`document.querySelector('.msgbox').value`) === want, await b.ev(`document.querySelector('.msgbox').value`));
  await b.ev(click('リンクを作る')); await b.sleep(200);
  const gen = await b.ev(`({len:document.querySelector('.len').textContent,url:document.querySelector('textarea.urlbox').value,msg:document.querySelector('.msgbox').value})`);
  ok('url generated', /#v1=/.test(gen.url) && gen.msg === want + '\nくわしくはこちら\n' + gen.url, gen);
  ok('url length shown', gen.len.indexOf(Array.from(gen.url).length.toLocaleString('ja-JP') + ' / 2,000') >= 0, gen.len);
  fs.writeFileSync(path.join(OUT, 'sample-url.txt'), gen.url);
  console.log('   Card1のURLの長さ', Array.from(gen.url).length);
  // 入力を変えるとリンクの欄が隠れる
  await b.ev(val('#app input', 'ことのはヨガ')); await b.sleep(100);
  ok('link hidden after change', await b.ev(`document.querySelector('.urlbox').closest('.panel').hidden`));
  // 6) 再読み込みで一覧が戻る
  await reopen();
  ro = await b.ev(roster); ok('persist reload', ro.length === 4 && /^ゆい/.test(ro[0]) && await b.ev(remain) === 'ゆいさん 残り4回（10回券）', ro);
  // 7) 見る画面 375px（生徒が開く）
  await reopen(gen.url);
  ok('view banner', /2026年11月1日）の内容です/.test(await b.ev(`document.querySelector('.notice').textContent`)));
  ok('view remain', await b.ev(remain) === 'ゆいさん 残り4回（10回券）' && /あと60日/.test(await b.ev(`document.querySelector('.exp-line').textContent`)));
  ok('view days newest first', JSON.stringify(await b.ev(`[...document.querySelectorAll('.days li')].map(l=>l.textContent)`)) === JSON.stringify(['6回目2026年10月18日（日）', '5回目2026年10月4日（日）', '4回目2026年9月27日（日）', '3回目2026年9月20日（日）', '2回目2026年9月13日（日）', '1回目2026年9月6日（日）']));
  ok('view message', await b.ev(`document.querySelector('.msgbox').value`) === want + '\nくわしくはこちら\n' + gen.url);
  m = await b.ev(measure); ok('view 375 no overflow', m.sw <= 375 && !m.over.length, m); ok('view 375 targets', !m.small.length, m.small);
  ok('view remain visible on first screen', await b.ev(`document.querySelector('.remain').getBoundingClientRect().bottom < innerHeight`), await b.ev(`document.querySelector('.remain').getBoundingClientRect().bottom`));
  await b.shot(path.join(OUT, 'view-375.png'), { x: 0, y: 0, width: 375, height: await b.ev(`document.documentElement.scrollHeight`) });
  // 8) 取り込み: 空の端末 → 追加 ／ 同じ呼び名がいる端末 → 上書き
  await b.ev(`localStorage.clear()`); await reopen(gen.url);
  await b.ev(click('先生用: この内容を自分の一覧に取り込む')); await b.sleep(200);
  ro = await b.ev(roster); ok('import into empty', ro.length === 1 && ro[0] === 'ゆい 残り4回／10回券 期限まで60日' && await b.ev(`document.querySelector('#app input').value`) === 'ことのはヨガ', ro);
  await b.ev(setStore({ cls: 'べつの教室', sel: 'x1', students: [{ id: 'x1', name: 'ＹＵＩ', total: '5', bought: '2026-10-01', exp: '', used: [] }, { id: 'x2', name: 'ほか', total: '5', bought: '2026-10-01', exp: '', used: [] }] }));
  const u2 = gen.url.replace('ことのはヨガ', ''); // 同じURL
  await reopen(u2); await b.ev(`localStorage.setItem('lesson-ticket-link-v1', JSON.stringify({cls:'べつの教室',sel:'x1',students:[{id:'x1',name:'ゆい',total:'5',bought:'2026-10-01',exp:'',used:[]},{id:'x2',name:'ほか',total:'5',bought:'2026-10-01',exp:'',used:[]}]}))`);
  await b.ev(click('先生用: この内容を自分の一覧に取り込む')); await b.sleep(200);
  ro = await b.ev(roster); ok('import overwrite same name', ro.length === 2 && ro[0] === 'ゆい 残り4回／10回券 期限まで60日' && await b.ev(`document.querySelector('#app input').value`) === 'べつの教室', ro);
  // 9) 壊れた保存データは消さない
  await b.ev(`localStorage.clear();localStorage.setItem('lesson-ticket-link-v1','{bad')`); await reopen();
  ok('broken store message', await b.ev(`[...document.querySelectorAll('.errors')].some(e=>!e.hidden&&/読み取れませんでした/.test(e.textContent))`));
  ok('broken store kept', await b.ev(`localStorage.getItem('lesson-ticket-link-v1-backup')`) === '{bad' && await b.ev(`localStorage.getItem('lesson-ticket-link-v1')`) === '{bad');
  // 10) 壊れたリンク
  for (const hsh of ['#v1=', '#v1=abc', '#v2=WzFd', '#v1=' + Buffer.from('[1,"","ゆい",1,"2026-09-06","",["2026-09-06","2026-09-07"],"2026-11-01"]').toString('base64url'), '#x']) {
    await reopen(ORIGIN + hsh);
    ok('broken link ' + hsh.slice(0, 20), /回数券の記録が読み取れませんでした/.test(await b.ev(`document.body.innerText`)) && !(await b.ev(`document.querySelector('.remain')`)));
  }
  // 11) XSS（作る画面の入力・一覧・見る画面）
  await b.ev(`localStorage.clear()`); await reopen();
  await b.ev(click('＋ 生徒を追加')); await b.sleep(100);
  await b.ev(`window.__x=0`);
  await b.ev(val('#app input', '<b onclick=alert(1)>')); await b.ev(`(()=>{const e=document.querySelectorAll('#app input[type=text]')[1];e.value='"><b>x';e.dispatchEvent(new Event('input'))})()`); await b.sleep(150);
  ok('xss make', !(await b.ev(`document.querySelector('#app b, #app img')`)) && /"><b>x/.test(await b.ev(`document.body.innerText`)));
  await b.ev(click('リンクを作る')); await b.sleep(150);
  const xu = await b.ev(`document.querySelector('textarea.urlbox').value`);
  await reopen(xu);
  ok('xss view', !!xu && !(await b.ev(`document.querySelector('#app b, #app img')`)) && /^"><b>xさん/.test(await b.ev(remain)) && /<b onclick=alert\(1\)> 回数券/.test(await b.ev(`document.querySelector('.v-cls').textContent`)), await b.ev(remain));
  // 12) 保存できない端末（setItem が例外）でも記録とリンクは作れる
  const sid = (await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `Storage.prototype.setItem=function(){throw new Error('quota')};` })).result.identifier;
  await reopen();
  ok('no storage message', /この端末では一覧を保存できません/.test(await b.ev(`document.body.innerText`)));
  await b.ev(click('＋ 生徒を追加')); await b.sleep(100);
  await b.ev(`(()=>{const i=[...document.querySelectorAll('#app input[type=text]')];const n=i.find(x=>x.placeholder==='例 ゆい');n.value='ゆい';n.dispatchEvent(new Event('input'))})()`);
  await b.ev(click('今日の1回を記録')); await b.sleep(100); await b.ev(click('リンクを作る')); await b.sleep(150);
  ok('no storage still works', /#v1=/.test(await b.ev(`document.querySelector('textarea.urlbox').value`)) && await b.ev(remain) === 'ゆいさん 残り9回（10回券）', await b.ev(remain));
  await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: sid });
  const sid0 = (await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{delete Navigator.prototype.share}catch(e){}` })).result.identifier;
  await b.ev(`localStorage.clear()`); await reopen(); await b.ev(click('サンプルを入れる')); await b.sleep(100); await b.ev(click('リンクを作る')); await b.sleep(100);
  ok('share hidden w/o navigator.share', await b.ev(`typeof navigator.share`) === 'undefined' && await b.ev(`[...document.querySelectorAll('button')].find(x=>x.textContent==='共有').hidden`));
  await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: sid0 });
  // 13) 共有ボタン（navigator.share がある端末だけ出す・キャンセルは失敗扱いにしない）
  const sid2 = (await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `navigator.share=function(){window.__shared=(window.__shared||0)+1;return Promise.reject(Object.assign(new Error('x'),{name:'AbortError'}))};` })).result.identifier;
  await b.ev(`localStorage.clear()`); await reopen(); await b.ev(click('サンプルを入れる')); await b.sleep(100); await b.ev(click('リンクを作る')); await b.sleep(100);
  ok('share shown', !(await b.ev(`[...document.querySelectorAll('button')].find(x=>x.textContent==='共有').hidden`)));
  await b.ev(click('共有')); await b.sleep(150);
  ok('share abort not error', await b.ev(`window.__shared`) === 1 && !/共有できませんでした/.test(await b.ev(`document.body.innerText`)));
  await b.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: sid2 });
  // 14) 最長の値（呼び名10字・教室名20字・50回券を使い切り）375px・ダーク
  const used50 = Array.from({ length: 50 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i * 3)).toISOString().slice(0, 10));
  await b.ev(`localStorage.clear();` + setStore({ cls: 'ことのはヨガことのはヨガことのはヨガ12', sel: 'L', students: [{ id: 'L', name: 'あいうえおかきくけこ', total: '50', bought: '2026-01-01', exp: '2026-11-10', used: used50 }, { id: 'M', name: 'ＷＷＷＷＷＷＷＷＷＷ', total: '12', bought: '2026-01-01', exp: '2026-11-01', used: ['2026-01-01'] }] }));
  await reopen(null, 375, 900, true);
  m = await b.ev(measure); ok('longest 375 dark no overflow', m.sw <= 375 && !m.over.length, m); ok('longest targets', !m.small.length, m.small);
  ok('longest roster', JSON.stringify(await b.ev(roster)) === JSON.stringify(['あいうえおかきくけこ 残り0回／50回券 使い切り 期限まであと9日', 'ＷＷＷＷＷＷＷＷＷＷ 残り11回／12回券 期限は今日まで']), await b.ev(roster));
  ok('50 dots 5 rows', await b.ev(`new Set([...document.querySelectorAll('.dots li')].map(l=>Math.round(l.getBoundingClientRect().top))).size`) === 5);
  await b.shot(path.join(OUT, 'make-longest-375-dark.png'), { x: 0, y: 0, width: 375, height: await b.ev(`document.documentElement.scrollHeight`) });
  await b.ev(click('リンクを作る')); await b.sleep(100);
  const lu = await b.ev(`document.querySelector('textarea.urlbox').value`);
  console.log('   最長の値のURLの長さ', Array.from(lu).length);
  await reopen(lu, 375, 900, true);
  m = await b.ev(measure); ok('longest view 375 dark', m.sw <= 375 && !m.over.length, m);
  await b.shot(path.join(OUT, 'view-longest-375-dark.png'), { x: 0, y: 0, width: 375, height: await b.ev(`document.documentElement.scrollHeight`) });
  // 15) 880px・1000px（2列）
  await b.ev(`localStorage.clear()`);
  for (const w of [880, 1000]) {
    await reopen(null, w, 1400); await b.ev(click('サンプルを入れる')); await b.sleep(150);
    m = await b.ev(measure);
    const cols = await b.ev(`(()=>{const l=document.querySelector('.layout').children;return [l[0].getBoundingClientRect().left,l[1].getBoundingClientRect().left,l[0].getBoundingClientRect().top===l[1].getBoundingClientRect().top]})()`);
    ok(w + ' two columns', m.sw <= w && !m.over.length && cols[1] > cols[0] && cols[2], [m, cols]);
    await b.shot(path.join(OUT, 'make-' + w + '.png'), { x: 0, y: 0, width: w, height: await b.ev(`document.documentElement.scrollHeight`) });
  }
  await reopen(fs.readFileSync(path.join(OUT, 'sample-url.txt'), 'utf8'), 1000, 1200);
  ok('view 1000 max width', await b.ev(`document.querySelector('.viewpage').getBoundingClientRect().width`) <= 520);
  // 16) 外部への通信・例外
  const ext = reqs.filter(u => !u.startsWith(ORIGIN) && !u.startsWith('data:') && !/cloudflareinsights/.test(u));
  ok('no external requests (except blocked beacon)', !ext.length, ext);
  ok('no exceptions', !errs.length, errs);
  console.log(ng ? 'NG ' + ng : 'ALL OK');
  b.close(); srv.close(); process.exit(ng ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

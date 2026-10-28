// Real desktop Firefox + Violentmonkey execution with locally served fixtures.
// No real Archive traffic, account, loan, Android device or Android UI is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const https = require('node:https');
const {spawn, execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {firefox} = require('playwright');
const {build} = require('../build.cjs');
const driverPath = process.env.QL_GECKODRIVER;
const xpi = process.env.QL_VIOLENTMONKEY_XPI;
assert.ok(driverPath && xpi, 'Set QL_GECKODRIVER and QL_VIOLENTMONKEY_XPI to local test dependencies');
const source = fs.readFileSync(process.env.QL_SOURCE || path.join(__dirname, '../Quiet-Leaf-Firefox.user.js'), 'utf8');
if (!process.env.QL_SOURCE) assert.equal(source, build(), 'Generated userscript is stale');
const manifest = JSON.parse(execFileSync('unzip', ['-p', xpi, 'manifest.json'], {encoding:'utf8'}));
const managerID = '{aecec67f-0d10-4fa7-b7c7-609a2db280cf}';
assert.equal(manifest.browser_specific_settings.gecko.id, managerID, 'Expected official Violentmonkey package');
const uuid = 'b06dfd34-83a2-4cdb-8f9e-64932176321d';
const MARK = '[Quiet Leaf progress v1]';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-leaf-manager-'));
  let driver, session, proxy, fixtureServer, driverRequest, driverLogs = '';
  const sockets = new Set();
  try {
    execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=archive.org',
      '-keyout',path.join(temp, 'key.pem'),'-out',path.join(temp, 'cert.pem')], {stdio:'ignore'});
    const db = {test:{7:{color:0, note:MARK}}}, requests = [];
    fixtureServer = https.createServer({key:fs.readFileSync(path.join(temp, 'key.pem')), cert:fs.readFileSync(path.join(temp, 'cert.pem'))}, async (req, res) => {
      try {
        const url = new URL(req.url, 'https://archive.org');
        if (url.pathname === '/services/bookmarks.php') {
          requests.push({method:req.method, cookie:req.headers.cookie || ''});
          assert.match(req.headers.cookie || '', /ql-test-session=present/, 'Bookmark request must retain the site session');
          const identifier = url.searchParams.get('identifier');
          const bookmarks = db[identifier] ||= {};
          const index = url.searchParams.get('page_num');
          let body = ''; for await (const chunk of req) body += chunk;
          if (req.method === 'POST') bookmarks[index] = JSON.parse(body).notes;
          if (req.method === 'DELETE') delete bookmarks[index];
          res.writeHead(200, {'Content-Type':'application/json'});
          res.end(JSON.stringify({success:true, value:Object.fromEntries(Object.entries(bookmarks).map(([i, notes]) => [i, {notes}]))}));
          return;
        }
        const scripts = {'/jquery.js':require.resolve('jquery/dist/jquery.js'), '/jquery-ui.js':require.resolve('jquery-ui-dist/jquery-ui.js'), '/fixture.js':path.join(__dirname, 'native-fixture.js')};
        if (scripts[url.pathname]) {
          res.writeHead(200, {'Content-Type':'text/javascript'}); res.end(fs.readFileSync(scripts[url.pathname])); return;
        }
        res.writeHead(200, {'Content-Type':'text/html', 'Set-Cookie':'ql-test-session=present; Secure; HttpOnly; SameSite=Lax; Path=/',
          'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'"});
        res.end('<!doctype html><html><body><style>body{margin:0}.BRpagecontainer{position:relative;width:600px;height:900px}.BRpageimage{width:100%}.BRtextLayer{position:absolute;top:0;left:0;color:transparent}.BRparagraphElement{line-height:0}.BRlineElement{display:inline-block;white-space:nowrap}</style><button class="BRicon onepg"></button><button class="BRicon book_right"></button><button class="BRicon book_left"></button><div class="BRpager"></div><ia-bookmarks-list></ia-bookmarks-list><section></section><script src="/jquery.js"></script><script src="/jquery-ui.js"></script><script src="/fixture.js"></script></body></html>');
      } catch (error) {
        res.writeHead(500, {'Content-Type':'application/json'}); res.end(JSON.stringify({success:false, error:error.message}));
      }
    });
    // The proxy handles only the fake Archive origin. No fixture or bookmark
    // request reaches the real service. The certificate is trusted only in this
    // disposable WebDriver profile via acceptInsecureCerts.
    proxy = http.createServer((req, res) => { res.writeHead(502); res.end(); });
    proxy.on('connect', (req, socket, head) => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => {});
      if (req.url !== 'archive.org:443') { socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'); return; }
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length) socket.unshift(head);
      fixtureServer.emit('connection', socket);
    });
    const proxyPort = await listen(proxy);
    const reservation = http.createServer(); const driverPort = await listen(reservation);
    await new Promise(resolve => reservation.close(resolve));
    driver = spawn(driverPath, ['--host','127.0.0.1','--port',String(driverPort)], {stdio:['ignore','pipe','pipe']});
    driver.on('error', error => { driverLogs += error.message; });
    for (const stream of [driver.stdout, driver.stderr]) stream.on('data', chunk => { driverLogs = (driverLogs + chunk).slice(-12000); });
    async function request(method, route, body) {
      const response = await fetch('http://127.0.0.1:' + driverPort + route, {method, headers:{'Content-Type':'application/json'},
        ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(30000)});
      const result = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(result));
      return result.value;
    }
    driverRequest = request;
    for (let attempt = 0; ; attempt++) {
      try { await request('GET', '/status'); break; }
      catch (error) { if (attempt >= 50) throw error; await pause(100); }
    }
    const started = await request('POST', '/session', {capabilities:{alwaysMatch:{browserName:'firefox', acceptInsecureCerts:true,
      proxy:{proxyType:'manual', httpProxy:'127.0.0.1:' + proxyPort, sslProxy:'127.0.0.1:' + proxyPort, noProxy:['localhost','127.0.0.1']},
      'moz:firefoxOptions':{binary:process.env.QL_FIREFOX_BINARY || firefox.executablePath(), args:['-headless'],
        prefs:{'extensions.webextensions.uuids':JSON.stringify({[managerID]:uuid})}}}}});
    session = started.sessionId;
    const command = (route, body) => request('POST', '/session/' + session + route, body);
    const evaluate = (script, ...args) => command('/execute/sync', {script, args});
    const wait = async (script, label) => {
      const began = Date.now();
      while (!await evaluate(script)) {
        if (Date.now() - began > 12000) throw new Error('Timed out: ' + label + '\n' + JSON.stringify(await evaluate('return {native:window.fixture, status:document.querySelector("#quiet-leaf-reader")?.shadowRoot.querySelector(".status").textContent,error:document.querySelector("#quiet-leaf-reader")?.shadowRoot.querySelector(".error").textContent};')));
        await pause(80);
      }
    };
    const focused = index => wait('const r=document.querySelector("#quiet-leaf-reader")?.shadowRoot; return r?.querySelector(".position").textContent==="Page n' + index + '" && !r.querySelector(".layout").disabled;', 'display scan ' + index);
    const click = selector => evaluate('document.querySelector("#quiet-leaf-reader").shadowRoot.querySelector(arguments[0]).click();', selector);
    const close = () => click('.exit');
    const open = async () => {
      await wait('const image=document.querySelector("section img"); return image?.complete && image.naturalWidth;', 'native image');
      await evaluate('document.querySelector("#quiet-leaf-launch").click();');
    };
    await command('/timeouts', {script:15000, pageLoad:15000});
    await command('/moz/addon/install', {path:path.resolve(xpi), temporary:true});
    await command('/url', {url:'moz-extension://' + uuid + '/options/index.html'});
    // Bootstrap via the real manager's parser/storage, then let it inject the
    // unchanged package automatically. This is not an Android installation-UI test.
    const installed = await command('/execute/async', {script:'const done=arguments[arguments.length-1]; browser.runtime.sendMessage({cmd:"ParseScript",data:{code:arguments[0],config:{shouldUpdate:0}}}).then(result=>done({errors:result.errors,meta:result.update?.meta}),error=>done({error:String(error)}));', args:[source]});
    assert.equal(installed.error, undefined); assert.equal(installed.errors, null); assert.equal(installed.meta.injectInto, 'content');
    console.log('Manager: Firefox ' + started.capabilities.browserVersion + ', Violentmonkey ' + manifest.version + ', XPI SHA256 ' + createHash('sha256').update(fs.readFileSync(xpi)).digest('hex'));

    // No slider or URL index: both directions of object-valued DOM events must
    // cross the real manager/content/page boundary to restore the remote marker.
    await command('/url', {url:'https://archive.org/details/test?fallback'});
    await wait('return !!document.querySelector("#quiet-leaf-launch");', 'automatic manager injection under CSP');
    await open(); await focused(7);
    assert.deepEqual(await evaluate('return fixture.bookmarkEvents;'), [7]);
    assert.ok(requests.length); assert.ok(requests.every(req => req.cookie.includes('ql-test-session=present')));
    await click('.controls-toggle');
    assert.equal(await evaluate('return document.querySelector("#quiet-leaf-reader").shadowRoot.querySelector(".bar").hidden;'), false);
    await click('.hide'); await click('.bookmark');
    await wait('return document.querySelector("#quiet-leaf-reader").shadowRoot.querySelector(".bookmark").textContent.includes("✓");', 'blue bookmark');
    assert.equal(db.test[7].color, 1);
    await close(); await command('/refresh', {}); await open(); await focused(7);
    console.log('PASS real Violentmonkey content injection under CSP, page-realm bookmark fallback, inbound index event, session cookie, blue bookmark and reload/resume');

    await close();
    await command('/url', {url:'https://archive.org/details/slider/page/n0'});
    await wait('return !!document.querySelector("#quiet-leaf-launch");', 'slider-page injection');
    await open(); await focused(0);
    const tap = x => evaluate('const s=document.querySelector("#quiet-leaf-reader").shadowRoot.querySelector(".stage"); const r=s.getBoundingClientRect(); for(const type of ["pointerdown","pointerup"])s.dispatchEvent(new PointerEvent(type,{pointerId:1,pointerType:"touch",clientX:r.left+r.width*arguments[0],clientY:200,bubbles:true}));', x);
    await tap(.8); await focused(1);
    assert.equal(await evaluate('return fixture.activity;'), 1);
    await tap(.05); await focused(0);
    assert.equal(await evaluate('return JSON.parse(localStorage.getItem("quiet-leaf:v1:slider")).farthest;'), 1);
    await click('.controls-toggle');
    await evaluate('const select=document.querySelector("#quiet-leaf-reader").shadowRoot.querySelector(".layout"); select.value="scroll";select.dispatchEvent(new Event("change"));');
    await wait(`return !!document.querySelector("#quiet-leaf-reader").shadowRoot.querySelector(".scroll-page[data-index='1'] canvas");`, 'scroll prefetch');
    assert.equal(await evaluate('return JSON.parse(localStorage.getItem("quiet-leaf:v1:slider")).farthest;'), 1);
    assert.equal(await evaluate('return fixture.activity;'), 2);
    await evaluate(`const s=document.querySelector("#quiet-leaf-reader").shadowRoot.querySelector(".stage");s.dispatchEvent(new WheelEvent("wheel"));s.scrollTop=s.querySelector(".scroll-page[data-index='1']").offsetTop;`);
    await focused(1);
    await close();
    db.slider[30] = {color:0, note:MARK};
    await open(); await focused(30);
    assert.equal(await evaluate(`return !!document.querySelector("#quiet-leaf-reader").shadowRoot.querySelector(".scroll-page[data-index='31']");`), false);
    assert.ok(await evaluate('return !!document.querySelector("#quiet-leaf-reader").shadowRoot.querySelector(".BRwordElement");'));
    await close();
    console.log('PASS real manager slider keyboard events, synthetic touch zones/activity, backward progress, continuous prefetch/scroll, final boundary and native text-layer copy');
    await request('DELETE', '/session/' + session); session = null;
  } catch (error) {
    console.error(driverLogs); throw error;
  } finally {
    // geckodriver removes its own disposable Firefox profile on normal exit.
    if (session && driverRequest) await driverRequest('DELETE', '/session/' + session).catch(() => {});
    driver?.kill();
    for (const socket of sockets) socket.destroy();
    proxy?.close(); fixtureServer?.close();
    fs.rmSync(temp, {recursive:true, force:true});
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

const {JSDOM}=require('jsdom');
const assert=require('node:assert/strict');
const {source}=require('./support.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label='condition',ms=4500){const start=Date.now();while(!fn()){if(Date.now()-start>ms)throw new Error('Timed out: '+label);await sleep(25);}}
function fixture({saved=null,bookmarks={},start=0,textDelay=0,href,config,aria=true,pageNum,rtl=false,textHTML,expectId='test'}={}){
 const dom=new JSDOM('<!doctype html><body><div id="BookReader"><button class="BRicon onepg"></button><button class="BRicon book_right"></button><button class="BRicon book_left"></button><div aria-label="Page navigation slider" aria-valuemax="99"></div><ia-bookmarks-list></ia-bookmarks-list><section></section></div></body>',{url:href||`https://archive.org/details/test#page/n${start}/mode/1up`,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;const f={dom,w,d,index:start,db:structuredClone(bookmarks),calls:[],activity:0,emitNative:true,offline:false,failPosts:false,broken:new Set(),navigation:[],clock:0,leafRequests:[],failReturns:0,failReturnTo:null,keys:[]};
 const realNow=Date.now;w.Date.now=()=>realNow()+f.clock;
 w.alert=()=>{};w.confirm=()=>true;w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});
 w.Element.prototype.getClientRects=()=>[{width:600,height:900}];let fullscreen=null;
 Object.defineProperty(d,'fullscreenElement',{get:()=>fullscreen});
 w.HTMLElement.prototype.requestFullscreen=function(){fullscreen=this;d.dispatchEvent(new w.Event('fullscreenchange'));return Promise.resolve();};
 d.exitFullscreen=()=>{fullscreen=null;d.dispatchEvent(new w.Event('fullscreenchange'));return Promise.resolve();};
 w.fetch=async(url,options)=>{
  f.calls.push({url,method:options.method,body:options.body});if(f.offline)throw new Error('offline');
  const u=new URL(url),index=u.searchParams.get('page_num');
  assert.equal(u.pathname,'/services/bookmarks.php');assert.equal(u.searchParams.get('identifier'),expectId);assert.equal(options.credentials,'same-origin');
  if(options.method==='POST'){if(f.failPosts)return {ok:true,json:async()=>({success:false,error:'denied'})};f.db[index]=JSON.parse(options.body).notes;}
  if(options.method==='DELETE')delete f.db[index];
  const value=Object.fromEntries(Object.entries(f.db).map(([i,notes])=>[i,{notes:structuredClone(notes)}]));
  return {ok:true,json:async()=>({success:true,value})};
 };
 function supply(index){const el=d.createElement('div');el.className='BRpagecontainer';el.dataset.index=index;el.dataset.pageNum=index===start&&pageNum!=null?pageNum:index+1;const img=d.createElement('img');img.className='BRpageimage';Object.defineProperties(img,{complete:{value:true},naturalWidth:{value:1200},naturalHeight:{value:1800}});el.append(img);d.querySelector('section').replaceChildren(el);
 const addText=()=>{const layer=d.createElement('div');layer.className='BRPageLayer BRtextLayer';layer.dir='ltr';layer.style.cssText='width:1200px;height:1800px;transform:scale(.5)';layer.innerHTML=textHTML||'<p class="BRparagraphElement" style="left:100px;top:200px;width:800px;height:40px;font-size:32px"><span class="BRlineElement"><span class="BRwordElement">Librarian</span> <span class="BRwordElement">goblins</span></span></p>';el.append(layer);};
 if(textDelay)w.setTimeout(addText,textDelay);else addText();}
 function navigate(index,activity=false){
  if(activity&&f.emitNative)w.dispatchEvent(new w.CustomEvent('BookReader:userAction'));
  if(index===f.index)return;f.index=index;f.navigation.push(index);w.location.hash=`page/${index+1}/mode/1up`;d.querySelector('[aria-valuemax]').setAttribute('aria-valuenow',index);
  d.querySelector('section').replaceChildren();w.dispatchEvent(new w.CustomEvent('BookReader:pageChanged',{detail:{props:{firstIndex:index}}}));
  if(!f.broken.has(index))w.setTimeout(()=>{if(f.index===index)supply(index);},60);
 }
 d.querySelector('.book_right').onclick=()=>navigate(f.index+1,true);d.querySelector('.book_left').onclick=()=>navigate(f.index-1,true);d.querySelector('.onepg').onclick=()=>{};
 d.querySelector('ia-bookmarks-list').addEventListener('bookmarkSelected',e=>{
  const index=e.detail.bookmark.leafNum;f.leafRequests.push(index);
  if(f.failReturns&&index===f.failReturnTo){f.failReturns--;return;}
  navigate(index);
 });
 w.addEventListener('BookReader:userAction',()=>f.activity++);supply(start);
 if(config){const input=d.createElement('input');input.className='js-bookreader';input.value=JSON.stringify(config);d.body.append(input);}
 if(rtl){
  const pager=d.createElement('div');pager.className='BRpager';
  const handle=d.querySelector('[aria-label="Page navigation slider"]');
  pager.append(handle);d.querySelector('#BookReader').append(pager);
  let staged=null;
  handle.addEventListener('keydown',event=>{
   let code=event.keyCode||event.which;f.keys.push(event.key);
   if(code!==37&&code!==39)return;
   code=code===37?39:37;
   staged=Math.max(0,Math.min(99,(staged??f.index)+(code===39?1:-1)));
  });
  handle.addEventListener('keyup',()=>{if(staged==null)return;const index=staged;staged=null;navigate(index);});
 }
 const key='quiet-leaf:v1:'+expectId;if(saved)w.localStorage.setItem(key,JSON.stringify(saved));
 if(aria)d.querySelector('[aria-valuemax]').setAttribute('aria-valuenow',start);w.eval(source);f.progress=()=>JSON.parse(w.localStorage.getItem(key)||'{}');
 f.open=async()=>{d.querySelector('#quiet-leaf-launch').click();await until(()=>!!d.querySelector('#quiet-leaf-reader'),'reader opens');f.host=d.querySelector('#quiet-leaf-reader');f.ui=f.host.shadowRoot;await until(()=>!f.ui.querySelector('.bookmark').disabled,'bootstrap');};
 f.click=sel=>f.ui.querySelector(sel).click();
 f.tap=x=>{const stage=f.ui.querySelector('.stage');stage.getBoundingClientRect=()=>({left:0,width:1200});for(const type of ['pointerdown','pointerup']){const e=new w.Event(type);Object.assign(e,{clientX:x,clientY:100,pointerId:1,isPrimary:true});stage.dispatchEvent(e);}};
 f.at=index=>f.ui.querySelector('.position').textContent==='Page '+(index+1);
 f.pointer=(type,id,x,y=100)=>{const event=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{clientX:x,clientY:y,pointerId:id,isPrimary:id===1,pointerType:'touch'});f.ui.querySelector('.stage').dispatchEvent(event);return event;};
 f.close=()=>dom.window.close();return f;
}
(async()=>{
 const MARK='[Quiet Leaf progress v1]';
 // Native activity de-duplication, 1:5 zones, red progress, blue collision, previous-page protection.
 let f=fixture();await f.open();await until(()=>f.db[0]?.color===0,'initial red marker');
 f.tap(250);await until(()=>f.at(1),'right five-sixths advances');assert.equal(f.activity,1);assert.equal(f.progress().farthest,1);
 await until(()=>f.db[1]&&!f.db[0],'red marker moves');assert.equal(f.db[1].color,0);
 f.click('.bookmark');await until(()=>f.db[1]?.color===1,'native blue save');
 f.emitNative=false;f.tap(250);await until(()=>f.at(2),'activity fallback');assert.equal(f.activity,2);
 await until(()=>f.db[2]&&!f.db[1].note.includes(MARK),'progress moved off blue');assert.equal(f.db[1].color,1);
 f.tap(100);await until(()=>f.at(1),'left sixth goes back');assert.equal(f.progress().farthest,2);
 f.click('.resume');await until(()=>f.at(2),'return to farthest');
 // Failed scan never advances progress; old canvas remains; retry rebuilds failed native page.
 f.broken.add(3);f.tap(900);await until(()=>f.index===3,'native attempted failed page');f.clock+=16000;
 await until(()=>!f.ui.querySelector('.error').hidden,'recoverable failure');assert.equal(f.progress().farthest,2);assert.equal(f.ui.querySelectorAll('canvas').length,1);assert.ok(f.at(2));
 f.broken.delete(3);f.clock=0;f.click('.retry');await until(()=>f.at(3),'retry navigates away and back');assert.equal(f.progress().farthest,3);
 await until(()=>f.db[3]&&!f.db[2],'marker after recovered page');
 // Failure to save must not destroy the old confirmed marker.
 f.failPosts=true;f.tap(900);await until(()=>f.at(4),'local page during API failure');await until(()=>f.ui.querySelector('.status').textContent.includes('sync pending'),'pending indicator');await sleep(900);
 assert.equal(f.progress().farthest,4);assert.ok(f.db[3]);assert.equal(f.db[4],undefined);
 f.failPosts=false;f.click('.sync');await until(()=>f.db[4]&&!f.db[3],'sync retry');
 // Reset backwards doesn't erase a manual blue bookmark; reset applies to displayed page.
 f.tap(100);await until(()=>f.at(3),'back before reset');f.click('.reset');await until(()=>f.db[3]&&!f.db[4],'reset synced');assert.equal(f.progress().farthest,3);assert.equal(f.db[1].color,1);
 // Wake checks preserve progress and do not synthesize reading activity.
 const activityBeforeWake=f.activity;f.d.dispatchEvent(new f.w.Event('visibilitychange'));await sleep(250);assert.equal(f.activity,activityBeforeWake);assert.equal(f.progress().farthest,3);assert.ok(f.at(3));
 // Fullscreen close while loading is cancellable; native page remains usable, saved farthest unchanged.
 f.broken.add(4);f.tap(900);await until(()=>f.index===4,'pending exit');await f.d.exitFullscreen();assert.ok(f.d.querySelector('#quiet-leaf-reader'),'leaving fullscreen must keep Quiet Leaf open');assert.equal(f.progress().farthest,3);f.click('.exit');assert.equal(f.d.querySelector('#quiet-leaf-reader'),null);f.close();
 console.log('PASS navigation/activity/zones, moving red, blue collision, recoverable failure/retry, API failure safety, reset, fullscreen cleanup');
 // Resume remote progress before recording the initial cover; preserve pre-existing untagged red note-less bookmarks.
 f=fixture({bookmarks:{7:{color:0,note:MARK},8:{color:0,note:''},2:{color:2,note:'Keep my note'}}});await f.open();await until(()=>f.at(7),'remote resume');assert.equal(f.progress().farthest,7);
 f.tap(900);await until(()=>f.at(8),'existing red bookmark');await until(()=>f.db[8].note.includes('preserve bookmark'),'ownership tag');
 f.tap(900);await until(()=>f.at(9),'move again');await until(()=>f.db[9]&&f.db[8].note==='','unmanaged red retained');assert.equal(f.db[8].color,0);assert.deepEqual(f.db[2],{color:2,note:'Keep my note'});f.close();
 console.log('PASS remote auto-resume and preservation of existing red/green bookmarks and notes');
 // Local backup wins while offline, and a failed displayed leaf never invents a remote save.
 f=fixture({saved:{farthest:5,last:5,label:'6',updated:1}});f.offline=true;await f.open();await until(()=>f.at(5),'offline local resume');assert.equal(f.progress().farthest,5);assert.match(f.ui.querySelector('.status').textContent,/Archive/);f.close();
 console.log('PASS local resume without Archive service');
 // Native OCR remains selectable and aligned; its delayed arrival doesn't replace the scan.
 f=fixture({textDelay:100});await f.open();await until(()=>f.ui.querySelector('.BRwordElement'),'delayed native selection layer');
 const layer=f.ui.querySelector('.BRtextLayer'),stage=f.ui.querySelector('.stage');
 assert.equal(layer.textContent,'Librarian goblins');assert.notEqual(layer,f.d.querySelector('.BRtextLayer'));
 stage.getBoundingClientRect=()=>({left:0,top:0,width:1200,height:900});f.w.dispatchEvent(new f.w.Event('resize'));
 assert.equal(layer.style.transform,'scale(0.5,0.5)');assert.equal(layer.style.left,'300px');assert.equal(layer.style.top,'0px');
 assert.ok(f.ui.querySelector('style').textContent.includes('-webkit-touch-callout:default'));
 // Holding/context menu never opens controls, blocks Safari, or turns a page.
 f.pointer('pointerdown',1,500);f.clock+=700;
 const context=new f.w.Event('contextmenu',{cancelable:true});stage.dispatchEvent(context);assert.equal(context.defaultPrevented,false);
 f.pointer('pointerup',1,500);assert.ok(f.ui.querySelector('.bar').hidden);assert.ok(f.at(0));f.clock=0;
 f.pointer('pointerdown',1,500);f.clock+=400;f.pointer('pointerup',1,500);assert.ok(f.at(0));f.clock=0;
 // Two-finger tap opens controls without turning; pinch/movement cannot trigger it.
 f.pointer('pointerdown',1,400);f.pointer('pointerdown',2,700);f.pointer('pointerup',1,400);f.pointer('pointerup',2,700);
 assert.equal(f.ui.querySelector('.bar').hidden,false);assert.ok(f.at(0));f.click('.hide');
 f.pointer('pointerdown',1,400);f.pointer('pointerdown',2,700);f.pointer('pointermove',2,750);f.pointer('pointerup',1,400);f.pointer('pointerup',2,750);assert.ok(f.ui.querySelector('.bar').hidden);assert.ok(f.at(0));
 // The context menu/hold arms a persistent dismissal latch, even if the browser
 // exposes no selection by the time the dismissal tap reaches pointerdown.
 f.tap(900);assert.ok(f.at(0));
 f.pointer('pointerdown',1,500);f.clock+=600;f.pointer('pointercancel',1,500);f.clock=0;
 f.tap(900);assert.ok(f.at(0));
 // A tap dismissing selected text must not turn the page.
 const getSelection=f.w.getSelection;f.w.getSelection=()=>({isCollapsed:false,toString:()=> 'Librarian'});
 f.pointer('pointerdown',1,500);f.w.getSelection=getSelection;f.pointer('pointerup',1,500);assert.ok(f.at(0));
 // Selectionchange can precede the clearing that Safari does before pointerdown.
 f.w.getSelection=()=>({isCollapsed:false,toString:()=> 'Librarian'});f.d.dispatchEvent(new f.w.Event('selectionchange'));f.w.getSelection=getSelection;
 f.tap(900);assert.ok(f.at(0));
 f.tap(900);await until(()=>f.at(1),'tap still advances after lookup');await until(()=>f.ui.querySelector('.BRwordElement'),'new page selection layer');
 f.click('.exit');assert.equal(f.d.querySelector('#quiet-leaf-reader'),null);assert.ok(f.d.querySelector('.BRtextLayer'));f.close();
 console.log('PASS native text layer, late arrival, resize alignment, long press, two-finger controls, pinch, selection dismissal, and cleanup');
 // A touch whose pointerup lands outside .stage must not stick and block the next tap.
 f=fixture();await f.open();
 f.tap(900);await until(()=>f.at(1),'first tap');
 f.tap(900);await until(()=>f.at(2),'two taps reach page 3');
 const outsideStage=f.ui.querySelector('.stage');
 outsideStage.getBoundingClientRect=()=>({left:0,top:0,width:1200,height:900});
 const point=(type,target,id,y)=>{const e=new f.w.Event(type,{bubbles:true,composed:true,cancelable:true});Object.assign(e,{clientX:900,clientY:y,pointerId:id,pointerType:'touch',isPrimary:true});target.dispatchEvent(e);};
 point('pointerdown',outsideStage,4,400);
 point('pointerup',f.ui.querySelector('.bar'),4,12);
 assert.ok(f.at(2),'pointerup on the controls bar does not turn the page');
 f.tap(900);await until(()=>f.at(3),'tap turns after a pointerup outside .stage');
 f.close();
 console.log('PASS pointerup outside .stage does not leave a stale touch');
 f=fixture();await f.open();
 const paperFilter=()=>f.host.style.getPropertyValue('--quiet-leaf-paper-filter');
 assert.match(paperFilter(),/saturate/);
 const slider=f.ui.querySelector('.contrast');slider.value='130';slider.dispatchEvent(new f.w.Event('input'));
 slider.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,composed:true}));assert.ok(f.at(0),'slider arrow must not turn page');
 assert.equal(JSON.parse(f.w.localStorage.getItem('quiet-leaf:paper:v1:test')).contrast,130);
 const paperSelect=f.ui.querySelector('.paper');paperSelect.value='original';paperSelect.dispatchEvent(new f.w.Event('change'));
 assert.equal(paperFilter(),'none');assert.equal(slider.disabled,true);
 f.click('.exit');await f.open();assert.equal(paperFilter(),'none');assert.equal(f.ui.querySelector('.contrast').value,'130');
 f.close();console.log('PASS reversible paper correction, retained preferences and slider keyboard isolation');
 // Keyboard turns a page; Tab stays inside the dialog; exit restores Read quietly.
 f=fixture();await f.open();
 f.host.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true,composed:true}));
 await until(()=>f.at(1),'ArrowRight advances');
 f.host.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true,composed:true}));
 await until(()=>f.at(0),'ArrowLeft goes back');
 const tab=shift=>new f.w.KeyboardEvent('keydown',{key:'Tab',shiftKey:!!shift,bubbles:true,cancelable:true,composed:true});
 f.host.dispatchEvent(tab());
 assert.equal(f.ui.activeElement,f.ui.querySelector('.controls-toggle'));
 f.ui.querySelector('.controls-toggle').click();
 const contrast=f.ui.querySelector('.contrast');contrast.focus();contrast.dispatchEvent(tab());
 assert.equal(f.ui.activeElement,f.ui.querySelector('.brightness'));
 f.ui.querySelector('.brightness').dispatchEvent(tab());
 assert.equal(f.ui.activeElement,f.ui.querySelector('.controls-toggle'));
 f.ui.querySelector('.controls-toggle').dispatchEvent(tab(true));
 assert.equal(f.ui.activeElement,f.ui.querySelector('.brightness'));
 f.click('.exit');
 assert.equal(f.d.activeElement,f.d.querySelector('#quiet-leaf-launch'));
 await f.open();
 f.host.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,composed:true}));
 assert.equal(f.d.querySelector('#quiet-leaf-reader'),null);
 assert.equal(f.d.activeElement,f.d.querySelector('#quiet-leaf-launch'));
 f.close();
 console.log('PASS keyboard page turns, dialog focus trap and return to Read quietly');
 // A missed return to the failed leaf is retried; the neighbour is not the final Archive index.
 f=fixture();await f.open();
 f.tap(900);await until(()=>f.at(1),'page before failed leaf');
 f.tap(900);await until(()=>f.at(2),'leaf before the failure');
 f.broken.add(3);f.tap(900);await until(()=>f.index===3,'native attempted failed page');f.clock+=16000;
 await until(()=>!f.ui.querySelector('.error').hidden,'failed leaf');assert.equal(f.progress().farthest,2);
 f.broken.delete(3);f.clock=0;f.failReturns=1;f.failReturnTo=3;f.click('.retry');
 await until(()=>f.at(3),'restore the failed leaf after the return misses',8000);
 assert.equal(f.index,3);assert.equal(f.progress().farthest,3);
 assert.ok(f.leafRequests.filter(i=>i===3).length>=2,'return and restore both select the failed leaf');
 assert.equal(f.leafRequests.includes(2),true);
 f.close();
 // At the first leaf the neighbour is the next leaf, then retry returns to leaf 0.
 f=fixture();await f.open();
 f.tap(900);await until(()=>f.at(1),'leave the first leaf');
 f.broken.add(0);f.tap(100);f.clock+=16000;await until(()=>!f.ui.querySelector('.error').hidden,'failed return to the first leaf');
 f.broken.delete(0);f.clock=0;f.click('.retry');
 await until(()=>f.at(0),'retry from the first leaf returns to it',8000);
 assert.equal(f.index,0);assert.equal(f.leafRequests.at(-2),1);assert.equal(f.leafRequests.at(-1),0);
 f.close();
 console.log('PASS failed-leaf retry confirms the return and restores a missed jump');
 // Hostile text-layer nodes are rebuilt from the allowlist.
 const hostile='<p class="BRparagraphElement extra" style="left:100px;top:200px;width:800px;height:40px;font-size:32px;margin-left:100px;background:url(https://evil.example/x.png)"><span class="BRlineElement"><span class="BRwordElement extra" onclick="alert(1)">Librarian</span> <a href="javascript:alert(1)"><span class="BRwordElement BRwordElement--hyphen">goblins</span></a></span></p><script>alert(1)</script><img src="https://evil.example/x.png"><object data="https://evil.example/x.swf"></object><iframe src="https://evil.example/"></iframe>';
 f=fixture({textHTML:hostile});await f.open();
 const copied=f.ui.querySelector('.BRtextLayer'),markup=copied.innerHTML.toLowerCase();
 assert.equal(copied.textContent.includes('Librarian'),true);assert.equal(copied.textContent.includes('goblins'),true);
 for(const banned of ['javascript:','<img','<object','<iframe','<script','onclick','evil.example','extra','background'])assert.equal(markup.includes(banned),false,banned);
 assert.match(copied.querySelector('.BRparagraphElement').getAttribute('style'),/left:\s*100px/i);
 assert.match(copied.querySelector('.BRparagraphElement').getAttribute('style'),/margin-left:\s*100px/i);
 assert.equal(copied.querySelector('.BRwordElement--hyphen').textContent,'goblins');
 assert.equal(copied.getAttribute('dir'),'ltr');
 f.close();
 console.log('PASS text-layer allowlist drops active content and keeps word geometry');
 // subPrefix containing .. is not used as the bookmark identifier.
 f=fixture({config:{url:'https://archive.org/BookReader/BookReaderJSIA.php?subPrefix=../other-item'}});
 await f.open();await until(()=>f.calls.length,'bookmark request');
 assert.equal(new URL(f.calls[0].url).searchParams.get('identifier'),'test');f.close();
 f=fixture({config:{url:'https://archive.org/BookReader/BookReaderJSIA.php?subPrefix=item/../other'},expectId:'test'});
 await f.open();await until(()=>f.calls.length,'nested traversal ignored');f.close();
 f=fixture({config:{url:'https://archive.org/BookReader/BookReaderJSIA.php?subPrefix=%2e%2e%2Fother'},expectId:'test'});
 await f.open();await until(()=>f.calls.length,'encoded traversal ignored');f.close();
 f=fixture({config:{url:'https://archive.org/BookReader/BookReaderJSIA.php?subPrefix=vol1'},expectId:'test/vol1'});
 await f.open();await until(()=>f.calls.length,'volume prefix kept');
 assert.equal(new URL(f.calls[0].url).searchParams.get('identifier'),'test/vol1');f.close();
 console.log('PASS bookmark identifiers reject dot segments and keep a volume subPrefix');
 // A printed-page URL is not a leaf index. The loaded container supplies data-index.
 f=fixture({href:'https://archive.org/details/test/page/27/mode/1up',start:41,pageNum:'27',aria:false});
 await f.open();
 assert.equal(f.ui.querySelector('.position').textContent,'Page 27');
 assert.equal(f.progress().farthest,41);
 assert.equal(f.navigation.includes(27),false);
 assert.equal(f.index,41);
 f.close();
 console.log('PASS printed-page URL uses the loaded leaf index');
 // Right-to-left books: BookReader swaps Left/Right, so Quiet Leaf sends the opposite key.
 f=fixture({rtl:true,saved:{farthest:4,label:'5',last:4,updated:1},config:{pageProgression:'rl',url:'https://archive.org/BookReader/BookReaderJSIA.php?subPrefix=test'}});
 await f.open();await until(()=>f.at(4),'RTL resume moves to a higher leaf',8000);
 assert.equal(f.index,4);
 assert.deepEqual(f.keys,['ArrowLeft','ArrowLeft','ArrowLeft','ArrowLeft']);
 f.close();
 console.log('PASS right-to-left slider jumps invert BookReader’s key swap');
 console.log('PASS all regression cases');
})().catch(e=>{console.error(e);process.exit(1);});

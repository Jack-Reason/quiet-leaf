const {JSDOM}=require('jsdom');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../Quiet-Leaf.user.js'),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label='condition',ms=4500){const start=Date.now();while(!fn()){if(Date.now()-start>ms)throw new Error('Timed out: '+label);await sleep(25);}}
function fixture({saved=null,bookmarks={},start=0,textDelay=0}={}){
 const dom=new JSDOM('<!doctype html><body><div id="BookReader"><button class="BRicon onepg"></button><button class="BRicon book_right"></button><button class="BRicon book_left"></button><div aria-label="Page navigation slider" aria-valuemax="99"></div><ia-bookmarks-list></ia-bookmarks-list><section></section></div></body>',{url:`https://archive.org/details/test#page/n${start}/mode/1up`,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;const f={dom,w,d,index:start,db:structuredClone(bookmarks),calls:[],activity:0,emitNative:true,offline:false,failPosts:false,broken:new Set(),navigation:[],clock:0};
 const realNow=Date.now;w.Date.now=()=>realNow()+f.clock;
 w.alert=()=>{};w.confirm=()=>true;w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});
 w.Element.prototype.getClientRects=()=>[{width:600,height:900}];let fullscreen=null;
 Object.defineProperty(d,'fullscreenElement',{get:()=>fullscreen});
 w.HTMLElement.prototype.requestFullscreen=function(){fullscreen=this;d.dispatchEvent(new w.Event('fullscreenchange'));return Promise.resolve();};
 d.exitFullscreen=()=>{fullscreen=null;d.dispatchEvent(new w.Event('fullscreenchange'));return Promise.resolve();};
 w.fetch=async(url,options)=>{
  f.calls.push({url,method:options.method,body:options.body});if(f.offline)throw new Error('offline');
  const u=new URL(url),index=u.searchParams.get('page_num');
  assert.equal(u.pathname,'/services/bookmarks.php');assert.equal(u.searchParams.get('identifier'),'test');assert.equal(options.credentials,'same-origin');
  if(options.method==='POST'){if(f.failPosts)return {ok:true,json:async()=>({success:false,error:'denied'})};f.db[index]=JSON.parse(options.body).notes;}
  if(options.method==='DELETE')delete f.db[index];
  const value=Object.fromEntries(Object.entries(f.db).map(([i,notes])=>[i,{notes:structuredClone(notes)}]));
  return {ok:true,json:async()=>({success:true,value})};
 };
 function supply(index){const el=d.createElement('div');el.className='BRpagecontainer';el.dataset.index=index;el.dataset.pageNum=index+1;const img=d.createElement('img');img.className='BRpageimage';Object.defineProperties(img,{complete:{value:true},naturalWidth:{value:1200},naturalHeight:{value:1800}});el.append(img);d.querySelector('section').replaceChildren(el);
 const addText=()=>{const layer=d.createElement('div');layer.className='BRPageLayer BRtextLayer';layer.style.cssText='width:1200px;height:1800px;transform:scale(.5)';layer.innerHTML='<p class="BRparagraphElement" style="left:100px;top:200px;width:800px;height:40px;font-size:32px"><span class="BRlineElement"><span class="BRwordElement">Librarian</span> <span class="BRwordElement">goblins</span></span></p>';el.append(layer);};
 if(textDelay)w.setTimeout(addText,textDelay);else addText();}
 function navigate(index,activity=false){
  if(activity&&f.emitNative)w.dispatchEvent(new w.CustomEvent('BookReader:userAction'));
  if(index===f.index)return;f.index=index;f.navigation.push(index);w.location.hash=`page/${index+1}/mode/1up`;d.querySelector('[aria-valuemax]').setAttribute('aria-valuenow',index);
  d.querySelector('section').replaceChildren();w.dispatchEvent(new w.CustomEvent('BookReader:pageChanged',{detail:{props:{firstIndex:index}}}));
  if(!f.broken.has(index))w.setTimeout(()=>{if(f.index===index)supply(index);},60);
 }
 d.querySelector('.book_right').onclick=()=>navigate(f.index+1,true);d.querySelector('.book_left').onclick=()=>navigate(f.index-1,true);d.querySelector('.onepg').onclick=()=>{};
 d.querySelector('ia-bookmarks-list').addEventListener('bookmarkSelected',e=>navigate(e.detail.bookmark.leafNum));
 w.addEventListener('BookReader:userAction',()=>f.activity++);supply(start);
 const key='quiet-leaf:v1:test';if(saved)w.localStorage.setItem(key,JSON.stringify(saved));
 d.querySelector('[aria-valuemax]').setAttribute('aria-valuenow',start);w.eval(source);f.progress=()=>JSON.parse(w.localStorage.getItem(key)||'{}');
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
 f=fixture();await f.open();
 const paperFilter=()=>f.host.style.getPropertyValue('--quiet-leaf-paper-filter');
 assert.match(paperFilter(),/saturate/);
 const slider=f.ui.querySelector('.contrast');slider.value='130';slider.dispatchEvent(new f.w.Event('input'));
 slider.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,composed:true}));assert.ok(f.at(0),'slider arrow must not turn page');
 assert.equal(JSON.parse(f.w.localStorage.getItem('quiet-leaf:paper:v1:test')).contrast,130);
 const paperSelect=f.ui.querySelector('.paper');paperSelect.value='original';paperSelect.dispatchEvent(new f.w.Event('change'));
 assert.equal(paperFilter(),'none');assert.equal(slider.disabled,true);
 f.click('.exit');await f.open();assert.equal(paperFilter(),'none');assert.equal(f.ui.querySelector('.contrast').value,'130');
 f.close();console.log('PASS reversible paper correction, retained preferences and slider keyboard isolation; all cases passed');
})().catch(e=>{console.error(e);process.exit(1);});

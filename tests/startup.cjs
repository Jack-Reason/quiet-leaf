const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 for(const mode of ['single','scroll'])for(const start of [0,248])for(const loseOnNavigation of [false,true]){
 const page=await browser.newPage({viewport:{width:820,height:1180}});
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<style>body{margin:0}.BRpagecontainer{position:relative;width:600px}.BRpageimage{width:100%;display:block}.BRtextLayer{position:absolute;left:0;top:0;transform-origin:0 0;color:transparent}.BRparagraphElement{margin:0;font-family:Georgia,serif;line-height:0}.BRlineElement{display:inline-block;white-space:nowrap;pointer-events:all}.BRtextLayer[dir=ltr] .BRlineElement{margin-right:100%}</style><button class="BRicon onepg"></button><button class="BRicon book_right"></button><button class="BRicon book_left"></button><div style="display:none"><div class="BRpager"></div></div><section></section>`}));
 await page.goto('https://archive.org/details/test#page/n0/mode/1up');
 await page.addScriptTag({path:require.resolve('jquery/dist/jquery.js')});
 await page.addScriptTag({path:require.resolve('jquery-ui-dist/jquery-ui.js')});
 await page.evaluate(()=>{jQuery('.BRpager').slider({min:0,max:500,value:0});jQuery('.ui-slider-handle').attr({'aria-label':'Page navigation slider','aria-valuenow':0,'aria-valuemin':0,'aria-valuemax':500});});
 await page.evaluate(({start,mode,loseOnNavigation})=>{
   localStorage.setItem('quiet-leaf:layout:v1:test',mode);
   window.fixture={index:start,db:{242:{color:0,note:'[Quiet Leaf progress v1]'}},broken:[],activity:0,clock:0,nav:[],modeReady:false,progressHistory:[]};
   setInterval(()=>{const p=JSON.parse(localStorage.getItem('quiet-leaf:v1:test')||'{}');if(Number.isInteger(p.farthest))fixture.progressHistory.push(p.farthest);},20);
   let fullscreen=null;
   Object.defineProperty(document,'fullscreenElement',{get:()=>fullscreen});
   Object.defineProperty(document,'webkitFullscreenElement',{get:()=>fullscreen});
   fixture.loseFullscreen=()=>{fullscreen=null;document.dispatchEvent(new Event('webkitfullscreenchange'));document.dispatchEvent(new Event('fullscreenchange'));};
   HTMLElement.prototype.requestFullscreen=function(){fullscreen=this;document.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve();};
   document.exitFullscreen=()=>{fixture.loseFullscreen();return Promise.resolve();};
   const realNow=Date.now;Date.now=()=>realNow()+fixture.clock;
   window.confirm=()=>true;
   window.fetch=async(url,options)=>{
     const index=new URL(url).searchParams.get('page_num');
     if(options.method==='POST')fixture.db[index]=JSON.parse(options.body).notes;
     if(options.method==='DELETE')delete fixture.db[index];
     return {ok:true,json:async()=>({success:true,value:Object.fromEntries(Object.entries(fixture.db).map(([i,notes])=>[i,{notes}]))})};
   };
   function supply(index){
     const height=index%2?1600:1800;
     const el=document.createElement('div');el.className='BRpagecontainer';el.dataset.index=index;el.dataset.pageNum=index+1;
     const img=document.createElement('img');img.className='BRpageimage';
     const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}"><rect width="100%" height="100%" fill="#cfb990"/></svg>`;
     img.src='data:image/svg+xml;base64,'+btoa(svg);el.append(img);
     const text=document.createElement('div');text.className='BRPageLayer BRtextLayer';text.dir='ltr';text.style.cssText=`width:1200px;height:${height}px;transform:scale(.5)`;
     text.innerHTML='<p class="BRparagraphElement" style="left:100px;top:200px;margin-left:100px;margin-top:200px;width:800px;height:40px;font-size:32px"><span class="BRlineElement" style="line-height:40px"><span class="BRwordElement">Librarian</span> <span class="BRwordElement">goblins</span></span></p>';
     el.append(text);document.querySelector('section').replaceChildren(el);
   }
   function navigate(index,activity=false){
     if(activity)window.dispatchEvent(new CustomEvent('BookReader:userAction'));
     if(index===fixture.index)return;
     if(loseOnNavigation)fixture.loseFullscreen();
     fixture.index=index;fixture.nav.push(index);location.hash=`page/n${index}/mode/1up`;
     document.querySelector('[aria-valuemax]').setAttribute('aria-valuenow',index);jQuery('.BRpager').slider('value',index);
     document.querySelector('section').replaceChildren();
     window.dispatchEvent(new CustomEvent('BookReader:pageChanged',{detail:{props:{firstIndex:index}}}));
     if(!fixture.broken.includes(index))setTimeout(()=>{if(fixture.index===index)supply(index);},80);
   }
   document.querySelector('.onepg').onclick=()=>{const captured=fixture.index;setTimeout(()=>{navigate(captured);fixture.modeReady=true;},120);};
   document.querySelector('.book_right').onclick=()=>navigate(fixture.index+1,true);
   document.querySelector('.book_left').onclick=()=>navigate(fixture.index-1,true);
   jQuery('.BRpager').on('slidechange',(event,ui)=>navigate(ui.value));
   window.addEventListener('BookReader:userAction',()=>fixture.activity++);supply(start);jQuery('.BRpager').slider('value',start);document.querySelector('[aria-valuemax]').setAttribute('aria-valuenow',start);
 },{start,mode,loseOnNavigation});
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../Quiet-Leaf.user.js'),'utf8')});
 const root=()=>page.locator('#quiet-leaf-reader');
 const focused=i=>page.waitForFunction(i=>document.querySelector('#quiet-leaf-reader')?.shadowRoot.querySelector('.position').textContent==='Page '+(i+1)&&!document.querySelector('#quiet-leaf-reader').shadowRoot.querySelector('.layout').disabled,i);
 await page.locator('#quiet-leaf-launch').click();await focused(242);await page.waitForTimeout(1000);
 assert.equal(await root().count(),1);assert.equal(await root().locator('.layout').inputValue(),mode);
 assert.equal(await page.evaluate(()=>fixture.modeReady),true);
 assert.ok(await page.evaluate(()=>fixture.progressHistory.every(i=>i===242)),'startup may not advance to activation or preloaded page');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('quiet-leaf:v1:test')).farthest),242);
 await root().locator('.full').evaluate(el=>el.click());
 if(mode==='scroll'){
   await page.waitForFunction(()=>!!document.querySelector('#quiet-leaf-reader').shadowRoot.querySelector('.scroll-page[data-index="241"] canvas'));
   await root().locator('.stage').evaluate(el=>{el.dispatchEvent(new WheelEvent('wheel'));el.scrollTop=el.querySelector('[data-index="241"]').offsetTop;});
 }else await root().evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
 await focused(241);await page.waitForTimeout(800);
 assert.equal(await root().count(),1,'backward navigation must not close reader');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('quiet-leaf:v1:test')).farthest),242);
 await page.evaluate(()=>fixture.loseFullscreen());assert.equal(await root().count(),1);
 await root().locator('.resume').evaluate(el=>el.click());await focused(242);
 await root().locator('.exit').evaluate(el=>el.click());assert.equal(await root().count(),0);
 console.log(`PASS ${mode}: activate at ${start}, resume 242, backward 241, fullscreen loss ${loseOnNavigation}, unchanged progress, explicit exit`);
 await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

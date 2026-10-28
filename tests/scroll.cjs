const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:820,height:1180}});
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<style>body{margin:0}.BRpagecontainer{position:relative;width:600px}.BRpageimage{width:100%;display:block}.BRtextLayer{position:absolute;left:0;top:0;transform-origin:0 0;color:transparent}.BRparagraphElement{margin:0;font-family:Georgia,serif;line-height:0}.BRlineElement{display:inline-block;white-space:nowrap;pointer-events:all}.BRtextLayer[dir=ltr] .BRlineElement{margin-right:100%}</style><button class="BRicon onepg"></button><button class="BRicon book_right"></button><button class="BRicon book_left"></button><div style="display:none"><div class="BRpager"></div></div><section></section>`}));
 await page.goto('https://archive.org/details/test#page/n0/mode/1up');
 await page.addScriptTag({path:require.resolve('jquery/dist/jquery.js')});
 await page.addScriptTag({path:require.resolve('jquery-ui-dist/jquery-ui.js')});
 await page.evaluate(()=>{jQuery('.BRpager').slider({min:0,max:500,value:0});jQuery('.ui-slider-handle').attr({'aria-label':'Page navigation slider','aria-valuenow':0,'aria-valuemin':0,'aria-valuemax':500});});
 await page.evaluate(()=>{
   window.fixture={index:0,db:{},broken:[],activity:0,clock:0,nav:[]};
   const realNow=Date.now;Date.now=()=>realNow()+fixture.clock;
   HTMLElement.prototype.requestFullscreen=()=>Promise.reject(new Error('fixture viewport'));
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
   function navigate(index){
     // BookReader.updateFirstIndex emits userAction whenever the visible leaf changes.
     if(index===fixture.index)return;
     fixture.index=index;fixture.nav.push(index);location.hash=`page/n${index}/mode/1up`;
     document.querySelector('[aria-valuemax]').setAttribute('aria-valuenow',index);jQuery('.BRpager').slider('value',index);
     document.querySelector('section').replaceChildren();
     window.dispatchEvent(new CustomEvent('BookReader:pageChanged',{detail:{props:{firstIndex:index}}}));
     window.dispatchEvent(new CustomEvent('BookReader:userAction'));
     if(!fixture.broken.includes(index))setTimeout(()=>{if(fixture.index===index)supply(index);},80);
   }
   document.querySelector('.onepg').onclick=()=>{};
   document.querySelector('.book_right').onclick=()=>navigate(fixture.index+1);
   document.querySelector('.book_left').onclick=()=>navigate(fixture.index-1);
   jQuery('.BRpager').on('slidechange',(event,ui)=>navigate(ui.value));
   window.addEventListener('BookReader:userAction',()=>fixture.activity++);supply(0);
 });
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../Quiet-Leaf.user.js'),'utf8')});
 const root=()=>page.locator('#quiet-leaf-reader');
 const state=()=>page.evaluate(()=>({progress:JSON.parse(localStorage.getItem('quiet-leaf:v1:test')||'{}'),db:fixture.db,activity:fixture.activity,nav:fixture.nav}));
 const loaded=async i=>page.waitForFunction(i=>!!document.querySelector('#quiet-leaf-reader').shadowRoot.querySelector(`.scroll-page[data-index="${i}"] canvas`),i);
 const focused=async i=>page.waitForFunction(i=>document.querySelector('#quiet-leaf-reader').shadowRoot.querySelector('.position').textContent==='Page '+(i+1)&&!document.querySelector('#quiet-leaf-reader').shadowRoot.querySelector('.layout').disabled,i);
 const scroll=async i=>{await loaded(i);await root().locator('.stage').evaluate((el,i)=>{el.dispatchEvent(new WheelEvent('wheel'));el.scrollTop=el.querySelector(`[data-index="${i}"]`).offsetTop;},i);await focused(i);};
 const mode=async value=>root().locator('.layout').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change'));},value);
 await page.locator('#quiet-leaf-launch').click();await focused(0);
 await mode('scroll');await loaded(1);await page.waitForTimeout(850);
 const prefetched=await state();
 assert.equal(prefetched.progress.farthest,0,'prefetch must not advance farthest progress');
 assert.deepEqual(prefetched.nav,[1],'prefetch selects the next leaf through the slider');
 assert.equal(prefetched.activity,prefetched.nav.length,'every leaf change emits BookReader:userAction');
 const dimensions=await root().locator('.scroll-page[data-index="0"] canvas').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,viewport:el.getRootNode().querySelector('.stage').clientWidth}));
 assert.equal(dimensions.width,dimensions.viewport);assert.equal(dimensions.height,dimensions.width*1.5);
 await scroll(1);await page.waitForFunction(()=>fixture.db[1]?.color===0&&!fixture.db[0]);
 await root().locator('.bookmark').evaluate(el=>el.click());await page.waitForFunction(()=>fixture.db[1]?.color===1);
 await scroll(2);await page.waitForFunction(()=>fixture.db[2]?.color===0&&!fixture.db[1].note.includes('[Quiet Leaf progress v1]'));
 await scroll(1);assert.equal((await state()).progress.farthest,2);assert.equal((await state()).db[1].color,1);
 await root().locator('.resume').evaluate(el=>el.click());await focused(2);
 console.log('PASS width fit, native lazy loading, prefetch keeps progress and emits slider activity, red progress, blue preservation, backward scroll and resume');
 for(let i=3;i<=8;i++)await scroll(i);
 assert.ok(await root().locator('canvas').count()<=5,'bounded decoded scans');
 const before=await root().locator('.stage').evaluate(el=>({top:el.scrollTop,offset:el.querySelector('[data-index="8"]').offsetTop,height:el.querySelector('[data-index="8"]').offsetHeight}));
 await page.setViewportSize({width:1180,height:820});await page.waitForTimeout(250);
 const after=await root().locator('.stage').evaluate(el=>({top:el.scrollTop,offset:el.querySelector('[data-index="8"]').offsetTop,height:el.querySelector('[data-index="8"]').offsetHeight}));
 assert.ok(Math.abs((before.top-before.offset)/before.height-(after.top-after.offset)/after.height)<.01);
 assert.equal((await state()).progress.farthest,8);
 // Selected word retains its exact normalized position over each fit-width canvas.
 const geometry=await root().locator('.scroll-page[data-index="8"]').evaluate(card=>{const word=card.querySelector('.BRwordElement').getBoundingClientRect(),img=card.querySelector('canvas').getBoundingClientRect();return {x:(word.left-img.left)/img.width,y:(word.top-img.top)/img.height};});
 assert.ok(Math.abs(geometry.x-100/1200)<.005);
 // Jump back into an evicted placeholder: it must reload without lowering progress.
 await root().locator('.stage').evaluate(el=>{el.dispatchEvent(new WheelEvent('wheel'));el.scrollTop=el.querySelector('[data-index="0"]').offsetTop;});
 await loaded(0);await focused(0);assert.equal((await state()).progress.farthest,8);
 await root().locator('.resume').evaluate(el=>el.click());await loaded(8);await focused(8);
 await page.evaluate(()=>fixture.broken.push(10));await scroll(9);
 await page.waitForFunction(()=>fixture.index===10);await page.evaluate(()=>fixture.clock=16000);
 await page.waitForFunction(()=>!document.querySelector('#quiet-leaf-reader').shadowRoot.querySelector('.error').hidden);
 assert.equal((await state()).progress.farthest,9);
 await root().locator('.stage').evaluate(el=>{el.dispatchEvent(new WheelEvent('wheel'));el.scrollTop=el.querySelector('[data-index="10"]').offsetTop;});await page.waitForTimeout(150);
 assert.equal((await state()).progress.farthest,9,'missing scan cannot advance');
 await page.evaluate(()=>{fixture.clock=0;fixture.broken=[];});await root().locator('.retry').evaluate(el=>el.click());await loaded(10);await focused(10);
 assert.equal((await state()).progress.farthest,10);
 await mode('single');await focused(10);assert.equal(await root().locator('.scroll-page').count(),0);assert.equal(await root().locator('canvas').count(),1);
 await mode('scroll');await focused(10);await root().locator('.exit').evaluate(el=>el.click());
 await page.locator('#quiet-leaf-launch').click();await loaded(10);await focused(10);
 assert.equal(await root().locator('.layout').inputValue(),'scroll');
 await scroll(9);await root().locator('.reset').evaluate(el=>el.click());await page.waitForFunction(()=>fixture.db[9]?.color===0&&!fixture.db[10]);assert.equal((await state()).progress.farthest,9);assert.equal((await state()).db[1].color,1);
 await root().locator('.exit').evaluate(el=>el.click());await page.waitForTimeout(200);assert.equal(await page.locator('#quiet-leaf-reader').count(),0);
 console.log('PASS bounded memory, rotation, word geometry, failed scan/retry, mode switching, remembered mode/farthest, progress reset and cleanup');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

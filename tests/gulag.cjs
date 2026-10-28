const {source,engines}=require('./support.cjs');
const assert=require('node:assert/strict');
(async()=>{
 for(const engine of engines(['chromium','webkit'])){
 const browser=await engine.launch({headless:true});
 try{
 for(const [volume,max] of [['The-Gulag-Archipelago__vol1__I-II__Solzhenitsyn',670],['The-Gulag-Archipelago__vol2__III-IV__Solzhenitsyn',716],['The-Gulag-Archipelago__vol3__V-VII__Solzhenitsyn',578]]){
 const page=await browser.newPage({viewport:{width:820,height:1180}});
 page.setDefaultTimeout(15000);
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<style>body{margin:0}.BRpagecontainer{position:relative;width:600px}.BRpageimage{width:100%;display:block}.BRtextLayer{position:absolute;left:0;top:0;transform-origin:0 0;color:transparent}.BRparagraphElement{margin:0;font-family:Georgia,serif;line-height:0}.BRlineElement{display:inline-block;white-space:nowrap;pointer-events:all}.BRtextLayer[dir=ltr] .BRlineElement{margin-right:100%}</style><button class="BRicon onepg"></button><button class="BRicon book_right"></button><button class="BRicon book_left"></button><div style="display:none"><div class="BRpager"></div></div><div class="BRpager"></div><section></section>`}));
 const identifier='TheGulagArchipelago-Threevolumes/'+volume;
 await page.goto('https://archive.org/details/'+identifier+'/page/n9/mode/1up');
 await page.addScriptTag({path:require.resolve('jquery/dist/jquery.js')});
 await page.addScriptTag({path:process.env.QL_JQUERY_UI||require.resolve('jquery-ui-dist/jquery-ui.js')});
 await page.evaluate(({max,volume,probe})=>{
   const config=document.createElement('input');config.className='js-bookreader';config.type='hidden';config.value=JSON.stringify({url:'https://archive.org/BookReader/BookReaderJSIA.php?subPrefix='+volume});if(probe||!volume.includes('vol3'))document.body.append(config);
   jQuery('.BRpager').slider({min:0,max,value:9});
   jQuery('.ui-slider-handle').attr({'aria-label':'Page navigation slider','aria-valuemin':0,'aria-valuemax':max});
   // Archive replaces the keydown handler: only Left and Right are accepted.
   jQuery('.ui-slider-handle').off('keydown').on('keydown',function(event){
     if(event.keyCode===37||event.keyCode===39){jQuery.ui.slider.prototype._handleEvents.keydown.call(jQuery(event.target).parent().data('ui-slider'),event);event.stopPropagation();}
   });
 },{max,volume,probe:!!process.env.QL_PROBE});
 await page.evaluate(identifier=>{
   localStorage.setItem('quiet-leaf:layout:v1:'+identifier,'scroll');
   window.fixture={index:9,db:{},broken:[],activity:0,clock:0,nav:[]};
   const realNow=Date.now;Date.now=()=>realNow()+fixture.clock;
   HTMLElement.prototype.requestFullscreen=()=>Promise.reject(new Error('fixture viewport'));
   window.confirm=()=>true;
   window.fetch=async(url,options)=>{
     const u=new URL(url);if(u.searchParams.get('identifier')!==identifier)throw new Error('Wrong volume identifier');const index=u.searchParams.get('page_num');
     if(options.method==='POST')fixture.db[index]=JSON.parse(options.body).notes;
     if(options.method==='DELETE')delete fixture.db[index];
     return {ok:true,json:async()=>({success:true,value:Object.fromEntries(Object.entries(fixture.db).map(([i,notes])=>[i,{notes}]))})};
   };
   function supply(index){
     const height=index%2?1600:1800;
     const el=document.createElement('div');el.className='BRpagecontainer';el.dataset.index=index;el.dataset.pageNum='n'+index;
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
     fixture.index=index;fixture.nav.push(index);history.replaceState(null,'',location.pathname.replace(/\/page\/n\d+/, '/page/n'+index));
     jQuery('.ui-slider-handle').attr('aria-valuenow',index);jQuery('.BRpager').data('swallowchange',true).slider('value',index);
     document.querySelector('section').replaceChildren();
     window.dispatchEvent(new CustomEvent('BookReader:pageChanged',{detail:{props:{index}}}));
     if(!fixture.broken.includes(index))setTimeout(()=>{if(fixture.index===index)supply(index);},80);
   }
   document.querySelector('.onepg').onclick=()=>{};
   document.querySelector('.book_right').onclick=()=>navigate(fixture.index+1,true);
   document.querySelector('.book_left').onclick=()=>navigate(fixture.index-1,true);
   jQuery('.BRpager').on('slide',(_,ui)=>jQuery('.ui-slider-handle').attr('aria-valuenow',ui.value));
   jQuery('.BRpager').on('slidechange',(event,ui)=>{const rail=jQuery(event.target);if(rail.data('swallowchange'))rail.data('swallowchange',false);else navigate(ui.value);});
   window.addEventListener('BookReader:userAction',()=>fixture.activity++);supply(9);
 },identifier);
 await page.addScriptTag({content:source});
 const root=()=>page.locator('#quiet-leaf-reader');
 const state=()=>page.evaluate(id=>({progress:JSON.parse(localStorage.getItem('quiet-leaf:v1:'+id)||'{}'),db:fixture.db,activity:fixture.activity,nav:fixture.nav}),identifier);
 const loaded=async i=>{
   try{await page.waitForFunction(i=>!!document.querySelector('#quiet-leaf-reader').shadowRoot.querySelector(`.scroll-page[data-index="${i}"] canvas`),i);}
   catch(e){console.error(await page.evaluate(()=>({native:fixture.index,nav:fixture.nav,slider:jQuery('.BRpager').map(function(){return jQuery(this).slider('value');}).get(),error:document.querySelector('#quiet-leaf-reader').shadowRoot.querySelector('.error').textContent,mouseX:new MouseEvent('mousedown',{clientX:1000*10/670,button:0,buttons:1}).clientX})));throw e;}
 };
 const focused=async i=>page.waitForFunction(i=>document.querySelector('#quiet-leaf-reader')?.shadowRoot.querySelector('.position').textContent==='Page n'+i&&!document.querySelector('#quiet-leaf-reader').shadowRoot.querySelector('.layout').disabled,i);
 const open=async()=>{
   // Exiting can leave Archive finishing a native prefetch. As in the install
   // instructions, wait for its scan before activating, particularly in Gecko.
   await page.waitForFunction(()=>{const img=document.querySelector('section img.BRpageimage');return img?.complete&&img.naturalWidth;});
   await page.locator('#quiet-leaf-launch').click();
 };
 const scroll=async i=>{await loaded(i);await root().locator('.stage').evaluate((el,i)=>{el.dispatchEvent(new WheelEvent('wheel'));el.scrollTop=el.querySelector(`[data-index="${i}"]`).offsetTop;},i);await focused(i);};
 await open();await focused(9);
 await loaded(10);if(process.env.QL_PROBE){console.log('PASS initial n9 to n10 prefetch');await page.close();continue;}assert.equal((await state()).progress.farthest,9,'prefetch is not progress');
 for(let index=10;index<=15;index++)await scroll(index);
 assert.equal((await state()).progress.farthest,15);
 await root().locator('.controls-toggle').click();assert.equal(await root().locator('.bar').isVisible(),true);
 await root().locator('.hide').click();
 await scroll(14);assert.equal((await state()).progress.farthest,15);
 // Saved resume jumps far ahead and back without loading intermediate scans.
 await root().locator('.exit').evaluate(el=>el.click());
 await page.evaluate(()=>{fixture.db[400]={color:0,note:'[Quiet Leaf progress v1]'};});
 await open();await focused(400);await loaded(401);
 assert.equal((await state()).progress.farthest,400);
 assert.equal((await state()).nav.includes(200),false,'no intermediate page request during keyboard jump');
 await root().locator('.exit').evaluate(el=>el.click());
 await page.evaluate(max=>{fixture.db[max]={color:0,note:'[Quiet Leaf progress v1]'};},max);
 await open();await focused(max);
 assert.equal(await root().locator('.scroll-page[data-index="'+(max+1)+'"]').count(),0,'no phantom page beyond volume');
 await root().locator('.exit').evaluate(el=>el.click());
 // Same item, different volumes must retain different storage and bookmark IDs.
 assert.ok(await page.evaluate(id=>localStorage.getItem('quiet-leaf:v1:'+id),identifier));
 assert.equal(await page.evaluate(()=>localStorage.getItem('quiet-leaf:v1:TheGulagArchipelago-Threevolumes')),null);
 console.log(`PASS ${engine.name()} ${volume}: n9→n15, path fallback, two sliders, prefetch/progress, controls, resume n400`);
 await page.close();
 }
 }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exit(1);});

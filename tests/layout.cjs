// Real browser layout check: native margin-flow text versus its fullscreen copy.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1024,height:1366}});
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800"><rect width="100%" height="100%" fill="#d0b58c"/></svg>';
 const html=`<style>
 body{margin:0} .BRpagecontainer{position:relative;width:600px;height:900px}
 img{display:block;width:600px;height:900px}.BRtextLayer{position:absolute;top:0;left:0;color:transparent;transform-origin:0 0;pointer-events:none}
 .BRparagraphElement{margin:0;font-family:Georgia,serif;line-height:0}
 .BRlineElement{pointer-events:all;white-space:nowrap;display:inline-block}
 .BRtextLayer[dir=ltr] .BRlineElement{margin-right:100%}
 </style><button class="BRicon onepg"></button><button class="BRicon book_right"></button><button class="BRicon book_left"></button>
 <div aria-label="Page navigation slider" aria-valuenow="0" aria-valuemax="9"></div><ia-bookmarks-list></ia-bookmarks-list>
 <div class="BRpagecontainer" data-index="0" data-page-num="1"><img class="BRpageimage" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">
 <div class="BRPageLayer BRtextLayer" dir="ltr" style="width:1200px;height:1800px;transform:scale(.5)">
 <p class="BRparagraphElement" style="left:100px;top:200px;width:800px;height:40px;font-size:32px;margin-left:100px;margin-top:200px"><span class="BRlineElement" style="line-height:40px"><span class="BRwordElement" style="letter-spacing:2px">Librarian</span> <span class="BRwordElement">goblins</span></span></p>
 <p class="BRparagraphElement" style="left:180px;top:600px;width:700px;height:80px;font-size:28px;margin-left:180px;margin-top:360px"><span class="BRlineElement" style="line-height:40px"><span class="BRwordElement">Another</span> <span class="BRwordElement">paragraph</span></span><span class="BRlineElement" style="line-height:40px"><span class="BRwordElement">Second</span> <span class="BRwordElement">line</span></span></p>
 </div></div>`;
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('https://archive.org/details/test#page/n0/mode/1up');
 await page.evaluate(()=>{
   window.fetch=async()=>({ok:true,json:async()=>({success:true,value:{}})});
   HTMLElement.prototype.requestFullscreen=()=>Promise.reject(new Error('fixture uses viewport'));
 });
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../Quiet-Leaf.user.js'),'utf8')});
 await page.locator('#quiet-leaf-launch').click();
 await page.waitForFunction(()=>!!document.querySelector('#quiet-leaf-reader')?.shadowRoot.querySelector('.BRwordElement'));
 for(const viewport of [{width:1024,height:1366},{width:1366,height:1024},{width:768,height:1366}]){
   await page.setViewportSize(viewport);
   await page.waitForFunction(()=>{
     const root=document.querySelector('#quiet-leaf-reader').shadowRoot,c=root.querySelector('canvas'),layer=root.querySelector('.BRtextLayer'),r=c.getBoundingClientRect();
     const expected=Math.min(r.width/c.width,r.height/c.height)*c.width/parseFloat(layer.style.width);
     return Math.abs(parseFloat(layer.style.transform.slice(6))-expected)<.0001;
   });
   const result=await page.evaluate(()=>{
     const root=document.querySelector('#quiet-leaf-reader').shadowRoot;
     const nativeImage=document.querySelector('.BRpageimage').getBoundingClientRect(),canvas=root.querySelector('canvas'),r=canvas.getBoundingClientRect();
     const scale=Math.min(r.width/canvas.width,r.height/canvas.height),width=canvas.width*scale,height=canvas.height*scale;
     const x=r.left+(r.width-width)/2,y=r.top+(r.height-height)/2;
     const originals=[...document.querySelectorAll('.BRwordElement')],copies=[...root.querySelectorAll('.BRwordElement')];
     return copies.map((word,i)=>{
       const original=originals[i].getBoundingClientRect(),copy=word.getBoundingClientRect();
       const expected={x:x+(original.x-nativeImage.x)*width/nativeImage.width,y:y+(original.y-nativeImage.y)*height/nativeImage.height,width:original.width*width/nativeImage.width,height:original.height*height/nativeImage.height};
       const hit=root.elementFromPoint(copy.x+copy.width/2,copy.y+copy.height/2);
       return {text:word.textContent,expected,actual:{x:copy.x,y:copy.y,width:copy.width,height:copy.height},hit:hit?.textContent};
     });
   });
   for(const word of result){for(const key of ['x','y','width','height'])assert.ok(Math.abs(word.expected[key]-word.actual[key])<1.5,`${viewport.width}x${viewport.height}: ${word.text} ${key}: ${JSON.stringify(word)}`);assert.equal(word.hit,word.text);}
   console.log(`PASS rendered word geometry and hit targets at ${viewport.width}x${viewport.height}`);
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

// Cross-origin scans are not data URLs. A refused copy stays inside the reader.
const {source,engines}=require('./support.cjs');
const assert=require('node:assert/strict');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
(async()=>{
 for(const engine of engines(['chromium','firefox','webkit'])){
  const browser=await engine.launch({headless:true});
  try{
   for(const cors of [false,true]){
    const page=await browser.newPage({viewport:{width:1024,height:1366}});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.route('**/*',route=>{
     if(route.request().url().endsWith('/scan.png')){
      return route.fulfill({status:200,contentType:'image/png',body:png,headers:cors?{'access-control-allow-origin':'*'}:{}});
     }
     return route.fulfill({contentType:'text/html',body:'<button class="BRicon onepg"></button><button class="BRicon book_right"></button><button class="BRicon book_left"></button><div aria-label="Page navigation slider" aria-valuenow="0" aria-valuemax="3"></div><ia-bookmarks-list></ia-bookmarks-list><div class="BRpagecontainer" data-index="0" data-page-num="1"><img class="BRpageimage" src="https://ia801000.us.archive.org/scan.png"></div>'});
    });
    await page.goto('https://archive.org/details/test#page/n0/mode/1up');
    await page.evaluate(()=>{
     window.fetch=async()=>({ok:true,json:async()=>({success:true,value:{}})});
     HTMLElement.prototype.requestFullscreen=()=>Promise.reject(new Error('fixture viewport'));
    });
    await page.waitForFunction(()=>{const img=document.querySelector('img.BRpageimage');return img?.complete&&img.naturalWidth;});
    await page.addScriptTag({content:source});
    await page.locator('#quiet-leaf-launch').click();
    await page.waitForFunction(()=>{
     const root=document.querySelector('#quiet-leaf-reader')?.shadowRoot;
     if(!root)return false;
     const canvas=root.querySelector('canvas');
     const error=root.querySelector('.error');
     return !!(canvas&&canvas.width)||!!(error&&!error.hidden);
    });
    const outcome=await page.evaluate(()=>{
     const root=document.querySelector('#quiet-leaf-reader').shadowRoot;
     const canvas=root.querySelector('canvas');
     const error=root.querySelector('.error');
     let readback='none';
     if(canvas){try{canvas.getContext('2d').getImageData(0,0,1,1);readback='read';}catch(e){readback=e.name;}}
     return {canvas:canvas?.width||0,errorHidden:error.hidden,message:error.textContent,readback};
    });
    assert.deepEqual(errors,[],'cross-origin scan must not escape the reader');
    // Archive's img has no crossorigin attribute, so ACAO does not untaint the canvas.
    // drawImage still succeeds. Quiet Leaf never reads the pixels back.
    assert.equal(outcome.errorHidden,true);
    assert.equal(outcome.canvas,1);
    assert.equal(outcome.readback,'SecurityError');
    console.log(`PASS ${engine.name()} cross-origin ${cors?'with':'without'} CORS at 1024×1366: canvas=${outcome.canvas} readback=${outcome.readback} errorHidden=${outcome.errorHidden}`);
    await page.close();
   }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exit(1);});

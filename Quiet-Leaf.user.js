// ==UserScript==
// @name         Quiet Leaf — Internet Archive
// @namespace    quiet-leaf
// @version      0.6.5
// @description  Single-page or continuous scanned pages, automatic progress, native coloured bookmarks and reading activity.
// @match        https://archive.org/details/*
// @match        https://archive.org/stream/*
// @run-at       document-end
// @inject-into  content
// @grant        none
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if (window.top !== window.self) return;
  const MARK = '[Quiet Leaf progress v1]';
  const KEEP_MARK = '[Quiet Leaf progress v1; preserve bookmark]';
  const isIndex = n => Number.isSafeInteger(n) && n >= 0;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  function findAll(selector, root = document) {
    const found = [...root.querySelectorAll(selector)];
    for (const el of root.querySelectorAll('*')) {
      if (el.id.startsWith('quiet-leaf-')) continue;
      if (el.shadowRoot) found.push(...findAll(selector, el.shadowRoot));
    }
    return found;
  }
  const pages = () => findAll('.BRpagecontainer[data-index]');
  const imageOf = el => el?.querySelector('img.BRpageimage, img');
  function urlIndex() {
    const value = (location.hash || '').match(/(?:^#|\/)page\/n(\d+)(?:\/|$)/)
      || location.pathname.match(/\/page\/n(\d+)(?:\/|$)/);
    const index=value?Number(value[1]):null;
    return isIndex(index)?index:null;
  }
  function pageLabel() {
    const raw=(location.hash||location.pathname).match(/(?:^#|\/)page\/([^/?#]+)/)?.[1]||'';
    if(!raw)return '';
    try{return decodeURIComponent(raw);}catch{return '';}
  }
  function pageByLabel(label=pageLabel()) {
    if(!label)return null;
    return pages().find(el=>el.dataset.pageNum===label)||null;
  }
  // A printed leaf such as /page/27 is not a scan index. Use the slider, then
  // an explicit /page/n index, then the loaded container that carries that label.
  function readerIndex() {
    const slider=pageSlider(),value=slider?.getAttribute('aria-valuenow');
    if(value!==null&&value!==undefined&&value!==''){const n=Number(value);if(isIndex(n))return n;}
    const fromUrl=urlIndex();
    if(isIndex(fromUrl))return fromUrl;
    const named=pageByLabel();
    const index=named?Number(named.dataset.index):null;
    return isIndex(index)?index:null;
  }
  function pageSlider() {
    const sliders=findAll('[aria-label="Page navigation slider"]');
    // Prefer the visible control; both native controls remain keyboard-operable
    // when Archive hides its navigation. Never change their layout to navigate.
    return sliders.find(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')||sliders[0];
  }
  function currentPage() {
    const all = pages();
    const hash = readerIndex();
    const exact = all.find(el => isIndex(hash) && Number(el.dataset.index) === hash);
    if (exact) return exact;
    const named = pageByLabel();
    if (named) return named;
    const visible = all.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
    return (visible.length ? visible : all).sort((a,b) => {
      const ar=a.getBoundingClientRect(), br=b.getBoundingClientRect();
      return Math.abs(ar.top+ar.height/2-innerHeight/2)-Math.abs(br.top+br.height/2-innerHeight/2);
    })[0];
  }
  function control(kind) {
    const selectors = {
      single: '.BRicon.onepg, button.onepg, button[title="One-page view"]',
      next: '.BRicon.book_right, button.book_right, button[title="Flip right"]',
      previous: '.BRicon.book_left, button.book_left, button[title="Flip left"]'
    };
    return findAll(selectors[kind]).find(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true');
  }
  function safeToken(value) {
    if(typeof value!=='string'||!value)return '';
    let text=value;
    if(text.includes('%')){try{text=decodeURIComponent(text);}catch{return '';}}
    if(/[\\?#\u0000]/.test(text))return '';
    const segments=text.split('/');
    if(segments.some(part=>part===''||part==='.'||part==='..'))return '';
    return text;
  }
  function bookIdentifier() {
    const parts = location.pathname.split('/').filter(Boolean);
    const id = safeToken(parts[1] || '');
    let sub = parts[2]&&!['page','mode','search'].includes(parts[2])?safeToken(parts[2]):id;
    if(!sub)sub=id;
    try {
      const options = JSON.parse(document.querySelector('input.js-bookreader')?.value || '{}');
      const prefix = safeToken(new URL(options.url, location.href).searchParams.get('subPrefix') || '');
      if(prefix)sub=prefix;
    } catch {}
    if(!id)return sub;
    return sub === id ? id : id + '/' + sub;
  }
  function copyTextLayer(source) {
    const drop=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','IMG','SVG','MATH','LINK','AUDIO','VIDEO','CANVAS','FORM','INPUT','BUTTON','TEXTAREA','SELECT','META','BASE','NOSCRIPT','TEMPLATE','FRAME','APPLET','FOREIGNOBJECT']);
    const allow=new Set(['DIV','P','SPAN','BR']);
    const classes=new Set(['BRPageLayer','BRtextLayer','BRparagraphElement','BRlineElement','BRwordElement','BRwordElement--hyphen']);
    const props=['width','height','left','top','right','bottom','margin','margin-left','margin-top','margin-right','margin-bottom','font-size','line-height','font-family','letter-spacing','word-spacing','text-indent','white-space'];
    const html='http://www.w3.org/1999/xhtml';
    function styleOf(el){
      const parts=[];
      for(const prop of props){
        const value=el.style.getPropertyValue(prop);
        if(!value||value.length>120||/url\(|expression|javascript|@import|var\(|<|>|\\/i.test(value))continue;
        parts.push(prop+':'+value);
      }
      return parts.join(';');
    }
    function copy(node){
      if(node.nodeType===3)return node.textContent?document.createTextNode(node.textContent):null;
      if(node.nodeType!==1)return null;
      if(node.namespaceURI&&node.namespaceURI!==html)return null;
      const tag=node.tagName.toUpperCase();
      if(drop.has(tag))return null;
      if(!allow.has(tag)){
        const frag=document.createDocumentFragment();
        for(const child of node.childNodes){const next=copy(child);if(next)frag.append(next);}
        return frag;
      }
      const el=document.createElement(tag.toLowerCase());
      const kept=[...node.classList].filter(name=>classes.has(name));
      if(kept.length)el.className=kept.join(' ');
      const style=styleOf(node);
      if(style)el.setAttribute('style',style);
      const dir=node.getAttribute('dir');
      if(dir==='ltr'||dir==='rtl')el.setAttribute('dir',dir);
      if(tag!=='BR'){for(const child of node.childNodes){const next=copy(child);if(next)el.append(next);}}
      return el;
    }
    return copy(source);
  }
  function rightToLeft() {
    try {
      const options=JSON.parse(document.querySelector('input.js-bookreader')?.value||'{}');
      if(options.pageProgression==='rl')return true;
      if(options.pageProgression==='lr')return false;
    } catch {}
    return findAll('.book_left, button.book_left').some(el=>el.classList.contains('book_flip_next'));
  }
  const tagged = b => !!b && b.note.split('\n').some(line=>line===MARK||line===KEEP_MARK);
  const untag = note => note.split('\n').filter(line => line !== MARK && line !== KEEP_MARK).join('\n');
  const withTag = (note,preserve=false) => tagged({note}) ? note : (note ? note+'\n' : '')+(preserve?KEEP_MARK:MARK);

  function boot() {
    if (document.getElementById('quiet-leaf-launch')) return;
    const identifier = bookIdentifier();
    const key = 'quiet-leaf:v1:' + identifier;
    const layoutKey='quiet-leaf:layout:v1:'+identifier;
    let preferredMode='single';try{if(localStorage.getItem(layoutKey)==='scroll')preferredMode='scroll';}catch{}
    const paperKey='quiet-leaf:paper:v1:'+identifier;
    const paperModes={original:'Original scan',pulp:'Clean pulp',cream:'Warm cream',gray:'Grayscale'};
    let paper={mode:'pulp',contrast:115,brightness:112};
    try{
      const saved=JSON.parse(localStorage.getItem(paperKey)||'{}');
      if(Object.hasOwn(paperModes,saved.mode))paper.mode=saved.mode;
      if(Number.isFinite(saved.contrast))paper.contrast=Math.min(160,Math.max(90,saved.contrast));
      if(Number.isFinite(saved.brightness))paper.brightness=Math.min(130,Math.max(85,saved.brightness));
    }catch{}

    let progress = {farthest:null, label:'', last:null, updated:0, resetPending:false};
    let storageOK = true, server = {}, syncMessage = 'Progress not yet checked', syncTimer;
    let chain = Promise.resolve(), notify = () => {}, revision = 0;
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      if (isIndex(value.farthest)) progress = {...progress,...value};
    } catch { storageOK=false; }
    function persist() {
      try { localStorage.setItem(key,JSON.stringify(progress)); storageOK=true; }
      catch { storageOK=false; }
      notify();
    }
    function localStatus() { return storageOK ? 'Saved on this iPad' : 'Device storage unavailable'; }
    function status(text) { syncMessage=text; notify(); }
    function enqueue(job) {
      const result=chain.catch(()=>{}).then(job);
      chain=result.catch(()=>{});
      return result;
    }
    async function api(method, index, notes) {
      const url=new URL('/services/bookmarks.php',location.origin);
      url.searchParams.set('identifier',identifier);
      if (isIndex(index)) url.searchParams.set('page_num',String(index));
      const abort=new AbortController(), timer=setTimeout(()=>abort.abort(),8000);
      try {
        const response=await fetch(url.href,{method,credentials:'same-origin',cache:'no-store',signal:abort.signal,
          headers:{'Content-Type':'application/json'}, ...(notes?{body:JSON.stringify({notes})}:{})});
        if (!response.ok) throw new Error('Archive bookmark request failed');
        const result=await response.json();
        if (result.success !== true && result.success !== 1) throw new Error(result.error || 'Archive did not confirm the bookmark request');
        return result;
      } finally {clearTimeout(timer);}
    }
    async function readBookmarks() {
      const result=await api('GET');
      const list={};
      for (const [index, entry] of Object.entries(result.value || {})) {
        if (!/^\d+$/.test(index) || !isIndex(Number(index))) continue;
        const notes=entry?.notes || {};
        list[index]={note:typeof notes.note==='string'?notes.note:'',color:Number(notes.color ?? 0)};
      }
      server=list; notify(); return list;
    }
    function remoteFarthest(list) {
      return Object.entries(list).filter(([,b])=>tagged(b)).reduce((n,[i])=>Math.max(n,Number(i)),-1);
    }
    async function putVerified(index, notes) {
      await api('POST',index,notes);
      const list=await readBookmarks();
      if (!list[index] || list[index].note!==notes.note || list[index].color!==notes.color)
        throw new Error('Bookmark save could not be verified');
      return list;
    }
    async function removeOldMarkers(keep, allowLowering=false) {
      // Refetch immediately before each mutation; never delete an untagged bookmark.
      const old=Object.keys(server).map(Number).filter(i=>i!==keep && (i<keep || allowLowering) && tagged(server[i]));
      for (const index of old) {
        const latest=await readBookmarks(), b=latest[index];
        if (!tagged(b)) continue;
        if (b.color===0 && b.note===MARK) {
          await api('DELETE',index);
          const verify=await readBookmarks();
          if (verify[index]) throw new Error('Old progress marker removal was not confirmed');
        } else {
          // A manual/annotated bookmark is retained; only our own progress tag moves.
          await putVerified(index,{note:untag(b.note),color:b.color});
        }
      }
    }
    async function syncProgress() {
      if (!isIndex(progress.farthest)) return;
      status('Syncing progress…');
      try {
        let list=await readBookmarks();
        const remote=remoteFarthest(list);
        if (!progress.resetPending && remote>progress.farthest) {
          progress.farthest=remote;progress.label='';persist();
        }
        const index=progress.farthest, rev=revision, existing=list[index];
        // Existing blue/green/red bookmarks and all user note text take precedence.
        const notes=existing?{note:withTag(existing.note,true),color:existing.color}:{note:MARK,color:0};
        if (!existing || existing.note!==notes.note || existing.color!==notes.color) list=await putVerified(index,notes);
        if (revision!==rev || progress.farthest!==index) {scheduleSync();return;}
        await removeOldMarkers(index,progress.resetPending);
        if (revision===rev) {progress.resetPending=false;persist();}
        status((notes.color===1?'Progress synced · blue bookmark preserved':'Progress synced to Archive'));
      } catch {status(localStatus()+' · Archive sync pending');}
    }
    function scheduleSync() {
      clearTimeout(syncTimer);
      syncTimer=setTimeout(()=>enqueue(syncProgress),650);
    }
    function record(index,label) {
      if (!isIndex(index)) return;
      progress.last=index;
      if (!isIndex(progress.farthest) || index>progress.farthest) {
        progress.farthest=index;progress.label=label;progress.updated=Date.now();revision++;
        persist();status(localStatus()+' · Archive sync pending');scheduleSync();
      } else persist();
    }
    async function restoreProgress() {
      try {
        const list=await readBookmarks(), remote=remoteFarthest(list);
        if (!progress.resetPending && remote>=0 && (!isIndex(progress.farthest) || remote>progress.farthest)) {
          progress.farthest=remote;progress.label='';persist();
        }
        status(isIndex(progress.farthest) ? (remote===progress.farthest?'Progress synced to Archive':localStatus()+' · Archive sync pending') : 'Ready to save progress');
      } catch {status(localStatus()+' · Archive unavailable');}
    }
    async function manualBookmark(index) {
      status('Saving blue bookmark…');
      try {
        const list=await readBookmarks(), b=list[index];
        const note=b?.note || '';
        await putVerified(index,{note: index===progress.farthest?withTag(note,true):note,color:1});
        status('Blue bookmark confirmed in Archive');
        scheduleSync();return true;
      } catch {status('Blue bookmark not confirmed · try again');return false;}
    }

    const launch=document.createElement('button');
    launch.id='quiet-leaf-launch';launch.type='button';launch.textContent='Read quietly · 0.6.5';
    launch.style.cssText='all:initial!important;position:fixed!important;right:16px!important;bottom:calc(20px + env(safe-area-inset-bottom))!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;padding:16px 22px!important;background:#28231c!important;color:#fff2da!important;border:1px solid #c8ac7a!important;border-radius:28px!important;font:17px Georgia,serif!important;cursor:pointer!important;box-shadow:0 3px 18px #0005!important;';
    document.documentElement.append(launch);
    let session=null;
    launch.onclick=()=>{
      if(session)return;
      try{session=start();}catch(e){session?.exit();session=null;alert('Quiet Leaf could not start: '+e.message);}
    };

    function start() {
      const first=currentPage(), firstIndex=Number(first?.dataset.index);
      if(!first || !isIndex(firstIndex)){alert('Open or borrow the book and wait for its scan, then tap Read quietly.');return null;}
      const host=document.createElement('div');host.id='quiet-leaf-reader';host.tabIndex=-1;
      host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Quiet Leaf scanned page reader');
      host.style.cssText='position:fixed!important;inset:0!important;width:100%!important;height:100%!important;z-index:2147483647!important;background:#000!important;';
      const root=host.attachShadow({mode:'open'});
      root.innerHTML=`<style>
      *{box-sizing:border-box}[hidden]{display:none!important}:host{font:16px -apple-system,sans-serif;color:#f5ebdc}
      .stage{position:absolute;inset:0;background:#000;overflow:hidden;touch-action:auto;-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}
      .stage.scrolling{overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;overflow-anchor:none;-webkit-overflow-scrolling:touch}
      .scroll-page{position:relative;display:block;width:100%;overflow:hidden;background:#000;margin:0 0 8px;flex-shrink:0;overflow-anchor:none}
      .scroll-page canvas{position:absolute;inset:0;width:100%;height:100%}
      .page-placeholder{position:absolute;inset:0;display:grid;place-items:center;color:#aaa;font:16px -apple-system,sans-serif;pointer-events:none}
      canvas{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;filter:var(--quiet-leaf-paper-filter,none)}
      .BRtextLayer{position:absolute;transform-origin:0 0;color:transparent;pointer-events:none;cursor:text;box-sizing:content-box;-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}
      .BRtextLayer *{box-sizing:content-box;color:transparent;-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}
      .BRparagraphElement{position:static;margin:0;cursor:text;font-family:Georgia,serif;line-height:0}
      .BRlineElement{pointer-events:auto;white-space:nowrap;display:inline-block}
      .BRtextLayer[dir=ltr] .BRlineElement{margin-right:100%}.BRtextLayer[dir=rtl] .BRlineElement{margin-left:100%}
      .BRparagraphElement br{visibility:hidden}.BRwordElement--hyphen::after{content:"-"}
      .BRtextLayer ::selection{background:rgba(86,155,230,.4);color:transparent}
      .paper-controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:12px;font-size:14px}
      .paper-controls label{display:flex;align-items:center;gap:8px}.paper-controls select{min-height:44px;padding:8px;background:#292929;color:#f5ebdc;border:1px solid #ffffff40;border-radius:8px;font:inherit}.paper-controls input{width:120px;min-height:44px;accent-color:#d4b27a}.paper-controls output{min-width:3.5em;font-variant-numeric:tabular-nums}
      .bar,.note,.error{-webkit-user-select:none;user-select:none}.controls-toggle{position:absolute;z-index:3;right:12px;top:calc(10px + env(safe-area-inset-top));opacity:.45;background:#202020cc}.controls-toggle:hover,.controls-toggle:focus{opacity:1}
      .bar{max-height:85%;overflow-y:auto;z-index:4;position:absolute;top:0;left:0;right:0;background:#202020f5;padding:calc(10px + env(safe-area-inset-top)) 12px 12px;box-shadow:0 4px 25px #0008}
      .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.position{margin-right:auto;font-size:14px}.status{margin:12px 2px 0;color:#c4c4c4;font-size:13px;line-height:1.6}
      button{min-height:44px;padding:8px 14px;border:1px solid #ffffff40;border-radius:8px;background:#ffffff16;color:inherit;font:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible{outline:3px solid #dfba76}.bookmark{border-color:#619cdb}
      .note{position:absolute;bottom:calc(24px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:max-content;max-width:90%;background:#202020ef;border-radius:12px;padding:12px 18px;text-align:center;line-height:1.5;pointer-events:none}
      .error{z-index:5;position:absolute;bottom:calc(20px + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(92%,520px);padding:18px;background:#161616f5;border:1px solid #a56c52;border-radius:14px;line-height:1.5;box-shadow:0 6px 30px #0008}.error p{margin:0 0 14px}.error .row{justify-content:center}
      </style><div class="stage" aria-label="Left sixth: previous page. Remaining screen: next page. Two-finger tap for controls; hold a word to select it."></div>
      <button class="controls-toggle" aria-label="Show reading controls" title="Reading controls">⋯</button><div class="bar" hidden><div class="row"><span class="position">Opening…</span><button class="bookmark">Blue bookmark</button><button class="resume">Return to farthest</button><button class="reset">Set progress here</button><button class="sync">Sync now</button><button class="full">Full screen</button><button class="hide">Hide controls</button><button class="exit">Back to Archive</button></div><div class="paper-controls"><label>Reading <select class="layout" aria-label="Reading mode"><option value="single">Single page</option><option value="scroll">Continuous scroll</option></select></label><label>Paper <select class="paper" aria-label="Paper appearance"><option value="original">Original scan</option><option value="pulp">Clean pulp</option><option value="cream">Warm cream</option><option value="gray">Grayscale</option></select></label><label>Contrast <input class="contrast" type="range" min="90" max="160" step="1" aria-label="Scan contrast"><output class="contrast-value"></output></label><label>Brightness <input class="brightness" type="range" min="85" max="130" step="1" aria-label="Paper brightness"><output class="brightness-value"></output></label></div><p class="status" role="status"></p></div>
      <div class="note" role="status" hidden></div><div class="error" hidden><p></p><div class="row"><button class="retry">Retry</button><button class="cancel">Keep current page</button><button class="error-exit">Back to Archive</button></div></div>`;
      const $=q=>root.querySelector(q),stage=$('.stage'),bar=$('.bar'),note=$('.note'),error=$('.error');
      document.documentElement.append(host);launch.style.setProperty('display','none','important');host.focus({preventScroll:true});
      let closed=false, waiting=true, shown=null, shownLabel='', target=firstIndex, nativeIndex=firstIndex;
      let pageEvents=0, activityEvents=0, requestId=0, hadFullscreen=false, bootstrapping=true,restoringIndex=null;
      let gesture,multiGesture,lookupHoldTimer,lookupActive=false,noteTimer,waitTimer,bookmarkBusy=false,lastRequest=null,loanStatus='Renewal handled by Archive';
      const listeners=[],pointers=new Map();
      const textWatches=new Map(),scrollCards=new Map();
      let readMode='single',scrollFocus=firstIndex,scrollRatio=2/3,scrollFailed=null,scrollPumpTimer,scrollEventTimer,scrollUserActive=false,scrollResizeAnchor=null;
      session={exit};
      function listen(el,type,fn){el.addEventListener(type,fn);listeners.push(()=>el.removeEventListener(type,fn));}
      function say(text,ms=3500){if(closed)return;clearTimeout(noteTimer);note.textContent=text;note.hidden=false;noteTimer=setTimeout(()=>{note.hidden=true;},ms);}
      function updateUI(){
        if(closed)return;
        const far=isIndex(progress.farthest)?(progress.label||'scan '+(progress.farthest+1)):'not saved';
        $('.status').textContent=syncMessage+' · Farthest: '+far+' · '+loanStatus;
        $('.bookmark').textContent=server[shown]?.color===1?'Blue bookmark ✓':'Blue bookmark';
        const busy=(readMode!=='scroll'&&waiting)||bookmarkBusy||!displayedReady();
        $('.layout').disabled=bootstrapping;
        $('.bookmark').disabled=busy;
        $('.reset').disabled=busy;
        $('.resume').disabled=(readMode!=='scroll'&&waiting)||bookmarkBusy||!isIndex(progress.farthest)||(progress.farthest===shown&&(readMode!=='scroll'||scrollFocus===shown));
      }
      function applyPaper(save=false){
        const tint={pulp:'saturate(0.30) sepia(0.12)',cream:'saturate(0.50) sepia(0.22)',gray:'grayscale(1)'};
        const filter=paper.mode==='original'?'none':tint[paper.mode]+' brightness('+(paper.brightness/100)+') contrast('+(paper.contrast/100)+')';
        host.style.setProperty('--quiet-leaf-paper-filter',filter);
        $('.paper').value=paper.mode;
        for(const name of ['contrast','brightness']){
          $('.'+name).value=paper[name];$('.'+name).disabled=paper.mode==='original';
          $('.'+name+'-value').textContent=paper[name]+'%';
        }
        if(save){try{localStorage.setItem(paperKey,JSON.stringify(paper));}catch{say('Paper settings could not be saved on this device.');}}
      }
      $('.paper').onchange=e=>{paper.mode=e.target.value;applyPaper(true);};
      for(const name of ['contrast','brightness'])$('.'+name).oninput=e=>{paper[name]=Number(e.target.value);applyPaper(true);};
      applyPaper();
      notify=updateUI;updateUI();
      function signalActivity(action){
        const before=activityEvents;
        action?.();
        // Native nav normally emits synchronously. Signal only if it did not.
        if(activityEvents===before) window.dispatchEvent(new CustomEvent('BookReader:userAction'));
        loanStatus='Reading activity sent to Archive';updateUI();
      }
      listen(window,'BookReader:userAction',()=>activityEvents++);
      listen(window,'BookReader:pageChanged',e=>{
        pageEvents++;
        const index=e.detail?.props?.index ?? e.detail?.props?.firstIndex;
        if(isIndex(index))nativeIndex=index;
        else {const p=currentPage();if(p)nativeIndex=Number(p.dataset.index);}
      });
      const loanEventsRoot=findAll('ia-book-actions')[0];
      if(loanEventsRoot)listen(loanEventsRoot,'loanAutoRenewed',()=>{loanStatus='Archive reported loan renewal';updateUI();});
      function hasSelection(){
        const selections=[root.getSelection?.(),window.getSelection()];
        return selections.some(s=>{
          if(!s)return false;
          if(!s.isCollapsed)return true;
          // Safari may expose shadow selections only through composed ranges.
          try{return s.getComposedRanges?.({shadowRoots:[root]}).some(r=>r.startContainer!==r.endContainer||r.startOffset!==r.endOffset)||false;}catch{return false;}
        });
      }
      listen(document,'selectionchange',()=>{if(hasSelection())lookupActive=true;});
      function dismissLookup(){
        clearTimeout(lookupHoldTimer);
        for(const selection of [root.getSelection?.(),window.getSelection()])selection?.removeAllRanges?.();
        lookupActive=false;
      }
      function stopTextWatch(container){
        for(const [node,watch] of textWatches){if(container&&node!==container)continue;watch.observer.disconnect();clearTimeout(watch.timer);textWatches.delete(node);}
      }
      function fitTextLayer(){
        for(const selectionLayer of stage.querySelectorAll('.BRtextLayer')){
        const container=selectionLayer.parentElement;
        const r=container.getBoundingClientRect(),w=parseFloat(selectionLayer.style.width),h=parseFloat(selectionLayer.style.height);
        if(!(r.width>0&&r.height>0&&w>0&&h>0))continue;
        const canvas=container.querySelector('canvas');if(!canvas)continue;
        // Match the canvas's actual object-fit rectangle, including black bands.
        // OCR page dimensions and decoded-image dimensions need not be identical.
        const scale=Math.min(r.width/canvas.width,r.height/canvas.height);
        const imageWidth=canvas.width*scale,imageHeight=canvas.height*scale;
        selectionLayer.style.left=((r.width-imageWidth)/2)+'px';
        selectionLayer.style.top=((r.height-imageHeight)/2)+'px';
        selectionLayer.style.transform='scale('+(imageWidth/w)+','+(imageHeight/h)+')';
        }
      }
      function attachTextLayer(el,container=stage){
        stopTextWatch(container);let attached=false;
        // Reuse only the native reader's already-rendered text. No OCR requests,
        // image recognition, or replacement typography: the original scan stays visible.
        const attach=()=>{
          if(closed||!container.isConnected||Number(el.dataset.index)!==(container===stage?shown:Number(container.dataset.index)))return;
          const source=el.querySelector('.BRtextLayer');
          if(!source?.querySelector('.BRwordElement'))return;
          const w=parseFloat(source.style.width),h=parseFloat(source.style.height);
          if(!(w>0&&h>0))return;
          const layer=copyTextLayer(source);
          if(!layer)return;
          layer.setAttribute('dir',layer.getAttribute('dir')||source.getAttribute('dir')||getComputedStyle(source).direction||'ltr');
          layer.style.display='block';layer.style.visibility='visible';layer.style.opacity='1';
          layer.style.pointerEvents='none';layer.style.color='transparent';
          container.querySelector('.BRtextLayer')?.remove();container.append(layer);attached=true;fitTextLayer();stopTextWatch(container);
        };
        attach();
        if(!attached){
          // The official OCR layer commonly arrives after its image.
          const observer=new MutationObserver(attach);observer.observe(el,{childList:true,subtree:true});
          const timer=setTimeout(()=>stopTextWatch(container),20000);textWatches.set(container,{observer,timer});
        }
      }
      function resizeReader(){
        if(readMode==='scroll'&&scrollResizeAnchor){
          const {index,fraction}=scrollResizeAnchor,card=scrollCards.get(index);
          if(card){scrollUserActive=false;stage.scrollTop=card.offsetTop+fraction*card.offsetHeight;}
        }
        fitTextLayer();
      }
      listen(window,'resize',resizeReader);
      if(typeof ResizeObserver==='function'){
        const resize=new ResizeObserver(resizeReader);resize.observe(stage);listeners.push(()=>resize.disconnect());
      }
      function confirmResume(index){
        if(restoringIndex!==index)return;
        restoringIndex=null;bootstrapping=false;
        // The page selected when Quiet Leaf opened is never evidence of new progress.
        // Only the actual requested resume scan releases the startup guard.
      }
      async function settleSinglePage(single){
        single.click();
        const began=Date.now();let stableSince=began,lastIndex=null,lastEvents=pageEvents;
        while(!closed&&Date.now()-began<15000){
          await delay(80);
          const index=readerIndex(),el=currentPage(),img=imageOf(el);
          if(index!==lastIndex||pageEvents!==lastEvents){lastIndex=index;lastEvents=pageEvents;stableSince=Date.now();}
          if(img?.complete&&img.naturalWidth&&Date.now()-stableSince>=320){
            if(isIndex(index))nativeIndex=index;
            return;
          }
        }
        if(!closed)throw new Error('Archive is still switching views. Retry, or return to Archive.');
      }
      function draw(el,advance=true){
        const img=imageOf(el);
        if(!img?.complete || !img.naturalWidth || !img.naturalHeight)return false;
        const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
        try{canvas.getContext('2d').drawImage(img,0,0);}
        catch{throw new Error('Archive’s scan could not be copied into the reader. Retry, or return to Archive.');}
        canvas.setAttribute('role','img');
        const index=Number(el.dataset.index),label=el.dataset.pageNum||String(index+1);
        canvas.setAttribute('aria-label','Scanned page '+label);
        if(readMode==='scroll')return acceptScrollPage(el,canvas,index,label);
        stage.replaceChildren(canvas);
        if(advance)confirmResume(index);
        shown=index;shownLabel=label;nativeIndex=index;attachTextLayer(el);waiting=false;error.hidden=true;note.hidden=true;
        $('.position').textContent='Page '+label;
        if(advance)record(index,label);
        updateUI();return true;
      }
      function fail(message){
        if(closed)return;if(readMode==='scroll')scrollFailed=target;waiting=false;requestId++;clearTimeout(waitTimer);note.hidden=true;
        // Leave the last successfully displayed canvas in place.
        error.querySelector('p').textContent=message;error.hidden=false;$('.cancel').hidden=bootstrapping||!displayedReady();
        $('.retry').focus();updateUI();
      }
      function selectLeaf(index){
        const handle=pageSlider();
        if(!handle?.closest('.BRpager')){
          const list=findAll('ia-bookmarks-list')[0];
          if(list){list.dispatchEvent(new CustomEvent('bookmarkSelected',{detail:{bookmark:{id:index,leafNum:index}}}));return;}
          throw new Error('Archive’s page control is not ready. Return to Archive and wait for the reader to load.');
        }
        const min=Number(handle.getAttribute('aria-valuemin')||0),max=Number(handle.getAttribute('aria-valuemax'));
        if(!isIndex(max)||index<min||index>max)throw new Error('This scan is outside Archive’s available page range.');
        const now=readerIndex()??nativeIndex;
        if(!isIndex(now))throw new Error('Archive’s current scan could not be identified.');
        const steps=Math.abs(index-now);
        if(!steps)return;
        if(steps>20000)throw new Error('This page jump is too large. Select a nearer page in Archive first.');
        // BookReader exposes Left/Right to jQuery UI. Repeated keydowns followed
        // by ONE keyup select an exact leaf and commit ONE jump. Mouse coordinates
        // can round to a neighbouring leaf, especially in long volumes on Safari.
        // For pageProgression rl, BookReader swaps Left and Right before that
        // handler. Send the opposite key so the leaf index still moves forward.
        const increase=rightToLeft()?index<now:index>now;
        const key=increase?'ArrowRight':'ArrowLeft',keyCode=increase?39:37;
        const options={key,code:key,keyCode,which:keyCode,bubbles:true,cancelable:true,view:window};
        for(let step=0;step<steps;step++)handle.dispatchEvent(new KeyboardEvent('keydown',options));
        handle.dispatchEvent(new KeyboardEvent('keyup',options));
      }
      function pageLimit(){
        const slider=pageSlider();
        const max=Number(slider?.getAttribute('aria-valuemax'));
        return slider&&isIndex(max)?max:Infinity;
      }
      function displayedReady(){
        return shown!==null && (readMode!=='scroll'||(scrollFocus===shown&&!!scrollCards.get(shown)?.querySelector('canvas')));
      }
      function scrollAnchor(){
        const card=[...stage.children].find(c=>c.offsetTop+c.offsetHeight>stage.scrollTop);
        return card?{card,offset:stage.scrollTop-card.offsetTop}:null;
      }
      function restoreAnchor(anchor){if(anchor?.card.isConnected)stage.scrollTop=anchor.card.offsetTop+anchor.offset;}
      function ensureCard(index){
        if(!isIndex(index)||index>pageLimit())return null;
        if(scrollCards.has(index))return scrollCards.get(index);
        const anchor=scrollAnchor(),card=document.createElement('div');
        card.className='scroll-page';card.dataset.index=index;card.style.aspectRatio=String(scrollRatio);
        card.setAttribute('role','group');card.setAttribute('aria-label','Scan '+(index+1));
        const label=document.createElement('span');label.className='page-placeholder';label.textContent='Loading scan '+(index+1)+'…';card.append(label);
        const next=[...scrollCards.entries()].filter(([i])=>i>index).sort((a,b)=>a[0]-b[0])[0]?.[1];
        stage.insertBefore(card,next||null);scrollCards.set(index,card);restoreAnchor(anchor);
        return card;
      }
      function scrollPump(){
        clearTimeout(scrollPumpTimer);
        scrollPumpTimer=setTimeout(()=>{
          if(closed||readMode!=='scroll'||waiting||bootstrapping||document.hidden||!error.hidden)return;
          for(const index of [scrollFocus,scrollFocus+1,scrollFocus-1]){
            if(index===scrollFailed)continue;
            const card=ensureCard(index);
            if(card&&!card.querySelector('canvas')){loadNativePage(index,{advance:false});break;}
          }
        },100);
      }
      function updateScroll(user=false){
        if(closed||readMode!=='scroll'||bootstrapping)return;
        const viewport=stage.getBoundingClientRect();
        if(!viewport.height)return;
        // A page is reached at the reading line, one quarter down the viewport.
        // Loaded neighbours below it are not progress.
        const line=viewport.top+Math.min(200,viewport.height/4);
        const card=[...stage.children].find(c=>{
          const r=c.getBoundingClientRect();return r.top<=line&&r.bottom>line;
        });
        if(!card)return;
        const index=Number(card.dataset.index);if(!isIndex(index))return;
        scrollFocus=index;
        scrollResizeAnchor={index,fraction:card.offsetHeight?(stage.scrollTop-card.offsetTop)/card.offsetHeight:0};
        if(card.querySelector('canvas')){
          const changed=shown!==index;
          shown=index;shownLabel=card.dataset.label||String(index+1);
          $('.position').textContent='Page '+shownLabel;
          if(changed||progress.last!==index)record(index,shownLabel);
          if(changed&&user)signalActivity();
        }
        ensureCard(index-1);ensureCard(index+1);
        // Retain page-sized placeholders so evicting old scans never moves the scroll position.
        for(const [i,c] of scrollCards){
          if(Math.abs(i-index)>2&&c.querySelector('canvas')){
            stopTextWatch(c);c.replaceChildren();
            const label=document.createElement('span');label.className='page-placeholder';label.textContent='Loading scan '+(i+1)+'…';c.append(label);
          }
        }
        updateUI();scrollPump();
      }
      function jumpScroll(index,activity=false){
        if(!isIndex(index)||index>pageLimit())return;
        if(!scrollCards.has(index)){setReadingMode('scroll',index,false);if(activity)signalActivity();return;}
        scrollUserActive=false;scrollFocus=index;stage.scrollTop=scrollCards.get(index).offsetTop;
        if(activity)signalActivity();updateScroll(false);
        // Never let a distant, obsolete preload hold up an explicit jump.
        if(waiting&&Math.abs(target-index)>1){requestId++;clearTimeout(waitTimer);waiting=false;}
        if(!scrollCards.get(index).querySelector('canvas')&&!waiting)loadNativePage(index,{advance:false});
      }
      function setReadingMode(mode,index=shown,remember=true){
        if(mode!=='scroll')mode='single';
        index=isIndex(index)?index:firstIndex;
        const source=readMode==='scroll'?scrollCards.get(index):(index===shown?stage:null);
        const canvas=source?.querySelector('canvas'),layer=source?.querySelector('.BRtextLayer');
        requestId++;clearTimeout(waitTimer);clearTimeout(scrollPumpTimer);clearTimeout(scrollEventTimer);waiting=false;
        stopTextWatch();dismissLookup();error.hidden=true;scrollFailed=null;
        readMode=mode;preferredMode=mode;scrollUserActive=false;scrollResizeAnchor=null;
        if(remember){try{localStorage.setItem(layoutKey,mode);}catch{say('Reading mode could not be saved.');}}
        $('.layout').value=mode;stage.classList.toggle('scrolling',mode==='scroll');
        stage.setAttribute('aria-label',mode==='scroll'?'Scroll vertically to read. Two-finger tap for controls; hold a word to select it.':'Left sixth: previous page. Remaining screen: next page. Two-finger tap for controls; hold a word to select it.');
        stage.replaceChildren();scrollCards.clear();stage.scrollTop=0;
        if(mode==='scroll'){
          if(canvas)scrollRatio=canvas.width/canvas.height;
          scrollFocus=index;
          ensureCard(index-1);const card=ensureCard(index);ensureCard(index+1);
          if(canvas){card.replaceChildren(canvas);card.dataset.label=shownLabel;card.style.aspectRatio=String(canvas.width/canvas.height);if(layer)card.append(layer);}
          stage.scrollTop=card.offsetTop;
          if(canvas){confirmResume(index);fitTextLayer();updateScroll(false);}else loadNativePage(index,{advance:false});
        }else{
          if(canvas){stage.append(canvas);if(layer)stage.append(layer);confirmResume(index);fitTextLayer();shown=index;updateUI();}
          else loadNativePage(index);
        }
      }
      function acceptScrollPage(el,canvas,index,label){
        const card=ensureCard(index);if(!card)return false;
        const anchor=scrollAnchor();
        card.style.aspectRatio=String(canvas.width/canvas.height);scrollRatio=canvas.width/canvas.height;
        card.dataset.label=label;card.replaceChildren(canvas);restoreAnchor(anchor);
        if(restoringIndex===index){stage.scrollTop=card.offsetTop;confirmResume(index);}
        attachTextLayer(el,card);waiting=false;scrollFailed=null;error.hidden=true;note.hidden=true;
        updateScroll(scrollUserActive);scrollPump();return true;
      }
      listen(stage,'scroll',()=>{
        clearTimeout(scrollEventTimer);
        scrollEventTimer=setTimeout(()=>updateScroll(scrollUserActive),80);
      });
      listen(stage,'wheel',()=>{scrollUserActive=true;});
      $('.layout').onchange=e=>{if(!bootstrapping)setReadingMode(e.target.value);};
      function requestPage(index,options={}){
        if(readMode==='scroll')jumpScroll(index,!!options.activity);
        else loadNativePage(index,options);
      }
      function loadNativePage(index,{direction=0,activity=false,advance=true,force=false}={}){
        if(closed || !isIndex(index))return;
        const observedIndex=readerIndex();if(isIndex(observedIndex))nativeIndex=observedIndex;
        clearTimeout(waitTimer);target=index;waiting=true;error.hidden=true;updateUI();
        const id=++requestId,started=Date.now();let corrections=0,lastCorrection=started;
        lastRequest={index,advance};
        const navigate=()=>{
          if(direction){const button=control(direction>0?'next':'previous');if(!button)throw new Error('The Archive page-turn control is unavailable.');button.click();}
          else if(nativeIndex!==index || force)selectLeaf(index);
        };
        try{activity?signalActivity(navigate):navigate();}catch(e){fail(e.message);return;}
        function check(){
          if(closed||id!==requestId)return;
          const el=pages().find(p=>Number(p.dataset.index)===index && imageOf(p)?.naturalWidth);
          const observed=readerIndex();
          if(isIndex(observed))nativeIndex=observed;
          const arrived=nativeIndex===index;
          try{if(arrived&&el&&draw(el,advance))return;}catch(e){fail(e instanceof Error&&e.message?e.message:'The scan could not be displayed. Retry or return to the Archive.');return;}
          // The native reader can finish an earlier asynchronous scroll after our
          // request. Correct a missed jump twice, without an endless retry loop.
          if(!arrived&&Date.now()-lastCorrection>1200&&corrections<2){
            corrections++;lastCorrection=Date.now();
            try{selectLeaf(index);}catch(e){fail(e.message);return;}
          }
          if(Date.now()-started>15000){
            fail(arrived?'Archive selected scan '+(index+1)+', but its image has not loaded. Retry, or check the page in Archive.':
              'Archive did not reach scan '+(index+1)+' (still at scan '+(nativeIndex+1)+'). Retry navigation, or return to Archive.');return;
          }
          waitTimer=setTimeout(check,200);
        }
        check();
      }
      function turn(delta){
        if((waiting&&readMode!=='scroll')||bookmarkBusy||bootstrapping||!error.hidden)return;
        if(!bar.hidden){bar.hidden=true;host.focus({preventScroll:true});return;}
        const index=shown+delta;
        if(index<0){say('Beginning of book');return;}
        const slider=pageSlider();
        const max=Number(slider?.getAttribute('aria-valuemax'));
        if(slider&&Number.isFinite(max)&&index>max){say('End of book');return;}
        // After a cancelled load the underlying reader may be ahead: select the exact leaf.
        requestPage(index,{direction:nativeIndex===shown?delta:0,activity:true});
      }
      async function awaitNative(index,ticket,ms){
        const start=Date.now();
        while(!closed&&ticket===requestId&&nativeIndex!==index&&Date.now()-start<ms){
          await delay(80);
          const observed=readerIndex();if(isIndex(observed))nativeIndex=observed;
        }
        return !closed&&ticket===requestId&&nativeIndex===index;
      }
      async function retry(userInitiated=true){
        const request=lastRequest;
        if(!request || closed)return;
        const index=request.index;
        const existing=pages().find(el=>Number(el.dataset.index)===index);
        const img=imageOf(existing);
        // BookReader ignores a jump to its current index. If that scan failed, briefly
        // navigate away and back through native selection to request it again. Never
        // display or record the intermediate leaf, and never rewrite signed image URLs.
        // Confirm the return. If it misses, select the failed leaf again so Archive
        // is not left on the neighbour.
        if(nativeIndex===index && (!img?.complete || !img.naturalWidth)){
          const ticket=++requestId;
          waiting=true;error.hidden=true;updateUI();
          const neighbour=index>0?index-1:index+1;
          const jump=target=>selectLeaf(target);
          try{
            userInitiated?signalActivity(()=>jump(neighbour)):jump(neighbour);
            if(!(await awaitNative(neighbour,ticket,2500))){
              if(!closed&&ticket===requestId)fail('The Archive could not restart this page. Return to it to check your loan.');
              return;
            }
            jump(index);
            if(!(await awaitNative(index,ticket,2500))){
              if(closed||ticket!==requestId)return;
              jump(index);
              if(!(await awaitNative(index,ticket,2500))){
                if(!closed&&ticket===requestId)fail('The Archive could not return to this page. Return to it to check your loan.');
                return;
              }
            }
            if(closed||ticket!==requestId)return;
            loadNativePage(index,{advance:request.advance});
          }catch(e){fail(e.message);}
        }else loadNativePage(index,{force:true,activity:userInitiated,advance:request.advance});
      }
      async function blueBookmark(){
        if((waiting&&readMode!=='scroll')||bookmarkBusy||!displayedReady())return;
        const index=shown;bookmarkBusy=true;updateUI();
        await enqueue(()=>manualBookmark(index));
        bookmarkBusy=false;updateUI();
      }
      function resetProgress(){
        if((waiting&&readMode!=='scroll')||!displayedReady())return;
        if(!confirm('Set your farthest-page marker to this displayed page? Your manual bookmarks and notes will stay.'))return;
        revision++;progress={...progress,farthest:shown,label:shownLabel,last:shown,updated:Date.now(),resetPending:true};
        persist();status(localStatus()+' · Reset sync pending');scheduleSync();
      }
      function full(){
        const fn=host.requestFullscreen||host.webkitRequestFullscreen;
        if(!fn){say('Fullscreen is unavailable in this Safari window.',5000);return;}
        try{Promise.resolve(fn.call(host)).then(()=>{if(!closed){hadFullscreen=!!(document.fullscreenElement||document.webkitFullscreenElement);bar.hidden=true;}}).catch(()=>say('Safari declined fullscreen. Two-finger tap and try Full screen.',5000));}
        catch{say('Fullscreen is unavailable here.',5000);}
      }
      function exit(){
        if(closed)return;closed=true;requestId++;
        [lookupHoldTimer,noteTimer,waitTimer,scrollPumpTimer,scrollEventTimer].forEach(clearTimeout);stopTextWatch();pointers.clear();listeners.forEach(remove=>remove());
        notify=()=>{};
        // Bookmark metadata jobs finish independently; no page image work survives exit.
        clearTimeout(syncTimer);enqueue(syncProgress);
        if(document.fullscreenElement===host)document.exitFullscreen?.().catch(()=>{});
        else if(document.webkitFullscreenElement===host)document.webkitExitFullscreen?.();
        host.remove();session=null;launch.style.setProperty('display','block','important');launch.focus({preventScroll:true});
      }
      function fullscreenChanged(){
        const active=document.fullscreenElement||document.webkitFullscreenElement;
        if(active===host)hadFullscreen=true;
        else if(hadFullscreen){
          hadFullscreen=false;
          // Safari can leave fullscreen during a gesture or native reader navigation.
          // This changes presentation only; it must not destroy the reading session.
          resizeReader();updateUI();
        }
      }
      listen(document,'fullscreenchange',fullscreenChanged);listen(document,'webkitfullscreenchange',fullscreenChanged);
      listen(window,'pagehide',()=>{persist();exit();});
      listen(document,'visibilitychange',()=>{
        if(document.hidden){persist();clearTimeout(syncTimer);enqueue(syncProgress);return;}
        if(bootstrapping)return;
        // Archive receives the same visibility event and checks its loan. No fictitious activity.
        loanStatus='Checking page after waking';updateUI();
        if(readMode==='scroll'){updateScroll(false);scrollPump();}else requestPage(isIndex(shown)?shown:target,{activity:false});
        enqueue(syncProgress);
      });
      listen(window,'online',()=>{enqueue(syncProgress);if(!error.hidden)retry(false);});
      function toggleControls(){bar.hidden=!bar.hidden;updateUI();}
      $('.controls-toggle').onclick=toggleControls;
      stage.addEventListener('pointerdown',e=>{
        if(e.pointerType==='mouse'&&e.button!==0)return;
        scrollUserActive=true;
        const point={x:e.clientX,y:e.clientY};pointers.set(e.pointerId,point);
        if(pointers.size===1){
          gesture={id:e.pointerId,...point,started:Date.now(),selection:lookupActive||hasSelection()};multiGesture=null;
          clearTimeout(lookupHoldTimer);
          lookupHoldTimer=setTimeout(()=>{if(gesture&&!multiGesture)lookupActive=true;},300);
        }else{
          clearTimeout(lookupHoldTimer);
          if(pointers.size===2)multiGesture={started:gesture?.started??Date.now(),valid:true};
          else if(multiGesture)multiGesture.valid=false;
          gesture=null;
        }
        // Never preventDefault or capture pointers: Safari owns long-press selection.
      });
      stage.addEventListener('pointermove',e=>{
        const p=pointers.get(e.pointerId);
        if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>12){clearTimeout(lookupHoldTimer);gesture=null;if(multiGesture)multiGesture.valid=false;}
      });
      stage.addEventListener('pointercancel',e=>{if(gesture&&!multiGesture)lookupActive=true;clearTimeout(lookupHoldTimer);pointers.delete(e.pointerId);gesture=null;if(multiGesture)multiGesture.valid=false;});
      stage.addEventListener('contextmenu',()=>{lookupActive=true;clearTimeout(lookupHoldTimer);gesture=null;if(multiGesture)multiGesture.valid=false;});
      stage.addEventListener('pointerup',e=>{
        clearTimeout(lookupHoldTimer);
        const known=pointers.has(e.pointerId);pointers.delete(e.pointerId);
        if(!known)return;
        if(multiGesture){
          if(!pointers.size){const g=multiGesture;multiGesture=null;if(g.valid&&Date.now()-g.started<300)toggleControls();}
          return;
        }
        const g=gesture;gesture=null;
        if(!g||g.id!==e.pointerId)return;
        if(Date.now()-g.started>=300){lookupActive=true;return;}
        // A lookup stays latched even if Safari clears its selection before pointerdown.
        // This entire gesture belongs to dismissing the menu; the next tap can turn.
        if(g.selection){dismissLookup();return;}
        if(lookupActive||hasSelection()){lookupActive=true;return;}
        if(readMode==='scroll'){if(!bar.hidden)bar.hidden=true;return;}
        const r=stage.getBoundingClientRect();turn(e.clientX<r.left+r.width/6?-1:1);
      });
      // A pointerup on the controls bar never reaches .stage, and capturing the pointer would take
      // long-press selection from Safari. Drop that touch so the next tap is not stuck as a pinch.
      function releaseOutside(e){
        if(!pointers.has(e.pointerId)||e.composedPath().includes(stage))return;
        if(e.type==='pointercancel'&&gesture&&!multiGesture)lookupActive=true;
        clearTimeout(lookupHoldTimer);pointers.delete(e.pointerId);
        if(gesture?.id===e.pointerId)gesture=null;
        if(multiGesture){multiGesture.valid=false;if(!pointers.size)multiGesture=null;}
      }
      listen(root,'pointerup',releaseOutside);listen(root,'pointercancel',releaseOutside);
      listen(window,'pointerup',releaseOutside);listen(window,'pointercancel',releaseOutside);
      function focusableControls(){
        return [...root.querySelectorAll('button, input, select, textarea')].filter(el=>{
          if(el.disabled||el.closest('[hidden]'))return false;
          const style=getComputedStyle(el);
          return style.display!=='none'&&style.visibility!=='hidden';
        });
      }
      host.addEventListener('keydown',e=>{
        if(e.key==='Tab'){
          const items=focusableControls();
          e.preventDefault();
          if(!items.length){host.focus({preventScroll:true});return;}
          const current=e.composedPath()[0];
          const index=items.indexOf(current);
          const next=e.shiftKey?(index<=0?items[items.length-1]:items[index-1]):(index<0||index===items.length-1?items[0]:items[index+1]);
          next.focus({preventScroll:true});
          return;
        }
        if(e.key!=='Escape'&&e.composedPath()[0].matches?.('input,select,textarea'))return;
        if(readMode==='scroll'&&['ArrowDown','ArrowUp','PageDown','PageUp'].includes(e.key)){e.preventDefault();scrollUserActive=true;stage.scrollBy(0,(e.key==='ArrowUp'||e.key==='PageUp'?-1:1)*stage.clientHeight*.8);return;}
        if(e.key==='Escape'){e.preventDefault();exit();}
        else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();turn(e.key==='ArrowRight'?1:-1);}
        else if(e.key===' '&&e.composedPath()[0]===host){e.preventDefault();bar.hidden=!bar.hidden;updateUI();}
      });
      $('.exit').onclick=exit;$('.error-exit').onclick=exit;$('.full').onclick=full;
      $('.hide').onclick=()=>{bar.hidden=true;host.focus({preventScroll:true});};$('.bookmark').onclick=blueBookmark;
      $('.resume').onclick=()=>{bar.hidden=true;requestPage(progress.farthest,{activity:true});};$('.reset').onclick=resetProgress;
      $('.sync').onclick=()=>enqueue(syncProgress);$('.retry').onclick=()=>retry(true);
      $('.cancel').onclick=()=>{requestId++;clearTimeout(waitTimer);waiting=false;error.hidden=true;updateUI();};
      // Show current scan immediately while reconciling saved progress, but don't advance it yet.
      draw(first,false);waiting=true;updateUI();full();
      enqueue(restoreProgress).then(async()=>{
        if(closed)return;
        const resume=isIndex(progress.farthest)?progress.farthest:firstIndex;
        restoringIndex=resume;lastRequest={index:resume,advance:true};
        const single=control('single');
        if(!single){fail('The Archive single-page control is unavailable. Return to it and select one-page view.');return;}
        try{
          // Native mode1Up.prepare() schedules its own jump to the OLD index.
          // Let that finish before requesting the saved progress page.
          await settleSinglePage(single);
          if(closed)return;
          if(preferredMode==='scroll')setReadingMode('scroll',resume,false);
          else requestPage(resume,{activity:false,force:true});
          scheduleSync();
        }catch(e){if(!closed)fail(e.message);}
      }).catch(()=>{if(!closed)fail('Saved progress could not be restored. Retry or return to Archive.');});
      return {exit};
    }
  }
  if(document.body)boot();else document.addEventListener('DOMContentLoaded',boot,{once:true});
})();

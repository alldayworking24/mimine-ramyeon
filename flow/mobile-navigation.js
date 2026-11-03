/* Touch navigation follows the five visible bottom tabs. */
function installMimineSwipe({root,getPage,navigateTo,isBlocked,isEnabled,now=Date.now}){
 const pages=['today','ledger','reports','bank','products'];
 let gesture=null,suppressClickUntil=0;
 const mainTarget=target=>target?.closest?.('#main');
 function eligible(target){
  if(!mainTarget(target)||target.closest('[data-swipe-ignore],.daily-line-svg,.sheet,.modal-overlay,input,textarea,select,[contenteditable],a'))return false;
  const button=target.closest('button');
  return !button||button.matches('.product-card,.record-row,[data-action="entry"],[data-action="day-detail"]');
 }
 root.addEventListener('touchstart',event=>{
  gesture=null;
  if(event.touches.length!==1||!isEnabled()||isBlocked()||!eligible(event.target))return;
  const t=event.touches[0];gesture={x:t.clientX,y:t.clientY,time:now(),page:getPage(),horizontal:false};
 },{passive:true});
 root.addEventListener('touchmove',event=>{
  if(!gesture)return;
  if(event.touches.length!==1||isBlocked()){gesture=null;return;}
  const t=event.touches[0],dx=Math.abs(t.clientX-gesture.x),dy=Math.abs(t.clientY-gesture.y);
  if(dy>12&&dy>dx){gesture=null;return;}
  if(dx>12&&dx>dy*1.4){gesture.horizontal=true;if(event.cancelable)event.preventDefault();}
 },{passive:false});
 root.addEventListener('touchend',event=>{
  const g=gesture;gesture=null;if(!g||event.touches?.length||isBlocked()||!isEnabled()||g.page!==getPage())return;
  const t=event.changedTouches?.[0];if(!t)return;
  const dx=t.clientX-g.x,dy=t.clientY-g.y,index=pages.indexOf(g.page);
  if(index<0||Math.abs(dx)<60||Math.abs(dx)<=Math.abs(dy)*1.4||now()-g.time>1000)return;
  if(event.cancelable)event.preventDefault();suppressClickUntil=now()+350;
  navigateTo(pages[(index+(dx<0?1:-1)+pages.length)%pages.length]);
 },{passive:false});
 root.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
 // A swipe that began on a product must not also open the product on release.
 root.addEventListener('click',event=>{
  if(event.detail!==0&&now()<suppressClickUntil&&mainTarget(event.target)){
   event.preventDefault();event.stopImmediatePropagation();
  }
 },true);
}
installMimineSwipe({root:document,getPage:()=>view.page,navigateTo:page=>navigate(page),
 isBlocked:()=>!!modalName||productionBusy,
 isEnabled:()=>window.matchMedia('(max-width:760px)').matches});

/* Keep tabs inside the visible screen when mobile browser controls resize it. */
function installMimineNavViewport({win,doc}){
 const viewport=win.visualViewport;if(!viewport)return;
 const nav=doc.getElementById('mobile-nav');if(!nav)return;
 let inset=0,scheduled=false;
 function update(){
  scheduled=false;
  const editing=doc.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  const mobile=win.matchMedia('(max-width:760px)').matches;
  // Do not float the menu over the keyboard or a pinch-zoomed page.
  const next=!mobile||editing||Math.abs(viewport.scale-1)>.02?0:
   Math.max(0,Math.round(nav.getBoundingClientRect().bottom+inset-viewport.offsetTop-viewport.height));
  if(next!==inset){inset=next;doc.documentElement.style.setProperty('--mobile-nav-inset',`${inset}px`);}
 }
 function schedule(){if(!scheduled){scheduled=true;win.requestAnimationFrame(update);}}
 viewport.addEventListener('resize',schedule,{passive:true});
 viewport.addEventListener('scroll',schedule,{passive:true});
 win.addEventListener('resize',schedule,{passive:true});
 doc.addEventListener('focusin',schedule);
 doc.addEventListener('focusout',schedule);
 schedule();
}
installMimineNavViewport({win:window,doc:document});

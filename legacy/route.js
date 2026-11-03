/* Optional legacy tools; the root index is always the new interface. */
(()=>{
 const back=document.createElement('a');back.href='index.html';back.textContent='← 새 화면으로 돌아가기';
 back.style.cssText='position:fixed;right:12px;top:10px;z-index:50000;background:white;border:1px solid #ddd;border-radius:10px;padding:10px 14px;color:#234;text-decoration:none;font-weight:700';document.body.append(back);
 const panel=new URLSearchParams(location.hash.slice(1)).get('panel');
 if(!['products','purchases','more','all','devices','matching','compare','transactions'].includes(panel))return;
 let tries=0;const timer=setInterval(()=>{if(++tries>120){clearInterval(timer);return;}if(document.getElementById('appView')?.classList.contains('hidden'))return;clearInterval(timer);if(['devices','matching','compare','transactions'].includes(panel))openBank(panel);else openPanel(panel);},250);
})();

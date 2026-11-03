import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const html=await read('index.html');
assert.equal(html,await read('dist/index.html'));
assert.ok(html.includes('id="main"'));
assert.ok(html.includes('일별 매출'));
assert.ok(!html.includes('src="flow-bridge.js'));
assert.ok(!html.includes('id="appView"'));
assert.ok((await read('legacy/index.html')).includes('id="appView"'));
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
// Execute the actual entry selection without mounting the UI. A direct file must
// neither load the auth SDK nor request operational data.
const entry=script.slice(0,script.indexOf('const productionToday='))+'globalThis.selected=bootBridge;})();';
for(const [protocol,search,demo] of [['file:','',true],['content:','',true],['content:','?preview=1',true],['about:','',true],['http:','',false],['https:','?preview=1',true],['https:','',false]]){
 const elements=new Map();
 const c={URL,URLSearchParams,Date,Intl,structuredClone,console,
  location:{protocol,search,hash:'',href:protocol==='content:'?'content://media/external/file/100035246':protocol==='file:'?'file:///demo/index.html':'https://example.test/'},
  document:{getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id);}},
  fetch(){throw Error('Unexpected network in preview');}};
 c.window=c;c.parent=c;vm.createContext(c);
 // The hosted branch is stubbed at the authentication boundary; it must be used.
 let authCalls=0;c.authStub=async()=>{authCalls++;return{isDemo:false};};
 const staged=entry.replace('await createMimineAuthenticatedBridge()','await authStub()');
 await vm.runInContext(staged,c);
 assert.equal(c.selected.isDemo,demo,protocol);assert.equal(elements.get('preview-exit').hidden, !['http:','https:'].includes(protocol));assert.equal(authCalls,demo?0:1);
 if(demo){
  const before=await c.selected.snapshot();
  await c.selected.invoke('sale',{date:'2026-11-03',amount:200000,note:'preview'});
  const after=await c.selected.snapshot();
  assert.notEqual(before.sales.find(s=>s.date==='2026-11-03').amount,200000);
  assert.equal(after.sales.find(s=>s.date==='2026-11-03').amount,200000);
 }
}
// Saved-session access is gated on the active app_users record.
for(const active of [true,false]){
 const elements=new Map();let resolved=false;
 const c={URL,URLSearchParams,setTimeout,location:{protocol:'https:',href:'https://example.test/',search:'',hash:''},
 document:{getElementById(id){if(!elements.has(id))elements.set(id,{addEventListener(){}});return elements.get(id);}},
 createMimineProductionBridge(){resolved=true;return{isDemo:false};}};
 c.window={supabase:{createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user:{id:'fixture'}}}})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{is_active:active}})})})}};
 vm.createContext(c);vm.runInContext(await read('flow/auth.js'),c);
 vm.runInContext('createMimineAuthenticatedBridge()',c);
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(resolved,active);
 if(!active)assert.match(elements.get('auth-message').textContent,/승인/);
}
console.log('Root entry: matching built HTML, compiled syntax, direct-file preview isolation, edits, hosted auth and inactive-account gate passed.');

// Even a direct auth call under an Android content URL must not load scripts,
// inspect saved sessions, accept credentials or contact a server.
{
 const c={URL,URLSearchParams,Date,structuredClone,location:{protocol:'content:'},document:{createElement(){throw Error('Local SDK access is forbidden');}},window:{},fetch(){throw Error('Local network is forbidden');}};
 vm.createContext(c);
 vm.runInContext(await read('flow/preview-provider.js')+'\n'+await read('flow/auth.js'),c);
 const bridge=await vm.runInContext('createMimineAuthenticatedBridge()',c);
 assert.equal(bridge.isDemo,true);
 assert.ok((await bridge.snapshot()).products.length);
 console.log('Android content URL: no SDK load, no credentials or network, immediate working preview passed.');
}

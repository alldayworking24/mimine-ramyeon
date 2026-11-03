import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,access} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const html=await read('index.html'),mockup=await read('mockup.html');
assert.equal(html,await read('dist/index.html'));
assert.ok(html.includes('id="main"'));
assert.ok(!html.includes('id="appView"'));
assert.ok((await read('legacy/index.html')).includes('id="appView"'));
assert.ok(!html.includes('id="auth-preview"'));
assert.ok(!html.includes('function createMiminePreviewProvider'));
assert.ok(!html.includes('parent.MimineBridge'));
assert.ok(mockup.includes('function createMiminePreviewProvider'));
const script=text=>text.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script(html));new vm.Script(script(mockup));
const prefix=script(html).slice(0,script(html).indexOf('const productionToday='))+'globalThis.selected=bootBridge;})();';
// Every protocol and query goes through the auth boundary, regardless of parent.
for(const [protocol,search] of [['file:',''],['content:',''],['content:','?preview=1'],['about:',''],['http:',''],['https:','?preview=1'],['https:','']]){
 let calls=0;const elements=new Map();
 const c={URL,URLSearchParams,console,location:{protocol,search,hash:'',href:'https://example.test/'},
 document:{getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id);}},
 authStub:async()=>{calls++;return{isDemo:false};}};
 c.window=c;Object.defineProperty(c,'parent',{get(){throw Error('Operational page must not inspect its parent');}});
 vm.createContext(c);await vm.runInContext(prefix.replace('await createMimineAuthenticatedBridge()','await authStub()'),c);
 assert.equal(calls,1,protocol+search);assert.equal(c.selected.isDemo,false);
}
const mockPrefix=script(mockup).slice(0,script(mockup).indexOf('const productionToday='))+'globalThis.selected=bootBridge;})();';
{
 const elements=new Map(),c={URL,URLSearchParams,Date,Intl,structuredClone,location:{protocol:'content:',href:'content://media/external/file/123'},
 document:{getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id);}},
 fetch(){throw Error('Demo must not access the network');}};
 c.window=c;c.parent=c;vm.createContext(c);await vm.runInContext(mockPrefix,c);
 assert.equal(c.selected.isDemo,true);
 const before=await c.selected.snapshot();await c.selected.invoke('sale',{date:'2026-11-03',amount:200000});
 assert.notEqual(before.sales.find(s=>s.date==='2026-11-03').amount,200000);
 assert.equal((await c.selected.snapshot()).sales.find(s=>s.date==='2026-11-03').amount,200000);
}
if(!process.argv.includes('--preview-build')){
 await assert.rejects(access(new URL('../dist/mockup.html',import.meta.url)));
 await assert.rejects(access(new URL('../dist/preview/index.html',import.meta.url)));
}
console.log('Root entry: production always authenticates; URL/parent demo bypass removed; separate mockup and publish isolation passed.');

const authSource=await read('flow/auth.js');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function harness({protocol='https:',session={user:{id:'fixture'}},user={id:'fixture'},active=true,verifyError=null,profileError=null,profile=null}={}){
 const elements=new Map(),calls={session:0,user:0,profile:0,bridge:0,locked:0},events={};
 const node=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',disabled:false,elements:{email:{value:'fixture@example.test'},password:{value:'fixture'}},addEventListener(type,fn){events[id+':'+type]=fn;},replaceChildren(){calls.locked++;}});return elements.get(id);};
 const classes=new Set(['auth-loading']);
 const c={URL,URLSearchParams,setTimeout,location:{protocol,href:protocol==='https:'?'https://example.test/':'content://media/external/file/123',search:'',hash:'',replace(url){events.redirect=url;}},
 document:{getElementById:node,body:{classList:{add:n=>classes.add(n)}}},
 createMimineProductionBridge(){calls.bridge++;return{isDemo:false};}};
 const client={auth:{
 getSession:async()=>{calls.session++;return{data:{session}}},
 getUser:async()=>{calls.user++;return{data:{user},error:verifyError}},
 signInWithPassword:async()=>({data:{session},error:null}),
 onAuthStateChange(fn){events.auth=fn;}
 },from(){calls.profile++;return{select(){return this},eq(){return this},maybeSingle:async()=>profile?await profile():({data:{is_active:active},error:profileError})}}};
 c.window={supabase:{createClient:()=>{if(protocol!=='https:')throw Error('No SDK on a local document');return client;}}};
 vm.createContext(c);const promise=vm.runInContext(authSource+'\ncreateMimineAuthenticatedBridge()',c);
 return{c,calls,node,events,classes,promise};
}
for(const test of [
 {name:'approved',ok:true},
 {name:'no session',session:null,ok:false},
 {name:'inactive',active:false,ok:false},
 {name:'expired or forged session',verifyError:new Error('Session invalid'),ok:false},
 {name:'anonymous user',user:{id:'fixture',is_anonymous:true},ok:false},
 {name:'mismatched user',user:{id:'another-user'},ok:false},
 {name:'missing user',user:null,ok:false},
 {name:'profile failure',profileError:new Error('Profile failed'),ok:false}
]){
 const h=harness(test);await tick();assert.equal(h.calls.bridge,test.ok?1:0,test.name);
 if(!test.ok)assert.equal(h.node('auth-submit').disabled,false,test.name);
 if(test.name==='approved'){
  assert.equal((await h.promise).isDemo,false);h.events.auth('SIGNED_OUT',null);
  assert.equal(h.calls.locked,2);assert.ok(h.classes.has('auth-loading'));
  assert.equal(h.events.redirect,'https://example.test/index.html');
 }
}
for(const protocol of ['file:','content:','about:']){
 const h=harness({protocol});await tick();
 assert.equal(h.calls.session,0);assert.equal(h.calls.user,0);assert.equal(h.calls.bridge,0);
 assert.equal(h.node('auth-form').hidden,true);assert.equal(h.node('auth-online').hidden,false);
 assert.match(h.node('auth-message').textContent,/운영 사이트/);
}
{
 let finish;const h=harness({profile:()=>new Promise(r=>{finish=r;})});await tick();
 h.events.auth('SIGNED_OUT',null);finish({data:{is_active:true}});await tick();
 assert.equal(h.calls.bridge,0,'Signing out during verification must cancel opening');
}
{
 const h=harness();await tick();h.events.auth('SIGNED_IN',{user:{id:'other-user'}});
 assert.equal(h.calls.locked,2,'A changed user must not retain the previous screen');
}
console.log('Authentication: server-verified approved sessions only; missing/invalid/anonymous/inactive denied; file gate, sign-out and cancellation passed.');

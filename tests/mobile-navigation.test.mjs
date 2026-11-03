import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const listeners=new Map(),moves=[];let clock=1000,enabled=true;
const document={addEventListener:(name,fn)=>listeners.set(name,fn)};
const c={document,view:{page:'today'},modalName:'',productionBusy:false,Date:{now:()=>clock},window:{matchMedia:()=>({matches:enabled})},navigate:page=>{moves.push(page);c.view.page=page;}};
vm.createContext(c);vm.runInContext(await readFile(new URL('../flow/mobile-navigation.js',import.meta.url),'utf8'),c);
function target(kind='content'){
 const el={matches:()=>kind==='product'};
 el.closest=selector=>selector==='#main'?{}:selector==='button'?(kind==='product'||kind==='button'?el:null):kind==='input'?el:null;
 return el;
}
function event(x,y,{kind='content',count=1,end=false}={}){const t={clientX:x,clientY:y};return{target:target(kind),touches:end?[]:Array(count).fill(t),changedTouches:[t],cancelable:true,preventDefault(){this.prevented=true;}};}
function swipe(dx,dy=2,kind='content'){
 listeners.get('touchstart')(event(200,150,{kind}));clock+=100;
 listeners.get('touchmove')(event(200+dx,150+dy,{kind}));
 const end=event(200+dx,150+dy,{kind,end:true});listeners.get('touchend')(end);return end;
}
for(const page of ['ledger','reports','bank','products','today']){assert.equal(swipe(-100).prevented,true);assert.equal(c.view.page,page);}
swipe(100);assert.equal(c.view.page,'products');
const before=moves.length;
swipe(20);swipe(15,110);swipe(100,120);swipe(-100,0,'input');swipe(-100,0,'button');
c.modalName='entry';swipe(-100);c.modalName='';
c.productionBusy=true;swipe(-100);c.productionBusy=false;
enabled=false;swipe(-100);enabled=true;
listeners.get('touchstart')(event(200,150));listeners.get('touchmove')(event(100,150,{count:2}));listeners.get('touchend')(event(100,150,{end:true}));
listeners.get('touchstart')(event(200,150));listeners.get('touchcancel')();listeners.get('touchend')(event(100,150,{end:true}));
assert.equal(moves.length,before,'Vertical scrolling, controls, modals, saves, desktop and pinch must not change menus');
swipe(-100,0,'product');assert.equal(c.view.page,'today');
let prevented=false,stopped=false;
listeners.get('click')({target:target('product'),detail:1,preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
assert.ok(prevented&&stopped,'The release click must not open a product after navigating');
clock+=400;prevented=false;listeners.get('click')({target:target('product'),detail:1,preventDefault(){prevented=true;}});assert.equal(prevented,false);
console.log('Mobile swipe: tab order, wrap, vertical/control/pinch guards, modal/save guards and ghost-click protection passed.');

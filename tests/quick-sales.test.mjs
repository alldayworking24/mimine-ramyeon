import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [provider,app,analytics,interactions,mobile]=await Promise.all(['flow/preview-provider.js','flow/app.js','flow/analytics.js','flow/interactions.js','flow/mobile-navigation.js'].map(read));
const c={console,Date,Intl,Map,Set,URL,URLSearchParams,structuredClone,productionToday:'2026-11-03',location:{hash:'',href:'https://example.test/'},localStorage:{getItem:()=>null},window:{},document:{addEventListener(){}}};
vm.createContext(c);vm.runInContext(provider,c);c.productionSnapshot=await vm.runInContext('createMiminePreviewProvider().snapshot()',c);
vm.runInContext(app.slice(0,app.indexOf("document.addEventListener('click'")),c);
vm.runInContext(analytics.slice(0,analytics.indexOf('renderToday=()=>')),c);
vm.runInContext(interactions.slice(0,interactions.indexOf('const bankBeforeExclusion=')),c);
const run=s=>vm.runInContext(s,c);
run("view.date='2026-10-01';flow.start='2026-10-01';flow.end='2026-10-31'");
for(const name of ['renderLedger','flowChart','comparePanel','forecastPanel','dailyTable'])assert.match(run(name+'()'),/data-action="today-sale"/,name+' revenue must open today');
for(const name of ['renderLedger','flowChart','comparePanel'])assert.match(run(name+'()'),/data-action="today-expense"/,name+' costs must open today expense');
assert.doesNotMatch(run('renderProducts()'),/data-action="today-sale"/,'Product selling prices must remain product controls');
assert.doesNotMatch(run('renderBank()'),/class="deposit-total-grid"[\s\S]*data-action="today-sale"/,'Bank deposit totals must not become revenue');
assert.match(run('dailyTable()'),/data-action="open-day" data-date="2026-10-31"/,'Dated details remain available');
run('originalQuickEntry=openEntry');let opened;
c.openEntry=(...args)=>{opened=args;};run("action({dataset:{action:'today-sale'}})");assert.deepEqual(opened,['sale','','2026-11-03']);run("action({dataset:{action:'today-expense'}})");assert.deepEqual(opened,['expense','','2026-11-03']);assert.equal(run('view.date'),'2026-10-01','Opening today must not change the browsing filter');
c.openEntry=c.originalQuickEntry;
let amountFocused=false,amountSelected=false,body,footer;
const dateInput={addEventListener(){}};let vendorFocused=false;const vendorInput={focus(){vendorFocused=true;}};
const nodes={'.sheet':{classList:{add(){}}},'.sale-entry-primary':{after(){}},'#form-error':{},'#entry-amount':{setAttribute(){},addEventListener(){},focus(){amountFocused=true;},select(){amountSelected=true;}},'#entry-form':{querySelector:()=>dateInput},'#entry-form [name=vendor]':vendorInput};
c.document.querySelector=s=>nodes[s]??null;c.sheet=(title,b,f)=>{body=b;footer=f;};
run("openEntry('sale','','2026-11-03')");
assert.match(body,/value="2026-11-03"/);assert.match(body,/value="161,130"/);assert.equal((body.match(/type="submit"/g)||[]).length,1);assert.doesNotMatch(footer,/type="submit"/);assert.match(body,/sale-entry-amount-row[\s\S]*sale-inline-save/);assert.ok(amountFocused&&amountSelected);
// Exercise visible viewport resizing independently of a physical keyboard.
const d=vm.createContext({});vm.runInContext(mobile.slice(mobile.indexOf('function installMimineDialogViewport'),mobile.lastIndexOf('installMimineDialogViewport({win:window')),d);
const listeners=new Map(),frames=[],props=new Map(),viewport={height:780,offsetTop:0,scale:1,addEventListener:(n,fn)=>listeners.set(n,fn)};
const win={visualViewport:viewport,requestAnimationFrame:fn=>frames.push(fn),addEventListener:(n,fn)=>listeners.set(n,fn)},doc={documentElement:{style:{setProperty:(n,v)=>props.set(n,v)}},addEventListener:(n,fn)=>listeners.set(n,fn)};
const flush=()=>{while(frames.length)frames.shift()();};d.installMimineDialogViewport({win,doc});flush();assert.equal(props.get('--dialog-visible-height'),'780px');
viewport.height=410;viewport.offsetTop=26;listeners.get('resize')();flush();assert.equal(props.get('--dialog-visible-height'),'410px');assert.equal(props.get('--dialog-visible-top'),'26px');
viewport.height=780;viewport.offsetTop=0;listeners.get('resize')();flush();assert.equal(props.get('--dialog-visible-height'),'780px');
viewport.scale=2;viewport.height=250;listeners.get('resize')();flush();assert.equal(props.get('--dialog-visible-height'),'780px','Do not force dialog resizing while pinch zooming');
d.installMimineDialogViewport({win:{},doc:{}});
console.log('Quick sales: revenue shortcuts, today independent of filters, dated detail/product guards, one adjacent submit, existing amount, focus and keyboard viewport changes passed.');

// Tap-to-replace keeps the old value until typing and does not reselect digits
// typed before a queued browser-selection correction runs.
{
 const handlers=new Map(),frames=[];
 const input={value:'161,130',selectionStart:7,selectionEnd:7,isConnected:true,ownerDocument:{},addEventListener:(n,fn)=>handlers.set(n,fn),select(){this.selectionStart=0;this.selectionEnd=this.value.length;}};
 input.ownerDocument.activeElement=input;
 c.installSaleAmountReplacement(input,fn=>frames.push(fn));
 const flush=()=>{while(frames.length)frames.shift()();};
 const type=key=>{const start=input.selectionStart;input.value=input.value.slice(0,start)+key+input.value.slice(input.selectionEnd);input.selectionStart=input.selectionEnd=start+key.length;handlers.get('input')();};
 handlers.get('focus')();assert.equal(input.value,'161,130');assert.deepEqual([input.selectionStart,input.selectionEnd],[0,7]);flush();
 // Re-tapping an already focused input must select the entire amount again.
 input.selectionStart=input.selectionEnd=4;handlers.get('click')();
 input.selectionStart=input.selectionEnd=3;flush();assert.deepEqual([input.selectionStart,input.selectionEnd],[0,7]);
 handlers.get('click')();type('1');flush();type('9');type('8');type('0');type('0');type('0');assert.equal(input.value,'198000');
 handlers.get('click')();type('7');flush();type('5');type('0');type('0');type('0');assert.equal(input.value,'75000');
 handlers.get('click')();input.ownerDocument.activeElement=null;input.selectionStart=input.selectionEnd=2;flush();assert.deepEqual([input.selectionStart,input.selectionEnd],[2,2]);
 input.ownerDocument.activeElement=input;handlers.get('click')();input.isConnected=false;input.selectionStart=input.selectionEnd=1;flush();assert.deepEqual([input.selectionStart,input.selectionEnd],[1,1]);
 console.log('Sales replacement: focus/re-tap selects all, original value retained, immediate multi-digit replacement and blur/close guards passed.');
}

amountFocused=false;amountSelected=false;run("openEntry('expense','','2026-11-03')");
assert.ok(body.indexOf('name="category"')<body.indexOf('name="vendor"')&&body.indexOf('name="vendor"')<body.indexOf('id="entry-amount"'),'Expense category and description precede amount');
assert.match(body,/value="카드 대금"/);assert.equal((body.match(/type="submit"/g)||[]).length,1);assert.doesNotMatch(footer,/type="submit"/);assert.ok(vendorFocused&&!amountFocused,'New expense begins with required description');
run("openEntry('expense','1','2026-11-03')");assert.match(body,/value="32,400"/);assert.ok(amountFocused&&amountSelected,'Existing expense amount supports direct replacement');
console.log('Expense entry: category/description/amount order, card-payment choice, adjacent single save, description-first new entry and editing replacement passed.');

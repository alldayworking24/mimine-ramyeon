import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const runtime=await readFile(new URL('../flow/production-runtime.js',import.meta.url),'utf8');
const source=runtime.slice(runtime.indexOf('function hydrateSalePayment'),runtime.indexOf('const productionProductForm'));
function setup(){
 let resolve,reject,calls=0,writes=0,payload,error='';
 const fields=Object.fromEntries(Object.entries({date:'2026-11-18','entry-amount':'8800',card:'8800',cash:'0',other:'0',fee:'0',due:'',note:''}).map(([k,value])=>[k,{value,disabled:false}]));
 const status={textContent:'',appendChild(){}},err={textContent:''};
 const form={elements:{namedItem:n=>fields[n]},querySelectorAll:()=>['card','cash','other','fee','due'].map(n=>fields[n]),querySelector:s=>s==='#form-error'?err:status};
 const context={entryType:'sale',split:true};
 const c={TODAY:'2026-11-18',modalContext:context,modalName:'entry',db:{sales:[{id:'s1',date:'2026-11-18',amount:7000}],connection:{bankReady:false}},view:{},
 document:{createElement:()=>({dataset:{}})},productionBridge:{isDemo:false,saleSettlement:()=>{calls++;return new Promise((a,b)=>{resolve=a;reject=b;});}},
 saleOn:()=>c.db.sales[0],fmt:n=>String(n),num:v=>Number(v)||0,linked:()=>0,
 syncSalePaymentCalculation:f=>fields.card.value=String(Number(fields['entry-amount'].value)-Number(fields.cash.value)-Number(fields.other.value)),showError:s=>error=s,
 FormData:class{get(n){return fields[n]?.value||'';}},productionWrite:async(_cmd,p)=>{writes++;payload=p;return true;}};
 vm.createContext(c);vm.runInContext(source,c);
 return{c,form,context,fields,get calls(){return calls;},get writes(){return writes;},get payload(){return payload;},get error(){return error;},resolve:x=>resolve(x),reject:()=>reject(Error('network timeout'))};
}
const response={settlements:[{sale_date:'2026-11-18',card_amount:6000,cash_amount:1000,other_amount:0,fee_amount:100,due_date:'2026-11-20'}]};
{
 const s=setup();s.c.hydrateSalePayment(s.form,s.context);const save=s.c.saveEntry(s.form);await s.c.saveEntry(s.form);assert.equal(s.writes,0);s.resolve(response);assert.equal(await save,true);assert.equal(s.writes,1);assert.equal(s.payload.amount,8800);assert.equal(s.payload.settlement.cash,1000);assert.equal(s.payload.settlement.card,7800);assert.equal(s.payload.settlement.fee,100);
}
{
 const s=setup();s.c.hydrateSalePayment(s.form,s.context);s.reject();await s.context.paymentPromise;const save=s.c.saveEntry(s.form);await Promise.resolve();assert.equal(s.calls,2);s.resolve(response);await save;assert.equal(s.writes,1);
}
{
 const s=setup();s.c.hydrateSalePayment(s.form,s.context);s.reject();await s.context.paymentPromise;const save=s.c.saveEntry(s.form);await Promise.resolve();s.reject();await save;assert.equal(s.writes,0);assert.match(s.error,/아직 저장하지/);assert.equal(s.fields['entry-amount'].value,'8800');
 s.c.hydrateSalePayment(s.form,s.context);s.resolve(response);await s.context.paymentPromise;await s.c.saveEntry(s.form);assert.equal(s.writes,1);
}
{
 const s=setup();s.c.hydrateSalePayment(s.form,s.context);const save=s.c.saveEntry(s.form);s.c.modalContext={};s.c.modalName='';s.resolve(response);await save;assert.equal(s.writes,0);
}
console.log('Sale readiness: save waits for metadata; latest cash/fee retained; single save under double tap; retry/recovery and closed-modal guards passed.');

// Expense preregistration must reach the write bridge for both create and edit.
for(const id of ['', 'e1']){
 const s=setup();s.context.entryType='expense';s.context.id=id;s.context.requestId='future-request';
 s.fields.date.value='2026-11-25';
 s.fields.vendor={value:'KB국민카드'};s.fields.category={value:'카드 대금'};
 s.c.paymentComposeNote=(note)=>note;s.c.expenseComposeNote=(note)=>note;
 await s.c.saveEntry(s.form);
 assert.equal(s.writes,1);assert.equal(s.payload.date,'2026-11-25');assert.equal(s.payload.id,id);assert.equal(s.payload.amount,8800);
}
{
 const s=setup();s.fields.date.value='2026-11-25';await s.c.saveEntry(s.form);
 assert.equal(s.writes,0);assert.match(s.error,/매출은 오늘까지/);
}
console.log('Future expense create/edit allowed; future sales remain blocked.');

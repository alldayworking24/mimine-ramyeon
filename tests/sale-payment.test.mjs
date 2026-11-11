import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../flow/app.js',import.meta.url),'utf8');
const runtime=await readFile(new URL('../flow/production-runtime.js',import.meta.url),'utf8');
const c={num:v=>Number(String(v).replaceAll(',',''))||0,fmt:n=>n.toLocaleString('en-US')};
vm.createContext(c);vm.runInContext(app.slice(app.indexOf('function syncSalePaymentCalculation'),app.indexOf('function saveEntry(form)')),c);
let message='';const note={textContent:''};const fields=Object.fromEntries(['entry-amount','card','cash','other'].map(n=>[n,{value:'0',setCustomValidity:m=>message=m}]));const form={elements:{namedItem:n=>fields[n]},querySelector:()=>note};
const calc=(total,cash,other)=>{fields['entry-amount'].value=String(total);fields.cash.value=String(cash);fields.other.value=String(other);c.syncSalePaymentCalculation(form);return fields.card.value;};
assert.equal(calc(24700,2000,0),'22,700');assert.equal(calc(24700,2000,700),'22,000');assert.equal(calc(24700,24700,0),'0');assert.equal(calc(0,0,0),'0');assert.equal(calc(24700,25000,0),'0');assert.match(message,/총매출보다/);assert.match(note.textContent,/총매출보다/);assert.equal(calc(30000,25000,0),'5,000');assert.equal(message,'');
const a=app.slice(app.indexOf(' const saleBody='),app.indexOf(' const entryCategory='));assert.ok(a.indexOf('sale-payment-panel')<a.indexOf('money-steps'));assert.doesNotMatch(a,/split-fields hidden|toggle-split/);
// Slow responses must not write into another date/dialog, and saving is blocked while unknown.
let resolve;const paymentFields=[{disabled:false}],inputs={date:{value:'2026-11-11'},cash:{value:'0'},other:{value:'0'},fee:{value:'0'},due:{value:''}};const ctx={};
Object.assign(c,{modalContext:ctx,modalName:'entry',saleOn:()=>({id:'s1'}),db:{sales:[{id:'s1',date:'2026-11-11',amount:24700}],connection:{bankReady:false}},productionBridge:{isDemo:false,saleSettlement:()=>new Promise(r=>resolve=r)},syncSalePaymentCalculation:()=>{},});
vm.runInContext(runtime.slice(runtime.indexOf('async function hydrateSalePayment'),runtime.indexOf('saveEntry=async function')),c);
const payForm={elements:{namedItem:n=>inputs[n]},querySelectorAll:()=>paymentFields,querySelector:()=>note};
const pending=c.hydrateSalePayment(payForm,ctx);assert.equal(ctx.paymentReady,false);assert.equal(paymentFields[0].disabled,true);resolve({settlements:[{sale_date:'2026-11-11',cash_amount:2000,other_amount:0,fee_amount:100,due_date:'2026-11-13'}]});await pending;assert.equal(inputs.cash.value,'2,000');assert.equal(ctx.paymentReady,true);assert.equal(paymentFields[0].disabled,false);
const late=c.hydrateSalePayment(payForm,ctx);c.modalContext={};resolve({settlements:[{sale_date:'2026-11-11',cash_amount:9999}]});await late;assert.equal(inputs.cash.value,'2,000');
console.log('Sale payment: cash/other/total changes, exact totals, over-total validity and recovery, visible panel ordering, existing settlement hydration and stale dialog guard passed.');

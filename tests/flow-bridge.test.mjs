import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const tables={
 sales:[{id:5,sale_date:'2026-11-03',amount:100000,memo:'매출'}],
 expenses:[{id:9,expense_date:'2026-11-03',amount:5000,category:'소모품',vendor:'구매처',memo:'메모'}],
 products:[{id:7,name:'상품',category:'기타',category_id:2,sku:'12345',sale_price:4200,purchase_price:810,low_stock_threshold:5}],
 product_categories:[{id:2,name:'라면'}],
 product_purchase_batches:[{id:10,product_id:7,purchase_date:'2026-11-03',remaining_quantity:3,quantity:5,unit_cost:810,sale_price:4000,expiration_date:'2027-01-01'}],
 mimine_stock_documents:[]
};
const calls=[];let bankFailure=false;
function query(table){const q={select(){return q},order(){return q},range(){return q},abortSignal(){return q},eq(){return q},upsert(data){calls.push({table,data});return q},delete(){calls.push({delete:table});return q},then(resolve){return Promise.resolve({data:tables[table]||[],error:null}).then(resolve)}};return q;}
const appView={classList:{contains:()=>true}};
const context={console,Intl,Date,Map,Number,JSON,String,Promise,AbortSignal,URLSearchParams,localStorage:{getItem:()=>null},location:{hash:''},window:{},document:{getElementById:id=>id==='appView'?appView:null,body:{classList:{remove(){}}},head:{append(){}},createElement:()=>({})},MutationObserver:class{observe(){}},db:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}}),onAuthStateChange(){}},from:query,rpc:async(name,args)=>{calls.push({name,args});return{data:{ok:true},error:null}}},bankApi:async payload=>{
 if(bankFailure)throw new Error('은행 서버 오류');
 if(payload.action!=='list')return{ok:true};
 return{settlements:[{sale_date:'2026-11-03',card_amount:90000,cash_amount:10000,other_amount:0,fee_amount:1800,due_date:'2026-11-05'}],events:[{id:'event1',payer:'정산',amount:88200,occurred_at:'2026-11-03T01:00Z',customer_id:null}],classifications:[{event_id:'event1',business:'mimine',classification_source:'alias',excluded:false}],aliases:[{id:'alias1',payer:'정산',business:'mimine',active:true}],allocations:[]};
},logout(){},openPanel(){},openBank(){}};
vm.createContext(context);vm.runInContext(await readFile(new URL('../flow/data-client.js',import.meta.url),'utf8'),context);
const bridge=vm.runInContext('createMimineProductionBridge(db,{bankRequest:bankApi})',context),snapshot=await bridge.snapshot();
assert.equal(snapshot.sales[0].amount,100000);assert.equal(snapshot.sales[0].card,90000);assert.equal(snapshot.sales[0].settlementKnown,true);
assert.equal(snapshot.expenses[0].vendor,'구매처');assert.equal(snapshot.expenses[0].note,'메모');
assert.equal(snapshot.products[0].category,'라면');assert.equal(snapshot.products[0].lastSalePrice,4200);assert.equal(snapshot.products[0].batches[0].qty,3);
assert.equal(snapshot.events[0].date,'2026-11-03');assert.equal(snapshot.events[0].time,'10:00');assert.equal(snapshot.events[0].autoRegistered,true);
await bridge.invoke('stock',{requestId:'request',document:{type:'inbound',items:[]}});assert.equal(calls.at(-1).name,'mimine_receive_stock');
await bridge.invoke('expense',{requestId:'request2',date:'2026-11-03',amount:1000,vendor:'테스트'});assert.equal(calls.at(-1).name,'mimine_save_expense');
bankFailure=true;
const result=await bridge.invoke('sale',{date:'2026-11-03',amount:200000,note:'수정',settlement:{card:190000,cash:10000,other:0,fee:2000}});
assert.match(result.warning,/매출은 저장/);assert.equal(calls.at(-1).table,'sales');assert.equal(calls.at(-1).data.amount,200000);
const missingBank=await bridge.snapshot();assert.match(missingBank.connection.bankError,/은행 서버 오류/);
console.log('Production bridge: real-schema mapping, KST, last sale price, RPC routing, bank failures and partial-sale warning passed.');

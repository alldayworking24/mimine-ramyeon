import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../flow/production-runtime.js',import.meta.url),'utf8');
const prefix=source.slice(0,source.indexOf('const productionRender='));
function setup(){
 let releaseRead,reads=0;
 const pending=new Promise(resolve=>releaseRead=resolve);
 const rendered=[];
 const c={window:{MimineBridge:{snapshot:()=>++reads===1?pending:Promise.resolve({sales:[{amount:200000}]}),invoke:async()=>({})}},
  db:{sales:[]},modalName:'',localStorage:{setItem(){}},render(){rendered.push(c.db);},toast(){},closeModal(){c.modalName='';},
  $$:()=>[],$:()=>null,showError(){},sheet(){},crypto:{}};
 vm.createContext(c);vm.runInContext(prefix,c);
 return{c,rendered,releaseRead};
}
{
 const{c,rendered,releaseRead}=setup();
 const read=vm.runInContext('refreshProduction(true)',c);
 assert.equal(vm.runInContext('productionBusy',c),false,'Background reads must leave menu and form actions available');
 c.modalName='entry';
 releaseRead({sales:[{amount:100000}]});await read;
 assert.equal(rendered.length,0,'A delayed refresh must not replace data while the user edits');
}
{
 const{c,rendered,releaseRead}=setup();
 const read=vm.runInContext('refreshProduction(true)',c);
 await vm.runInContext("productionWrite('sale',{},'saved')",c);
 assert.equal(c.db.sales[0].amount,200000);
 releaseRead({sales:[{amount:100000}]});await read;
 assert.equal(c.db.sales[0].amount,200000,'A pre-save response must not replace the saved result');
 assert.equal(rendered.length,1);
}
console.log('Background refresh: menu availability, edit protection and stale-response protection passed.');

// A confirmed row is enough to repaint the sale; no unrelated reads after save.
{
 let snapshots=0;
 const c={window:{MimineBridge:{snapshot:async()=>{snapshots++;throw Error('unexpected snapshot');},invoke:async()=>({sale:{date:'2026-11-03',id:'s-2026-11-03',remoteId:'5',amount:162000,note:'수정'}})}},
 db:{sales:[{date:'2026-11-03',amount:161130}],expenses:[{id:'e1'}]},modalName:'entry',render(){},toast(){},closeModal(){c.modalName='';},$$:()=>[],$:()=>null};
 vm.createContext(c);vm.runInContext(prefix,c);
 assert.equal(await vm.runInContext("productionWrite('sale',{},'saved')",c),true);
 assert.equal(c.db.sales[0].amount,162000);assert.equal(c.db.expenses[0].id,'e1');assert.equal(snapshots,0);assert.equal(c.modalName,'');
}
console.log('Confirmed sale save patches one row with zero snapshot reloads.');

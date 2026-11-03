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

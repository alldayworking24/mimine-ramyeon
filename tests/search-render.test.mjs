import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../flow/app.js',import.meta.url),'utf8');
let callback,rendered=0,focused=0;const c={view:{page:'ledger'},clearTimeout:()=>callback=null,setTimeout:fn=>callback=fn,render:()=>rendered++,$:()=>({focus:()=>focused++,setSelectionRange(){}})};
vm.createContext(c);vm.runInContext(app.slice(app.indexOf('let searchRenderTimer;'),app.indexOf("document.addEventListener('compositionend'")),c);
const input={dataset:{search:'ledger'},value:'임',selectionStart:1,isConnected:true};c.scheduleSearchRender(input);input.value='임대료';c.scheduleSearchRender(input);assert.equal(rendered,0);callback();assert.equal(rendered,1);assert.equal(c.view.query,'임대료');assert.equal(focused,1);
c.scheduleSearchRender(input);c.view.page='products';callback();assert.equal(rendered,1,'Pending search does not redraw another page');c.view.page='ledger';c.scheduleSearchRender(input);input.isConnected=false;callback();assert.equal(rendered,1,'Detached fields do not steal focus');input.isComposing=true;c.scheduleSearchRender(input);assert.equal(callback,null,'IME composition does not rebuild the input');
console.log('Search: rapid input coalesced; final text preserved; navigation, detached-input and IME guards passed.');

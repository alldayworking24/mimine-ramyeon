import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../flow/stock-receipts.js',import.meta.url),'utf8');
const scanner=source.slice(source.indexOf('function openBarcodeScanner'),source.indexOf('\nfunction receiptFingerprint'));
// Keep extraction limited to scanner functions, independent from OCR runtime.
const end=scanner.indexOf('\nfunction ' ,scanner.indexOf('async function decodeBarcodePhoto'));
const scannerOnly=end<0?scanner:scanner.slice(0,end);
let callback,resolveControls,stops=0,reads=0,opened=[],draftFields={name:{value:''},price:{value:''}},status={textContent:''};
const c={console,modalName:'',supply:{scanEpoch:0,scanDraft:null},db:{products:[{id:'p1',barcode:'8801000000001',name:'기존 라면'}]},navigator:{mediaDevices:{getUserMedia(){}}},
 $:s=>s==='#barcode-status'?status:s==='#supply-product-form'?{elements:{namedItem:n=>draftFields[n]}}:{},icon:()=>'',sheet:(_a,_b,_c,o)=>{c.modalName=o.name;},toast(){},loadBrowserScript:async()=>{},
 openProduct:id=>{opened.push(['detail',id]);c.modalName='product';},openProductForm:(id,code)=>{opened.push(['new',code]);c.modalName='supply-product';},
 ZXingBrowser:{BrowserMultiFormatReader:class{decodeFromConstraints(_constraints,_video,cb){reads++;callback=cb;return new Promise(r=>resolveControls=r);}async decodeFromImageUrl(){return{getText:()=> '8801000000002'};}}}};
c.stopBarcodeCamera=()=>{c.supply.scanEpoch++;c.supply.scanControls?.stop();c.supply.scanControls=null;};
vm.createContext(c);vm.runInContext(scannerOnly,c);
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
c.openBarcodeScanner();await flush();assert.equal(reads,1,'Scanner opens camera without a second tap');
callback({getText:()=> '8801000000001'});assert.deepEqual(opened,[['detail','p1']]);
callback({getText:()=> '8801000000001'});assert.equal(opened.length,1,'Repeated decoded frame does not open another dialog');
resolveControls({stop:()=>stops++});await flush();assert.equal(stops,1,'Stream resolving after result is stopped');
c.openBarcodeScanner({name:'작성중 라면',price:'3,000',barcode:'old'});await flush();callback({getText:()=> '8801000000002'});assert.deepEqual(opened.at(-1),['new','8801000000002']);assert.equal(draftFields.name.value,'작성중 라면');assert.equal(draftFields.price.value,'3,000');resolveControls({stop:()=>stops++});await flush();
c.openBarcodeScanner();await flush();const stale=callback;c.stopBarcodeCamera();c.modalName='';stale({getText:()=> '8801000000001'});assert.equal(opened.length,2);resolveControls({stop:()=>stops++});await flush();
c.openBarcodeScanner();await flush();await c.decodeBarcodePhoto('data:image/png;base64,test');assert.deepEqual(opened.at(-1),['new','8801000000002']);resolveControls({stop:()=>stops++});await flush();
c.navigator.mediaDevices=null;c.openBarcodeScanner();await flush();assert.match(status.textContent,/写真|사진/);
console.log('Barcode: auto camera, existing detail, prefilled new product, draft retention, duplicate/stale frame guards, late stream cleanup, photo decode and unsupported camera passed.');

import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../flow/app.js',import.meta.url),'utf8'),source=await readFile(new URL('../flow/button-icons.js',import.meta.url),'utf8');
const c=vm.createContext({});vm.runInContext(app.slice(app.indexOf('const iconPaths='),app.indexOf('function seed')),c);
vm.runInContext(source.slice(0,source.indexOf('const renderBeforeActionIcons=')),c);
const spec=args=>vm.runInContext('buttonIconSpec('+JSON.stringify(args)+')',c);
for(const[action,icon]of [['export','download'],['barcode-open','barcode'],['receipt-open','receipt'],['barcode-camera','camera'],['product-new','packagePlus'],['production-logout','logout'],['exclude-deposit','ban'],['product-edit','edit']])assert.equal(spec({action,text:action}).icon,icon);
for(const[formId,icon,label]of [['entry-form','save','저장'],['barcode-lookup-form','search','상품 찾기'],['receipt-paste-form','list','품목 나누기'],['match-form','link','입금 연결'],['receipt-review-form','packagePlus','확인 후 입고'],['exclude-deposit-form','ban','대상 제외']]){const s=spec({formId,type:'submit'});assert.equal(s.icon,icon);assert.equal(s.label,label);}
assert.equal(spec({action:'toggle-payer-rule',text:'사용 중지'}).icon,'pause');assert.equal(spec({action:'toggle-payer-rule',text:'다시 사용'}).icon,'play');
assert.equal(spec({action:'day-edit-sale',text:'매출 등록'}).label,'매출 등록');assert.equal(spec({action:'day-edit-sale',text:'매출 수정'}).label,'매출 수정');
assert.equal(spec({action:'flow-period',value:'week',text:'최근 7일'}).label,'최근 7일');assert.equal(spec({action:'product-filter',value:'expiry',text:'유통기한 임박 3'}).icon,'clock');
assert.equal(spec({action:'today-sale',text:'198,000원'}),null,'Revenue values must not be replaced by an icon');
assert.equal(spec({action:'product-detail',text:'신라면'}),null,'Product image cards retain their product identity');
assert.equal(vm.runInContext('Object.values(ACTION_ICON_SPECS).every(s=>!!iconPaths[s[0]])&&Object.values(FORM_ICON_SPECS).every(s=>!!iconPaths[s[0]])',c),true,'No action may silently fall back to an unrelated info icon');
console.log('Action icons: save/search/import/exclude meanings, stateful controls, full period names and numeric/product identity passed.');

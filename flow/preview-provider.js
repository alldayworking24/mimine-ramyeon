/* No network or production writes. Used only by explicit preview mode. */
function createMiminePreviewProvider(options={}){
/* Explicit demo provider; no production requests. */
const today='2026-11-03',plus=(date,n)=>new Date(Date.parse(date+'T12:00Z')+n*86400000).toISOString().slice(0,10);
let fixture={version:1,analyticsHistory:2,supplyHistory:1,goal:3000000,settings:{autoMatch:true,largeType:false},sales:[],expenses:[],products:[],events:[],links:[],receipts:[],payerRules:[{id:'rule1',payer:'키움페이',business:'mimine',label:'카드 정산',active:true}],connection:{refreshedAt:new Date().toISOString(),bankError:'',stockError:'',truncated:false}};
for(let d='2026-10-01';d<=today;d=plus(d,1)){const amount=150000+(Number(d.slice(8))*3710)%80000;fixture.sales.push({id:'s-'+d,remoteId:d,date:d,amount,card:amount-10000,cash:10000,other:0,fee:2000,due:plus(d,2),settlementKnown:true,settlementConsistent:true,note:'가상 일매출',source:'가상 데이터'});fixture.sales.push({id:'s-'+d.replace('2026','2025'),date:d.replace('2026','2025'),amount:amount-20000,card:amount-30000,cash:10000,other:0,fee:1800,due:'',settlementKnown:true,note:'작년 가상 매출'});}
const priorDates=new Set(fixture.sales.map(s=>s.date));
for(let d='2025-01-01';d<='2025-12-31';d=plus(d,1)){if(priorDates.has(d))continue;const amount=130000+(Number(d.slice(8))*3710)%80000;fixture.sales.push({id:'s-'+d,date:d,amount,card:amount-10000,cash:10000,other:0,fee:1800,due:'',settlementKnown:true,note:'작년 가상 매출'});}
fixture.expenses=[{id:'1',date:today,amount:32400,category:'상품매입',vendor:'가상 식자재',note:''},{id:'2',date:'2026-11-01',amount:500000,category:'임대료',vendor:'매장 임대료',note:''}];
// Complete sample history makes full-year reports useful; operational data is untouched.
for(let d='2026-01-01';d<'2026-10-01';d=plus(d,1)){const amount=135000+(Number(d.slice(5,7))*6900+Number(d.slice(8))*2710)%70000;fixture.sales.push({id:'s-'+d,date:d,amount,card:amount-10000,cash:10000,other:0,fee:1800,due:plus(d,2),settlementKnown:true,settlementConsistent:true,note:'가상 일매출',source:'가상 데이터'});}
for(const year of [2025,2026])for(let month=1;month<=12;month++){if(year===2026&&month===11)continue;const date=year+'-'+String(month).padStart(2,'0')+'-01';if(date>today)continue;fixture.expenses.push({id:'sample-rent-'+date,date,amount:500000,category:'임대료',vendor:'가상 임대료',note:'가상 데이터'},{id:'sample-stock-'+date,date,amount:310000+month*7500+(year===2026?24000:0),category:'상품매입',vendor:'가상 식자재',note:'가상 데이터'});}
fixture.products=[{id:'1',name:'신라면',category:'라면',barcode:'2000000000015',cost:810,price:4000,lastSalePrice:4000,min:10,color:'#b65540',bg:'#f6e8e2',supplier:'',priceHistory:[],batches:[{id:'b1',qty:8,originalQty:8,date:'2026-10-10',expiry:'2027-02-01'}]},{id:'2',name:'진라면 매운맛',category:'라면',barcode:'2000000000022',cost:720,price:3500,lastSalePrice:3500,min:10,color:'#b09039',bg:'#f5efda',supplier:'',priceHistory:[],batches:[{id:'b2',qty:32,originalQty:32,date:'2026-10-20',expiry:'2027-03-01'}]},{id:'3',name:'생수 500ml',category:'음료',barcode:'2000000000039',cost:250,price:1000,lastSalePrice:1000,min:10,color:'#4b8095',bg:'#e8f0f3',supplier:'',priceHistory:[],batches:[{id:'b3',qty:42,originalQty:42,date:'2026-10-20',expiry:'2027-10-01'}]}];
for(const[id,date,payer,amount,business]of[['bank1',today,'키움페이',125000,'mimine'],['bank2',today,'우리관리',350000,'unclassified'],['bank3','2026-10-10','키움페이',215000,'mimine'],['bank4','2026-10-25','키움페이',195000,'mimine'],['bank5','2026-10-31','키움페이',174000,'mimine']])fixture.events.push({id,date,time:'12:30',payer,amount,business,autoRegistered:business==='mimine',excluded:false});
let sequence=10,failNext=false,requests=new Set();
const log=text=>options.onLog?.(text);
const provider={isDemo:true,today:()=>today,launch:'',snapshot:async()=>structuredClone(fixture),legacy:()=>log('기존 관리 화면으로 이동하는 경로입니다. 운영판에서는 기존 관리 기능을 엽니다.'),logout:()=>log('로컬 가상 화면에서는 로그아웃하지 않습니다.'),invoke:async(command,p)=>{
 log('저장 경로: '+command+' · '+new Date().toLocaleTimeString());if(failNext){failNext=false;throw new Error('저장 실패 체험입니다. 입력값을 유지했습니다. 다시 저장해 주세요.');}
 let next=structuredClone(fixture);
 if(command==='delete'){next[p.type==='sale'?'sales':'expenses']=next[p.type==='sale'?'sales':'expenses'].filter(r=>r.id!==p.id&&r.remoteId!==p.id);}
 else if(command==='stocktake'){const product=next.products.find(x=>x.id===p.productId);if(product){let remaining=p.qty;for(const b of product.batches){b.qty=Math.min(b.originalQty??b.qty,remaining);remaining-=b.qty;}if(remaining>0)throw new Error('입고 수량을 초과할 수 없습니다.');}}
 else if(command==='sale'){const old=next.sales.find(s=>s.date===p.date),r={...old,id:'s-'+p.date,date:p.date,amount:p.amount,note:p.note};if(p.settlement)Object.assign(r,p.settlement,{due:p.settlement.dueDate,settlementKnown:true});if(old)Object.assign(old,r);else next.sales.push(r);}
 else if(command==='expense'){if(requests.has(p.requestId))return{duplicate:true};const old=next.expenses.find(e=>e.id===p.id);if(old)Object.assign(old,p);else next.expenses.push({...p,id:String(++sequence)});requests.add(p.requestId);}
 else if(command==='stock'){
  const d=p.document;if(requests.has(p.requestId)||d.fingerprint&&next.receipts.some(r=>r.imageFingerprint===d.fingerprint))return{duplicate:true};
  let subtotal=0;const saved=[];
  for(const i of d.items){let product=next.products.find(x=>x.id===i.productId);if(!product){product={id:String(++sequence),name:i.name,barcode:i.barcode||'',category:i.category||'기타',min:i.min||10,color:'#658365',bg:'#edf3e9',priceHistory:[],batches:[]};next.products.push(product);}if(d.type==='product')Object.assign(product,{name:i.name,barcode:i.barcode||'',category:i.category,min:i.min});Object.assign(product,{cost:i.cost,price:i.price,lastSalePrice:i.price,supplier:d.supplier});if(i.qty)product.batches.push({id:'b'+(++sequence),qty:i.qty,originalQty:i.qty,cost:i.cost,expiry:i.expiry,date:d.date});subtotal+=i.qty*i.cost;saved.push({...i,name:product.name,productId:product.id,unitCost:i.cost,salePrice:i.price});}
  const total=d.total??subtotal;let expenseId='';if(d.addExpense){expenseId=String(++sequence);next.expenses.push({id:expenseId,date:d.date,amount:total,category:'상품매입',vendor:d.supplier||'영수증 상품 입고',note:'한 번 등록'});}if(d.type==='receipt')next.receipts.push({id:p.requestId,date:d.date,supplier:d.supplier,total,itemSubtotal:subtotal,items:saved,imageData:d.imageData,rawText:d.rawText,imageFingerprint:d.fingerprint,expenseId});requests.add(p.requestId);
 }
 else if(command==='bank'){
  if(p.action==='alias'){if(p.active&&next.payerRules.some(r=>r.id!==p.id&&r.active&&r.payer.replace(/\s/g,'')===p.payer.replace(/\s/g,'')))throw new Error('이미 등록한 입금자명입니다.');const r=next.payerRules.find(r=>r.id===p.id);if(r)Object.assign(r,p);else next.payerRules.push({...p,id:'rule'+(++sequence)});}
  if(p.action==='exclude'){const e=next.events.find(e=>e.id===p.eventId);Object.assign(e,{excluded:p.excluded,excludeReason:p.reason||'',excludeMemo:p.memo||''});if(p.excluded)next.links=next.links.filter(l=>l.eventId!==e.id);}
  if(p.action==='classify'){const e=next.events.find(e=>e.id===p.eventId);e.business=p.business;e.classificationSource='manual';e.autoRegistered=false;}
 }
 fixture=next;return{ok:true};
}};

provider.failNextSave=()=>{failNext=true;};
provider.receiveSample=()=>{const rule=fixture.payerRules.find(r=>r.active&&r.business==='mimine');fixture.events.unshift({id:'incoming'+(++sequence),date:today,time:'13:00',payer:rule?.payer||'새 입금자',amount:50000,business:rule?'mimine':'unclassified',autoRegistered:!!rule,excluded:false});log('가상 입금 50,000원을 수신했습니다.');};
return provider;
}

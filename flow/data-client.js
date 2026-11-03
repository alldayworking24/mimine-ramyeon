/* Main-page server provider; uses the existing Mimine session and schema. */
function createMimineProductionBridge(db,{bankRequest}={}){
 const launch=new URLSearchParams(location.hash.slice(1)).get('allbase')||'';
 let refreshing=null;
 const kst=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
 const check=async()=>{const{data,error}=await db.auth.getSession();if(error)throw error;if(!data?.session)throw new Error('로그인이 필요합니다.');return data.session;};
 async function rows(table,order='id'){
  const all=[];
  for(let offset=0;offset<100000;offset+=1000){
   let query=db.from(table).select('*').order(order,{ascending:false});if(order!=='id')query=query.order('id',{ascending:false});const{data,error}=await query.range(offset,offset+999).abortSignal(AbortSignal.timeout(25000));
   if(error)throw new Error(table+' 조회: '+error.message);all.push(...data);
   if(data.length<1000)return all;
  }
  throw new Error('조회 한도를 초과했습니다. 기간을 줄여 주세요.');
 }
 async function snapshot(){
  await check();
  const today=kst(),start=(Number(today.slice(0,4))-4)+'-01-01';
  const results=await Promise.all([
   rows('sales','sale_date'),rows('expenses','expense_date'),rows('products'),rows('product_categories'),rows('product_purchase_batches'),
   rows('mimine_stock_documents','created_at').then(data=>({data})).catch(error=>({data:[],error:error.message})),
   bankApi({action:'list',start,end:today}).then(data=>({data})).catch(error=>({data:{},error:error.message}))
  ]);
  const[sr,er,pr,cr,br,docs,bankResult]=results,bank=bankResult.data;
  const settlements=new Map((bank.settlements||[]).map(s=>[s.sale_date,s]));
  const categories=new Map(cr.map(c=>[String(c.id),c.name]));
  const classifications=new Map((bank.classifications||[]).map(c=>[c.event_id,c]));
  const allocations=bank.allocations||[];
  let prefs={};try{prefs=JSON.parse(localStorage.getItem('mimine-flow-preferences')||'{}')}catch{}
  return {
   version:1,analyticsHistory:2,supplyHistory:1,goal:Number(prefs.goal||0),settings:{largeType:!!prefs.largeType,autoMatch:true},
   sales:sr.map(s=>{const t=settlements.get(s.sale_date);return{id:'s-'+s.sale_date,remoteId:String(s.id),date:s.sale_date,amount:Number(s.amount),card:Number(t?.card_amount||0),cash:Number(t?.cash_amount||0),other:Number(t?.other_amount||0),fee:Number(t?.fee_amount||0),due:t?.due_date||'',settlementKnown:!!t,settlementConsistent:!t||Number(t.card_amount)+Number(t.cash_amount)+Number(t.other_amount)===Number(s.amount),note:s.memo||'',source:s.payment_method_name||'매출 장부'};}),
   expenses:er.map(e=>({id:String(e.id),date:e.expense_date,amount:Number(e.amount),category:e.category,vendor:e.vendor||e.memo||e.category,note:e.vendor?e.memo||'':''})),
   products:pr.filter(p=>p.is_active!==false).map(p=>{const batches=br.filter(b=>String(b.product_id)===String(p.id)).sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)||Number(b.id)-Number(a.id));return{id:String(p.id),name:p.name,category:categories.get(String(p.category_id))||p.category,barcode:p.sku||'',price:Number(p.sale_price),lastSalePrice:Number(p.sale_price),cost:Number(p.purchase_price),min:Number(p.low_stock_threshold??5),supplier:docs.data.find(d=>d.supplier&&d.items.some(i=>String(i?.productId)===String(p.id)))?.supplier||batches[0]?.supplier||'',color:'#a75542',bg:'#f6e9e3',priceHistory:[],batches:batches.map(b=>({id:String(b.id),qty:Number(b.remaining_quantity),originalQty:Number(b.quantity),cost:Number(b.unit_cost),salePrice:Number(b.sale_price??p.sale_price),date:b.purchase_date,expiry:b.expiration_date||'',source:b.memo||'입고'}))};}),
   events:(bank.events||[]).map(e=>{const c=classifications.get(e.id),d=new Date(e.occurred_at),date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(d),time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}).format(d);return{id:e.id,date,time,payer:e.payer,amount:Number(e.amount),business:e.payment_id||e.customer_id?'adw':c?.business||'unclassified',accountSuffix:e.account_suffix,note:c?.note||'',excluded:!!c?.excluded,excludeReason:c?.exclude_reason||'',excludeMemo:c?.exclude_memo||'',excludedAt:c?.excluded_at||'',classificationSource:c?.classification_source||'',autoRegistered:c?.classification_source==='alias'||allocations.some(a=>a.event_id===e.id&&a.match_source==='auto')};}),
   links:allocations.map(a=>({id:a.event_id+'|'+a.sale_date,saleId:'s-'+a.sale_date,eventId:a.event_id,amount:Number(a.amount),method:a.match_source==='auto'?'자동':'수동'})),
   payerRules:(bank.aliases||[]).map(a=>({id:a.id,payer:a.payer,business:a.business,label:a.label,active:a.active})),
   receipts:docs.data.filter(d=>d.document_type==='receipt').reverse().map(d=>({id:d.id,date:d.purchase_date,supplier:d.supplier,total:Number(d.total),itemSubtotal:Number(d.item_subtotal),adjustment:Number(d.total)-Number(d.item_subtotal),items:d.items,imageData:d.image_data,rawText:d.raw_text,imageFingerprint:d.fingerprint,expenseId:d.expense_id})),
   connection:{bankError:bankResult.error||'',stockError:docs.error||'',truncated:!!bank.truncated,bankStart:start,bankEnd:today,refreshedAt:new Date().toISOString()}
  };
 }
 async function invoke(command,payload){
  await check();let result={};
  if(command==='bank')return bankApi(payload);
  if(command==='stock'){
   const r=await db.rpc('mimine_receive_stock',{p_request_id:payload.requestId,p_document:payload.document});if(r.error)throw new Error(r.error.message);return r.data;
  }
  if(command==='sale'){
   const {date,amount,note,settlement}=payload;
   const r=await db.from('sales').upsert({sale_date:date,amount,memo:note||null},{onConflict:'sale_date'});if(r.error)throw new Error(r.error.message);
   if(settlement){try{await bankApi({action:'settlement',saleDate:date,...settlement});}catch(error){result.warning='매출은 저장했습니다. 정산정보 저장에 실패했으니 입금 화면에서 다시 확인해 주세요. '+error.message;}}
   return result;
  }
  if(command==='expense'){
   const r=await db.rpc('mimine_save_expense',{p_request_id:payload.requestId,p_expense:payload});if(r.error)throw new Error(r.error.message);return r.data;
  }
  if(command==='delete'){
   const table=payload.type==='sale'?'sales':'expenses';
   if(payload.type==='sale'){
    const bank=await bankApi({action:'list',start:payload.date,end:payload.date});
    if(bank.allocations?.some(a=>a.sale_date===payload.date))throw new Error('정산 연결을 먼저 해제해 주세요.');
    if(bank.settlements?.some(s=>s.sale_date===payload.date))throw new Error('정산정보가 있는 매출은 기존 장부에서 확인 후 처리해 주세요.');
   }
   const r=await db.from(table).delete().eq('id',payload.id);if(r.error)throw new Error(r.error.message);return result;
  }
  if(command==='stocktake'){
   const r=await db.rpc('stocktake_mimine_inventory',{p_product_id:Number(payload.productId),p_counted_quantity:payload.qty,p_memo:payload.reason});if(r.error)throw new Error(r.error.message);return r.data;
  }
  throw new Error('지원하지 않는 저장 요청입니다.');
 }

 async function bankApi(body){
  if(bankRequest)return bankRequest(body);
  const session=await check();
  const r=await fetch('/.netlify/functions/mimine-bank',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'통장 연결에 실패했습니다.');return data;
 }
 return {launch,isDemo:false,today:kst,snapshot:()=>refreshing||(refreshing=snapshot().finally(()=>refreshing=null)),invoke,
 legacy:(panel='more')=>{const url=new URL('legacy/index.html',location.href);url.hash='panel='+encodeURIComponent(panel);location.assign(url.href);},
 logout:async()=>{const{error}=await db.auth.signOut();if(error)throw new Error(error.message);location.replace(new URL('index.html',location.href).href);}};
}

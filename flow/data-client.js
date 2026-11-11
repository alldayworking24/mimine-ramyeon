/* Main-page server provider; uses the existing Mimine session and schema. */
function createMimineProductionBridge(db,{bankRequest}={}){
 const launch=new URLSearchParams(location.hash.slice(1)).get('allbase')||'';
 const kst=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
 const check=async()=>{const{data,error}=await db.auth.getSession();if(error)throw error;if(!data?.session)throw new Error('로그인이 필요합니다.');return data.session;};
 async function rows(table,order='id',columns='*'){
  const all=[];
  for(let offset=0;offset<100000;offset+=1000){
   let query=db.from(table).select(columns).order(order,{ascending:false});if(order!=='id')query=query.order('id',{ascending:false});const{data,error}=await query.range(offset,offset+999).abortSignal(AbortSignal.timeout(25000));
   if(error)throw new Error(table+' 조회: '+error.message);all.push(...data);
   if(data.length<1000)return all;
  }
  throw new Error('조회 한도를 초과했습니다. 기간을 줄여 주세요.');
 }
 async function snapshot({scope='all',base}={}){
  const finance=scope==='all'||scope==='finance',stock=scope==='all'||scope==='stock',bankScope=scope==='all'||scope==='bank',settings=scope==='all'||scope==='settings';
  const session=await check();
  const today=kst(),start=(Number(today.slice(0,4))-4)+'-01-01';
  const results=await Promise.all([
   finance?rows('sales','sale_date'):[],finance?rows('expenses','expense_date'):[],stock?rows('products'):[],stock?rows('product_categories'):[],stock?rows('product_purchase_batches'):[],
   stock?rows('mimine_stock_documents','created_at','id,document_type,purchase_date,supplier,total,item_subtotal,items,fingerprint,expense_id,created_at').then(data=>({data})).catch(error=>({data:[],error:error.message})):{data:[]},
   bankScope?bankApi({action:'list',start,end:today},session).then(data=>({data})).catch(error=>({data:{},error:error.message})):{data:{}},
   stock?rows('product_images').then(data=>({data})).catch(error=>({data:[],error:error.message})):{data:[]},
   settings?db.from('mimine_settings').select('setting_value,updated_at').eq('setting_key','recurring_payment_rules_v1').abortSignal(AbortSignal.timeout(10000)).maybeSingle().then(r=>{if(r.error)throw r.error;return{data:r.data};}).catch(error=>({data:null,error:error.message})):{data:null}
  ]);
  const[sr,er,pr,cr,br,docs,bankResult,images,paymentSettings]=results,bank=bankResult.data;
  const productImages=new Map();
  for(const image of images.data.filter(i=>i.public_url).sort((a,b)=>Number(!!b.is_primary)-Number(!!a.is_primary)||Number(a.sort_order??Infinity)-Number(b.sort_order??Infinity)||Number(a.id)-Number(b.id))){const id=String(image.product_id);if(!productImages.has(id))productImages.set(id,image.public_url);}
  const settlements=new Map((bank.settlements||[]).map(s=>[s.sale_date,s]));
  const categories=new Map(cr.map(c=>[String(c.id),c.name]));
  const classifications=new Map((bank.classifications||[]).map(c=>[c.event_id,c]));
  const allocations=bank.allocations||[];
  let prefs={};try{prefs=JSON.parse(localStorage.getItem('mimine-flow-preferences')||'{}')}catch{}
  const batchIndex=new Map(),supplierIndex=new Map();
  for(const batch of br){const id=String(batch.product_id);if(!batchIndex.has(id))batchIndex.set(id,[]);batchIndex.get(id).push(batch);}
  for(const d of docs.data)if(d.supplier)for(const i of d.items||[]){const id=String(i?.productId);if(!supplierIndex.has(id))supplierIndex.set(id,d.supplier);}
  const matchedEvents=new Set(allocations.filter(a=>a.match_source==='auto').map(a=>a.event_id));
  const dateFormat=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'});
  const timeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'});
  const previousSales=new Map((base?.sales||[]).map(s=>[s.date,s]));
  const next={
   version:1,analyticsHistory:2,supplyHistory:1,goal:Number(prefs.goal||0),settings:{largeType:!!prefs.largeType,autoMatch:true},
   paymentRulesConfigured:!!paymentSettings.data,paymentRules:paymentSettings.data?.setting_value?.rules||[],paymentClosedDays:paymentSettings.data?.setting_value?.closedDays||[],
   sales:(finance?sr.map(s=>({id:'s-'+s.sale_date,remoteId:String(s.id),date:s.sale_date,amount:Number(s.amount),note:s.memo||'',source:s.payment_method_name||'매출 장부'})):base?.sales||[]).map(s=>{
    const old=previousSales.get(s.date);
    if(!bankScope||bankResult.error)return withSettlement(s,old?.settlementKnown?{card_amount:old.card,cash_amount:old.cash,other_amount:old.other,fee_amount:old.fee,due_date:old.due}:null);
    return withSettlement(s,settlements.get(s.date));
   }),
   expenses:er.map(e=>({id:String(e.id),date:e.expense_date,amount:Number(e.amount),category:e.category,vendor:e.vendor||e.memo||e.category,note:paymentCleanNote(e.vendor?e.memo||'':''),paymentLink:paymentExtractTag(e.memo)})),
   products:pr.filter(p=>p.is_active!==false).map(p=>{const batches=(batchIndex.get(String(p.id))||[]).sort((a,b)=>b.purchase_date.localeCompare(a.purchase_date)||Number(b.id)-Number(a.id));return{id:String(p.id),name:p.name,imageUrl:productImages.get(String(p.id))||'',category:categories.get(String(p.category_id))||p.category,barcode:p.sku||'',price:Number(p.sale_price),lastSalePrice:Number(p.sale_price),cost:Number(p.purchase_price),min:Number(p.low_stock_threshold??5),supplier:supplierIndex.get(String(p.id))||batches[0]?.supplier||'',color:'#a75542',bg:'#f6e9e3',priceHistory:[],batches:batches.map(b=>({id:String(b.id),qty:Number(b.remaining_quantity),originalQty:Number(b.quantity),cost:Number(b.unit_cost),salePrice:Number(b.sale_price??p.sale_price),date:b.purchase_date,expiry:b.expiration_date||'',source:b.memo||'입고'}))};}),
   events:(bank.events||[]).map(e=>{const c=classifications.get(e.id),d=new Date(e.occurred_at),date=dateFormat.format(d),time=timeFormat.format(d);return{id:e.id,date,time,payer:e.payer,amount:Number(e.amount),business:e.payment_id||e.customer_id?'adw':c?.business||'unclassified',accountSuffix:e.account_suffix,note:c?.note||'',excluded:!!c?.excluded,excludeReason:c?.exclude_reason||'',excludeMemo:c?.exclude_memo||'',excludedAt:c?.excluded_at||'',classificationSource:c?.classification_source||'',autoRegistered:c?.classification_source==='alias'||matchedEvents.has(e.id)};}),
   links:allocations.map(a=>({id:a.event_id+'|'+a.sale_date,saleId:'s-'+a.sale_date,eventId:a.event_id,amount:Number(a.amount),method:a.match_source==='auto'?'자동':'수동'})),
   payerRules:(bank.aliases||[]).map(a=>({id:a.id,payer:a.payer,business:a.business,label:a.label,active:a.active})),
   receipts:docs.data.filter(d=>d.document_type==='receipt').reverse().map(d=>({id:d.id,date:d.purchase_date,supplier:d.supplier,total:Number(d.total),itemSubtotal:Number(d.item_subtotal),adjustment:Number(d.total)-Number(d.item_subtotal),items:d.items,imageData:d.image_data,rawText:d.raw_text,imageFingerprint:d.fingerprint,expenseId:d.expense_id})),
   connection:{paymentSettingsError:paymentSettings.error||'',imageError:images.error||'',bankError:bankResult.error||'',stockError:docs.error||'',truncated:!!bank.truncated,bankStart:start,bankEnd:today,refreshedAt:new Date().toISOString()}
  };
  const connection={...base?.connection,...next.connection,bankReady:bankScope?!bankResult.error:!!base?.connection?.bankReady,stockReady:stock||!!base?.connection?.stockReady,paymentReady:settings||!!base?.connection?.paymentReady};
  if(!finance)next.expenses=base.expenses;
  if(!settings){for(const key of ['paymentRulesConfigured','paymentRules','paymentClosedDays'])next[key]=base?.[key]??next[key];connection.paymentSettingsError=base?.connection?.paymentSettingsError||'';}
  if(!stock){next.products=base?.products||[];next.receipts=base?.receipts||[];for(const key of ['imageError','stockError'])connection[key]=base?.connection?.[key]||'';}
  if(!bankScope||bankResult.error){for(const key of ['events','links','payerRules'])next[key]=base?.[key]||[];}
  if(!bankScope){for(const key of ['bankError','truncated','bankStart','bankEnd'])connection[key]=base?.connection?.[key]??connection[key];}
  return {...next,connection};
 }
 function withSettlement(s,t){const card=Number(t?.card_amount||0),cash=Number(t?.cash_amount||0),other=Number(t?.other_amount||0);return {...s,card,cash,other,fee:Number(t?.fee_amount||0),due:t?.due_date||'',settlementKnown:!!t,settlementConsistent:!t||card+cash+other===s.amount};}
 async function invoke(command,payload){
  const session=await check();let result={};
  if(command==='payment-rules'){
   const config=paymentValidateConfig(payload);
   if(!session.user?.id)throw new Error('계정을 다시 확인해 주세요.');
   const r=await db.from('mimine_settings').upsert({setting_key:'recurring_payment_rules_v1',setting_value:config,description:'매월 납부일과 임시휴일 설정',updated_by:session.user.id},{onConflict:'setting_key'});
   if(r.error)throw new Error(r.error.message);return{ok:true};
  }
  if(command==='bank')return bankApi(payload,session);
  if(command==='stock'){
   const r=await db.rpc('mimine_receive_stock',{p_request_id:payload.requestId,p_document:payload.document});if(r.error)throw new Error(r.error.message);return r.data;
  }
  if(command==='sale'){
   const {date,amount,note}=payload;
   let {settlement}=payload;
   if(payload.verifySettlement){
    const bank=await bankApi({action:'list',start:date,end:date},session);
    const old=bank.settlements?.find(s=>s.sale_date===date);
    if(old&&!settlement){
     const cash=Number(old.cash_amount),other=Number(old.other_amount),fee=Number(old.fee_amount);
     if(Number(old.card_amount)+cash+other!==payload.previousAmount)throw new Error('기존 정산정보와 매출이 다릅니다. 결제수단을 열어 합계를 맞춰 주세요.');
     settlement={card:amount-cash-other,cash,other,fee,dueDate:old.due_date||'',note};
    }
    if(settlement){
     const linked=(bank.allocations||[]).filter(a=>a.sale_date===date).reduce((n,a)=>n+Number(a.amount),0);
     if(settlement.card<settlement.fee||settlement.card-settlement.fee<linked)throw new Error('수수료와 이미 연결된 입금보다 정산액이 작습니다.');
    }
   }
   const r=await db.from('sales').upsert({sale_date:date,amount,memo:note||null},{onConflict:'sale_date'}).select('id,sale_date,amount,memo').maybeSingle();if(r.error)throw new Error(r.error.message);
   const saved=r.data;
   if(saved?.id)result.sale={id:'s-'+saved.sale_date,remoteId:String(saved.id),date:saved.sale_date,amount:Number(saved.amount),note:saved.memo||'',source:'매출 장부'};
   if(settlement){try{await bankApi({action:'settlement',saleDate:date,...settlement},session);}catch(error){result.warning='매출은 저장했습니다. 정산정보 저장에 실패했으니 입금 화면에서 다시 확인해 주세요. '+error.message;}}
   if(result.sale&&settlement&&!result.warning)result.sale=withSettlement(result.sale,{card_amount:settlement.card,cash_amount:settlement.cash,other_amount:settlement.other,fee_amount:settlement.fee,due_date:settlement.dueDate});
   return result;
  }
  if(command==='expense'){
   const r=await db.rpc('mimine_save_expense',{p_request_id:payload.requestId,p_expense:payload});if(r.error)throw new Error(r.error.message);
   const result=r.data||{};
   // Confirm only this saved row; do not fetch the entire sales/expense history.
   if(result.id){try{const row=await db.from('expenses').select('id,expense_date,amount,category,vendor,memo').eq('id',result.id).abortSignal(AbortSignal.timeout(10000)).maybeSingle();if(!row.error&&row.data){const e=row.data;result.expense={id:String(e.id),date:e.expense_date,amount:Number(e.amount),category:e.category,vendor:e.vendor||e.memo||e.category,note:paymentCleanNote(e.vendor?e.memo||'':''),paymentLink:paymentExtractTag(e.memo)};}}catch{}}
   return result;
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

 async function bankApi(body,session){
  if(bankRequest)return bankRequest(body);
  session??=await check();
  const r=await fetch('/.netlify/functions/mimine-bank',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'통장 연결에 실패했습니다.');return data;
 }
 return {launch,isDemo:false,today:kst,snapshot,invoke,
 saleSettlement:async date=>{const session=await check();return bankApi({action:'list',start:date,end:date},session);},
 receipt:async id=>{await check();const {data,error}=await db.from('mimine_stock_documents').select('image_data,raw_text').eq('id',id).abortSignal(AbortSignal.timeout(15000)).maybeSingle();if(error||!data)throw new Error(error?.message||'영수증을 찾지 못했어요.');return data;},
 legacy:(panel='more')=>{const url=new URL('legacy/index.html',location.href);url.hash='panel='+encodeURIComponent(panel);location.assign(url.href);},
 logout:async()=>{const{error}=await db.auth.signOut();if(error)throw new Error(error.message);location.replace(new URL('index.html',location.href).href);}};
}

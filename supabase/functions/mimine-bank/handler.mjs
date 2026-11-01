import {randomBytes,createHash} from 'node:crypto';
const MAIN='https://hunoualsfmfckalwbilt.supabase.co';
const MAIN_PUBLIC='sb_publishable_DFp-SNqkUWJiX4CHLu_gxQ_FrtXHDwg';
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const uuid=v=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v);
const money=v=>Number.isSafeInteger(v)&&v>=0&&v<=10000000000;
export function createHandler({env,fetcher=fetch}={}){return async req=>{
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(req.method!=='POST')return reply({error:'POST 요청만 허용됩니다.'},405);
 const jwt=req.headers.get('Authorization')||'';if(!/^Bearer \S+$/.test(jwt))return reply({error:'로그인이 필요합니다.'},401);
 const base=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');if(!base||!key)return reply({error:'통장 서버 설정을 확인해 주세요.'},503);
 const call=async(url,{method='GET',body,headers={}}={})=>{const res=await fetcher(url,{method,headers:{'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});const txt=await res.text();let data;try{data=txt?JSON.parse(txt):null}catch{throw new Error('서버 응답을 읽지 못했습니다.')};if(!res.ok){const error=new Error(res.status>=500?'통장 서버 연결 오류입니다.':data?.message||'요청을 처리하지 못했습니다.');error.status=res.status;throw error}return data};
 const db=(path,options={})=>call(base+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,Prefer:'return=representation',...options.headers}});
 try{
 const auth=await fetcher(MAIN+'/auth/v1/user',{headers:{apikey:MAIN_PUBLIC,Authorization:jwt},signal:AbortSignal.timeout(10000)});
 if(!auth.ok)return reply({error:'로그인이 만료되었습니다.'},401);const user=await auth.json();
 const profiles=await call(MAIN+'/rest/v1/app_users?user_id=eq.'+encodeURIComponent(user.id)+'&select=is_active',{headers:{apikey:MAIN_PUBLIC,Authorization:jwt}});
 if(!profiles?.[0]?.is_active)return reply({error:'사용 권한이 없습니다.'},403);
 const email=String(user.email||'').toLowerCase();const access=await db('mimine_bank_access?email=eq.'+encodeURIComponent(email)+'&select=adw_user_id');
 if(!access?.length)return reply({error:'공용 통장은 소유자 권한이 있는 계정에서만 볼 수 있습니다.'},403);
 const raw=await req.text();if(new TextEncoder().encode(raw).length>16384)return reply({error:'요청이 너무 큽니다.'},413);let b;try{b=JSON.parse(raw)}catch{return reply({error:'JSON 요청이 필요합니다.'},400)};
 const audit=async(action,detail)=>db('mimine_bank_audit',{method:'POST',body:{actor:email,action,detail}});
 switch(b.action){
 case 'list':{
 if(!date(b.start)||!date(b.end)||b.start>b.end||Date.parse(b.end)-Date.parse(b.start)>366*86400000*5)return reply({error:'조회 기간은 최대 5년입니다.'},400);
 let truncated=false;const pages=async(path)=>{let all=[];for(let offset=0;offset<20000;offset+=1000){const rows=await db(path+'&limit=1000&offset='+offset);all.push(...rows);if(rows.length<1000)return all}truncated=true;return all};
 const settlements=await pages('mimine_settlements?select=*&sale_date=gte.'+b.start+'&sale_date=lte.'+b.end+'&order=sale_date.desc');
 const allocations=await pages('mimine_bank_allocations?select=*&sale_date=gte.'+b.start+'&sale_date=lte.'+b.end+'&order=sale_date.desc');
 let events=await pages('adw_sms_events?select=id,amount,payer,occurred_at,received_at,status,payment_id,account_suffix&occurred_at=gte.'+encodeURIComponent(b.start+'T00:00:00+09:00')+'&occurred_at=lt.'+encodeURIComponent(b.end+'T23:59:59.999999+09:00')+'&order=occurred_at.desc,id');
 const missing=[...new Set(allocations.map(a=>a.event_id))].filter(id=>!events.some(e=>e.id===id));
 for(let i=0;i<missing.length;i+=100)events.push(...await db('adw_sms_events?select=id,amount,payer,occurred_at,received_at,status,payment_id,account_suffix&id=in.('+missing.slice(i,i+100).join(',')+')'));
 const ids=events.map(e=>e.id);let classifications=[];
 for(let i=0;i<ids.length;i+=100)classifications.push(...await db('mimine_bank_classifications?select=*&event_id=in.('+ids.slice(i,i+100).join(',')+')'));
 // Include allocations outside the period for each visible event to show available balances accurately.
 let eventAllocations=[];for(let i=0;i<ids.length;i+=100)eventAllocations.push(...await pages('mimine_bank_allocations?select=*&event_id=in.('+ids.slice(i,i+100).join(',')+')&order=sale_date'));
 const devices=await db('adw_sms_devices?select=id,name,enabled,last_seen_at&order=created_at.desc');
 return reply({events,classifications,settlements,allocations:eventAllocations,devices,truncated,refreshedAt:new Date().toISOString(),source:'adw-sms'});
 }
 case 'classify':{
 if(!uuid(b.eventId)||!['mimine','adw','other','unclassified'].includes(b.business)||!['settlement','customer','owner','refund','other'].includes(b.category)||String(b.note||'').length>500)return reply({error:'분류 항목을 확인해 주세요.'},400);
 await db('rpc/mimine_bank_classify',{method:'POST',body:{p_event:b.eventId,p_business:b.business,p_category:b.category,p_note:String(b.note||''),p_actor:email}});return reply({ok:true});
 }
 case 'settlement':{
 if(!date(b.saleDate)||![b.card,b.cash,b.other,b.fee].every(money)||b.fee>b.card||(b.dueDate&&!date(b.dueDate))||String(b.note||'').length>500)return reply({error:'매출·수수료·날짜를 확인해 주세요.'},400);
 const actual=await call(MAIN+'/rest/v1/sales?select=amount&sale_date=eq.'+b.saleDate,{headers:{apikey:MAIN_PUBLIC,Authorization:jwt}});
 const total=actual.reduce((n,x)=>n+Number(x.amount),0);if(!actual.length||total!==b.card+b.cash+b.other)return reply({error:'일매출 기록 합계와 카드·현금·기타 합계가 같아야 합니다. 일매출을 먼저 등록해 주세요.'},409);
 await db('mimine_settlements?on_conflict=sale_date',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:{sale_date:b.saleDate,card_amount:b.card,cash_amount:b.cash,other_amount:b.other,fee_amount:b.fee,due_date:b.dueDate||null,note:String(b.note||''),source:'manual',updated_by:email,updated_at:new Date().toISOString()}});await audit('settlement',{sale_date:b.saleDate});return reply({ok:true});
 }
 case 'allocate':{
 if(!uuid(b.eventId)||!date(b.saleDate)||!money(b.amount))return reply({error:'입금 연결 항목을 확인해 주세요.'},400);
 await db('rpc/mimine_bank_allocate',{method:'POST',body:{p_event:b.eventId,p_date:b.saleDate,p_amount:b.amount,p_actor:email}});return reply({ok:true});
 }
 case 'pair':{
 const token='adwsms_'+randomBytes(32).toString('base64url');await db('adw_sms_devices',{method:'POST',body:{name:String(b.name||'미미네 입금 수신폰').slice(0,60),owner_id:access[0].adw_user_id,token_hash:createHash('sha256').update(token).digest('hex'),auto_apply:false}});await audit('pair',{});return reply({ok:true,token});
 }
 case 'device':{
 if(!uuid(b.id)||typeof b.enabled!=='boolean')return reply({error:'기기 정보를 확인해 주세요.'},400);
 await db('adw_sms_devices?id=eq.'+b.id,{method:'PATCH',body:{enabled:b.enabled}});await audit('device',{id:b.id,enabled:b.enabled});return reply({ok:true});
 }
 default:return reply({error:'지원하지 않는 요청입니다.'},400);
 }
 }catch(e){return reply({error:e.status===401?'로그인이 만료되었습니다.':String(e.message||'처리 실패')},e.status===401?401:e.status===403?403:e.status>=500?503:409)}
}}

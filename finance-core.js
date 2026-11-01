(function(root){
'use strict';
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const plusDays=(v,n)=>{const d=new Date(v+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
function bounds(key,today,custom,dates=[]){
 if(custom)return {start:custom.start,end:custom.end};
 let start=today,end=today;const d=new Date(today+'T00:00:00Z');
 if(key==='all')start=dates.filter(Boolean).sort()[0]||today;
 else if(key==='today')start=today;
 else if(key==='week')start=plusDays(today,-((d.getUTCDay()+6)%7));
 else if(key==='lastmonth'){end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),0)).toISOString().slice(0,10);start=end.slice(0,7)+'-01'}
 else if(/^\d+d$/.test(key))start=plusDays(today,1-Number(key.slice(0,-1)));
 else {const months=Number(key.replace('m',''))||1;start=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-months+1,1)).toISOString().slice(0,10)}
 return {start,end};
}
function series(sales,expenses,period){
 const days=Math.round((Date.parse(period.end+'T00:00:00Z')-Date.parse(period.start+'T00:00:00Z'))/86400000)+1;
 const monthly=days>62,map=new Map();
 if(monthly){let c=period.start.slice(0,7);while(c<=period.end.slice(0,7)){map.set(c,{key:c,label:c.replace('-','.'),s:0,e:0});const d=new Date(c+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);c=d.toISOString().slice(0,7)}}
 else for(let i=0;i<days;i++){const date=plusDays(period.start,i);map.set(date,{key:date,label:date.slice(5).replace('-','/'),s:0,e:0})}
 for(const [rows,dateKey,field] of [[sales,'sale_date','s'],[expenses,'expense_date','e']])for(const row of rows){if(row[dateKey]>=period.start&&row[dateKey]<=period.end){const key=monthly?row[dateKey].slice(0,7):row[dateKey];if(map.has(key))map.get(key)[field]+=Number(row.amount)||0}}
 return [...map.values()];
}
function reconciliation(settlements,events,classes,allocations,start,end,today){
 const selected=settlements.filter(r=>r.sale_date>=start&&r.sale_date<=end),classMap=new Map(classes.map(x=>[x.event_id,x])),eventMap=new Map(events.map(x=>[x.id,x]));
 let card=0,cash=0,other=0,expected=0,received=0,due=0,pending=0,unknown=0,excess=0;
 const rows=selected.map(s=>{const net=Number(s.card_amount)-Number(s.fee_amount);let paid=0;for(const a of allocations.filter(a=>a.sale_date===s.sale_date)){const e=eventMap.get(a.event_id),cl=classMap.get(a.event_id);if(e&&cl?.business==='mimine'&&cl?.category==='settlement'&&!e.payment_id)paid+=Number(a.amount)}
 const remaining=Math.max(0,net-paid);card+=Number(s.card_amount);cash+=Number(s.cash_amount);other+=Number(s.other_amount);expected+=net;received+=paid;excess+=Math.max(0,paid-net);
 let status='확인 완료';if(remaining){if(!s.due_date){status='정산일 확인 필요';unknown+=remaining}else if(s.due_date>today){status='입금 예정';pending+=remaining}else{status='확인 필요';due+=remaining}}
 return {...s,net,paid,remaining,status};});
 return {rows,card,cash,other,expected,received,due,pending,unknown,excess,gap:expected-received};
}
root.MimineFinance={validDate,plusDays,bounds,series,reconciliation};
})(typeof globalThis==='undefined'?window:globalThis);

/* Calendar-backed reminders. Pure functions never write expenses or move money. */
const PAYMENT_CARD_COMPANIES=['신한카드','삼성카드','현대카드','KB국민카드','롯데카드','우리카드','하나카드','NH농협카드','BC카드','IBK기업카드','씨티카드'];
const PAYMENT_HOLIDAYS={
 2026:['01-01','02-16','02-17','02-18','03-01','03-02','05-01','05-05','05-24','05-25','06-03','06-06','07-17','08-15','08-17','09-24','09-25','09-26','10-03','10-05','10-09','12-25'],
 2027:['01-01','02-06','02-07','02-08','02-09','03-01','05-01','05-03','05-05','05-13','06-06','07-17','07-19','08-15','08-16','09-14','09-15','09-16','10-03','10-04','10-09','10-11','12-25','12-27']
};
const PAYMENT_CALENDAR_CHECKED='2026-11-03';
function paymentIso(date){return date.toISOString().slice(0,10);}
function paymentAddDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return paymentIso(d);}
function paymentMonthShift(ym,n){const [y,m]=ym.split('-').map(Number);return paymentIso(new Date(Date.UTC(y,m-1+n,1))).slice(0,7);}
function paymentMonthEnd(ym){const[y,m]=ym.split('-').map(Number);return paymentIso(new Date(Date.UTC(y,m,0)));}
function paymentValidDate(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&paymentIso(new Date(date+'T12:00:00Z'))===date;}
function paymentCardName(text){
 const raw=String(text||'').trim(),s=raw.replace(/\s|[()㈜]|주식회사/g,'').toUpperCase();
 const names=[['신한','신한카드'],['삼성','삼성카드'],['현대','현대카드'],['국민','KB국민카드'],['KB','KB국민카드'],['롯데','롯데카드'],['우리','우리카드'],['하나','하나카드'],['농협','NH농협카드'],['NH','NH농협카드'],['비씨','BC카드'],['BC','BC카드'],['기업','IBK기업카드'],['IBK','IBK기업카드'],['씨티','씨티카드']];
 return names.find(([key])=>s.includes(key))?.[1]||raw;
}
function paymentNextBusinessDay(nominal,closedDays=[]){
 let date=nominal,verified=true;const extra=new Set(closedDays);
 for(let i=0;i<40;i++){
  const y=Number(date.slice(0,4)),w=new Date(date+'T12:00:00Z').getUTCDay();
  if(!PAYMENT_HOLIDAYS[y])verified=false;
  if(w!==0&&w!==6&&!PAYMENT_HOLIDAYS[y]?.includes(date.slice(5))&&!extra.has(date))return{date,adjusted:date!==nominal,verified};
  date=paymentAddDays(date,1);
 }
 throw new Error('납부일을 계산하지 못했습니다. 임시휴일 설정을 확인해 주세요.');
}
function paymentValidateConfig(config){
 if(!config||!Array.isArray(config.rules)||config.rules.length>50)throw new Error('납부 항목은 최대 50개까지 등록할 수 있습니다.');
 const ids=new Set(),matches=new Set();
 const rules=config.rules.map(raw=>{
  const r={id:String(raw.id||''),type:String(raw.type||''),name:String(raw.name||'').trim(),card:paymentCardName(raw.card||''),day:Number(raw.day),amount:Number(raw.amount||0),active:raw.active!==false};
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(r.id)||ids.has(r.id))throw new Error('납부 항목 ID를 확인해 주세요.');ids.add(r.id);
  if(!['rent','card','other'].includes(r.type)||!Number.isInteger(r.day)||r.day<1||r.day>31||!Number.isSafeInteger(r.amount)||r.amount<0||r.amount>999999999)throw new Error('납부일과 예상 금액을 확인해 주세요.');
  if(r.type==='rent')r.name='임대료';
  if(r.type==='card'){if(!r.card||r.card.length>60)throw new Error('카드사를 선택해 주세요.');r.name=r.card;}
  if(!r.name||r.name.length>60)throw new Error('납부 항목 이름을 입력해 주세요.');
  const key=r.type+':'+(r.type==='card'?r.card:r.type==='other'?r.name:'임대료');
  if(matches.has(key))throw new Error('같은 납부 항목이나 카드사가 중복돼 있습니다.');matches.add(key);
  return r;
 });
 const closedDays=[...new Set(config.closedDays||[])];
 if(closedDays.length>200||closedDays.some(d=>!paymentValidDate(d)))throw new Error('임시휴일은 YYYY-MM-DD 형식으로 입력해 주세요.');
 return{version:1,rules,closedDays:closedDays.sort()};
}
function paymentInferredRules(expenses){
 const rent=expenses.filter(e=>e.category==='임대료'&&e.amount>0).sort((a,b)=>b.date.localeCompare(a.date))[0];
 return rent?[{id:'rent-default',type:'rent',name:'임대료',card:'',day:1,amount:Number(rent.amount),active:true}]:[];
}
function paymentTag(ruleId,ym){return '[미미네납부:'+ruleId+':'+ym+']';}
function paymentExtractTag(note){return String(note||'').match(/\[미미네납부:([a-zA-Z0-9_-]+):(\d{4}-\d{2})\]/)?.[0]||'';}
function paymentCleanNote(note){return String(note||'').replace(/\[미미네납부:[a-zA-Z0-9_-]+:\d{4}-\d{2}\]/g,'').trim();}
function paymentComposeNote(note,link){const clean=paymentCleanNote(note),tag=paymentExtractTag(link);return clean+(tag?(clean?'\n':'')+tag:'');}
function paymentRuleMatches(rule,expense){
 if(rule.type==='rent')return expense.category==='임대료';
 if(rule.type==='card')return ['카드 대금','카드대금'].includes(expense.category)&&paymentCardName(expense.vendor)===rule.card;
 return !['임대료','카드 대금','카드대금'].includes(expense.category)&&String(expense.vendor||'').trim()===rule.name;
}
function paymentInstances(config,expenses,today){
 const normalized=paymentValidateConfig(config),ym=today.slice(0,7),months=[paymentMonthShift(ym,-1),ym,paymentMonthShift(ym,1)];
 const all=normalized.rules.filter(r=>r.active).flatMap(rule=>months.map(month=>{
  const nominal=month+'-'+String(Math.min(rule.day,Number(paymentMonthEnd(month).slice(8)))).padStart(2,'0'),business=paymentNextBusinessDay(nominal,normalized.closedDays);
  return{key:rule.id+'|'+month,rule,month,nominal,due:business.date,adjusted:business.adjusted,calendarVerified:business.verified,records:[],paidAmount:0};
 }));
 for(const rule of normalized.rules.filter(r=>r.active)){
  const instances=all.filter(i=>i.rule.id===rule.id);
  for(const e of expenses.filter(e=>e.date<=today&&Number(e.amount)>0&&paymentRuleMatches(rule,e))){
   const tag=String(e.paymentLink||e.note||'').match(/\[미미네납부:([a-zA-Z0-9_-]+):(\d{4}-\d{2})\]/);
   let target;
   if(tag){target=instances.find(i=>i.rule.id===tag[1]&&i.month===tag[2]);}
   else{
    // A month-end bill shifted into the next month belongs to the original
    // cycle. Every untagged expense is assigned to exactly one cycle.
    target=instances.find(i=>i.due.slice(0,7)>i.month&&e.date.slice(0,7)===i.due.slice(0,7)&&e.date<=i.due&&e.date>=i.month+'-01')
      ||instances.find(i=>i.month===e.date.slice(0,7));
   }
   if(target){target.records.push(e);target.paidAmount+=Number(e.amount);}
  }
 }
 return all.map(i=>({...i,status:i.paidAmount>0&&(!i.rule.amount||i.paidAmount>=i.rule.amount)?'paid':i.paidAmount>0?'partial':i.due<today?'overdue':'pending',remaining:Math.max(0,i.rule.amount-i.paidAmount)}));
}
function paymentVisibleInstances(config,expenses,today){
 const ym=today.slice(0,7),all=paymentInstances(config,expenses,today);
 const current=all.filter(i=>i.month===ym||(i.month<ym&&i.due>=ym+'-01'));
 if(!current.some(i=>i.status!=='paid'))current.push(...all.filter(i=>i.month>ym).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,2));
 return current;
}

/* Payment summaries are derived from real expense entries, never bank debit claims. */
const paymentUi={index:0,paused:false,timer:null};
function paymentConfig(){
 const rules=db.paymentRulesConfigured?db.paymentRules:paymentInferredRules(db.expenses.filter(e=>e.date<=TODAY));
 return paymentValidateConfig({rules,closedDays:db.paymentClosedDays||[]});
}
let paymentCache;
function paymentItems(){
 const keys=[db.expenses,db.paymentRules,db.paymentClosedDays,db.paymentRulesConfigured];
 if(paymentCache&&keys.every((key,i)=>key===paymentCache.keys[i]))return paymentCache.items;
 let items=[];try{items=paymentVisibleInstances(paymentConfig(),db.expenses,TODAY);}catch{}
 paymentCache={keys,items};return items;
}
const paymentStateLabel={paid:'납부 완료',pending:'납부 예정',partial:'일부 납부',overdue:'기한 지남'};
function paymentBannerContent(){
 if(db.connection?.paymentReady===false)return '<span class="payment-empty" role="status">납부 알림을 불러오는 중</span>';
 if(db.connection?.paymentSettingsError)return '<button type="button" class="payment-empty" data-action="production-refresh">'+icon('alert')+'<span>납부일 설정을 불러오지 못했어요.<small>눌러서 다시 확인</small></span></button>';
 const items=paymentItems();paymentUi.index=items.length?paymentUi.index%items.length:0;
 const item=items[paymentUi.index];
 if(!item)return '<button type="button" class="payment-empty" data-action="payment-settings">'+icon('calendar')+'<span>매월 납부할 항목을 등록하세요.<small>임대료·카드 결제일을 한눈에</small></span>'+icon('plus')+'</button>';
 const actual=item.status==='paid'?item.paidAmount:item.rule.amount,amount=actual?won(actual):'금액 미정';
 const days=daysBetween(TODAY,item.due),when=item.status==='paid'?md(item.records.map(e=>e.date).sort().at(-1))+' 비용 입력 · 납부일 '+md(item.due):md(item.due)+' '+weekday(item.due)+'요일'+(days===0?' · 오늘':days>0?' · D−'+days:' · '+Math.abs(days)+'일 지남');
 return '<div class="payment-roll-row"><button type="button" class="payment-roll-item is-'+item.status+'" data-action="payment-detail" data-id="'+esc(item.key)+'" aria-label="'+esc(paymentStateLabel[item.status]+' '+item.rule.name+' '+amount+' '+when)+'"><span class="payment-status-icon">'+icon(item.status==='paid'?'check':item.status==='overdue'?'alert':item.rule.type==='card'?'card':'calendar')+'</span><span class="payment-roll-copy"><span class="payment-roll-head"><span class="payment-status">'+paymentStateLabel[item.status]+'</span><strong>'+esc(item.rule.name)+'</strong><b>'+amount+'</b></span></span></button><div class="payment-roll-controls"><button type="button" class="icon-button" data-action="payment-settings" aria-label="정기 납부일 설정">'+icon('settings')+'</button><div><button type="button" class="payment-next" data-action="payment-next" aria-label="다음 납부 알림">'+(paymentUi.index+1)+'/'+items.length+icon('right')+'</button><button type="button" class="payment-pause" data-action="payment-pause" aria-pressed="'+paymentUi.paused+'" aria-label="'+(paymentUi.paused?'납부 알림 롤링 재개':'납부 알림 롤링 일시정지')+'">'+icon(paymentUi.paused?'play':'pause')+'</button></div></div></div>';
}
function paymentBanner(){return '<section class="payment-banner" aria-label="정기 납부 알림" data-swipe-ignore="true"><div id="payment-roll" aria-live="off">'+paymentBannerContent()+'</div></section>';}
function paymentStartTicker(){
 if(paymentUi.timer!==null){clearInterval(paymentUi.timer);paymentUi.timer=null;}
 if(view.page!=='today'||paymentItems().length<2||typeof setInterval!=='function')return;
 paymentUi.timer=setInterval(()=>{
  const root=$('#payment-roll'),banner=root?.closest('.payment-banner');
  if(!root||document.hidden||modalName||paymentUi.paused||banner?.matches(':hover,:focus-within'))return;
  paymentUi.index=(paymentUi.index+1)%paymentItems().length;root.innerHTML=paymentBannerContent();
 },3000);
}
function expenseCardSelector(){
 const form=$('#entry-form');if(!form||modalContext.entryType!=='expense')return;
 const vendor=form.querySelector('[name=vendor]'),fieldBox=vendor.closest('.form-field'),label=fieldBox.querySelector('label');
 const note=form.querySelector('[name=note]'),existing=db.expenses.find(e=>e.id===modalContext.id),link=existing?.paymentLink||paymentExtractTag(note.value);if(link){note.value=paymentCleanNote(note.value);form.insertAdjacentHTML('beforeend','<input type="hidden" name="payment-link" value="'+esc(link)+'">');}
 const ordinaryPlaceholder=vendor.placeholder,ordinaryAria=vendor.getAttribute('aria-label');let ordinaryValue=vendor.value,lastCategory=form.querySelector('[name=category]:checked')?.value;
 const host=document.createElement('div');host.className='expense-card-select-wrap';host.hidden=true;
 host.innerHTML='<select id="expense-card-company" aria-label="카드사" name="card-company"><option value="">카드사 선택</option>'+PAYMENT_CARD_COMPANIES.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join('')+'<option value="__other">기타 카드사 · 직접 입력</option></select><p class="field-note">결제일은 홈의 납부일 설정에서 한 번 등록하세요.</p>';
 fieldBox.insertBefore(host,vendor);const select=host.querySelector('select');
 function update(fromCategory=false){
  const card=['카드 대금','카드대금'].includes(form.querySelector('[name=category]:checked')?.value);
  if(card){
   const entering=fromCategory&&lastCategory!=='카드 대금'&&lastCategory!=='카드대금';if(entering)ordinaryValue=vendor.value;
   if(fromCategory||host.hidden){const name=paymentCardName(vendor.value);select.value=PAYMENT_CARD_COMPANIES.includes(name)?name:!entering&&vendor.value?'__other':'';}
   host.hidden=false;select.required=true;label.textContent='카드사';label.htmlFor='expense-card-company';
   const other=select.value==='__other';vendor.hidden=!other;vendor.required=other;vendor.placeholder='카드사 이름 입력';vendor.setAttribute('aria-label','카드사 이름');
   if(!other)vendor.value=select.value;
  }else{
   if(!host.hidden)vendor.value=ordinaryValue;
   host.hidden=true;select.required=false;vendor.hidden=false;vendor.required=true;vendor.placeholder=ordinaryPlaceholder;vendor.setAttribute('aria-label',ordinaryAria);label.textContent='사용처 / 내용';label.htmlFor=vendor.id;
  }
  lastCategory=form.querySelector('[name=category]:checked')?.value;
 }
 form.addEventListener('change',e=>{if(e.target.name==='category'){update(true);if(!host.hidden)select.focus({preventScroll:true});}if(e.target===select){if(select.value==='__other')vendor.value='';update();if(select.value==='__other')vendor.focus({preventScroll:true});}});
 update(true);
}
const openEntryBeforePayments=openEntry;
openEntry=function(...args){openEntryBeforePayments(...args);expenseCardSelector();};
function paymentRuleRow(rule){
 const type=rule.type||'card',other=type==='other',card=type==='card';
 return '<fieldset class="payment-rule-editor" data-rule-id="'+esc(rule.id)+'"><div class="payment-rule-editor-head"><strong>'+esc(rule.name||(card?'카드 결제일':'정기 납부'))+'</strong><button type="button" class="icon-button" data-action="payment-remove-rule" data-id="'+esc(rule.id)+'" aria-label="납부 항목 삭제">'+icon('trash')+'</button></div><div class="payment-rule-grid"><label>항목<select data-field="type"><option value="rent" '+(type==='rent'?'selected':'')+'>임대료</option><option value="card" '+(card?'selected':'')+'>카드 대금</option><option value="other" '+(other?'selected':'')+'>기타 정기 비용</option></select></label>'+(card?'<label>카드사<select data-field="card" required><option value="">카드사 선택</option>'+[...new Set([...PAYMENT_CARD_COMPANIES,...(rule.card?[rule.card]:[])])].map(name=>'<option value="'+esc(name)+'" '+(rule.card===name?'selected':'')+'>'+esc(name)+'</option>').join('')+'</select></label>':other?'<label>항목·사용처 이름<input data-field="name" value="'+esc(rule.name||'')+'" maxlength="60" required></label>':'<div class="payment-rent-hint">'+icon('bank')+'매월 임대료</div>')+'<label>매월 납부일<select data-field="day">'+Array.from({length:31},(_,i)=>i+1).map(n=>'<option value="'+n+'" '+(Number(rule.day||1)===n?'selected':'')+'>'+n+'일'+(n===31?' · 말일':'')+'</option>').join('')+'</select></label><label>예상 금액 · 선택<input data-field="amount" inputmode="numeric" data-money value="'+(rule.amount?fmt(rule.amount):'')+'" placeholder="변동 금액은 비워두세요"></label></div><label class="payment-rule-active"><input type="checkbox" data-field="active" '+(rule.active!==false?'checked':'')+'>알림 사용</label></fieldset>';
}
function readPaymentRule(row){
 const value=field=>row.querySelector('[data-field="'+field+'"]')?.value;
 return{id:row.dataset.ruleId,type:value('type'),name:value('name')||'',card:value('card')||'',day:Number(value('day')),amount:num(value('amount')),active:row.querySelector('[data-field=active]').checked};
}
function openPaymentSettings(){
 if(db.connection?.paymentReady===false||db.connection?.paymentSettingsError){
  toast('납부 설정을 먼저 불러와야 해요. 홈에서 다시 시도해 주세요.');return;
 }
 let config;try{config=paymentConfig();}catch{config={rules:[],closedDays:[]};}
 sheet('매월 납부일 설정','<p class="payment-settings-intro">주말·공휴일은 다음 영업일로 옮깁니다. 비용에 입력된 내역과 연결해 납부 상태를 표시합니다.</p><div id="payment-rules-list">'+config.rules.map(paymentRuleRow).join('')+'</div><button type="button" class="secondary full" data-action="payment-add-rule">'+icon('plus')+'납부 항목 추가</button><details class="payment-calendar-options"><summary>임시휴일 추가 '+icon('down')+'</summary>'+field('추가 휴일 · 한 줄에 날짜 1개','<textarea name="closed-days" rows="3" placeholder="예: 2026-12-31">'+esc(config.closedDays.join('\n'))+'</textarea>')+'<p class="field-note">2026·2027년 공휴일·대체공휴일 반영 ('+PAYMENT_CALENDAR_CHECKED+' 확인). 추가 지정되는 임시공휴일은 여기에서 등록할 수 있어요.</p></details><p class="field-note spacer">31일이 없는 달은 그달 말일 기준입니다. 카드사는 카드별 실제 결제일을 입력해 주세요. 이 설정은 이체를 실행하지 않습니다.</p>','<button type="submit" class="primary">'+icon('check')+'납부일 적용</button>',{name:'payment-settings',form:'payment-settings-form'});
}
function openPaymentDetail(key){
 const item=paymentItems().find(i=>i.key===key);if(!item)return;
 const paid=item.status==='paid';
 sheet('정기 납부 확인','<div class="payment-detail-status is-'+item.status+'">'+icon(paid?'check':'clock')+'<span>'+paymentStateLabel[item.status]+'</span><strong>'+esc(item.rule.name)+'</strong></div><div class="payment-detail-lines"><div><span>예정 납부일</span><strong>'+item.due.replaceAll('-','.')+' '+weekday(item.due)+'</strong></div>'+(item.adjusted?'<div><span>휴일 조정 전</span><strong>'+item.nominal.replaceAll('-','.')+'</strong></div>':'')+'<div><span>예상 금액</span><strong>'+(item.rule.amount?won(item.rule.amount):'미정 · 변동 금액')+'</strong></div><div><span>비용 입력 합계</span><strong>'+won(item.paidAmount)+'</strong></div>'+(item.status==='partial'?'<div><span>남은 금액</span><strong>'+won(item.remaining)+'</strong></div>':'')+'</div><p class="field-note">비용 입력 기준입니다. 은행 자동이체 완료를 조회한 표시는 아닙니다. 매월 '+item.rule.day+'일'+(item.rule.day===31?' (없는 달은 말일)':'')+' · 해당 월 '+item.month+'</p>'+(item.records.length?'<h3 class="spacer">연결된 비용</h3><div class="payment-linked-records">'+item.records.map(e=>'<button type="button" class="secondary full" data-action="edit-record" data-type="expense" data-id="'+esc(e.id)+'">'+esc(e.vendor||e.category)+' · '+md(e.date)+' · '+won(e.amount)+icon('right')+'</button>').join(''):'')+(!item.calendarVerified?'<p class="production-notice">해당 연도의 공휴일 자료 확인이 필요합니다. 실제 납부일을 확인해 주세요.</p>':''),'<button type="button" class="secondary" data-action="payment-settings">납부일 설정</button>'+(!paid?'<button type="button" class="primary" data-action="payment-enter" data-id="'+esc(key)+'">비용 입력</button>':'<button type="button" class="primary" data-action="close-modal">확인</button>'),{name:'payment-detail'});
}
function paymentEnterExpense(key){
 const item=paymentItems().find(i=>i.key===key);if(!item)return;
 openEntry('expense','',TODAY);const form=$('#entry-form'),category=item.rule.type==='rent'?'임대료':item.rule.type==='card'?'카드 대금':'기타';
 const radio=[...form.querySelectorAll('[name=category]')].find(e=>e.value===category);radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));
 const select=form.querySelector('#expense-card-company'),vendor=form.querySelector('[name=vendor]');
 if(item.rule.type==='card'){select.value=PAYMENT_CARD_COMPANIES.includes(item.rule.card)?item.rule.card:'__other';select.dispatchEvent(new Event('change',{bubbles:true}));vendor.value=item.rule.card;}else vendor.value=item.rule.name;
 form.querySelector('[name=note]').value='정기 납부 · '+item.month.replace('-','년 ')+'월';form.insertAdjacentHTML('beforeend','<input type="hidden" name="payment-link" value="'+esc(paymentTag(item.rule.id,item.month))+'">');
 const amount=form.querySelector('#entry-amount');amount.value=item.rule.amount?fmt(item.remaining||item.rule.amount):'0';amount.focus({preventScroll:true});amount.select();
}
const homeBeforePayments=renderToday;
renderToday=()=>homeBeforePayments().replace('<section class="today-tiles"',paymentBanner()+'<section class="today-tiles"');
const renderBeforePayments=render;
render=function(){renderBeforePayments();paymentStartTicker();};
const settingsBeforePayments=openSettings;
openSettings=function(...args){settingsBeforePayments(...args);$('.setting-buttons')?.insertAdjacentHTML('afterbegin','<button type="button" class="secondary" data-action="payment-settings">'+icon('calendar')+'매월 납부일 설정</button>');};
const actionBeforePayments=action;
action=function(el){
 const a=el.dataset.action;
 if(productionBusy)return;
 if(a==='payment-settings'){openPaymentSettings();return;}
 if(a==='payment-detail'){openPaymentDetail(el.dataset.id);return;}
 if(a==='payment-enter'){paymentEnterExpense(el.dataset.id);return;}
 if(a==='payment-next'){paymentUi.index=(paymentUi.index+1)%Math.max(1,paymentItems().length);const root=$('#payment-roll');if(root)root.innerHTML=paymentBannerContent();return;}
 if(a==='payment-pause'){paymentUi.paused=!paymentUi.paused;const root=$('#payment-roll');if(root)root.innerHTML=paymentBannerContent();return;}
 if(a==='payment-add-rule'){const list=$('#payment-rules-list');if(list.children.length>=50)return showError('최대 50개까지 등록할 수 있습니다.');list.insertAdjacentHTML('beforeend',paymentRuleRow({id:uid('pay'),type:'card',name:'',card:'',day:1,amount:0,active:true}));list.lastElementChild.scrollIntoView({block:'nearest'});return;}
 if(a==='payment-remove-rule'){const row=[...$$('.payment-rule-editor')].find(r=>r.dataset.ruleId===el.dataset.id);row?.remove();return;}
 return actionBeforePayments(el);
};
const submitBeforePayments=submitForm;
submitForm=async function(form){
 if(form.id!=='payment-settings-form')return submitBeforePayments(form);
 try{
  const config=paymentValidateConfig({rules:[...form.querySelectorAll('.payment-rule-editor')].map(readPaymentRule),closedDays:form.querySelector('[name=closed-days]').value.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean)});
  return productionWrite('payment-rules',config,'매월 납부일을 서버에 저장했어요.');
 }catch(error){showError(error.message);}
};
document.addEventListener('change',e=>{if(e.target.matches('.payment-rule-editor [data-field=type]')){const row=e.target.closest('.payment-rule-editor'),r=readPaymentRule(row);if(r.type==='rent')r.name='임대료';else if(r.type==='card')r.name=r.card;row.outerHTML=paymentRuleRow(r);}});

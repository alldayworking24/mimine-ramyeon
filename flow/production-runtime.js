/* This adapter replaces every prototype write with an authenticated server operation. */
let productionBusy=false,productionClosing=false,productionRefreshing=false,productionRevision=0;
const productionBridge=window.MimineBridge;
function productionCategories(){return[...new Set(['라면','컵라면','음료','토핑','기타',...db.products.map(p=>p.category)])];}
function requestId(){if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
function preferenceSave(){try{localStorage.setItem('mimine-flow-preferences',JSON.stringify({goal:db.goal,largeType:!!db.settings.largeType}));}catch{}}
persist=preferenceSave;
notifyMutation=function(message){preferenceSave();render();toast(message);};
saveSupplyData=function(){throw new Error('서버 저장 경로가 필요한 요청입니다.');};
const productionClose=closeModal;
closeModal=function(){if(productionBusy&&!productionClosing)return;return productionClose();};
function applyProductionSnapshot(next){db=next;render();}
async function refreshProduction(silent=false){
 if(productionBusy||productionRefreshing||modalName)return;
 productionRefreshing=true;const revision=productionRevision;
 try{const next=await productionBridge.snapshot();if(revision!==productionRevision||productionBusy||modalName)return;applyProductionSnapshot(next);if(!silent)toast('최신 내역을 불러왔어요.');}
 catch(error){toast('불러오기 실패: '+error.message);}
 finally{productionRefreshing=false;}
}
async function productionWrite(command,payload,message,after){
 if(productionBusy)return false;
 productionBusy=true;productionRevision++;const buttons=$$('.sheet button');buttons.forEach(b=>b.disabled=true);
 try{
  const result=await productionBridge.invoke(command,payload);
  let next;
  try{next=await productionBridge.snapshot();}
  catch(error){productionClosing=true;closeModal();productionClosing=false;toast('저장은 완료됐지만 최신 내역을 불러오지 못했어요. 설정에서 새로고침해 주세요.');return true;}
  productionClosing=true;closeModal();productionClosing=false;applyProductionSnapshot(next);
  if(result?.warning){sheet('정산정보 확인 필요',`<p>${esc(result.warning)}</p>`,'<button class="secondary" data-action="close-modal">확인</button>',{name:'save-warning'});}
  else{message=productionBridge.isDemo?message.replaceAll('서버에','미리보기에'):message;toast(result?.duplicate?'이미 저장된 요청입니다. 중복 반영하지 않았어요.':message);after?.(result);}
  return true;
 }catch(error){if($('#form-error'))showError(error.message||'서버에 저장하지 못했어요.');else toast(error.message||'서버에 저장하지 못했어요.');return false;}
 finally{productionBusy=false;productionClosing=false;buttons.forEach(b=>b.disabled=false);}
}
const productionRender=render;
render=function(){
 productionRender();
 const c=db.connection||{},messages=[];
 if(c.imageError)messages.push('상품 사진을 불러오지 못했어요. 기본 아이콘으로 표시합니다. '+c.imageError);
 if(c.stockError)messages.push('영수증 저장 서버 준비가 필요합니다. '+c.stockError);
 if(c.truncated)messages.push('입금 조회 한도를 초과해 일부 내역만 불러왔습니다. 합계를 확정값으로 사용하지 마세요.');
 if(messages.length)$('#main').insertAdjacentHTML('afterbegin',`<div class="production-notice" role="status">${messages.map(esc).join('<br>')}</div>`);
 if(productionBridge.isDemo){$('.sidebar-note').textContent='가상 데이터 미리보기';$('.desktop-footer span').textContent='미리보기 변경은 새로 열면 초기화됩니다.';}
 $('.demo-badge').innerHTML=productionBridge.isDemo?'<i></i> 미리보기':'<i></i> 매장 운영';
};
const productionBankRender=renderBank;
renderBank=function(){
 if(db.connection?.bankError)return heading('BANK','통장 입금','연결 상태를 확인해 주세요.')+`<section class="list-card production-bank-error"><h2>입금내역을 불러오지 못했어요.</h2><p>${esc(db.connection.bankError)}</p><button class="primary" data-action="production-refresh">다시 불러오기</button><button class="secondary" data-action="production-devices">수신폰·연결 관리</button></section>`;
 const bankNote=productionBridge.isDemo?'미리보기용 가상 입금입니다. 실제 입금 자동 수신은 운영 서버 연결 후 사용할 수 있습니다.':'하루온종일의 실제 문자 수신 내역입니다. 수신폰 전달이 작동하는 동안 앱을 닫아도 서버에 저장됩니다. 화면은 60초마다 갱신합니다. 최근 5년 범위에서 조회합니다.';
 return productionBankRender().replace('이 목업은 수신 체험 데이터로 동작합니다. 실제 자동 수신은 하루온종일의 문자 수신 서버 연결이 필요합니다.',bankNote).replace(/<button class="text-button" data-action="sms-demo">[\s\S]*?<\/button>/,'<button class="text-button" data-action="production-refresh">새로고침</button>');
};
openSettings=function(){sheet('설정·연결',`<div class="settings-row"><div><strong>큰 글씨</strong><small>글자를 조금 더 크게 표시합니다.</small></div><button class="switch" role="switch" aria-label="큰 글씨" aria-checked="${!!db.settings.largeType}" data-action="toggle-large"></button></div><div class="setting-buttons"><button class="secondary" data-action="production-refresh">${icon('refresh')}최신 내역 불러오기</button><button class="secondary" data-action="production-devices">${icon('bank')}입금 수신폰·연결 관리</button><button class="secondary" data-action="production-legacy">${icon('box')}상품 사진·분류·기존 관리</button><button class="secondary" data-action="export">${icon('download')}장부 CSV 내려받기</button><button class="danger-btn" data-action="production-logout">로그아웃</button></div><div class="settings-note">${productionBridge.isDemo?'미리보기 변경은 새로 열면 초기화됩니다.':'매출·비용·상품·입금은 서버에 저장합니다.'} 키오스크 매출 자동 수집과 상품별 판매 자동 차감은 연결되지 않았습니다.</div>`,'<button class="secondary" data-action="close-modal">닫기</button>',{name:'settings'});};
openPayerRules=function(){sheet('입금자명 자동 등록',`<p class="supply-intro">문자에 표시된 이름을 사업에 연결합니다. 한 사업에 여러 입금자명을 등록할 수 있어요.</p><div class="payer-rule-form">${field('연결할 사업','<select name="business"><option value="mimine">미미네</option><option value="adw">하루온종일</option><option value="other">기타</option></select>')}${field('문자에 표시된 입금자명','<input name="payer" maxlength="100" placeholder="입금 문자에 나온 이름" required>')}${field('구분 메모 · 선택','<input name="label" maxlength="80">')}<button class="primary full" type="submit">입금자명 등록</button></div><h3 class="payer-list-heading">등록한 입금자명</h3><div class="payer-rule-list">${db.payerRules.map(r=>`<div class="payer-rule-row"><div><strong>${esc(r.payer)}</strong><small>${businessName(r.business)}${r.label?' · '+esc(r.label):''}</small></div><button type="button" class="rule-toggle ${r.active?'':'paused'}" data-action="toggle-payer-rule" data-id="${r.id}">${r.active?'사용 중지':'다시 사용'}</button></div>`).join('')||'<p class="field-note">등록한 입금자명이 없어요.</p>'}</div><p class="field-note spacer">새 입금은 이름이 일치하면 서버에서 자동 분류합니다. 정산일·금액까지 유일하게 맞으면 정산도 연결합니다. 하루온종일 업체에 연결된 이름은 미미네로 중복 등록하지 않습니다. 사용 중지해도 기존 내역은 유지합니다.</p>`,'<button type="button" class="secondary" data-action="close-modal">닫기</button>',{name:'payer-rules',form:'payer-rule-form'});};
const productionOpenEntry=openEntry;
openEntry=function(...args){productionOpenEntry(...args);modalContext.requestId=requestId();};
saveEntry=async function(form){
 const fd=new FormData(form),type=modalContext.entryType,date=String(fd.get('date')),amount=num(fd.get('entry-amount'));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>TODAY)return showError('오늘까지의 날짜를 입력해 주세요.');
 if(amount>999999999||(type==='expense'&&amount<=0))return showError('금액 범위를 확인해 주세요.');
 if(type==='sale'){
  const old=saleOn(date);let settlement=null;
  if(modalContext.split){settlement={card:num(fd.get('card')),cash:num(fd.get('cash')),other:num(fd.get('other')),fee:num(fd.get('fee')),dueDate:String(fd.get('due')||''),note:String(fd.get('note')||'')};}
  else if(old?.settlementKnown){
   if(old.settlementConsistent===false)return showError('기존 정산정보가 일매출과 다릅니다. 결제수단을 열어 합계를 맞춰 주세요.');
   settlement={card:amount-old.cash-old.other,cash:old.cash,other:old.other,fee:old.fee,dueDate:old.due,note:String(fd.get('note')||'')};
  }
  if(settlement){if(settlement.card<0||settlement.card+settlement.cash+settlement.other!==amount)return showError('카드·현금·기타 합계를 총매출과 맞춰 주세요.');if(settlement.fee>settlement.card)return showError('수수료는 카드 매출보다 클 수 없어요.');if(old&&linked(old)>settlement.card-settlement.fee)return showError('연결된 입금보다 정산액이 작습니다. 정산 연결을 먼저 해제해 주세요.');}
  view.date=date;return productionWrite('sale',{date,amount,note:String(fd.get('note')||''),settlement},'매출을 서버에 저장했어요.');
 }
 const vendor=String(fd.get('vendor')||'').trim();if(!vendor)return showError('사용처나 내용을 입력해 주세요.');
 return productionWrite('expense',{requestId:modalContext.requestId,id:modalContext.id||'',date,amount,category:String(fd.get('category')||'기타'),vendor,note:paymentComposeNote(fd.get('note'),fd.get('payment-link'))},'비용을 서버에 저장했어요.');
};
const productionProductForm=openProductForm;
openProductForm=function(...args){productionProductForm(...args);modalContext.requestId=requestId();};
const productionInboundForm=openInbound;
openInbound=function(...args){productionInboundForm(...args);modalContext.requestId=requestId();};
saveProductSupply=async function(form){const fd=new FormData(form),item={productId:modalContext.productId||'',name:String(fd.get('name')||'').trim(),barcode:String(fd.get('barcode')||'').trim(),category:String(fd.get('category')),cost:num(fd.get('cost')),price:num(fd.get('price')),qty:modalContext.productId?0:num(fd.get('qty')),expiry:String(fd.get('expiry')||''),min:num(fd.get('min'))};if(!item.name||!item.price)return showError('상품명과 판매가를 입력해 주세요.');return productionWrite('stock',{requestId:modalContext.requestId,document:{type:'product',date:TODAY,supplier:String(fd.get('supplier')||''),items:[item],addExpense:false}},'상품을 저장했어요. 다음 입고에 이 판매가를 불러옵니다.');};
saveInboundSupply=async function(form){const fd=new FormData(form),item={productId:modalContext.productId,qty:num(fd.get('qty')),cost:num(fd.get('cost')),price:num(fd.get('price')),expiry:String(fd.get('expiry')||'')};if(!item.qty||!item.price)return showError('수량과 판매가를 입력해 주세요.');return productionWrite('stock',{requestId:modalContext.requestId,document:{type:'inbound',date:String(fd.get('date')),supplier:String(fd.get('supplier')||''),items:[item],addExpense:fd.get('addExpense')==='on'}},'입고와 직전 판매가를 서버에 저장했어요.');};
saveReceiptImport=async function(){
 syncReceiptFields();const r=supply.receipt,t=receiptReviewTotal();if(!t.items.length)return showError('입고할 품목을 선택해 주세요.');
 for(const i of t.items)if(!i.name.trim()||!Number.isInteger(i.qty)||i.qty<1||!i.salePrice||!i.unitCost)return showError('상품명·원가·판매가·수량을 확인해 주세요.');
 const total=num($('#receipt-grand-total').value);if(!total)return showError('영수증 합계를 확인해 주세요.');
 if(total!==t.total&&!$('#receipt-adjustment-ok').checked)return showError('상품 합계와 영수증 합계 차이를 확인해 주세요.');
 r.requestId??=requestId();
 return productionWrite('stock',{requestId:r.requestId,document:{type:'receipt',date:r.date,supplier:r.supplier,total,adjustmentConfirmed:$('#receipt-adjustment-ok').checked,addExpense:$('#receipt-add-expense').checked,fingerprint:r.imageFingerprint,imageData:r.imageData,rawText:r.rawText,items:t.items.map(i=>({productId:i.productId,name:i.name,cost:i.unitCost,price:i.salePrice,qty:i.qty,expiry:i.expiry,category:'기타',min:10}))}},`${t.items.length}종 ${t.qty}개 입고를 저장했어요.`,()=>supply.receipt=null);
};
saveMatch=async function(form){const fd=new FormData(form),s=db.sales.find(s=>s.id===modalContext.saleId),e=db.events.find(e=>e.id===fd.get('match-event')),amount=num(fd.get('match-amount'));if(!e||!s||e.excluded||!amount)return showError('입금·금액을 확인해 주세요.');return productionWrite('bank',{action:'allocate',eventId:e.id,saleDate:s.date,amount:amount+sum(db.links.filter(l=>l.eventId===e.id&&l.saleId===s.id))},'정산을 연결했어요.');};
restoreDeposit=async function(id){return productionWrite('bank',{action:'exclude',eventId:id,excluded:false},'대상 제외를 해제했어요. 과거 정산 연결은 자동 복구하지 않습니다.');};
autoMatch=async function(){return productionWrite('bank',{action:'autoMatch'},'자동 매칭을 실행했어요. 입금 연결 결과를 확인해 주세요.');};
deleteRecord=function(id,type){const r=(type==='sale'?db.sales:db.expenses).find(r=>r.id===id);if(!r)return;if(type==='sale'&&linked(r))return showError('입금 연결을 먼저 해제해 주세요.');sheet('이 기록을 삭제할까요?',`<p>${r.date} · ${won(r.amount)} ${type==='sale'?'매출':'비용'} 기록을 서버에서 삭제합니다.</p>`,'<button class="secondary" data-action="close-modal">취소</button><button class="danger-btn" data-action="production-delete">삭제</button>',{name:'production-delete'});modalContext={deleteId:id,deleteType:type};};
const productionSubmitFallback=submitForm;
submitForm=async function(form){
 const fd=new FormData(form);
 switch(form.id){
 case'entry-form':return saveEntry(form);
 case'supply-product-form':return saveProductSupply(form);
 case'supply-inbound-form':return saveInboundSupply(form);
 case'receipt-review-form':return saveReceiptImport();
 case'match-form':return saveMatch(form);
 case'payer-rule-form':return productionWrite('bank',{action:'alias',payer:String(fd.get('payer')||'').trim(),business:String(fd.get('business')),label:String(fd.get('label')||''),active:true},'입금자명을 등록했어요.',openPayerRules);
 case'classify-form':return productionWrite('bank',{action:'classify',eventId:modalContext.eventId,business:String(fd.get('business')),category:String(fd.get('business'))==='mimine'?'settlement':'other',note:String(fd.get('note')||'')},'사업 구분을 저장했어요.');
 case'exclude-deposit-form':return productionWrite('bank',{action:'exclude',eventId:modalContext.excludeEventId,excluded:true,reason:String(fd.get('reason')),memo:String(fd.get('memo')||'')},'정산 대상에서 제외했어요.');
 case'adjust-form':return productionWrite('stocktake',{productId:modalContext.productId,qty:num(fd.get('qty')),reason:String(fd.get('reason')||'재고 확인')},'실제 재고 수량을 저장했어요.');
 case'product-form':case'inbound-form':case'sample-bank-form':case'sms-demo-form':return showError('운영 화면에서는 사용할 수 없는 요청입니다.');
 default:return productionSubmitFallback(form);
 }
};
const productionActionFallback=action;
action=function(el){
 const{action:a,id}=el.dataset;
 if(productionBusy)return;
 switch(a){
 case'production-refresh':closeModal();void refreshProduction();return;
 case'production-devices':closeModal();productionBridge.legacy('devices');return;
 case'production-legacy':closeModal();productionBridge.legacy('products');return;
 case'production-logout':closeModal();void productionBridge.logout();return;
 case'production-delete':{const type=modalContext.deleteType,r=(type==='sale'?db.sales:db.expenses).find(r=>r.id===modalContext.deleteId);if(r)void productionWrite('delete',{type,id:r.remoteId||r.id,date:r.date},'기록을 삭제했어요.');return;}
 case'toggle-payer-rule':{const r=db.payerRules.find(r=>r.id===id);if(r)void productionWrite('bank',{action:'alias',id:r.id,payer:r.payer,business:r.business,label:r.label,active:!r.active},r.active?'자동 등록을 중지했어요.':'자동 등록을 다시 사용해요.',openPayerRules);return;}
 case'unlink':{const l=db.links.find(l=>l.id===id),s=l&&db.sales.find(s=>s.id===l.saleId);if(l&&s)void productionWrite('bank',{action:'allocate',eventId:l.eventId,saleDate:s.date,amount:0},'정산 연결을 해제했어요. 자동 재연결은 보류됩니다.');return;}
 case'reset-data':case'reset-confirm':case'sample-bank':case'sms-demo':case'barcode-sample':case'receipt-sample':case'toggle-auto':case'undo':toast('운영 화면에서는 제공하지 않는 기능입니다.');return;
 default:return productionActionFallback(el);
 }
};
const originalDayDetail=openDayDetail;
openDayDetail=function(date){originalDayDetail(date);const sale=saleOn(date);if(sale&&!sale.settlementKnown){const box=$('.day-payment-summary');if(box)box.innerHTML='<h3>결제수단</h3><p class="field-note">결제수단·정산정보가 아직 등록되지 않았습니다.</p>';}else if(sale?.settlementConsistent===false){$('.sheet-body').insertAdjacentHTML('afterbegin','<p class="production-notice">일매출과 정산정보의 합계가 다릅니다. 결제수단을 확인해 주세요.</p>');}};
saleStatus=function(s){if(!s.settlementKnown)return'정산정보 미등록';if(s.settlementConsistent===false)return'정산 합계 확인';if(!s.card)return'현금·기타 매출';if(!s.due)return'예정일 미등록';if(!remaining(s))return'입금 완료';if(linked(s))return'일부 입금';return s.due<=TODAY?'확인 필요':'입금 예정';};
const launchPage=productionBridge.launch;if(['sales','expenses','all'].includes(launchPage)){view.page='ledger';view.ledgerType=launchPage==='sales'?'sale':launchPage==='expenses'?'expense':'all';}else if(launchPage==='products')view.page='products';
window.MimineFlowRefresh=()=>refreshProduction(true);
setInterval(()=>{if(!document.hidden&&!modalName)void refreshProduction(true);},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!modalName)void refreshProduction(true);});
render();

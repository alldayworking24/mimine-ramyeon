/* Shared, locally bundled SVG icons keep action meanings consistent. */
Object.assign(iconPaths,{
 businessAll:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 unclassified:'<path d="M3 13h5l2 3h4l2-3h5v7H3v-7Zm0 0 3-8h3m12 8-3-8h-3"/><path d="M10 5a2 2 0 1 1 3 1.7c-.7.3-1 .8-1 1.8M12 11h.01"/>',
 login:'<path d="M15 3h5v18h-5M3 12h13m-4-4 4 4-4 4"/>',
 save:'<path d="M5 3h12l4 4v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M7 3v6h10V3M7 21v-8h10v8M14 5v2"/>',
 camera:'<path d="M8 5 10 2h4l2 3h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/>',
 barcode:'<path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 7v10M10 7v10M14 7v10M17 7v10"/>',
 receipt:'<path d="M5 3 7 4l2-1 3 1 3-1 2 1 2-1v18l-2-1-2 1-3-1-3 1-2-1-2 1Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 packagePlus:'<path d="m3 7 8-4 8 4-8 4-8-4Zm0 0v11l8 4V11M19 7v5M6.5 5.2l8 4M16 18h6M19 15v6"/>',
 stock:'<path d="M3 21h18M4 21V8l8-5 8 5v13M8 21v-7h8v7M8 10h8M12 14v7"/>',
 logout:'<path d="M9 3H4v18h5M9 12h12m-4-4 4 4-4 4"/>',
 pause:'<circle cx="12" cy="12" r="9"/><path d="M9 8v8M15 8v8"/>',
 play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/>',
 ban:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
 undo:'<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',
 compare:'<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
 filter:'<path d="M4 5h16l-6 7v7l-4 2v-9L4 5Z"/>',
 card:'<rect x="2" y="5" width="20" height="15" rx="3"/><path d="M2 10h20M6 15h3M12 15h2"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',
 clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h6"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
 calendarWeek:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h10M7 17h10"/>',
 calendarYear:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M12 14h2M17 14h.01M7 18h2M12 18h2M17 18h.01"/>',
 sliders:'<path d="M4 7h7M15 7h5M4 17h3M11 17h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'
});
const BUSINESS_LOGOS={mimine:'__LOGO__',adw:'__ADW_LOGO__'};
const PERIOD_ICON_NAMES={today:'sun',week:'calendarWeek',month:'calendar',lastMonth:'calendar',year:'calendarYear',custom:'sliders'};
function periodIconName(value){return PERIOD_ICON_NAMES[value]||'calendar';}
function businessFilterVisual(value){return BUSINESS_LOGOS[value]?`<img class="business-brand-image" src="${BUSINESS_LOGOS[value]}" alt="" draggable="false">`:icon(value==='unclassified'?'unclassified':'businessAll');}
const ACTION_ICON_SPECS={
 'payment-settings':['calendar','납부일 설정'],'payment-add-rule':['plus','납부 항목 추가'],'payment-enter':['expense','비용 입력'],
 export:['download','내보내기','tile'], 'product-new':['packagePlus','상품 등록','tile'],
 'product-barcode-scan':['barcode','바코드 스캔으로 자동 입력'],'barcode-open':['barcode','바코드'], 'barcode-camera':['camera','카메라'],
 'receipt-open':['receipt','영수증'], 'receipt-history':['clock','입고 기록'],
 'receipt-add-item':['plus','품목 추가'], 'receipt-paste':['clipboard','직접 입력'],
 inbound:['packagePlus','입고'], 'product-edit':['edit','상품 수정'], 'adjust-stock':['stock','재고 조정'],
 'production-refresh':['refresh','새로고침'], 'production-devices':['bank','수신폰 연결'],
 'production-legacy':['box','상품 관리'], 'production-logout':['logout','로그아웃'],
 'bank-settings':['settings','연결 설정'], 'payer-rules':['tag','입금자명'],
 classify:['tag','분류'], 'exclude-deposit':['ban','대상 제외'], 'include-deposit':['undo','제외 해제'],
 'auto-match':['link','자동 연결'], match:['link',null], unlink:['link','연결 해제'],
 'delete-record':['trash','삭제'], 'production-delete':['trash','삭제'], 'reset-confirm':['trash','초기화'], 'reset-data':['trash','초기화'],
 'day-edit-sale':['edit','매출 수정'], 'day-add-cost':['plus','비용 등록'],
 'forecast-help':['info','계산 방법'], 'flow-compare':['compare',null], 'flow-show-all':['list',null],
 'toggle-split':['card','결제수단·정산정보'], 'amount-reset':['trash','지우기'],
 'pick-today':['sun','오늘'], 'goal':['edit','목표 수정'], undo:['undo','되돌리기'],
 'sample-bank':['plus','입금 체험'], 'sms-demo':['refresh','새로고침']
};
const FORM_ICON_SPECS={
 'payment-settings-form':['check','납부일 적용'],
 'auth-form':['login','로그인'],
 'flow-range-form':['calendar','적용'],'range-form':['calendar','적용'],'deposit-range-form':['calendar','적용'],'date-form':['calendar','날짜 보기'],
 'entry-form':['save','저장'],'goal-form':['save','목표 저장'],'match-form':['link','입금 연결'],'classify-form':['tag','분류 저장'],
 'sample-bank-form':['plus','내역 추가'],'sms-demo-form':['bank','문자 체험'],'payer-rule-form':['tag','입금자명 등록'],
 'product-form':['save','상품 저장'],'supply-product-form':['save','상품 저장'],'inbound-form':['packagePlus','입고'],'supply-inbound-form':['packagePlus','입고'],
 'adjust-form':['stock','재고 적용'],'barcode-lookup-form':['search','상품 찾기'],'receipt-paste-form':['list','품목 나누기'],
 'receipt-review-form':['packagePlus','확인 후 입고'],'exclude-deposit-form':['ban','대상 제외']
};
function buttonIconSpec({action='',value='',text='',type='',className='',formId=''}){
 if(type==='submit'){const spec=FORM_ICON_SPECS[formId]||['save',text||'저장'];return{icon:spec[0],label:formId==='entry-form'?'':spec[1],variant:formId==='entry-form'?'only':'inline'};}
 if(action==='day-edit-sale')return{icon:/수정/.test(text)?'edit':'plus',label:/수정/.test(text)?'매출 수정':'매출 등록',variant:'inline'};
 if(action==='close-modal')return{icon:/확인/.test(text)?'check':'close',label:text||'닫기',variant:'inline'};
 if(action==='toggle-payer-rule')return{icon:/사용 중지/.test(text)?'pause':'play',label:/사용 중지/.test(text)?'사용 중지':'다시 사용',variant:'inline'};
 if(action==='entry')return{icon:'plus',label:/지출|비용/.test(text)?'비용 등록':'매출 등록',variant:'inline'};
 if(action==='entry-type'||action==='ledger-type')return{icon:value==='all'?'list':value==='expense'?'expense':'sales',label:text,variant:'filter'};
 if(['flow-period','range','report-range','deposit-period'].includes(action))return{icon:periodIconName(value),label:text,variant:'period'};
 if(action==='annual-metric')return{icon:value==='cost'?'expense':value==='balance'?'chart':'sales',label:text,variant:'filter'};
 if(action==='product-filter')return{icon:value==='low'?'alert':value==='expiry'?'clock':'box',label:text,variant:'filter'};
 if(action==='bank-tab')return{icon:value==='compare'?'card':'bank',label:text,variant:'inline'};
 if(['bank-filter','bank-scope'].includes(action))return{icon:'filter',label:text,variant:'filter'};
 const spec=ACTION_ICON_SPECS[action];return spec?{icon:spec[0],label:spec[1]||text,variant:spec[2]||'inline'}:null;
}
function applyMimineActionIcons(root=document){
 for(const button of root.querySelectorAll('button')){
  if(button.dataset.iconified||button.matches('.icon-button,[role="switch"],.switch,.record-row,.product-card,.receipt-history-row,.revenue-shortcut,.sales-summary-shortcut,.nav-item,.today-tile')||button.closest('#mobile-nav'))continue;
  if(button.dataset.action==='business-filter'){
   const value=button.dataset.value,label=({all:'전체 사업',mimine:'미미네',adw:'하루온종일',unclassified:'미분류'})[value]||'전체 사업';
   button.classList.add('business-logo-button');button.dataset.iconified='1';button.dataset.iconName='business-'+value;
   button.setAttribute('aria-label',label);button.setAttribute('title',label);button.setAttribute('aria-pressed',String(button.classList.contains('active')));button.innerHTML=businessFilterVisual(value);continue;
  }
  const raw=button.textContent.replace(/\s+/g,' ').trim()||button.getAttribute('aria-label')||'';
  const value=button.dataset.value||button.dataset.range||button.dataset.type||'';
  const spec=buttonIconSpec({action:button.dataset.action,value,text:raw,type:button.getAttribute('type')||'',className:button.className,formId:button.closest('form')?.id||''});
  if(!spec||!raw)continue;
  const accessible=button.getAttribute('aria-label')||raw;
  button.setAttribute('aria-label',accessible);button.setAttribute('title',accessible);
  button.classList.add('ui-icon-action');button.classList.add('ui-icon-'+spec.variant);button.dataset.iconified='1';button.dataset.iconName=spec.icon;
  button.innerHTML=icon(spec.icon)+(spec.variant==='only'?'':`<span class="ui-action-label">${esc(spec.variant==='filter'?spec.label.replace(/([가-힣])(\d+)$/,'$1 $2'):spec.label)}</span>`);
 }
}
const renderBeforeActionIcons=render;
render=function(){renderBeforeActionIcons();applyMimineActionIcons($('#main'));};
const sheetBeforeActionIcons=sheet;
sheet=function(...args){sheetBeforeActionIcons(...args);applyMimineActionIcons($('#modal-root'));};
applyMimineActionIcons();

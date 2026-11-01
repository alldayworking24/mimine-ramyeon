/* Local-only redesign. Existing data actions and element IDs are preserved. */
'use strict';
function mountLayoutV2(){
 document.body.classList.add('mimine-v2');
 const $v=id=>document.getElementById(id);
 const nav=document.querySelector('.bottom-nav');
 const home=nav.querySelector('[data-panel="dashboard"]');home.lastChild.textContent='홈';nav.prepend(home);
 const more=nav.querySelector('[data-panel="all"]');more.dataset.panel='more';more.setAttribute('onclick',"openPanel('more')");more.lastChild.textContent='더보기';
 nav.querySelector('[data-panel="products"]').lastChild.textContent='상품';
 PANEL_ORDER.splice(0,PANEL_ORDER.length,'dashboard','sales','expenses','products','more');
 const brand=document.querySelector('.header .brand small');if(brand)brand.textContent='미미네 운영 관리';
 const panel=document.createElement('section');panel.id='more';panel.className='panel';panel.innerHTML=`<div class="section-head"><h2>더보기</h2><span>운영 관리</span></div><div class="v2-profile"><img src="mimine-face-logo.png" alt=""><div><strong>미미네 라면가게</strong><p>매출부터 입금까지 한곳에서</p></div></div><div class="v2-menu">${[['all','전체 장부','매출·지출을 날짜별로'],['transactions','통장내역','하루온종일과 같은 우리은행 통장'],['compare','매출·입금 비교','카드 정산액과 실제 입금'],['matching','자동 매칭','규칙·후보·연결 결과'],['devices','휴대폰 연결','입금 문자 수신폰 관리']].map(([v,t,d])=>`<button type="button" onclick="${v==='all'?"openPanel('all')":`openBank('${v}')`}"><span><strong>${t}</strong><small>${d}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div><section class="card v2-pos"><h3>키오스크 매출 연동</h3><span class="finance-badge">연결 전</span><p class="hint">현재는 직접 기록한 매출로 정산을 비교합니다. 자동 수집은 아직 연결되지 않았습니다.</p></section><p class="v2-version">전체 화면 개편 · 2026.11.02</p>`;document.querySelector('main').append(panel);
 const dash=$v('dashboard');
 const welcome=document.createElement('div');welcome.className='v2-welcome';welcome.innerHTML='<div><span class="v2-eyebrow">MIMINE · STORE MANAGER</span><h2>오늘도 맛있는 하루 되세요!</h2><p id="v2Date"></p></div><img src="mimine-face-logo.png" alt="미미네 라면가게">';dash.prepend(welcome);
 const metrics=dash.querySelector('.metrics'),hero=dash.querySelector('.hero'),bank=dash.querySelector('.bank-summary'),forecast=dash.querySelector('.monthly-forecast');
 const attention=document.createElement('div');attention.className='v2-attention';attention.innerHTML='<button onclick="openMissingSales()"><span>매출 미입력</span><strong id="v2Missing">—</strong><small>어제까지</small></button><button onclick="openPanel(\'products\')"><span>유통기한 확인</span><strong id="v2Expiry">—</strong><small id="v2ExpiryNote">입고 기록 기준</small></button><button onclick="openBank(\'transactions\')"><span>통장 미분류</span><strong id="v2Unclassified">—</strong><small>조회 기간 기준</small></button>';
 const top=document.createElement('div');top.className='v2-dashboard-top';[metrics,hero,attention,bank,forecast].filter(Boolean).forEach(n=>top.append(n));welcome.after(top);
 const reports=document.createElement('details');reports.className='v2-reports';reports.innerHTML='<summary>운영 분석·목표·전년 비교 <span>펼쳐보기</span></summary><div class="v2-report-content"></div>';
 for(const node of [...dash.children])if(![welcome,top].includes(node)&&node.id!=='dataLoadBanner')reports.lastElementChild.append(node);
 dash.append(reports);
 for(const id of ['sales','expenses']){
 const p=$v(id),head=p.querySelector(':scope > .section-head'),add=p.querySelector('.entry-add-btn');if(add&&head)head.append(add);
 if(id==='sales'){const fc=p.querySelector('.monthly-forecast');if(fc){const details=document.createElement('details');details.className='v2-reports';details.innerHTML='<summary>이달 말 예상 매출 <span>계산 내역</span></summary>';details.append(fc);p.append(details)}}
 }
 // Put working entries above historical analyses; keep those analyses available on demand.
 for(const id of ['sales','expenses']){
  const p=$v(id),first=p.querySelector(':scope > .card'),list=$v(id==='sales'?'salesList':'expensesList')?.closest('.section');
  if(first&&list)first.after(list);
  const comparisons=[...p.children].filter(n=>n.matches('.sales-monthly-yoy,.expenses-monthly-yoy,.expense-category-comparison')||(n.classList.contains('section')&&n.querySelector('#salesCompareCurrent')));
  const oldCompare=p.querySelector('#salesComparePrevious')?.closest('.section');if(oldCompare&&!comparisons.includes(oldCompare))comparisons.push(oldCompare);
  if(comparisons.length){const details=document.createElement('details');details.className='v2-reports';details.innerHTML='<summary>기간별 비교·운영 분석 <span>펼쳐보기</span></summary>';comparisons.forEach(n=>details.append(n));p.append(details);}
 }
 const allHead=$v('all').querySelector(':scope > .section-head');if(allHead){allHead.querySelector('h2').textContent='전체 장부';allHead.insertAdjacentHTML('afterbegin','<button class="icon-btn" aria-label="더보기로" onclick="openPanel(\'more\')">‹</button>');$v('all').prepend(allHead)}
 const stockHeader=$v('products').querySelector('.product-list-heading');if(stockHeader)stockHeader.insertAdjacentHTML('afterend','<div class="v2-category-tabs" id="v2ProductCategories" aria-label="상품 카테고리"></div>');
 const oldOpenV2=openPanel;openPanel=function(id,direction=0){oldOpenV2(id,direction);document.querySelectorAll('.bottom-nav .tab').forEach(e=>e.classList.toggle('active',e.dataset.panel===(['all','bank'].includes(id)?'more':id==='purchases'?'products':id)));if(id==='dashboard')renderLayoutV2();};
 navigateToPanel=function(panelId){if([...PANEL_ORDER,'all','bank','purchases'].includes(panelId))openPanel(panelId)};
 const oldRenderV2=render;render=function(){oldRenderV2();renderLayoutV2()};
 const oldBankV2=renderBank;renderBank=function(){oldBankV2();renderLayoutV2()};
 const oldProductV2=renderProducts;renderProducts=function(){oldProductV2();renderProductTabsV2()};
 renderLayoutV2();renderProductTabsV2();
}
function renderProductTabsV2(){const box=document.getElementById('v2ProductCategories'),select=document.getElementById('productCategoryFilter');if(!box||!select)return;box.innerHTML=[...select.options].map((o,i)=>`<button type="button" data-index="${i}" aria-pressed="${o.value===select.value}">${esc(o.text)}</button>`).join('');box.querySelectorAll('button').forEach(b=>b.onclick=()=>{select.selectedIndex=Number(b.dataset.index);renderProducts()})}
function renderLayoutV2(){const $v=id=>document.getElementById(id);if(!$v('v2Date'))return;$v('v2Date').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(currentDate+'T12:00:00+09:00'));
 const start=currentDate.slice(0,7)+'-01',end=Finance.plusDays(currentDate,-1);let missing=0;const recorded=new Set(sales.map(s=>s.sale_date));for(let d=start;d<=end;d=Finance.plusDays(d,1))if(!recorded.has(d))missing++;
 $v('v2Missing').textContent=missing+'일';
 if(purchaseBatchesLoaded){const limit=Finance.plusDays(currentDate,30);const list=purchaseBatches.filter(b=>Number(b.remaining_quantity)>0&&b.expiration_date&&b.expiration_date<=limit);$v('v2Expiry').textContent=new Set(list.map(b=>b.product_id)).size+'종';$v('v2ExpiryNote').textContent='기한 경과·30일 이내';}else{$v('v2Expiry').textContent='확인';$v('v2ExpiryNote').textContent='상품에서 재고 조회'}
 $v('v2Unclassified').textContent=bankLoaded?bankData.events.filter(e=>{const d=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date(e.occurred_at));const p=bankData.period||bankPeriod();return d>=p.start&&d<=p.end&&bankClass(e).business==='unclassified'}).length+'건':'연결 확인';
}
mountLayoutV2();

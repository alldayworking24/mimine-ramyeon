/* Home: quick daily decisions. Reports: complete calendar-year/month analysis. */
const annual={year:ANALYTICS_YEAR,metric:'sales',selected:Number(TODAY.slice(5,7))};
function actualMetric(stats,key){return key==='cost'?stats.cost:stats.recorded?stats[key]:null;}
function metricAmount(value,key,{editable=false,money=false}={}){
 if(value===null)return '미입력';
 const markup=money?moneyMarkup(value):fmt(value);
 return editable?(key==='sales'?todaySalesAmount(markup,'매출'):key==='cost'?todayExpenseAmount(markup,'비용'):markup):markup;
}
function salesYearComparison(){
 const end=flow.end>TODAY?TODAY:flow.end,hasElapsed=flow.start<=end;
 const bounds=hasElapsed?[flow.start,end]:[flow.start,flow.end];
 const prior=[shiftedYear(bounds[0]),shiftedYear(bounds[1])];
 const current=hasElapsed?periodStats(...bounds):null,previous=periodStats(...prior);
 return{bounds,prior,current,previous,sales:current?.recorded?current.sales:null,
 priorSales:previous.recorded?previous.sales:null,
 delta:current?.recorded&&previous.recorded?current.sales-previous.sales:null};
}
function cumulativeSalesRows(){
 let current=0,previous=0;
 return datesIn(flow.start,flow.end).map(date=>{
  const s=date>TODAY?null:saleOn(date),p=saleOn(shiftedYear(date));
  if(s)current+=Number(s.amount);if(p)previous+=Number(p.amount);
  return{date,current:s?current:null,previous:p?previous:null,future:date>TODAY};
 });
}
function comparisonChart(rows,{id,metric='sales',action,title,selected=0,labels}){
 const W=760,H=180,P=12,values=rows.flatMap(r=>[r.current,r.previous]).filter(v=>v!==null);
 const low=Math.min(0,...values),high=Math.max(0,...values),step=Math.max(10000,Math.ceil((high-low||40000)/4/10000)*10000);
 const max=Math.ceil(high/step)*step||step,min=Math.floor(low/step)*step,span=max-min||1;
 const x=i=>rows.length===1?W/2:P+i*(W-2*P)/Math.max(1,rows.length-1),y=v=>12+(max-v)/span*(H-28);
 const line=(key,color,extra='')=>'<path data-series="'+id+'-'+key+'" d="'+chartPath(rows,key,x,y)+'" fill="none" stroke="'+color+'" stroke-width="2.6" vector-effect="non-scaling-stroke" '+extra+'/>';
 const selectedRow=rows[selected],zero=Math.max(0,Math.min(H,y(0)));
 const currentLine=metric==='balance'?'<defs><clipPath id="'+id+'-positive"><rect width="'+W+'" height="'+zero+'"/></clipPath><clipPath id="'+id+'-negative"><rect y="'+zero+'" width="'+W+'" height="'+(H-zero)+'"/></clipPath></defs>'+line('current','#2463d6','clip-path="url(#'+id+'-positive)"')+line('current','#dc4a4e','clip-path="url(#'+id+'-negative)"'):line('current',METRIC[metric].color);
 return '<div class="comparison-chart"><div class="comparison-chart-scale"><span>'+fmt(max/10000)+'</span><span>'+fmt((max+min)/20000)+'</span><span>'+fmt(min/10000)+'</span></div><div class="comparison-chart-main"><svg class="year-comparison-svg" data-swipe-ignore="true" data-action="'+action+'" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="'+esc(title)+'"><title>'+esc(title)+' · 단위 만원. 현재 실적과 회색 작년 실적을 비교합니다.</title>'+[min,(min+max)/2,max].map(v=>'<line x1="0" x2="'+W+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="#e6ebf1" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/>').join('')+line('previous',PREVIOUS_SALES_COLOR)+currentLine+(selectedRow?'<line x1="'+x(selected)+'" x2="'+x(selected)+'" y1="0" y2="'+H+'" stroke="#c7d1de" stroke-dasharray="3 5" vector-effect="non-scaling-stroke"/>'+['current','previous'].filter(k=>selectedRow[k]!==null).map(k=>'<circle cx="'+x(selected)+'" cy="'+y(selectedRow[k])+'" r="3.5" fill="'+(k==='previous'?PREVIOUS_SALES_COLOR:metric==='balance'?changeColor(selectedRow[k]):METRIC[metric].color)+'" stroke="white" stroke-width="1.5" vector-effect="non-scaling-stroke"/>').join(''):'')+'</svg><div class="comparison-chart-labels">'+labels.map(l=>'<button type="button" data-action="'+l.action+'" '+(l.month?'data-month="'+l.month+'"':'data-date="'+l.date+'"')+' aria-label="'+esc(l.label+' 상세 보기')+'">'+esc(l.text)+'</button>').join('')+'</div></div></div>';
}
function homeYearSummary(){
 const c=salesYearComparison(),rows=cumulativeSalesRows();
 const indexes=[...new Set(Array.from({length:Math.min(5,rows.length)},(_,i)=>Math.round(i*(rows.length-1)/Math.max(1,Math.min(5,rows.length)-1))))];
 const selected=Math.max(0,rows.findIndex(r=>r.date===flow.selected));
 const yearLabel=flow.start.slice(0,4)===String(ANALYTICS_YEAR)?'올해 매출':'조회 매출';
 return '<section class="home-yoy-card"><div class="flow-card-title"><h2>작년 같은 기간과 비교</h2><span>등록된 매출 기준</span></div><div class="yoy-equation"><div class="metric-sales"><small>'+yearLabel+'</small><strong>'+(c.current?metricAmount(c.sales,'sales',{editable:true,money:true}):'예정')+'</strong></div><div class="metric-previous"><small>작년 매출</small><strong>'+metricAmount(c.priorSales,'sales',{money:true})+'</strong></div><div class="metric-balance '+changeTone(c.delta)+'"><small>차이</small><strong>'+(c.delta===null?'비교 자료 없음':signed(c.delta)+'<span>원</span>')+'</strong></div></div><div class="home-yoy-dates"><span>조회 '+shortRange(...c.bounds)+'</span><span>작년 '+shortRange(...c.prior)+'</span></div><div class="comparison-chart-heading"><strong>누적 매출 비교</strong><span class="year-chart-legend"><i class="current"></i>조회 <i class="previous"></i>작년 <small>만원</small></span></div>'+comparisonChart(rows,{id:'home-yoy',action:'home-yoy-pick',title:'선택 기간의 누적 매출 비교',selected,labels:indexes.map(i=>({action:'open-day',date:rows[i].date,text:md(rows[i].date),label:rows[i].date}))})+'<p class="flow-note">날짜를 누르면 상세 · '+(flow.end>TODAY?'상단 합계는 오늘까지 같은 날짜 비교. 미래 구간은 작년 참고. ':'')+((c.current?.missing||c.previous.missing)?'매출 미입력: 조회 '+(c.current?.missing||0)+'일 / 작년 '+c.previous.missing+'일. 입력된 금액만 합산합니다.':'같은 기간의 등록 매출을 누적합니다.')+'</p></section>';
}
function homeForecastSummary(){
 const f=forecastValues();
 return '<section class="home-forecast-card"><div class="flow-card-title"><h2>이달 말 예상 매출</h2><button class="text-button" data-action="navigate" data-page="reports" aria-label="월별 비교와 예상 매출 상세 보기">상세 '+icon('right')+'</button></div><strong class="home-forecast-amount metric-sales">'+(f.enough?metricAmount(f.total,'sales',{editable:true,money:true}):todaySalesAmount('자료 부족','예상 매출'))+'</strong><p class="flow-note">'+(f.enough?'실제 '+won(f.current)+' + 남은 날짜 예상 '+won(f.rest):'매출 기록이 부족합니다. 비교·예측에서 입력 상태를 확인하세요.')+'</p></section>';
}
const dailyTableBeforeListTotals=dailyTable;
function dailyListTotals(dates){
 const rows=dates.map(yearDayStats),current=rows.filter(r=>r.sale),prior=rows.filter(r=>r.prior),paired=rows.filter(r=>r.change!==null);
 return{current:current.length?sum(current,r=>r.sale.amount):null,previous:prior.length?sum(prior,r=>r.prior.amount):null,delta:paired.length?sum(paired,r=>r.change):null,paired:paired.length,count:dates.length,future:rows.filter(r=>r.future).length};
}
dailyTable=function(){
 const rows=datesIn(flow.start,flow.end).reverse(),past=rows.filter(d=>d<=TODAY),shown=flow.showAll?rows:(past.length?past:rows).slice(0,7),t=dailyListTotals(shown);
 const totals='<div class="daily-list-summary"><div class="daily-list-summary-title"><strong>목록 합계</strong><span>현재 표시 '+t.count+'일</span></div><div class="daily-list-summary-values"><div class="metric-previous"><small>'+(t.future?'작년 전체':'작년 매출')+'</small><strong>'+metricAmount(t.previous,'sales',{money:true})+'</strong></div><div class="metric-sales"><small>일매출</small><strong>'+metricAmount(t.current,'sales',{editable:true,money:true})+'</strong></div><div class="metric-balance '+changeTone(t.delta)+'"><small>같은 날 증감</small><strong>'+(t.delta===null?'—':signed(t.delta)+'<span>원</span>')+'</strong></div></div><p>증감은 양쪽 매출이 입력된 '+t.paired+'일 기준'+(t.future?' · 예정 '+t.future+'일은 작년만 합산':'')+'</p></div>';
 return dailyTableBeforeListTotals().replace('<table class="flow-daily-table daily-yoy-table">',totals+'<table class="flow-daily-table daily-yoy-table">');
};
function annualYearOptions(){const years=db.sales.concat(db.expenses).map(r=>Number(r.date.slice(0,4)));const min=Math.max(2000,Math.min(ANALYTICS_YEAR-1,...years));return Array.from({length:Math.min(20,ANALYTICS_YEAR-min+1)},(_,i)=>ANALYTICS_YEAR-i);}
function calendarMonthStats(year,month){
 const ym=year+'-'+String(month).padStart(2,'0'),start=ym+'-01',end=lastDay(ym),future=start>TODAY;
 const stats=periodStats(start,end);
 return{...stats,year,month,start,end,actualEnd:future?null:end>TODAY?TODAY:end,future,partial:!future&&end>TODAY,
 values:{sales:future?null:actualMetric(stats,'sales'),cost:future?null:stats.cost,balance:future?null:actualMetric(stats,'balance')}};
}
function annualMonthRows(year=annual.year){return Array.from({length:12},(_,i)=>{const current=calendarMonthStats(year,i+1),previous=calendarMonthStats(year-1,i+1);return{month:i+1,current,previous,delta:Object.fromEntries(Object.keys(METRIC).map(k=>[k,current.values[k]===null||previous.values[k]===null?null:current.values[k]-previous.values[k]]))};});}
function calendarYearStats(year){
 const start=year+'-01-01',end=year+'-12-31',stats=periodStats(start,end);
 return{...stats,start,end,future:false,partial:end>TODAY,actualEnd:end>TODAY?TODAY:end,values:{sales:actualMetric(stats,'sales'),cost:stats.cost,balance:actualMetric(stats,'balance')}};
}
function annualComparisonStats(){const current=calendarYearStats(annual.year),previous=calendarYearStats(annual.year-1);return{current,previous,delta:Object.fromEntries(Object.keys(METRIC).map(k=>[k,current.values[k]===null||previous.values[k]===null?null:current.values[k]-previous.values[k]]))};}
function annualMetricSummary(c,p,delta){
 return '<div class="annual-metric-summary">'+Object.entries(METRIC).map(([k,m])=>'<div class="annual-metric-card"><small>'+m.name+'</small><strong class="metric-'+k+' '+(k==='balance'?changeTone(c.values[k]):'')+'">'+(c.future?'예정':metricAmount(c.values[k],k,{editable:true,money:true}))+'</strong><div><span>작년</span><b class="metric-previous">'+metricAmount(p.values[k],k,{money:true})+'</b></div><div><span>증감</span><b class="'+changeTone(delta[k])+'">'+(delta[k]===null?'—':signed(delta[k])+'원')+'</b></div></div>').join('')+'</div>';
}
function annualOverview(){
 const s=annualComparisonStats();
 return '<section class="annual-overview"><div class="flow-card-title"><h2>연간 실적 비교</h2><span>단위: 원</span></div><div class="annual-range-note"><span><i class="current"></i>'+annual.year+'년 '+shortRange(s.current.start,s.current.actualEnd)+'</span><span><i class="previous"></i>'+(annual.year-1)+'년 1.1 – 12.31 전체</span></div>'+annualMetricSummary(s.current,s.previous,s.delta)+'<p class="flow-note">'+(annual.year===ANALYTICS_YEAR?'올해는 오늘까지 실제 등록액, 작년은 12월 31일까지 연간 전체입니다. 같은 경과일 비교와 기준이 다릅니다.':'두 해 모두 1월 1일부터 12월 31일까지 등록된 전체 실적입니다.')+(s.current.missing||s.previous.missing?' 매출 미입력: '+annual.year+'년 '+s.current.missing+'일 / '+(annual.year-1)+'년 '+s.previous.missing+'일.':'')+'</p></section>';
}
function annualChartPanel(){
 const rows=annualMonthRows(),key=annual.metric,selected=rows[annual.selected-1],chartRows=rows.map(r=>({current:r.current.values[key],previous:r.previous.values[key]}));
 return '<section class="annual-chart-card"><div class="flow-card-title"><h2>월별 흐름 비교</h2><span>단위: 만원</span></div><div class="annual-metric-tabs" aria-label="월별 그래프 항목">'+Object.entries(METRIC).map(([k,m])=>'<button type="button" class="'+(annual.metric===k?'active':'')+' metric-'+k+'" data-action="annual-metric" data-value="'+k+'" aria-pressed="'+(annual.metric===k)+'">'+m.name+'</button>').join('')+'</div><div class="year-chart-legend annual-legend"><i class="current '+key+'"></i>'+annual.year+'년 <i class="previous"></i>'+(annual.year-1)+'년 · 월 전체</div>'+comparisonChart(chartRows,{id:'annual-months',metric:key,action:'annual-chart-pick',title:annual.year+'년과 '+(annual.year-1)+'년 월별 '+METRIC[key].name+' 비교',selected:annual.selected-1,labels:rows.map(r=>({action:'annual-month',month:r.month,text:r.month+'월',label:annual.year+'년 '+r.month+'월'}))})+'<button class="annual-selected-month" type="button" data-action="annual-month" data-month="'+annual.selected+'" aria-label="'+annual.selected+'월 상세 보기"><strong>'+annual.selected+'월 <small>'+(selected.current.future?'예정':selected.current.partial?'진행 중':'실적')+'</small></strong><span class="metric-'+key+'">'+annual.year+'년 '+(selected.current.future?'예정':metricAmount(selected.current.values[key],key))+'</span><span class="metric-previous">작년 '+metricAmount(selected.previous.values[key],key)+'</span>'+icon('right')+'</button><p class="flow-note">월 또는 그래프를 누르면 일별 상세 · 미래 실적은 예정으로 표시합니다.</p></section>';
}
function monthlyMetricCell(row,key){
 const c=row.current,p=row.previous,d=row.delta[key];
 return '<td><strong class="metric-'+key+' '+(key==='balance'?changeTone(c.values[key]):'')+'">'+(c.future?'예정':metricAmount(c.values[key],key,{editable:true}))+'</strong><span class="metric-previous">'+metricAmount(p.values[key],key)+'</span><small class="'+changeTone(d)+'">'+(d===null?'—':signed(d))+'</small></td>';
}
function annualMonthlyTable(){
 const rows=annualMonthRows(),a=annualComparisonStats();
 return '<section class="annual-table-card"><div class="flow-card-title"><h2>월별 매출·비용·차이</h2><span>단위: 원</span></div><div class="monthly-table-key"><span>첫 줄 <b>'+annual.year+'년</b></span><span>둘째 줄 <b class="metric-previous">'+(annual.year-1)+'년</b></span><span>셋째 줄 <b>증감</b></span></div><table class="monthly-comparison-table"><thead><tr><th>월</th><th>매출</th><th>비용</th><th>차이</th></tr></thead><tbody><tr class="monthly-total-row"><th>연간<br>합계</th>'+Object.keys(METRIC).map(k=>monthlyMetricCell({current:a.current,previous:a.previous,delta:a.delta},k)).join('')+'</tr>'+rows.map(r=>'<tr class="'+(r.current.partial?'is-current-month':r.current.future?'is-future-month':'')+'"><th><button type="button" data-action="annual-month" data-month="'+r.month+'" aria-label="'+annual.year+'년 '+r.month+'월 상세 보기">'+r.month+'월'+(r.current.partial?'<small>진행 중</small>':r.current.future?'<small>예정</small>':'')+'</button></th>'+Object.keys(METRIC).map(k=>monthlyMetricCell(r,k)).join('')+'</tr>').join('')+'</tbody></table><p class="flow-note">작년은 각 월의 말일까지 전체. 올해 진행 중인 달은 오늘까지입니다. ‘미입력’은 매출 기록이 없다는 뜻이며, 비용 0원은 등록된 비용이 없다는 뜻입니다. 차이 = 매출 − 비용.</p></section>';
}
function annualReportPage(){
 const years=annualYearOptions();
 return '<div class="analytics-page annual-report-page">'+heading('','비교·예측','월별 실적과 작년 전체를 비교하세요.','')+'<section class="annual-year-control" aria-label="분석 연도 선택"><button type="button" class="icon-button" data-action="annual-year-step" data-value="-1" '+(annual.year===years.at(-1)?'disabled':'')+' aria-label="이전 분석 연도">'+icon('left')+'</button><label>'+icon('calendar')+'<select id="annual-year" aria-label="분석 연도">'+years.map(y=>'<option value="'+y+'" '+(y===annual.year?'selected':'')+'>'+y+'년'+(y===ANALYTICS_YEAR?' · 올해':'')+'</option>').join('')+'</select></label><button type="button" class="icon-button" data-action="annual-year-step" data-value="1" '+(annual.year===ANALYTICS_YEAR?'disabled':'')+' aria-label="다음 분석 연도">'+icon('right')+'</button></section>'+annualOverview()+'<div class="annual-report-grid"><div>'+annualChartPanel()+annualMonthlyTable()+'</div><aside>'+(annual.year===ANALYTICS_YEAR?forecastPanel():'')+costBreakdown(annual.year+'-01-01',annual.year+'-12-31','비용 항목별 합계')+'<section class="annual-report-help"><h2>표 읽는 방법</h2><p>매출은 녹색, 비용은 빨강, 작년 실적은 회색입니다. 증가는 파랑, 감소는 빨강입니다.</p><p>월을 누르면 해당 월의 합계와 일별 매출을 볼 수 있습니다. 올해의 예정 금액은 실제 실적에 더하지 않습니다.</p></section></aside></div></div>';
}
function openAnnualMonth(month){
 const row=annualMonthRows().find(r=>r.month===month);if(!row)return;
 annual.selected=month;
 const dates=datesIn(row.current.start,row.current.end);
 const table='<table class="flow-daily-table daily-yoy-table annual-detail-table"><thead><tr><th>날짜</th><th class="metric-previous">작년 매출</th><th class="metric-sales">일매출</th><th>증감</th></tr></thead><tbody>'+dates.map(date=>{const r=yearDayStats(date);return '<tr><th><button type="button" class="date-detail-button" data-action="annual-day" data-date="'+date+'" aria-label="'+date+' 일매출 상세">'+md(date)+'</button></th><td class="metric-previous">'+(r.prior?fmt(r.prior.amount):'미입력')+'</td><td class="metric-sales">'+(r.future?'예정':r.sale?todaySalesAmount(fmt(r.sale.amount),'일매출'):'미입력')+'</td><td class="'+changeTone(r.change)+'">'+(r.change===null?'—':signed(r.change))+'</td></tr>';}).join('')+'</tbody></table>';
 sheet(annual.year+'년 '+month+'월 상세','<p class="annual-detail-note">조회 '+shortRange(row.current.start,row.current.actualEnd||row.current.end)+' · 작년 '+shortRange(row.previous.start,row.previous.end)+' 전체</p>'+annualMetricSummary(row.current,row.previous,row.delta)+'<h3 class="annual-detail-heading">일별 매출 비교</h3>'+table+'<p class="flow-note">단위: 원 · 날짜를 누르면 매출·비용 상세를 확인합니다. 미래 날짜는 작년 실적만 참고할 수 있습니다.</p>','<button type="button" class="secondary" data-action="close-modal">닫기</button>',{name:'annual-month'});
}
renderToday=()=>'<div class="analytics-page home-overview-page">'+heading('','매출·비용 흐름','', '<span class="flow-today-date">'+dateText(TODAY)+'</span>')+todayTiles()+analyticalPeriodControl()+'<div class="home-overview-grid"><div class="home-overview-main">'+homeYearSummary()+flowChart()+'</div><aside>'+homeForecastSummary()+dailyTable()+'</aside></div></div>';
renderReports=annualReportPage;
const actionBeforeAnnual=action;
action=function(el){
 const a=el.dataset.action,value=el.dataset.value;
 if(a==='annual-metric'){if(!METRIC[value])return;annual.metric=value;render();return;}
 if(a==='annual-month'){const month=Number(el.dataset.month);if(month>=1&&month<=12){annual.selected=month;render();openAnnualMonth(month);}return;}
 if(a==='annual-year-step'){const year=annual.year+Number(value);if(annualYearOptions().includes(year)){annual.year=year;render();}return;}
 if(a==='annual-day'){openDayDetail(el.dataset.date);return;}
 return actionBeforeAnnual(el);
};
document.addEventListener('change',e=>{if(e.target.id==='annual-year'){const year=Number(e.target.value);if(annualYearOptions().includes(year)){annual.year=year;render();}}});
document.addEventListener('click',e=>{
 const svg=e.target.closest('.year-comparison-svg');if(!svg)return;const box=svg.getBoundingClientRect(),ratio=(e.clientX-box.left)/box.width;
 if(svg.dataset.action==='annual-chart-pick'){const month=Math.max(1,Math.min(12,Math.round((ratio*760-12)/736*11)+1));annual.selected=month;render();openAnnualMonth(month);}
 else if(svg.dataset.action==='home-yoy-pick'){const rows=cumulativeSalesRows(),i=Math.max(0,Math.min(rows.length-1,Math.round((ratio*760-12)/736*(rows.length-1))));flow.selected=rows[i].date;render();openDayDetail(flow.selected);}
});
render();

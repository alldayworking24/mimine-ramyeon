import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const c={console,Date,Intl,Map,URL,URLSearchParams,structuredClone,productionToday:'2026-11-03',location:{hash:'',href:'https://example.test/'},localStorage:{getItem:()=>null},window:{},document:{addEventListener(){}}};
vm.createContext(c);
vm.runInContext(await read('flow/preview-provider.js'),c);
c.productionSnapshot=await vm.runInContext('createMiminePreviewProvider().snapshot()',c);
const app=await read('flow/app.js');vm.runInContext(app.slice(0,app.indexOf("document.addEventListener('click'")),c);
const analytics=await read('flow/analytics.js');vm.runInContext(analytics.slice(0,analytics.indexOf('renderToday=()=>')),c);
const interactions=await read('flow/interactions.js');vm.runInContext(interactions.slice(0,interactions.indexOf('const bankBeforeExclusion=')),c);
vm.runInContext("flow.start='2026-11-01';flow.end='2026-11-03';for(const[d,a,p]of[['2026-11-03',1600,48300],['2026-11-02',47500,42700],['2026-11-01',55600,55600]]){db.sales.find(s=>s.date===d).amount=a;db.sales.find(s=>s.date===shiftedYear(d)).amount=p;}",c);
const moneyText=html=>html.replace(/<svg[^>]*class="revenue-edit-cue"[\s\S]*?<\/svg>/g,'').replace(/<button[^>]*data-action="today-sale"[^>]*>([\s\S]*?)<\/button>/g,'$1');
const table=moneyText(vm.runInContext('dailyTable()',c));
assert.match(table,/<th class="metric-previous">작년 매출<\/th><th class="metric-sales">일매출<\/th>/);
assert.match(table,/<td class="metric-previous previous-money">48,300<\/td><td class="metric-sales">1,600<\/td><td class="metric-balance change-down"><strong>-46,700/);
assert.match(table,/change-up"><strong>\+4,800/);
assert.match(table,/change-flat"><strong>0/);
const chart=vm.runInContext('flowChart()',c);
assert.match(chart,/data-series="sales"[^>]*stroke="#228461"/);
assert.match(chart,/data-series="previous"[^>]*stroke="#858e9c"/);
assert.doesNotMatch(chart.match(/<path data-series="previous"[^>]*>/)[0],/stroke-dasharray/);
const [salesPlot,costPlot]=[...chart.matchAll(/<svg class="daily-line-svg"[\s\S]*?<\/svg>/g)].map(m=>m[0]);
assert.ok(salesPlot&&costPlot,'Two daily graphs should be rendered');
assert.match(salesPlot,/data-series="sales"/);
assert.doesNotMatch(salesPlot,/data-series="cost"/);
assert.match(costPlot,/data-series="cost"[^>]*stroke="#dc4a4e"/);
assert.doesNotMatch(costPlot,/data-series="sales"|data-series="previous"/);
assert.equal(vm.runInContext('changeTone(null)',c),'change-flat');
vm.runInContext("db.sales=db.sales.filter(s=>s.date!=='2025-11-03')",c);
assert.match(moneyText(vm.runInContext('dailyTable()',c)),/previous-money">미입력<\/td><td class="metric-sales">1,600<\/td><td class="metric-balance change-flat">/);
for(const[last,tone]of [[1,'change-up'],[99999999,'change-down']]){
 vm.runInContext('forecastValues=()=>({enough:true,priorComplete:true,total:200,current:100,rest:100,last:'+last+',future:[1],monthMissing:0})',c);
 assert.match(vm.runInContext('forecastPanel()',c),new RegExp('metric-balance '+tone));
}
console.log('Financial colors: past/current order, positive/negative/zero/missing changes, curve series and forecast comparison passed.');

// Cost savings must have the same sign in every comparison, including its rate.
vm.runInContext('render=()=>{}',c);
vm.runInContext(await read('flow/annual-reports.js'),c);
vm.runInContext("flow.start='2026-11-01';flow.end='2026-11-03';flow.compare='year';db.sales=[{date:'2026-11-01',amount:20000000},{date:'2025-11-01',amount:20000000}];db.expenses=[{date:'2026-11-01',amount:9284900},{date:'2025-11-01',amount:10305000}];",c);
const run=source=>vm.runInContext(source,c);
const costCard=()=>moneyText(run('annualOverview()')).split('<small>비용</small>')[1].split('<div class="annual-metric-card">')[0];
const costComparison=()=>moneyText(run('comparePanel()')).split('<th class="metric-cost">비용</th>')[1].split('</tr>')[0];
assert.match(costCard(),/<span>절감액<\/span><b class="change-up">\+1,020,100원/);
assert.match(costComparison(),/change-up"><strong>\+1,020,100<\/strong><small>\+9\.9% 절감/);
assert.match(run("monthlyMetricCell(annualMonthRows()[10],'cost')"),/change-up">\+1,020,100/);
c.sheet=(title,body)=>{c.monthDetail=body;};run('openAnnualMonth(11)');
assert.match(c.monthDetail,/<span>절감액<\/span><b class="change-up">\+1,020,100원/);
assert.equal(run('annualComparisonStats().delta.cost'),-1020100,'Recorded costs and raw arithmetic retain their original meaning');
assert.match(run("monthlyMetricCell(annualMonthRows()[11],'cost')"),/change-flat">—/,'Future costs are not savings');
run('db.expenses[0].amount=11325100');
assert.match(costCard(),/<span>비용 증가<\/span><b class="change-down">-1,020,100원/);
assert.match(costComparison(),/change-down"><strong>-1,020,100<\/strong><small>-9\.9% 증가/);
run('db.expenses[0].amount=10305000');
assert.match(costCard(),/<span>증감<\/span><b class="change-flat">0원/);
assert.match(costComparison(),/change-flat"><strong>0<\/strong><small>0\.0% 동일/);
run('db.expenses[0].amount=0');
assert.match(costComparison(),/change-up"><strong>\+10,305,000<\/strong><small>\+100\.0% 절감/);
run('db.expenses[0].amount=100;db.expenses[1].amount=0');
assert.match(costComparison(),/change-down"><strong>-100<\/strong><small>비교 기준 없음 증가/);
assert.equal(run("metricChange(null,'cost')"),null);
assert.equal(run("metricChange(50,'sales')"),50);
assert.equal(run("metricChange(-50,'balance')"),-50);
console.log('Cost comparisons: annual totals, monthly rows, month details, period amount/rate, increases, equal/zero/future values passed.');

const legacy=await read('legacy/index.html'),nodes=new Map();
const l={currentDate:'2026-11-03',expenses:[{expense_date:'2026-11-01',amount:9284900},{expense_date:'2025-11-01',amount:10305000},{expense_date:'2026-10-01',amount:10305000}],
 $:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},won:n=>Number(n).toLocaleString('ko-KR')+'원',esc:String,dateISO:d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
for(const [name,next]of [['renderExpenseMonthlyYoy','initYoySummaryDates'],['renderExpenseCategories','renderSalesPeriodComparison']]){
 vm.runInNewContext(legacy.slice(legacy.indexOf('function '+name+'(){'),legacy.indexOf('function '+next+'(){'))+'\n'+name+'()',l);
}
assert.match(nodes.get('expenseMonthlyYoyTableBody').innerHTML,/diff-up">\+1,020,100원/);
assert.match(nodes.get('categoryCompareBody').innerHTML,/class="up">\+1,020,100원/);
assert.match(legacy,/\.expenses-monthly-yoy \.diff-up\{color:var\(--profit\)\}/);
console.log('Legacy cost comparisons: monthly/year total and expense categories also show positive blue savings.');

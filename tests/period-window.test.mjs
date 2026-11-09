import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [provider,app,analytics,interactions]=await Promise.all(['flow/preview-provider.js','flow/app.js','flow/analytics.js','flow/interactions.js'].map(read));
async function setup(today){
 const c={console,Date,Intl,Map,Set,URL,URLSearchParams,structuredClone,productionToday:today,location:{hash:'',href:'https://example.test/'},localStorage:{getItem:()=>null},window:{},document:{addEventListener(){}}};
 vm.createContext(c);vm.runInContext(provider,c);c.productionSnapshot=await vm.runInContext('createMiminePreviewProvider().snapshot()',c);
 vm.runInContext(app.slice(0,app.indexOf("document.addEventListener('click'")),c);
 vm.runInContext(analytics.slice(0,analytics.indexOf('renderToday=()=>')),c);
 vm.runInContext(interactions.slice(0,interactions.indexOf('const bankBeforeExclusion=')),c);
 vm.runInContext('render=()=>{}',c);return c;
}
const c=await setup('2026-11-03'),run=s=>vm.runInContext(s,c),plain=x=>JSON.parse(JSON.stringify(x));
assert.deepEqual(plain(run('[flow.start,flow.end,flow.selected]')),['2026-11-01','2026-11-30','2026-11-03']);
assert.equal(run('flow.preset'),'month');
run("setFlowPreset('week')");
assert.equal(run('dailyRows().length'),14);assert.equal(run('dailyRows().filter(r=>r.future).length'),7);
for(const[p,a,b]of [['today','2026-11-03','2026-11-03'],['month','2026-11-01','2026-11-30'],['lastMonth','2026-10-01','2026-10-31'],['year','2026-01-01','2026-12-31'],['week','2026-10-28','2026-11-10']]){
 run(`setFlowPreset('${p}')`);assert.deepEqual(plain(run('[flow.start,flow.end]')),[a,b]);assert.equal(run('flow.selected'),p==='lastMonth'?'2026-10-31':'2026-11-03');
}
const before=plain(run('periodStats(flow.start,flow.end)'));
run("db.sales.push({date:'2026-11-04',amount:999999});db.expenses.push({date:'2026-11-04',amount:999999,category:'미래 비용'})");
const future=plain(run("dailyRows().find(r=>r.date==='2026-11-04')"));
assert.equal(future.sales,null);assert.equal(future.cost,null);assert.equal(future.balance,null);assert.equal(future.future,true);assert.ok(future.previous>0);
assert.deepEqual(plain(run('periodStats(flow.start,flow.end)')),before,'Future records must not enter actual totals');
assert.equal(before.days,7);assert.equal(before.future,7);assert.equal(before.missing,0);
assert.deepEqual(plain(run('elapsedPriorBounds()')),['2025-10-28','2025-11-03']);
assert.match(run('comparePanel()'),/오늘까지 실제 매출로 비교/);
run("setFlowPreset('month')");assert.equal(run('periodStats(flow.start,flow.end).days'),3);assert.equal(run('periodStats(flow.start,flow.end).future'),27);assert.equal(run('periodStats(flow.start,flow.end).missing'),0);
assert.deepEqual(plain(run('elapsedPriorBounds()')),['2025-11-01','2025-11-03']);
let chart=run('flowChart()');assert.match(chart,/data-future-start="2026-11-04"/);assert.match(chart,/data-series="previous"[^>]*stroke="#858e9c"/);assert.match(chart,/2026-11-30 상세 열기/);assert.match(chart,/class="chart-axis-date is-today"/);
run("flow.selected='2026-11-30'");chart=run('flowChart()');assert.match(chart,/<b>예정<\/b>/);assert.match(chart,/예정 · 작년 매출 참고/);
const rows=run('dailyTable()');assert.match(rows,/2026-11-03 일매출 상세/);assert.doesNotMatch(rows,/2026-11-30 일매출 상세/);
run('flow.showAll=true');assert.match(run('dailyTable()'),/2026-11-30 일매출 상세/);assert.match(run('dailyTable()'),/metric-sales">예정/);
c.sheet=(title,body,footer)=>{c.detail={title,body,footer};};run("openDayDetail('2026-11-30')");assert.match(c.detail.body,/작년 같은 날짜와 비교/);assert.match(c.detail.body,/아직 오지 않은 날짜/);assert.doesNotMatch(c.detail.footer,/day-edit-sale|day-add-cost/);
run("flow.compare='previous';setFlowPreset('week')");assert.deepEqual(plain(run('priorBounds()')),['2026-10-14','2026-10-27']);assert.deepEqual(plain(run('elapsedPriorBounds()')),['2026-10-14','2026-10-20']);
run("flow.compare='none'");assert.equal(run('priorBounds()'),null);assert.match(run('flowChart()'),/예정 7일/);
for(const[today,monthEnd,weekEnd]of [['2024-02-27','2024-02-29','2024-03-05'],['2026-12-29','2026-12-31','2027-01-05'],['2028-02-29','2028-02-29','2028-03-07']]){
 const d=await setup(today),go=s=>vm.runInContext(s,d);go("setFlowPreset('month')");assert.equal(go('flow.end'),monthEnd);go("setFlowPreset('week')");assert.equal(go('flow.end'),weekEnd);assert.equal(go('dailyRows().length'),14);
 go("setFlowPreset('year')");assert.equal(go('flow.end'),today.slice(0,4)+'-12-31');assert.match(go('flowChart()'),/data-series="previous"/,'Calendar alignment must survive leap-year length differences');
}
run("flow.compare='year';setFlowPreset('month');db.sales.find(s=>s.date==='2026-11-01').amount=0;db.sales=db.sales.filter(s=>s.date!=='2026-11-02')");
assert.equal(run("yearDayStats('2026-11-01').sale.amount"),0);assert.equal(run("yearDayStats('2026-11-02').sale"),undefined);assert.equal(run("yearDayStats('2026-11-04').sale"),null);assert.equal(run('periodStats(flow.start,flow.end).missing'),1);
console.log('Period windows: 7 past + 7 future days, full month/year, year/leap boundaries, actual-only sums, fair elapsed comparison, future detail and zero/missing separation passed.');

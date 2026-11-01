/* Pure calculation: closed days only; an explicit zero counts as recorded. */
function calculateMonthlyForecast(rows, today) {
  const month = today.slice(0, 7);
  const [year, monthNumber, day] = today.split('-').map(Number);
  const monthDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const byDate = new Map();
  for (const row of rows) {
    const date = String(row.sale_date || '');
    const amount = Number(row.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(month + '-') || date > today || row.amount == null || row.amount === '' || !Number.isFinite(amount) || amount < 0) continue;
    byDate.set(date, (byDate.get(date) || 0) + amount);
  }
  const completed = [...byDate].filter(([date]) => date < today);
  const recordedDays = completed.length;
  const completedTotal = completed.reduce((total, [, amount]) => total + amount, 0);
  const actual = [...byDate.values()].reduce((total, amount) => total + amount, 0);
  const missingDays = Math.max(0, day - 1 - recordedDays);
  const todayAmount = byDate.get(today) || 0;
  const average = recordedDays ? completedTotal / recordedDays : null;
  const forecast = average == null ? null : Math.round(completedTotal + average * (monthDays - recordedDays - 1) + Math.max(average, todayAmount));
  return {month, monthDays, day, recordedDays, missingDays, actual, todayAmount, average, forecast, remaining: forecast == null ? null : Math.max(0, forecast - actual)};
}

function renderMonthlyForecast() {
  // Business dates are always Korean dates, independent of the device timezone.
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
  const result = calculateMonthlyForecast(sales, today);
  document.querySelectorAll('[data-monthly-forecast]').forEach(card => {
    card.querySelector('[data-forecast-month]').textContent = result.month.replace('-', '.') + ' · 이번 달';
    card.querySelector('[data-forecast-total]').textContent = result.forecast == null ? '계산할 기록이 부족해요' : won(result.forecast);
    card.querySelector('[data-forecast-actual]').textContent = won(result.actual);
    card.querySelector('[data-forecast-average]').textContent = result.average == null ? '—' : won(Math.round(result.average));
    card.querySelector('[data-forecast-remaining]').textContent = result.remaining == null ? '—' : won(result.remaining);
    card.querySelector('[data-forecast-note]').textContent = result.average == null
      ? '어제까지의 일매출을 1일 이상 입력하면 자동 계산합니다. 오늘 매출은 진행 중이므로 평균에서 제외합니다.'
      : '어제까지 입력 ' + result.recordedDays + '일 / ' + (result.day-1) + '일 · 미입력 ' + result.missingDays + '일. 0원 입력일은 평균에 포함하며 오늘 진행 중 매출은 평균에서 제외합니다.';
    card.querySelector('[data-forecast-status]').textContent = result.recordedDays < 7 ? '기록 부족 · 참고용 추정' : result.missingDays ? '미입력일 있음 · 참고용 추정' : '일평균 기준 · 참고용 추정';
  });
}

const assert = require('node:assert/strict');
const { buildOrderForecast } = require('./orderForecast');

function history(count, compute) {
  return Array.from({ length: count }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), orders: compute(index), deliveryRate: 90 }));
}

const rows = history(56, index => [100, 200, 300, 400, 500, 60, 70][index % 7]);
const options = { dateFrom: rows[0].date, dateTo: rows.at(-1).date, days: 7 };
const result = buildOrderForecast(rows, options);
assert.equal(result.model.id, 'mean');
assert.equal(result.backtest.wape, 0);
assert.deepEqual(result.forecast.map(row => row.predictedOrders), [100, 200, 300, 400, 500, 60, 70]);
assert.equal(result.forecast[0].date, '2026-02-26');
assert.deepEqual(result, buildOrderForecast(rows, options));
assert.equal(buildOrderForecast([], options).status, 'insufficient_data');
assert.equal(buildOrderForecast(rows.slice(0, 7), { ...options, dateTo: rows[6].date }).forecast.length, 0);
const gaps = buildOrderForecast(rows.filter((_, index) => index !== 10), options);
assert.equal(gaps.historical[10].orders, 0);
assert.equal(gaps.summary.zeroFilledDays, 1);
const longForecast = buildOrderForecast(history(56, index => 100 + index * 10), { ...options, days: 30 });
assert.equal(longForecast.model.id, 'drift');
assert.equal(longForecast.forecast.length, 30);
assert.ok(longForecast.forecast.every(row => Number.isInteger(row.predictedOrders) && Number.isInteger(row.confidence) && row.confidence >= 0 && row.confidence <= 100));
assert.ok(longForecast.forecast[0].confidence >= longForecast.forecast.at(-1).confidence);
const weekdayTrendRows = history(84, index => {
  const week = Math.floor(index / 7);
  return [100, 180, 260, 340, 420, 80, 60][index % 7] + week * 28;
});
const weekdayTrend = buildOrderForecast(weekdayTrendRows, { dateFrom: weekdayTrendRows[0].date, dateTo: weekdayTrendRows.at(-1).date, days: 7 });
assert.ok(new Set(weekdayTrend.forecast.map(row => row.predictedOrders)).size > 1);
assert.ok(Math.max(...weekdayTrend.forecast.map(row => row.predictedOrders)) > Math.min(...weekdayTrend.forecast.map(row => row.predictedOrders)));
assert.ok(weekdayTrend.backtest.candidates.some(candidate => candidate.id === 'weekday_trend'));
const noisyRows = history(140, index => [400, 520, 610, 720, 850, 180, 120][index % 7] + Math.floor(index / 7) * 15 + ((index * 37) % 29) * 30);
const noisyForecast = buildOrderForecast(noisyRows, { dateFrom: noisyRows[0].date, dateTo: noisyRows.at(-1).date, days: 7 });
assert.ok(new Set(noisyForecast.forecast.map(row => row.confidence)).size > 1);
assert.ok(noisyForecast.forecast.some(row => row.confidence < 80));
const eventRows = history(140, index => [100, 180, 260, 340, 420, 80, 60][index % 7]);
const eventCalendar = new Map();
for (const index of [70, 98, 126, 140]) {
  const date = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10);
  eventCalendar.set(date, [{ type: 'promotion', key: 'double-11', name: '双11大促', offset: 0 }]);
  if (index < eventRows.length) eventRows[index].orders *= 5;
}
const eventForecast = buildOrderForecast(eventRows, { dateFrom: eventRows[0].date, dateTo: eventRows.at(-1).date, days: 7, calendar: eventCalendar });
assert.equal(eventForecast.model.id, 'calendar');
assert.deepEqual(eventForecast.forecast[0].events, ['双11大促']);
assert.equal(eventForecast.forecast[0].predictedOrders, 300);
assert.ok(Number.isInteger(eventForecast.forecast[0].confidence));
assert.ok(eventForecast.backtest.folds > 4);
const unknownEventDate = new Date(Date.parse(`${options.dateTo}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const noEventHistory = buildOrderForecast(rows, { ...options, calendar: new Map([[unknownEventDate, [{ type: 'holiday', key: 'spring-festival', name: '春节', offset: 0 }]]]) });
assert.ok(noEventHistory.warnings.some(warning => warning.includes('缺少可比历史样本')));
assert.throws(() => buildOrderForecast(rows, { ...options, days: 1.5 }), RangeError);
console.log('orderForecast: all assertions passed');

async function checkRoute() {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const { createRequire } = require('node:module');
  const routePath = require.resolve('../routes/trends-esm');
  const localRequire = createRequire(routePath);
  const routes = new Map();
  let executed;
  let closed = 0;
  let sourceRows = rows.map(row => [row.date, row.orders, row.deliveryRate]);
  const router = { use() {}, get(path, handler) { routes.set(path, handler); } };
  const sandbox = {
    require(name) {
      if (name === 'express') return { Router: () => router };
      if (name === '../config/database-api') return { getConnection: async () => ({ execute: async (sql, params) => { executed = { sql, params }; return { rows: sourceRows }; }, close: async () => { closed++; } }) };
      if (name === '../utils/brandMapping') return { getBrandMapping: async () => ({ TNF: '18405-1', VANS: '18405-3' }) };
      return localRequire(name);
    },
    module: { exports: {} }, console, process, Date
  };
  vm.runInNewContext(fs.readFileSync(routePath, 'utf8'), sandbox, { filename: routePath });
  const forecast = routes.get('/forecast');
  async function request(query, user = { userId: 'forecast-test', isAdmin: false, customerNos: ['18405-1'] }) {
    let response;
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { response = { status: this.statusCode, body }; return this; } };
    await forecast({ query, user }, res);
    return response;
  }
  const response = await request({ dateFrom: options.dateFrom, dateTo: options.dateTo, days: '7', selfFlag: 'all', platform: 'tmall' });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, 'ready');
  assert.equal(executed.params.brand0, '18405-1');
  assert.ok(!executed.sql.includes('t.SELF_FLAG = :selfFlag'));
  assert.ok(!executed.sql.includes('FETCH FIRST 30'));
  assert.ok(Object.values(executed.params).includes('天猫'));
  assert.equal(closed, 1);
  sourceRows = rows.map(row => ({ DATE_PERIOD: row.date, TOTAL_ORDERS: row.orders, DELIVERY_RATE: row.deliveryRate }));
  const objectRows = await request({ dateFrom: options.dateFrom, dateTo: options.dateTo, days: '14' });
  assert.equal(objectRows.body.data.status, 'ready');
  assert.equal(objectRows.body.data.forecast.length, 14);
  assert.equal(objectRows.body.data.historical[0].orders, 100);
  assert.equal((await request({ dateFrom: options.dateFrom, dateTo: options.dateTo, days: '7x' })).status, 400);
  sourceRows = [];
  const empty = await request({ dateFrom: '2020-01-01', dateTo: '2099-12-31', days: '30', selfFlag: 'N' });
  assert.equal(empty.body.data.status, 'insufficient_data');
  assert.equal(empty.body.data.forecast.length, 0);
  assert.equal(empty.body.data.historical.length, 800);
  assert.equal(executed.params.selfFlag, 'N');
  const chinaToday = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  assert.ok(executed.params.dateTo < chinaToday);
  sourceRows = history(56, index => 100 + index).map((row, index) => {
    row.date = new Date(Date.UTC(2025, 8, 16 + index)).toISOString().slice(0, 10);
    return [row.date, row.orders, row.deliveryRate];
  });
  const promoResponse = await request({ dateFrom: '2025-09-16', dateTo: '2025-11-10', days: '7' });
  assert.equal(promoResponse.body.data.forecast.find(day => day.date === '2025-11-11').events[0], '双11大促');
  assert.ok(Date.parse(`${executed.params.dateTo}T00:00:00Z`) - Date.parse(`${executed.params.dateFrom}T00:00:00Z`) <= 799 * 86400000);
  assert.equal((await request({ dateFrom: '2099-01-01', dateTo: '2099-01-31' })).status, 400);
  console.log('forecast route: scope, filters, complete dates, horizon validation and empty history passed');
}

checkRoute().catch(error => { console.error(error); process.exitCode = 1; });
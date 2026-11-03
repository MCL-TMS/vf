const assert = require('node:assert/strict');
const calendarConfig = require('../config/forecast-calendar.json');
const { buildForecastCalendar, getUncoveredHolidayYears } = require('./forecastCalendar');

const calendar = buildForecastCalendar('2025-05-01', '2026-11-12', calendarConfig);
assert.equal(calendar.get('2025-06-18')[0].name, '618大促');
assert.equal(calendar.get('2025-11-11')[0].key, 'double-11');
assert.equal(calendar.get('2026-11-11')[0].type, 'promotion');
assert.equal(calendar.get('2026-02-18')[0].key, 'spring-festival');
assert.equal(calendar.get('2026-02-18')[0].offset, 3);
assert.equal(calendar.has('2027-01-01'), false);
assert.equal(buildForecastCalendar('2026-11-01', '2026-11-30', calendarConfig).get('2026-11-11')[0].name, '双11大促');
assert.deepEqual(getUncoveredHolidayYears('2026-12-30', '2027-01-02', calendarConfig), [2027]);
console.log('forecastCalendar: event windows and configured holidays passed');
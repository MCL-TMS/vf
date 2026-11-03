const DAY_MS = 86400000;

function dateNumber(value) {
  return Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
}

function dateString(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function addEvent(calendar, timestamp, event) {
  const date = dateString(timestamp);
  calendar.set(date, [...(calendar.get(date) || []), event]);
}

function buildForecastCalendar(dateFrom, dateTo, config = {}) {
  const start = dateNumber(dateFrom);
  const end = dateNumber(dateTo);
  const events = new Map();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return events;

  const startYear = new Date(start).getUTCFullYear();
  const endYear = new Date(end).getUTCFullYear();
  for (let year = startYear; year <= endYear; year++) {
    const promotions = [
      { key: '618', name: '618大促', start: `${year}-06-01`, anchor: `${year}-06-18`, end: `${year}-06-20` },
      { key: 'double-11', name: '双11大促', start: `${year}-10-20`, anchor: `${year}-11-11`, end: `${year}-11-11` },
      { key: 'double-12', name: '双12大促', start: `${year}-12-01`, anchor: `${year}-12-12`, end: `${year}-12-12` }
    ];
    for (const promotion of promotions) {
      for (let day = dateNumber(promotion.start); day <= dateNumber(promotion.end); day += DAY_MS) {
        addEvent(events, day, {
          type: 'promotion',
          key: promotion.key,
          name: promotion.name,
          offset: Math.round((day - dateNumber(promotion.anchor)) / DAY_MS)
        });
      }
    }
  }

  for (const holiday of config.holidayRanges || []) {
    for (let day = dateNumber(holiday.start); day <= dateNumber(holiday.end); day += DAY_MS) {
      addEvent(events, day, {
        type: 'holiday',
        key: holiday.key,
        name: holiday.name,
        offset: Math.round((day - dateNumber(holiday.start)) / DAY_MS)
      });
    }
  }

  const bounded = new Map();
  for (const [date, dateEvents] of events) {
    if (date >= dateFrom && date <= dateTo) bounded.set(date, dateEvents);
  }
  return bounded;
}

function getUncoveredHolidayYears(dateFrom, dateTo, config = {}) {
  const start = dateNumber(dateFrom);
  const end = dateNumber(dateTo);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  const coveredYears = new Set(config.holidayCalendarCoverage || []);
  const missingYears = [];
  for (let year = new Date(start).getUTCFullYear(); year <= new Date(end).getUTCFullYear(); year++) {
    if (!coveredYears.has(year)) missingYears.push(year);
  }
  return missingYears;
}

module.exports = { buildForecastCalendar, getUncoveredHolidayYears };
const DAY_MS = 86400000;

function dateNumber(value) {
  return Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
}

function eventBucketKey(event) {
  return `${event.type}:${event.key}`;
}

function learnEventEffects(values, historicalEvents) {
  const ratios = new Map();
  for (let index = 7; index < values.length; index++) {
    for (const event of historicalEvents[index] || []) {
      const peerValues = [];
      for (let previous = index - 7; previous >= Math.max(0, index - 56); previous -= 7) {
        if (!(historicalEvents[previous] || []).length) peerValues.push(values[previous]);
        if (peerValues.length === 4) break;
      }
      if (peerValues.length < 2) continue;
      const peerAverage = peerValues.reduce((sum, value) => sum + value, 0) / peerValues.length;
      if (peerAverage <= 0) continue;
      const keys = [
        `${eventBucketKey(event)}:${event.offset}`,
        `${eventBucketKey(event)}:*`
      ];
      for (const key of keys) {
        if (!ratios.has(key)) ratios.set(key, []);
        ratios.get(key).push(Math.max(0, Math.min(3, values[index] / peerAverage)));
      }
    }
  }
  return new Map([...ratios].map(([key, samples]) => [key, samples.reduce((sum, value) => sum + value, 0) / samples.length]));
}

function predict(values, horizon, model, firstWeekday = 0, historicalEvents = [], futureEvents = []) {
  const recent = values.slice(-28);
  const mean = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const weeklyMean = values.slice(-7).reduce((sum, value) => sum + value, 0) / Math.min(7, values.length);
  const recentFortnight = values.slice(-14);
  const previousFortnight = values.slice(-28, -14);
  const recentLevel = recentFortnight.reduce((sum, value) => sum + value, 0) / recentFortnight.length;
  const previousLevel = previousFortnight.length
    ? previousFortnight.reduce((sum, value) => sum + value, 0) / previousFortnight.length
    : recentLevel;
  const dailyTrend = (recentLevel - previousLevel) / Math.max(14, recentFortnight.length);
  const weekdayBuckets = Array.from({ length: 7 }, () => ({ total: 0, weight: 0 }));
  values.slice(-56).forEach((value, index, window) => {
    const position = values.length - window.length + index;
    if ((historicalEvents[position] || []).length) return;
    const ageDays = window.length - 1 - index;
    const weight = 1 / (1 + ageDays / 28);
    const bucket = weekdayBuckets[(firstWeekday + position) % 7];
    bucket.total += value * weight;
    bucket.weight += weight;
  });
  const weekdayAverages = weekdayBuckets.map(bucket => bucket.weight ? bucket.total / bucket.weight : 0);
  const weekdayBaseline = weekdayAverages.reduce((sum, value) => sum + value, 0) / 7;
  const weekdayAdjustments = weekdayAverages.map(value => value - weekdayBaseline);
  const eventModels = ['calendar', 'weekday_calendar'];
  const eventEffects = eventModels.includes(model) ? learnEventEffects(values, historicalEvents) : new Map();
  return Array.from({ length: horizon }, (_, index) => {
    let value = mean;
    if (model === 'recent') value = weeklyMean;
    if (model === 'weekly' || model === 'calendar') value = values[values.length - 7 + index % 7];
    if (model === 'drift') {
      const firstWeek = recent.slice(0, 7).reduce((sum, item) => sum + item, 0) / 7;
      const slope = (weeklyMean - firstWeek) / Math.max(1, recent.length - 7);
      value = weeklyMean + slope * (index + 4);
    }
    if (model === 'weekday_trend' || model === 'weekday_calendar') {
      const forecastWeekday = (firstWeekday + values.length + index) % 7;
      const forecastOffset = recentFortnight.length / 2 + index + 0.5;
      value = recentLevel + dailyTrend * forecastOffset;
    }
    if (!['weekly', 'calendar'].includes(model)) {
      const forecastWeekday = (firstWeekday + values.length + index) % 7;
      value += weekdayAdjustments[forecastWeekday];
    }
    if (eventModels.includes(model)) {
      for (const event of futureEvents[index] || []) {
        const exactEffect = eventEffects.get(`${eventBucketKey(event)}:${event.offset}`);
        const categoryEffect = eventEffects.get(`${eventBucketKey(event)}:*`);
        value *= exactEffect ?? categoryEffect ?? 1;
      }
    }
    return Math.max(0, Math.round(value));
  });
}

function buildOrderForecast(rows, { dateFrom, dateTo, days, calendar = new Map(), uncoveredHolidayYears = [] }) {
  const start = dateNumber(dateFrom);
  const end = dateNumber(dateTo);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end - start > 799 * DAY_MS) {
    throw new RangeError('历史窗口必须为1至800天');
  }
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new RangeError('预测天数必须为1至30');
  const byDate = new Map(rows.map(row => [row.date, row]));
  const historical = [];
  for (let timestamp = start; timestamp <= end; timestamp += DAY_MS) {
    const date = new Date(timestamp).toISOString().slice(0, 10);
    const row = byDate.get(date);
    historical.push({ date, orders: Math.max(0, Number(row?.orders) || 0), deliveryRate: Number(row?.deliveryRate) || 0, missing: !row });
  }
  const observed = historical.filter(row => !row.missing);
  const values = historical.map(row => row.orders);
  const historicalEvents = historical.map(row => calendar.get(row.date) || []);
  const total = values.reduce((sum, value) => sum + value, 0);
  const summary = {
    avgDailyOrders: Math.round(total / historical.length),
    avgDeliveryRate: total ? Math.round(historical.reduce((sum, row) => sum + row.orders * row.deliveryRate, 0) / total * 100) / 100 : 0,
    historyDays: historical.length,
    observedDays: observed.length,
    zeroFilledDays: historical.length - observed.length,
    lastObservedDate: observed.at(-1)?.date || null,
    forecastOrigin: dateTo,
    forecastPeriod: `${days} days`
  };
  const warnings = [];
  if (summary.zeroFilledDays) warnings.push(`${summary.zeroFilledDays}个无订单记录的日期按0单处理，请确认不是数据缺失。`);
  if (summary.lastObservedDate && summary.lastObservedDate !== dateTo) warnings.push(`最近有订单日期为${summary.lastObservedDate}，数据可能尚未同步。`);
  if (uncoveredHolidayYears.length) warnings.push(`节假日日历尚未配置${uncoveredHolidayYears.join('、')}年，请更新forecast-calendar.json；这些年份按已知规律性活动预测。`);
  if (historical.length < 21 || observed.length < 7 || total === 0) {
    return { status: 'insufficient_data', historical, forecast: [], summary, warnings, message: '至少需要21个完整自然日、7个有记录日期且存在订单，才能进行预测及回测。' };
  }
  const firstWeekday = new Date(start).getUTCDay();
  const models = { mean: '近28日均值 + 星期规律', recent: '近7日均值 + 星期规律', weekly: '周同期', drift: '近期趋势 + 星期规律', weekday_trend: '多周星期规律 + 近期趋势', calendar: '周同期 + 节假日/大促', weekday_calendar: '星期趋势 + 节假日/大促' };
  const validationHorizon = Math.min(days, 7);
  const originSet = new Set();
  for (let origin = values.length - validationHorizon; origin >= 14 && originSet.size < 4; origin -= validationHorizon) originSet.add(origin);
  for (let index = 56; index <= values.length - validationHorizon; index++) {
    const newEventStart = (historicalEvents[index] || []).some(event =>
      !(historicalEvents[index - 1] || []).some(previous => previous.type === event.type && previous.key === event.key)
    );
    if (newEventStart) originSet.add(index);
  }
  const origins = [...originSet].sort((left, right) => left - right);
  const scores = Object.entries(models).map(([id, name]) => {
    const errors = [];
    const leadErrors = Array.from({ length: validationHorizon }, () => []);
    const leadActualTotals = Array.from({ length: validationHorizon }, () => 0);
    let actualTotal = 0;
    origins.forEach(origin => {
      predict(
        values.slice(0, origin),
        validationHorizon,
        id,
        firstWeekday,
        historicalEvents.slice(0, origin),
        historicalEvents.slice(origin, origin + validationHorizon)
      ).forEach((value, index) => {
        const actual = values[origin + index];
        const absoluteError = Math.abs(actual - value);
        errors.push(absoluteError);
        leadErrors[index].push(absoluteError);
        leadActualTotals[index] += actual;
        actualTotal += actual;
      });
    });
    const absoluteError = errors.reduce((sum, value) => sum + value, 0);
    const leadWapes = leadErrors.map((leadValues, index) => {
      const leadAbsoluteError = leadValues.reduce((sum, value) => sum + value, 0);
      return leadActualTotals[index] ? leadAbsoluteError / leadActualTotals[index] * 100 : null;
    });
    return { id, name, errors, leadWapes, mae: absoluteError / errors.length, wape: actualTotal ? absoluteError / actualTotal * 100 : null };
  }).sort((left, right) => left.mae - right.mae);
  const best = scores[0];
  const relativeError = best.wape === null
    ? best.mae / Math.max(1, summary.avgDailyOrders) * 100
    : best.wape;
  if (days > validationHorizon) warnings.push(`回测仅覆盖未来${validationHorizon}天；更远期区间按预测步长扩展，未经同跨度验证。`);
  warnings.push('置信度分数由滚动回测WAPE和预测步长换算，不是概率或覆盖率保证。活动影响仅在日历已配置且历史同类活动通过回测时应用。');
  const forecastDates = Array.from({ length: days }, (_, index) => new Date(end + (index + 1) * DAY_MS).toISOString().slice(0, 10));
  const futureEvents = forecastDates.map(date => calendar.get(date) || []);
  const forecast = predict(values, days, best.id, firstWeekday, historicalEvents, futureEvents).map((predictedOrders, index) => {
    const horizonPenalty = Math.sqrt(Math.max(1, (index + 1) / validationHorizon));
    const leadError = best.leadWapes[index % validationHorizon] ?? relativeError;
    const confidence = Math.max(0, Math.min(100, Math.round(100 - leadError * horizonPenalty)));
    return {
      date: forecastDates[index],
      predictedOrders,
      confidence,
      events: futureEvents[index].map(event => event.name)
    };
  });
  const untrainedEvents = new Set();
  const eventModels = ['calendar', 'weekday_calendar'];
  const eventEffects = learnEventEffects(values, historicalEvents);
  futureEvents.forEach(events => events.forEach(event => {
    if (!eventEffects.has(`${eventBucketKey(event)}:${event.offset}`) && !eventEffects.has(`${eventBucketKey(event)}:*`)) {
      untrainedEvents.add(event.name);
    }
  }));
  if (!eventModels.includes(best.id) && futureEvents.some(events => events.length)) {
    warnings.push('预测日期包含节假日或大促，但滚动回测未证明事件修正优于基础模型，本次未额外调整单量。');
  }
  if (untrainedEvents.size) warnings.push(`以下活动缺少可比历史样本，预测未加活动修正：${[...untrainedEvents].join('、')}。`);
  return {
    status: 'ready', historical, forecast, summary: { ...summary, totalPredictedOrders: forecast.reduce((sum, row) => sum + row.predictedOrders, 0) }, warnings,
    model: { id: best.id, name: best.name },
    backtest: { method: 'rolling-origin', horizon: validationHorizon, folds: origins.length, samples: best.errors.length, mae: Math.round(best.mae), wape: best.wape === null ? null : Math.round(best.wape * 100) / 100, candidates: scores.map(({ errors, ...score }) => ({ ...score, mae: Math.round(score.mae) })) }
  };
}

module.exports = { buildOrderForecast };
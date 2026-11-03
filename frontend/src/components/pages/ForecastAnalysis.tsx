import { useEffect, useState } from 'react';
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { PageLoadingState } from '../PageLoadingState';
import { getTrendsForecast } from '../../services/apiService';
import type { DateRange } from '../../data/types';

interface ForecastData {
  status: 'ready' | 'insufficient_data';
  message?: string;
  historical: Array<{ date: string; orders: number }>;
  forecast: Array<{ date: string; predictedOrders: number; confidence: number; events?: string[] }>;
  summary: { avgDailyOrders: number; totalPredictedOrders?: number; historyDays: number; observedDays: number; forecastOrigin: string; lastObservedDate: string | null };
  model?: { name: string };
  backtest?: { mae: number; wape: number | null; horizon: number; samples: number; folds: number };
  warnings: string[];
}

interface ForecastAnalysisProps {
  dateRange: DateRange;
  brand: string | string[] | null;
  platform?: string | string[] | null;
  selfFlag?: string | null;
}

const number = (value: number | undefined) => value === undefined ? '--' : value.toLocaleString();

function getForecastHistoryRange(anchorTo: string): DateRange {
  const end = new Date(`${anchorTo.slice(0, 10)}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 799);
  const format = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { from: format(start), to: anchorTo };
}

export function ForecastAnalysis({ dateRange, brand, platform, selfFlag }: ForecastAnalysisProps) {
  const [days, setDays] = useState(7);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    getTrendsForecast({ dateRange: getForecastHistoryRange(dateRange.to), brand: brand || 'all', platform, selfFlag: selfFlag || 'Y', days, signal: controller.signal })
      .then(response => {
        if (!active) return;
        if (!response?.success || !response.data) throw new Error(response?.message || '预测数据获取失败');
        setData(response.data);
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : '预测数据获取失败');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [dateRange.from, dateRange.to, brand, platform, selfFlag, days, revision]);

  const historical = data?.historical.slice(-56) || [];
  const chartData = [
    ...historical.map((row, index) => ({ date: row.date, actual: row.orders, predicted: index === historical.length - 1 && data?.forecast.length ? row.orders : null })),
    ...(data?.forecast || []).map(row => ({ date: row.date, actual: null, predicted: row.predictedOrders }))
  ];

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-maersk-black">订单量预测</h2>
        <div className="flex items-center gap-3">
          <label htmlFor="forecast-days" className="text-sm text-muted-foreground">预测周期</label>
          <select id="forecast-days" value={days} onChange={event => setDays(Number(event.target.value))} className="h-9 rounded-md border border-functional-light-grey bg-maersk-white px-3 text-sm">
            <option value={7}>7天</option>
            <option value={14}>14天</option>
            <option value={30}>30天</option>
          </select>
          <Button variant="outline" size="icon" disabled={loading} onClick={() => setRevision(value => value + 1)} title="刷新预测" aria-label="刷新预测">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading || error ? (
        <PageLoadingState title={error ? '预测加载失败' : '预测计算中'} loading={loading} error={error} dataType="订单预测" onRetry={() => setRevision(value => value + 1)} minHeight="320px" />
      ) : data ? (
        <>
          <dl className="grid grid-cols-2 gap-4 border-y border-functional-light-grey py-4 lg:grid-cols-4">
            {[
              ['预测总单量', data.status === 'ready' ? number(data.summary.totalPredictedOrders) : '--'],
              ['历史日均单量', number(data.summary.avgDailyOrders)],
              ['回测加权绝对误差 WAPE', data.backtest?.wape == null ? '--' : `${data.backtest.wape.toFixed(1)}%`],
              ['回测平均绝对误差 MAE', data.backtest ? `${number(data.backtest.mae)} 单/日` : '--']
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground break-words">{label}</dt>
                <dd className="mt-2 text-xl font-semibold text-maersk-black break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span>训练区间：{data.historical[0]?.date} 至 {data.summary.forecastOrigin}</span>
            <span>完整自然日：{data.summary.historyDays} 天</span>
            <span>最近有订单日期：{data.summary.lastObservedDate || '--'}</span>
            {data.model && <span>回测选定模型：{data.model.name}</span>}
            {data.backtest && <span>滚动回测：{data.backtest.folds} 轮，每轮 {data.backtest.horizon} 天，{data.backtest.samples} 个样本</span>}
          </div>

          {data.status === 'insufficient_data' ? (
            <div role="status" className="border border-functional-light-grey rounded-md p-6 text-center text-muted-foreground">{data.message}</div>
          ) : (
            <>
              <Card className="maersk-card min-w-0">
                <CardHeader><CardTitle className="text-base text-maersk-black">历史订单与未来{days}天预测</CardTitle></CardHeader>
                <CardContent className="min-w-0">
                  <div className="h-80 w-full" role="img" aria-label="历史实际订单与预测订单趋势图">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tickFormatter={value => String(value).slice(5)} minTickGap={30} tick={{ fontSize: 11 }} />
                        <YAxis width={55} tick={{ fontSize: 11 }} tickFormatter={value => Number(value).toLocaleString()} />
                        <Tooltip formatter={(value: any, name: string) => [`${number(Number(value))} 单`, name]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line dataKey="actual" name="历史实际" stroke="#525252" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line dataKey="predicted" name="预测订单" stroke="#007FA3" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <caption className="text-left text-base font-semibold text-maersk-black pb-3">逐日预测</caption>
                  <thead className="border-b border-functional-light-grey text-muted-foreground">
                    <tr><th className="py-3 pr-4 whitespace-nowrap">日期</th><th className="py-3 px-3 text-right whitespace-nowrap">预测单量</th><th className="py-3 pl-3 text-right whitespace-nowrap" title="按该预测提前量的滚动回测误差计算，不代表概率">置信度</th></tr>
                  </thead>
                  <tbody>
                    {data.forecast.map(row => (
                      <tr key={row.date} className="border-b border-functional-light-grey">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <span>{row.date}</span>
                          {row.events?.map(event => <span key={event} className="ml-2 inline-flex rounded-sm bg-functional-bright-blue px-1.5 py-0.5 text-xs text-maersk-blue">{event}</span>)}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-maersk-blue">{number(row.predictedOrders)}</td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">{row.confidence}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {data.warnings.length > 0 && <div role="note" className="border-l-2 border-functional-light-grey pl-4 space-y-2 text-xs text-muted-foreground">{data.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>}
        </>
      ) : null}
    </div>
  );
}
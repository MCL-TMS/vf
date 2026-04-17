import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getWeightAnalysis } from '../services/apiService';

interface WeightDistributionChartProps {
  selectedBrand?: string;
  dateRange?: { from: string; to: string };
  timeRange?: string;
  weightType?: 'payable' | 'receivable';
  prefetchedData?: {
    overallStats?: { totalOrders?: number; avgWeight?: number; lightWeightRatio?: number } | null;
    weightRangeDistribution?: Array<{ range?: string; rangeKey?: string; orders?: number; avgWeight?: number }>;
  } | null;
}

interface ChartRow {
  range: string;
  orders: number;
  avgWeight: number;
}

function getDateRangeByLabel(label: string | undefined): { from: string; to: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  if (label === '上月') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      from: start.toISOString().split('T')[0],
      to: lastEnd.toISOString().split('T')[0]
    };
  }

  if (label === '近3月') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return {
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0]
    };
  }

  if (label === '近6月') {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return {
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0]
    };
  }

  if (label === '本年') {
    const start = new Date(now.getFullYear(), 0, 1);
    return {
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0]
    };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0]
  };
}

export function WeightDistributionChart({
  selectedBrand,
  dateRange: externalDateRange,
  timeRange,
  weightType = 'receivable',
  prefetchedData,
}: WeightDistributionChartProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [overall, setOverall] = useState<{ totalOrders?: number; avgWeight?: number; lightWeightRatio?: number } | null>(null);
  const hasPrefetchedData = Boolean(prefetchedData?.weightRangeDistribution && prefetchedData?.overallStats);

  const dateRange = useMemo(() => {
    if (externalDateRange?.from && externalDateRange?.to) {
      return externalDateRange;
    }

    return getDateRangeByLabel(timeRange);
  }, [externalDateRange, timeRange]);

  useEffect(() => {
    if (hasPrefetchedData) {
      const distribution = prefetchedData?.weightRangeDistribution || [];
      const chartRows: ChartRow[] = distribution.map((item) => ({
        range: item.range || item.rangeKey,
        orders: Number(item.orders || 0),
        avgWeight: Number(item.avgWeight || 0)
      }));

      setRows(chartRows);
      setOverall(prefetchedData?.overallStats || null);
      setError(null);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await getWeightAnalysis({
          dateRange,
          brand: selectedBrand && selectedBrand !== 'all' ? selectedBrand : 'all',
          selfFlag: 'Y',
          weightType,
          userId: user?.userId
        });

        const distribution = result?.data?.weightRangeDistribution || [];
        const chartRows: ChartRow[] = distribution.map((item: any) => ({
          range: item.range || item.rangeKey,
          orders: Number(item.orders || 0),
          avgWeight: Number(item.avgWeight || 0)
        }));

        setRows(chartRows);
        setOverall(result?.data?.overallStats || null);
      } catch (err: any) {
        setRows([]);
        setOverall(null);
        setError(err?.message || '重量分布加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [
    dateRange.from,
    dateRange.to,
    hasPrefetchedData,
    prefetchedData,
    selectedBrand,
    weightType,
    user?.userId,
  ]);

  return (
    <Card className="maersk-card shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>重量区间分布</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {weightType === 'payable' ? '应付计费重' : '应收计费重'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-72 flex items-center justify-center text-functional-mid-grey">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载重量数据中...
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center text-accent-dark-red">{error}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-functional-bright-grey rounded border border-functional-light-grey">
                <div className="text-xs text-functional-mid-grey">总订单量</div>
                <div className="text-lg font-semibold text-maersk-black">{(overall?.totalOrders || 0).toLocaleString()}</div>
              </div>
              <div className="p-3 bg-functional-bright-grey rounded border border-functional-light-grey">
                <div className="text-xs text-functional-mid-grey">平均计费重</div>
                <div className="text-lg font-semibold text-maersk-black">{Number(overall?.avgWeight || 0).toFixed(3)} kg</div>
              </div>
              <div className="p-3 bg-functional-bright-grey rounded border border-functional-light-grey">
                <div className="text-xs text-functional-mid-grey">轻重量包裹占比(1kg内)</div>
                <div className="text-lg font-semibold text-maersk-black">{Number(overall?.lightWeightRatio || 0).toFixed(2)}%</div>
              </div>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="orders" name="订单量" fill="#0288d1" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="avgWeight" name="平均计费重(kg)" fill="#26a69a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WeightDistributionChart;

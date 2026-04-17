import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart } from "recharts";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { FilteredData } from "../../utils/dataFilter";
import { getTrendsOrders, getTrendsForecast, getTrendsCarriers, getTrendsExceptions } from "../../services/apiService";
import type { DateRange } from "../../data/types";

interface TrendsPageProps {
  data: FilteredData;
  selectedBrand: string;
  dateRange?: DateRange;
  selfFlag?: string;
}

export function TrendsPage({ data: _data, selectedBrand, dateRange, selfFlag }: TrendsPageProps) {
  // AI分析建议的显示状态 - 默认隐藏
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  
  // 🔥 真实数据状态
  const [trendsData, setTrendsData] = useState<any[]>([]);
  const [courierTrendData, setCourierTrendData] = useState<any[]>([]);
  const [courierWeekSeries, setCourierWeekSeries] = useState<Array<{ key: string; label: string }>>([]);
  const [exceptionTrendData, setExceptionTrendData] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthAxisProps = {
    dataKey: 'month',
    interval: 0 as const,
    minTickGap: 0,
    padding: { left: 8, right: 24 },
    tickMargin: 8,
  };

  function getDefaultSixMonthsRange(): DateRange {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    return {
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0]
    };
  }

  const sixMonthsRange = getDefaultSixMonthsRange();
  const forecastSourceRange = dateRange || sixMonthsRange;
  const forecastDays = 7;

  // 快递公司周度表现：固定使用“当前自然月”范围，按周聚合后动态展示周数
  function getCurrentMonthRange(): DateRange {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0]
    };
  }

  // 异常趋势：在“当前筛选时间范围内”取最近N天，默认7天
  function getRecentDaysRangeWithin(baseRange: DateRange | undefined, days: number): DateRange {
    const today = new Date();

    const baseFrom = baseRange?.from ? new Date(baseRange.from) : null;
    const baseTo = baseRange?.to ? new Date(baseRange.to) : null;

    const endCandidate = baseTo && !Number.isNaN(baseTo.getTime()) ? baseTo : today;
    const end = endCandidate > today ? today : endCandidate;

    const rollingStart = new Date(end);
    rollingStart.setDate(end.getDate() - (days - 1));

    let start = rollingStart;
    if (baseFrom && !Number.isNaN(baseFrom.getTime()) && baseFrom > rollingStart) {
      start = baseFrom;
    }

    return {
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0]
    };
  }

  // 🔥 加载真实趋势数据
  useEffect(() => {
    loadTrendsData();
  }, [selectedBrand, dateRange?.from, dateRange?.to, selfFlag]);

  async function loadTrendsData() {
    try {
      setLoading(true);
      setError(null);

      // 调用真实API
      const [ordersResponse, carriersResponse, exceptionsResponse, forecastResponse] = await Promise.all([
        getTrendsOrders({
          dateRange: sixMonthsRange,
          brand: selectedBrand || 'all',
          granularity: 'month',
          selfFlag: selfFlag || 'Y'
        }),
        getTrendsCarriers({
          dateRange: getCurrentMonthRange(),
          brand: selectedBrand || 'all',
          granularity: 'week',
          selfFlag: selfFlag || 'Y'
        }),
        getTrendsExceptions({
          dateRange: getRecentDaysRangeWithin(dateRange, 7),
          brand: selectedBrand || 'all',
          granularity: 'day',
          selfFlag: selfFlag || 'Y'
        }),
        getTrendsForecast({
          dateRange: forecastSourceRange,
          brand: selectedBrand || 'all',
          days: forecastDays,
          selfFlag: selfFlag || 'Y'
        })
      ]);

      if (ordersResponse.success && ordersResponse.data) {
        // 转换API数据格式到图表需要的格式
        const chartData = ordersResponse.data.map((item: any) => ({
          month: item.timePeriod,
          orders: item.totalOrders || 0,
          delivered: item.deliveredOrders || 0,
          inTransit: item.inTransitOrders || 0,
          pending: item.pendingOrders || 0,
          returned: item.returnOrders || 0,
          cancelled: item.cancelledOrders || 0,
          deliveryRate: item.deliveryRate || 0, // 使用签收率作为增长率替代
        }));
        
        setTrendsData(chartData);
      }

      if (carriersResponse.success && carriersResponse.data) {
        const carrierRows = carriersResponse.data as any[];
        const periods = Array.from(new Set(carrierRows.map((row: any) => row.timePeriod))).sort();

        const carrierTotals = new Map<string, number>();
        carrierRows.forEach((row: any) => {
          const name = row.carrierName || row.carrierId || '未知快递';
          carrierTotals.set(name, (carrierTotals.get(name) || 0) + (row.totalOrders || 0));
        });

        const topCarriers = Array.from(carrierTotals.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name]) => name);

        const pivotedCarriers = topCarriers.map((carrierName) => {
          const row: Record<string, any> = { name: carrierName };
          periods.forEach((period, index) => {
            const matched = carrierRows.find(
              (item: any) => (item.carrierName || item.carrierId || '未知快递') === carrierName && item.timePeriod === period
            );
            row[`week${index + 1}`] = matched?.totalOrders || 0;
          });
          return row;
        });

        setCourierWeekSeries(periods.map((period, index) => ({ key: `week${index + 1}`, label: period })));
        setCourierTrendData(pivotedCarriers);
      }

      if (exceptionsResponse.success && exceptionsResponse.data) {
        const exceptionRows = (exceptionsResponse.data as any[]).map((row: any) => {
          const pickupDelay = row.pickupDelay || 0;
          const shipDelay = row.shipDelay || 0;
          const deliveryDelay = row.deliveryDelay || 0;

          return {
            date: row.timePeriod,
            pickupDelay,
            shipDelay,
            deliveryDelay,
            // 后端字段是 totalExceptions；若缺失则回退到旧字段或三类异常求和
            total: row.totalExceptions ?? row.total ?? (pickupDelay + shipDelay + deliveryDelay),
          };
        });
        setExceptionTrendData(exceptionRows);
      }

      if (forecastResponse.success && forecastResponse.data) {
        setForecastData(forecastResponse.data);
      }

    } catch (err: any) {
      console.error('❌ 加载趋势数据失败:', err);
      setError(err.message || '加载趋势数据失败');
    } finally {
      setLoading(false);
    }
  }

  function getExceptionAvg(key: 'pickupDelay' | 'shipDelay' | 'deliveryDelay' | 'total') {
    if (!exceptionTrendData.length) return 0;
    return Math.round(exceptionTrendData.reduce((sum: number, item: any) => sum + (item[key] || 0), 0) / exceptionTrendData.length);
  }

  // 加载中状态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-maersk-blue mx-auto mb-4" />
          <p className="text-muted-foreground">加载趋势数据中...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-red-500 mb-4">⚠️ 加载失败</div>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={loadTrendsData} className="mt-4">
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-maersk-black">📈 趋势分析</h1>
          <p className="text-muted-foreground">
            基于真实数据的订单处理历史趋势和未来预测
          </p>
        </div>
        {selectedBrand && (
          <Badge variant="outline" className="bg-functional-bright-blue text-maersk-blue border-maersk-blue">
            已筛选: {selectedBrand}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="monthly" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="monthly">月度趋势</TabsTrigger>
          <TabsTrigger value="courier">快递公司</TabsTrigger>
          <TabsTrigger value="exceptions">异常趋势</TabsTrigger>
          <TabsTrigger value="forecast">预测分析</TabsTrigger>
        </TabsList>

        {/* 月度趋势 */}
        <TabsContent value="monthly" className="space-y-6">
          {/* 🔥 组合图表：订单量（条形图）+ 签收率（折线图） */}
          <Card className="maersk-card">
            <CardHeader>
              <CardTitle className="text-maersk-black">订单量 & 签收率趋势（真实数据）</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis {...monthAxisProps} />
                    <YAxis yAxisId="left" label={{ value: '订单数', angle: -90, position: 'insideLeft' }} />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      label={{ value: '签收率 (%)', angle: 90, position: 'insideRight' }}
                      domain={[0, 100]}
                    />
                    <Tooltip />
                    <Legend />
                    
                    {/* 订单量 - 条形图 */}
                    <Bar 
                      yAxisId="left"
                      dataKey="orders" 
                      fill="var(--maersk-blue)" 
                      radius={[4, 4, 0, 0]} 
                      name="订单量"
                      fillOpacity={0.8}
                    />
                    
                    {/* 签收率 - 折线图 */}
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="deliveryRate" 
                      stroke="var(--accent-mid-green)" 
                      strokeWidth={3}
                      dot={{ fill: 'var(--accent-mid-green)', strokeWidth: 2, r: 6 }}
                      name="签收率 (%)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 订单状态趋势 */}
          <Card className="maersk-card">
            <CardHeader>
              <CardTitle className="text-maersk-black">订单状态趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendsData} margin={{ top: 8, right: 28, left: 8, bottom: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis {...monthAxisProps} />
                    <YAxis label={{ value: '订单数', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    
                    {/* 已签收 - 主要业务指标 */}
                    <Line 
                      type="monotone" 
                      dataKey="delivered" 
                      stroke="var(--accent-mid-green)" 
                      strokeWidth={3}
                      name="已签收"
                      dot={{ fill: 'var(--accent-mid-green)', strokeWidth: 2, r: 5 }}
                    />
                    
                    {/* 运输中 */}
                    <Line 
                      type="monotone" 
                      dataKey="inTransit" 
                      stroke="var(--maersk-blue)" 
                      strokeWidth={2.5}
                      name="运输中"
                      dot={{ fill: 'var(--maersk-blue)', strokeWidth: 2, r: 4 }}
                    />
                    
                    {/* 待处理 */}
                    <Line 
                      type="monotone" 
                      dataKey="pending" 
                      stroke="var(--functional-mid-grey)" 
                      strokeWidth={2}
                      name="待处理"
                      dot={{ fill: 'var(--functional-mid-grey)', strokeWidth: 2, r: 4 }}
                    />
                    
                    {/* 退货 */}
                    <Line 
                      type="monotone" 
                      dataKey="returned" 
                      stroke="var(--accent-mid-orange)" 
                      strokeWidth={2}
                      name="退货"
                      dot={{ fill: 'var(--accent-mid-orange)', strokeWidth: 2, r: 4 }}
                    />
                    
                    {/* 已取消 */}
                    <Line 
                      type="monotone" 
                      dataKey="cancelled" 
                      stroke="var(--accent-mid-red)" 
                      strokeWidth={2}
                      name="已取消"
                      dot={{ fill: 'var(--accent-mid-red)', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 快递公司趋势 */}
        <TabsContent value="courier" className="space-y-6">
          <Card className="maersk-card">
            <CardHeader>
              <CardTitle className="text-maersk-black">快递公司周度表现</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={courierTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {courierWeekSeries.map((series: { key: string; label: string }, index: number) => {
                      const palette = [
                        'var(--maersk-blue)',
                        'var(--functional-mid-blue)',
                        'var(--accent-mid-teal)',
                        'var(--accent-mid-green)',
                        'var(--accent-mid-orange)',
                        'var(--accent-mid-red)'
                      ];
                      return (
                        <Bar
                          key={series.key}
                          dataKey={series.key}
                          fill={palette[index % palette.length]}
                          name={series.label}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 异常趋势 */}
        <TabsContent value="exceptions" className="space-y-6">
          <Card className="maersk-card">
            <CardHeader>
              <CardTitle className="text-maersk-black">异常数量趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={exceptionTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="pickupDelay" 
                      stroke="var(--accent-mid-red)" 
                      strokeWidth={2}
                      name="揽收延迟"
                      dot={{ fill: 'var(--accent-mid-red)', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="shipDelay" 
                      stroke="var(--accent-mid-orange)" 
                      strokeWidth={2}
                      name="发运延迟"
                      dot={{ fill: 'var(--accent-mid-orange)', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="deliveryDelay" 
                      stroke="var(--accent-dark-red)" 
                      strokeWidth={2}
                      name="签收延迟"
                      dot={{ fill: 'var(--accent-dark-red)', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="var(--maersk-blue)" 
                      strokeWidth={3}
                      name="总异常"
                      dot={{ fill: 'var(--maersk-blue)', strokeWidth: 2, r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 异常类型统计分析 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="maersk-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-accent-bright-red rounded-full">
                    <div className="w-3 h-3 bg-accent-mid-red rounded-full"></div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-maersk-blue">
                      {getExceptionAvg('pickupDelay')}
                    </div>
                    <div className="text-sm text-foreground">揽收延迟</div>
                    <div className="text-xs text-muted-foreground">日均异常数</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="maersk-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-accent-bright-orange rounded-full">
                    <div className="w-3 h-3 bg-accent-mid-orange rounded-full"></div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-maersk-blue">
                      {getExceptionAvg('shipDelay')}
                    </div>
                    <div className="text-sm text-foreground">发运延迟</div>
                    <div className="text-xs text-muted-foreground">日均异常数</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="maersk-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-accent-bright-red rounded-full">
                    <div className="w-3 h-3 bg-accent-dark-red rounded-full"></div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-maersk-blue">
                      {getExceptionAvg('deliveryDelay')}
                    </div>
                    <div className="text-sm text-foreground">签收延迟</div>
                    <div className="text-xs text-muted-foreground">日均异常数</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="maersk-card">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-functional-bright-blue rounded-full">
                    <div className="w-3 h-3 bg-maersk-blue rounded-full"></div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-maersk-blue">
                      {getExceptionAvg('total')}
                    </div>
                    <div className="text-sm text-foreground">总异常数</div>
                    <div className="text-xs text-muted-foreground">日均总计</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 预测分析 */}
        <TabsContent value="forecast" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="maersk-card">
              <CardHeader>
                <CardTitle className="text-maersk-black">未来{forecastDays}天预测（基于真实数据）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {forecastData?.forecast?.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-foreground">{item.date}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-maersk-blue">
                          {item.predictedOrders?.toLocaleString() || 0}
                        </span>
                        <Badge variant="outline" className="border-maersk-blue text-maersk-blue">
                          置信度 {item.confidence || 0}%
                        </Badge>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center text-muted-foreground py-4">
                      暂无预测数据
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="maersk-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-maersk-black">AI 分析建议</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAIAnalysis(!showAIAnalysis)}
                    className="h-8 w-8 p-0 hover:bg-functional-bright-grey"
                    title={showAIAnalysis ? "隐藏AI分析" : "显示AI分析"}
                  >
                    {showAIAnalysis ? (
                      <Eye className="h-4 w-4 text-functional-mid-grey" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-functional-mid-grey" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showAIAnalysis ? (
                  <div className="space-y-3 text-sm">
                    <div className="p-3 bg-functional-bright-blue rounded-lg border border-functional-light-blue">
                      <strong className="text-maersk-blue">趋势预测:</strong>
                      <p className="text-foreground mt-1">
                        基于历史数据分析，平均每日订单量约 {forecastData?.summary?.avgDailyOrders?.toLocaleString() || 0} 单
                      </p>
                    </div>
                    <div className="p-3 bg-accent-bright-green rounded-lg border border-accent-light-green">
                      <strong className="text-maersk-blue">性能指标:</strong>
                      <p className="text-foreground mt-1">
                        平均签收率 {forecastData?.summary?.avgDeliveryRate || 0}%
                      </p>
                    </div>
                    <div className="p-3 bg-accent-bright-orange rounded-lg border border-accent-light-orange">
                      <strong className="text-maersk-blue">数据说明:</strong>
                      <p className="text-foreground mt-1">
                        预测基于当前筛选时间范围（{forecastSourceRange.from} 至 {forecastSourceRange.to}）的真实订单数据生成
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <EyeOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">AI分析建议已隐藏</p>
                    <p className="text-xs mt-1">点击眼睛图标可重新显示</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
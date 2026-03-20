import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Eye, EyeOff } from "lucide-react";
import { FilteredData } from "../../utils/dataFilter";
import { brandOrderData } from "../../data/brandData";

interface TrendsPageProps {
  data: FilteredData;
  selectedBrand: string;
}

export function TrendsPage({ data, selectedBrand }: TrendsPageProps) {
  // AI分析建议的显示状态 - 默认隐藏
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  
  // 模拟趋势数据
  const monthlyTrendData = [
    { month: '1月', orders: 41240, growth: 8.2, shipped: 38650, returned: 2590 },
    { month: '2月', orders: 38650, growth: 12.5, shipped: 36200, returned: 2450 },
    { month: '3月', orders: 45880, growth: 15.3, shipped: 43320, returned: 2560 },
    { month: '4月', orders: 48920, growth: 18.7, shipped: 46580, returned: 2340 },
    { month: '5月', orders: 52340, growth: 22.1, shipped: 50120, returned: 2220 },
    { month: '6月', orders: 49870, growth: 19.4, shipped: 47890, returned: 1980 }
  ];

  const courierTrendData = [
    { name: '中通', week1: 1200, week2: 1350, week3: 1180, week4: 1420 },
    { name: '顺丰', week1: 980, week2: 1020, week3: 1150, week4: 1280 },
    { name: '韵达', week1: 650, week2: 720, week3: 680, week4: 780 },
    { name: '申通', week1: 420, week2: 450, week3: 380, week4: 520 }
  ];

  const exceptionTrendData = [
    { date: '06-01', pickupDelay: 15, shipDelay: 23, deliveryDelay: 28, total: 66 },
    { date: '06-02', pickupDelay: 12, shipDelay: 18, deliveryDelay: 22, total: 52 },
    { date: '06-03', pickupDelay: 18, shipDelay: 25, deliveryDelay: 35, total: 78 },
    { date: '06-04', pickupDelay: 8, shipDelay: 15, deliveryDelay: 19, total: 42 },
    { date: '06-05', pickupDelay: 22, shipDelay: 30, deliveryDelay: 41, total: 93 },
    { date: '06-06', pickupDelay: 16, shipDelay: 20, deliveryDelay: 25, total: 61 },
    { date: '06-07', pickupDelay: 14, shipDelay: 19, deliveryDelay: 31, total: 64 }
  ];

  // 如果选择了品牌，使用品牌特定数据
  const brandTrendData = selectedBrand ? 
    brandOrderData.find(b => b.name === selectedBrand)?.monthlyTrend || monthlyTrendData :
    monthlyTrendData;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-maersk-black">📈 趋势分析</h1>
          <p className="text-muted-foreground">
            分析订单处理的历史趋势和未来预测
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="maersk-card">
              <CardHeader>
                <CardTitle className="text-maersk-black">订单量趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={brandTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [value, '订单数']} />
                      <Line 
                        type="monotone" 
                        dataKey="orders" 
                        stroke="var(--maersk-blue)" 
                        strokeWidth={3}
                        dot={{ fill: 'var(--maersk-blue)', strokeWidth: 2, r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="maersk-card">
              <CardHeader>
                <CardTitle className="text-maersk-black">增长率趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={brandTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value}%`, '增长率']} />
                      <Bar dataKey="growth" fill="var(--accent-mid-green)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="maersk-card">
            <CardHeader>
              <CardTitle className="text-maersk-black">订单状态趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="shipped" 
                      stackId="1" 
                      stroke="var(--maersk-blue)" 
                      fill="var(--maersk-blue)" 
                      fillOpacity={0.8}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="returned" 
                      stackId="1" 
                      stroke="var(--accent-mid-red)" 
                      fill="var(--accent-mid-red)" 
                      fillOpacity={0.8}
                    />
                  </AreaChart>
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
                    <Bar dataKey="week1" fill="var(--maersk-blue)" name="第1周" />
                    <Bar dataKey="week2" fill="var(--functional-mid-blue)" name="第2周" />
                    <Bar dataKey="week3" fill="var(--accent-mid-teal)" name="第3周" />
                    <Bar dataKey="week4" fill="var(--accent-mid-green)" name="第4周" />
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
                      {Math.round(exceptionTrendData.reduce((sum, item) => sum + item.pickupDelay, 0) / exceptionTrendData.length)}
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
                      {Math.round(exceptionTrendData.reduce((sum, item) => sum + item.shipDelay, 0) / exceptionTrendData.length)}
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
                      {Math.round(exceptionTrendData.reduce((sum, item) => sum + item.deliveryDelay, 0) / exceptionTrendData.length)}
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
                      {Math.round(exceptionTrendData.reduce((sum, item) => sum + item.total, 0) / exceptionTrendData.length)}
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
                <CardTitle className="text-maersk-black">未来7天预测</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6, 7].map(day => (
                    <div key={day} className="flex justify-between items-center">
                      <span className="text-foreground">第{day}天</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-maersk-blue">
                          {Math.round(48920 + (Math.random() - 0.5) * 5000).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="border-maersk-blue text-maersk-blue">
                          {(Math.random() * 40 - 20).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
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
                        基于历史数据分析，预计下个月订单量将增长15-20%
                      </p>
                    </div>
                    <div className="p-3 bg-accent-bright-green rounded-lg border border-accent-light-green">
                      <strong className="text-maersk-blue">优化建议:</strong>
                      <p className="text-foreground mt-1">
                        建议提前调配快递资源，重点关注中通和顺丰的产能
                      </p>
                    </div>
                    <div className="p-3 bg-accent-bright-orange rounded-lg border border-accent-light-orange">
                      <strong className="text-maersk-blue">风险提醒:</strong>
                      <p className="text-foreground mt-1">
                        签收延迟异常呈上升趋势，建议重点关注末端配送环节和客户沟通机制
                      </p>
                    </div>
                    <div className="p-3 bg-accent-bright-red rounded-lg border border-accent-light-red">
                      <strong className="text-maersk-blue">签收延迟分析:</strong>
                      <p className="text-foreground mt-1">
                        签收延迟是当前最主要的异常类型，占总异常数约45%，建议优化末端配送策略
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
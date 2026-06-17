import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Alert, AlertDescription } from "./ui/alert";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { BrandOrderData } from "../data/brandData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

interface BrandDetailDialogProps {
  brand: BrandOrderData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16', '#f59e0b'];

export function BrandDetailDialog({ brand, open, onOpenChange }: BrandDetailDialogProps) {
  if (!brand) return null;

  const getTrendIcon = (value: number) => {
    return value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
  };

  const getTrendColor = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const totalExceptions = brand.exceptions.reduce((sum, ex) => sum + ex.count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <span className="text-2xl">{brand.logo}</span>
            <div>
              <div className="text-xl">{brand.name} 品牌订单详情</div>
              <div className="text-sm text-muted-foreground font-normal">
                总订单数: {brand.totalOrders.toLocaleString()}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            查看 {brand.name} 品牌的完整订单数据，包括物流状态、区域分布、异常监控等详细信息。
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="logistics">物流状态</TabsTrigger>
            <TabsTrigger value="distribution">分布情况</TabsTrigger>
            <TabsTrigger value="trends">趋势分析</TabsTrigger>
            <TabsTrigger value="exceptions">异常监控</TabsTrigger>
          </TabsList>

          {/* 总览 */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">已揽收</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{brand.kpiData.picked.value.toLocaleString()}</div>
                  <div className="flex items-center space-x-1 text-xs mt-1">
                    <span className="text-muted-foreground">环比:</span>
                    <div className={`flex items-center space-x-1 ${getTrendColor(brand.kpiData.picked.change.mom)}`}>
                      {getTrendIcon(brand.kpiData.picked.change.mom)}
                      <span>{Math.abs(brand.kpiData.picked.change.mom)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">已发运</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{brand.kpiData.shipped.value.toLocaleString()}</div>
                  <div className="flex items-center space-x-1 text-xs mt-1">
                    <span className="text-muted-foreground">环比:</span>
                    <div className={`flex items-center space-x-1 ${getTrendColor(brand.kpiData.shipped.change.mom)}`}>
                      {getTrendIcon(brand.kpiData.shipped.change.mom)}
                      <span>{Math.abs(brand.kpiData.shipped.change.mom)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">已转寄</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{brand.kpiData.forwarded.value.toLocaleString()}</div>
                  <div className="flex items-center space-x-1 text-xs mt-1">
                    <span className="text-muted-foreground">环比:</span>
                    <div className={`flex items-center space-x-1 ${getTrendColor(brand.kpiData.forwarded.change.mom)}`}>
                      {getTrendIcon(brand.kpiData.forwarded.change.mom)}
                      <span>{Math.abs(brand.kpiData.forwarded.change.mom)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">已退回</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{brand.kpiData.returned.value.toLocaleString()}</div>
                  <div className="flex items-center space-x-1 text-xs mt-1">
                    <span className="text-muted-foreground">环比:</span>
                    <div className={`flex items-center space-x-1 ${getTrendColor(brand.kpiData.returned.change.mom)}`}>
                      {getTrendIcon(brand.kpiData.returned.change.mom)}
                      <span>{Math.abs(brand.kpiData.returned.change.mom)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">已取消</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">{brand.kpiData.cancelled.value.toLocaleString()}</div>
                  <div className="flex items-center space-x-1 text-xs mt-1">
                    <span className="text-muted-foreground">环比:</span>
                    <div className={`flex items-center space-x-1 ${getTrendColor(brand.kpiData.cancelled.change.mom)}`}>
                      {getTrendIcon(brand.kpiData.cancelled.change.mom)}
                      <span>{Math.abs(brand.kpiData.cancelled.change.mom)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 异常提醒 */}
            {totalExceptions > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {brand.name} 品牌当前有 <strong>{totalExceptions}</strong> 个异常需要关注
                </AlertDescription>
              </Alert>
            )}

            {/* 热门目的地 */}
            <Card>
              <CardHeader>
                <CardTitle>热门配送城市 TOP 5</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {brand.topDestinations.map((dest, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span>{dest.city}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{dest.orders.toLocaleString()}</span>
                        <Badge variant="outline">{dest.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 物流状态 */}
          <TabsContent value="logistics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>快递公司分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={brand.courierDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          dataKey="orders"
                          label={({ name, percentage }) => `${name} ${percentage}%`}
                        >
                          {brand.courierDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, '订单数']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>快递公司表现</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {brand.courierDistribution.map((courier, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{courier.name}</span>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{courier.orders.toLocaleString()} 单</Badge>
                            <Badge variant={courier.performance.exceptions <= 10 ? "default" : "destructive"}>
                              异常 {courier.performance.exceptions}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="flex justify-between mb-1">
                              <span>揽收率</span>
                              <span>{courier.performance.pickupRate}%</span>
                            </div>
                            <Progress value={courier.performance.pickupRate} className="h-1" />
                          </div>
                          <div>
                            <div className="flex justify-between mb-1">
                              <span>发运率</span>
                              <span>{courier.performance.shippingRate}%</span>
                            </div>
                            <Progress value={courier.performance.shippingRate} className="h-1" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 分布情况 */}
          <TabsContent value="distribution" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>区域分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={brand.regionalDistribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="region" />
                        <YAxis />
                        <Tooltip formatter={(value) => [value, '订单数']} />
                        <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>区域增长情况</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {brand.regionalDistribution.map((region, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{region.region}</span>
                          <div className="text-sm text-muted-foreground">
                            {region.orders.toLocaleString()} 单 ({region.percentage}%)
                          </div>
                        </div>
                        <div className={`flex items-center space-x-1 ${getTrendColor(region.growth)}`}>
                          {getTrendIcon(region.growth)}
                          <span className="font-medium">{region.growth}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 趋势分析 */}
          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>月度订单趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={brand.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [value, '订单数']} />
                      <Line 
                        type="monotone" 
                        dataKey="orders" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>月度增长率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={brand.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value}%`, '增长率']} />
                      <Bar dataKey="growth" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 异常监控 */}
          <TabsContent value="exceptions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {brand.exceptions.map((exception, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{exception.type}</span>
                      <Badge variant={exception.count > 20 ? "destructive" : "outline"}>
                        {exception.count}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {exception.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">趋势变化:</span>
                        <div className={`flex items-center space-x-1 ${getTrendColor(exception.trend)}`}>
                          {getTrendIcon(exception.trend)}
                          <span className="text-sm font-medium">{Math.abs(exception.trend)}%</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalExceptions > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <span>异常处理建议</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {brand.exceptions.map((exception, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <Badge variant="outline" className="mt-0.5">{exception.type}</Badge>
                        <div className="flex-1">
                          {exception.type === '超时未揽收' && (
                            <span>建议: 与快递公司沟通优化揽收时效，建立实时监控机制</span>
                          )}
                          {exception.type === '超时未发运' && (
                            <span>建议: 加强中转站点协调，提升分拣效率</span>
                          )}
                          {exception.type.includes('异常') && (
                            <span>建议: 加强质检流程，优化包装标准</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Badge } from "./ui/badge";
import { Calendar, Package, Target, TrendingUp, Truck } from "lucide-react";
import { logisticsOrders, filterValidOrders } from "../data/logisticsOrderData";
import { vfBrands, courierCompanies } from "../data/slaData";
import { useMemo } from "react";

interface C2DTimeChartProps {
  selectedBrand?: string;
}

interface CourierC2DData {
  courier: string;
  brand?: string;
  "1d": number;
  "2d": number;
  "3d": number;
  "3+d": number;
  totalOrders: number;
  avgTime: number;
  completionRate: number;
}

export function C2DTimeChart({ selectedBrand }: C2DTimeChartProps) {
  // 生成按快递商分组的C2D统计数据
  const courierC2DStats = useMemo(() => {
    const validOrders = filterValidOrders(logisticsOrders).filter(order => 
      order.actualC2D !== undefined && order.planC2D !== undefined && order.status === 'delivered'
    );

    // 如果选择了品牌，则过滤订单
    const filteredOrders = selectedBrand ? 
      validOrders.filter(order => order.brand === selectedBrand) : 
      validOrders;

    const courierData: CourierC2DData[] = [];

    courierCompanies.forEach(courier => {
      const courierOrders = filteredOrders.filter(order => order.courierCompany === courier);
      
      if (courierOrders.length > 0) {
        // 按C2D时效分类（天数）
        const time1d = courierOrders.filter(order => order.actualC2D! <= 24).length;
        const time2d = courierOrders.filter(order => order.actualC2D! > 24 && order.actualC2D! <= 48).length;
        const time3d = courierOrders.filter(order => order.actualC2D! > 48 && order.actualC2D! <= 72).length;
        const time3Plus = courierOrders.filter(order => order.actualC2D! > 72).length;
        
        const totalOrders = courierOrders.length;
        const avgTime = courierOrders.reduce((sum, order) => sum + order.actualC2D!, 0) / totalOrders;
        const avgPlanTime = courierOrders.reduce((sum, order) => sum + order.planC2D!, 0) / totalOrders;
        const completionRate = avgPlanTime > 0 ? (avgPlanTime / avgTime) * 100 : 100;

        courierData.push({
          courier,
          "1d": time1d,
          "2d": time2d,
          "3d": time3d,
          "3+d": time3Plus,
          totalOrders,
          avgTime: avgTime / 24, // 转换为天数
          completionRate: Math.min(completionRate, 150) // 限制最大值为150%
        });
      }
    });

    return courierData.sort((a, b) => b.totalOrders - a.totalOrders);
  }, [selectedBrand]);

  // 生成按品牌分组的快递商数据（当没有选择品牌时）
  const brandCourierStats = useMemo(() => {
    if (selectedBrand) return [];

    const validOrders = filterValidOrders(logisticsOrders).filter(order => 
      order.actualC2D !== undefined && order.planC2D !== undefined && order.status === 'delivered'
    );

    const brandData: Record<string, CourierC2DData[]> = {};

    vfBrands.forEach(brand => {
      const brandOrders = validOrders.filter(order => order.brand === brand);
      const brandCourierData: CourierC2DData[] = [];

      courierCompanies.forEach(courier => {
        const courierOrders = brandOrders.filter(order => order.courierCompany === courier);
        
        if (courierOrders.length > 0) {
          const time1d = courierOrders.filter(order => order.actualC2D! <= 24).length;
          const time2d = courierOrders.filter(order => order.actualC2D! > 24 && order.actualC2D! <= 48).length;
          const time3d = courierOrders.filter(order => order.actualC2D! > 48 && order.actualC2D! <= 72).length;
          const time3Plus = courierOrders.filter(order => order.actualC2D! > 72).length;
          
          const totalOrders = courierOrders.length;
          const avgTime = courierOrders.reduce((sum, order) => sum + order.actualC2D!, 0) / totalOrders;
          const avgPlanTime = courierOrders.reduce((sum, order) => sum + order.planC2D!, 0) / totalOrders;
          const completionRate = avgPlanTime > 0 ? (avgPlanTime / avgTime) * 100 : 100;

          brandCourierData.push({
            courier,
            brand,
            "1d": time1d,
            "2d": time2d,
            "3d": time3d,
            "3+d": time3Plus,
            totalOrders,
            avgTime: avgTime / 24, // 转换为天数
            completionRate: Math.min(completionRate, 150)
          });
        }
      });

      brandData[brand] = brandCourierData.sort((a, b) => b.totalOrders - a.totalOrders);
    });

    return brandData;
  }, [selectedBrand]);

  // 计算总体指标
  const totalStats = useMemo(() => {
    const totalOrders = courierC2DStats.reduce((sum, courier) => sum + courier.totalOrders, 0);
    const weightedAvgTime = courierC2DStats.reduce((sum, courier) => sum + courier.avgTime * courier.totalOrders, 0) / totalOrders || 0;
    const avgCompletionRate = courierC2DStats.reduce((sum, courier) => sum + courier.completionRate * courier.totalOrders, 0) / totalOrders || 0;
    
    return {
      totalOrders,
      avgC2DTime: weightedAvgTime,
      avgCompletionRate
    };
  }, [courierC2DStats]);

  // 快递商图标
  const getCourierIcon = (courierName: string) => {
    const iconMap: Record<string, string> = {
      '顺丰速运': '🚀',
      '中通快递': '🚚'
    };
    return iconMap[courierName] || '📦';
  };

  // 品牌图标
  const getBrandIcon = (brandName: string) => {
    const brandIcons: Record<string, string> = {
      'TNF': '🏔️',
      'DICKIES': '👔',
      'VANS': '👟',
      'TIMBERLAND': '🥾',
      'ICEBREAKER': '🧊',
      'KIPLING': '🎒'
    };
    return brandIcons[brandName] || '🏷️';
  };

  return (
    <div className="space-y-6">
      {/* 总体概览指标 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Total Orders</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{totalStats.totalOrders.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">C2D总订单数</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Average C2D Time</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{totalStats.avgC2DTime.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">天</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Completion Rate</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{totalStats.avgCompletionRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">平均完成率</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="courier" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="courier" className="flex items-center space-x-2">
            <Truck className="h-4 w-4" />
            <span>快递商分析</span>
          </TabsTrigger>
          <TabsTrigger value="brand" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>品牌×快递商</span>
          </TabsTrigger>
        </TabsList>

        {/* 快递商分析 */}
        <TabsContent value="courier" className="space-y-6">
          {/* 快递商C2D时效分布图 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <span>C2D时效分布 - 按快递商</span>
                {selectedBrand && (
                  <Badge variant="outline" className="ml-2">
                    {selectedBrand} 品牌
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedBrand 
                  ? `${selectedBrand} 品牌的C2D时效分析`
                  : '各品牌C2D时效分析'
                }
              </p>
            </CardHeader>
            
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={courierC2DStats}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="courier" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#666' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#666' }}
                    label={{ 
                      value: '订单数量', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle' }
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(), 
                      `${name} 时效`
                    ]}
                    labelFormatter={(label) => `快递商: ${label}`}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="1d" stackId="a" fill="#22c55e" name="1d" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="2d" stackId="a" fill="#3b82f6" name="2d" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="3d" stackId="a" fill="#f59e0b" name="3d" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="3+d" stackId="a" fill="#ef4444" name="3+d" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 快递商详细数据卡片 */}
          <div className="grid grid-cols-2 gap-6">
            {courierC2DStats.map((courier, index) => (
              <Card key={index} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-lg">{getCourierIcon(courier.courier)}</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">{courier.courier}</CardTitle>
                        <div className="text-sm text-muted-foreground">
                          平均时效: {courier.avgTime.toFixed(1)}天
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="bg-purple-50">
                        {courier.totalOrders.toLocaleString()}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">总订单</div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* 时效分布条形图 */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span>1天 ({courier["1d"]})</span>
                      <span>{((courier["1d"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${(courier["1d"] / courier.totalOrders) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span>2天 ({courier["2d"]})</span>
                      <span>{((courier["2d"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${(courier["2d"] / courier.totalOrders) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span>3天 ({courier["3d"]})</span>
                      <span>{((courier["3d"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full" 
                        style={{ width: `${(courier["3d"] / courier.totalOrders) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span>3天+ ({courier["3+d"]})</span>
                      <span>{((courier["3+d"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{ width: `${(courier["3+d"] / courier.totalOrders) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* 表现评级 */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium">完成率:</span>
                    <div className="flex items-center space-x-2">
                      <span className={`font-bold ${
                        courier.completionRate >= 100 ? 'text-green-600' : 
                        courier.completionRate >= 90 ? 'text-blue-600' : 
                        courier.completionRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {courier.completionRate.toFixed(1)}%
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          courier.completionRate >= 100 ? 'bg-green-50 text-green-700 border-green-300' : 
                          courier.completionRate >= 90 ? 'bg-blue-50 text-blue-700 border-blue-300' : 
                          courier.completionRate >= 80 ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : 
                          'bg-red-50 text-red-700 border-red-300'
                        }`}
                      >
                        {courier.completionRate >= 100 ? '优秀' : 
                         courier.completionRate >= 90 ? '良好' : 
                         courier.completionRate >= 80 ? '一般' : '待改进'}
                      </Badge>
                    </div>
                  </div>

                  {/* 快速配送指标 */}
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">快速配送率 (≤2天):</span>
                      <span className="font-medium text-purple-600">
                        {(((courier["1d"] + courier["2d"]) / courier.totalOrders) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 品牌×快递商分析 */}
        <TabsContent value="brand" className="space-y-6">
          {selectedBrand ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Package className="h-12 w-12 mx-auto opacity-30 mb-4" />
                <h4 className="font-medium mb-2">单品牌视图</h4>
                <p className="text-sm text-muted-foreground">
                  当前已选择 {selectedBrand} 品牌，请查看"快递商分析"标签页了解该品牌的快递商表现详情。
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {vfBrands.slice(0, 4).map(brand => {
                const brandData = brandCourierStats[brand] || [];
                if (brandData.length === 0) return null;

                return (
                  <Card key={brand}>
                    <CardHeader>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getBrandIcon(brand)}</span>
                        <CardTitle>{brand} 品牌 - 快递商C2D表现</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={brandData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                          barCategoryGap="30%"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="courier" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#666' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#666' }}
                            label={{ 
                              value: '订单数量', 
                              angle: -90, 
                              position: 'insideLeft',
                              style: { textAnchor: 'middle' }
                            }}
                          />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              value.toLocaleString(), 
                              `${name} 时效`
                            ]}
                            labelFormatter={(label) => `${brand} - ${label}`}
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }}
                          />
                          <Legend />
                          <Bar dataKey="1d" stackId="a" fill="#22c55e" name="1d" />
                          <Bar dataKey="2d" stackId="a" fill="#3b82f6" name="2d" />
                          <Bar dataKey="3d" stackId="a" fill="#f59e0b" name="3d" />
                          <Bar dataKey="3+d" stackId="a" fill="#ef4444" name="3+d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 快速配送表现分析 */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>快速配送表现对比</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {courierC2DStats.map((courier, index) => {
                const fastDelivery = courier["1d"] + courier["2d"]; // 1天 + 2天
                const fastRate = courier.totalOrders > 0 ? (fastDelivery / courier.totalOrders) * 100 : 0;
                
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getCourierIcon(courier.courier)}</span>
                      <span className="font-medium">{courier.courier}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-purple-600">{fastRate.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">2天内配送</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>C2D指标说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-3">
              <div>
                <h5 className="font-medium text-foreground mb-1">C2D (Customer to Delivery):</h5>
                <p>从消费者付款到最终签收的完整配送时间，包含所有环节</p>
              </div>
              
              <div>
                <h5 className="font-medium text-foreground mb-1">时效分类标准：</h5>
                <ul className="space-y-1 list-disc list-inside ml-2">
                  <li><span className="text-green-600">1d</span>：1天内送达（当日达）</li>
                  <li><span className="text-blue-600">2d</span>：2天内送达（次日达）</li>
                  <li><span className="text-yellow-600">3d</span>：3天内送达（标准配送）</li>
                  <li><span className="text-red-600">3+d</span>：超过3天（延期配送）</li>
                </ul>
              </div>

              <div>
                <h5 className="font-medium text-foreground mb-1">快递商表现评级：</h5>
                <ul className="space-y-1 list-disc list-inside ml-2">
                  <li><span className="text-green-600">优秀</span>：完成率 ≥ 100%</li>
                  <li><span className="text-blue-600">良好</span>：完成率 ≥ 90%</li>
                  <li><span className="text-yellow-600">一般</span>：完成率 ≥ 80%</li>
                  <li><span className="text-red-600">待改进</span>：完成率 &lt; 80%</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* C2D指标说明 */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">
            <h4 className="font-medium mb-2 text-foreground">C2D (Customer to Delivery) 时效分析说明：</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-foreground mb-1">分析重点：</h5>
                <ul className="space-y-1 list-disc list-inside">
                  <li>C2D包含订单处理、仓储、配送全链路</li>
                  <li>反映消费者从下单到收货的完整体验</li>
                  <li>绿色和蓝色区域占比越高表示服务越好</li>
                  <li>快速配送率（≤2天）是重要竞争指标</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-foreground mb-1">优化建议：</h5>
                <ul className="space-y-1 list-disc list-inside">
                  <li>关注红色区域（3+天）占比高的快递商</li>
                  <li>重点提升2天内配送率</li>
                  <li>根据品牌特性选择最适合的快递商</li>
                  <li>定期评估和调整快递商合作策略</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 p-2 bg-purple-50 rounded text-purple-700">
              💡 <strong>分析说明</strong>：C2D反映完整的消费者体验。
              快速配送率直接影响客户满意度。
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
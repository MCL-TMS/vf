import { EnhancedKPICard } from "../EnhancedKPICard";
import { ImpactChart } from "../ImpactChart";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { AlertTriangle, Clock, CheckCircle, Shield, TrendingUp, TrendingDown, Package, Truck, BarChart3, ArrowRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { OrderKPIData } from "../../data/orderData";
import { FilteredData } from "../../utils/dataFilter";

interface OverviewDashboardProps {
  data: FilteredData;
  selectedBrand: string;
  selectedPlatform?: string;
  onKPIDetailClick: (data: OrderKPIData) => void;
  onExceptionClick?: (exceptionType: string, brand?: string, courier?: string) => void;
}

export function OverviewDashboard({ data, selectedBrand, selectedPlatform, onKPIDetailClick, onExceptionClick }: OverviewDashboardProps) {
  // 安全获取KPI数据的辅助函数
  const getKPIByLabel = (label: string) => {
    return data.kpiData.find(kpi => kpi.label === label);
  };

  // 计算异常数据
  const totalPickupExceptions = data.courierData.reduce((sum, courier) => sum + courier.exceptions.notPickedOver2h, 0);
  const totalShippingExceptions = data.courierData.reduce((sum, courier) => sum + courier.exceptions.notShippedOver12h, 0);
  const totalNoUpdate48hExceptions = data.courierData.reduce((sum, courier) => sum + courier.exceptions.notUpdatedOver48h, 0);
  const totalDeliveryExceptions = data.courierData.reduce((sum, courier) => sum + courier.exceptions.notDeliveredOver3days, 0);
  
  // 获取各个KPI数据
  const pickedKPI = getKPIByLabel('已揽收');
  const shippedKPI = getKPIByLabel('已发运');
  const deliveredKPI = getKPIByLabel('已签收');
  const forwardedKPI = getKPIByLabel('已转寄');
  const returnedKPI = getKPIByLabel('已退回');
  const cancelledKPI = getKPIByLabel('已取消');

  // 计算总订单数（使用品牌统计中的总订单数）
  const totalOrders = data.brandStats.totalOrders;

  // 状态占比数据 - 使用马士基配色方案，按业务流程顺序排列
  const statusDistribution = [
    { 
      name: '已揽收', 
      value: pickedKPI ? parseInt(pickedKPI.value.replace(/,/g, '')) : 0, 
      color: '#119c85' // accent-mid-teal: 青绿色 - 起始状态
    },
    { 
      name: '已发运', 
      value: shippedKPI ? parseInt(shippedKPI.value.replace(/,/g, '')) : 0, 
      color: '#42b0d5' // maersk-blue: 蓝色 - 运输状态
    },
    { 
      name: '已签收', 
      value: deliveredKPI ? parseInt(deliveredKPI.value.replace(/,/g, '')) : 0, 
      color: '#6ca926' // accent-mid-green: 绿色 - 成功状态
    },
    { 
      name: '已转寄', 
      value: forwardedKPI ? parseInt(forwardedKPI.value.replace(/,/g, '')) : 0, 
      color: '#ea5d4b' // accent-mid-red: 红色 - 特殊处理
    },
    { 
      name: '已退回', 
      value: returnedKPI ? parseInt(returnedKPI.value.replace(/,/g, '')) : 0, 
      color: '#f3870c' // accent-mid-orange: 橙色 - 退回状态
    },
    { 
      name: '已取消', 
      value: cancelledKPI ? parseInt(cancelledKPI.value.replace(/,/g, '')) : 0, 
      color: '#6a6a6a' // functional-mid-grey: 灰色 - 取消状态
    },
  ];
  
  // 计算占比
  statusDistribution.forEach(status => {
    status.percentage = totalOrders > 0 ? ((status.value / totalOrders) * 100).toFixed(1) : '0.0';
  });

  // 异常监控数据 - 使用马士基配色方案，匹配参考图片颜色
  const exceptionData = [
    { name: '超时未揽收', value: totalPickupExceptions, threshold: '2小时', color: '#f3870c' }, // accent-mid-orange: 橙色
    { name: '超时未发运', value: totalShippingExceptions, threshold: '12小时', color: '#ea5d4b' }, // accent-mid-red: 红色
    { name: '超48h未更新', value: totalNoUpdate48hExceptions, threshold: '48小时', color: '#42b0d5' }, // maersk-blue: 蓝色
    { name: '超时未签收', value: totalDeliveryExceptions, threshold: '3天', color: '#6ca926' }, // accent-mid-green: 绿色
  ];

  // 计算快递公司订单量占比 - 使用马士基配色方案
  const courierOrderData = data.courierData.map((courier, index) => {
    // 基于设定的比例：中通58%，顺丰42%
    const orderRatio = courier.name === '中通' ? 0.58 : 0.42;
    const orderCount = Math.round(totalOrders * orderRatio);
    const percentage = (orderRatio * 100).toFixed(1);
    
    return {
      name: courier.name,
      orderCount: orderCount,
      percentage: percentage,
      color: index === 0 ? 'var(--chart-1)' : 'var(--chart-4)', // maersk-blue and accent-mid-orange
      deliveryRate: courier.deliveryRate,
      pickupRate: courier.pickupRate,
      shippingRate: courier.shippingRate
    };
  });

  // 将KPI数据按行分组
  const kpiRows = [
    data.kpiData.slice(0, 3), // 第一行：已揽收、已发运、已签收
    data.kpiData.slice(3, 6), // 第二行：已转寄、已退回、已取消
    data.kpiData.slice(6, 9)  // 第三行：首派成功率、平均首派时长、平均签收时长
  ];

  return (
    <div className="space-y-6">
      {/* 总单量概览 */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">总单量</p>
                <p className="text-3xl font-semibold">{totalOrders.toLocaleString()}</p>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">环比:</span>
                    <div className={`flex items-center space-x-1 ${data.brandStats.growth >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                      {data.brandStats.growth >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{Math.abs(data.brandStats.growth)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">同比:</span>
                    <div className={`flex items-center space-x-1 ${(data.brandStats.growth + 8.5) >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                      {(data.brandStats.growth + 8.5) >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{Math.abs(data.brandStats.growth + 8.5).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 核心KPI指标 - 新的3行×3列布局 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">📊 核心指标</h2>
          <div className="flex items-center space-x-2">
            {selectedBrand && (
              <Badge variant="outline" className="maersk-badge-secondary">
                品牌: {selectedBrand}
              </Badge>
            )}
            {selectedPlatform && (
              <Badge variant="outline" className="maersk-badge-secondary">
                平台: {selectedPlatform}
              </Badge>
            )}
          </div>
        </div>
        
        {/* 第一行：已揽收、已发��、已签收 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {kpiRows[0]?.map((kpi, index) => (
            <EnhancedKPICard 
              key={`row1-${index}`} 
              data={kpi} 
              onDetailClick={onKPIDetailClick}
            />
          ))}
        </div>

        {/* 第二行：已转寄、已退回、已取消 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {kpiRows[1]?.map((kpi, index) => (
            <EnhancedKPICard 
              key={`row2-${index}`} 
              data={kpi} 
              onDetailClick={onKPIDetailClick}
            />
          ))}
        </div>

        {/* 第三行：首派成功率、平均首派时长、平均签收时长 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiRows[2]?.map((kpi, index) => (
            <EnhancedKPICard 
              key={`row3-${index}`} 
              data={kpi} 
              onDetailClick={onKPIDetailClick}
            />
          ))}
        </div>
      </section>

      {/* 订单状态分布 - 调整为单独占用一行 */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2" />
              订单状态分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [
                      `${parseInt(value).toLocaleString()} 单`, 
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {statusDistribution.map((status, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: status.color }}
                    />
                    <span>{status.name}</span>
                  </div>
                  <span className="font-medium">{status.percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 品牌×平台影响力分析 - 新增的冲击图 */}
      <div className="grid grid-cols-1 gap-6">
        <ImpactChart 
          selectedBrand={selectedBrand} 
          selectedPlatform={selectedPlatform} 
          onExceptionClick={onExceptionClick}
        />
      </div>

      {/* 超时监控详情和快递公司订单占比 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 超时监控详情 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              超时监控详情
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exceptionData}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${value} 单`,
                      `阈值: ${props.payload.threshold}`
                    ]}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[4, 4, 0, 0]}
                  >
                    {exceptionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {exceptionData.map((exception, index) => (
                <div key={index} className="flex items-center justify-between text-sm p-2 maersk-alert-warning rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: exception.color }}
                    />
                    <span className="text-accent-mid-red">{exception.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-accent-mid-red">{exception.value} 单</div>
                    <div className="text-xs text-functional-mid-grey">阈值: {exception.threshold}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 快递公司订单占比 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Truck className="h-5 w-5 mr-2" />
              快递公司订单占比
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 总订单量 */}
              <div className="text-center pb-4 border-b">
                <div className="text-2xl font-semibold text-maersk-blue">
                  {totalOrders.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">总订单量</div>
              </div>

              {/* 快递公司占比详情 */}
              {courierOrderData.map((courier, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div 
                        className="w-4 h-4 rounded-full mr-3" 
                        style={{ backgroundColor: courier.color }}
                      />
                      <span className="font-medium">{courier.name}</span>
                    </div>
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {courier.percentage}%
                    </Badge>
                  </div>
                  
                  {/* 进度条显示占比 */}
                  <Progress value={parseFloat(courier.percentage)} className="h-3" />
                  
                  {/* 详细数据 */}
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">订单数量</span>
                      <span className="font-semibold">{courier.orderCount.toLocaleString()} 单</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-medium">{courier.pickupRate}%</div>
                        <div className="text-muted-foreground">揽收率</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{courier.shippingRate}%</div>
                        <div className="text-muted-foreground">发运率</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{courier.deliveryRate}%</div>
                        <div className="text-muted-foreground">签收率</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* 占比总结 */}
              <div className="pt-4 border-t">
                <div className="text-center text-sm text-muted-foreground">
                  覆盖率: {courierOrderData.reduce((sum, c) => sum + parseFloat(c.percentage), 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 品牌统计摘要 */}
      {selectedBrand && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🎯</span>
              <span>{selectedBrand} 品牌概览</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-semibold text-maersk-blue">
                  {data.brandStats.totalOrders.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">总订单数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-accent-mid-green">
                  {data.brandStats.marketShare}%
                </div>
                <div className="text-sm text-muted-foreground">市场份额</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-accent-mid-orange">
                  +{data.brandStats.growth}%
                </div>
                <div className="text-sm text-muted-foreground">月度增长</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
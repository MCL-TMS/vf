import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Store, TrendingUp, TrendingDown, BarChart3, PieChart, Users, Package, Clock, Target, Maximize2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { platformsData, platformKPIData, brandPlatformCrossData, type PlatformKPIData } from '../../data/platformData';
import { FilteredData } from '../../utils/dataFilter';

interface PlatformAnalysisPageProps {
  filteredData: FilteredData;
  selectedBrand: string | null;
  selectedPlatform: string | null;
  dateRange: { from: string; to: string };
  onDateRangeChange: (from: string, to: string) => void;
  useRealData?: boolean;
}

export default function PlatformAnalysisPage({
  filteredData,
  selectedBrand,
  selectedPlatform,
  dateRange,
  onDateRangeChange,
  useRealData = false
}: PlatformAnalysisPageProps) {
  // 获取平台数据
  const currentPlatforms = selectedPlatform 
    ? platformsData.filter(p => p.name === selectedPlatform)
    : platformsData;

  const currentPlatformKPIData = selectedPlatform
    ? platformKPIData.filter(p => p.platform === selectedPlatform)
    : platformKPIData;

  // 获取品牌×平台交叉数据
  const crossData = brandPlatformCrossData.filter(item => {
    if (selectedBrand && item.brand !== selectedBrand) return false;
    if (selectedPlatform && item.platform !== selectedPlatform) return false;
    return true;
  });

  // 平台订单量对比数据
  const platformOrdersData = currentPlatforms.map(platform => {
    const kpiData = platformKPIData.find(kpi => kpi.platform === platform.name);
    return {
      name: platform.displayName,
      logo: platform.logo,
      orders: platform.orders,
      marketShare: platform.marketShare,
      delivered: kpiData?.kpiData.delivered.value || 0,
      rate: ((kpiData?.kpiData.delivered.value || 0) / platform.orders * 100).toFixed(1),
      color: platform.color
    };
  });

  // 平台性能指标对比
  const platformPerformanceData = currentPlatforms.map(platform => {
    const kpiData = platformKPIData.find(kpi => kpi.platform === platform.name);
    return {
      name: platform.displayName,
      logo: platform.logo,
      conversionRate: platform.performance.conversionRate,
      avgOrderValue: platform.performance.avgOrderValue,
      customerSatisfaction: platform.performance.customerSatisfaction,
      firstDeliveryRate: kpiData?.kpiData.firstDeliveryRate.value || 0,
      color: platform.color
    };
  });

  // KPI趋势数据（模拟月度数据）
  const kpiTrendData = [
    { month: '1月', tmall: 1050000, jd: 720000, douyin: 380000, vipshop: 210000 },
    { month: '2月', tmall: 1080000, jd: 740000, douyin: 390000, vipshop: 220000 },
    { month: '3月', tmall: 1120000, jd: 770000, douyin: 410000, vipshop: 230000 },
    { month: '4月', tmall: 1150000, jd: 790000, douyin: 420000, vipshop: 235000 },
    { month: '5月', tmall: 1199513, jd: 799675, douyin: 426634, vipshop: 239763 }
  ];

  // 计算平台总览统计
  const totalOrders = currentPlatforms.reduce((sum, p) => sum + p.orders, 0);
  const avgConversionRate = currentPlatforms.reduce((sum, p) => sum + p.performance.conversionRate, 0) / currentPlatforms.length;
  const avgOrderValue = currentPlatforms.reduce((sum, p) => sum + p.performance.avgOrderValue, 0) / currentPlatforms.length;
  const totalMarketShare = currentPlatforms.reduce((sum, p) => sum + p.marketShare, 0);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Store className="h-6 w-6 text-maersk-blue" />
          <h1 className="text-2xl font-medium text-black">平台分析</h1>
          {selectedPlatform && (
            <Badge variant="outline" className="maersk-badge-secondary">
              平台: {platformsData.find(p => p.name === selectedPlatform)?.displayName}
            </Badge>
          )}
          {selectedBrand && (
            <Badge variant="outline" className="maersk-badge-secondary">
              品牌: {selectedBrand}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue">
            🏪 多平台对比分析
          </Badge>
          {useRealData && (
            <Badge variant="outline" className="bg-accent-bright-green text-accent-dark-green border-accent-mid-green">
              🔗 API数据
            </Badge>
          )}
        </div>
      </div>

      {/* 平台总览KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-functional-mid-grey">平台总订单</p>
                <p className="text-2xl font-semibold text-black">{totalOrders.toLocaleString()}</p>
                <p className="text-sm text-accent-mid-green flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +12.4%
                </p>
              </div>
              <Package className="h-8 w-8 text-maersk-blue" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-functional-mid-grey">平均转化率</p>
                <p className="text-2xl font-semibold text-black">{avgConversionRate.toFixed(1)}%</p>
                <p className="text-sm text-accent-mid-green flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +0.8%
                </p>
              </div>
              <Target className="h-8 w-8 text-accent-mid-teal" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-functional-mid-grey">平均客单价</p>
                <p className="text-2xl font-semibold text-black">¥{avgOrderValue.toFixed(0)}</p>
                <p className="text-sm text-accent-mid-red flex items-center mt-1">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  -2.1%
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-accent-mid-orange" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-functional-mid-grey">覆盖市场份额</p>
                <p className="text-2xl font-semibold text-black">{totalMarketShare}%</p>
                <p className="text-sm text-accent-mid-green flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +5.2%
                </p>
              </div>
              <PieChart className="h-8 w-8 text-accent-mid-green" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 标签页内容 */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-functional-bright-grey">
          <TabsTrigger value="overview" className="text-black">平台总览</TabsTrigger>
          <TabsTrigger value="performance" className="text-black">性能对比</TabsTrigger>
          <TabsTrigger value="trends" className="text-black">趋势分析</TabsTrigger>
          <TabsTrigger value="cross" className="text-black">交叉分析</TabsTrigger>
        </TabsList>

        {/* 平台总览 */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 平台订单量分布 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  平台订单量分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platformOrdersData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12, fill: '#6a6a6a' }}
                      />
                      <YAxis tick={{ fontSize: 12, fill: '#6a6a6a' }} />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          value.toLocaleString(),
                          name === 'orders' ? '订单量' : '签收量'
                        ]}
                        labelFormatter={(label) => `平台: ${label}`}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #d4d4d4',
                          borderRadius: '6px'
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="orders" 
                        name="总订单量"
                        fill="#42b0d5"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar 
                        dataKey="delivered" 
                        name="已签收量"
                        fill="#6ca926"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 平台市场份额 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="h-5 w-5 mr-2" />
                  平台市场份额
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={platformOrdersData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="marketShare"
                      >
                        {platformOrdersData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [`${value}%`, '市场份额']}
                        labelFormatter={(label) => `${label}`}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {platformOrdersData.map((platform, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-functional-bright-grey">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: platform.color }}
                        />
                        <span className="text-sm">{platform.logo} {platform.name}</span>
                      </div>
                      <span className="font-medium text-sm">{platform.marketShare}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 平台详细指标 */}
          <Card>
            <CardHeader>
              <CardTitle>平台详细指标对比</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentPlatforms.map((platform, index) => {
                  const kpiData = platformKPIData.find(kpi => kpi.platform === platform.name);
                  if (!kpiData) return null;

                  return (
                    <div key={index} className="p-4 border border-functional-light-grey rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{platform.logo}</span>
                          <div>
                            <h3 className="font-medium text-black">{platform.displayName}</h3>
                            <p className="text-sm text-functional-mid-grey">
                              市场份额 {platform.marketShare}%
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          style={{ borderColor: platform.color, color: platform.color }}
                          className="bg-white"
                        >
                          {platform.orders.toLocaleString()} 订单
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-semibold text-black">
                            {kpiData.kpiData.picked.value.toLocaleString()}
                          </div>
                          <div className="text-xs text-functional-mid-grey">已揽收</div>
                          <div className={`text-xs flex items-center justify-center mt-1 ${
                            kpiData.kpiData.picked.change.mom >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'
                          }`}>
                            {kpiData.kpiData.picked.change.mom >= 0 ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {Math.abs(kpiData.kpiData.picked.change.mom).toFixed(1)}%
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-lg font-semibold text-black">
                            {kpiData.kpiData.shipped.value.toLocaleString()}
                          </div>
                          <div className="text-xs text-functional-mid-grey">已发运</div>
                          <div className={`text-xs flex items-center justify-center mt-1 ${
                            kpiData.kpiData.shipped.change.mom >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'
                          }`}>
                            {kpiData.kpiData.shipped.change.mom >= 0 ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {Math.abs(kpiData.kpiData.shipped.change.mom).toFixed(1)}%
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-lg font-semibold text-black">
                            {kpiData.kpiData.delivered.value.toLocaleString()}
                          </div>
                          <div className="text-xs text-functional-mid-grey">已签收</div>
                          <div className={`text-xs flex items-center justify-center mt-1 ${
                            kpiData.kpiData.delivered.change.mom >= 0 ? 'text-accent-mid-green' : 'text-accent-mid-red'
                          }`}>
                            {kpiData.kpiData.delivered.change.mom >= 0 ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {Math.abs(kpiData.kpiData.delivered.change.mom).toFixed(1)}%
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-lg font-semibold text-black">
                            {kpiData.kpiData.firstDeliveryRate.value}%
                          </div>
                          <div className="text-xs text-functional-mid-grey">首派成功率</div>
                          <div className={`text-xs flex items-center justify-center mt-1 ${
                            kpiData.kpiData.firstDeliveryRate.change.mom >= 0 ? 'text-accent-mid-green' : 'text-accent-mid-red'
                          }`}>
                            {kpiData.kpiData.firstDeliveryRate.change.mom >= 0 ? (
                              <TrendingUp className="h-3 w-3 mr-1" />
                            ) : (
                              <TrendingDown className="h-3 w-3 mr-1" />
                            )}
                            {Math.abs(kpiData.kpiData.firstDeliveryRate.change.mom).toFixed(1)}%
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-lg font-semibold text-black">
                            ¥{platform.performance.avgOrderValue.toFixed(0)}
                          </div>
                          <div className="text-xs text-functional-mid-grey">平均客单价</div>
                          <div className="text-xs text-functional-mid-grey mt-1">
                            转化率 {platform.performance.conversionRate}%
                          </div>
                        </div>

                        <div className="text-center">
                          <div className="text-lg font-semibold text-black">
                            {platform.performance.customerSatisfaction}
                          </div>
                          <div className="text-xs text-functional-mid-grey">客户满意度</div>
                          <div className="text-xs text-accent-mid-green mt-1">
                            优秀水平
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 性能对比 */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                平台性能指标对比
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: '#6a6a6a' }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#6a6a6a' }} />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'conversionRate') return [`${value}%`, '转化率'];
                        if (name === 'avgOrderValue') return [`¥${value}`, '平均客单价'];
                        if (name === 'customerSatisfaction') return [value, '客户满意度'];
                        if (name === 'firstDeliveryRate') return [`${value}%`, '首派成功率'];
                        return [value, name];
                      }}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #d4d4d4',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="conversionRate" name="转化率" fill="#42b0d5" />
                    <Bar dataKey="firstDeliveryRate" name="首派成功率" fill="#6ca926" />
                    <Bar dataKey="avgOrderValue" name="平均客单价" fill="#f3870c" />
                    <Bar dataKey="customerSatisfaction" name="客户满意度" fill="#ea5d4b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 趋势分析 */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                平台订单量趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={kpiTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12, fill: '#6a6a6a' }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#6a6a6a' }} />
                    <Tooltip 
                      formatter={(value: any, name: string) => [
                        value.toLocaleString(),
                        name === 'tmall' ? '天猫' :
                        name === 'jd' ? '京东' :
                        name === 'douyin' ? '抖音' : '唯品会'
                      ]}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #d4d4d4',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="tmall" name="天猫" stroke="#FF6600" strokeWidth={2} />
                    <Line type="monotone" dataKey="jd" name="京东" stroke="#E3101E" strokeWidth={2} />
                    <Line type="monotone" dataKey="douyin" name="抖音" stroke="#000000" strokeWidth={2} />
                    <Line type="monotone" dataKey="vipshop" name="唯品会" stroke="#FF1493" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 交叉分析 */}
        <TabsContent value="cross" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Maximize2 className="h-5 w-5 mr-2" />
                品牌×平台交叉分析
                {selectedBrand && selectedPlatform && (
                  <Badge variant="outline" className="ml-2 bg-functional-bright-blue text-maersk-blue border-maersk-blue">
                    {selectedBrand} × {platformsData.find(p => p.name === selectedPlatform)?.displayName}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {crossData.length > 0 ? (
                  crossData.map((item, index) => {
                    const platformInfo = platformsData.find(p => p.name === item.platform);
                    if (!platformInfo) return null;

                    return (
                      <div key={index} className="p-4 border border-functional-light-grey rounded-lg hover:bg-functional-bright-grey transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{
                                item.brand === 'TNF' ? '🏔️' :
                                item.brand === 'DICKIES' ? '👔' :
                                item.brand === 'VANS' ? '👟' :
                                item.brand === 'TIMBERLAND' ? '🥾' :
                                item.brand === 'ICEBREAKER' ? '🧊' :
                                item.brand === 'KIPLING' ? '🎒' : '🏷️'
                              }</span>
                              <span className="font-medium text-black">{item.brand}</span>
                            </div>
                            <span className="text-functional-mid-grey">×</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{platformInfo.logo}</span>
                              <span className="font-medium text-black">{platformInfo.displayName}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="bg-white border-maersk-blue text-maersk-blue">
                              {item.orders.toLocaleString()} 订单
                            </Badge>
                            <Badge variant="outline" className="bg-white" style={{ borderColor: platformInfo.color, color: platformInfo.color }}>
                              {item.marketShare}% 市场份额
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          <div className="text-center">
                            <div className="text-lg font-semibold text-black">
                              {item.kpiBreakdown.picked.toLocaleString()}
                            </div>
                            <div className="text-xs text-functional-mid-grey">已揽收</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-black">
                              {item.kpiBreakdown.shipped.toLocaleString()}
                            </div>
                            <div className="text-xs text-functional-mid-grey">已发运</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-black">
                              {item.kpiBreakdown.delivered.toLocaleString()}
                            </div>
                            <div className="text-xs text-functional-mid-grey">已签收</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-black">
                              {item.performance.deliveryRate.toFixed(1)}%
                            </div>
                            <div className="text-xs text-functional-mid-grey">签收率</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-black">
                              {item.performance.firstDeliveryTime.toFixed(1)}h
                            </div>
                            <div className="text-xs text-functional-mid-grey">首派时长</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-semibold text-black">
                              {item.performance.customerRating.toFixed(1)}
                            </div>
                            <div className="text-xs text-functional-mid-grey">客户评分</div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-functional-light-grey">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-functional-mid-grey">转寄订单: </span>
                              <span className="font-medium text-black">{item.kpiBreakdown.forwarded.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-functional-mid-grey">退回订单: </span>
                              <span className="font-medium text-black">{item.kpiBreakdown.returned.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-functional-mid-grey">退回率: </span>
                              <span className="font-medium text-black">{item.performance.returnRate.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-functional-mid-grey">
                    <Store className="h-12 w-12 mx-auto opacity-30 mb-4" />
                    <h4 className="font-medium mb-2 text-black">暂无交叉分析数据</h4>
                    <p className="text-sm">
                      {selectedBrand && selectedPlatform 
                        ? `品牌 ${selectedBrand} 在平台 ${platformsData.find(p => p.name === selectedPlatform)?.displayName} 上暂无数据`
                        : '请选择品牌和平台筛选条件以查看详细的交叉分析数据'
                      }
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
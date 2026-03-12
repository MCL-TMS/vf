import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AlertTriangle, ArrowLeft, Home } from 'lucide-react';
import type { DateRange, FilteredOrderData } from '../../data/types';

interface CourierAnalysisPageProps {
  filteredData: FilteredOrderData;
  selectedBrand: string | null;
  dateRange: DateRange;
  onDateRangeChange: (from: string, to: string) => void;
  useRealData?: boolean;
}

export function CourierAnalysisPage({ 
  filteredData, 
  selectedBrand, 
  dateRange, 
  onDateRangeChange,
  useRealData = false 
}: CourierAnalysisPageProps) {
  return (
    <div className="space-y-6">
      {/* 删除通知 */}
      <Card className="maersk-alert-warning">
        <CardHeader>
          <CardTitle className="flex items-center text-accent-dark-orange">
            <AlertTriangle className="h-5 w-5 mr-2" />
            功能模块已重新整合
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-accent-dark-orange">
              独立的快递商分析页面已被删除，相关功能已集成到总览页面中。
            </p>
            <div className="bg-maersk-white rounded-lg p-4 border border-accent-light-orange">
              <h4 className="font-medium text-maersk-black mb-2">功能说明：</h4>
              <ul className="space-y-1 text-sm text-functional-dark-grey">
                <li>• 快递公司订单占比分析已集成到总览页面</li>
                <li>• 基于TSK_LIST_TASK表的CARRIERID字段进行分析</li>
                <li>• 包含中通快递和顺丰速运的占比统计</li>
                <li>• 显示各快递商的订单量、百分比和关键性能指标</li>
              </ul>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                className="maersk-button-primary"
                onClick={() => window.location.hash = '#/overview-dashboard'}
              >
                <Home className="h-4 w-4 mr-2" />
                前往总览页面
              </Button>
              <Badge variant="outline" className="maersk-badge-secondary">
                快递商分析功能已可用
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 功能预览 */}
      <Card className="maersk-card">
        <CardHeader>
          <CardTitle className="flex items-center text-maersk-black">
            📊 总览页面中的快递公司分析
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-functional-mid-grey">
              在总览页面的右下角，您可以找到"快递公司订单占比"分析模块，该模块提供：
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-functional-bright-grey rounded-lg">
                <h5 className="font-medium text-maersk-black mb-2">数据展示</h5>
                <ul className="text-sm text-functional-dark-grey space-y-1">
                  <li>• 总订单量统计</li>
                  <li>• 快递商占比可视化</li>
                  <li>• 进度条显示分布</li>
                  <li>• 覆盖率汇总</li>
                </ul>
              </div>
              <div className="p-4 bg-functional-bright-grey rounded-lg">
                <h5 className="font-medium text-maersk-black mb-2">性能指标</h5>
                <ul className="text-sm text-functional-dark-grey space-y-1">
                  <li>• 揽收率统计</li>
                  <li>• 发运率监控</li>
                  <li>• 签收率分析</li>
                  <li>• 品牌筛选支持</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CourierAnalysisPage;

// 马士基设计系统颜色配置
const MAERSK_COLORS = {
  primary: '#42b0d5',
  dark: '#003e62',
  mid: '#1686bd',
  light: '#a1d1e8',
  bright: '#e2f3fb',
  grey: '#6a6a6a',
  success: '#6ca926',
  warning: '#f3870c',
  danger: '#ea5d4b'
};

const CHART_COLORS = [MAERSK_COLORS.primary, MAERSK_COLORS.success, MAERSK_COLORS.warning, MAERSK_COLORS.danger, MAERSK_COLORS.mid];

export function CourierAnalysisPage({ 
  filteredData, 
  selectedBrand, 
  dateRange, 
  onDateRangeChange,
  useRealData = false 
}: CourierAnalysisPageProps) {
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'comparison' | 'performance' | 'cost'>('overview');
  const [sortBy, setSortBy] = useState<'orders' | 'performance' | 'cost'>('orders');

  // 根据品牌筛选快递商数据
  const filteredCourierData = courierData.map(courier => {
    if (!selectedBrand || selectedBrand === 'all') {
      return courier;
    }
    
    // 过滤品牌数据
    const filteredBrandData = courier.brandDistribution.filter(
      brand => brand.brand === selectedBrand
    );
    
    if (filteredBrandData.length === 0) {
      return { ...courier, totalOrders: 0, activeOrders: 0, completedOrders: 0 };
    }
    
    const brandData = filteredBrandData[0];
    const ratio = brandData.orders / courier.totalOrders;
    
    return {
      ...courier,
      totalOrders: brandData.orders,
      activeOrders: Math.round(courier.activeOrders * ratio),
      completedOrders: Math.round(courier.completedOrders * ratio),
      brandDistribution: filteredBrandData
    };
  }).filter(courier => courier.totalOrders > 0);

  // 快递商概览卡片
  const CourierOverviewCard = ({ courier }: { courier: CourierData }) => (
    <Card className="maersk-card p-6 hover:shadow-lg transition-all cursor-pointer"
          onClick={() => setSelectedCourier(selectedCourier === courier.id ? null : courier.id)}>
      <div className="space-y-4">
        {/* 快递商基本信息 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg bg-functional-bright-blue flex items-center justify-center text-2xl">
              {courier.logo}
            </div>
            <div>
              <h3 className="font-medium text-maersk-black">{courier.name}</h3>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs maersk-badge-secondary">
                  {courier.type === 'major' ? '主要快递' : courier.type === 'express' ? '快递公司' : '本地配送'}
                </Badge>
                <span className="text-sm text-functional-mid-grey">
                  市场占有率 {courier.marketShare}%
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-medium text-maersk-black">
              {(courier.totalOrders / 1000).toFixed(0)}K
            </div>
            <div className="text-sm text-functional-mid-grey">总订单</div>
          </div>
        </div>

        {/* 核心指标 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-medium text-maersk-blue">
              {courier.performance.deliveryRate}%
            </div>
            <div className="text-xs text-functional-mid-grey">配送成功率</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-medium text-accent-mid-green">
              {courier.performance.onTimeRate}%
            </div>
            <div className="text-xs text-functional-mid-grey">准时率</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-medium text-accent-mid-orange">
              {courier.performance.avgDeliveryTime}h
            </div>
            <div className="text-xs text-functional-mid-grey">平均时长</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <Star className="h-3 w-3 text-accent-mid-orange fill-current" />
              <span className="text-lg font-medium text-accent-mid-orange">
                {courier.performance.customerRating}
              </span>
            </div>
            <div className="text-xs text-functional-mid-grey">客户评分</div>
          </div>
        </div>

        {/* 趋势指标 */}
        <div className="flex items-center justify-between pt-2 border-t border-functional-light-grey">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              {courier.performance.trend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-accent-mid-green" />
              ) : courier.performance.trend === 'down' ? (
                <TrendingDown className="h-4 w-4 text-accent-mid-red" />
              ) : (
                <Activity className="h-4 w-4 text-functional-mid-grey" />
              )}
              <span className={`text-sm font-medium ${
                courier.performance.trend === 'up' ? 'text-accent-mid-green' : 
                courier.performance.trend === 'down' ? 'text-accent-mid-red' : 'text-functional-mid-grey'
              }`}>
                {courier.performance.monthOverMonth > 0 ? '+' : ''}{courier.performance.monthOverMonth}%
              </span>
            </div>
            <div className="text-sm text-functional-mid-grey">环比上月</div>
          </div>
          <div className="flex items-center space-x-2">
            <AlertTriangle className={`h-4 w-4 ${
              courier.performance.exceptionRate < 2 ? 'text-accent-mid-green' : 
              courier.performance.exceptionRate < 3 ? 'text-accent-mid-orange' : 'text-accent-mid-red'
            }`} />
            <span className="text-sm text-functional-mid-grey">
              异常率 {courier.performance.exceptionRate}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );

  // 快递商详细信息面板
  const CourierDetailPanel = ({ courier }: { courier: CourierData }) => (
    <Card className="maersk-card p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-maersk-black">
            {courier.name} - 详细分析
          </h3>
          <Button variant="outline" size="sm" onClick={() => setSelectedCourier(null)}>
            收起
          </Button>
        </div>

        <Tabs defaultValue="brands" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="brands">品牌分布</TabsTrigger>
            <TabsTrigger value="regions">地域覆盖</TabsTrigger>
            <TabsTrigger value="cost">成本分析</TabsTrigger>
            <TabsTrigger value="sla">SLA指标</TabsTrigger>
          </TabsList>

          <TabsContent value="brands" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 品牌订单分布饼图 */}
              <div>
                <h4 className="font-medium text-maersk-black mb-4">品牌订单分布</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={courier.brandDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill={MAERSK_COLORS.primary}
                      dataKey="orders"
                      label={({ brand, percentage }) => `${brand} ${percentage}%`}
                    >
                      {courier.brandDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value.toLocaleString()}`, '订单数']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* 品牌性能对比 */}
              <div>
                <h4 className="font-medium text-maersk-black mb-4">品牌性能对比</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={courier.brandDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke={MAERSK_COLORS.light} />
                    <XAxis dataKey="brand" tick={{ fill: MAERSK_COLORS.grey }} />
                    <YAxis tick={{ fill: MAERSK_COLORS.grey }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff',
                        border: `1px solid ${MAERSK_COLORS.light}`,
                        borderRadius: '6px'
                      }}
                    />
                    <Bar dataKey="onTimeRate" fill={MAERSK_COLORS.primary} name="准时率%" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 品牌详细数据表格 */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-functional-light-grey">
                    <th className="text-left py-3 font-medium text-functional-dark-grey">品牌</th>
                    <th className="text-right py-3 font-medium text-functional-dark-grey">订单数</th>
                    <th className="text-right py-3 font-medium text-functional-dark-grey">占比</th>
                    <th className="text-right py-3 font-medium text-functional-dark-grey">准时率</th>
                    <th className="text-right py-3 font-medium text-functional-dark-grey">平均时长</th>
                    <th className="text-right py-3 font-medium text-functional-dark-grey">平均成本</th>
                  </tr>
                </thead>
                <tbody>
                  {courier.brandDistribution.map((brand, index) => (
                    <tr key={index} className="border-b border-functional-light-grey">
                      <td className="py-3">
                        <Badge variant="outline" className="maersk-badge-secondary">
                          {brand.brand}
                        </Badge>
                      </td>
                      <td className="text-right py-3 font-medium">
                        {brand.orders.toLocaleString()}
                      </td>
                      <td className="text-right py-3 text-functional-mid-grey">
                        {brand.percentage}%
                      </td>
                      <td className="text-right py-3">
                        <span className={`font-medium ${
                          brand.onTimeRate >= 90 ? 'text-accent-mid-green' :
                          brand.onTimeRate >= 85 ? 'text-accent-mid-orange' : 'text-accent-mid-red'
                        }`}>
                          {brand.onTimeRate}%
                        </span>
                      </td>
                      <td className="text-right py-3 text-functional-mid-grey">
                        {brand.avgDeliveryTime}h
                      </td>
                      <td className="text-right py-3 font-medium text-maersk-blue">
                        ¥{brand.avgCost}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="regions" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 地域订单分布 */}
              <div>
                <h4 className="font-medium text-maersk-black mb-4">地域订单分布</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={courier.regionCoverage}>
                    <CartesianGrid strokeDasharray="3 3" stroke={MAERSK_COLORS.light} />
                    <XAxis dataKey="province" tick={{ fill: MAERSK_COLORS.grey }} />
                    <YAxis tick={{ fill: MAERSK_COLORS.grey }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff',
                        border: `1px solid ${MAERSK_COLORS.light}`,
                        borderRadius: '6px'
                      }}
                    />
                    <Bar dataKey="orders" fill={MAERSK_COLORS.primary} name="订单数" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 配送时效对比 */}
              <div>
                <h4 className="font-medium text-maersk-black mb-4">各地配送时效</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={courier.regionCoverage}>
                    <CartesianGrid strokeDasharray="3 3" stroke={MAERSK_COLORS.light} />
                    <XAxis dataKey="province" tick={{ fill: MAERSK_COLORS.grey }} />
                    <YAxis tick={{ fill: MAERSK_COLORS.grey }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff',
                        border: `1px solid ${MAERSK_COLORS.light}`,
                        borderRadius: '6px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgDeliveryTime" 
                      stroke={MAERSK_COLORS.warning} 
                      strokeWidth={2}
                      name="平均配送时长(h)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cost" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 重量成本分析 */}
              <div>
                <h4 className="font-medium text-maersk-black mb-4">重量成本分析</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={courier.costAnalysis.weightBased}>
                    <CartesianGrid strokeDasharray="3 3" stroke={MAERSK_COLORS.light} />
                    <XAxis dataKey="range" tick={{ fill: MAERSK_COLORS.grey }} />
                    <YAxis tick={{ fill: MAERSK_COLORS.grey }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff',
                        border: `1px solid ${MAERSK_COLORS.light}`,
                        borderRadius: '6px'
                      }}
                    />
                    <Bar dataKey="avgCost" fill={MAERSK_COLORS.success} name="平均成本(¥)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 成本趋势 */}
              <div>
                <h4 className="font-medium text-maersk-black mb-4">成本指标</h4>
                <div className="space-y-4">
                  <div className="p-4 bg-functional-bright-grey rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-functional-dark-grey">平均运费</span>
                      <span className="font-medium text-maersk-blue">¥{courier.costAnalysis.avgShippingCost}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-functional-bright-grey rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-functional-dark-grey">单均成本</span>
                      <span className="font-medium text-maersk-blue">¥{courier.costAnalysis.costPerOrder}</span>
                    </div>
                  </div>
                  <div className="p-4 bg-functional-bright-grey rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-functional-dark-grey">成本趋势</span>
                      <div className="flex items-center space-x-1">
                        {courier.costAnalysis.costTrend === 'up' ? (
                          <TrendingUp className="h-4 w-4 text-accent-mid-red" />
                        ) : courier.costAnalysis.costTrend === 'down' ? (
                          <TrendingDown className="h-4 w-4 text-accent-mid-green" />
                        ) : (
                          <Activity className="h-4 w-4 text-functional-mid-grey" />
                        )}
                        <span className={`font-medium ${
                          courier.costAnalysis.costTrend === 'up' ? 'text-accent-mid-red' : 
                          courier.costAnalysis.costTrend === 'down' ? 'text-accent-mid-green' : 'text-functional-mid-grey'
                        }`}>
                          {courier.costAnalysis.monthOverMonth > 0 ? '+' : ''}{courier.costAnalysis.monthOverMonth}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sla" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SLA达成率雷达图 */}
              <div>
                <h4 className="font-medium text-maersk-black mb-4">SLA达成率</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={[
                    { subject: '揽收SLA', value: courier.slaMetrics.pickupSLA.achievement, fullMark: 100 },
                    { subject: '发运SLA', value: courier.slaMetrics.shippingSLA.achievement, fullMark: 100 },
                    { subject: '配送SLA', value: courier.slaMetrics.deliverySLA.achievement, fullMark: 100 }
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: MAERSK_COLORS.grey }} />
                    <PolarRadiusAxis angle={0} domain={[0, 100]} tick={{ fill: MAERSK_COLORS.grey }} />
                    <Radar name="达成率" dataKey="value" stroke={MAERSK_COLORS.primary} fill={MAERSK_COLORS.primary} fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* SLA详细指标 */}
              <div>
                <h4 className="font-medium text-maersk-black mb-4">SLA详细指标</h4>
                <div className="space-y-4">
                  <div className="p-4 bg-functional-bright-grey rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-functional-dark-grey">揽收SLA</span>
                      <span className="font-medium text-maersk-blue">
                        {courier.slaMetrics.pickupSLA.achievement}%
                      </span>
                    </div>
                    <Progress value={courier.slaMetrics.pickupSLA.achievement} className="h-2" />
                    <div className="flex justify-between text-xs text-functional-mid-grey mt-1">
                      <span>目标: {courier.slaMetrics.pickupSLA.target}h</span>
                      <span>实际: {courier.slaMetrics.pickupSLA.actual}h</span>
                    </div>
                  </div>

                  <div className="p-4 bg-functional-bright-grey rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-functional-dark-grey">发运SLA</span>
                      <span className="font-medium text-maersk-blue">
                        {courier.slaMetrics.shippingSLA.achievement}%
                      </span>
                    </div>
                    <Progress value={courier.slaMetrics.shippingSLA.achievement} className="h-2" />
                    <div className="flex justify-between text-xs text-functional-mid-grey mt-1">
                      <span>目标: {courier.slaMetrics.shippingSLA.target}h</span>
                      <span>实际: {courier.slaMetrics.shippingSLA.actual}h</span>
                    </div>
                  </div>

                  <div className="p-4 bg-functional-bright-grey rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-functional-dark-grey">配送SLA</span>
                      <span className="font-medium text-maersk-blue">
                        {courier.slaMetrics.deliverySLA.achievement}%
                      </span>
                    </div>
                    <Progress value={courier.slaMetrics.deliverySLA.achievement} className="h-2" />
                    <div className="flex justify-between text-xs text-functional-mid-grey mt-1">
                      <span>目标: {courier.slaMetrics.deliverySLA.target}h</span>
                      <span>实际: {courier.slaMetrics.deliverySLA.actual}h</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );

  // 快递商对比分析
  const CourierComparisonView = () => (
    <Card className="maersk-card p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-maersk-black">快递商对比分析</h3>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              导出报告
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {courierComparisonData.metrics.map((metric, index) => (
            <div key={index} className="p-4 bg-functional-bright-grey rounded-lg">
              <h4 className="font-medium text-maersk-black mb-4">
                {metric.metric} ({metric.unit})
              </h4>
              <div className="space-y-3">
                {metric.couriers.map((courier, courierIndex) => (
                  <div key={courierIndex} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded text-xs font-medium flex items-center justify-center text-white ${
                        courier.rank === 1 ? 'bg-accent-mid-green' :
                        courier.rank === 2 ? 'bg-maersk-blue' :
                        courier.rank === 3 ? 'bg-accent-mid-orange' : 'bg-functional-mid-grey'
                      }`}>
                        {courier.rank}
                      </div>
                      <span className="font-medium text-maersk-black">{courier.courierName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-maersk-blue">
                        {metric.unit === '%' ? `${courier.value}%` : 
                         metric.unit === '分' ? `${courier.value}分` :
                         metric.unit === '小时' ? `${courier.value}小时` : courier.value}
                      </span>
                      {courier.trend === 'up' ? (
                        <TrendingUp className="h-4 w-4 text-accent-mid-green" />
                      ) : courier.trend === 'down' ? (
                        <TrendingDown className="h-4 w-4 text-accent-mid-red" />
                      ) : (
                        <Activity className="h-4 w-4 text-functional-mid-grey" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* 页面标题和控制栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-maersk-black">快递商分析</h1>
          <p className="text-functional-mid-grey mt-1">
            基于CARRIERID字段的快递商性能监控与分析
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">概览</SelectItem>
              <SelectItem value="comparison">对比</SelectItem>
              <SelectItem value="performance">性能</SelectItem>
              <SelectItem value="cost">成本</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orders">按订单量</SelectItem>
              <SelectItem value="performance">按性能</SelectItem>
              <SelectItem value="cost">按成本</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 快递商概览统计 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="maersk-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-functional-mid-grey">合作快递商</p>
              <p className="text-2xl font-medium text-maersk-black">{filteredCourierData.length}</p>
            </div>
            <Truck className="h-8 w-8 text-maersk-blue" />
          </div>
        </Card>
        <Card className="maersk-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-functional-mid-grey">总订单量</p>
              <p className="text-2xl font-medium text-maersk-black">
                {(filteredCourierData.reduce((sum, c) => sum + c.totalOrders, 0) / 1000).toFixed(0)}K
              </p>
            </div>
            <Package className="h-8 w-8 text-accent-mid-green" />
          </div>
        </Card>
        <Card className="maersk-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-functional-mid-grey">平均准时率</p>
              <p className="text-2xl font-medium text-maersk-black">
                {(filteredCourierData.reduce((sum, c) => sum + c.performance.onTimeRate, 0) / filteredCourierData.length).toFixed(1)}%
              </p>
            </div>
            <Clock className="h-8 w-8 text-accent-mid-orange" />
          </div>
        </Card>
        <Card className="maersk-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-functional-mid-grey">平均客户评分</p>
              <p className="text-2xl font-medium text-maersk-black">
                {(filteredCourierData.reduce((sum, c) => sum + c.performance.customerRating, 0) / filteredCourierData.length).toFixed(1)}
              </p>
            </div>
            <Star className="h-8 w-8 text-accent-mid-orange" />
          </div>
        </Card>
      </div>

      {/* 主要内容区域 */}
      {viewMode === 'overview' && (
        <div className="space-y-6">
          {/* 快递商概览卡片 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredCourierData
              .sort((a, b) => {
                if (sortBy === 'orders') return b.totalOrders - a.totalOrders;
                if (sortBy === 'performance') return b.performance.onTimeRate - a.performance.onTimeRate;
                if (sortBy === 'cost') return a.costAnalysis.avgShippingCost - b.costAnalysis.avgShippingCost;
                return 0;
              })
              .map(courier => (
                <CourierOverviewCard key={courier.id} courier={courier} />
              ))}
          </div>

          {/* 选中快递商的详细信息 */}
          {selectedCourier && (
            <CourierDetailPanel 
              courier={filteredCourierData.find(c => c.id === selectedCourier)!} 
            />
          )}
        </div>
      )}

      {viewMode === 'comparison' && <CourierComparisonView />}

      {/* 页面底部状态 */}
      <div className="text-center text-sm text-functional-mid-grey">
        {selectedBrand && selectedBrand !== 'all' ? (
          <span>当前显示 {selectedBrand} 品牌的快递商数据</span>
        ) : (
          <span>显示所有品牌的快递商数据</span>
        )}
        {" "}• 数据更新时间: {new Date().toLocaleString('zh-CN')}
      </div>
    </div>
  );
}
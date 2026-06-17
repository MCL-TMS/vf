import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  Package, 
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  GitCompare,
  Target,
  AlertCircle
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

export function CostAnalysis() {
  const [selectedView, setSelectedView] = useState<'carrier' | 'efficiency' | 'benchmark'>('carrier');

  // 按承运商的成本对比（4PL管理视角）
  const carrierCostComparison = [
    { 
      carrier: 'SF', 
      totalCost: 458000, 
      volume: 45000, 
      avgCost: 10.18, 
      change: -2.3, 
      marketAvg: 10.50,
      efficiency: 103, // (marketAvg / avgCost) * 100
      negotiationPotential: '中',
      contractDiscount: 15
    },
    { 
      carrier: 'ZTO', 
      totalCost: 342000, 
      volume: 38000, 
      avgCost: 9.0, 
      change: -1.8, 
      marketAvg: 9.20,
      efficiency: 102,
      negotiationPotential: '高',
      contractDiscount: 18
    },
    { 
      carrier: 'YTO', 
      totalCost: 256000, 
      volume: 32000, 
      avgCost: 8.0, 
      change: 1.2, 
      marketAvg: 7.80,
      efficiency: 98,
      negotiationPotential: '高',
      contractDiscount: 12
    },
    { 
      carrier: 'STO', 
      totalCost: 196000, 
      volume: 28000, 
      avgCost: 7.0, 
      change: 0.5, 
      marketAvg: 7.20,
      efficiency: 103,
      negotiationPotential: '低',
      contractDiscount: 20
    }
  ];

  // 成本优化机会（Control Tower视角）
  const optimizationOpportunities = [
    {
      category: '运力调配优化',
      potential: '¥128,000/月',
      description: '将部分SF高成本订单转移至ZTO/YTO，在保证时效前提下降低成本',
      impact: 'high',
      actions: [
        '非紧急订单从SF转至ZTO',
        '区域性订单优化配置',
        '降低15-20%单均成本'
      ],
      feasibility: 85
    },
    {
      category: '批量折扣谈判',
      potential: '¥85,000/月',
      description: '与ZTO重新谈判年度合同，基于订单增长争取更优惠价格',
      impact: 'high',
      actions: [
        'ZTO月量从38K提升至45K',
        '谈判折扣从18%提升至22%',
        '预计节约6.5%成本'
      ],
      feasibility: 70
    },
    {
      category: 'YTO成本控制',
      potential: '¥42,000/月',
      description: 'YTO单价高于市场均价，需要重新评估合同条款',
      impact: 'medium',
      actions: [
        '对比市场价格基准',
        '要求降价或减少订单分配',
        '预计节约5-8%'
      ],
      feasibility: 60
    },
    {
      category: '网络整合',
      potential: '¥35,000/月',
      description: '整合重叠区域的承运商网络，减少不必要的多承运商覆盖',
      impact: 'medium',
      actions: [
        '分析区域重叠率',
        '优化单一承运商覆盖',
        '减少管理复杂度'
      ],
      feasibility: 75
    }
  ];

  // 月度成本效率追踪
  const monthlyEfficiency = [
    { month: '1月', totalCost: 1250000, volume: 145000, avgCost: 8.62, industryAvg: 8.80, saving: 18000 },
    { month: '2月', totalCost: 1180000, volume: 138000, avgCost: 8.55, industryAvg: 8.75, saving: 20000 },
    { month: '3月', totalCost: 1320000, volume: 152000, avgCost: 8.68, industryAvg: 8.90, saving: 22000 },
    { month: '4月', totalCost: 1280000, volume: 148000, avgCost: 8.65, industryAvg: 8.85, saving: 20000 },
    { month: '5月', totalCost: 1310000, volume: 150000, avgCost: 8.73, industryAvg: 8.92, saving: 19000 },
    { month: '6月', totalCost: 1310000, volume: 150000, avgCost: 8.73, industryAvg: 8.95, saving: 22000 }
  ];

  // 承运商成本效率排名
  const efficiencyRanking = carrierCostComparison
    .map(c => ({
      carrier: c.carrier,
      efficiency: c.efficiency,
      avgCost: c.avgCost,
      marketAvg: c.marketAvg,
      variance: ((c.avgCost - c.marketAvg) / c.marketAvg * 100).toFixed(1)
    }))
    .sort((a, b) => b.efficiency - a.efficiency);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const totalCost = carrierCostComparison.reduce((sum, item) => sum + item.totalCost, 0);
  const totalVolume = carrierCostComparison.reduce((sum, item) => sum + item.volume, 0);
  const avgCostPerOrder = totalCost / totalVolume;
  const totalOptimizationPotential = 290000; // 128k + 85k + 42k + 35k

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 - Control Tower视角 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-maersk-black">4PL Control Tower - 成本管理与优化</h1>
            <Badge variant="outline" className="bg-maersk-blue text-white">管理视角</Badge>
          </div>
          <p className="text-functional-mid-grey">
            跨承运商成本对比、效率分析和优化策略，实现最优成本结构
          </p>
        </div>
        <Button variant="outline">
          <Calculator className="h-4 w-4 mr-2" />
          导出成本优化报告
        </Button>
      </div>

      {/* 关键指标 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-50">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <TrendingDown className="h-4 w-4 text-green-600" />
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">综合物流成本</h3>
          <p className="text-maersk-black">¥{(totalCost / 1000).toFixed(0)}K</p>
          <p className="text-xs text-green-600 mt-1">较市场均价节约 ¥121K</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-green-50">
              <Package className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">混合单均成本</h3>
          <p className="text-maersk-black">¥{avgCostPerOrder.toFixed(2)}</p>
          <p className="text-xs text-green-600 mt-1">低于行业均价 2.3%</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-orange-50">
              <Target className="h-5 w-5 text-orange-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">成本优化潜力</h3>
          <p className="text-maersk-black">¥{(totalOptimizationPotential / 1000).toFixed(0)}K/月</p>
          <p className="text-xs text-orange-600 mt-1">约22% 节约空间</p>
        </Card>

        <Card className="p-4 bg-green-50 border-green-200">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-green-100">
              <Percent className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <h3 className="text-sm text-green-700 mb-1">成本效率指数</h3>
          <p className="text-green-700">102.3</p>
          <p className="text-xs text-green-600 mt-1">高于行业基准2.3分</p>
        </Card>
      </div>

      {/* 成本视图切换 */}
      <Card className="p-6">
        <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)}>
          <TabsList className="mb-6">
            <TabsTrigger value="carrier">承运商成本对比</TabsTrigger>
            <TabsTrigger value="efficiency">效率分析</TabsTrigger>
            <TabsTrigger value="benchmark">市场基准对比</TabsTrigger>
          </TabsList>

          <TabsContent value="carrier" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-maersk-black">3PL承运商成本结构分析</h3>
              <Badge variant="outline">
                <GitCompare className="h-3 w-3 mr-1" />
                跨承运商对比
              </Badge>
            </div>
            
            <div className="space-y-3">
              {carrierCostComparison.map((item, index) => (
                <div key={item.carrier} className="border rounded-lg p-4 hover:bg-functional-bright-grey transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-maersk-black">{item.carrier}</span>
                          <Badge variant="outline">折扣率: {item.contractDiscount}%</Badge>
                          <Badge variant={item.negotiationPotential === '高' ? 'default' : 'secondary'}>
                            谈判潜力: {item.negotiationPotential}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-maersk-black">¥{item.avgCost.toFixed(2)}/单</p>
                        <div className="flex items-center gap-1 text-xs">
                          {item.change < 0 ? (
                            <>
                              <ArrowDownRight className="h-3 w-3 text-green-600" />
                              <span className="text-green-600">{Math.abs(item.change)}%</span>
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="h-3 w-3 text-red-600" />
                              <span className="text-red-600">+{item.change}%</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-3 text-sm">
                    <div>
                      <p className="text-functional-mid-grey text-xs">月总成本</p>
                      <p className="text-maersk-black">¥{(item.totalCost / 1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <p className="text-functional-mid-grey text-xs">月订单量</p>
                      <p className="text-maersk-black">{(item.volume / 1000).toFixed(0)}K</p>
                    </div>
                    <div>
                      <p className="text-functional-mid-grey text-xs">市场均价</p>
                      <p className="text-maersk-black">¥{item.marketAvg.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-functional-mid-grey text-xs">成本效率</p>
                      <p className={item.efficiency >= 100 ? 'text-green-600' : 'text-orange-600'}>
                        {item.efficiency}分
                      </p>
                    </div>
                    <div>
                      <p className="text-functional-mid-grey text-xs">月节约</p>
                      <p className="text-green-600">
                        ¥{((item.marketAvg - item.avgCost) * item.volume / 1000).toFixed(0)}K
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="efficiency">
            <h3 className="text-maersk-black mb-4">成本效率趋势分析</h3>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={monthlyEfficiency}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="avgCost" 
                  stroke="#0088FE" 
                  name="我方单均成本 (¥)" 
                  strokeWidth={2} 
                />
                <Line 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="industryAvg" 
                  stroke="#FF8042" 
                  strokeDasharray="5 5"
                  name="行业均价 (¥)" 
                  strokeWidth={2} 
                />
                <Bar 
                  yAxisId="right" 
                  dataKey="saving" 
                  fill="#00C49F" 
                  name="月节约金额 (¥)" 
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-sm text-functional-mid-grey mb-1">累计节约</p>
                <p className="text-green-600">¥121,000</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-functional-mid-grey mb-1">平均效率指数</p>
                <p className="text-maersk-black">102.3</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-functional-mid-grey mb-1">成本控制率</p>
                <p className="text-green-600">97.7%</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="benchmark">
            <h3 className="text-maersk-black mb-4">承运商成本效率排名 vs 市场基准</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={efficiencyRanking} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[95, 105]} />
                <YAxis dataKey="carrier" type="category" />
                <Tooltip />
                <Legend />
                <Bar dataKey="efficiency" fill="#0088FE" name="成本效率指数" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {efficiencyRanking.map((item, index) => (
                <div key={item.carrier} className="flex items-center justify-between p-2 bg-functional-bright-grey rounded">
                  <span className="text-sm">
                    <Badge variant="outline" className="mr-2">#{index + 1}</Badge>
                    {item.carrier}
                  </span>
                  <span className="text-sm text-functional-mid-grey">
                    我方: ¥{item.avgCost} | 市场: ¥{item.marketAvg} | 
                    <span className={parseFloat(item.variance) < 0 ? 'text-green-600 ml-1' : 'text-red-600 ml-1'}>
                      {item.variance}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* 成本优化策略 */}
      <Card className="p-6">
        <h2 className="text-maersk-black mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-maersk-blue" />
          成本优化策略建议（预计年节约 ¥3.48M）
        </h2>
        <div className="space-y-4">
          {optimizationOpportunities.map((opp, index) => (
            <div 
              key={index}
              className={`border rounded-lg p-5 ${
                opp.impact === 'high' ? 'border-green-300 bg-green-50' : 'border-blue-300 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-maersk-black">{opp.category}</h4>
                    <Badge variant={opp.impact === 'high' ? 'default' : 'secondary'}>
                      {opp.impact === 'high' ? '高优先级' : '中优先级'}
                    </Badge>
                    <Badge variant="outline">可行性: {opp.feasibility}%</Badge>
                  </div>
                  <p className="text-sm text-functional-mid-grey">{opp.description}</p>
                </div>
                <div className="text-right ml-4">
                  <p className={`${opp.impact === 'high' ? 'text-green-700' : 'text-blue-700'}`}>
                    {opp.potential}
                  </p>
                  <p className="text-xs text-functional-mid-grey">节约潜力</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-functional-mid-grey mb-2">执行方案：</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {opp.actions.map((action, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="text-maersk-blue mt-0.5">•</span>
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 成本结构饼图 */}
      <Card className="p-6">
        <h3 className="text-maersk-black mb-4">承运商成本分配结构</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={carrierCostComparison}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ carrier, totalCost }) => `${carrier}: ¥${(totalCost/1000).toFixed(0)}K`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="totalCost"
            >
              {carrierCostComparison.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => `¥${value.toLocaleString()}`} />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  CheckCircle,
  Calendar,
  Truck,
  BarChart3,
  Activity,
  Network,
  Target,
  Settings
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart } from 'recharts';

export function CapacityPlanning() {
  const [forecastPeriod, setForecastPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // 运力池管理（4PL Control Tower视角）
  const capacityPool = [
    { 
      carrier: 'SF', 
      contracted: 50000, 
      current: 42000, 
      peak: 48000,
      usage: 84, 
      flexibility: 'low',
      scalability: 60,
      status: 'normal',
      contingency: 8000 // 应急容量
    },
    { 
      carrier: 'ZTO', 
      contracted: 40000, 
      current: 38000, 
      peak: 39000,
      usage: 95, 
      flexibility: 'medium',
      scalability: 75,
      status: 'warning',
      contingency: 2000
    },
    { 
      carrier: 'YTO', 
      contracted: 45000, 
      current: 28000, 
      peak: 35000,
      usage: 62, 
      flexibility: 'high',
      scalability: 90,
      status: 'normal',
      contingency: 17000
    },
    { 
      carrier: 'STO', 
      contracted: 35000, 
      current: 25000, 
      peak: 30000,
      usage: 71, 
      flexibility: 'high',
      scalability: 85,
      status: 'normal',
      contingency: 10000
    }
  ];

  // 预测数据（考虑多承运商协同）
  const forecastData = [
    { date: '6/24', actual: 145000, forecast: null, SF: 43000, ZTO: 37000, YTO: 33000, STO: 32000 },
    { date: '6/25', actual: 148000, forecast: null, SF: 44000, ZTO: 38000, YTO: 33000, STO: 33000 },
    { date: '6/26', actual: 142000, forecast: null, SF: 42000, ZTO: 36000, YTO: 32000, STO: 32000 },
    { date: '6/27', actual: 150000, forecast: null, SF: 45000, ZTO: 38000, YTO: 34000, STO: 33000 },
    { date: '6/28', actual: 152000, forecast: null, SF: 46000, ZTO: 39000, YTO: 34000, STO: 33000 },
    { date: '6/29', actual: 149000, forecast: null, SF: 44000, ZTO: 38000, YTO: 34000, STO: 33000 },
    { date: '6/30', actual: 151000, forecast: null, SF: 45000, ZTO: 38000, YTO: 35000, STO: 33000 },
    { date: '7/1', actual: null, forecast: 155000, SF: 46000, ZTO: 40000, YTO: 36000, STO: 33000 },
    { date: '7/2', actual: null, forecast: 158000, SF: 47000, ZTO: 40000, YTO: 37000, STO: 34000 },
    { date: '7/3', actual: null, forecast: 161000, SF: 48000, ZTO: 41000, YTO: 38000, STO: 34000 },
    { date: '7/4', actual: null, forecast: 159000, SF: 47000, ZTO: 40000, YTO: 38000, STO: 34000 },
    { date: '7/5', actual: null, forecast: 163000, SF: 49000, ZTO: 41000, YTO: 39000, STO: 34000 },
    { date: '7/6', actual: null, forecast: 165000, SF: 49000, ZTO: 42000, YTO: 40000, STO: 34000 },
    { date: '7/7', actual: null, forecast: 167000, SF: 50000, ZTO: 42000, YTO: 41000, STO: 34000 }
  ];

  // 运力缺口预警（Control Tower关键功能）
  const capacityGapAlerts = [
    {
      date: '2025-07-05',
      totalDemand: 163000,
      totalCapacity: 170000,
      gap: 0,
      carrierGaps: [
        { carrier: 'SF', demand: 49000, capacity: 50000, gap: 0, risk: 'high' },
        { carrier: 'ZTO', demand: 41000, capacity: 40000, gap: 1000, risk: 'high' }
      ],
      severity: 'high',
      recommendation: '需要从YTO/STO调配3K运力'
    },
    {
      date: '2025-07-07',
      totalDemand: 167000,
      totalCapacity: 170000,
      gap: 0,
      carrierGaps: [
        { carrier: 'SF', demand: 50000, capacity: 50000, gap: 0, risk: 'critical' },
        { carrier: 'ZTO', demand: 42000, capacity: 40000, gap: 2000, risk: 'high' }
      ],
      severity: 'critical',
      recommendation: '启动应急预案，YTO增加5K运力'
    }
  ];

  // 运力调配建议（跨承运商优化）
  const allocationRecommendations = [
    {
      scenario: 'ZTO运力饱和应对',
      currentAllocation: { SF: 45000, ZTO: 38000, YTO: 32000, STO: 28000 },
      recommendedAllocation: { SF: 48000, ZTO: 40000, YTO: 35000, STO: 30000 },
      changes: [
        { carrier: 'SF', change: +3000, reason: '吸收高优先级订单' },
        { carrier: 'ZTO', change: +2000, reason: '谈判临时增量' },
        { carrier: 'YTO', change: +3000, reason: '利用闲置运力' },
        { carrier: 'STO', change: +2000, reason: '平衡负载' }
      ],
      impact: '消除运力缺口，成本增加3.5%',
      priority: 'high',
      feasibility: 90
    },
    {
      scenario: '旺季运力储备',
      currentAllocation: { SF: 45000, ZTO: 38000, YTO: 32000, STO: 28000 },
      recommendedAllocation: { SF: 55000, ZTO: 45000, YTO: 40000, STO: 35000 },
      changes: [
        { carrier: 'SF', change: +10000, reason: '高峰期主力' },
        { carrier: 'ZTO', change: +7000, reason: '经济型补充' },
        { carrier: 'YTO', change: +8000, reason: '区域性增强' },
        { carrier: 'STO', change: +7000, reason: '弹性储备' }
      ],
      impact: '应对20%订单增长，成本增加8%',
      priority: 'medium',
      feasibility: 75
    },
    {
      scenario: '成本优化配置',
      currentAllocation: { SF: 45000, ZTO: 38000, YTO: 32000, STO: 28000 },
      recommendedAllocation: { SF: 40000, ZTO: 45000, YTO: 35000, STO: 33000 },
      changes: [
        { carrier: 'SF', change: -5000, reason: '降低高成本占比' },
        { carrier: 'ZTO', change: +7000, reason: '增加高性价比' },
        { carrier: 'YTO', change: +3000, reason: '平衡成本' },
        { carrier: 'STO', change: +5000, reason: '利用低价优势' }
      ],
      impact: '节约成本12%，时效下降1%',
      priority: 'low',
      feasibility: 80
    }
  ];

  const getUsageColor = (usage: number) => {
    if (usage >= 90) return 'text-red-600';
    if (usage >= 75) return 'text-orange-600';
    return 'text-green-600';
  };

  const getUsageStatus = (usage: number) => {
    if (usage >= 90) return { text: '接近饱和', variant: 'destructive' as const, color: 'bg-red-100 border-red-300' };
    if (usage >= 75) return { text: '负载良好', variant: 'secondary' as const, color: 'bg-orange-100 border-orange-300' };
    return { text: '运力充足', variant: 'default' as const, color: 'bg-green-100 border-green-300' };
  };

  const totalContractedCapacity = capacityPool.reduce((sum, c) => sum + c.contracted, 0);
  const totalCurrentUsage = capacityPool.reduce((sum, c) => sum + c.current, 0);
  const totalContingency = capacityPool.reduce((sum, c) => sum + c.contingency, 0);
  const overallUsageRate = (totalCurrentUsage / totalContractedCapacity * 100).toFixed(1);

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 - Control Tower视角 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-maersk-black">4PL Control Tower - 运力池管理</h1>
            <Badge variant="outline" className="bg-maersk-blue text-white">管理视角</Badge>
          </div>
          <p className="text-functional-mid-grey">
            跨承运商运力协调、负载均衡和应急调度，确保网络弹性和成本最优
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            运力配置管理
          </Button>
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            生成预测报告
          </Button>
        </div>
      </div>

      {/* 运力缺口预警 */}
      {capacityGapAlerts.length > 0 && (
        <Alert className={capacityGapAlerts[0].severity === 'critical' ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'}>
          <AlertTriangle className={`h-4 w-4 ${capacityGapAlerts[0].severity === 'critical' ? 'text-red-600' : 'text-orange-600'}`} />
          <AlertDescription>
            <div className="space-y-2">
              <span className={capacityGapAlerts[0].severity === 'critical' ? 'text-red-700' : 'text-orange-700'}>
                检测到 {capacityGapAlerts.length} 个运力风险点
              </span>
              {capacityGapAlerts.map((alert, index) => (
                <div key={index} className="text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="mr-2">
                        {alert.severity === 'critical' ? '严重' : '警告'}
                      </Badge>
                      <span>{alert.date}: 总需求 {alert.totalDemand.toLocaleString()}</span>
                    </div>
                    <span className="text-xs text-functional-mid-grey">
                      建议: {alert.recommendation}
                    </span>
                  </div>
                  <div className="ml-6 mt-1 space-y-1">
                    {alert.carrierGaps.map((cg, idx) => (
                      <div key={idx} className="text-xs">
                        • {cg.carrier}: 需求{cg.demand.toLocaleString()} / 容量{cg.capacity.toLocaleString()} 
                        {cg.gap > 0 && <span className="text-red-600 ml-2">缺口 {cg.gap.toLocaleString()}</span>}
                        {cg.gap === 0 && cg.risk === 'critical' && <span className="text-orange-600 ml-2">满载</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Control Tower 总览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-50">
              <Network className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">运力池总容量</h3>
          <p className="text-maersk-black">{totalContractedCapacity.toLocaleString()} 单/日</p>
          <p className="text-xs text-functional-mid-grey mt-1">4个承运商网络</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-green-50">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">综合使用率</h3>
          <p className="text-maersk-black">{overallUsageRate}%</p>
          <p className="text-xs text-green-600 mt-1">运力健康</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-orange-50">
              <Package className="h-5 w-5 text-orange-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">应急储备</h3>
          <p className="text-maersk-black">{totalContingency.toLocaleString()} 单/日</p>
          <p className="text-xs text-functional-mid-grey mt-1">{(totalContingency/totalContractedCapacity*100).toFixed(1)}% 缓冲</p>
        </Card>

        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm text-blue-700 mb-1">网络弹性指数</h3>
          <p className="text-blue-700">85.2</p>
          <p className="text-xs text-blue-600 mt-1">可应对20%波动</p>
        </Card>
      </div>

      {/* 承运商运力池状态 */}
      <Card className="p-6">
        <h2 className="text-maersk-black mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          承运商运力池实时状态
        </h2>
        <div className="space-y-4">
          {capacityPool.map((item) => {
            const status = getUsageStatus(item.usage);
            return (
              <div key={item.carrier} className={`border rounded-lg p-4 ${status.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-maersk-blue" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-maersk-black">{item.carrier}</h3>
                        <Badge variant="outline">
                          弹性: {item.flexibility === 'high' ? '高' : item.flexibility === 'medium' ? '中' : '低'}
                        </Badge>
                        <Badge variant="outline">
                          可扩展性: {item.scalability}%
                        </Badge>
                      </div>
                      <p className="text-sm text-functional-mid-grey">
                        当前: {item.current.toLocaleString()} | 
                        合同: {item.contracted.toLocaleString()} | 
                        峰值: {item.peak.toLocaleString()} | 
                        储备: {item.contingency.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`${getUsageColor(item.usage)}`}>
                        {item.usage}%
                      </p>
                      <p className="text-xs text-functional-mid-grey">负载率</p>
                    </div>
                    <Badge variant={status.variant}>{status.text}</Badge>
                  </div>
                </div>
                <Progress value={item.usage} className="h-2" />
                <div className="mt-2 text-xs text-functional-mid-grey">
                  应急容量: {item.contingency.toLocaleString()} ({(item.contingency/item.contracted*100).toFixed(0)}%)
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 运力需求预测（跨承运商视图） */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-maersk-black flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            运力需求预测与承运商分配
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <Calendar className="h-3 w-3 mr-1" />
              未来7天预测
            </Badge>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="SF" stackId="carrier" fill="#0088FE" name="SF" />
            <Bar dataKey="ZTO" stackId="carrier" fill="#00C49F" name="ZTO" />
            <Bar dataKey="YTO" stackId="carrier" fill="#FFBB28" name="YTO" />
            <Bar dataKey="STO" stackId="carrier" fill="#FF8042" name="STO" />
            <Line 
              type="monotone" 
              dataKey="forecast" 
              stroke="#FF0000" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 4 }}
              name="预测总量"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-sm text-functional-mid-grey mb-1">7日平均需求</p>
            <p className="text-maersk-black">161,000 单</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-functional-mid-grey mb-1">预计峰值</p>
            <p className="text-orange-600">167,000 单</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-functional-mid-grey mb-1">峰值缺口</p>
            <p className="text-red-600">-3,000 单</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-functional-mid-grey mb-1">需求增长率</p>
            <p className="text-green-600">+6.9%</p>
          </div>
        </div>
      </Card>

      {/* 运力调配建议 */}
      <Card className="p-6">
        <h2 className="text-maersk-black mb-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-maersk-blue" />
          智能运力调配方案
        </h2>
        <div className="space-y-4">
          {allocationRecommendations.map((rec, index) => (
            <div 
              key={index}
              className={`border rounded-lg p-5 ${
                rec.priority === 'high' ? 'border-red-300 bg-red-50' :
                rec.priority === 'medium' ? 'border-orange-300 bg-orange-50' :
                'border-blue-300 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-maersk-black">{rec.scenario}</h3>
                    <Badge variant={
                      rec.priority === 'high' ? 'destructive' :
                      rec.priority === 'medium' ? 'secondary' :
                      'default'
                    }>
                      {rec.priority === 'high' ? '高优先级' :
                       rec.priority === 'medium' ? '中优先级' :
                       '低优先级'}
                    </Badge>
                    <Badge variant="outline">可行性: {rec.feasibility}%</Badge>
                  </div>
                  <p className="text-sm text-functional-mid-grey mb-3">{rec.impact}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-3 mb-3">
                {rec.changes.map((change, idx) => (
                  <div key={idx} className="border rounded p-3 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-maersk-black">{change.carrier}</span>
                      <Badge variant={change.change > 0 ? 'default' : 'secondary'}>
                        {change.change > 0 ? '+' : ''}{(change.change/1000).toFixed(0)}K
                      </Badge>
                    </div>
                    <p className="text-xs text-functional-mid-grey">{change.reason}</p>
                  </div>
                ))}
              </div>
              
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-functional-mid-grey">当前配置:</span>
                  <span className="text-maersk-black">
                    SF: {(rec.currentAllocation.SF/1000).toFixed(0)}K | 
                    ZTO: {(rec.currentAllocation.ZTO/1000).toFixed(0)}K | 
                    YTO: {(rec.currentAllocation.YTO/1000).toFixed(0)}K | 
                    STO: {(rec.currentAllocation.STO/1000).toFixed(0)}K
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-functional-mid-grey">建议配置:</span>
                  <span className="text-maersk-blue">
                    SF: {(rec.recommendedAllocation.SF/1000).toFixed(0)}K | 
                    ZTO: {(rec.recommendedAllocation.ZTO/1000).toFixed(0)}K | 
                    YTO: {(rec.recommendedAllocation.YTO/1000).toFixed(0)}K | 
                    STO: {(rec.recommendedAllocation.STO/1000).toFixed(0)}K
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

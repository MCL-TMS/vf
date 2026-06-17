import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Target,
  Award,
  BarChart3,
  Activity,
  Flag,
  MapPin
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area } from 'recharts';

export function FourPLTimeEfficiency() {
  const [selectedMetric, setSelectedMetric] = useState<'s2d' | 'c2d'>('s2d');
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // 承运商时效达成率综合对比（4PL Control Tower视角）
  const carrierTimeEfficiency = [
    {
      carrier: 'SF',
      name: '顺丰速运',
      s2d: {
        plan: 24,
        actual: 23.2,
        achievementRate: 103.4,
        volume: 45000,
        onTimeOrders: 44280,
        delayedOrders: 720,
        avgDelay: 2.1
      },
      c2d: {
        plan: 48,
        actual: 46.5,
        achievementRate: 103.2,
        volume: 45000,
        onTimeOrders: 44100,
        delayedOrders: 900,
        avgDelay: 3.2
      },
      tier: 'A',
      trend: 'up',
      slaCompliance: 98.4,
      improvement: 2.1,
      issues: []
    },
    {
      carrier: 'ZTO',
      name: '中通快递',
      s2d: {
        plan: 48,
        actual: 52.3,
        achievementRate: 91.8,
        volume: 38000,
        onTimeOrders: 34884,
        delayedOrders: 3116,
        avgDelay: 8.5
      },
      c2d: {
        plan: 72,
        actual: 75.8,
        achievementRate: 95.0,
        volume: 38000,
        onTimeOrders: 36100,
        delayedOrders: 1900,
        avgDelay: 6.2
      },
      tier: 'B',
      trend: 'down',
      slaCompliance: 91.8,
      improvement: -1.2,
      issues: ['S2D时效待改进', '偏远地区延迟']
    },
    {
      carrier: 'YTO',
      name: '圆通速递',
      s2d: {
        plan: 48,
        actual: 54.8,
        achievementRate: 87.6,
        volume: 32000,
        onTimeOrders: 28032,
        delayedOrders: 3968,
        avgDelay: 12.3
      },
      c2d: {
        plan: 72,
        actual: 78.2,
        achievementRate: 92.1,
        volume: 32000,
        onTimeOrders: 29472,
        delayedOrders: 2528,
        avgDelay: 9.8
      },
      tier: 'C',
      trend: 'down',
      slaCompliance: 87.6,
      improvement: -2.8,
      issues: ['时效持续下降', '需要改进计划']
    },
    {
      carrier: 'STO',
      name: '申通快递',
      s2d: {
        plan: 48,
        actual: 56.2,
        achievementRate: 85.4,
        volume: 28000,
        onTimeOrders: 23912,
        delayedOrders: 4088,
        avgDelay: 15.2
      },
      c2d: {
        plan: 72,
        actual: 80.5,
        achievementRate: 89.4,
        volume: 28000,
        onTimeOrders: 25032,
        delayedOrders: 2968,
        avgDelay: 12.1
      },
      tier: 'C',
      trend: 'stable',
      slaCompliance: 85.4,
      improvement: 0.3,
      issues: ['时效基础薄弱', '成本优先级']
    }
  ];

  // 区域时效表现对比（跨承运商）
  const regionalPerformance = [
    { region: '华东', SF: 98.5, ZTO: 93.2, YTO: 89.8, STO: 87.2, avgPlan: 36 },
    { region: '华南', SF: 97.8, ZTO: 92.1, YTO: 88.5, STO: 86.1, avgPlan: 38 },
    { region: '华北', SF: 98.2, ZTO: 91.5, YTO: 87.2, STO: 84.8, avgPlan: 40 },
    { region: '华中', SF: 97.5, ZTO: 90.8, YTO: 86.8, STO: 83.5, avgPlan: 42 },
    { region: '西南', SF: 96.2, ZTO: 88.5, YTO: 84.2, STO: 81.2, avgPlan: 48 },
    { region: '西北', SF: 95.1, ZTO: 86.2, YTO: 82.1, STO: 78.5, avgPlan: 52 },
    { region: '东北', SF: 96.8, ZTO: 89.2, YTO: 85.5, STO: 82.8, avgPlan: 50 }
  ];

  // 月度趋势对比
  const monthlyTrend = [
    { month: '1月', SF: 103.2, ZTO: 92.5, YTO: 89.2, STO: 86.1 },
    { month: '2月', SF: 103.1, ZTO: 92.1, YTO: 88.5, STO: 85.8 },
    { month: '3月', SF: 103.3, ZTO: 91.8, YTO: 88.2, STO: 85.5 },
    { month: '4月', SF: 103.5, ZTO: 91.5, YTO: 87.8, STO: 85.2 },
    { month: '5月', SF: 103.4, ZTO: 91.8, YTO: 87.6, STO: 85.4 },
    { month: '6月', SF: 103.4, ZTO: 91.8, YTO: 87.6, STO: 85.4 }
  ];

  // SLA合规监控
  const slaCompliance = [
    { level: '优秀 (>95%)', carriers: ['SF'], count: 1, percentage: 25 },
    { level: '良好 (90-95%)', carriers: ['ZTO'], count: 1, percentage: 25 },
    { level: '合格 (85-90%)', carriers: ['YTO', 'STO'], count: 2, percentage: 50 },
    { level: '待改进 (<85%)', carriers: [], count: 0, percentage: 0 }
  ];

  // 时效改进建议
  const improvementRecommendations = [
    {
      carrier: 'ZTO',
      priority: 'high',
      issue: 'S2D时效91.8%，未达95%目标',
      recommendation: '重点优化中转环节，减少分拣时间',
      expectedImprovement: '+3.2%',
      timeline: '2个月',
      cost: '低',
      feasibility: 85
    },
    {
      carrier: 'YTO',
      priority: 'high',
      issue: '时效持续下降，从89.2%降至87.6%',
      recommendation: '召开紧急业务评审会，制定改进计划',
      expectedImprovement: '+5.0%',
      timeline: '3个月',
      cost: '中',
      feasibility: 70
    },
    {
      carrier: 'STO',
      priority: 'medium',
      issue: '时效基础薄弱，85.4%接近底线',
      recommendation: '评估是否调整订单分配比例',
      expectedImprovement: '+2.0%',
      timeline: '1个月',
      cost: '低',
      feasibility: 90
    },
    {
      carrier: '全网',
      priority: 'medium',
      issue: '西北、东北地区整体时效偏低',
      recommendation: '优化区域承运商配置，增加SF占比',
      expectedImprovement: '+4.0%',
      timeline: '2个月',
      cost: '高',
      feasibility: 65
    }
  ];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'A': return 'bg-green-600';
      case 'B': return 'bg-blue-600';
      case 'C': return 'bg-orange-600';
      default: return 'bg-gray-600';
    }
  };

  const getAchievementColor = (rate: number) => {
    if (rate > 100) return 'text-green-600';
    if (rate >= 95) return 'text-blue-600';
    if (rate >= 90) return 'text-orange-600';
    return 'text-red-600';
  };

  const getAchievementBadge = (rate: number) => {
    if (rate > 100) return { variant: 'default' as const, text: '优秀', color: 'bg-green-600' };
    if (rate >= 95) return { variant: 'default' as const, text: '良好', color: 'bg-blue-600' };
    if (rate >= 90) return { variant: 'secondary' as const, text: '合格', color: 'bg-orange-600 text-white' };
    return { variant: 'destructive' as const, text: '待改进', color: '' };
  };

  const currentMetricData = selectedMetric === 's2d' ? 
    carrierTimeEfficiency.map(c => ({ ...c, metric: c.s2d })) :
    carrierTimeEfficiency.map(c => ({ ...c, metric: c.c2d }));

  const overallAchievement = (
    carrierTimeEfficiency.reduce((sum, c) => 
      sum + (selectedMetric === 's2d' ? c.s2d.achievementRate : c.c2d.achievementRate), 0
    ) / carrierTimeEfficiency.length
  ).toFixed(1);

  const totalVolume = carrierTimeEfficiency.reduce((sum, c) => sum + c.s2d.volume, 0);
  const totalOnTime = carrierTimeEfficiency.reduce((sum, c) => 
    sum + (selectedMetric === 's2d' ? c.s2d.onTimeOrders : c.c2d.onTimeOrders), 0
  );
  const overallOnTimeRate = ((totalOnTime / totalVolume) * 100).toFixed(1);

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 - 4PL Control Tower视角 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-maersk-black">4PL Control Tower - 承运商时效管理</h1>
            <Badge variant="outline" className="bg-maersk-blue text-white">管理视角</Badge>
          </div>
          <p className="text-functional-mid-grey">
            跨承运商时效对比、SLA合规监控和时效优化策略
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as any)}>
            <TabsList>
              <TabsTrigger value="s2d">S2D时效</TabsTrigger>
              <TabsTrigger value="c2d">C2D时效</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline">
            <BarChart3 className="h-4 w-4 mr-2" />
            生成时效报告
          </Button>
        </div>
      </div>

      {/* 时效预警 */}
      <Alert className="border-orange-300 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span className="text-orange-700">
              检测到 2 个承运商时效待改进：YTO时效持续下降至87.6%，ZTO未达95%目标
            </span>
            <Button variant="outline" size="sm">查看改进计划</Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Control Tower 时效概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-50">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">综合达成率</h3>
          <p className="text-maersk-black">{overallAchievement}%</p>
          <p className="text-xs text-green-600 mt-1">高于90%基准线</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">准时订单率</h3>
          <p className="text-maersk-black">{overallOnTimeRate}%</p>
          <p className="text-xs text-functional-mid-grey mt-1">{totalOnTime.toLocaleString()} / {totalVolume.toLocaleString()}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-purple-50">
              <Award className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <h3 className="text-sm text-functional-mid-grey mb-1">SLA合规率</h3>
          <p className="text-maersk-black">75%</p>
          <p className="text-xs text-functional-mid-grey mt-1">3/4 承运商达标</p>
        </Card>

        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
          </div>
          <h3 className="text-sm text-orange-700 mb-1">待改进承运商</h3>
          <p className="text-orange-700">2 个</p>
          <p className="text-xs text-orange-600 mt-1">YTO、ZTO</p>
        </Card>
      </div>

      {/* 承运商时效排名对比 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-maersk-blue" />
            <h2 className="text-maersk-black">承运商时效达成率排名</h2>
            <Badge variant="outline">{selectedMetric === 's2d' ? 'S2D时效' : 'C2D时效'}</Badge>
          </div>
        </div>

        <div className="space-y-4">
          {currentMetricData.sort((a, b) => b.metric.achievementRate - a.metric.achievementRate).map((item, index) => {
            const badge = getAchievementBadge(item.metric.achievementRate);
            return (
              <div key={item.carrier} className="border rounded-lg p-5 hover:bg-functional-bright-grey transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-maersk-blue text-maersk-white">
                      <span className="text-lg">#{index + 1}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-maersk-black">{item.name}</h3>
                        <Badge variant="outline">{item.carrier}</Badge>
                        <Badge className={getTierColor(item.tier)}>{item.tier}级</Badge>
                        <Badge variant={badge.variant} className={badge.color}>{badge.text}</Badge>
                        {item.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                        {item.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-functional-mid-grey">
                        <span>Plan: {item.metric.plan}h</span>
                        <span>Actual: {item.metric.actual}h</span>
                        <span>订单量: {item.metric.volume.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-2xl ${getAchievementColor(item.metric.achievementRate)}`}>
                      {item.metric.achievementRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-functional-mid-grey">达成率</p>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-3 mt-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-functional-mid-grey mb-1">准时订单</p>
                    <p className="text-sm text-green-600">{item.metric.onTimeOrders.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-functional-mid-grey mb-1">延迟订单</p>
                    <p className="text-sm text-red-600">{item.metric.delayedOrders.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-functional-mid-grey mb-1">平均延迟</p>
                    <p className="text-sm text-maersk-black">{item.metric.avgDelay}h</p>
                  </div>
                  <div>
                    <p className="text-xs text-functional-mid-grey mb-1">SLA合规</p>
                    <p className="text-sm text-maersk-black">{item.slaCompliance}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-functional-mid-grey mb-1">月度改进</p>
                    <p className={`text-sm ${item.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.improvement >= 0 ? '+' : ''}{item.improvement}%
                    </p>
                  </div>
                </div>

                {item.issues.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-functional-mid-grey">问题识别:</span>
                      {item.issues.map((issue, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {issue}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Progress value={item.metric.achievementRate} className="h-2 mt-3" />
              </div>
            );
          })}
        </div>
      </Card>

      {/* 时效趋势和区域对比 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-maersk-black mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            月度时效达成率趋势
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[80, 105]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="SF" stroke="#10B981" strokeWidth={2} name="SF" />
              <Line type="monotone" dataKey="ZTO" stroke="#3B82F6" strokeWidth={2} name="ZTO" />
              <Line type="monotone" dataKey="YTO" stroke="#F59E0B" strokeWidth={2} name="YTO" />
              <Line type="monotone" dataKey="STO" stroke="#EF4444" strokeWidth={2} name="STO" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-functional-mid-grey text-center mt-2">
            YTO和STO呈下降趋势，需要重点关注
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-maersk-black mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            区域时效表现对比
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={regionalPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[75, 100]} />
              <YAxis dataKey="region" type="category" width={50} />
              <Tooltip />
              <Legend />
              <Bar dataKey="SF" fill="#10B981" name="SF" />
              <Bar dataKey="ZTO" fill="#3B82F6" name="ZTO" />
              <Bar dataKey="YTO" fill="#F59E0B" name="YTO" />
              <Bar dataKey="STO" fill="#EF4444" name="STO" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-functional-mid-grey text-center mt-2">
            西北、东北地区整体时效偏低，需优化承运商配置
          </p>
        </Card>
      </div>

      {/* SLA合规监控 */}
      <Card className="p-6">
        <h2 className="text-maersk-black mb-4 flex items-center gap-2">
          <Flag className="h-5 w-5 text-maersk-blue" />
          SLA合规监控
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {slaCompliance.map((level, index) => (
            <div 
              key={index}
              className={`border rounded-lg p-4 ${
                level.level.includes('优秀') ? 'border-green-300 bg-green-50' :
                level.level.includes('良好') ? 'border-blue-300 bg-blue-50' :
                level.level.includes('合格') ? 'border-orange-300 bg-orange-50' :
                'border-red-300 bg-red-50'
              }`}
            >
              <h4 className="text-sm text-maersk-black mb-2">{level.level}</h4>
              <p className="text-2xl font-bold mb-2">{level.count}</p>
              <div className="text-xs text-functional-mid-grey space-y-1">
                {level.carriers.length > 0 ? (
                  level.carriers.map((c, idx) => (
                    <Badge key={idx} variant="outline" className="mr-1">{c}</Badge>
                  ))
                ) : (
                  <span className="text-green-600">无</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 时效改进建议 */}
      <Card className="p-6">
        <h2 className="text-maersk-black mb-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-maersk-blue" />
          时效改进行动计划
        </h2>
        <div className="space-y-4">
          {improvementRecommendations.map((rec, index) => (
            <div 
              key={index}
              className={`border rounded-lg p-5 ${
                rec.priority === 'high' ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{rec.carrier}</Badge>
                    <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                      {rec.priority === 'high' ? '高优先级' : '中优先级'}
                    </Badge>
                    <Badge variant="outline">可行性: {rec.feasibility}%</Badge>
                  </div>
                  <p className="text-sm text-functional-mid-grey mb-2">
                    <strong>问题:</strong> {rec.issue}
                  </p>
                  <p className="text-sm text-maersk-black">
                    <strong>建议:</strong> {rec.recommendation}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t">
                <div>
                  <p className="text-xs text-functional-mid-grey mb-1">预期提升</p>
                  <p className="text-sm text-green-600">{rec.expectedImprovement}</p>
                </div>
                <div>
                  <p className="text-xs text-functional-mid-grey mb-1">实施周期</p>
                  <p className="text-sm text-maersk-black">{rec.timeline}</p>
                </div>
                <div>
                  <p className="text-xs text-functional-mid-grey mb-1">成本投入</p>
                  <p className="text-sm text-maersk-black">{rec.cost}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Award, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Package, 
  AlertTriangle,
  CheckCircle,
  Star,
  Target,
  FileText,
  UserCheck
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface CarrierPerformanceProps {
  unifiedCourierData?: any;
}

export function CarrierPerformance({ unifiedCourierData }: CarrierPerformanceProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // 3PL承运商综合评估（4PL管理视角）
  const carrierEvaluation = [
    {
      carrier: 'SF',
      name: '顺丰速运',
      overallScore: 95,
      rank: 1,
      serviceLevel: 'Premium',
      kpi: {
        onTimeRate: 98.5,
        qualityScore: 96,
        responseTime: 2.5,
        coverageRate: 95,
        costEfficiency: 85,
        systemIntegration: 98
      },
      contract: {
        volumeCommitment: 50000,
        actualVolume: 45000,
        fulfillmentRate: 90,
        nextReview: '2025-03'
      },
      trend: 'up',
      change: 2.3,
      riskLevel: 'low',
      actions: []
    },
    {
      carrier: 'ZTO',
      name: '中通快递',
      overallScore: 88,
      rank: 2,
      serviceLevel: 'Standard',
      kpi: {
        onTimeRate: 92.3,
        qualityScore: 88,
        responseTime: 4.2,
        coverageRate: 98,
        costEfficiency: 95,
        systemIntegration: 85
      },
      contract: {
        volumeCommitment: 40000,
        actualVolume: 38000,
        fulfillmentRate: 95,
        nextReview: '2025-06'
      },
      trend: 'up',
      change: 1.5,
      riskLevel: 'low',
      actions: ['合同即将到期']
    },
    {
      carrier: 'YTO',
      name: '圆通速递',
      overallScore: 85,
      rank: 3,
      serviceLevel: 'Standard',
      kpi: {
        onTimeRate: 90.1,
        qualityScore: 85,
        responseTime: 5.1,
        coverageRate: 96,
        costEfficiency: 92,
        systemIntegration: 80
      },
      contract: {
        volumeCommitment: 35000,
        actualVolume: 32000,
        fulfillmentRate: 91,
        nextReview: '2025-09'
      },
      trend: 'down',
      change: -0.8,
      riskLevel: 'medium',
      actions: ['时效下降', '需要改进']
    },
    {
      carrier: 'STO',
      name: '申通快递',
      overallScore: 82,
      rank: 4,
      serviceLevel: 'Economy',
      kpi: {
        onTimeRate: 88.7,
        qualityScore: 82,
        responseTime: 5.8,
        coverageRate: 94,
        costEfficiency: 94,
        systemIntegration: 75
      },
      contract: {
        volumeCommitment: 30000,
        actualVolume: 28000,
        fulfillmentRate: 93,
        nextReview: '2025-12'
      },
      trend: 'up',
      change: 0.9,
      riskLevel: 'medium',
      actions: ['系统对接待完善']
    }
  ];

  // Control Tower KPI（管理视角）
  const controlTowerKPI = [
    {
      title: '3PL网络覆盖率',
      value: '96.2%',
      target: '≥95%',
      status: 'good',
      icon: Target,
      color: 'text-green-600',
      description: '已覆盖全国96.2%的配送区域'
    },
    {
      title: '承运商准入合规率',
      value: '100%',
      target: '100%',
      status: 'good',
      icon: UserCheck,
      color: 'text-green-600',
      description: '所有合作承运商均通过资质审核'
    },
    {
      title: '合同执行率',
      value: '92.3%',
      target: '≥90%',
      status: 'good',
      icon: FileText,
      color: 'text-green-600',
      description: '承运商订单量达成率'
    },
    {
      title: '风险预警',
      value: '2',
      target: '≤3',
      status: 'warning',
      icon: AlertTriangle,
      color: 'text-orange-600',
      description: '2个承运商需要关注'
    }
  ];

  // 多维度对比雷达图数据
  const radarData = carrierEvaluation.map(c => ({
    carrier: c.carrier,
    时效: c.kpi.onTimeRate,
    质量: c.kpi.qualityScore,
    响应: 100 - c.kpi.responseTime * 10, // 转换为分数
    覆盖: c.kpi.coverageRate,
    成本: c.kpi.costEfficiency,
    系统: c.kpi.systemIntegration
  }));

  // 月度趋势对比
  const monthlyTrend = [
    { month: '1月', SF: 94, ZTO: 86, YTO: 86, STO: 81 },
    { month: '2月', SF: 93, ZTO: 87, YTO: 85, STO: 81 },
    { month: '3月', SF: 94, ZTO: 87, YTO: 84, STO: 82 },
    { month: '4月', SF: 95, ZTO: 88, YTO: 85, STO: 82 },
    { month: '5月', SF: 95, ZTO: 88, YTO: 85, STO: 82 },
    { month: '6月', SF: 95, ZTO: 88, YTO: 85, STO: 82 }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 90) return 'default';
    if (score >= 80) return 'secondary';
    return 'destructive';
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'low':
        return <Badge variant="default" className="bg-green-600">低风险</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-orange-600 text-white">中风险</Badge>;
      case 'high':
        return <Badge variant="destructive">高风险</Badge>;
      default:
        return <Badge variant="outline">未知</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 - Control Tower视角 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-maersk-black">4PL Control Tower - 承运商绩效管理</h1>
            <Badge variant="outline" className="bg-maersk-blue text-white">管理视角</Badge>
          </div>
          <p className="text-functional-mid-grey">
            统一管理和评估多个3PL承运商的服务质量、运营效率和合规性
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            生成供应商评估报告
          </Button>
        </div>
      </div>

      {/* 风险预警 */}
      <Alert className="border-orange-300 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span className="text-orange-700">
              检测到 2 个承运商需要关注：YTO时效下降0.8%，STO系统对接待完善
            </span>
            <Button variant="outline" size="sm">查看详情</Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Control Tower 关键指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {controlTowerKPI.map((metric, index) => (
          <Card key={index} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg bg-functional-bright-grey ${metric.color}`}>
                <metric.icon className="h-5 w-5" />
              </div>
              <Badge variant={metric.status === 'good' ? 'default' : 'secondary'}>
                目标: {metric.target}
              </Badge>
            </div>
            <h3 className="text-sm text-functional-mid-grey mb-1">{metric.title}</h3>
            <p className={`text-maersk-black mb-1 ${metric.color}`}>{metric.value}</p>
            <p className="text-xs text-functional-mid-grey">{metric.description}</p>
          </Card>
        ))}
      </div>

      {/* 承运商综合评估排名 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-maersk-blue" />
            <h2 className="text-maersk-black">3PL承运商综合评估</h2>
            <Badge variant="outline">基于6项核心指标</Badge>
          </div>
          <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)}>
            <TabsList>
              <TabsTrigger value="week">周</TabsTrigger>
              <TabsTrigger value="month">月</TabsTrigger>
              <TabsTrigger value="quarter">季</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-4">
          {carrierEvaluation.map((carrier) => (
            <div key={carrier.carrier} className="border rounded-lg p-5 hover:bg-functional-bright-grey transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-maersk-blue text-maersk-white">
                    <span className="text-lg">#{carrier.rank}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-maersk-black">{carrier.name}</h3>
                      <Badge variant="outline">{carrier.carrier}</Badge>
                      <Badge variant="secondary">{carrier.serviceLevel}</Badge>
                      {carrier.rank === 1 && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-functional-mid-grey">
                      <span>合同量: {carrier.contract.volumeCommitment.toLocaleString()}/月</span>
                      <span>实际量: {carrier.contract.actualVolume.toLocaleString()}/月</span>
                      <span>达成率: {carrier.contract.fulfillmentRate}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-maersk-black ${getScoreColor(carrier.overallScore)}`}>
                      {carrier.overallScore} 分
                    </p>
                    <div className="flex items-center gap-1 text-sm">
                      {carrier.trend === 'up' ? (
                        <TrendingUp className="h-3 w-3 text-green-600" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-600" />
                      )}
                      <span className={carrier.trend === 'up' ? 'text-green-600' : 'text-red-600'}>
                        {Math.abs(carrier.change)}%
                      </span>
                    </div>
                  </div>
                  {getRiskBadge(carrier.riskLevel)}
                </div>
              </div>

              {/* KPI详情 */}
              <div className="grid grid-cols-6 gap-3 mt-4 pt-4 border-t">
                <div>
                  <p className="text-xs text-functional-mid-grey mb-1">时效达成</p>
                  <p className="text-sm text-maersk-black">{carrier.kpi.onTimeRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-functional-mid-grey mb-1">服务质量</p>
                  <p className="text-sm text-maersk-black">{carrier.kpi.qualityScore}分</p>
                </div>
                <div>
                  <p className="text-xs text-functional-mid-grey mb-1">响应时间</p>
                  <p className="text-sm text-maersk-black">{carrier.kpi.responseTime}h</p>
                </div>
                <div>
                  <p className="text-xs text-functional-mid-grey mb-1">网络覆盖</p>
                  <p className="text-sm text-maersk-black">{carrier.kpi.coverageRate}%</p>
                </div>
                <div>
                  <p className="text-xs text-functional-mid-grey mb-1">成本效率</p>
                  <p className="text-sm text-maersk-black">{carrier.kpi.costEfficiency}分</p>
                </div>
                <div>
                  <p className="text-xs text-functional-mid-grey mb-1">系统对接</p>
                  <p className="text-sm text-maersk-black">{carrier.kpi.systemIntegration}%</p>
                </div>
              </div>

              {/* 管理动作 */}
              {carrier.actions.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-functional-mid-grey">管理动作:</span>
                    {carrier.actions.map((action, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {action}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 多维度对比分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-maersk-black mb-4">多维度能力对比</h3>
          <ResponsiveContainer width="100%" height={350}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="carrier" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="SF" dataKey="时效" stroke="#0088FE" fill="#0088FE" fillOpacity={0.3} />
              <Radar name="ZTO" dataKey="时效" stroke="#00C49F" fill="#00C49F" fillOpacity={0.3} />
              <Radar name="YTO" dataKey="时效" stroke="#FFBB28" fill="#FFBB28" fillOpacity={0.3} />
              <Radar name="STO" dataKey="时效" stroke="#FF8042" fill="#FF8042" fillOpacity={0.3} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
          <p className="text-xs text-functional-mid-grey text-center mt-2">
            基于时效、质量、响应、覆盖、成本、系统6个维度评估
          </p>
        </Card>

        <Card className="p-6">
          <h3 className="text-maersk-black mb-4">月度绩效趋势对比</h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[75, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="SF" stroke="#0088FE" strokeWidth={2} />
              <Line type="monotone" dataKey="ZTO" stroke="#00C49F" strokeWidth={2} />
              <Line type="monotone" dataKey="YTO" stroke="#FFBB28" strokeWidth={2} />
              <Line type="monotone" dataKey="STO" stroke="#FF8042" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-functional-mid-grey text-center mt-2">
            承运商综合评分月度变化趋势
          </p>
        </Card>
      </div>

      {/* 管理建议 */}
      <Card className="p-6">
        <h2 className="text-maersk-black mb-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          供应商管理建议
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 bg-green-50 border-green-200">
            <Badge variant="default" className="mb-2">优先级：高</Badge>
            <h4 className="text-maersk-black mb-2">与ZTO续约谈判</h4>
            <p className="text-sm text-functional-mid-grey mb-2">
              合同将于2025年6月到期，建议提前3个月启动续约谈判
            </p>
            <p className="text-xs text-green-700">预计成本优化: 5-8%</p>
          </div>

          <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
            <Badge variant="secondary" className="mb-2 bg-orange-600 text-white">优先级：中</Badge>
            <h4 className="text-maersk-black mb-2">YTO服务改进计划</h4>
            <p className="text-sm text-functional-mid-grey mb-2">
              时效表现下降0.8%，建议召开季度业务评审会
            </p>
            <p className="text-xs text-orange-700">目标: 时效提升至92%</p>
          </div>

          <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
            <Badge variant="secondary" className="mb-2">优先级：中</Badge>
            <h4 className="text-maersk-black mb-2">STO系统对接优化</h4>
            <p className="text-sm text-functional-mid-grey mb-2">
              系统对接完成度75%，需要完成EDI和API全对接
            </p>
            <p className="text-xs text-blue-700">预计效率提升: 15%</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

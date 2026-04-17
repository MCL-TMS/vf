import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { WeightRangeData } from "../data/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Package, 
  DollarSign, 
  TrendingDown, 
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Calculator,
  Target
} from "lucide-react";

interface WeightDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  weightRange: WeightRangeData | null;
}

interface OptimizationInsight {
  type: string;
  description: string;
  dataPoint: string;
  expectedSaving: number;
  confidence: 'high' | 'medium' | 'low';
  actionItems: string[];
  timeline: string;
}

export function WeightDetailDialog({ isOpen, onClose, weightRange }: WeightDetailDialogProps) {
  if (!weightRange) return null;

  // 计算关键数据指标
  const totalOrders = weightRange.totalOrders;
  const avgCost = weightRange.avgCost;
  const totalValue = totalOrders * avgCost;
  
  // 计算快递公司对比数据
  const courierData = weightRange.brandData.flatMap(brand => 
    brand.courierData.map(courier => ({
      courier: courier.courier,
      orders: courier.orders,
      avgCost: courier.avgShippingCost,
      brand: brand.brand,
      percentage: courier.percentage
    }))
  );

  // 按快递公司聚合
  const courierSummary = courierData.reduce((acc, item) => {
    if (!acc[item.courier]) {
      acc[item.courier] = { 
        courier: item.courier, 
        totalOrders: 0, 
        totalCost: 0, 
        brands: 0,
        avgCost: 0,
        weightedCost: 0
      };
    }
    acc[item.courier].totalOrders += item.orders;
    acc[item.courier].totalCost += item.orders * item.avgCost;
    acc[item.courier].brands++;
    acc[item.courier].weightedCost += item.orders * item.avgCost;
    return acc;
  }, {} as Record<string, any>);

  // 计算平均成本
  Object.values(courierSummary).forEach((courier: any) => {
    courier.avgCost = courier.totalCost / courier.totalOrders;
  });

  const chartData = Object.values(courierSummary).map((courier: any) => ({
    name: courier.courier,
    orders: courier.totalOrders,
    avgCost: courier.avgCost.toFixed(2)
  }));

  // 数据驱动的优化洞察生成
  const generateOptimizationInsights = (): OptimizationInsight[] => {
    const insights: OptimizationInsight[] = [];
    const isLightWeight = weightRange.range === '0-0.5kg' || weightRange.range === '0.5-1kg';

    // 1. 基于重量区间的包装优化
    if (isLightWeight) {
      const packagingPotential = totalOrders * avgCost * 0.15; // 15%节省潜力
      insights.push({
        type: "包装材料优化",
        description: `${weightRange.range}包裹平均运费¥${avgCost}，通过轻量化包装可降低重量`,
        dataPoint: `当前${totalOrders.toLocaleString()}单，总运费¥${totalValue.toLocaleString()}`,
        expectedSaving: packagingPotential,
        confidence: totalOrders > 100000 ? 'high' : totalOrders > 50000 ? 'medium' : 'low',
        actionItems: [
          "采用0.1mm薄型包装膜",
          "使用轻质填充材料",
          "优化包装盒设计",
          "实施包装重量标准"
        ],
        timeline: "2-3个月见效"
      });
    }

    // 2. 基于快递公司成本差异的优化
    const courierCosts = chartData.map(c => parseFloat(c.avgCost));
    const minCost = Math.min(...courierCosts);
    const maxCost = Math.max(...courierCosts);
    const costDiffPercentage = ((maxCost - minCost) / maxCost) * 100;

    if (costDiffPercentage > 15) {
      const optimizationPotential = totalOrders * (maxCost - minCost) * 0.6; // 60%的差异可优化
      insights.push({
        type: "快递商选择优化",
        description: `快递公司间成本差异${costDiffPercentage.toFixed(1)}%，存在优化空间`,
        dataPoint: `最低¥${minCost.toFixed(2)} vs 最高¥${maxCost.toFixed(2)}`,
        expectedSaving: optimizationPotential,
        confidence: 'high',
        actionItems: [
          "制定智能路由规则",
          "按服务质量重新分配",
          "建立成本效益评估",
          "定期重新谈判费率"
        ],
        timeline: "1-2个月见效"
      });
    }

    // 3. 基于订单量的批量谈判
    if (totalOrders > 50000) {
      const negotiationPotential = totalValue * 0.08; // 8%批量折扣潜力
      insights.push({
        type: "批量费率谈判",
        description: `${weightRange.range}包裹量达${totalOrders.toLocaleString()}单，具备强谈判地位`,
        dataPoint: `年化体量¥${(totalValue * 12).toLocaleString()}`,
        expectedSaving: negotiationPotential,
        confidence: totalOrders > 100000 ? 'high' : 'medium',
        actionItems: [
          "准备年度采购计划",
          "建立多家竞标机制",
          "谈判阶梯式费率",
          "争取长期合作优惠"
        ],
        timeline: "季度谈判周期"
      });
    }

    // 4. 基于重量特征的运输优化
    if (!isLightWeight) {
      const heavyOptimization = totalValue * 0.12; // 重件专线优化
      insights.push({
        type: "重件运输优化",
        description: `${weightRange.range}重件包裹需要专门的运输方案`,
        dataPoint: `重件占比分析，平均运费¥${avgCost}`,
        expectedSaving: heavyOptimization,
        confidence: 'medium',
        actionItems: [
          "启用重件专线",
          "优化包装保护",
          "建立重件仓储",
          "实施分区配送"
        ],
        timeline: "3-6个月建设期"
      });
    }

    // 5. 基于品牌分布的定制化方案
    const brandCount = weightRange.brandData.length;
    if (brandCount >= 3) {
      const customizationPotential = totalValue * 0.06; // 6%定制化节省
      insights.push({
        type: "品牌定制化方案",
        description: `涉及${brandCount}个品牌，可实施差异化包装策略`,
        dataPoint: `多品牌协同，优化包装标准`,
        expectedSaving: customizationPotential,
        confidence: 'medium',
        actionItems: [
          "建立品牌包装标准",
          "实施统一采购",
          "共享包装设计",
          "协调发货计划"
        ],
        timeline: "持续优化"
      });
    }

    return insights.sort((a, b) => b.expectedSaving - a.expectedSaving);
  };

  const optimizationInsights = generateOptimizationInsights();
  const totalPotentialSaving = optimizationInsights.reduce((sum, insight) => sum + insight.expectedSaving, 0);

  const isLightWeight = weightRange.range === '0-0.5kg' || weightRange.range === '0.5-1kg';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-6 border-b border-gray-200">
          <DialogTitle className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <span className="text-xl font-semibold text-gray-900">
                {weightRange.range} 包裹数据洞察分析
              </span>
              <DialogDescription className="mt-1 text-gray-600">
                基于实际数据的{isLightWeight ? '轻量包裹' : '重量包裹'}成本优化分析与建议
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 数据概览 */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="border-blue-200">
              <CardContent className="p-4 text-center">
                <Package className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <div className="text-xl font-bold text-blue-900">{weightRange.totalOrders.toLocaleString()}</div>
                <div className="text-sm text-blue-700">总订单数</div>
              </CardContent>
            </Card>
            
            <Card className="border-green-200">
              <CardContent className="p-4 text-center">
                <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <div className="text-xl font-bold text-green-900">¥{weightRange.avgCost}</div>
                <div className="text-sm text-green-700">单均运费</div>
              </CardContent>
            </Card>
            
            <Card className="border-orange-200">
              <CardContent className="p-4 text-center">
                <Calculator className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                <div className="text-xl font-bold text-orange-900">¥{Math.round(totalValue / 10000)}万</div>
                <div className="text-sm text-orange-700">总运费成本</div>
              </CardContent>
            </Card>
            
            <Card className="border-purple-200">
              <CardContent className="p-4 text-center">
                <Target className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                <div className="text-xl font-bold text-purple-900">{optimizationInsights.length}</div>
                <div className="text-sm text-purple-700">优化方案</div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardContent className="p-4 text-center">
                <TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-600" />
                <div className="text-xl font-bold text-red-900">¥{Math.round(totalPotentialSaving / 10000)}万</div>
                <div className="text-sm text-red-700">节省潜力</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 快递公司成本分析 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-blue-600" />
                  快递公司成本对比
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <Tooltip 
                        formatter={(value, name) => [
                          name === 'orders' ? `${value.toLocaleString()} 单` : `¥${value}`,
                          name === 'orders' ? '订单数' : '单均运费'
                        ]}
                      />
                      <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="space-y-3">
                  {chartData.map((courier, index) => {
                    const marketShare = (courier.orders / totalOrders * 100).toFixed(1);
                    const costEfficiency = parseFloat(courier.avgCost) < avgCost ? 'high' : 'medium';
                    return (
                      <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <span className="font-medium">{courier.name}</span>
                          <Badge 
                            variant="outline" 
                            className={`ml-2 text-xs ${
                              costEfficiency === 'high' ? 'border-green-300 text-green-700' : 'border-yellow-300 text-yellow-700'
                            }`}
                          >
                            {costEfficiency === 'high' ? '成本优势' : '标准成本'}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{courier.orders.toLocaleString()} 单 ({marketShare}%)</div>
                          <div className="text-sm text-green-600">¥{courier.avgCost}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 数据驱动的优化建议 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  数据驱动优化方案
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-80 overflow-y-auto">
                  {optimizationInsights.map((insight, index) => (
                    <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className="font-semibold text-gray-900">{insight.type}</h5>
                          <Badge 
                            variant="outline" 
                            className={`text-xs mt-1 ${
                              insight.confidence === 'high' 
                                ? 'border-green-300 text-green-700 bg-green-50'
                                : insight.confidence === 'medium'
                                ? 'border-yellow-300 text-yellow-700 bg-yellow-50'
                                : 'border-blue-300 text-blue-700 bg-blue-50'
                            }`}
                          >
                            {insight.confidence === 'high' ? '高确定性' : insight.confidence === 'medium' ? '中等确定性' : '待验证'}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">¥{Math.round(insight.expectedSaving / 10000)}万</div>
                          <div className="text-xs text-gray-500">{insight.timeline}</div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                      <p className="text-xs text-blue-600 mb-3">{insight.dataPoint}</p>
                      
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-700">执行要点:</p>
                        {insight.actionItems.slice(0, 2).map((item, idx) => (
                          <p key={idx} className="text-xs text-gray-600">• {item}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 总结与建议 */}
          <div className={`p-6 rounded-lg border-l-4 ${isLightWeight ? 'bg-green-50 border-green-400' : 'bg-blue-50 border-blue-400'}`}>
            <div className="flex items-start gap-4">
              <AlertTriangle className={`h-6 w-6 mt-1 ${isLightWeight ? 'text-green-600' : 'text-blue-600'}`} />
              <div className="flex-1">
                <h5 className={`font-semibold mb-3 text-lg ${isLightWeight ? 'text-green-900' : 'text-blue-900'}`}>
                  基于数据的优化总结
                </h5>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h6 className={`font-medium mb-2 ${isLightWeight ? 'text-green-800' : 'text-blue-800'}`}>
                      数据洞察:
                    </h6>
                    <ul className={`space-y-1 ${isLightWeight ? 'text-green-700' : 'text-blue-700'}`}>
                      <li>• 当前{weightRange.range}包裹{totalOrders.toLocaleString()}单，占比分析完成</li>
                      <li>• 单均运费¥{avgCost}，总成本¥{Math.round(totalValue/10000)}万</li>
                      <li>• 识别{optimizationInsights.length}个优化机会，置信度评估完成</li>
                      <li>• 预计总节省潜力¥{Math.round(totalPotentialSaving/10000)}万</li>
                    </ul>
                  </div>
                  <div>
                    <h6 className={`font-medium mb-2 ${isLightWeight ? 'text-green-800' : 'text-blue-800'}`}>
                      执行建议:
                    </h6>
                    <ul className={`space-y-1 ${isLightWeight ? 'text-green-700' : 'text-blue-700'}`}>
                      <li>• 优先实施高确定性方案，快速见效</li>
                      <li>• 建立数据监控体系，跟踪优化效果</li>
                      <li>• 制定分阶段实施计划，降低执行风险</li>
                      <li>• 定期复评数据，持续优化策略</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
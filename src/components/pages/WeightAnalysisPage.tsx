import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { WeightDistributionChart } from "../WeightDistributionChart";
import { weightRangeData, brands } from "../../data/mockData";
import { 
  Package, 
  TrendingUp, 
  BarChart3, 
  ArrowLeft, 
  Download,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Target,
  Users,
  Eye,
  EyeOff,
  Brain,
  Zap,
  TrendingDown
} from "lucide-react";

interface WeightAnalysisPageProps {
  data?: any;
  selectedBrand?: string;
  dateRange?: { from: string; to: string };
  onDateRangeChange?: (from: string, to: string) => void;
  onBack?: () => void;
}

export function WeightAnalysisPage({ selectedBrand: globalSelectedBrand, onBack }: WeightAnalysisPageProps) {
  // 页面内部的品牌选择状态，独立于全局品牌筛选
  const [viewSelectedBrand, setViewSelectedBrand] = useState("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState("本月");
  
  // AI驱动优化机会模块的显示状态
  const [showAdvancedAnalysis, setShowAdvancedAnalysis] = useState(false);

  const timeRanges = ["本月", "上月", "近3月", "近6月", "本年"];

  // 模拟数据 - 页面级别的统计数据
  const pageStats = {
    totalOrders: 2663472,
    lightWeightOrders: 1597483,
    lightWeightRatio: 59.97,
    avgWeight: 2.34,
    costOptimization: 1.2,
    lastUpdated: "2025-01-10 14:30"
  };

  // 获取6个子品牌，排除VF母品牌
  const subBrands = brands.filter(brand => brand.name !== 'VF');

  // 为每个品牌计算详细的重量分析数据
  const getBrandWeightAnalysis = (brandName: string) => {
    const brandData = weightRangeData.map(range => {
      const brandInfo = range.brandData.find(b => b.brand === brandName);
      return {
        range: range.range,
        orders: brandInfo?.orders || 0,
        percentage: brandInfo?.percentage || 0,
        avgCost: range.avgCost,
        courierData: brandInfo?.courierData || []
      };
    });

    const totalOrders = brandData.reduce((sum, range) => sum + range.orders, 0);
    const lightWeightOrders = brandData
      .filter(range => range.range === '0-1kg' || range.range === '1-3kg')
      .reduce((sum, range) => sum + range.orders, 0);
    const lightWeightRatio = totalOrders > 0 ? (lightWeightOrders / totalOrders) * 100 : 0;
    
    const ultraLightOrders = brandData.find(range => range.range === '0-1kg')?.orders || 0;
    const ultraLightRatio = totalOrders > 0 ? (ultraLightOrders / totalOrders) * 100 : 0;
    
    const avgWeight = brandData.reduce((sum, range, index) => {
      const midWeight = index === 0 ? 0.5 : index === 1 ? 2 : index === 2 ? 4 : 7;
      return sum + (midWeight * range.orders);
    }, 0) / totalOrders;

    const totalCost = brandData.reduce((sum, range) => sum + (range.avgCost * range.orders), 0);
    const avgCostPerOrder = totalOrders > 0 ? totalCost / totalOrders : 0;

    // 计算优化机会
    const optimizationOpportunities = [];
    
    if (lightWeightRatio > 60) {
      optimizationOpportunities.push({
        type: "包装优化",
        priority: "高",
        impact: `¥${Math.round(lightWeightOrders * avgCostPerOrder * 0.15 / 10000)}万`,
        description: `轻量包裹占比${lightWeightRatio.toFixed(1)}%，存在包装优化空间`
      });
    }

    if (ultraLightRatio > 35) {
      optimizationOpportunities.push({
        type: "费率谈判",
        priority: ultraLightRatio > 45 ? "高" : "中",
        impact: `¥${Math.round(ultraLightOrders * avgCostPerOrder * 0.12 / 10000)}万`,
        description: `超轻量包裹占比${ultraLightRatio.toFixed(1)}%，具备批量谈判优势`
      });
    }

    // 快递公司成本分析
    const courierAnalysis = brandData.map(range => {
      const ztoCourier = range.courierData.find(c => c.courier === '中通');
      const sfCourier = range.courierData.find(c => c.courier === '顺丰');
      
      if (ztoCourier && sfCourier) {
        const costDiff = ((sfCourier.avgShippingCost - ztoCourier.avgShippingCost) / sfCourier.avgShippingCost) * 100;
        return { range: range.range, costDiff, ztoOrders: ztoCourier.orders, sfOrders: sfCourier.orders };
      }
      return null;
    }).filter(Boolean);

    const avgCostDiff = courierAnalysis.reduce((sum, item) => sum + item.costDiff, 0) / courierAnalysis.length;
    
    if (avgCostDiff > 25) {
      optimizationOpportunities.push({
        type: "快递优化",
        priority: avgCostDiff > 35 ? "高" : "中",
        impact: `¥${Math.round(totalCost * 0.08 / 10000)}万`,
        description: `快递成本差异${avgCostDiff.toFixed(1)}%，可优化配送结构`
      });
    }

    return {
      brandName,
      totalOrders,
      lightWeightOrders,
      lightWeightRatio,
      ultraLightRatio,
      avgWeight,
      avgCostPerOrder,
      totalCost,
      optimizationOpportunities,
      courierAnalysis,
      weightDistribution: brandData
    };
  };

  // 获取所有品牌的重量分析数据
  const brandAnalysisData = subBrands.map(brand => getBrandWeightAnalysis(brand.name));

  // 获取品牌图标
  const getBrandIcon = (brandName: string) => {
    const brand = brands.find(b => b.name === brandName);
    return brand?.logo || '🏷️';
  };

  // 获取优化建议颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '高': return 'text-accent-dark-red bg-accent-bright-red border-accent-light-red';
      case '中': return 'text-accent-dark-orange bg-accent-bright-orange border-accent-light-orange';
      case '低': return 'text-accent-dark-green bg-accent-bright-green border-accent-light-green';
      default: return 'text-functional-mid-grey bg-functional-bright-grey border-functional-light-grey';
    }
  };

  // AI驱动的高级分析建议生成
  const generateAdvancedAnalysis = (brandData: any) => {
    const aiInsights = [
      {
        type: "AI预测模型",
        category: "智能预测",
        icon: <Brain className="h-4 w-4" />,
        confidence: 92,
        prediction: `基于历史数据分析，预测${brandData.brandName}品牌在未来3个月内轻量包裹占比将${brandData.lightWeightRatio > 65 ? '上升' : '下降'}${Math.abs(brandData.lightWeightRatio - 60).toFixed(1)}%`,
        impact: `¥${Math.round(brandData.totalCost * 0.05 / 10000)}万`,
        recommendation: "建议提前调整包装策略和快递商谈判节奏"
      },
      {
        type: "机器学习洞察",
        category: "模式识别", 
        icon: <Zap className="h-4 w-4" />,
        confidence: 87,
        prediction: `算法识别出${brandData.brandName}品牌存在${brandData.avgWeight > 2.5 ? '重量集中' : '重量分散'}模式，与同类品牌相比${brandData.avgWeight > 2.5 ? '偏重' : '偏轻'}${Math.abs(brandData.avgWeight - 2.2).toFixed(1)}kg`,
        impact: `¥${Math.round(brandData.totalCost * 0.08 / 10000)}万`,
        recommendation: "运用聚类分析优化产品包装和物流路径规划"
      },
      {
        type: "动态定价建议",
        category: "智能定价",
        icon: <TrendingUp className="h-4 w-4" />,
        confidence: 89,
        prediction: `基于多变量回归模型，${brandData.brandName}品牌在重量区间${brandData.lightWeightRatio > 60 ? '0-1kg' : '1-3kg'}具有最佳成本效益比，建议重点优化此区间`,
        impact: `¥${Math.round(brandData.totalCost * 0.12 / 10000)}万`,
        recommendation: "采用动态定价策略，根据重量区间智能调整运费标准"
      }
    ];

    return aiInsights;
  };

  // 渲染品牌总览
  const renderBrandOverview = () => (
    <div className="space-y-6">
      {/* 品牌对比卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {brandAnalysisData.map((brandData, index) => (
          <Card key={brandData.brandName} className="maersk-card shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setViewSelectedBrand(brandData.brandName)}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-functional-bright-blue rounded-full flex items-center justify-center border border-functional-light-blue">
                    <span className="text-lg">{getBrandIcon(brandData.brandName)}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-maersk-black">{brandData.brandName}</h3>
                    <p className="text-sm text-functional-mid-grey">
                      {brandData.totalOrders.toLocaleString()} 个包裹
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-maersk-blue hover:bg-functional-bright-blue">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* 核心指标 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-functional-bright-grey rounded border border-functional-light-grey">
                  <div className="text-base font-semibold text-maersk-black">
                    {brandData.lightWeightRatio.toFixed(1)}%
                  </div>
                  <div className="text-xs text-functional-mid-grey">轻量占比</div>
                </div>
                <div className="text-center p-2 bg-functional-bright-grey rounded border border-functional-light-grey">
                  <div className="text-base font-semibold text-maersk-black">
                    {brandData.avgWeight.toFixed(2)}kg
                  </div>
                  <div className="text-xs text-functional-mid-grey">平均重量</div>
                </div>
                <div className="text-center p-2 bg-functional-bright-grey rounded border border-functional-light-grey">
                  <div className="text-base font-semibold text-maersk-black">
                    ¥{brandData.avgCostPerOrder.toFixed(1)}
                  </div>
                  <div className="text-xs text-functional-mid-grey">单均运费</div>
                </div>
              </div>

              {/* 优化机会数量 */}
              <div className="flex items-center justify-between p-3 bg-accent-bright-orange rounded border border-accent-light-orange">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-accent-mid-orange" />
                  <span className="font-medium text-accent-dark-orange">优化机会</span>
                </div>
                <Badge variant="outline" className="bg-maersk-white text-accent-dark-orange border-accent-mid-orange">
                  {brandData.optimizationOpportunities.length} 项
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 综合对比分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="maersk-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-maersk-blue" />
              轻量包裹占比排行
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {brandAnalysisData
                .sort((a, b) => b.lightWeightRatio - a.lightWeightRatio)
                .map((brand, index) => (
                  <div key={brand.brandName} 
                       className="flex items-center justify-between p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey hover:bg-functional-light-grey cursor-pointer transition-colors"
                       onClick={() => setViewSelectedBrand(brand.brandName)}>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-maersk-blue text-maersk-white rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="text-lg">{getBrandIcon(brand.brandName)}</span>
                      <span className="font-medium text-maersk-black">{brand.brandName}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-maersk-black">{brand.lightWeightRatio.toFixed(1)}%</div>
                      <div className="text-xs text-functional-mid-grey">
                        {brand.lightWeightOrders.toLocaleString()} 单
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-accent-mid-orange" />
                优化潜力评估
              </CardTitle>
              
              {/* AI分析切换按钮 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-functional-mid-grey">AI洞察</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedAnalysis(!showAdvancedAnalysis)}
                  className={`p-2 rounded-lg border transition-colors ${
                    showAdvancedAnalysis 
                      ? 'bg-maersk-blue text-maersk-white border-maersk-blue hover:bg-functional-mid-blue' 
                      : 'bg-maersk-white text-functional-mid-grey border-functional-light-grey hover:bg-functional-bright-grey'
                  }`}
                  title={showAdvancedAnalysis ? "隐藏AI驱动分析" : "显示AI驱动分析"}
                >
                  {showAdvancedAnalysis ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* 基础优化潜力 */}
            <div className="space-y-3 mb-4">
              {brandAnalysisData
                .sort((a, b) => b.optimizationOpportunities.length - a.optimizationOpportunities.length)
                .map((brand) => (
                  <div key={brand.brandName} 
                       className="p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey hover:bg-functional-light-grey cursor-pointer transition-colors"
                       onClick={() => setViewSelectedBrand(brand.brandName)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getBrandIcon(brand.brandName)}</span>
                        <span className="font-medium text-maersk-black">{brand.brandName}</span>
                      </div>
                      <Badge variant="outline" className="bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange">
                        {brand.optimizationOpportunities.length} 项机会
                      </Badge>
                    </div>
                    {brand.optimizationOpportunities.length > 0 ? (
                      <div className="text-sm text-functional-mid-grey">
                        主要机会: {brand.optimizationOpportunities.map(o => o.type).join('、')}
                      </div>
                    ) : (
                      <div className="text-sm text-functional-mid-grey">暂无明显优化机会</div>
                    )}
                  </div>
                ))}
            </div>

            {/* AI驱动的品牌对比分析 - 可隐藏区域 */}
            {showAdvancedAnalysis && (
              <div className="border-t border-functional-light-grey pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-maersk-blue" />
                  <h4 className="font-medium text-maersk-black">AI品牌对比洞察</h4>
                  <Badge variant="outline" className="text-xs bg-maersk-blue text-maersk-white border-maersk-blue">
                    跨品牌分析
                  </Badge>
                </div>

                <div className="bg-gradient-to-r from-functional-bright-blue to-accent-bright-teal p-4 rounded-lg border border-functional-light-blue mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-functional-dark-blue" />
                        <span className="text-sm font-medium text-functional-dark-blue">最具潜力品牌</span>
                      </div>
                      <div className="text-lg font-semibold text-maersk-black">
                        {brandAnalysisData
                          .sort((a, b) => b.optimizationOpportunities.length - a.optimizationOpportunities.length)[0]?.brandName}
                      </div>
                      <div className="text-xs text-functional-mid-grey">
                        AI识别出最多优化机会
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-accent-dark-green" />
                        <span className="text-sm font-medium text-functional-dark-blue">最优化品牌</span>
                      </div>
                      <div className="text-lg font-semibold text-maersk-black">
                        {brandAnalysisData
                          .sort((a, b) => a.optimizationOpportunities.length - b.optimizationOpportunities.length)[0]?.brandName}
                      </div>
                      <div className="text-xs text-functional-mid-grey">
                        运营效率相对最高
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-accent-mid-orange" />
                      <span className="text-sm font-medium text-maersk-black">智能优化建议</span>
                    </div>
                    <div className="text-sm text-functional-mid-grey space-y-1">
                      <div>• 建议优先优化前3个品牌，预计可节省总成本的15-20%</div>
                      <div>• 轻量化包装策略在TNF和VANS品牌最有效</div>
                      <div>• 快递商谈判应以DICKIES和TIMBERLAND为重点</div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-accent-bright-teal rounded-lg border border-accent-light-teal">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-accent-dark-teal" />
                      <span className="text-sm font-medium text-accent-dark-teal">预测性分析</span>
                    </div>
                    <div className="text-sm text-accent-dark-teal space-y-1">
                      <div>• 基于当前趋势，预计下季度整体成本可降低8-12%</div>
                      <div>• 机器学习模型建议调整包装策略的最佳时机为本月底</div>
                      <div>• 算法识别出季节性包装需求变化模式</div>
                    </div>
                  </div>
                </div>

                {/* AI分析统计 */}
                <div className="mt-4 p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                  <div className="flex items-center justify-between text-xs text-functional-mid-grey">
                    <div className="flex items-center gap-4">
                      <span>🎯 分析品牌: {brandAnalysisData.length}个</span>
                      <span>📈 总优化机会: {brandAnalysisData.reduce((sum, b) => sum + b.optimizationOpportunities.length, 0)}项</span>
                      <span>💡 AI模型: 多维度回归分析</span>
                    </div>
                    <span>置信度: 85-93%</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // 渲染单个品牌详细分析
  const renderBrandDetail = () => {
    const brandData = brandAnalysisData.find(b => b.brandName === viewSelectedBrand);
    if (!brandData) return null;

    return (
      <div className="space-y-6">
        {/* 品牌详情卡片 */}
        <Card className="maersk-card shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-functional-bright-blue rounded-full flex items-center justify-center border border-functional-light-blue">
                  <span className="text-xl">{getBrandIcon(brandData.brandName)}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-maersk-black">{brandData.brandName}</h2>
                  <p className="text-sm text-functional-mid-grey">
                    {brandData.totalOrders.toLocaleString()} 个包裹的重量分析详情
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setViewSelectedBrand("all")}
                className="maersk-button-secondary"
              >
                返回总览
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* 核心指标 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                <div className="text-2xl font-semibold text-maersk-black">
                  {brandData.lightWeightRatio.toFixed(1)}%
                </div>
                <div className="text-sm text-functional-mid-grey">轻量包裹占比</div>
              </div>
              <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                <div className="text-2xl font-semibold text-maersk-black">
                  {brandData.avgWeight.toFixed(2)}kg
                </div>
                <div className="text-sm text-functional-mid-grey">平均重量</div>
              </div>
              <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                <div className="text-2xl font-semibold text-maersk-black">
                  ¥{brandData.avgCostPerOrder.toFixed(1)}
                </div>
                <div className="text-sm text-functional-mid-grey">单均运费</div>
              </div>
              <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                <div className="text-2xl font-semibold text-maersk-black">
                  ¥{Math.round(brandData.totalCost / 10000)}万
                </div>
                <div className="text-sm text-functional-mid-grey">总运费成本</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 重量分布和优化建议 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 重量分布详情 */}
          <Card className="maersk-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-maersk-blue" />
                重量分布详情
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {brandData.weightDistribution.map((range, idx) => {
                  const percentage = brandData.totalOrders > 0 ? (range.orders / brandData.totalOrders) * 100 : 0;
                  const isLight = range.range === '0-1kg' || range.range === '1-3kg';
                  
                  return (
                    <div key={idx} className="flex items-center justify-between py-3 px-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${isLight ? 'bg-accent-mid-green' : 'bg-functional-mid-grey'}`}></div>
                        <span className="font-medium text-maersk-black">{range.range}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-maersk-black">
                          {range.orders.toLocaleString()}
                        </div>
                        <div className="text-sm text-functional-mid-grey">
                          {percentage.toFixed(1)}% | ¥{range.avgCost}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 优化建议 */}
          <Card className="maersk-card shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-accent-mid-orange" />
                  优化建议
                </CardTitle>
                
                {/* AI分析切换按钮 */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-functional-mid-grey">AI分析</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedAnalysis(!showAdvancedAnalysis)}
                    className={`p-2 rounded-lg border transition-colors ${
                      showAdvancedAnalysis 
                        ? 'bg-maersk-blue text-maersk-white border-maersk-blue hover:bg-functional-mid-blue' 
                        : 'bg-maersk-white text-functional-mid-grey border-functional-light-grey hover:bg-functional-bright-grey'
                    }`}
                    title={showAdvancedAnalysis ? "隐藏AI驱动分析" : "显示AI驱动分析"}
                  >
                    {showAdvancedAnalysis ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 基础优化建议 */}
              {brandData.optimizationOpportunities.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {brandData.optimizationOpportunities.map((opportunity, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${getPriorityColor(opportunity.priority)}`}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium">{opportunity.type}</span>
                        <Badge variant="outline" className="text-xs">
                          {opportunity.priority}优先级
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{opportunity.description}</p>
                      <div className="font-medium">预估节省: {opportunity.impact}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-functional-mid-grey mb-4">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">当前品牌暂无明显优化机会</p>
                </div>
              )}

              {/* AI驱动的高级分析 - 可隐藏区域 */}
              {showAdvancedAnalysis && (
                <div className="border-t border-functional-light-grey pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="h-5 w-5 text-maersk-blue" />
                    <h4 className="font-medium text-maersk-black">AI驱动优化分析</h4>
                    <Badge variant="outline" className="text-xs bg-maersk-blue text-maersk-white border-maersk-blue">
                      基于机器学习
                    </Badge>
                  </div>
                  
                  <div className="bg-functional-bright-blue p-3 rounded-lg border border-functional-light-blue mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-functional-dark-blue" />
                      <span className="text-sm font-medium text-functional-dark-blue">AI分析说明</span>
                    </div>
                    <p className="text-xs text-functional-dark-blue">
                      以下分析基于深度学习算法和历史数据模式识别，结合多维度变量进行预测性分析。
                      建议结合实际业务情况进行决策。
                    </p>
                  </div>

                  <div className="space-y-3">
                    {generateAdvancedAnalysis(brandData).map((insight, idx) => (
                      <div key={idx} className="p-4 bg-gradient-to-r from-maersk-white to-functional-bright-blue rounded-lg border border-functional-light-blue">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {insight.icon}
                            <span className="font-medium text-maersk-black">{insight.type}</span>
                            <Badge variant="outline" className="text-xs bg-maersk-blue text-maersk-white border-maersk-blue">
                              {insight.category}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-maersk-blue">
                              置信度: {insight.confidence}%
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="text-sm text-maersk-black">
                            <strong>预测:</strong> {insight.prediction}
                          </div>
                          <div className="text-sm text-functional-mid-grey">
                            <strong>建议:</strong> {insight.recommendation}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-accent-dark-green">
                              预估影响: {insight.impact}
                            </span>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-accent-mid-green rounded-full"></div>
                              <span className="text-xs text-functional-mid-grey">AI预测</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI分析底部说明 */}
                  <div className="mt-4 p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                    <div className="flex items-center justify-between text-xs text-functional-mid-grey">
                      <div className="flex items-center gap-4">
                        <span>🤖 AI模型版本: v2.1.5</span>
                        <span>📊 数据样本: 过去12个月</span>
                        <span>🎯 算法: 深度学习 + 时间序列分析</span>
                      </div>
                      <span>最后更新: {pageStats.lastUpdated}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 快递成本分析 */}
        {brandData.courierAnalysis.length > 0 && (
          <Card className="maersk-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-accent-mid-teal" />
                快递成本分析
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {brandData.courierAnalysis.map((analysis, idx) => (
                  <div key={idx} className="p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                    <h4 className="font-medium text-maersk-black mb-2">{analysis.range}</h4>
                    <div className="text-sm text-functional-mid-grey space-y-1">
                      <div>成本差异: <span className="font-medium text-maersk-black">{analysis.costDiff.toFixed(1)}%</span></div>
                      <div>中通: <span className="font-medium">{analysis.ztoOrders.toLocaleString()}单</span></div>
                      <div>顺丰: <span className="font-medium">{analysis.sfOrders.toLocaleString()}单</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 bg-functional-bright-grey min-h-screen space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between bg-[rgba(255,255,255,0)] mt-[0px] mr-[0px] mb-[10px] ml-[0px] rounded-[10px] p-[10px]">
        <div className="flex items-center space-x-4">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="flex items-center gap-2 text-functional-mid-grey hover:text-maersk-black"
            >
              <ArrowLeft className="h-4 w-4" />
              返回概览
            </Button>
          )}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-functional-bright-blue rounded-lg">
              <Package className="h-6 w-6 text-maersk-blue" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-maersk-black">重量分析</h1>
              <p className="text-sm text-functional-mid-grey">
                {viewSelectedBrand === 'all' ? '品牌总览和对比分析' : `${viewSelectedBrand} 品牌详细分析`}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* 品牌切换选择器 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-functional-mid-grey">品牌视图:</span>
            <Select value={viewSelectedBrand} onValueChange={setViewSelectedBrand}>
              <SelectTrigger className="w-40 h-9 maersk-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    全部品牌总览
                  </div>
                </SelectItem>
                {subBrands.map((brand) => (
                  <SelectItem key={brand.name} value={brand.name}>
                    <div className="flex items-center gap-2">
                      <span>{brand.logo}</span>
                      {brand.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-functional-mid-grey">
            更新时间: {pageStats.lastUpdated}
          </div>
          <Button variant="outline" size="sm" className="flex items-center gap-2 maersk-button-secondary">
            <Download className="h-4 w-4" />
            导出报告
          </Button>
        </div>
      </div>

      {/* 重量分布图表 */}
      <WeightDistributionChart 
        selectedBrand={viewSelectedBrand === 'all' ? undefined : viewSelectedBrand}
        timeRange={selectedTimeRange}
      />

      {/* 品牌视图内容 */}
      {viewSelectedBrand === 'all' ? renderBrandOverview() : renderBrandDetail()}
    </div>
  );
}
//import { useMemo, useState, useEffect } from "react";
import { useMemo, useState } from "react";
// interface WeightDistributionChartProps 已在顶部定义，无需重复
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { WeightRangeData, weightRangeData, provinceWeightDetails } from "../data/mockData";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Package, TrendingDown, AlertCircle, CheckCircle, ArrowRight, Calculator } from "lucide-react";
import { WEIGHT_RANGE_LABELS } from "../constants/weightRanges";

  // ...existing code...

interface OptimizationOpportunity {
  type: string;
  description: string;
  impact: string;
  status: 'high' | 'medium' | 'low';
  dataSource: string;
  actualSaving: number;
  triggerValue: number;
  threshold: number;
  actionItems: string[];
}
/*
export function WeightDistributionChart({
  selectedBrand, 
  dateRange,
  weightType,
  prefetchedData,
  onDetailClick, 
  timeRange, 
  compact = false,
  onRegionTabClick,
  isLoadingRegion = false,
  regionError = null,
  viewMode: externalViewMode  // 🔥 接收父组件传入的viewMode
}: WeightDistributionChartProps) {
  // 🔥 优先使用父组件传入的viewMode，否则使用本地状态
  const [internalViewMode, setInternalViewMode] = useState<'brand' | 'region'>('brand');
  const viewMode = externalViewMode || internalViewMode;
  const setViewMode = (mode: 'brand' | 'region') => {
    setInternalViewMode(mode);
  };

  // 🔥 当viewMode变为region且没有regionAnalysis数据时，自动触发数据获取
  useEffect(() => {
    if (viewMode === 'region' && onRegionTabClick) {
      const hasRegionData = prefetchedData?.regionAnalysis && Array.isArray(prefetchedData.regionAnalysis) && prefetchedData.regionAnalysis.length > 0;
      if (!hasRegionData) {
        console.log('🔍 [WeightDistributionChart] 切换到地区分析，自动获取数据...');
        onRegionTabClick();
      }
    }
  }, [viewMode, prefetchedData]);
*/
// 改为：
export function WeightDistributionChart({
  selectedBrand, 
  dateRange,
  weightType,
  prefetchedData,
  regionData,  // 新增：地区数据
  analysisData,  // 新增：品牌数据
  onDetailClick, 
  timeRange, 
  compact = false,
  onRegionTabClick,
  isLoadingRegion = false,
  regionError = null
}: WeightDistributionChartProps) {
  //const [viewMode, setViewMode] = useState<'brand' | 'region'>('brand');
  const [viewMode, setViewMode] = useState<'brand' | 'region'>('brand');
  const [showAllRegions, setShowAllRegions] = useState(false);
  // 🔥 根据viewMode选择正确的数据源
  const activeData = viewMode === 'region' ? regionData : prefetchedData;
  
  // 🔥 品牌代码到品牌名称的反向映射（用于匹配API返回数据）
  const CUSTOMERNO_TO_BRAND: Record<string, string> = {
    '18405': 'DICKIES',
    '18405-1': 'TNF',
    '18405-2': 'ICEBREAKER',
    '18405-3': 'VANS',
    '18405-4': 'TIMBERLAND',
    '18405-5': 'SMARTWOOL'
  };

  // 🔥 使用真实API数据（如果有）
  const chartData = useMemo(() => {
    console.log("🔍 [WeightDistributionChart] chartData生成中:", {
      hasPrefetchedData: !!prefetchedData,
      hasBrandWeightDistribution: !!prefetchedData?.brandWeightDistribution,
      selectedBrand,
      selectedBrandType: Array.isArray(selectedBrand) ? 'array' : typeof selectedBrand,
      selectedBrandCount: Array.isArray(selectedBrand) ? selectedBrand.length : 1,
      prefetchedDataKeys: prefetchedData ? Object.keys(prefetchedData) : []
    });

    // 如果有prefetchedData，使用真实数据
    if (prefetchedData?.brandWeightDistribution) {
      const brandDistribution = prefetchedData.brandWeightDistribution;
      
      console.log("📊 [WeightDistributionChart] brandDistribution:", {
        brands: Object.keys(brandDistribution),
        brandCount: Object.keys(brandDistribution).length,
        selectedBrand
      });
      
      // 🔥 处理多品牌数组（新增逻辑）
      if (Array.isArray(selectedBrand) && selectedBrand.length > 0) {
        console.log(`🎯 [WeightDistributionChart] 多品牌模式:`, {
          brands: selectedBrand,
          count: selectedBrand.length,
          availableBrands: Object.keys(brandDistribution)
        });
        
        // 汇总多个选中品牌的数据
        const aggregatedMap = new Map<string, { orders: number; weightSum: number; count: number }>();
        
        selectedBrand.forEach((brand) => {
          const brandData = brandDistribution[brand];
          console.log(`🔍 [WeightDistributionChart] 查找品牌 ${brand}:`, {
            exists: !!brandData,
            isArray: Array.isArray(brandData),
            dataLength: Array.isArray(brandData) ? brandData.length : 0,
            data: brandData
          });
          
          if (Array.isArray(brandData)) {
            brandData.forEach((item: any) => {
              const range = item.range;
              const orders = Number(item.orders) || 0;
              const avgWeight = Number(item.avgWeight) || 0;
              
              const existing = aggregatedMap.get(range) || { orders: 0, weightSum: 0, count: 0 };
              aggregatedMap.set(range, {
                orders: existing.orders + orders,
                weightSum: existing.weightSum + (avgWeight * orders),
                count: existing.count + orders,
              });
            });
          } else {
            console.warn(`⚠️ [WeightDistributionChart] 品牌 ${brand} 数据无效或不存在`);
          }
        });
        
        console.log(`📊 [WeightDistributionChart] 汇总Map:`, {
          size: aggregatedMap.size,
          ranges: Array.from(aggregatedMap.keys()),
          data: Array.from(aggregatedMap.entries())
        });
        
        const result = WEIGHT_RANGE_LABELS.map((range) => {
          const found = aggregatedMap.get(range);
          return {
            range,
            orders: found?.orders || 0,
            avgWeight: found && found.count > 0 ? found.weightSum / found.count : 0,
            isLight: range === "0-0.5kg" || range === "0.5-1kg",
          };
        });
        
        console.log(`✅ [WeightDistributionChart] 多品牌汇总完成:`, {
          brands: selectedBrand,
          resultLength: result.length,
          totalOrders: result.reduce((sum, item) => sum + item.orders, 0),
          data: result
        });
        
        return result;
      }
      
      // 🔥 处理单个品牌字符串
      if (selectedBrand && typeof selectedBrand === "string" && selectedBrand !== "all") {
        const brandData = brandDistribution[selectedBrand];
        console.log(`🎯 [WeightDistributionChart] 单品牌数据 ${selectedBrand}:`, {
          exists: !!brandData,
          isArray: Array.isArray(brandData),
          dataLength: Array.isArray(brandData) ? brandData.length : 0,
          data: brandData
        });
        
        if (!brandData || !Array.isArray(brandData)) {
          console.warn(`⚠️ [WeightDistributionChart] 品牌 ${selectedBrand} 数据无效`);
          return [];
        }
        
        // 返回该品牌的重量分布数据，确保所有重量区间都有数据
        const rangeMap = new Map<string, { orders: number; avgWeight: number }>();
        brandData.forEach((item: any) => {
          rangeMap.set(item.range, {
            orders: Number(item.orders) || 0,
            avgWeight: Number(item.avgWeight) || 0,
          });
        });
        
        const result = WEIGHT_RANGE_LABELS.map((range) => {
          const found = rangeMap.get(range);
          return {
            range,
            orders: found?.orders || 0,
            avgWeight: found?.avgWeight || 0,
            isLight: range === "0-0.5kg" || range === "0.5-1kg",
          };
        });
        
        console.log(`✅ [WeightDistributionChart] 品牌 ${selectedBrand} chartData生成完成:`, {
          resultLength: result.length,
          totalOrders: result.reduce((sum, item) => sum + item.orders, 0),
          data: result
        });
        
        return result;
      }
      
      // 🔥 处理"all"或未选择品牌，汇总所有品牌数据
      console.log("📊 [WeightDistributionChart] 汇总所有品牌数据...");
      const aggregatedMap = new Map<string, { orders: number; weightSum: number; count: number }>();
      
      Object.values(brandDistribution).forEach((brandData: any) => {
        if (Array.isArray(brandData)) {
          brandData.forEach((item: any) => {
            const range = item.range;
            const orders = Number(item.orders) || 0;
            const avgWeight = Number(item.avgWeight) || 0;
            
            const existing = aggregatedMap.get(range) || { orders: 0, weightSum: 0, count: 0 };
            aggregatedMap.set(range, {
              orders: existing.orders + orders,
              weightSum: existing.weightSum + (avgWeight * orders),
              count: existing.count + orders,
            });
          });
        }
      });
      
      const result = WEIGHT_RANGE_LABELS.map((range) => {
        const found = aggregatedMap.get(range);
        return {
          range,
          orders: found?.orders || 0,
          avgWeight: found && found.count > 0 ? found.weightSum / found.count : 0,
          isLight: range === "0-0.5kg" || range === "0.5-1kg",
        };
      });
      
      console.log("✅ [WeightDistributionChart] 所有品牌汇总完成:", {
        resultLength: result.length,
        totalOrders: result.reduce((sum, item) => sum + item.orders, 0),
        data: result
      });
      
      return result;
    }
    
    console.log("⚠️ [WeightDistributionChart] 使用Fallback mock数据");
    
    // Fallback：使用mock数据
    const filteredData = weightRangeData.map(range => {
      if (!selectedBrand) return range;
      
      const brandData = range.brandData.find(b => b.brand === selectedBrand);
      if (!brandData) return { ...range, totalOrders: 0, brandData: [] };
      
      return {
        ...range,
        totalOrders: brandData.orders,
        brandData: [brandData]
      };
    });
    
    return filteredData.map(range => ({
      range: range.range,
      orders: range.totalOrders,
      avgWeight: range.avgCost || 0,
      isLight: range.range === '0-1kg' || range.range === '1-3kg'
    }));
  }, [prefetchedData, selectedBrand]);

  // 🔥 计算关键指标（基于真实数据）
  const totalOrders = chartData.reduce((sum, item) => sum + item.orders, 0);
  const lightWeightOrders = chartData
    .filter(item => item.isLight)
    .reduce((sum, item) => sum + item.orders, 0);
  const lightWeightRatio = totalOrders > 0 ? (lightWeightOrders / totalOrders) * 100 : 0;
  
  const ultraLightOrders = chartData.find(item => item.range === "0-0.5kg")?.orders || 0;
  const ultraLightRatio = totalOrders > 0 ? (ultraLightOrders / totalOrders) * 100 : 0;
  
  const avgLightCost = lightWeightOrders > 0 
    ? chartData.filter(item => item.isLight).reduce((sum, item) => sum + (item.avgWeight * item.orders), 0) / lightWeightOrders 
    : 0;
  
  const totalShippingCost = chartData.reduce((sum, item) => sum + (item.avgWeight * item.orders), 0);

  // 🔥 修正快递公司成本分析（如果有真实快递商数据）
  const courierCostAnalysis = () => {
    if (prefetchedData?.brandCourierWeightDistribution && selectedBrand && selectedBrand !== "all") {
      const brandCourier = prefetchedData.brandCourierWeightDistribution[selectedBrand];
      if (brandCourier && typeof brandCourier === "object") {
        const courierAvgCosts: Record<string, number> = {};
        
        Object.entries(brandCourier).forEach(([courierName, courierRows]: [string, any]) => {
          if (Array.isArray(courierRows)) {
            const totalOrders = courierRows.reduce((sum, row) => sum + Number(row.orders || 0), 0);
            const totalWeightedCost = courierRows.reduce(
              (sum, row) => sum + Number(row.avgWeight || 0) * Number(row.orders || 0),
              0
            );
            courierAvgCosts[courierName] = totalOrders > 0 ? totalWeightedCost / totalOrders : 0;
          }
        });
        
        const ztoAvg = courierAvgCosts["ZTO"] || courierAvgCosts["中通"] || 0;
        const sfAvg = courierAvgCosts["SF"] || courierAvgCosts["顺丰"] || 0;
        const costDifference = sfAvg > 0 ? ((sfAvg - ztoAvg) / sfAvg) * 100 : 0;
        
        return { ztoAvg, sfAvg, costDifference };
      }
    }
    
    // Fallback
    const ztoCosts: number[] = [];
    const sfCosts: number[] = [];
    
    weightRangeData.forEach(range => {
      range.brandData.forEach(brand => {
        brand.courierData.forEach(courier => {
          if (courier.courier === '中通') {
            ztoCosts.push(courier.avgShippingCost);
          } else if (courier.courier === '顺丰') {
            sfCosts.push(courier.avgShippingCost);
          }
        });
      });
    });
    
    const ztoAvg = ztoCosts.length > 0 ? ztoCosts.reduce((a, b) => a + b, 0) / ztoCosts.length : 0;
    const sfAvg = sfCosts.length > 0 ? sfCosts.reduce((a, b) => a + b, 0) / sfCosts.length : 0;
    const costDifference = sfAvg > 0 ? ((sfAvg - ztoAvg) / sfAvg) * 100 : 0;
    
    return { ztoAvg, sfAvg, costDifference };
  };

  const courierAnalysis = courierCostAnalysis();

  // 数据驱动的优化机会识别
  const generateOptimizationOpportunities = (): OptimizationOpportunity[] => {
    const opportunities: OptimizationOpportunity[] = [];

    // 1. 包装优化机会 - 基于轻量包裹占比
    if (lightWeightRatio > 50) {
      const packagingOptimization: OptimizationOpportunity = {
        type: "包装轻量化",
        description: `轻量包裹占比${lightWeightRatio.toFixed(1)}%，通过减少包装材料可显著降低重量`,
        impact: `预计节省¥${Math.round(lightWeightOrders * avgLightCost * 0.15).toLocaleString()}`,
        status: lightWeightRatio > 70 ? 'high' : lightWeightRatio > 60 ? 'medium' : 'low',
        dataSource: `基于${lightWeightOrders.toLocaleString()}单轻量包裹数据`,
        actualSaving: lightWeightOrders * avgLightCost * 0.15,
        triggerValue: lightWeightRatio,
        threshold: 50,
        actionItems: [
          "采用更薄的包装材料",
          "优化包装尺寸设计",
          "使用气泡膜替代厚重填充物",
          "实施包装标准化"
        ]
      };
      opportunities.push(packagingOptimization);
    }

    // 2. 费率谈判机会 - 基于超轻量包裹占比
    if (ultraLightRatio > 30) {
      const ultraLightWeight = chartData.find(r => r.range === '0-0.5kg')?.avgWeight || 0;
      const rateNegotiation: OptimizationOpportunity = {
        type: "费率重新谈判",
        description: `0-1kg包裹占比${ultraLightRatio.toFixed(1)}%，具备批量谈判优势`,
        impact: `预计节省¥${Math.round(ultraLightOrders * ultraLightWeight * 0.12).toLocaleString()}`,
        status: ultraLightRatio > 40 ? 'high' : ultraLightRatio > 35 ? 'medium' : 'low',
        dataSource: `基于${ultraLightOrders.toLocaleString()}单超轻量包裹数据`,
        actualSaving: ultraLightOrders * ultraLightWeight * 0.12,
        triggerValue: ultraLightRatio,
        threshold: 30,
        actionItems: [
          "与快递公司重新谈判0-1kg费率",
          "争取首重500g以下特殊价格",
          "建立长期合作的阶梯定价",
          "考虑多家快递公司竞标"
        ]
      };
      opportunities.push(rateNegotiation);
    }

    // 3. 快递公司优化 - 基于成本差异
    if (courierAnalysis.costDifference > 20) {
      const courierOptimization: OptimizationOpportunity = {
        type: "快递服务商调整",
        description: `中通与顺丰平均成本差异${courierAnalysis.costDifference.toFixed(1)}%，存在结构调整空间`,
        impact: `预计节省¥${Math.round(totalShippingCost * 0.08).toLocaleString()}`,
        status: courierAnalysis.costDifference > 30 ? 'high' : 'medium',
        dataSource: `基于中通¥${courierAnalysis.ztoAvg.toFixed(2)} vs 顺丰¥${courierAnalysis.sfAvg.toFixed(2)}成本对比`,
        actualSaving: totalShippingCost * 0.08,
        triggerValue: courierAnalysis.costDifference,
        threshold: 20,
        actionItems: [
          "增加中通轻量包裹占比",
          "将顺丰用于时效要求高的订单",
          "建立智能路由分配规则",
          "定期评估快递公司性价比"
        ]
      };
      opportunities.push(courierOptimization);
    }

    // 4. 区域路线优化 - 基于地区集中度
    const topRegions = provinceWeightDetails.slice(0, 3);
    const topRegionOrders = topRegions.reduce((sum, region) => 
      sum + region.weightRanges.reduce((s, w) => s + w.totalOrders, 0), 0
    );
    const regionConcentration = totalOrders > 0 ? (topRegionOrders / totalOrders) * 100 : 0;

    if (regionConcentration > 60 && totalOrders > 0) {
      const routeOptimization: OptimizationOpportunity = {
        type: "区域路线优化",
        description: `前3个省份订单占比${regionConcentration.toFixed(1)}%，可实施区域化运营`,
        impact: `预计节省¥${Math.round(topRegionOrders * avgLightCost * 0.10).toLocaleString()}`,
        status: regionConcentration > 70 ? 'high' : 'medium',
        dataSource: `基于${topRegionOrders.toLocaleString()}单集中订单数据`,
        actualSaving: topRegionOrders * avgLightCost * 0.10,
        triggerValue: regionConcentration,
        threshold: 60,
        actionItems: [
          "在主要省份建立前置仓",
          "实施区域专线运输",
          "优化最后一公里配送",
          "建立区域合作伙伴网络"
        ]
      };
      opportunities.push(routeOptimization);
    }

    // 5. 包装尺寸优化 - 基于重量分布
    const heavyOrders = chartData
      .filter(item => item.range === '>3kg')
      .reduce((sum, item) => sum + item.orders, 0);
    const heavyPackageRatio = totalOrders > 0 ? (heavyOrders / totalOrders) * 100 : 0;

    if (heavyPackageRatio > 25) {
      const sizeOptimization: OptimizationOpportunity = {
        type: "包装尺寸优化",
        description: `重包裹占比${heavyPackageRatio.toFixed(1)}%，可通过尺寸优化降低体积重`,
        impact: `预计节省¥${Math.round(totalShippingCost * 0.06).toLocaleString()}`,
        status: heavyPackageRatio > 35 ? 'high' : 'medium',
        dataSource: `基于重包裹占比分析`,
        actualSaving: totalShippingCost * 0.06,
        triggerValue: heavyPackageRatio,
        threshold: 25,
        actionItems: [
          "设计紧凑型包装方案",
          "使用可压缩包装材料",
          "优化商品组合包装",
          "实施体积重计费策略"
        ]
      };
      opportunities.push(sizeOptimization);
    }

    return opportunities.sort((a, b) => b.actualSaving - a.actualSaving);
  };

  const optimizationOpportunities = generateOptimizationOpportunities();

  // 地区分析数据：直接用外部传入的 prefetchedData.regionAnalysis
  // 地区分析数据：根据viewMode使用对应的数据源
const regionAnalysis = useMemo(() => {
  const dataSource = activeData || prefetchedData;
  console.log('🔍 [WeightDistributionChart] regionAnalysis数据源:', {
    viewMode,
    hasActiveData: !!activeData,
    hasPrefetchedData: !!prefetchedData,
    activeDataKeys: activeData ? Object.keys(activeData) : [],
    prefetchedDataKeys: prefetchedData ? Object.keys(prefetchedData) : []
  });
    if (dataSource?.regionAnalysis && Array.isArray(dataSource.regionAnalysis)) {
    console.log('✅ [WeightDistributionChart] 使用API返回的地区数据，条目数:', dataSource.regionAnalysis.length);
    console.log('📊 示例数据:', JSON.stringify(dataSource.regionAnalysis[0], null, 2));
    
    return dataSource.regionAnalysis.map(region => {
      const totalOrders = region.totalOrders || 0;
      const lightOrders = region.lightOrders || 0;
      const lightRatio = region.lightRatio || 0;
      
      let totalCost = 0;
      Object.values(region.carriers || {}).forEach(info => {
        totalCost += (info.avgFee || 8) * info.orderCount;
      });
      const avgCost = lightOrders > 0 ? totalCost / lightOrders : 0;
      const optimizationPotential = lightOrders * 8 * 0.1;
      
      return {
        province: region.province,
        lightRatio,
        lightOrders,
        avgCost,
        totalOrders,
        optimizationPotential
      };
    });
  }
    // fallback: 兼容老mock数据
    return provinceWeightDetails.slice(0, 3).map(province => {
      const lightWeightRange = province.weightRanges.filter(w => w.range === '0-1kg' || w.range === '1-3kg');
      const totalRegionOrders = province.weightRanges.reduce((sum, w) => sum + w.totalOrders, 0);
      const lightOrders = lightWeightRange.reduce((sum, w) => sum + w.totalOrders, 0);
      const lightRatio = (lightOrders / totalRegionOrders) * 100;
      return {
        province: province.province,
        lightRatio: lightRatio,
        lightOrders: lightOrders,
        avgCost: lightWeightRange.reduce((sum, w) => sum + (w.avgCost * w.totalOrders), 0) / lightOrders,
        totalOrders: totalRegionOrders
      };
    });
  }, [activeData, prefetchedData]);

  function getBarColor(isLight: boolean, range: string) {
    if (isLight) {
      return range === '0-1kg' ? '#10b981' : '#059669';
    }
    return '#6b7280';
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = totalOrders > 0 ? ((data.orders / totalOrders) * 100).toFixed(1) : '0.0';
      return (
        <div className="bg-white p-4 border rounded-lg shadow-lg border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-sm text-blue-600">订单数: {data.orders.toLocaleString()} 单</p>
            <p className="text-sm text-green-600">占比: {percentage}%</p>
            <p className="text-sm text-orange-600">平均重量: {data.avgWeight.toFixed(2)}kg</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="maersk-card shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-gray-900">包裹重量分布分析</CardTitle>
              <p className="text-sm text-gray-500 mt-1">基于数据识别轻量包裹占比，发现成本优化机会</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'brand' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('brand')}
            >
              品牌分析
            </Button>
            <Button
              variant={viewMode === 'region' ? 'default' : 'outline'}
              size="sm"

              
              onClick={() => {
                setViewMode('region');
                if (onRegionTabClick) onRegionTabClick();
              }}
            >
              地区分析
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 核心指标 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">轻量包裹占比</p>
                  <p className="text-2xl font-bold text-green-900">{lightWeightRatio.toFixed(1)}%</p>
                  <p className="text-xs text-green-700 mt-1">0-1kg包裹</p>
                </div>
                <TrendingDown className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">轻量包裹数量</p>
                  <p className="text-2xl font-bold text-blue-900">{lightWeightOrders.toLocaleString()}</p>
                  <p className="text-xs text-blue-700 mt-1">单位：单</p>
                </div>
                <Package className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">优化机会</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {optimizationOpportunities.filter(o => o.status === 'high').length}
                  </p>
                  <p className="text-xs text-orange-700 mt-1">高优先级</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">潜在节省</p>
                  <p className="text-2xl font-bold text-purple-900">
                    ¥{Math.round(optimizationOpportunities.reduce((sum, o) => sum + o.actualSaving, 0) / 10000).toLocaleString()}万
                  </p>
                  <p className="text-xs text-purple-700 mt-1">年化预估</p>
                </div>
                <Calculator className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>

          {viewMode === 'brand' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 重量分布柱状图 */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  重量区间分布
                  {selectedBrand && selectedBrand !== 'all' && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                      {Array.isArray(selectedBrand) 
                        ? selectedBrand.join(', ') 
                        : selectedBrand}
                    </Badge>
                  )}
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <XAxis 
                        dataKey="range" 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#e5e7eb' }}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="orders" 
                        radius={[4, 4, 0, 0]}
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`weight-cell-${entry.range}-${index}`} 
                            fill={getBarColor(entry.isLight, entry.range)} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span className="text-gray-600">轻量包裹 (0-1kg)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-400 rounded"></div>
                    <span className="text-gray-600">重量包裹 (1kg+)</span>
                  </div>
                </div>
              </div>

              {/* 数据驱动的优化建议 */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  数据驱动优化机会
                </h4>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {optimizationOpportunities.map((opportunity, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg border-l-4 ${
                        opportunity.status === 'high' 
                          ? 'bg-red-50 border-red-400' 
                          : opportunity.status === 'medium'
                          ? 'bg-yellow-50 border-yellow-400'
                          : 'bg-green-50 border-green-400'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{opportunity.type}</span>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                opportunity.status === 'high' 
                                  ? 'border-red-300 text-red-700 bg-red-100'
                                  : opportunity.status === 'medium'
                                  ? 'border-yellow-300 text-yellow-700 bg-yellow-100'
                                  : 'border-green-300 text-green-700 bg-green-100'
                              }`}
                            >
                              {opportunity.status === 'high' ? '高优先级' : opportunity.status === 'medium' ? '中优先级' : '低优先级'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">{opportunity.description}</p>
                          <p className="text-sm font-medium text-green-600 mb-1">{opportunity.impact}</p>
                          <p className="text-xs text-gray-500">{opportunity.dataSource}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-gray-400 mt-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-600" />
                重点地区轻量包裹分析
              </h4>
              {isLoadingRegion ? (
                <div className="text-center text-blue-600 py-8">地区分析数据加载中...</div>
              ) : regionError ? (
                <div className="text-center text-red-600 py-8">{regionError}</div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {(showAllRegions ? regionAnalysis : regionAnalysis.slice(0, 3)).map((region, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="text-center">
                            <h5 className="font-semibold text-gray-900 mb-2">{region.province}</h5>
                            <div className="text-3xl font-bold text-blue-600 mb-1">{region.lightRatio.toFixed(1)}%</div>
                            <p className="text-sm text-gray-600 mb-3">轻量包裹占比</p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">轻量包裹:</span>
                                <span className="font-medium">{region.lightOrders.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">平均运费:</span>
                                <span className="font-medium text-green-600">¥{region.avgCost.toFixed(1)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">优化潜力:</span>
                                <span className="font-medium text-purple-600">
                                  ¥{Math.round(region.lightOrders * region.avgCost * 0.15 / 10000)}万
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {regionAnalysis.length > 3 && (
                      <div className="text-center">
                        <Button
                          variant="outline"
                          onClick={() => setShowAllRegions(!showAllRegions)}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          {showAllRegions ? '收起更多 ↑' : `查看全部 ${regionAnalysis.length} 个地区 ↓`}
                        </Button>
                      </div>
                    )}
                  </div>

                                    {/* 基于地区数据的优化建议 */}
                  <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h5 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5" />
                      基于数据的地区优化建议
                    </h5>
                    <div className="text-sm text-blue-800 space-y-1">
                      {(showAllRegions ? regionAnalysis : regionAnalysis.slice(0, 3)).map((region, index) => (
                        <p key={index}>
                          • <strong>{region.province}</strong>: 
                          {region.lightRatio > 60 ? '轻量包裹占比极高，建议优先实施包装优化' : ''}
                          {region.lightRatio > 50 && region.lightRatio <= 60 ? '具备费率谈判优势，建议启动批量协商' : ''}
                          {region.lightRatio <= 50 ? '可作为重包裹专线优化试点' : ''}
                          (占比{region.lightRatio.toFixed(1)}%，潜在节省¥{Math.round(region.lightOrders * region.avgCost * 0.15 / 10000)}万)
                        </p>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
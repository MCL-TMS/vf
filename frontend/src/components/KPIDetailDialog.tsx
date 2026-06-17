import React, { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Package, TrendingUp, TrendingDown, X, Maximize2, Minimize2 } from "lucide-react";
import { OrderKPIData } from "../data/orderData";
import { platformsData } from "../data/platformData";
import { CrossAnalysisChart } from "./CrossAnalysisChart";

interface KPIDetailDialogProps {
  selectedKPI: OrderKPIData | null;
  activeKPITab: string;
  setActiveKPITab: (tab: string) => void;
  onClose: () => void;
  selectedBrand: string;
  platformKPIData: any[];
  brandKPIData: any[];
  filteredData: any;
  rawApiData?: any;
  usingApiData?: boolean;
}

export const KPIDetailDialog: React.FC<KPIDetailDialogProps> = ({
  selectedKPI,
  activeKPITab,
  setActiveKPITab,
  onClose,
  selectedBrand,
  platformKPIData,
  brandKPIData,
  filteredData,
  rawApiData,
  usingApiData = false
}) => {

  // 安全检查：确保所有必要的数据都存在
  if (!selectedKPI) return null;
  
  // 为防止运行时错误，提供默认的filteredData结构
  const safeFilteredData = filteredData || {
    brandStats: {
      totalOrders: 0,
      marketShare: 100,
      growth: 0
    }
  };

  // 🔥 数据一致性验证：平台分析 vs 交叉分析
  useEffect(() => {
    if (usingApiData && rawApiData?.data && selectedKPI) {
      const { platformDistribution, crossAnalysisData } = rawApiData.data;
      
      if (!platformDistribution || !crossAnalysisData) {
        console.warn('⚠️ [数据一致性验证] 缺少必要数据:', {
          hasPlatformDistribution: !!platformDistribution,
          hasCrossAnalysisData: !!crossAnalysisData
        });
        return;
      }
      
      console.log('🔍 [数据一致性验证] 开始验证平台分析与交叉分析数据一致性');
      
      // 🔥 添加调试：查看原始数据结构
      console.log('📊 [调试] platformDistribution原始数据:', platformDistribution);
      console.log('📊 [调试] crossAnalysisData原始数据:', crossAnalysisData);
      console.log('📊 [调试] 当前KPI:', selectedKPI.label);
      
      // 🔥 移除平台显示名称到代码的映射 - 直接使用后端返回的 platformCode
      // 后端已经返回了 platformCode（如 tmall）和 platformClass（如 天猫）两个字段
      
      // 获取KPI字段名
      const getKPIFieldName = (kpiLabel: string): string => {
        switch (kpiLabel) {
          case '已揽收': return 'pickedOrders';
          case '已发运': return 'shippedOrders';
          case '已签收': return 'deliveredOrders';
          case '已转寄': return 'forwardedOrders';
          case '已退回': return 'returnedOrders';
          case '已取消': return 'cancelledOrders';
          case '总单量': return 'totalOrders';
          default: return 'totalOrders';
        }
      };
      
      // 🔥 新增：platformDistribution字段名映射（后端返回xxxCount，前端期望xxxOrders）
      const getPlatformDistributionFieldName = (kpiLabel: string): string => {
        switch (kpiLabel) {
          case '已揽收': return 'pickedCount';
          case '已发运': return 'shippedCount';
          case '已签收': return 'deliveredCount';
          case '已转寄': return 'forwardedCount';
          case '已退回': return 'returnedCount';
          case '已取消': return 'cancelledCount';
          case '总单量': return 'orderCount';
          default: return 'orderCount';
        }
      };
      
      const kpiFieldName = getKPIFieldName(selectedKPI.label);
      const platformFieldName = getPlatformDistributionFieldName(selectedKPI.label);
      console.log('📊 [调试] KPI字段名:', {
        crossAnalysisData字段名: kpiFieldName,
        platformDistribution字段名: platformFieldName
      });
      
      let totalDiff = 0;
      let platformsChecked = 0;
      const inconsistencies: any[] = [];
      
      platformDistribution.forEach((platform: any) => {
        // 🔥 添加调试：查看每个平台的原始数据
        console.log(`📊 [调试] 平台"${platform.platformClass}"原始数据:`, platform);
        
        // 从交叉数据计算该平台总计
        const platformCode = platform.platformCode;
        const crossTotal = crossAnalysisData
          .filter((item: any) => item.platformCode === platformCode)
          .reduce((sum: number, item: any) => sum + (item[kpiFieldName] || 0), 0);
        
        const platformTotal = platform[platformFieldName] || 0;
        
        // 🔥 添加调试：查看提取的值
        console.log(`📊 [调试] 平台"${platform.platformClass}"数据对比:`, {
          platformCode,
          kpiFieldName,
          platformTotal,
          crossTotal,
          platform对象中的所有KPI字段: Object.keys(platform).filter(k => k.includes('Order') || k.includes('Count'))
        });
        
        // 计算差异
        const diff = Math.abs(crossTotal - platformTotal);
        const diffPercent = platformTotal > 0 ? (diff / platformTotal) * 100 : (crossTotal > 0 ? 100 : 0);
        
        platformsChecked++;
        totalDiff += diff;
        
        // 允许1%的误差（可能是四舍五入导致）
        if (diffPercent > 1) {
          inconsistencies.push({
            platform: platform.platformClass,
            platformCode,
            kpi: selectedKPI.label,
            platformDistribution: platformTotal,
            crossAnalysisAggregated: crossTotal,
            diff,
            diffPercent: diffPercent.toFixed(2)
          });
          
          console.warn(`⚠️ [数据不一致] 平台"${platform.platformClass}"的"${selectedKPI.label}"数据不一致:`, {
            platformDistribution总计: platformTotal,
            crossAnalysisData聚合总计: crossTotal,
            差异: diff,
            差异百分比: `${diffPercent.toFixed(2)}%`
          });
        }
      });
      
      // 总结验证结果
      if (inconsistencies.length > 0) {
        console.error(`❌ [数据一致性验证] 发现${inconsistencies.length}/${platformsChecked}个平台数据不一致`, {
          KPI: selectedKPI.label,
          不一致列表: inconsistencies,
          总差异: totalDiff
        });
      } else {
        console.log(`✅ [数据一致性验证] 所有${platformsChecked}个平台数据一致`, {
          KPI: selectedKPI.label,
          验证平台数: platformsChecked
        });
      }
    }
  }, [usingApiData, rawApiData, selectedKPI]);

  // 从API数据中获取当前KPI值
  const getKPIValueFromAPI = (kpiLabel: string | undefined): number | null => {
    if (!usingApiData || !rawApiData?.data?.kpi) return null;
    
    const kpi = rawApiData.data.kpi;
    switch (kpiLabel) {
      case '已揽收': return kpi.pickedOrders;
      case '已发运': return kpi.shippedOrders;
      case '已签收': return kpi.deliveredOrders;
      case '已转寄': return kpi.forwardedOrders;
      case '已退回': return kpi.returnedOrders;
      case '已取消': return kpi.cancelledOrders;
      case '首派成功率': return kpi.firstDispatchSuccessRate;
      case '平均首派时长': return kpi.avgFirstDispatchHours;
      case '平均签收时长': return kpi.avgDeliveryHours;
      case '总单量': return kpi.totalOrders;
      default: return null;
    }
  };

  // 从历史数据中获取KPI值 - 改进算法，支持总单量和效率指标
  const getKPIValueFromHistoricalAPI = (kpiLabel: string | undefined, period: 'lastMonth' | 'lastYear'): number | null => {
    if (!usingApiData || !rawApiData?.data?.historicalData?.[period]) return null;
    
    const historicalData = rawApiData.data.historicalData[period];
    
    // 对于总单量
    if (kpiLabel === '总单量') {
      return historicalData.totalOrders;
    }
    
    // 对于效率指标，从历史数据的performanceMetrics中获取
    if (historicalData.performanceMetrics) {
      switch (kpiLabel) {
        case '首派成功率':
          return historicalData.performanceMetrics.firstDispatchSuccessRate || null;
        case '平均首派时长':
          return historicalData.performanceMetrics.avgFirstDispatchHours || null;
        case '平均签收时长':
          return historicalData.performanceMetrics.avgDeliveryHours || null;
      }
    }
    
    // 对于状态分布数据
    const statusDistribution = historicalData.statusDistribution;
    if (!statusDistribution) return null;
    
    switch (kpiLabel) {
      case '已揽收': 
        return statusDistribution.find(s => s.statusCode === 55)?.orderCount || null;
      case '已发运': 
        return statusDistribution.find(s => s.statusCode === 70)?.orderCount || null;
      case '已签收': 
        return statusDistribution.find(s => s.statusCode === 95)?.orderCount || null;
      case '已转寄': 
        return statusDistribution.find(s => s.statusCode === 40)?.orderCount || null;
      case '已退回': 
        // 聚合100和105状态码
        const returnedCount = (statusDistribution.find(s => s.statusCode === 100)?.orderCount || 0) +
                             (statusDistribution.find(s => s.statusCode === 105)?.orderCount || 0);
        return returnedCount > 0 ? returnedCount : null;
      case '已取消': 
        // 聚合90和110状态码
        const cancelledCount = (statusDistribution.find(s => s.statusCode === 90)?.orderCount || 0) +
                              (statusDistribution.find(s => s.statusCode === 110)?.orderCount || 0);
        return cancelledCount > 0 ? cancelledCount : null;
      default: return null;
    }
  };

  // 计算增长率的辅助函数
  const calculateGrowthRate = (current: number, previous: number): number | null => {
    if (!previous || previous === 0) return null;
    return Math.round(((current - previous) / previous * 100) * 100) / 100;
  };

  // 判断指标是否需要显示同比环比数据
  const shouldShowGrowthData = (kpiLabel: string): boolean => {
    // 只有已揽收、已发运、已签收不显示同比环比，其他指标包括首派成功率、平均首派时长、平均签收时长都显示
    const noGrowthIndicators = ['已揽收', '已发运', '已签收'];
    return !noGrowthIndicators.includes(kpiLabel);
  };

  // 获取品牌的KPI数据并计算同比环比
  const getBrandKPIWithGrowth = (brandName: string, kpiLabel: string) => {
    if (!rawApiData?.data?.brandDistribution) {
      return { value: 0, unit: '', growthData: { mom: null, yoy: null } };
    }

    const apiBrand = rawApiData.data.brandDistribution.find(b => b.brandName === brandName);
    if (!apiBrand) {
      return { value: 0, unit: '', growthData: { mom: null, yoy: null } };
    }

    let currentValue = 0;
    let unit = '';
    
    // 🔥 关键修复：优先使用brandKPIData中聚合好的效率指标
    const brandKPI = brandKPIData.find(b => b.brand === brandName);
    
    // 现在使用真实的API数据，而不是估算
    switch (kpiLabel) {
      case '已揽收':
        currentValue = apiBrand.pickedCount || 0;
        unit = '';
        break;
      case '已发运':
        currentValue = apiBrand.shippedCount || 0;
        unit = '';
        break;
      case '已签收':
        currentValue = apiBrand.deliveredCount || 0;
        unit = '';
        break;
      case '已转寄':
        currentValue = apiBrand.forwardedCount || 0;
        unit = '';
        break;
      case '已退回':
        currentValue = apiBrand.returnedCount || 0;
        unit = '';
        break;
      case '已取消':
        currentValue = apiBrand.cancelledCount || 0;
        unit = '';
        break;
      case '首派成功率':
        // 🔥 修复：使用brandKPIData中聚合的真实数据
        currentValue = brandKPI?.firstDispatchSuccessRate || 0;
        unit = '%';
        break;
      case '平均首派时长':
        // 🔥 修复：使用brandKPIData中聚合的真实数据
        currentValue = brandKPI?.avgFirstDispatchHours || 0;
        unit = '小时';
        break;
      case '平均签收时长':
        // 🔥 修复：使用brandKPIData中聚合的真实数据
        // 🔥 转换为天：SUM_SEND_TIME2字段单位是小时，需要除以24转换为天
        currentValue = (brandKPI?.avgDeliveryHours || 0) / 24;
        unit = '天';
        break;
      default:
        currentValue = apiBrand.orderCount;
        unit = '';
        break;
    }

    // 🔥 全新逻辑：使用后端返回的品牌维度历史数据（真实值）
    let momGrowth = null;
    let yoyGrowth = null;
    
    // 只为需要显示同比环比的指标计算增长率
    if (apiBrand.historicalData && shouldShowGrowthData(kpiLabel)) {
      const historicalData = apiBrand.historicalData;
      
      // 根据KPI类型获取历史值
      let lastMonthValue = null;
      let lastYearValue = null;
      
      switch (kpiLabel) {
        case '已转寄':
          lastMonthValue = historicalData.lastMonth?.forwardedOrders;
          lastYearValue = historicalData.lastYear?.forwardedOrders;
          break;
        case '已退回':
          lastMonthValue = historicalData.lastMonth?.returnedOrders;
          lastYearValue = historicalData.lastYear?.returnedOrders;
          break;
        case '已取消':
          lastMonthValue = historicalData.lastMonth?.cancelledOrders;
          lastYearValue = historicalData.lastYear?.cancelledOrders;
          break;
        case '首派成功率':
          lastMonthValue = historicalData.lastMonth?.performanceMetrics?.firstDispatchSuccessRate;
          lastYearValue = historicalData.lastYear?.performanceMetrics?.firstDispatchSuccessRate;
          break;
        case '平均首派时长':
          lastMonthValue = historicalData.lastMonth?.performanceMetrics?.avgFirstDispatchHours;
          lastYearValue = historicalData.lastYear?.performanceMetrics?.avgFirstDispatchHours;
          break;
        case '平均签收时长':
          lastMonthValue = historicalData.lastMonth?.performanceMetrics?.avgDeliveryHours;
          lastYearValue = historicalData.lastYear?.performanceMetrics?.avgDeliveryHours;
          break;
        case '总单量':
          lastMonthValue = historicalData.lastMonth?.totalOrders;
          lastYearValue = historicalData.lastYear?.totalOrders;
          break;
      }
      
      // 计算环比
      if (lastMonthValue !== null && lastMonthValue !== undefined && lastMonthValue > 0) {
        momGrowth = calculateGrowthRate(currentValue, lastMonthValue);
      }
      
      // 计算同比
      if (lastYearValue !== null && lastYearValue !== undefined && lastYearValue > 0) {
        yoyGrowth = calculateGrowthRate(currentValue, lastYearValue);
      }
      
      // 🔍 调试日志
      console.log(`📊 [品牌同比环比] ${brandName} - ${kpiLabel}:`, {
        当前值: currentValue,
        上月值: lastMonthValue,
        去年值: lastYearValue,
        环比: momGrowth ? `${momGrowth.toFixed(1)}%` : 'null',
        同比: yoyGrowth ? `${yoyGrowth.toFixed(1)}%` : 'null'
      });
    }

    return {
      value: currentValue,
      unit,
      growthData: { mom: momGrowth, yoy: yoyGrowth }
    };
  };

  // 获取平台的KPI数据并计算同比环比
  const getPlatformKPIWithGrowth = (platformName: string, kpiLabel: string) => {
    // 先从平台数据中找到对应平台
    const platform = platformKPIData.find(p => p.platform === platformName);
    if (!platform || !platform.kpiData) {
      return { value: 0, unit: '', percentage: 0, growthData: { mom: null, yoy: null } };
    }

    // 映射KPI标签到kpiData字段
    const kpiKey = kpiLabel === '已揽收' ? 'picked' : 
                   kpiLabel === '已发运' ? 'shipped' :
                   kpiLabel === '已签收' ? 'delivered' :
                   kpiLabel === '已转寄' ? 'forwarded' :
                   kpiLabel === '已退回' ? 'returned' :
                   kpiLabel === '已取消' ? 'cancelled' : 
                   kpiLabel === '首派成功率' ? 'firstDispatchSuccessRate' :
                   kpiLabel === '平均首派时长' ? 'avgFirstDispatchHours' :
                   kpiLabel === '平均签收时长' ? 'avgDeliveryHours' : 'delivered';

    const kpiValue = platform.kpiData[kpiKey];
    if (!kpiValue) {
      return { value: 0, unit: '', percentage: 0, growthData: { mom: null, yoy: null } };
    }

    // 计算单位和值
    let currentValue = parseInt(kpiValue.value?.toString().replace(/,/g, '')) || 0;
    let unit = kpiLabel === '首派成功率' ? '%' :
               kpiLabel === '平均首派时长' ? '小时' :
               kpiLabel === '平均签收时长' ? '天' : '';  // 🔥 修复：平均签收时长单位改为"天"
    
    // 🔥 对于平均签收时长，需要转换为天（除以24）
    if (kpiLabel === '平均签收时长') {
      currentValue = currentValue / 24;
    }

    // 计算市场份额（占比）
    const totalKPIValue = getKPIValueFromAPI(kpiLabel) || 1;
    const percentage = totalKPIValue > 0 ? (currentValue / totalKPIValue * 100) : 0;

    // 计算同比环比（只为支持的指标计算）
    let momGrowth = null;
    let yoyGrowth = null;

    if (shouldShowGrowthData(kpiLabel) && usingApiData && rawApiData?.data?.historicalData) {
      // 对于效率指标，直接使用API历史数据，不需要按平台占比估算
      if (['首派成功率', '平均首派时长', '平均签收时长'].includes(kpiLabel)) {
        // 上月数据
        const lastMonthValue = getKPIValueFromHistoricalAPI(kpiLabel, 'lastMonth');
        if (lastMonthValue && lastMonthValue > 0) {
          momGrowth = calculateGrowthRate(currentValue, lastMonthValue);
        }

        // 去年同期数据
        const lastYearValue = getKPIValueFromHistoricalAPI(kpiLabel, 'lastYear');
        if (lastYearValue && lastYearValue > 0) {
          yoyGrowth = calculateGrowthRate(currentValue, lastYearValue);
        }
      } else {
        // 基于平台在总体中的占比估算历史数据（用于订单量类指标）
        const platformShare = percentage / 100;
        
        // 上月数据
        const lastMonthTotal = getKPIValueFromHistoricalAPI(kpiLabel, 'lastMonth');
        if (lastMonthTotal && lastMonthTotal > 0) {
          const lastMonthValue = lastMonthTotal * platformShare * 0.95; // 适当调整系数
          if (lastMonthValue > 0) {
            momGrowth = calculateGrowthRate(currentValue, lastMonthValue);
          }
        }

        // 去年同期数据
        const lastYearTotal = getKPIValueFromHistoricalAPI(kpiLabel, 'lastYear');
        if (lastYearTotal && lastYearTotal > 0) {
          const lastYearValue = lastYearTotal * platformShare * 0.85; // 适当调整系数
          if (lastYearValue > 0) {
            yoyGrowth = calculateGrowthRate(currentValue, lastYearValue);
          }
        }
      }
    }

    return {
      value: currentValue,
      unit,
      percentage,
      growthData: { mom: momGrowth, yoy: yoyGrowth }
    };
  };

  const getBrandIcon = (brandName: string) => {
    const brandIcons = {
      'TNF': '🏔️',
      'DICKIES': '👔',
      'VANS': '👟',
      'TIMBERLAND': '🥾',
      'ICEBREAKER': '🧊',
      'KIPLING': '🎒'
    };
    return brandIcons[brandName] || '🏷️';
  };

  const getPlatformIcon = (platformName: string) => {
    const platformIcons = {
      'tmall': '🛒',
      'douyin': '🎵',
      'jd': '📦',
      'pdd': '🔥',
      'official': '🏢',
      'o2o': '🏪',
      'xiaohongshu': '📚',
      'wechat': '💬'
    };
    return platformIcons[platformName] || '🏪';
  };

  // Render fullscreen cross-analysis view
  const renderCrossAnalysisFullscreen = () => {
    return (
      <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm">
        <div className="fixed inset-2 z-50 bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
          <div className="flex-shrink-0 bg-functional-dark-blue text-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">{selectedKPI?.icon}</span>
                <h2 className="text-lg font-medium">{selectedKPI?.label} - 品牌×平台交叉分析</h2>
                {selectedBrand && (
                  <Badge variant="outline" className="bg-maersk-blue text-white border-white/30">
                    {selectedBrand}
                  </Badge>
                )}
                <Badge variant="outline" className="bg-functional-mid-blue text-white border-white/30">
                  🔄 全屏交叉分析
                </Badge>
                {selectedKPI && (
                  <Badge variant="outline" className="bg-accent-mid-teal text-white border-white/30">
                    当前指标: {selectedKPI.label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveKPITab("brand")}
                  className="p-2 hover:bg-functional-mid-blue rounded transition-colors"
                  title="返回标准视图"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-accent-mid-red rounded transition-colors"
                  title="关闭弹窗"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-functional-bright-grey">
            <div className="h-full p-4">
              <CrossAnalysisChart 
                selectedBrand={selectedBrand}
                selectedKPI={selectedKPI?.label}
                rawApiData={rawApiData}
                usingApiData={usingApiData}
                brandKPIData={brandKPIData}
                platformKPIData={platformKPIData}
              />
            </div>
          </div>
          <div className="flex-shrink-0 bg-functional-bright-grey border-t border-functional-light-grey px-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4 text-functional-mid-grey">
                <span>🔍 全屏品牌×平台交叉分析模式</span>
                <span>热力图自动适应窗口大小</span>
              </div>
              <div className="flex items-center space-x-4 text-functional-mid-grey">
                <span>ESC键快速退出</span>
                <span className="text-maersk-blue">Maersk © 2025</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (activeKPITab === 'cross') {
    return renderCrossAnalysisFullscreen();
  }

  return (
    <Dialog open={!!selectedKPI} onOpenChange={onClose}>
      <DialogContent className="!max-w-[90vw] max-h-[90vh] w-[90vw] h-[90vh] overflow-hidden maersk-card">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center flex-wrap gap-2 text-black text-base">
            <span>{selectedKPI?.icon}</span>
            <span>{selectedKPI?.label} - 详细分析</span>
            {selectedBrand && (
              <Badge variant="outline" className="bg-functional-bright-blue text-maersk-blue border-maersk-blue text-xs">
                {selectedBrand}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {activeKPITab === "brand" && " 品牌分析"}
              {activeKPITab === "platform" && "🏪 平台分析"}
              {activeKPITab === "cross" && "🔄 交叉分析"}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-functional-mid-grey text-sm">
            综合分析 {selectedKPI?.label} 指标的品牌分布、平台表现和交叉分析数据
            {selectedBrand && (
              <span className="text-maersk-blue ml-2">（当前显示品牌筛选结果）</span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs value={activeKPITab} onValueChange={setActiveKPITab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-3 bg-functional-bright-grey flex-shrink-0 mb-4">
              <TabsTrigger value="brand" className="text-black">品牌分析</TabsTrigger>
              <TabsTrigger value="platform" className="text-black">平台分析</TabsTrigger>
              <TabsTrigger 
                value="cross" 
                className="text-black flex items-center space-x-1"
              >
                <span>交叉分析</span>
                <Maximize2 className="h-3 w-3" />
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-hidden min-h-0">
              {/* Brand Analysis Tab */}
              <TabsContent value="brand" className="m-0 h-full flex flex-col">
                <div className="flex-1 overflow-auto p-4">
                  {brandKPIData && Array.isArray(brandKPIData) && brandKPIData.length > 0 ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-black">VF子品牌分布详情</h4>
                        <div className="bg-functional-bright-blue px-3 py-1 rounded-lg border border-functional-light-blue">
                          <span className="text-sm text-maersk-blue">
                            共 {brandKPIData.length} 个子品牌
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {brandKPIData.map((brand, index) => {
                          // 优先使用API数据计算具体的KPI值和同比环比
                          const kpiResult = usingApiData ? 
                            getBrandKPIWithGrowth(brand.brand, selectedKPI?.label) : 
                            {
                              value: selectedKPI?.label === '已揽收' ? Math.round(brand.totalOrders * 0.15) :
                                     selectedKPI?.label === '已发运' ? Math.round(brand.totalOrders * 0.25) :
                                     selectedKPI?.label === '已签收' ? brand.completedOrders :
                                     selectedKPI?.label === '已转寄' ? Math.round(brand.totalOrders * 0.03) :
                                     selectedKPI?.label === '已退回' ? Math.round(brand.totalOrders * 0.02) :
                                     selectedKPI?.label === '已取消' ? Math.round(brand.totalOrders * 0.01) :
                                     selectedKPI?.label === '首派成功率' ? brand.onTimeRate :
                                     selectedKPI?.label === '平均首派时长' ? (brand.avgDeliveryTime ? brand.avgDeliveryTime * 0.6 : 0) :
                                     selectedKPI?.label === '平均签收时长' ? brand.avgDeliveryTime :
                                     brand.totalOrders,
                              unit: selectedKPI?.label === '首派成功率' ? '%' :
                                    selectedKPI?.label === '平均首派时长' ? '小时' :
                                    selectedKPI?.label === '平均签收时长' ? '天' : '',
                              growthData: brand.growth || { mom: null, yoy: null }
                            };

                          const formattedValue = kpiResult.unit ? 
                            `${kpiResult.value.toFixed(1)}${kpiResult.unit}` : 
                            kpiResult.value.toLocaleString();
                          
                          // 修改品牌占比计算逻辑：计算品牌在当前订单状态的占比
                          let totalStatusOrders = 1;
                          let brandStatusOrders = 0;
                          
                          if (usingApiData && rawApiData?.data?.brandDistribution) {
                            // 从API数据计算各品牌在当前状态的总量
                            const allBrands = rawApiData.data.brandDistribution;
                            switch (selectedKPI?.label) {
                              case '已揽收':
                                totalStatusOrders = allBrands.reduce((sum, b) => sum + (b.pickedCount || 0), 0);
                                brandStatusOrders = kpiResult.value;
                                break;
                              case '已发运':
                                totalStatusOrders = allBrands.reduce((sum, b) => sum + (b.shippedCount || 0), 0);
                                brandStatusOrders = kpiResult.value;
                                break;
                              case '已签收':
                                totalStatusOrders = allBrands.reduce((sum, b) => sum + (b.deliveredCount || 0), 0);
                                brandStatusOrders = kpiResult.value;
                                break;
                              case '已转寄':
                                totalStatusOrders = allBrands.reduce((sum, b) => sum + (b.forwardedCount || 0), 0);
                                brandStatusOrders = kpiResult.value;
                                break;
                              case '已退回':
                                totalStatusOrders = allBrands.reduce((sum, b) => sum + (b.returnedCount || 0), 0);
                                brandStatusOrders = kpiResult.value;
                                break;
                              case '已取消':
                                totalStatusOrders = allBrands.reduce((sum, b) => sum + (b.cancelledCount || 0), 0);
                                brandStatusOrders = kpiResult.value;
                                break;
                              default:
                                totalStatusOrders = safeFilteredData?.brandStats?.totalOrders || 1;
                                brandStatusOrders = brand.totalOrders;
                                break;
                            }
                          } else {
                            totalStatusOrders = safeFilteredData?.brandStats?.totalOrders || 1;
                            brandStatusOrders = brand.totalOrders;
                          }
                          
                          const brandPercentage = totalStatusOrders > 0 ? ((brandStatusOrders / totalStatusOrders) * 100) : 0;

                          return (
                            <div key={index} className="flex flex-col p-4 border border-functional-light-grey rounded-lg hover:bg-functional-bright-grey transition-colors">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-functional-bright-blue rounded-full flex items-center justify-center border border-functional-light-blue">
                                    <span className="text-sm">{getBrandIcon(brand.brand)}</span>
                                  </div>
                                  <div className="font-medium text-black">{brand.brand}</div>
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-black text-xl mb-1">{formattedValue}</div>
                                <div className="text-xs text-functional-mid-grey mb-3">
                                  占比: {brandPercentage.toFixed(1)}%
                                </div>
                                {/* 只为支持同比环比的指标显示增长数据 */}
                                {shouldShowGrowthData(selectedKPI?.label) && (kpiResult.growthData.mom !== null || kpiResult.growthData.yoy !== null) && (
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex items-center justify-center space-x-1">
                                      <span className="text-functional-mid-grey">环比:</span>
                                      {kpiResult.growthData.mom !== null ? (
                                        <span className={kpiResult.growthData.mom >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}>
                                          {kpiResult.growthData.mom >= 0 ? '+' : ''}{kpiResult.growthData.mom.toFixed(1)}%
                                        </span>
                                      ) : (
                                        <span className="text-functional-mid-grey">-</span>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-center space-x-1">
                                      <span className="text-functional-mid-grey">同比:</span>
                                      {kpiResult.growthData.yoy !== null ? (
                                        <span className={kpiResult.growthData.yoy >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}>
                                          {kpiResult.growthData.yoy >= 0 ? '+' : ''}{kpiResult.growthData.yoy.toFixed(1)}%
                                        </span>
                                      ) : (
                                        <span className="text-functional-mid-grey">-</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Exception monitoring */}
                      {selectedKPI.details?.exceptions && Array.isArray(selectedKPI.details.exceptions) && selectedKPI.details.exceptions.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="font-medium text-black">异常监控</h4>
                          <div className="max-h-64 overflow-y-auto space-y-3">
                            {selectedKPI.details.exceptions.map((exception, index) => {
                              // 安全检查异常数据
                              if (!exception || typeof exception.count === 'undefined') {
                                return null;
                              }
                              
                              const adjustedCount = exception.count || 0;
                              
                              return (
                                <div key={index} className="p-4 border border-functional-light-grey rounded-lg bg-accent-bright-orange hover:bg-accent-light-orange transition-colors">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium text-accent-dark-orange">{exception.type}</span>
                                    <Badge variant="destructive" className="bg-accent-mid-red text-white">
                                      {adjustedCount} 单
                                    </Badge>
                                  </div>

                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-functional-mid-grey">
                      暂无品牌数据
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Platform Analysis Tab */}
              <TabsContent value="platform" className="m-0 h-full flex flex-col">
                <div className="flex-1 overflow-auto p-4">
                  {platformKPIData && Array.isArray(platformKPIData) && platformKPIData.length > 0 ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-black">电商平台分布详情</h4>
                        <div className="bg-functional-bright-blue px-3 py-1 rounded-lg border border-functional-light-blue">
                          <span className="text-sm text-maersk-blue">
                            共 {platformKPIData.length} 个平台
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {platformKPIData.map((platform, index) => {
                          const kpiResult = getPlatformKPIWithGrowth(platform.platform, selectedKPI?.label);
                          
                          const formattedValue = kpiResult.unit ? 
                            `${kpiResult.value.toFixed(1)}${kpiResult.unit}` : 
                            kpiResult.value.toLocaleString();

                          return (
                            <div key={index} className="flex flex-col p-4 border border-functional-light-grey rounded-lg hover:bg-functional-bright-grey transition-colors">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-functional-bright-blue rounded-full flex items-center justify-center border border-functional-light-blue">
                                    <span className="text-sm">{getPlatformIcon(platform.platform)}</span>
                                  </div>
                                  <div className="font-medium text-black">
                                    {platform.platform === 'tmall' ? '天猫' : 
                                     platform.platform === 'douyin' ? '抖音' : 
                                     platform.platform === 'jd' ? '京东' : 
                                     platform.platform === 'pdd' ? '拼多多' : 
                                     platform.platform === 'official' ? '官网/小程序' : 
                                     platform.platform === 'o2o' ? 'O2O' : 
                                     platform.platform === 'xiaohongshu' ? '小红书' : 
                                     platform.platform === 'wechat' ? '微信小程序' : 
                                     platform.platform}
                                  </div>
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-black text-xl mb-1">{formattedValue}</div>
                                <div className="text-xs text-functional-mid-grey mb-3">
                                  占比: {kpiResult.percentage.toFixed(1)}%
                                </div>
                                {/* 只为支持同比环比的指标显示增长数据 */}
                                {shouldShowGrowthData(selectedKPI?.label) && (kpiResult.growthData.mom !== null || kpiResult.growthData.yoy !== null) && (
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex items-center justify-center space-x-1">
                                      <span className="text-functional-mid-grey">环比:</span>
                                      {kpiResult.growthData.mom !== null ? (
                                        <span className={kpiResult.growthData.mom >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}>
                                          {kpiResult.growthData.mom >= 0 ? '+' : ''}{kpiResult.growthData.mom.toFixed(1)}%
                                        </span>
                                      ) : (
                                        <span className="text-functional-mid-grey">-</span>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-center space-x-1">
                                      <span className="text-functional-mid-grey">同比:</span>
                                      {kpiResult.growthData.yoy !== null ? (
                                        <span className={kpiResult.growthData.yoy >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}>
                                          {kpiResult.growthData.yoy >= 0 ? '+' : ''}{kpiResult.growthData.yoy.toFixed(1)}%
                                        </span>
                                      ) : (
                                        <span className="text-functional-mid-grey">-</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-functional-mid-grey">
                      暂无平台数据
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
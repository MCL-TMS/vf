import { useState, useRef, useCallback, useMemo } from 'react';
import { useAPIData } from './useAPIData';
import { filterData } from '../utils/dataFilter';
import type { FilteredData } from '../utils/dataFilterExtended';
import { filterLogisticsData } from '../utils/logisticsDataFilter';
import { transformAPIDataToFilteredData, validateAPIData } from '../utils/apiDataTransformer';
import { 
  processUnifiedCourierData, 
  convertToOverviewFormat, 
  convertToCourierMonitoringFormat,
  generateConsistencyReport,
  generateDetailedConsistencyReport,
  type UnifiedCourierData
} from '../utils/unifiedCourierDataProcessor';
import { orderData } from '../data/orderData';
import { logisticsOrderData } from '../data/logisticsOrderData';
import { brandData } from '../data/brandData';
import { getPlatformKPIData } from '../data/platformData';
import { getTodayDateRange, getCurrentMonthToDateRange } from '../utils/dateUtils';
import type { DateRange, FilterState, LogisticsExceptionFilter } from '../data/types';
import { useAuth } from '../contexts/AuthContext'; // 🔐 导入用户认证

// 计算增长率的辅助函数
function calculateGrowthRate(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return Math.round(((current - previous) / previous * 100) * 100) / 100;
}

export function useAppState() {
  // 🔐 获取用户权限
  const { user } = useAuth();
  
  // Navigation state
  const [activeMenu, setActiveMenu] = useState<string>("overview-dashboard");
  
  // Date range states - 总览界面默认为当月第一天到今天，其他页面保持原有逻辑
  const [dateRange, setDateRange] = useState<DateRange>(getCurrentMonthToDateRange());
  const [regionalDateRange, setRegionalDateRange] = useState<DateRange>(getTodayDateRange());
  
  // Filter states
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedSelfFlag, setSelectedSelfFlag] = useState<string | null>('Y'); // 🔧 默认为"自管"，筛选SELF_FLAG='Y'的订单
  const [filters, setFilters] = useState<FilterState>({
    brand: null,
    platform: null,
    status: "all",
    province: null,
    courier: null
  });
  
  // Dialog states  
  const [selectedKPI, setSelectedKPI] = useState<string | null>(null);
  const [activeKPITab, setActiveKPITab] = useState<'brand' | 'cross'>('brand');
  
  // Logistics exception filter
  const [logisticsExceptionFilter, setLogisticsExceptionFilter] = useState<LogisticsExceptionFilter>({
    type: null,
    brand: null,
    courier: null
  });
  
  // Refs
  const mainContentRef = useRef<HTMLDivElement>(null);
  
  // 🔐 根据用户权限计算实际要查询的品牌
  // 返回类型：string | string[] | null
  // - null: 管理员，查询所有品牌
  // - string: 单个品牌，如 '18405-1'
  // - string[]: 多个品牌，如 ['18405-1', '18405-2']
  const effectiveBrand = useMemo(() => {
    if (!selectedBrand || selectedBrand === 'all') {
      // 如果选择"all"，需要根据用户权限决定查询哪些品牌
      if (user?.isAdmin) {
        // 管理员：查询所有品牌（传null给API，表示不过滤）
        return null;
      } else if (user?.customerNos && user.customerNos.length > 0) {
        // 普通用户：只查询他们有权限的品牌
        if (user.customerNos.length === 1) {
          // 单个品牌：直接返回字符串
          return user.customerNos[0];
        } else {
          // 多个品牌：返回数组（更清晰，避免歧义）
          return user.customerNos; // 直接返回数组，不用join
        }
      }
      return null;
    }
    // 如果选择了具体品牌，直接返回
    return selectedBrand;
  }, [selectedBrand, user]);

  console.log('🔐 [useAppState] 品牌权限控制:', {
    selectedBrand,
    userIsAdmin: user?.isAdmin,
    userBrands: user?.customerNos,
    effectiveBrand,
    effectiveBrandType: Array.isArray(effectiveBrand) ? 'array' : typeof effectiveBrand,  // 🔍 新增：检查类型
    effectiveBrandLength: Array.isArray(effectiveBrand) ? effectiveBrand.length : 'N/A'   // 🔍 新增：数组长度
  });
  
  // 判断是否应该使用真实API数据 - 扩展到支持物流页面
  const shouldUseRealData = useMemo(() => {
    return activeMenu === 'overview-dashboard' || activeMenu === 'overview-logistics';
  }, [activeMenu]);
  
  // API data hook - 支持总览和物流页面，使用稳定的参数
  const apiOptions = useMemo(() => ({
    enabled: shouldUseRealData,
    dateRange,
    selectedBrand: effectiveBrand, // 🔐 使用经过权限过滤的品牌
    selectedPlatform,
    selectedSelfFlag,
    activeMenu // 传递activeMenu以区分不同页面的API需求
  }), [shouldUseRealData, dateRange, effectiveBrand, selectedPlatform, selectedSelfFlag, activeMenu]);

  console.log('🔧 [useAppState] apiOptions created:', apiOptions);

  const {
    data: apiData,
    loading: apiLoading,
    error: apiError,
    refetch: refetchData,
    hasData,
    logisticsData, // 新增：物流页面专用数据
    brandLogisticsData // 新增：品牌物流异常数据
  } = useAPIData(apiOptions);

  // 🔍 调试物流数据结构
  if (activeMenu === 'overview-logistics') {
    console.log('🚚 [useAppState] 物流页面数据调试:', {
      activeMenu,
      shouldUseRealData,
      hasLogisticsData: !!logisticsData,
      hasApiData: !!apiData,
      apiError,
      logisticsDataKeys: logisticsData ? Object.keys(logisticsData) : 'null',
      logisticsDataSample: logisticsData ? {
        success: logisticsData.success,
        dataType: typeof logisticsData.data,
        dataLength: Array.isArray(logisticsData.data) ? logisticsData.data.length : 'not array',
        firstItem: Array.isArray(logisticsData.data) && logisticsData.data.length > 0 ? logisticsData.data[0] : 'no data'
      } : 'null'
    });
  }

  // 🔥 新增：统一的快递商数据处理
  const unifiedCourierData = useMemo(() => {
    console.log('🔥 [useAppState] unifiedCourierData 处理条件检查:', {
      shouldUseRealData,
      activeMenu,
      hasApiData: !!apiData,
      hasLogisticsData: !!logisticsData,
      apiDataKeys: apiData ? Object.keys(apiData) : 'null',
      logisticsDataKeys: logisticsData ? Object.keys(logisticsData) : 'null'
    });
    
    if (shouldUseRealData) {
      // 生成详细的数据一致性报告
      const detailedReport = generateDetailedConsistencyReport(apiData, logisticsData);
      
      if (!detailedReport.isConsistent) {
        console.warn('⚠️ [useAppState] 快递商数据一致性检查发现问题:');
        console.table(detailedReport.courierComparison.filter(c => c.differences.isSignificant));
        console.warn('🔍 可能原因:', detailedReport.possibleCauses);
        console.info('💡 修复建议:', detailedReport.recommendations);
      }
      
      // 处理统一的快递商数据
      const unifiedData = processUnifiedCourierData(
        apiData, 
        logisticsData, 
        { 
          prioritizeDataSource: 'merged',
          includeDebugInfo: true 
        }
      );
      
      console.log(`📊 [useAppState] 统一快递商数据处理完成，共${unifiedData.length}家快递商`);
      console.log(`🔍 [useAppState] 数据差异分析:`, {
        总订单差异: `${detailedReport.summary.ordersDifference}单 (${detailedReport.summary.ordersDifferencePercentage.toFixed(2)}%)`,
        显著差异快递商: detailedReport.courierComparison.filter(c => c.differences.isSignificant).length
      });
      
      return {
        data: unifiedData,
        consistencyReport: detailedReport,
        overviewFormat: convertToOverviewFormat(unifiedData),
        monitoringFormat: convertToCourierMonitoringFormat(unifiedData)
      };
    }
    
    return null;
  }, [shouldUseRealData, apiData, logisticsData]);

  // Data processing - 使用 useMemo 缓存计算结果
  const filteredData = useMemo(() => {
    // 如果使用真实数据且有API数据
    if (shouldUseRealData && apiData) {
      // 验证API数据
      if (validateAPIData(apiData)) {
        // 将API数据转换为前端格式，使用统一的快递商数据
        const baseData = transformAPIDataToFilteredData(
          apiData, 
          selectedBrand, 
          selectedPlatform
        );
        
        // 🔥 替换courier数据为统一处理的数据
        if (unifiedCourierData) {
          baseData.courierData = unifiedCourierData.monitoringFormat.map(courier => ({
            name: courier.name,
            deliveryRate: courier.deliveryRate,
            pickupRate: courier.pickupRate,
            shippingRate: courier.shippingRate,
            orderCount: courier.total,
            percentage: courier.percentage,
            exceptions: courier.exceptions
          }));
        }
        
        return baseData;
      } else {
        // API数据验证失败，返回null结构以显示数据缺失
        console.warn('[useAppState] API数据验证失败，显示null数据结构');
        return transformAPIDataToFilteredData(
          { success: false, data: null } as any, 
          selectedBrand, 
          selectedPlatform
        );
      }
    }
    
    // 使用模拟数据（非总览页面或未连接API时）
    return filterData(
      selectedBrand || '', // 品牌名称
      selectedPlatform || '', // 平台筛选
      selectedSelfFlag || 'Y' // 自管筛选，默认为自管
    );
  }, [shouldUseRealData, apiData, selectedBrand, selectedPlatform, unifiedCourierData]); // 修复：添加unifiedCourierData依赖
  
  const filteredLogisticsData = useMemo(() => {
    return filterLogisticsData(
      logisticsOrderData,
      selectedBrand,
      logisticsExceptionFilter
    );
  }, [selectedBrand, logisticsExceptionFilter]);
  
  // Platform KPI data processing - 🔥 修复：使用与品牌分析一致的数据计算逻辑
  const platformKPIData = useMemo(() => {
    // 如果使用真实数据且有API数据
    if (shouldUseRealData && apiData && validateAPIData(apiData)) {
      // 🔥 修复：直接使用API数据中的精确统计值，确保与品牌分析数据一致
      return apiData.data.platformDistribution.map(platform => {
        // 计算同比环比 - 基于历史数据
        const momGrowth = apiData.data.historicalData ? 
          calculateGrowthRate(platform.orderCount, 
            apiData.data.historicalData.lastMonth.totalOrders * (platform.orderCount / (apiData.data.kpi.totalOrders || 1))) : null;
        const yoyGrowth = apiData.data.historicalData ? 
          calculateGrowthRate(platform.orderCount, 
            apiData.data.historicalData.lastYear.totalOrders * (platform.orderCount / (apiData.data.kpi.totalOrders || 1))) : null;
            
        // 🔥 关键修复：从crossAnalysisData聚合计算该平台的效率指标（加权平均）
        const crossData = apiData.data.crossAnalysisData || [];
        const platformCrossData = crossData.filter((item: any) => item.platformClass === platform.platformClass);
        
        // 计算加权平均的效率指标
        const totalOrders = platformCrossData.reduce((sum: number, item: any) => sum + (item.totalOrders || 0), 0);
        
        const firstDispatchSuccessRate = totalOrders > 0 
          ? platformCrossData.reduce((sum: number, item: any) => 
              sum + ((item.firstDispatchSuccessRate || 0) * (item.totalOrders || 0)), 0) / totalOrders
          : 0;
          
        const avgFirstDispatchHours = totalOrders > 0
          ? platformCrossData.reduce((sum: number, item: any) => 
              sum + ((item.avgFirstDispatchHours || 0) * (item.totalOrders || 0)), 0) / totalOrders
          : 0;
          
        const avgDeliveryHours = totalOrders > 0
          ? platformCrossData.reduce((sum: number, item: any) => 
              sum + ((item.avgDeliveryHours || 0) * (item.totalOrders || 0)), 0) / totalOrders
          : 0;
        
        return {
          platform: platform.platformClass,
          kpiData: {
            // 🔥 修复：使用API数据的精确值，与品牌分析保持一致
            picked: { 
              value: platform.pickedCount || 0, 
              change: { mom: momGrowth, yoy: yoyGrowth } 
            },
            shipped: { 
              value: platform.shippedCount || 0, 
              change: { mom: momGrowth, yoy: yoyGrowth } 
            },
            delivered: { 
              value: platform.deliveredCount || 0, 
              change: { mom: momGrowth, yoy: yoyGrowth } 
            },
            forwarded: { 
              value: platform.forwardedCount || 0, 
              change: { mom: momGrowth, yoy: yoyGrowth } 
            },
            returned: { 
              value: platform.returnedCount || 0, 
              change: { mom: momGrowth, yoy: yoyGrowth } 
            },
            cancelled: { 
              value: platform.cancelledCount || 0, 
              change: { mom: momGrowth, yoy: yoyGrowth } 
            },
            firstDispatchSuccessRate: { 
              value: firstDispatchSuccessRate,  // 🔥 修复：从交叉数据聚合（加权平均）
              change: { mom: null, yoy: null } 
            },
            avgFirstDispatchHours: { 
              value: avgFirstDispatchHours,  // 🔥 修复：从交叉数据聚合（加权平均）
              change: { mom: null, yoy: null } 
            },
            avgDeliveryHours: { 
              value: avgDeliveryHours,  // 🔥 修复：从交叉数据聚合（加权平均）
              change: { mom: null, yoy: null } 
            }
          }
        };
      });
    }
    
    // 使用模拟数据 - 返回正确的平台KPI数据
    return getPlatformKPIData(null);
  }, [shouldUseRealData, apiData]);

  // Brand KPI data processing - 新增品牌KPI数据，用于品牌分析标签页
  const brandKPIData = useMemo(() => {
    // 如果使用真实数据且有API数据
    if (shouldUseRealData && apiData && validateAPIData(apiData)) {
      // 基于API的品牌分布数据生成品牌KPI，包含同比环比计算
      return apiData.data.brandDistribution.map(brand => {
        // 🔥 修复：直接使用brandDistribution中的首派效率指标（数据库计算，最准确）
        // 不再从crossAnalysisData聚合，避免二次计算误差
        const firstDispatchSuccessRate = brand.firstDispatchSuccessRate || 0;
        const avgFirstDispatchHours = brand.avgFirstDispatchHours || 0;
        const avgDeliveryHours = brand.avgDeliveryHours || 0;
        
        // 🔍 调试：验证品牌效率指标来源
        console.log(`📊 [brandKPIData] 品牌"${brand.brandName}"效率指标（直接从brandDistribution获取）:`, {
          首派成功率: firstDispatchSuccessRate.toFixed(2) + '%',
          平均首派时长: avgFirstDispatchHours.toFixed(2) + 'h',
          平均签收时长: avgDeliveryHours.toFixed(2) + 'h',
          数据来源: 'brandDistribution (数据库直接计算)'
        });
        
        // 🔥 计算该品牌的订单同比环比增长率
        const currentOrders = brand.orderCount;
        let momGrowth = null;
        let yoyGrowth = null;
        
        if (apiData.data.historicalData) {
          const totalOrders = apiData.data.kpi.totalOrders || 1;
          const brandShare = currentOrders / totalOrders;
          
          // 估算上月和去年同期该品牌的订单数
          const lastMonthEstimate = (apiData.data.historicalData.lastMonth.totalOrders || 0) * brandShare;
          const lastYearEstimate = (apiData.data.historicalData.lastYear.totalOrders || 0) * brandShare;
          
          momGrowth = calculateGrowthRate(currentOrders, lastMonthEstimate);
          yoyGrowth = calculateGrowthRate(currentOrders, lastYearEstimate);
        }
        
        return {
          brand: brand.brandName,
          totalOrders: brand.orderCount,
          completedOrders: brand.deliveredCount,
          completionRate: Math.round(brand.deliveryRate * 10) / 10,
          avgDeliveryTime: brand.avgDeliveryHours,  // 🔥 修复：统一使用avgDeliveryHours
          onTimeRate: Math.round((100 - brand.exceptionRate) * 10) / 10,
          cost: Math.round(brand.orderCount * 15.5), // 假设平均运费15.5元
          // 🔥 修复：直接使用brandDistribution中的效率指标
          firstDispatchSuccessRate: firstDispatchSuccessRate,
          avgFirstDispatchHours: avgFirstDispatchHours,
          avgDeliveryHours: avgDeliveryHours,
          // 新增：同比环比数据（仅用于订单数，效率指标不显示同比环比）
          growth: {
            mom: momGrowth,
            yoy: yoyGrowth
          }
        };
      });
    }
    
    // 使用模拟数据
    return brandData.map(brand => ({
      brand: brand.name,
      totalOrders: Math.round(brand.orders * (shouldUseRealData && apiData ? 1.2 : 1)),
      completedOrders: Math.round(brand.orders * 0.92 * (shouldUseRealData && apiData ? 1.2 : 1)),
      completionRate: 92,
      avgDeliveryTime: brand.avgDeliveryTime,
      onTimeRate: brand.onTimeDeliveryRate,
      cost: Math.round(brand.avgShippingCost * brand.orders * (shouldUseRealData && apiData ? 1.2 : 1)),
      growth: {
        mom: null,
        yoy: null
      }
    }));
  }, [shouldUseRealData, apiData, brandData]);

  // 使用 useCallback 包装所有的 setter 函数，确保引用稳定
  const stableSetActiveMenu = useCallback((menu: string) => setActiveMenu(menu), []);
  const stableSetDateRange = useCallback((range: DateRange) => setDateRange(range), []);
  const stableSetRegionalDateRange = useCallback((range: DateRange) => setRegionalDateRange(range), []);
  const stableSetSelectedBrand = useCallback((brand: string | null) => {
    console.log('🏷️ [useAppState] stableSetSelectedBrand called with:', brand);
    setSelectedBrand(brand);
  }, []);
  const stableSetSelectedPlatform = useCallback((platform: string | null) => {
    console.log('🏪 [useAppState] stableSetSelectedPlatform called with:', platform);
    setSelectedPlatform(platform);
  }, []);
  const stableSetSelectedSelfFlag = useCallback((selfFlag: string | null) => {
    console.log('🔧 [useAppState] stableSetSelectedSelfFlag called with:', selfFlag);
    setSelectedSelfFlag(selfFlag);
  }, []);

  const stableSetFilters = useCallback((filters: FilterState) => setFilters(filters), []);
  const stableSetSelectedKPI = useCallback((kpi: string | null) => setSelectedKPI(kpi), []);
  const stableSetActiveKPITab = useCallback((tab: 'brand' | 'cross') => setActiveKPITab(tab), []);
  const stableSetLogisticsExceptionFilter = useCallback((filter: LogisticsExceptionFilter) => setLogisticsExceptionFilter(filter), []);

  // 稳定的 refetch 函数
  const stableRefetchData = useCallback(() => {
    if (shouldUseRealData) {
      refetchData();
    }
  }, [shouldUseRealData, refetchData]);

  return {
    // Navigation
    activeMenu,
    setActiveMenu: stableSetActiveMenu,
    
    // Date ranges
    dateRange,
    setDateRange: stableSetDateRange,
    regionalDateRange,
    setRegionalDateRange: stableSetRegionalDateRange,
    
    // Filters
    selectedBrand,
    setSelectedBrand: stableSetSelectedBrand,
    selectedPlatform,
    setSelectedPlatform: stableSetSelectedPlatform,
    selectedSelfFlag,
    setSelectedSelfFlag: stableSetSelectedSelfFlag,
    filters,
    setFilters: stableSetFilters,
    
    // Dialogs
    selectedKPI,
    setSelectedKPI: stableSetSelectedKPI,
    activeKPITab,
    setActiveKPITab: stableSetActiveKPITab,
    
    // Logistics exception filter
    logisticsExceptionFilter,
    setLogisticsExceptionFilter: stableSetLogisticsExceptionFilter,
    
    // Refs
    mainContentRef,
    
    // API state - 只在总览页面有效
    apiLoading: shouldUseRealData ? apiLoading : false,
    apiError: shouldUseRealData ? apiError : null,
    refetchData: stableRefetchData,
    hasData: shouldUseRealData ? hasData : true, // 非总览页面总是有数据（模拟数据）
    
    // Processed data
    filteredData,
    filteredLogisticsData,
    platformKPIData,
    brandKPIData,
    
    // Data source indicator
    shouldUseRealData,
    usingApiData: shouldUseRealData && !!apiData && !apiError && validateAPIData(apiData),
    
    // Raw API data for debugging - 增强版，包含交叉分析数据、物流数据和统一快递商数据
    rawApiData: shouldUseRealData ? {
      // 总览数据（适用于总览页面）
      ...(apiData || {}),
      // 🔥 新增：直接包含品牌物流数据用于调试
      brandLogisticsData: brandLogisticsData || null,
      logisticsData: logisticsData || null,
      data: {
        ...(apiData?.data || {}),
        // 🔥 从filteredData中提取crossAnalysisData，确保CrossAnalysisChart能够访问
        crossAnalysisData: filteredData?.crossAnalysisData || [],
        // 🔥 新增：物流数据（适用于物流页面）
        logistics: logisticsData || null,
        // 🔥 新增：品牌物流异常数据（专门用于品牌维度监控）
        brandLogistics: brandLogisticsData || null,
        // 🔥 新增：统一的快递商数据
        unifiedCouriers: unifiedCourierData?.data || [],
        // 🔥 新增：快递商数据一致性报告
        courierConsistencyReport: unifiedCourierData?.consistencyReport || null
      }
    } : null,
    
    // 🔥 新增：统一的快递商数据（供组件直接使用）
    unifiedCourierData: unifiedCourierData?.data || null
  };
}
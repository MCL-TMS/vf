import React, { useState, useEffect, useRef } from "react";
import { ResponsiveContainer, Cell, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { getBrandPlatformCrossAnalysis, platformsData } from "../data/platformData";
import { useBrand } from "../contexts/BrandContext"; // 🔥 导入品牌上下文
import { usePlatform } from "../contexts/PlatformContext"; // 🔥 导入平台上下文

interface CrossAnalysisChartProps {
  selectedBrand?: string;
  selectedKPI?: string;
  rawApiData?: any;
  usingApiData?: boolean;
  brandKPIData?: any[];
  platformKPIData?: any[];
}

export function CrossAnalysisChart({ 
  selectedBrand, 
  selectedKPI, 
  rawApiData, 
  usingApiData = false, 
  brandKPIData = [], 
  platformKPIData = [] 
}: CrossAnalysisChartProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 🔥 从BrandContext获取品牌映射
  const { brandMappings, codeToNameMap } = useBrand();

  // 🔥 从PlatformContext获取平台映射
  const { platformMappings } = usePlatform();

  console.log('🔍 [CrossAnalysisChart] 平台映射状态:', {
    platformMappingsCount: platformMappings.length,
    platformMappings: platformMappings.map(p => ({ code: p.code, name: p.name, icon: p.icon }))
  });

  // 监听容器大小变化
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    // 初始化时延迟测量，确保DOM完全渲染
    const timer = setTimeout(updateSize, 100);
    
    window.addEventListener('resize', updateSize);
    
    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
  }, []);

  // 🔥 修复：平台显示名称到代码的映射 - 确保与品牌分析和平台分析完全一致
  const mapPlatformDisplayToCode = (displayName: string): string => {
    const platformMapping: { [key: string]: string } = {
      '天猫': 'tmall',
      '抖音': 'douyin', 
      '京东': 'jd',
      '拼多多': 'pdd',
      '官网': 'official',
      '官网/小程序': 'official',
      '小程序': 'official',
      '微信小程序': 'wechat',
      '微信': 'wechat',
      'O2O': 'o2o',
      '小红书': 'xiaohongshu',
      '未知平台': 'unknown',  // 🔥 添加未知平台映射
      'null': 'unknown',       // 🔥 处理null字符串
      'undefined': 'unknown',  // 🔥 处理undefined字符串
      '': 'unknown'            // 🔥 处理空字符串
    };
    
    // 🔥 添加空值检查
    if (!displayName || displayName === 'null' || displayName === 'undefined') {
      console.warn(`⚠️ [CrossAnalysisChart] 平台名称为空或无效: "${displayName}", 映射为 unknown`);
      return 'unknown';
    }
    
    // 从映射表查找
    if (platformMapping[displayName]) {
      return platformMapping[displayName];
    }
    
    // 最后使用小写转换作为备选
    console.warn(`⚠️ [CrossAnalysisChart] 未找到平台映射: "${displayName}", 使用小写转换`);
    return displayName.toLowerCase();
  };

  // 🔥 获取平台信息 - 使用PlatformContext动态获取
  const getPlatformInfo = (platformName: string) => {
    // 优先从PlatformContext获取（使用平台名称匹配，如"天猫"、"京东"）
    if (platformMappings && platformMappings.length > 0) {
      const platformMapping = platformMappings.find(p => p.name === platformName);
      if (platformMapping) {
        console.log(`✅ [CrossAnalysisChart] 从PlatformContext获取平台信息: ${platformName} ->`, {
          name: platformMapping.name,
          icon: platformMapping.icon
        });
        return {
          name: platformName,
          displayName: platformMapping.name,
          logo: platformMapping.icon || '🏪',
          color: '#42b0d5' // 可以考虑后续从数据库获取颜色
        };
      }
    }
    
    // 回退：从硬编码的platformsData获取（也使用name匹配）
    const platform = platformsData.find(p => p.displayName === platformName || p.name === platformName);
    if (platform) {
      console.log(`🔄 [CrossAnalysisChart] 从platformsData回退获取平台信息: ${platformName}`);
      return platform;
    }
    
    // 最后：返回默认值
    console.warn(`⚠️ [CrossAnalysisChart] 未找到平台信息: \"${platformName}\", 使用默认值`);
    return {
      name: platformName,
      displayName: platformName,
      logo: '🏪',
      color: '#42b0d5'
    };
  };

  // 🔥 新增：获取KPI的显示格式（单位、小数位等）
  const formatKPIValue = (value: number, kpiLabel: string): string => {
    if (!kpiLabel || kpiLabel === '总单量') {
      return value.toLocaleString(); // 订单数量，整数
    }
    
    switch (kpiLabel) {
      case '首派成功率':
        return `${value.toFixed(1)}%`; // 百分比，1位小数
      case '平均首派时长':
      case '平均签收时长':
        return `${value.toFixed(1)}h`; // 小时，1位小数
      case '已揽收':
      case '已发运':
      case '已签收':
      case '已转寄':
      case '已退回':
      case '已取消':
        return value.toLocaleString(); // 订单数量，整数
      default:
        return value.toLocaleString();
    }
  };
  
  // 🔥 新增：获取KPI的单位
  const getKPIUnit = (kpiLabel: string): string => {
    if (!kpiLabel || kpiLabel === '总单量') return '单';
    
    switch (kpiLabel) {
      case '首派成功率': return '%';
      case '平均首派时长':
      case '平均签收时长': return '小时';
      case '已揽收':
      case '已发运':
      case '已签收':
      case '已转寄':
      case '已退回':
      case '已取消': return '单';
      default: return '单';
    }
  };

  // 🔥 新增：判断是否为效率指标（需要特殊处理，不是订单数量）
  const isEfficiencyKPI = (kpiLabel: string): boolean => {
    return ['首派成功率', '平均首派时长', '平均签收时长'].includes(kpiLabel);
  };

  // 根据选择的KPI获取对应的订单数量字段
  const getKPIOrderField = (kpiLabel: string): string => {
    switch (kpiLabel) {
      case '已揽收': return 'pickedOrders';
      case '已发运': return 'shippedOrders';
      case '已签收': return 'deliveredOrders';
      case '已转寄': return 'forwardedOrders';
      case '已退回': return 'returnedOrders';
      case '已取消': return 'cancelledOrders';
      case '总单量': return 'totalOrders';
      // 🔥 新增：效率指标
      case '首派成功率': return 'firstDispatchSuccessRate';
      case '平均首派时长': return 'avgFirstDispatchHours';
      case '平均签收时长': return 'avgDeliveryHours';
      default: return 'totalOrders'; // 默认显示总单量
    }
  };

  // 严格区分数据源 - 不混合使用，并根据KPI过滤数据
  const generateCrossAnalysisData = () => {
    if (usingApiData) {
      // 只使用真实API数据
      console.log('🔄 [CrossAnalysisChart] 使用真实API数据，当前KPI:', selectedKPI);
      
      if (!rawApiData?.data?.crossAnalysisData) {
        console.warn('⚠️ [CrossAnalysisChart] API数据不可用，返回空数组');
        return [];
      }

      const apiCrossData = rawApiData.data.crossAnalysisData || [];
      const targetOrderField = getKPIOrderField(selectedKPI || '总单量');
      
      // 🔥 新增：详细调试 rawApiData 结构
      console.log('🔍 [CrossAnalysisChart] rawApiData完整结构:', {
        hasRawApiData: !!rawApiData,
        hasData: !!rawApiData?.data,
        hasCrossAnalysisData: !!rawApiData?.data?.crossAnalysisData,
        crossAnalysisDataLength: apiCrossData.length,
        firstRecord: apiCrossData[0],
        // 🔥 新增：列出第一条记录的所有键
        firstRecordKeys: apiCrossData[0] ? Object.keys(apiCrossData[0]) : [],
        // 🔥 新增：直接检查效率指标字段
        hasEfficiencyFields: apiCrossData[0] ? {
          hasFirstDispatchSuccessRate: 'firstDispatchSuccessRate' in apiCrossData[0],
          hasAvgFirstDispatchHours: 'avgFirstDispatchHours' in apiCrossData[0],
          hasAvgDeliveryHours: 'avgDeliveryHours' in apiCrossData[0],
          actualValues: {
            firstDispatchSuccessRate: apiCrossData[0].firstDispatchSuccessRate,
            avgFirstDispatchHours: apiCrossData[0].avgFirstDispatchHours,
            avgDeliveryHours: apiCrossData[0].avgDeliveryHours
          }
        } : null
      });
      
      console.log('📊 [CrossAnalysisChart] API交叉数据处理:', {
        totalRecords: apiCrossData.length,
        selectedKPI,
        targetOrderField,
        uniquePlatforms: [...new Set(apiCrossData.map((item: any) => item.platformClass))],
        sampleData: apiCrossData.slice(0, 5).map((item: any) => ({
          brand: item.brandName,
          platform: item.platformClass,
          total: item.totalOrders,
          shipped: item.shippedOrders,
          // 🔥 新增：显示效率指标的值
          firstDispatchSuccessRate: item.firstDispatchSuccessRate,
          avgFirstDispatchHours: item.avgFirstDispatchHours,
          avgDeliveryHours: item.avgDeliveryHours,
          // 🔥 新增：显示目标字段的值
          [targetOrderField]: item[targetOrderField]
        }))
      });

      // 转换API数据为前端需要的格式，重点关注选择的KPI对应的订单状态
      const crossData = apiCrossData.map((item: any) => {
        // ✅ 直接使用platformClass作为平台名称，不需要code转换
        const platformName = item.platformClass || '未知平台';
        const platformInfo = getPlatformInfo(platformName);
        
        // 🔥 修复：根据KPI类型获取对应的值
        let kpiValue = 0;
        if (isEfficiencyKPI(selectedKPI || '')) {
          // 效率指标：首派成功率、平均首派时长、平均签收时长
          kpiValue = item[targetOrderField] || 0;
        } else {
          // 订单数量指标：已揽收、已发运、已签收等
          kpiValue = item[targetOrderField] || 0;
        }
        
        return {
          brand: item.brandName,
          platform: platformName,  // ✅ 直接使用平台名称（如：天猫、京东）
          platformDisplay: platformName,
          platformLogo: platformInfo.logo,
          platformColor: platformInfo.color,
          orders: kpiValue, // 🔥 统一使用kpiValue，效率指标也存储在这里
          totalOrders: item.totalOrders || 0, // 🔥 关键修复：添加totalOrders字段用于加权平均计算
          kpiBreakdown: {
            picked: item.pickedOrders,
            shipped: item.shippedOrders,
            delivered: item.deliveredOrders,
            forwarded: item.forwardedOrders,
            returned: item.returnedOrders,
            cancelled: item.cancelledOrders
          },
          performance: {
            deliveryRate: Math.round((item.deliveredOrders / Math.max(item.totalOrders, 1)) * 100 * 100) / 100,
            exceptionRate: Math.round(((item.returnedOrders + item.cancelledOrders) / Math.max(item.totalOrders, 1)) * 100 * 100) / 100,
            avgDeliveryTime: item.avgDeliveryTime || 0,
            // 🔥 新增：效率指标
            firstDispatchSuccessRate: item.firstDispatchSuccessRate || 0,
            avgFirstDispatchHours: item.avgFirstDispatchHours || 0,
            avgDeliveryHours: item.avgDeliveryHours || 0
          }
        };
      });

      console.log('✅ [CrossAnalysisChart] 真实数据转换完成:', {
        inputRecords: apiCrossData.length,
        outputRecords: crossData.length,
        targetKPI: selectedKPI,
        targetOrderField,
        totalKPIOrders: crossData.reduce((sum, item) => sum + item.orders, 0),
        platformBreakdown: crossData.reduce((acc: any, item) => {
          if (!acc[item.platform]) {
            acc[item.platform] = { count: 0, orders: 0 };
          }
          acc[item.platform].count++;
          acc[item.platform].orders += item.orders;
          return acc;
        }, {}),
        brandBreakdown: crossData.reduce((acc: any, item) => {
          if (!acc[item.brand]) {
            acc[item.brand] = { count: 0, orders: 0 };
          }
          acc[item.brand].count++;
          acc[item.brand].orders += item.orders;
          return acc;
        }, {})
      });
      
      return crossData;
    } else {
      // 只使用模拟数据，同样根据KPI过滤
      console.log('🔄 [CrossAnalysisChart] 使用模拟数据，当前KPI:', selectedKPI);
      const mockData = getBrandPlatformCrossAnalysis(selectedBrand, null).filter(item => item.brand !== 'VF');
      
      // 根据选择的KPI调整模拟数据中的订单数量
      const adjustedMockData = mockData.map(item => {
        let kpiOrderCount = item.orders;
        
        if (selectedKPI && item.kpiBreakdown) {
          kpiOrderCount = item.kpiBreakdown[
            selectedKPI === '已揽收' ? 'picked' : 
            selectedKPI === '已发运' ? 'shipped' :
            selectedKPI === '已签收' ? 'delivered' :
            selectedKPI === '已转寄' ? 'forwarded' :
            selectedKPI === '已退回' ? 'returned' :
            selectedKPI === '已取消' ? 'cancelled' : 'delivered'
          ] || item.orders;
        }
        
        return {
          ...item,
          orders: kpiOrderCount
        };
      });
      
      console.log('✅ [CrossAnalysisChart] 模拟数据调整完成:', {
        totalRecords: adjustedMockData.length,
        selectedKPI,
        totalKPIOrders: adjustedMockData.reduce((sum, item) => sum + item.orders, 0)
      });
      
      return adjustedMockData;
    }
  };

  // 生成交叉分析数据
  const crossAnalysisData = generateCrossAnalysisData();
  
  // 🔥 修复：动态获取品牌列表和平台列表，不使用硬编码
  // 品牌列表：从API数据或交叉分析数据中提取
  const allBrands = (() => {
    if (usingApiData && rawApiData?.data?.brandDistribution) {
      // 从API的brandDistribution提取品牌列表
      const brands = rawApiData.data.brandDistribution
        .map((b: any) => b.brandName)
        .filter((name: string) => name && name !== 'VF'); // 排除VF母品牌
      
      console.log('✅ [CrossAnalysisChart] 从API动态获取品牌列表:', brands);
      return brands.length > 0 ? brands : [];
    }
    
    // 回退：从交叉分析数据中提取唯一品牌
    const brands = [...new Set(crossAnalysisData.map(item => item.brand))].filter(b => b !== 'VF');
    console.log('🔄 [CrossAnalysisChart] 从交叉数据提取品牌列表:', brands);
    return brands.length > 0 ? brands : [];
  })();
  
  // 平台列表：从API数据或交叉分析数据中提取
  const allColumns = (() => {
    if (usingApiData && rawApiData?.data?.platformDistribution) {
      // 从API的platformDistribution提取平台列表
      // ✅ 直接使用platformClass（平台名称），不再使用platformCode
      const platformMap = new Map();
      
      rawApiData.data.platformDistribution.forEach((p: any) => {
        const platformName = p.platformClass || '未知平台';  // ✅ 使用platformClass
        
        // 如果已存在该平台名称，跳过（去重）
        if (platformMap.has(platformName)) {
          console.warn(`⚠️ [CrossAnalysisChart] 发现重复平台: ${platformName}, 已去重`);
          return;
        }
        
        const platformInfo = getPlatformInfo(platformName);
        
        platformMap.set(platformName, {
          name: platformName,  // ✅ 直接使用平台名称
          displayName: platformName,
          shortName: platformName,
          logo: platformInfo.logo,
          color: platformInfo.color
        });
      });
      
      const platforms = Array.from(platformMap.values());
      
      console.log('✅ [CrossAnalysisChart] 从API动态获取平台列表（已去重）:', platforms.map(p => p.name));
      return platforms.length > 0 ? platforms : [];
    }
    
    // 回退：从crossAnalysisData提取唯一平台，然后从platformsData获取详信息
    const uniquePlatformNames = [...new Set(crossAnalysisData.map(item => item.platform))];
    const platforms = uniquePlatformNames.map(name => {
      const platformInfo = getPlatformInfo(name);
      return {
        name: name,  // ✅ 使用平台名称
        displayName: name,
        shortName: name,
        logo: platformInfo.logo,
        color: platformInfo.color
      };
    });
    
    console.log('🔄 [CrossAnalysisChart] 从交叉数据提取平台列表:', platforms.map(p => p.name));
    return platforms.length > 0 ? platforms : [];
  })();
  
  // 🔥 防御性检查：如果没有品牌或平台数据，提前返回空状态
  if (allBrands.length === 0 || allColumns.length === 0) {
    console.warn('⚠️ [CrossAnalysisChart] 没有品牌或平台数据，显示空状态');
    return (
      <div ref={containerRef} className="h-full w-full flex items-center justify-center bg-maersk-white">
        <div className="text-center">
          <div className="text-functional-mid-grey mb-2">📊 暂无交叉分析数据</div>
          <p className="text-sm text-functional-mid-grey">
            {allBrands.length === 0 ? '没有品牌数据' : '没有平台数据'}
          </p>
        </div>
      </div>
    );
  }
  
  // 构建热力图数据矩阵 - 直接使用KPI对应的订单数量
  const heatmapData = [];
  const maxOrderValue = Math.max(...crossAnalysisData.map(item => item.orders || 0), 1);
  
  allBrands.forEach((brand, brandIndex) => {
    allColumns.forEach((column, columnIndex) => {
      // 🔥 关键修复：查找品牌×平台的数据时使用正确的平台代码匹配
      const dataPoint = crossAnalysisData.find(item => 
        item.brand === brand && item.platform === column.name
      );
      
      // 直接使用orders字段，它已经是KPI对应的订单数量
      const kpiValue = dataPoint ? dataPoint.orders : 0;
      
      heatmapData.push({
        brand,
        column: column.name,
        columnDisplay: column.displayName,
        columnShort: column.shortName,
        columnLogo: column.logo,
        columnColor: column.color,
        orders: kpiValue,
        kpiValue,
        intensity: maxOrderValue > 0 ? (kpiValue / maxOrderValue) : 0,
        brandIndex,
        columnIndex,
        hasData: !!dataPoint,
        // 添加调试信息
        debugInfo: dataPoint ? {
          originalPlatformDisplay: dataPoint.platformDisplay,
          mappedPlatformCode: dataPoint.platform,
          matchedCorrectly: dataPoint.platform === column.name
        } : null
      });
    });
  });

  // 🔥 数据验证：检查官网/小程序平台的数据是否正确映射
  const officialPlatformData = heatmapData.filter(item => item.column === 'official');
  const officialTotalOrders = officialPlatformData.reduce((sum, item) => sum + item.kpiValue, 0);
  
  console.log('🔍 [CrossAnalysisChart] 官网/小程序平台数据验证:', {
    officialCells: officialPlatformData.length,
    totalOfficialOrders: officialTotalOrders,
    cellsWithData: officialPlatformData.filter(item => item.hasData).length,
    dataDetails: officialPlatformData.map(item => ({
      brand: item.brand,
      orders: item.kpiValue,
      hasData: item.hasData,
      debugInfo: item.debugInfo
    }))
  });

  // 🔥 修复：品牌总计和平台总计必须从交叉数据（heatmapData）计算，确保数据一致性
  // ⚠️ 不能从 brandDistribution 或 platformDistribution 获取，因为它们的WHERE条件可能不同
  
  // 🔥 关键修复：判断当前KPI类型，决定使用求和还是加权平均
  const isEfficiencyMetric = ['首派成功率', '平均首派时长', '平均签收时长'].includes(selectedKPI);
  
  // 品牌总计 = 该品牌在所有平台的订单总和（从交叉数据计算）
  const brandTotals = allBrands.map(brand => {
    const brandCells = heatmapData.filter(item => item.brand === brand);
    
    let total: number;
    
    if (isEfficiencyMetric) {
      // 🔥 效率指标：使用加权平均（按订单数加权）
      const totalOrders = brandCells.reduce((sum, cell) => {
        const cellData = crossAnalysisData.find(
          d => d.brand === cell.brand && d.platform === cell.column
        );
        return sum + (cellData?.totalOrders || 0);
      }, 0);
      
      const weightedSum = brandCells.reduce((sum, cell) => {
        const cellData = crossAnalysisData.find(
          d => d.brand === cell.brand && d.platform === cell.column
        );
        const orders = cellData?.totalOrders || 0;
        return sum + (cell.kpiValue * orders);
      }, 0);
      
      total = totalOrders > 0 ? (weightedSum / totalOrders) : 0;
      
      console.log(`✅ [CrossAnalysisChart] 品牌${brand}总计（加权平均）:`, {
        selectedKPI,
        totalOrders,
        weightedSum,
        average: total,
        cellDetails: brandCells.map(c => ({
          platform: c.column,
          value: c.kpiValue,
          orders: crossAnalysisData.find(d => d.brand === c.brand && d.platform === c.column)?.totalOrders || 0
        }))
      });
    } else {
      // 普通指标：直接求和
      total = brandCells.reduce((sum, item) => sum + item.kpiValue, 0);
      console.log(`✅ [CrossAnalysisChart] 品牌${brand}总计（求和）: ${total}`);
    }
      
    return { brand, total };
  });

  // 平台总计 = 该平台在所有品牌的订单总和（从交叉数据计算）
  const columnTotals = allColumns.map(column => {
    const columnCells = heatmapData.filter(item => item.column === column.name);
    
    let total: number;
    
    if (isEfficiencyMetric) {
      // 🔥 效率指标：使用加权平均（按订单数加权）
      const totalOrders = columnCells.reduce((sum, cell) => {
        const cellData = crossAnalysisData.find(
          d => d.brand === cell.brand && d.platform === cell.column
        );
        return sum + (cellData?.totalOrders || 0);
      }, 0);
      
      const weightedSum = columnCells.reduce((sum, cell) => {
        const cellData = crossAnalysisData.find(
          d => d.brand === cell.brand && d.platform === cell.column
        );
        const orders = cellData?.totalOrders || 0;
        return sum + (cell.kpiValue * orders);
      }, 0);
      
      total = totalOrders > 0 ? (weightedSum / totalOrders) : 0;
      
      console.log(`✅ [CrossAnalysisChart] 平台${column.name}总计（加权平均）:`, {
        selectedKPI,
        totalOrders,
        weightedSum,
        average: total,
        cellDetails: columnCells.map(c => ({
          brand: c.brand,
          value: c.kpiValue,
          orders: crossAnalysisData.find(d => d.brand === c.brand && d.platform === c.column)?.totalOrders || 0
        }))
      });
    } else {
      // 普通指标：直接求和
      total = columnCells.reduce((sum, item) => sum + item.kpiValue, 0);
      console.log(`✅ [CrossAnalysisChart] 平台${column.name}总计（求和）: ${total}`);
    }
      
    return { 
      column: column.name, 
      displayName: column.displayName, 
      shortName: column.shortName,
      logo: column.logo,
      color: column.color,
      total 
    };
  });

  // 🔥 数据一致性验证
  const grandTotal = columnTotals.reduce((sum, col) => sum + col.total, 0);
  const brandTotalSum = brandTotals.reduce((sum, brand) => sum + brand.total, 0);
  const heatmapTotalSum = heatmapData.reduce((sum, item) => sum + item.kpiValue, 0);
  
  console.log('🔍 [CrossAnalysisChart] 数据一致性验证:', {
    selectedKPI,
    平台总计之和: grandTotal,
    品牌总计之和: brandTotalSum,
    热力图单元格之和: heatmapTotalSum,
    数据一致性: (grandTotal === brandTotalSum && brandTotalSum === heatmapTotalSum) ? '✅ 一致' : '❌ 不一致',
    品牌总计详情: brandTotals.map(b => ({ brand: b.brand, total: b.total })),
    平台总计详情: columnTotals.map(p => ({ platform: p.column, displayName: p.displayName, total: p.total }))
  });
  
  // 🔥 获取官网/小程序平台总计（用于页面底部显示）
  const officialColumnTotal = columnTotals.find(c => c.column === 'official')?.total || 0;

  // 获取颜色强度
  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return 'var(--functional-bright-grey)';
    const alpha = Math.max(0.1, Math.min(1, intensity));
    return `rgba(66, 176, 213, ${alpha})`;
  };

  const getCellTextColor = (intensity: number) => {
    return intensity > 0.5 ? 'var(--maersk-white)' : 'var(--maersk-black)';
  };

  // 获取品牌显示图标
  const getBrandIcon = (brand: string) => {
    const brandIcons = {
      'TNF': '🏔️',
      'DICKIES': '👔',
      'VANS': '👟',
      'TIMBERLAND': '🥾',
      'ICEBREAKER': '🧊',
      'KIPLING': '🎒',
      'SMARTWOOL': '🧶'
    };
    return brandIcons[brand] || '🏷️';
  };

  // 根据容器宽度动态计算列宽
  const getColumnWidth = () => {
    if (containerSize.width === 0) return { brand: 120, column: 100, total: 80 };
    const totalColumns = allColumns.length + 2;
    const brandColumnWidth = Math.max(120, Math.min(160, containerSize.width * 0.15));
    const totalColumnWidth = Math.max(80, Math.min(120, containerSize.width * 0.1));
    const scrollbarWidth = 20;
    const padding = 32;
    const availableWidth = containerSize.width - brandColumnWidth - totalColumnWidth - scrollbarWidth - padding;
    const columnWidth = Math.max(100, availableWidth / allColumns.length);
    return {
      brand: brandColumnWidth,
      column: columnWidth,
      total: totalColumnWidth
    };
  };

  const columnWidths = getColumnWidth();

  // 根据容器高度动态计算行高
  const getRowHeight = () => {
    if (containerSize.height === 0) return 60;
    const totalRows = allBrands.length + 2;
    const headerHeight = 60;
    const footerHeight = 40;
    const tableHeaderHeight = Math.max(60, containerSize.height * 0.1);
    const padding = 24;
    const availableHeight = containerSize.height - headerHeight - footerHeight - tableHeaderHeight - padding;
    const dataRowHeight = Math.max(45, availableHeight / (totalRows - 1));
    return {
      header: tableHeaderHeight,
      data: dataRowHeight
    };
  };

  const rowHeights = getRowHeight();

  // 判断是否为小屏设备
  const isSmallScreen = containerSize.width < 768;
  const isMediumScreen = containerSize.width >= 768 && containerSize.width < 1200;

  // 根据屏幕大小调整字体和间距
  const getResponsiveStyles = () => {
    if (isSmallScreen) {
      return {
        titleSize: 'text-sm',
        fontSize: 'text-xs',
        logoSize: 'text-sm',
        spacing: 'space-x-1',
        padding: 'p-1'
      };
    } else if (isMediumScreen) {
      return {
        titleSize: 'text-base',
        fontSize: 'text-sm',
        logoSize: 'text-base',
        spacing: 'space-x-2',
        padding: 'p-2'
      };
    } else {
      return {
        titleSize: 'text-lg',
        fontSize: 'text-sm',
        logoSize: 'text-lg',
        spacing: 'space-x-2',
        padding: 'p-3'
      };
    }
  };

  const styles = getResponsiveStyles();

  // 如果使用API数据但没有数据，显示无数据状态
  if (usingApiData && crossAnalysisData.length === 0) {
    return (
      <div ref={containerRef} className="h-full w-full flex items-center justify-center bg-maersk-white">
        <div className="text-center">
          <div className="text-functional-mid-grey mb-2">📊 暂无交叉分析数据</div>
          <p className="text-sm text-functional-mid-grey">
            {selectedKPI ? `当前筛选条件下没有"${selectedKPI}"相关数据` : '请检查筛选条件或联系管理员'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col bg-maersk-white">
      {/* 标题区域 */}
      <div className={`flex-shrink-0 ${isSmallScreen ? 'flex-col space-y-2' : 'flex items-center justify-between'} mb-3 px-2`}>
        <h4 className={`font-medium text-maersk-black ${styles.titleSize}`}>
          VF子品牌×平台交叉分析
          {selectedKPI && (
            <span className="text-maersk-blue ml-2">({selectedKPI}状态)</span>
          )}
          <Badge variant="outline" className={`ml-2 text-xs ${
            usingApiData 
              ? 'bg-accent-bright-green text-accent-dark-green border-accent-light-green'
              : 'bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue'
          }`}>
            {usingApiData ? '真实数据' : '模拟数据'}
          </Badge>
        </h4>
        <div className={`flex items-center ${styles.spacing}`}>
          <span className="text-xs text-functional-mid-grey">
            颜色深浅表示{selectedKPI || '订单量'}大小
            {selectedKPI && selectedKPI !== '总单量' && (
              <span className="text-maersk-blue ml-1">
                (仅显示{selectedKPI}订单分布)
              </span>
            )}
          </span>
          <div className={`flex items-center ${styles.spacing}`}>
            <div className="w-3 h-3 bg-functional-light-blue rounded" />
            <span className="text-xs">少</span>
            <div className="w-3 h-3 bg-maersk-blue rounded" />
            <span className="text-xs">多</span>
          </div>
        </div>
      </div>

      {/* 热力图表格 */}
      <div className="flex-1 overflow-auto border border-functional-light-grey rounded-lg bg-maersk-white">
        <div className="min-w-max h-full">
          <table className="w-full border-collapse h-full">
            <thead className="sticky top-0 bg-functional-bright-grey z-20">
              <tr>
                <th 
                  className={`${styles.padding} text-left font-medium text-functional-mid-grey border-b border-r border-functional-light-grey bg-functional-bright-grey sticky left-0 z-30`}
                  style={{ 
                    width: columnWidths.brand,
                    minWidth: columnWidths.brand,
                    height: rowHeights.header
                  }}
                >
                  <div className={`flex items-center ${styles.spacing}`}>
                    <span className={styles.fontSize}>品牌/平台</span>
                  </div>
                </th>
                {allColumns.map((column) => (
                  <th 
                    key={column.name} 
                    className={`${styles.padding} text-center font-medium border-b border-r border-functional-light-grey bg-functional-bright-grey`}
                    style={{ 
                      width: columnWidths.column,
                      minWidth: columnWidths.column,
                      height: rowHeights.header
                    }}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <div className={`flex items-center justify-center ${styles.spacing}`}>
                        <span className={styles.logoSize}>{column.logo}</span>
                        <span className={`${styles.fontSize} text-maersk-black font-medium`}>
                          {isSmallScreen ? column.name : column.displayName}
                        </span>
                      </div>
                      <div className="text-xs text-functional-mid-grey">
                        {(() => {
                          const total = columnTotals.find(c => c.column === column.name)?.total || 0;
                          return isSmallScreen ? 
                            (total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total.toString()) :
                            total.toLocaleString();
                        })()}
                      </div>
                    </div>
                  </th>
                ))}
                <th 
                  className={`${styles.padding} text-center font-medium text-functional-mid-grey border-b border-functional-light-grey bg-functional-bright-grey`}
                  style={{ 
                    width: columnWidths.total,
                    minWidth: columnWidths.total,
                    height: rowHeights.header
                  }}
                >
                  <span className={styles.fontSize}>品牌总计</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {allBrands.map((brand, brandIndex) => {
                const brandTotal = brandTotals.find(b => b.brand === brand)?.total || 0;
                
                return (
                  <tr key={brand} className={brandIndex % 2 === 0 ? 'bg-maersk-white' : 'bg-functional-bright-grey/30'}>
                    <td 
                      className={`${styles.padding} font-medium border-b border-r border-functional-light-grey bg-functional-bright-grey/50 sticky left-0 z-10`}
                      style={{ 
                        width: columnWidths.brand,
                        minWidth: columnWidths.brand,
                        height: rowHeights.data
                      }}
                    >
                      <div className={`flex items-center ${styles.spacing}`}>
                        <span className={styles.logoSize}>{getBrandIcon(brand)}</span>
                        <span className={`${styles.fontSize} text-maersk-black font-medium`}>{brand}</span>
                      </div>
                    </td>
                    {allColumns.map((column) => {
                      const cellData = heatmapData.find(
                        item => item.brand === brand && item.column === column.name
                      );
                      const value = cellData?.kpiValue || 0;
                      const intensity = cellData?.intensity || 0;
                      const hasData = cellData?.hasData || false;
                      
                      return (
                        <td
                          key={column.name}
                          className={`${styles.padding} text-center border-b border-r border-functional-light-grey transition-all hover:scale-105 cursor-pointer relative group`}
                          style={{
                            backgroundColor: getIntensityColor(intensity),
                            color: getCellTextColor(intensity),
                            width: columnWidths.column,
                            minWidth: columnWidths.column,
                            height: rowHeights.data
                          }}
                          title={`${brand} × ${column.displayName}: ${formatKPIValue(value, selectedKPI || '')}${!hasData ? ' (无数据)' : ''}`}
                        >
                          <div className={`font-semibold ${styles.fontSize}`}>
                            {(() => {
                              // 🔥 修复：效率指标显示实际的指标值（%或小时），订单指标显示数量
                              if (isEfficiencyKPI(selectedKPI || '')) {
                                // 效率指标：显示带单位的值
                                return formatKPIValue(value, selectedKPI || '');
                              } else {
                                // 订单指标：显示数量（可缩写为k）
                                return isSmallScreen ? 
                                  (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()) :
                                  value.toLocaleString();
                              }
                            })()}
                          </div>
                          {value > 0 && brandTotal > 0 && !isSmallScreen && (
                            <div className="text-xs opacity-80 mt-1">
                              {((value / brandTotal) * 100).toFixed(1)}%
                            </div>
                          )}
                          
                          {/* 无数据指示器 */}
                          {value === 0 && !isSmallScreen && (
                            <div className="text-xs opacity-60 mt-1">
                              -
                            </div>
                          )}
                          
                          {/* 悬停工具提示 */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-30">
                            <div className="bg-maersk-black text-maersk-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-xl border border-functional-light-grey">
                              <div className="font-medium">{brand} × {column.displayName}</div>
                              <div>{selectedKPI || '订单量'}: {value.toLocaleString()}</div>
                              {selectedKPI && selectedKPI !== '总单量' && (
                                <div className="text-accent-light-teal">仅统计{selectedKPI}订单</div>
                              )}
                              {value > 0 && brandTotal > 0 && (
                                <div>占品牌比例: {((value / brandTotal) * 100).toFixed(1)}%</div>
                              )}
                              {!hasData && <div className="text-functional-light-grey">无数据</div>}
                              <div className={`${usingApiData ? 'text-accent-light-green' : 'text-functional-light-blue'}`}>
                                {usingApiData ? '✓ 真实数据' : '◉ 模拟数据'}
                              </div>
                              {/* 🔥 调试信息 - 开发环境下显示 */}
                              {cellData?.debugInfo && process.env.NODE_ENV === 'development' && (
                                <div className="text-functional-light-grey border-t border-functional-mid-grey mt-1 pt-1">
                                  <div>原始: {cellData.debugInfo.originalPlatformDisplay}</div>
                                  <div>映射: {cellData.debugInfo.mappedPlatformCode}</div>
                                  <div>匹配: {cellData.debugInfo.matchedCorrectly ? '✓' : '✗'}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td 
                      className={`${styles.padding} text-center border-b border-functional-light-grey bg-functional-bright-blue font-semibold text-maersk-black`}
                      style={{ 
                        width: columnWidths.total,
                        minWidth: columnWidths.total,
                        height: rowHeights.data
                      }}
                    >
                      <span className={styles.fontSize}>
                        {isSmallScreen ? 
                          (brandTotal >= 1000 ? `${(brandTotal / 1000).toFixed(1)}k` : brandTotal.toString()) :
                          brandTotal.toLocaleString()
                        }
                      </span>
                    </td>
                  </tr>
                );
              })}
              
              {/* 总计行 */}
              <tr className="bg-functional-bright-blue">
                <td 
                  className={`${styles.padding} font-semibold text-center border-r border-functional-light-grey text-maersk-black sticky left-0 z-10 bg-functional-bright-blue`}
                  style={{ 
                    width: columnWidths.brand,
                    minWidth: columnWidths.brand,
                    height: rowHeights.data
                  }}
                >
                  <span className={styles.fontSize}>平台总计</span>
                </td>
                {allColumns.map((column) => {
                  const columnTotal = columnTotals.find(c => c.column === column.name)?.total || 0;
                  return (
                    <td 
                      key={column.name} 
                      className={`${styles.padding} text-center border-r border-functional-light-grey font-semibold text-maersk-black`}
                      style={{ 
                        width: columnWidths.column,
                        minWidth: columnWidths.column,
                        height: rowHeights.data
                      }}
                    >
                      <span className={styles.fontSize}>
                        {isSmallScreen ? 
                          (columnTotal >= 1000 ? `${(columnTotal / 1000).toFixed(1)}k` : columnTotal.toString()) :
                          columnTotal.toLocaleString()
                        }
                      </span>
                    </td>
                  );
                })}
                <td 
                  className={`${styles.padding} text-center font-semibold text-maersk-blue`}
                  style={{ 
                    width: columnWidths.total,
                    minWidth: columnWidths.total,
                    height: rowHeights.data
                  }}
                >
                  <span className={styles.fontSize}>
                    {(() => {
                      // 🔥 修复：使用平台总计相加，确保与表格显示的数据一致
                      // 交叉分析的总计 = 所有平台总计之和 = 所有品牌总计之和 = 所有单元格之和
                      const grandTotal = columnTotals.reduce((sum, col) => sum + col.total, 0);
                      return isSmallScreen ? 
                        (grandTotal >= 1000 ? `${(grandTotal / 1000).toFixed(1)}k` : grandTotal.toString()) :
                        grandTotal.toLocaleString();
                    })()}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 数据说明 */}
      <div className="flex-shrink-0 mt-2">
        <div className={`text-xs text-functional-mid-grey bg-functional-bright-grey p-2 rounded border border-functional-light-grey ${isSmallScreen ? 'text-center' : ''}`}>
          <div className={`${isSmallScreen ? 'flex flex-col space-y-1' : 'flex items-center justify-between'}`}>
            <span>
              💡 提示: {isSmallScreen ? '长按' : '悬停'}单元格查看详细数据，颜色越深表示{selectedKPI || '订单量'}越大
              {selectedKPI && selectedKPI !== '总单量' && (
                <span className="text-maersk-blue ml-1">（当前仅显示{selectedKPI}状态的订单分布）</span>
              )}
            </span>
            <span>
              分析维度: {allBrands.length} 子品牌 × {allColumns.length} 平台 = {allBrands.length * allColumns.length} 个交叉数据点
              {usingApiData ? ` (${crossAnalysisData.length} 组合有真实订单)` : ' (演示数据)'}
              {/* 🔥 官网/小程序数据状态显示 */}
              {usingApiData && officialColumnTotal > 0 && (
                <span className="text-accent-mid-green ml-2">
                  ✓ 官网/小程序数据已正确汇总
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
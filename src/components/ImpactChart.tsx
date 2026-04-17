import { useState, useMemo, useEffect, useRef, type MouseEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { Package, TrendingUp, AlertTriangle, Activity, Info, ExternalLink, BarChart3 } from "lucide-react";
import { brandPlatformCrossData, platformsData, getPlatformKPIData } from "../data/platformData";
import { getAllCourierBaseExceptionRates, generateExceptionRateReport, getCourierBaseExceptionRate } from "../utils/baseExceptionRateCalculator";
import { ExceptionsRealDataCard } from "./ExceptionsRealDataCard";
import { useAuth } from "../contexts/AuthContext"; // 🔐 导入用户认证
import { ApiService } from "../services/apiService";

interface ImpactChartProps {
  selectedBrand?: string;
  selectedPlatform?: string;
  onExceptionClick?: (exceptionType: string, brand?: string, courier?: string) => void;
  // 🔥 新增：真实API数据支持
  useRealData?: boolean;
  dateRange?: { from: string; to: string };
}

// VF子品牌列表 - 基于真实API数据
const VF_SUB_BRANDS = ['TNF', 'DICKIES', 'VANS', 'TIMBERLAND', 'ICEBREAKER', 'SMARTWOOL'];

// 快递商列表 - 基于真实API数据
const COURIERS = ['ZTO', 'SF'];

// 快递商显示名称映射
const COURIER_DISPLAY_NAMES = {
  'ZTO': '中通',
  'SF': '顺丰'
};

// 简化的超时异常分类 - 包含4种基础超时异常
const EXCEPTION_TYPES = [
  { key: 'pickup_timeout', name: '超时未揽收', icon: '⏰', color: 'var(--accent-mid-orange)', description: '超过2小时未完成揽收', threshold: '2小时' },
  { key: 'shipping_timeout', name: '超时未发运', icon: '🚛', color: 'var(--accent-mid-red)', description: '超过12小时未完成发运', threshold: '12小时' },
  { key: 'shipping_no_update_48h', name: '超48h未更新', icon: '📡', color: 'var(--functional-mid-blue)', description: '超过48小时无状态更新', threshold: '48小时' },
  { key: 'delivery_timeout', name: '超时未签收', icon: '📦', color: 'var(--accent-mid-teal)', description: '超过3天未完成签收', threshold: '3天' }
];

const TOP_N_DEFAULT = 10;

interface SankeyNode {
  id: string;
  name: string;
  layer: number; // 0: 品牌, 1: 快递商, 2: 异常类型
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  icon?: string;
  clickable?: boolean;
  exceptionType?: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color: string;
  path: string;
  exceptionRate: number;
  brand?: string;
  courier?: string;
  exceptionType?: string;
}

export function ImpactChart({ 
  selectedBrand, 
  selectedPlatform, 
  onExceptionClick,
  useRealData = false,
  dateRange
}: ImpactChartProps) {
  // 🔐 获取用户权限信息
  const { user } = useAuth();
  
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [selectedExceptionType, setSelectedExceptionType] = useState<string | null>(null);
  const [flowApiData, setFlowApiData] = useState(null);
  const [flowApiLoading, setFlowApiLoading] = useState(false);
  const [flowApiError, setFlowApiError] = useState(null);
  const [showAllFlows, setShowAllFlows] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  // 🔐 计算有效品牌参数（考虑用户权限）
  const effectiveBrand = useMemo(() => {
    if (selectedBrand && selectedBrand !== 'all') {
      // 用户明确选择了某个品牌，使用该品牌
      return selectedBrand;
    }
    
    // 用户没有选择品牌（选了"all"或null），需要根据权限决定
    if (user?.isAdmin || !user?.customerNos || user.customerNos.length === 0) {
      // 管理员或没有权限限制：查询所有品牌（传null）
      return null;
    } else if (user.customerNos.length === 1) {
      // 单个品牌：直接返回字符串
      return user.customerNos[0];
    } else {
      // 多个品牌：返回数组
      return user.customerNos;
    }
  }, [selectedBrand, user?.isAdmin, user?.customerNos]);

  console.log('🔐 [ImpactChart] 品牌权限控制:', {
    selectedBrand,
    userIsAdmin: user?.isAdmin,
    userBrands: user?.customerNos,
    effectiveBrand,
    effectiveBrandType: Array.isArray(effectiveBrand) ? 'array' : typeof effectiveBrand
  });

  // 🔥 新增：获取流向分析API数据
  useEffect(() => {
    const fetchFlowAnalysisData = async () => {
      if (!useRealData || !dateRange) {
        setFlowApiData(null);
        return;
      }

      setFlowApiLoading(true);
      setFlowApiError(null);

      try {
        const data = await ApiService.getOverviewFlowAnalysis({
          dateRange,
          brand: effectiveBrand,
          platform: selectedPlatform,
          userBrands: user?.isAdmin ? undefined : user?.customerNos,
        });
        
        console.log('📊 [ImpactChart] 解析后的数据结构:', {
          success: data.success,
          hasData: !!data.data,
          flowAnalysisDataLength: data.data?.flowAnalysisData?.length,
          overallStats: data.data?.overallStats
        });
        
        if (data.success) {
          setFlowApiData(data);
          console.log('✅ [ImpactChart] 流向分析API数据获取成功:', {
            flowCombinations: data.data?.flowAnalysisData?.length || 0,
            totalOrders: data.data?.overallStats?.totalOrders || 0,
            activeBrands: data.data?.overallStats?.activeBrands || 0,
            activeCouriers: data.data?.overallStats?.activeCouriers || 0
          });
        } else {
          throw new Error(data.message || data.error || '数据获取失败');
        }
      } catch (error) {
        console.error('❌ [ImpactChart] 流向分析API数据获取失败:', error);
        
        // 根据错误类型提供更详细的错误信息
        let detailedError = error.message;
        
        if (error.message.includes('fetch')) {
          detailedError = '无法连接到后端API服务，请确保后端服务已启动 (端口3001)';
        } else if (error.message.includes('JSON') || error.message.includes('HTML')) {
          detailedError = '请检查Vite代理配置是否正确，并重启开发服务器';
        } else if (error.message.includes('404')) {
          detailedError = '流向分析API端点不存在，请检查后端路由配置';
        }
        
        setFlowApiError(detailedError);
        setFlowApiData(null);
      } finally {
        setFlowApiLoading(false);
      }
    };

    fetchFlowAnalysisData();
  }, [useRealData, dateRange, effectiveBrand, selectedPlatform]);

  // 动态计算基础异常率 - 优先使用API数据，失败时回退
  const baseExceptionRates = useMemo(() => {
    if (useRealData && flowApiData?.data?.courierSummary && !flowApiError) {
      const rates = {};
      flowApiData.data.courierSummary.forEach(courier => {
        rates[courier.courierId] = courier.avgExceptionRate / 100; // 转换为小数
      });
      console.log('📊 [ImpactChart] 使用API数据计算基础异常率:', rates);
      return rates;
    } else {
      // 回退到模拟计算
      console.log('📊 [ImpactChart] 使用模拟数据计算基础异常率');
      return getAllCourierBaseExceptionRates({
        timeWindowDays: 30,
        minOrderThreshold: 1000,
        smoothingFactor: 0.8
      });
    }
  }, [useRealData, flowApiData, flowApiError]);

  // 生成异常率报告 - 优先使用API数据，失败时回退
  const exceptionRateReport = useMemo(() => {
    if (useRealData && flowApiData?.data?.overallStats && !flowApiError) {
      const stats = flowApiData.data.overallStats;
      return {
        summary: {
          totalCouriers: stats.activeCouriers || 0,
          averageExceptionRate: stats.overallExceptionRate / 100 || 0,
          highestRiskCourier: '数据加载中',
          lowestRiskCourier: '数据加载中'
        },
        recommendations: [
          `整体异常率为${stats.overallExceptionRate}%`,
          `共分析${stats.activeBrands}个品牌×${stats.activeCouriers}个快递商组合`
        ]
      };
    } else {
      // 回退到模拟计算
      console.log('📊 [ImpactChart] 使用模拟数据生成异常率报告');
      return generateExceptionRateReport({
        timeWindowDays: 30,
        minOrderThreshold: 1000,
        smoothingFactor: 0.8
      });
    }
  }, [useRealData, flowApiData, flowApiError]);

  // 生成模拟数据的独立函数
  const generateMockSankeyData = () => {
    console.log('🔄 [ImpactChart] 使用模拟数据生成Sankey图');
    
    const data = [];
    
    VF_SUB_BRANDS.forEach(brand => {
      // 如果有品牌筛选且不匹配，跳过
      if (selectedBrand && selectedBrand !== brand) return;
      
      COURIERS.forEach(courier => {
        // 基础订单量（模拟数据）
        const baseOrders = Math.floor(Math.random() * 15000) + 10000;
        
        // 使用动态计算的基础异常率
        const baseExceptionRate = baseExceptionRates[courier] || getCourierBaseExceptionRate(courier);
        
        // 品牌影响系数
        const brandFactor = brand === 'TNF' ? 0.85 : 
                          brand === 'DICKIES' ? 1.15 : 
                          brand === 'VANS' ? 0.95 : 
                          brand === 'TIMBERLAND' ? 0.90 : 
                          brand === 'ICEBREAKER' ? 0.80 : 1.10;
        
        const totalExceptionRate = baseExceptionRate * brandFactor;
        const totalExceptionOrders = Math.floor(baseOrders * totalExceptionRate);
        const normalOrders = baseOrders - totalExceptionOrders;
        
        // 按异常类型分布 - 4种异常类型
        // 修复：确保四种异常类型都有数据，调整分布比例使其更均匀
        const exceptionDistribution = {
          pickup_timeout: courier === 'ZTO' ? 0.35 : 0.25,           // 超时未揽收：中通35%，顺丰25%
          shipping_timeout: courier === 'ZTO' ? 0.30 : 0.30,         // 超时未发运：中通30%，顺丰30%
          shipping_no_update_48h: courier === 'ZTO' ? 0.20 : 0.25,   // 超48h未更新：中通20%，顺丰25%
          delivery_timeout: courier === 'ZTO' ? 0.15 : 0.20          // 超时未签收：中通15%，顺丰20%
        };
        
        const exceptionsByType = {};
        EXCEPTION_TYPES.forEach(type => {
          exceptionsByType[type.key] = Math.floor(totalExceptionOrders * exceptionDistribution[type.key]);
        });
        
        data.push({
          brand,
          courier,
          totalOrders: baseOrders,
          normalOrders,
          totalExceptionOrders,
          totalExceptionRate: totalExceptionRate * 100,
          baseExceptionRate: baseExceptionRate * 100,
          brandFactor,
          exceptionsByType
        });
      });
    });
    
    console.log('📦 [ImpactChart] 模拟数据生成完成:', {
      recordCount: data.length,
      totalOrders: data.reduce((sum, item) => sum + item.totalOrders, 0),
      totalExceptions: data.reduce((sum, item) => sum + item.totalExceptionOrders, 0)
    });
    
    return data;
  };

  // 🔥 修复：根据数据源生成品牌×快递商×异常数据
  const generateSankeyData = () => {
    if (useRealData && flowApiData?.data?.flowAnalysisData && !flowApiError) {
      console.log('🔄 [ImpactChart] 使用真实API数据生成Sankey图');
      
      const apiFlowData = flowApiData.data.flowAnalysisData;
      console.log('📊 [ImpactChart] 原始API流向数据:', apiFlowData);
      
      // 修复：确保API数据正确映射
      const data = apiFlowData.map(item => {
        // 修复：正确处理异常数据结构
        const pickupTimeout = item.pickupTimeoutOrders || 0;
        const shippingTimeout = item.shippingTimeoutOrders || 0;
        const deliveryTimeout = item.deliveryTimeoutOrders || 0;
        const updateTimeout = item.updateTimeoutOrders || 0;
        
        const totalExceptionOrders = pickupTimeout + shippingTimeout + deliveryTimeout + updateTimeout;
        const normalOrders = Math.max(0, (item.totalOrders || 0) - totalExceptionOrders);
        const totalExceptionRate = item.totalOrders > 0 ? (totalExceptionOrders / item.totalOrders * 100) : 0;
        
        return {
          brand: item.brandName || item.brand_name || '未知品牌',
          courier: item.courierId || item.carrier_id || '未知快递商',
          totalOrders: item.totalOrders || 0,
          normalOrders: normalOrders,
          totalExceptionOrders: totalExceptionOrders,
          totalExceptionRate: totalExceptionRate,
          baseExceptionRate: totalExceptionRate,
          brandFactor: 1.0, // API数据已经是最终结果
          exceptionsByType: {
            pickup_timeout: pickupTimeout,
            shipping_timeout: shippingTimeout,
            shipping_no_update_48h: updateTimeout, // 映射48小时未更新
            delivery_timeout: deliveryTimeout
          }
        };
      });

      console.log('✅ [ImpactChart] API数据转换完成:', {
        inputRecords: apiFlowData.length,
        outputRecords: data.length,
        totalOrders: data.reduce((sum, item) => sum + item.totalOrders, 0),
        totalExceptions: data.reduce((sum, item) => sum + item.totalExceptionOrders, 0),
        sampleData: data.slice(0, 2)
      });

      // 真实数据模式下不再静默回退到模拟数据
      if (data.length === 0) {
        console.warn('⚠️ [ImpactChart] API数据转换后为空，返回空态');
        return [];
      }

      return data;
    } else {
      console.log('🔄 [ImpactChart] 使用模拟数据生成Sankey图');
      
      // 模拟数据生成逻辑（保持原有逻辑）
      const data = [];
      
      VF_SUB_BRANDS.forEach(brand => {
        // 如果有品牌筛选且不匹配，跳过
        if (selectedBrand && selectedBrand !== brand) return;
        
        COURIERS.forEach(courier => {
          // 基础订单量（模拟数据）
          const baseOrders = Math.floor(Math.random() * 15000) + 10000;
          
          // 使用动态计算的基础异常率
          const baseExceptionRate = baseExceptionRates[courier] || getCourierBaseExceptionRate(courier);
          
          // 品牌影响系数
          const brandFactor = brand === 'TNF' ? 0.85 : 
                            brand === 'DICKIES' ? 1.15 : 
                            brand === 'VANS' ? 0.95 : 
                            brand === 'TIMBERLAND' ? 0.90 : 
                            brand === 'ICEBREAKER' ? 0.80 : 1.10;
          
          const totalExceptionRate = baseExceptionRate * brandFactor;
          const totalExceptionOrders = Math.floor(baseOrders * totalExceptionRate);
          const normalOrders = baseOrders - totalExceptionOrders;
          
          // 按异常类型分布 - 4种异常类型
          // 根据快递商特性调整分布比例
          const exceptionDistribution = {
            pickup_timeout: courier === 'ZTO' ? 0.30 : 0.20,           // 超时未揽收：中通30%，顺丰20%
            shipping_timeout: courier === 'ZTO' ? 0.25 : 0.22,         // 超时未发运：中通25%，顺丰22%
            shipping_no_update_48h: courier === 'ZTO' ? 0.25 : 0.18,   // 超48h未更新：中通25%，顺丰18%
            delivery_timeout: courier === 'ZTO' ? 0.20 : 0.40          // 超时签收：中通20%，顺丰40%
          };
          
          const exceptionsByType = {};
          EXCEPTION_TYPES.forEach(type => {
            exceptionsByType[type.key] = Math.floor(totalExceptionOrders * exceptionDistribution[type.key]);
          });
          
          data.push({
            brand,
            courier,
            totalOrders: baseOrders,
            normalOrders,
            totalExceptionOrders,
            totalExceptionRate: totalExceptionRate * 100,
            baseExceptionRate: baseExceptionRate * 100,
            brandFactor,
            exceptionsByType
          });
        });
      });
      
      return data;
    }
  };

  const rawData = generateSankeyData();
  const displayedRawData = useMemo(() => {
    if (showAllFlows || rawData.length <= TOP_N_DEFAULT) {
      return rawData;
    }

    return [...rawData]
      .sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0))
      .slice(0, TOP_N_DEFAULT);
  }, [rawData, showAllFlows]);

  const densityConfig = {
    chartWidth: 1120,
    brandNodeWidth: 220,
    courierNodeWidth: 220,
    statusNodeWidth: 250,
    layerGap: 12,
    baseFlowHeight: 540,
    minBrandHeight: 30,
    minCourierHeight: 34,
    minStatusHeight: 30,
    chartMinBottom: 420,
    chartPaddingBottom: 24,
    containerMaxHClass: 'max-h-[700px]',
    minSvgWidthClass: 'min-w-[1120px]',
    clickableIconRadius: 7,
    clickableIconFontSize: 8,
    clickableIconYOffset: 15,
    labelFontSize: 11,
    valueFontSize: 9,
    valueDy: 12,
    strokeBase: 34,
    strokeMin: 2.2
  };

  // 🔥 新增：从流向分析数据中提取四种核心异常统计
  const extractExceptionsData = () => {
    if (useRealData && flowApiData?.data?.overallStats && !flowApiError) {
      // 使用API真实数据
      const stats = flowApiData.data.overallStats;
      return {
        pickupTimeout: stats.totalPickupTimeouts || 0,
        shippingTimeout: stats.totalShippingTimeouts || 0,
        deliveryTimeout: stats.totalDeliveryTimeouts || 0,
        updateTimeout: stats.totalUpdateTimeouts || 0
      };
    } else {
      // 修复：当没有流向API数据时，只显示模拟数据中确实有的异常类型
      // 避免显示虚假的异常数据，改为显示0或实际计算值
      const totals = rawData.reduce((acc, item) => ({
        pickup: acc.pickup + (item.exceptionsByType.pickup_timeout || 0),
        shipping: acc.shipping + (item.exceptionsByType.shipping_timeout || 0),
        delivery: acc.delivery + (item.exceptionsByType.delivery_timeout || 0),
        update: acc.update + (item.exceptionsByType.shipping_no_update_48h || 0)
      }), { pickup: 0, shipping: 0, delivery: 0, update: 0 });

      // 检查是否真的有异常数据，如果模拟数据中没有，则返回0
      // 避免在模拟模式下显示误导性的异常数据
      return {
        pickupTimeout: Math.max(0, totals.pickup),
        shippingTimeout: Math.max(0, totals.shipping), 
        deliveryTimeout: Math.max(0, totals.delivery),
        updateTimeout: Math.max(0, totals.update)
      };
    }
  };

  const realExceptionsData = extractExceptionsData();

  // 构建Sankey节点和链接
  const buildSankeyData = (flowData: any[]) => {
    const nodes: SankeyNode[] = [];
    const links: SankeyLink[] = [];

    // 计算各层级的总值
    const brandTotals = new Map();
    const courierTotals = new Map();
    const exceptionTypeTotals = new Map();
    let normalTotal = 0;

    flowData.forEach(item => {
      // 品牌总计
      brandTotals.set(item.brand, (brandTotals.get(item.brand) || 0) + item.totalOrders);
      // 快递商总计
      courierTotals.set(item.courier, (courierTotals.get(item.courier) || 0) + item.totalOrders);
      // 正常订单总计
      normalTotal += item.normalOrders;
      // 异常类型总计
      EXCEPTION_TYPES.forEach(type => {
        const count = item.exceptionsByType[type.key] || 0;
        exceptionTypeTotals.set(type.key, (exceptionTypeTotals.get(type.key) || 0) + count);
      });
    });

    // Ensure totalOrders is never 0 or NaN to prevent division by zero
    const totalOrders = Math.max(1, normalTotal + Array.from(exceptionTypeTotals.values()).reduce((sum, val) => sum + (val || 0), 0));
    
    // 节点与布局配置：数据量较大时通过增高画布 + 外层滚动保证可见性
    const chartWidth = densityConfig.chartWidth;
    const brandNodeWidth = densityConfig.brandNodeWidth;
    const courierNodeWidth = densityConfig.courierNodeWidth;
    const statusNodeWidth = densityConfig.statusNodeWidth;
    const layerGap = densityConfig.layerGap;
    const baseFlowHeight = densityConfig.baseFlowHeight;

    // 品牌图标
    const getBrandIcon = (brand: string) => {
      const icons = {
        'TNF': '🏔️', 'DICKIES': '👔', 'VANS': '👟',
        'TIMBERLAND': '🥾', 'ICEBREAKER': '🧊', 'KIPLING': '🎒'
      };
      return icons[brand] || '🏷️';
    };

    // 快递商图标
    const getCourierIcon = (courier: string) => {
      const icons = { 'ZTO': '🚛', 'SF': '✈️', '中通': '🚛', '顺丰': '✈️' };
      return icons[courier] || '🚚';
    };

    // 统一节点颜色 - 所有节点使用马士基蓝
    const getUnifiedNodeColor = () => {
      return 'var(--maersk-blue)';
    };

    // 创建品牌节点
    let yOffset = 12;
    const brandNodes = Array.from(brandTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([brand, total]) => {
        const height = Math.max(
          densityConfig.minBrandHeight,
          isNaN(total) || isNaN(totalOrders) || totalOrders === 0
            ? densityConfig.minBrandHeight
            : (total / totalOrders) * baseFlowHeight * 0.52
        );
        const node: SankeyNode = {
          id: `brand-${brand}`,
          name: brand,
          layer: 0,
          value: total,
          x: 24,
          y: yOffset,
          width: brandNodeWidth,
          height,
          color: getUnifiedNodeColor(),
          icon: getBrandIcon(brand)
        };
        yOffset += height + layerGap;
        return node;
      });

    // 创建快递商节点
    yOffset = 12;
    const courierNodes = Array.from(courierTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([courier, total]) => {
        const height = Math.max(
          densityConfig.minCourierHeight,
          isNaN(total) || isNaN(totalOrders) || totalOrders === 0
            ? densityConfig.minCourierHeight
            : (total / totalOrders) * baseFlowHeight * 0.45
        );
        const node: SankeyNode = {
          id: `courier-${courier}`,
          name: courier,
          layer: 1,
          value: total,
          x: 420,
          y: yOffset,
          width: courierNodeWidth,
          height,
          color: getUnifiedNodeColor(),
          icon: getCourierIcon(courier)
        };
        yOffset += height + layerGap;
        return node;
      });

    // 创建异常类型节点
    yOffset = 12;
    const exceptionNodes: SankeyNode[] = [];
    
    // 正常订单节点，确保height永远不是NaN
    const normalHeight = Math.max(
      densityConfig.minStatusHeight,
      isNaN(normalTotal) || isNaN(totalOrders) || totalOrders === 0
        ? densityConfig.minStatusHeight
        : (normalTotal / totalOrders) * baseFlowHeight * 0.45
    );
    exceptionNodes.push({
      id: 'status-normal',
      name: '正常订单',
      layer: 2,
      value: normalTotal,
      x: 820,
      y: yOffset,
      width: statusNodeWidth,
      height: normalHeight,
      color: getUnifiedNodeColor(),
      icon: '✅'
    });
    yOffset += normalHeight + layerGap;

    // 异常类型节点
    EXCEPTION_TYPES.forEach(type => {
      const total = exceptionTypeTotals.get(type.key) || 0;
      if (total > 0) {
        const height = Math.max(
          densityConfig.minStatusHeight,
          isNaN(total) || isNaN(totalOrders) || totalOrders === 0
            ? densityConfig.minStatusHeight
            : (total / totalOrders) * baseFlowHeight * 0.45
        );
        exceptionNodes.push({
          id: `exception-${type.key}`,
          name: type.name,
          layer: 2,
          value: total,
          x: 820,
          y: yOffset,
          width: statusNodeWidth,
          height,
          color: getUnifiedNodeColor(),
          icon: type.icon,
          clickable: true,
          exceptionType: type.key
        });
        yOffset += height + layerGap;
      }
    });

    nodes.push(...brandNodes, ...courierNodes, ...exceptionNodes);

    const maxBottom = Math.max(
      ...nodes.map(node => node.y + node.height),
      densityConfig.chartMinBottom
    );
    const chartHeight = maxBottom + densityConfig.chartPaddingBottom;

    // 创建链接
    flowData.forEach(item => {
      const brandNode = brandNodes.find(n => n.name === item.brand);
      const courierNode = courierNodes.find(n => n.name === item.courier);
      
      if (brandNode && courierNode) {
        // 品牌到快递商的链接 - 简化为2级风险
        // 设定10%为风险阈值
        const isRisky = item.totalExceptionRate > 10;
        const linkColor = isRisky ? 'var(--accent-light-red)' : 'var(--accent-light-green)';
        
        links.push({
          source: brandNode.id,
          target: courierNode.id,
          value: item.totalOrders,
          color: linkColor,
          path: `${item.brand}-${item.courier}`,
          exceptionRate: item.totalExceptionRate,
          brand: item.brand,
          courier: item.courier
        });

        // 快递商到正常订单的链接 - 正常订单用绿色
        if (item.normalOrders > 0) {
          links.push({
            source: courierNode.id,
            target: 'status-normal',
            value: item.normalOrders,
            color: 'var(--accent-light-green)',
            path: `${item.courier}-normal`,
            exceptionRate: 0,
            courier: item.courier
          });
        }

        // 快递商到各异常类型的链接 - 异常链接统一用红色
        EXCEPTION_TYPES.forEach(type => {
          const exceptionCount = item.exceptionsByType[type.key] || 0;
          if (exceptionCount > 0) {
            links.push({
              source: courierNode.id,
              target: `exception-${type.key}`,
              value: exceptionCount,
              color: 'var(--accent-light-red)', // 统一使用红色表示异常
              path: `${item.courier}-${type.key}`,
              exceptionRate: (exceptionCount / item.totalOrders) * 100,
              brand: item.brand,
              courier: item.courier,
              exceptionType: type.key
            });
          }
        });
      }
    });

    return { nodes, links, chartWidth, chartHeight };
  };

  const { nodes, links, chartWidth, chartHeight } = buildSankeyData(displayedRawData);

  // 统计数据
  const totalOrders = rawData.reduce((sum, item) => sum + item.totalOrders, 0);
  const totalExceptions = rawData.reduce((sum, item) => sum + item.totalExceptionOrders, 0);
  const overallExceptionRate = ((totalExceptions / totalOrders) * 100).toFixed(1);
  const chartTotalOrders = Math.max(1, displayedRawData.reduce((sum, item) => sum + item.totalOrders, 0));

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const nativeWheelHandler = (event: globalThis.WheelEvent) => {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = viewport.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const cursorX = ((event.clientX - rect.left) / rect.width) * chartWidth;
      const cursorY = ((event.clientY - rect.top) / rect.height) * chartHeight;

      const currentZoom = zoomRef.current;
      const nextZoom = Math.min(2.8, Math.max(0.6, currentZoom * (event.deltaY > 0 ? 0.92 : 1.08)));
      const ratio = nextZoom / currentZoom;
      const currentPan = panRef.current;

      const nextPan = {
        x: cursorX - (cursorX - currentPan.x) * ratio,
        y: cursorY - (cursorY - currentPan.y) * ratio
      };

      panRef.current = nextPan;
      zoomRef.current = nextZoom;
      setPan(nextPan);
      setZoom(nextZoom);
    };

    viewport.addEventListener('wheel', nativeWheelHandler, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', nativeWheelHandler);
    };
  }, [chartWidth, chartHeight]);
  
  // 🔥 修改：统计活跃快递商数量（而非品牌数量）
  const activeCouriers = [...new Set(rawData.map(item => item.courier))].length;
  
  // 🔥 修复：补充 sfData 和 ztData 的定义
  const sfData = rawData.filter(item => item.courier === 'SF');
  const ztData = rawData.filter(item => item.courier === 'ZTO');

  // 生成SVG路径
  const generatePath = (link: any) => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (!sourceNode || !targetNode) return '';

    const sourceX = sourceNode.x + sourceNode.width;
    const sourceY = sourceNode.y + sourceNode.height / 2;
    const targetX = targetNode.x;
    const targetY = targetNode.y + targetNode.height / 2;
    
    const midX = (sourceX + targetX) / 2;
    
    const strokeWidth = Math.max(densityConfig.strokeMin, (link.value / chartTotalOrders) * densityConfig.strokeBase);
    
    return {
      path: `M ${sourceX} ${sourceY} C ${midX} ${sourceY} ${midX} ${targetY} ${targetX} ${targetY}`,
      strokeWidth,
      opacity: hoveredPath && hoveredPath !== link.path ? 0.3 : 0.8
    };
  };

  // 处理异常节点点击
  const handleExceptionNodeClick = (node: SankeyNode) => {
    if (node.clickable && node.exceptionType && onExceptionClick) {
      onExceptionClick(node.exceptionType, selectedBrand, undefined);
    }
  };

  // 处理异常链接点击
  const handleExceptionLinkClick = (link: SankeyLink) => {
    if (link.exceptionType && onExceptionClick) {
      onExceptionClick(link.exceptionType, link.brand, link.courier);
    }
  };

  const handlePointerDown = (event: MouseEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setIsPanning(true);
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: MouseEvent<SVGSVGElement>) => {
    if (!isPanning || !lastPointerRef.current) return;
    const dx = event.clientX - lastPointerRef.current.x;
    const dy = event.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const stopPanning = () => {
    setIsPanning(false);
    lastPointerRef.current = null;
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // 真实模式：在拿到首个响应前显示加载态，避免先渲染模拟数据
  if (useRealData && !flowApiError && !flowApiData) {
    return (
      <Card className="maersk-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-lg font-medium text-muted-foreground mb-2">📊 加载流向分析数据...</div>
              <div className="text-sm text-muted-foreground">正在从数据库获取品牌×快递商流向数据</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (useRealData && flowApiError) {
    return (
      <Card className="maersk-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <Alert variant="destructive" className="max-w-xl">
              <AlertDescription>
                流向分析数据加载失败：{flowApiError}
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (useRealData && !flowApiLoading && !flowApiError && rawData.length === 0) {
    return (
      <Card className="maersk-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-lg font-medium text-muted-foreground mb-2">暂无流向分析数据</div>
              <div className="text-sm text-muted-foreground">当前筛选条件下没有可展示的订单流向记录</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="maersk-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center flex-wrap gap-2">
            <Package className="h-5 w-5 text-maersk-blue" />
            <span>品牌×快递承运商×异常分类流向分析</span>
            {selectedBrand && VF_SUB_BRANDS.includes(selectedBrand) && (
              <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue ml-2">
                {selectedBrand}
              </Badge>
            )}
            <Badge variant="outline" className={`ml-1 text-xs ${
              useRealData
                ? (flowApiData ? 'bg-accent-bright-green text-accent-dark-green border-accent-light-green' : 'bg-accent-bright-orange text-accent-dark-orange border-accent-light-orange')
                : 'bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue'
            }`}>
              {useRealData ? (flowApiData ? '真实数据' : '连接中...') : '模拟数据'}
            </Badge>
          </CardTitle>
          <Button variant="outline" size="sm" className="h-8" onClick={resetView}>
            重置视图
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* 统计概览 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-functional-bright-blue rounded-lg border border-functional-light-blue">
            <div className="text-2xl font-semibold text-functional-dark-blue">
              {totalOrders.toLocaleString()}
            </div>
            <div className="text-sm text-functional-mid-blue">总订单量</div>
          </div>
          
          <div className="text-center p-3 bg-accent-bright-red rounded-lg border border-accent-light-red">
            <div className="text-2xl font-semibold text-accent-dark-red">
              {overallExceptionRate}%
            </div>
            <div className="text-sm text-accent-mid-red">整体异常率</div>
          </div>
          
          <div className="text-center p-3 bg-accent-bright-teal rounded-lg border border-accent-light-teal">
            <div className="text-2xl font-semibold text-accent-dark-teal">
              {activeCouriers}
            </div>
            <div className="text-sm text-accent-mid-teal">活跃快递商</div>
          </div>
        </div>

        {/* Sankey流向图 - 响应式容器适配 */}
        <div className="bg-maersk-white p-6 rounded-lg border border-functional-light-grey">
          <div className="mb-6">
            <h4 className="font-medium text-maersk-black mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-maersk-blue" />
              订单流向与异常分类分析
             {/* <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue text-xs">
                容器适配·简化风险分级
              </Badge>*/}
            </h4>
            <p className="text-sm text-functional-mid-grey mb-4">流向线条颜色表示风险状态，线条粗细表示订单量。<strong className="text-maersk-blue ml-2">Ctrl + 滚轮缩放，按住拖拽平移，双击重置视图。</strong></p>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue">
                  当前展示 {displayedRawData.length} / {rawData.length} 条流向组合
                </Badge>
                {rawData.length > TOP_N_DEFAULT && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllFlows(prev => !prev)}
                    className="h-8"
                  >
                    {showAllFlows ? `仅显示 Top ${TOP_N_DEFAULT}` : `展开全部（+${rawData.length - displayedRawData.length}）`}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* SVG Sankey图：节点过多时支持横向/纵向滚动，避免内容裁切 */}
          <div
            ref={viewportRef}
            className={`relative w-full overflow-auto ${densityConfig.containerMaxHClass} border border-functional-light-grey rounded-md`}
          >
            <svg 
              width={chartWidth}
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className={`block ${densityConfig.minSvgWidthClass}`}
              preserveAspectRatio="xMinYMin meet"
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={stopPanning}
              onMouseLeave={stopPanning}
              onDoubleClick={resetView}
              style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            >
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {/* 绘制链接 */}
              {links.map((link, index) => {
                const pathData = generatePath(link);
                return (
                  <path
                    key={index}
                    d={pathData.path}
                    fill="none"
                    stroke={link.color}
                    strokeWidth={pathData.strokeWidth}
                    opacity={pathData.opacity}
                    className={`transition-opacity duration-200 ${link.exceptionType ? 'cursor-pointer hover:opacity-100' : ''}`}
                    onMouseEnter={() => setHoveredPath(link.path)}
                    onMouseLeave={() => setHoveredPath(null)}
                    onClick={() => link.exceptionType && handleExceptionLinkClick(link)}
                    title={link.exceptionType ? `点击查看${link.exceptionType}异常详情` : ''}
                  />
                );
              })}

              {/* 绘制节点 */}
              {nodes.map((node, index) => (
                <g key={index}>
                  {/* 节点矩形 - 大幅减小尺寸适配更小的图表 */}
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width} 
                    height={node.height}
                    fill={node.color}
                    rx={3}
                    opacity={0.9}
                    className={`${node.clickable ? 'cursor-pointer hover:opacity-100' : ''} transition-opacity`}
                    onClick={() => node.clickable && handleExceptionNodeClick(node)}
                  />
                  
                  {/* 可点击提示 */}
                  {node.clickable && (
                    <>
                      <circle
                        cx={node.x + node.width - 12}
                        cy={node.y + 10}
                        r={densityConfig.clickableIconRadius}
                        fill="var(--maersk-white)"
                        opacity={0.95}
                      />
                      <text
                        x={node.x + node.width - 12}
                        y={node.y + densityConfig.clickableIconYOffset}
                        textAnchor="middle"
                        fill="var(--functional-dark-blue)"
                        fontSize={densityConfig.clickableIconFontSize}
                        fontWeight="bold"
                      >
                        ↗
                      </text>
                    </>
                  )}
                  
                  {/* 节点标签 - 进一步缩小字体 */}
                  <text
                    x={node.x + node.width / 2}
                    y={node.y + node.height / 2 - 3}
                    textAnchor="middle"
                    fill="white"
                    fontSize={densityConfig.labelFontSize}
                    fontWeight="700"
                  >
                    {/* 品牌图标和名称在一行 */}
                    <tspan x={node.x + node.width / 2} dy="0">
                      {node.icon} {node.layer === 1 ? (COURIER_DISPLAY_NAMES[node.name] || node.name) : node.name}
                    </tspan>
                    {/* 数据在下一行，使用更小字体 */}
                    <tspan x={node.x + node.width / 2} dy={densityConfig.valueDy} fontSize={densityConfig.valueFontSize} fontWeight="600">
                      {node.value.toLocaleString()}单
                    </tspan>
                  </text>
                </g>
              ))}

              </g>


            </svg>
          </div>

          {/* 异常分类说明 */}
          <div className="mt-8 grid grid-cols-2 gap-6">
            {/* 异常类型详解 */}
            <div>
              <h5 className="text-sm font-medium text-maersk-black mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-accent-mid-red" />
                超时异常分类说明
              </h5>
              <div className="space-y-3">
                {EXCEPTION_TYPES.map(type => (
                  <div key={type.key} className="flex items-start space-x-3 p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: type.color, marginTop: '2px' }}
                    ></div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{type.icon}</span>
                        <span className="font-medium text-maersk-black">{type.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-maersk-blue hover:bg-functional-bright-blue"
                          onClick={() => onExceptionClick && onExceptionClick(type.key)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          查看监控
                        </Button>
                      </div>
                      
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 简化的风险等级说明 */}
            <div>
              <h5 className="text-sm font-medium text-maersk-black mb-3">流向风险分级</h5>
              <div className="space-y-3 mb-6">
                <div className="p-3 bg-accent-bright-green rounded-lg border border-accent-light-green">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-3 rounded" style={{ backgroundColor: 'var(--accent-light-green)' }}></div>
                    <span className="font-medium text-accent-dark-green">无风险流向</span>
                  </div>
                  <p className="text-xs text-accent-dark-green">
                    异常率 ≤ 10%，表示该品牌×快递商组合表现良好，可以优先使用
                  </p>
                </div>
                
                <div className="p-3 bg-accent-bright-red rounded-lg border border-accent-light-red">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-3 rounded" style={{ backgroundColor: 'var(--accent-light-red)' }}></div>
                    <span className="font-medium text-accent-dark-red">有风险流向</span>
                  </div>
                  <p className="text-xs text-accent-dark-red">
                    异常率 &gt; 10%，表示该品牌×快递商组合存在较高异常风险，需要重点关注
                  </p>
                </div>
              </div>

              {/* 快递商表现对比 - 基于动态计算的异常率 */}
              <div>
                <h5 className="text-sm font-medium text-maersk-black mb-3">快递商表现对比</h5>
                <div className="space-y-2">
                  {/* 🔥 动态显示所有活跃快递商的异常率对比 */}
                  {Array.from(new Set(rawData.map(item => item.courier)))
                    .sort((a, b) => {
                      // 按异常率从低到高排序
                      const aData = rawData.filter(item => item.courier === a);
                      const bData = rawData.filter(item => item.courier === b);
                      const aRate = aData.reduce((sum, item) => sum + item.totalExceptionOrders, 0) / 
                                   aData.reduce((sum, item) => sum + item.totalOrders, 0);
                      const bRate = bData.reduce((sum, item) => sum + item.totalExceptionOrders, 0) / 
                                   bData.reduce((sum, item) => sum + item.totalOrders, 0);
                      return aRate - bRate;
                    })
                    .map((courier, index) => {
                      const courierData = rawData.filter(item => item.courier === courier);
                      const totalOrders = courierData.reduce((sum, item) => sum + item.totalOrders, 0);
                      const totalExceptions = courierData.reduce((sum, item) => sum + item.totalExceptionOrders, 0);
                      const exceptionRate = (totalExceptions / totalOrders * 100).toFixed(1);
                      
                      // 根据异常率选择颜色
                      const rateValue = parseFloat(exceptionRate);
                      const colorScheme = rateValue <= 5 
                        ? { bg: 'bg-accent-bright-green', border: 'border-accent-light-green', text: 'text-accent-dark-green' }
                        : rateValue <= 10
                        ? { bg: 'bg-accent-bright-orange', border: 'border-accent-light-orange', text: 'text-accent-dark-orange' }
                        : { bg: 'bg-accent-bright-red', border: 'border-accent-light-red', text: 'text-accent-dark-red' };
                      
                      // 快递商图标
                      const courierIcon = courier === 'SF' ? '✈️' : 
                                        courier === 'ZTO' ? '🚛' : 
                                        courier === 'YTO' ? '🚚' : 
                                        courier === 'STO' ? '📦' : '🚐';
                      
                      const courierName = COURIER_DISPLAY_NAMES[courier] || courier;
                      
                      return (
                        <div key={courier} className={`flex items-center justify-between p-2 ${colorScheme.bg} rounded border ${colorScheme.border}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{courierIcon} {courierName}</span>
                            <span className="text-xs text-functional-mid-grey">({totalOrders.toLocaleString()}单)</span>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-medium ${colorScheme.text}`}>
                              {exceptionRate}% 异常率
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 关键洞察 */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
            <h5 className="font-medium text-maersk-black mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent-mid-green" />
              无风险流向组合
            </h5>
            <div className="space-y-2 text-sm">
              {rawData
                .filter(item => item.totalExceptionRate <= 10)
                .sort((a, b) => a.totalExceptionRate - b.totalExceptionRate)
                .slice(0, 4)
                .map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--accent-light-green)' }}></div>
                      <span className="text-functional-mid-grey">
                        {item.brand} → {item.courier}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-accent-mid-green font-medium text-xs">
                        {item.totalExceptionRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
            <h5 className="font-medium text-maersk-black mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-accent-mid-red" />
              有风险流向组合
            </h5>
            <div className="space-y-2 text-sm">
              {rawData
                .filter(item => item.totalExceptionRate > 10)
                .sort((a, b) => b.totalExceptionRate - a.totalExceptionRate)
                .slice(0, 4)
                .map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--accent-light-red)' }}></div>
                      <span className="text-functional-mid-grey">
                        {item.brand} → {item.courier}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-accent-mid-red font-medium text-xs">
                        {item.totalExceptionRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { AlertTriangle, CheckCircle, Clock, Package, Truck, Users, TrendingUp, TrendingDown, Activity, Filter, Download } from "lucide-react";
import { getUnifiedExceptionData, formatExceptionStatsForCourier } from "../utils/exceptionDataCalculator";
import { useAuth } from "../contexts/AuthContext";
import { exportLogisticsData } from "../utils/excelExport";
import { DataLoadingState } from "./DataLoadingState"; // 🔥 新增：统一加载状态组件

interface CourierMonitoringProps {
  selectedBrand?: string;
  selectedPlatform?: string;  // ✅ 新增：平台筛选参数
  selectedSelfFlag?: string;  // ✅ 新增：自管筛选参数
  exceptionFilter?: {
    type?: string;
    brand?: string;
    courier?: string;
  };
  useRealData?: boolean;
  rawApiData?: any;
  unifiedCourierData?: any;
  onNavigateToMonitoring?: (filter: {
    type: string;
    brand?: string;
    courier?: string;
  }) => void;
}

export function CourierMonitoring({ 
  selectedBrand,
  selectedPlatform,  // ✅ 新增：接收platform参数
  selectedSelfFlag,  // ✅ 新增：接收selfFlag参数
  exceptionFilter, 
  useRealData = false, 
  rawApiData,
  unifiedCourierData,
  onNavigateToMonitoring
}: CourierMonitoringProps) {
  // 🔥 获取用户权限信息
  const { user } = useAuth();
  
  // 🔥 品牌代码与显示名称的映射
  const BRAND_CODE_MAP: Record<string, string> = {
    '18405': 'DICKIES',
    '18405-1': 'TNF',
    '18405-2': 'ICEBREAKER',
    '18405-3': 'VANS',
    '18405-4': 'TIMBERLAND',
    '18405-5': 'SMARTWOOL'
  };
  
  // 🔥 反向映射：品牌名称 → 品牌代码
  const BRAND_NAME_TO_CODE: Record<string, string> = {
    'DICKIES': '18405',
    'TNF': '18405-1',
    'ICEBREAKER': '18405-2',
    'VANS': '18405-3',
    'TIMBERLAND': '18405-4',
    'SMARTWOOL': '18405-5'
  };
  
  // 🔥 获取用户有权查看的品牌名称列表
  const getAccessibleBrandNames = (): string[] => {
    if (user?.isAdmin) {
      // 管理员可查看所有品牌
      return Object.values(BRAND_CODE_MAP);
    } else if (user?.customerNos && user.customerNos.length > 0) {
      // 普通用户只能查看授权的品牌
      return user.customerNos
        .filter(code => BRAND_CODE_MAP[code]) // 确保品牌代码有效
        .map(code => BRAND_CODE_MAP[code]);
    }
    return [];
  };
  
  const accessibleBrandNames = getAccessibleBrandNames();
  
  console.log('🔐 [CourierMonitoring] 用户权限信息:', {
    userId: user?.userId,
    isAdmin: user?.isAdmin,
    customerNos: user?.customerNos,
    accessibleBrandNames,
    selectedBrand
  });
  
  // 如果有异常筛选，默认显示品牌维度监控
  const [activeTab, setActiveTab] = useState(() => {
    return exceptionFilter?.type ? "brand" : "courier";
  });

  // 当异常筛选条件变化时，自动切换到品牌维度
  useEffect(() => {
    if (exceptionFilter?.type) {
      setActiveTab("brand");
    }
  }, [exceptionFilter]);

  // 🔥 统一快递商数据处理 - 优先使用统一数据处理器的结果
  const getCourierDataFromAPI = () => {
    // ❌ 删除模拟数据fallback：当useRealData=false时返回空数据而非模拟数据
    if (!useRealData) {
      console.log('⚠️ [CourierMonitoring] 非实时数据模式，返回空数据');
      return { couriers: [], apiCouriers: [], noData: true };
    }

    // 🔥 优先使用统一的快递商数据
    if (unifiedCourierData && Array.isArray(unifiedCourierData) && unifiedCourierData.length > 0) {
      console.log('🎯 [CourierMonitoring] 使用统一快递商数据处理器结果');
      
      const processedCouriers = unifiedCourierData.map(unifiedCourier => {
        console.log('🔍 [CourierMonitoring] 处理统一快递商数据:', {
          name: unifiedCourier.name,
          carrierId: unifiedCourier.carrierId,
          totalOrders: unifiedCourier.total,
          dataSource: unifiedCourier.dataSource,
          pickupRate: unifiedCourier.pickupRate,
          shippingRate: unifiedCourier.shippingRate,
          deliveryRate: unifiedCourier.deliveryRate,
          exceptions: unifiedCourier.exceptions
        });
        
        // 🔥 修复：确保率值不为空且为数字
        const safePickupRate = Number(unifiedCourier.pickupRate) || 0;
        const safeShippingRate = Number(unifiedCourier.shippingRate) || 0;
        const safeDeliveryRate = Number(unifiedCourier.deliveryRate) || 0;
        const safeTotalOrders = Number(unifiedCourier.total) || 0;
        
        // 🔥 修复：统一异常数据结构
        const normalizedExceptions = {
          // 超时未揽收
          pickupTimeout: unifiedCourier.exceptions?.pickupTimeout || 
                       unifiedCourier.exceptions?.pickup_timeout || 
                       unifiedCourier.exceptions?.notPickedOver2h || 0,
          // 超时未发运  
          shippingTimeout: unifiedCourier.exceptions?.shippingTimeout || 
                          unifiedCourier.exceptions?.shipping_timeout || 
                          unifiedCourier.exceptions?.notShippedOver12h || 0,
          // 超48h未更新
          noUpdate48h: unifiedCourier.exceptions?.noUpdate48h || 
                      unifiedCourier.exceptions?.no_update_48h || 
                      unifiedCourier.exceptions?.notUpdatedOver48h || 0,
          // 超时未签收
          deliveryTimeout: unifiedCourier.exceptions?.deliveryTimeout || 
                          unifiedCourier.exceptions?.delivery_timeout || 
                          unifiedCourier.exceptions?.notDeliveredOver3days || 0
        };
        
        console.log('🔧 [CourierMonitoring] 异常数据标准化:', {
          courier: unifiedCourier.name,
          原始异常: unifiedCourier.exceptions,
          标准化异常: normalizedExceptions
        });
        
        return {
          name: unifiedCourier.name,
          carrierId: unifiedCourier.carrierId,
          picked: Math.round(safeTotalOrders * (safePickupRate / 100)),
          shipped: Math.round(safeTotalOrders * (safeShippingRate / 100)),
          delivered: Math.round(safeTotalOrders * (safeDeliveryRate / 100)),
          total: safeTotalOrders,
          pickupRate: safePickupRate,
          shippingRate: safeShippingRate,
          deliveryRate: safeDeliveryRate,
          percentage: unifiedCourier.percentage,
          exceptions: normalizedExceptions,
          dataSource: unifiedCourier.dataSource // 保留数据源信息
        };
      });

      console.log('✅ [CourierMonitoring] 统一快递商数据处理完成:', processedCouriers);
      return { couriers: processedCouriers, apiCouriers: unifiedCourierData };
    }

    // 🔥 回退逻辑：从物流API数据中获取快递商信息
    const logisticsApiResponse = rawApiData?.data?.logistics;
    if (!logisticsApiResponse) {
      console.log('⚠️ [CourierMonitoring] 无统一数据且rawApiData.data.logistics为空，返回空数据');
      return { couriers: [], apiCouriers: [], noData: true };
    }

    console.log('🔍 [CourierMonitoring] 回退到物流API快递商数据处理:', logisticsApiResponse);

    // 检查不同的API数据路径
    let apiCouriers = [];
    if (Array.isArray(logisticsApiResponse.data)) {
      apiCouriers = logisticsApiResponse.data;
      console.log('📊 [CourierMonitoring] 使用直接数组格式的物流API数据');
    } else if (logisticsApiResponse.data?.couriers) {
      apiCouriers = logisticsApiResponse.data.couriers;
      console.log('📊 [CourierMonitoring] 使用data.couriers格式的物流API数据');
    } else if (logisticsApiResponse.data?.courierStats) {
      apiCouriers = logisticsApiResponse.data.courierStats;
      console.log('📊 [CourierMonitoring] 使用data.courierStats格式的物流API数据');
    } else {
      console.log('⚠️ [CourierMonitoring] logisticsApiResponse.data结构未识别，返回空数据');
      return { couriers: [], apiCouriers: [], noData: true };
    }

    if (apiCouriers.length === 0) {
      console.log('⚠️ [CourierMonitoring] 物流API中未找到快递商数据，返回空数据');
      return { couriers: [], apiCouriers: [], noData: true };
    }

    // 快递商名称映射
    const courierNameMapping = {
      'ZTO': '中通',
      'SF': '顺丰',
      'JD': '京东',
      'EMS': '邮政EMS',
      'YTO': '圆通',
      'STO': '申通',
      'YUNDA': '韵达',
      'BEST': '百世',
      'ZJS': '宅急送',
      'HTKY': '百世汇通'
    };

    const processedCouriers = apiCouriers.map(courier => {
      const courierName = courierNameMapping[courier.carrierId] || courier.carrierId || '未知快递商';
      
      // 🔥 修复：确保率值计算正确
      const totalOrders = Number(courier.orderCount || courier.totalOrders) || 0;
      const pickedOrders = Number(courier.pickedCount || courier.pickedOrders) || 0;
      const shippedOrders = Number(courier.shippedCount || courier.shippedOrders) || 0;
      const deliveredOrders = Number(courier.deliveredCount || courier.deliveredOrders) || 0;
      
      // 计算率值
      const pickupRate = totalOrders > 0 ? Math.round((pickedOrders / totalOrders) * 100 * 100) / 100 : 0;
      const shippingRate = totalOrders > 0 ? Math.round((shippedOrders / totalOrders) * 100 * 100) / 100 : 0;
      const deliveryRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100 * 100) / 100 : 0;
      
      // 🔥 修复：统一异常数据结构映射
      const exceptions = {
        pickupTimeout: courier.pickupTimeout || courier.pickup_timeout || 0,
        shippingTimeout: courier.shippingTimeout || courier.shipping_timeout || 0,
        noUpdate48h: courier.timeout48hOrders || courier.no_update_48h || 0,
        deliveryTimeout: courier.deliveryTimeout || courier.delivery_timeout || 0
      };
      
      console.log('🔧 [CourierMonitoring] 物流API数据处理:', {
        courier: courierName,
        总订单: totalOrders,
        揽收: `${pickedOrders}(${pickupRate}%)`,
        发运: `${shippedOrders}(${shippingRate}%)`,
        签收: `${deliveredOrders}(${deliveryRate}%)`,
        异常: exceptions
      });
      
      return {
        name: courierName,
        carrierId: courier.carrierId,
        picked: pickedOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        total: totalOrders,
        pickupRate: pickupRate,
        shippingRate: shippingRate,
        deliveryRate: deliveryRate,
        exceptions: exceptions,
        dataSource: 'logistics' // 标记数据源
      };
    });

    console.log('✅ [CourierMonitoring] 回退物流API数据处理完成:', processedCouriers);
    return { couriers: processedCouriers, apiCouriers };
  };

  // 获取处理后的快递商数据
  const { couriers: processedCouriers, apiCouriers } = getCourierDataFromAPI();

  // 🔥 修复：从快递商数据计算总异常数 - 使用统一的异常字段名
  const calculateTotalExceptionsFromCouriers = () => {
    // 🔍 调试：打印每个快递商的异常数据
    console.log('🔍 [CourierMonitoring] 开始计算快递商异常总数，共', processedCouriers.length, '家快递商');
    processedCouriers.forEach(courier => {
      console.log(`🔍 [${courier.name}] 异常数据:`, courier.exceptions);
    });
    
    const result = {
      totalPickupTimeouts: processedCouriers.reduce((sum, courier) => {
        const exceptions = courier.exceptions || {};
        const value = exceptions.pickupTimeout || 
          exceptions.pickup_timeout || 
          exceptions.notPickedOver2h || 
          0;
        if (value > 0) {
          console.log(`✅ [${courier.name}] 超时未揽收: ${value}`);
        }
        return sum + value;
      }, 0),
      totalShippingTimeouts: processedCouriers.reduce((sum, courier) => {
        const exceptions = courier.exceptions || {};
        const value = exceptions.shippingTimeout || 
          exceptions.shipping_timeout || 
          exceptions.notShippedOver12h || 
          0;
        if (value > 0) {
          console.log(`✅ [${courier.name}] 超时未发运: ${value}`);
        }
        return sum + value;
      }, 0),
      totalNoUpdate48h: processedCouriers.reduce((sum, courier) => {
        const exceptions = courier.exceptions || {};
        const value = exceptions.noUpdate48h || 
          exceptions.no_update_48h || 
          exceptions.notUpdatedOver48h || 
          0;
        if (value > 0) {
          console.log(`✅ [${courier.name}] 超48h未更新: ${value}`);
        }
        return sum + value;
      }, 0),
      totalDeliveryTimeouts: processedCouriers.reduce((sum, courier) => {
        const exceptions = courier.exceptions || {};
        const value = exceptions.deliveryTimeout || 
          exceptions.delivery_timeout || 
          exceptions.notDeliveredOver3days || 
          0;
        if (value > 0) {
          console.log(`✅ [${courier.name}] 超时未签收: ${value}`);
        }
        return sum + value;
      }, 0)
    };
    
    console.log('📊 [CourierMonitoring] 异常数据汇总:', {
      ...result,
      快递商数量: processedCouriers.length,
      数据源分布: processedCouriers.reduce((acc, courier) => {
        acc[courier.dataSource] = (acc[courier.dataSource] || 0) + 1;
        return acc;
      }, {})
    });
    return result;
  };

  const {
    totalPickupTimeouts: totalDelayedPickup,
    totalShippingTimeouts: totalDelayedShipping,
    totalNoUpdate48h,
    totalDeliveryTimeouts: totalDelayedDelivery
  } = calculateTotalExceptionsFromCouriers();

  // 🔥 修复：从快递商数据计算总订单数
  const totalOrders = processedCouriers.reduce((sum, courier) => sum + courier.total, 0);

  const totalExceptions = totalDelayedPickup + totalDelayedShipping + totalNoUpdate48h + totalDelayedDelivery;
  const overallExceptionRate = totalOrders > 0 ? ((totalExceptions / totalOrders) * 100) : 0;

  console.log('📊 [CourierMonitoring] 数据汇总:', {
    useRealData,
    totalOrders,
    totalExceptions,
    overallExceptionRate: overallExceptionRate.toFixed(1) + '%',
    courierCount: processedCouriers.length,
    courierNames: processedCouriers.map(c => c.name)
  });

  // 辅助函数
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

  const getBrandColor = (brandName: string) => {
    const brandColors = {
      'TNF': {
        color: "text-accent-dark-green",
        bgColor: "bg-accent-bright-green",
        borderColor: "border-accent-light-green"
      },
      'DICKIES': {
        color: "text-accent-dark-orange",
        bgColor: "bg-accent-bright-orange",
        borderColor: "border-accent-light-orange"
      },
      'VANS': {
        color: "text-accent-dark-teal",
        bgColor: "bg-accent-bright-teal",
        borderColor: "border-accent-light-teal"
      },
      'TIMBERLAND': {
        color: "text-functional-dark-blue",
        bgColor: "bg-functional-bright-blue",
        borderColor: "border-functional-light-blue"
      },
      'ICEBREAKER': {
        color: "text-accent-dark-red",
        bgColor: "bg-accent-bright-red",
        borderColor: "border-accent-light-red"
      },
      'KIPLING': {
        color: "text-functional-dark-grey",
        bgColor: "bg-functional-bright-grey",
        borderColor: "border-functional-light-grey"
      }
    };
    return brandColors[brandName] || {
      color: "text-maersk-black",
      bgColor: "bg-functional-bright-grey",
      borderColor: "border-functional-light-grey"
    };
  };

  // 🔥 简化：移除冗余的getApiBrandData函数，统一使用getBrandLogisticsDataFromAPI
  // 🔥 临时修复：添加getApiBrandData占位符函数以避免引用错误
  const getApiBrandData = (brandName: string) => {
    console.warn('⚠️ [CourierMonitoring] getApiBrandData已弃用，请使用brandLogisticsData中的处理后数据');
    
    // 从已处理的brandLogisticsData中查找对应品牌
    const brandData = brandLogisticsData.find(brand => brand.brand === brandName);
    if (!brandData) {
      return null;
    }
    
    return {
      logistics: brandData.logistics,
      exceptions: brandData.exceptions
    };
  };

  // 🔥 修复：统一的API品牌物流数据获取函数 - 修正正确的数据访问路径
  const getBrandLogisticsDataFromAPI = () => {
    if (!useRealData) {
      console.log('⚠️ [CourierMonitoring] 非实时数据模式，使用模拟品牌数据');
      return null;
    }

    console.log('🎯 [CourierMonitoring] 检查API数据结构:', {
      hasRawApiData: !!rawApiData,
      rawApiDataKeys: rawApiData ? Object.keys(rawApiData) : 'null',
      hasBrandLogisticsData: !!(rawApiData?.brandLogisticsData),
      brandLogisticsDataSuccess: rawApiData?.brandLogisticsData?.success,
      brandLogisticsDataCount: rawApiData?.brandLogisticsData?.data?.brandExceptions?.length || 0
    });

    // 🎯 修正：正确的数据访问路径 - rawApiData.brandLogisticsData.data.brandExceptions
    if (rawApiData?.brandLogisticsData?.success && 
        rawApiData?.brandLogisticsData?.data?.brandExceptions && 
        Array.isArray(rawApiData.brandLogisticsData.data.brandExceptions)) {
      
      const brandExceptions = rawApiData.brandLogisticsData.data.brandExceptions;
      console.log('🎯 [CourierMonitoring] 找到正确的品牌物流异常数据:', brandExceptions.length, '个品牌');
      
      return brandExceptions.map((brand: any) => {
        const brandName = brand.brandName || brand.brand_name || brand.brand;
        
        // 计算物流率
        const totalOrders = brand.orderCount || brand.total_orders || 0;
        const pickedOrders = brand.pickedCount || brand.picked_count || 0;
        const shippedOrders = brand.shippedCount || brand.shipped_count || 0;
        const deliveredOrders = brand.deliveredCount || brand.delivered_count || 0;
        
        const pickupRate = totalOrders > 0 ? Math.round((pickedOrders / totalOrders) * 100 * 100) / 100 : 0;
        const shippingRate = totalOrders > 0 ? Math.round((shippedOrders / totalOrders) * 100 * 100) / 100 : 0;
        const deliveryRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100 * 100) / 100 : 0;
        
        // 🔥 关键：正确获取四种异常数据
        const exceptions = {
          pickup: brand.pickupTimeout || brand.pickup_timeout || 0,
          shipping: brand.shippingTimeout || brand.shipping_timeout || 0,
          noUpdate48h: brand.noUpdate48h || brand.no_update_48h || 0,
          delivery: brand.deliveryTimeout || brand.delivery_timeout || 0
        };
        
        console.log(`🔧 [CourierMonitoring] 处理品牌物流异常数据 ${brandName}:`, {
          totalOrders,
          pickupRate,
          shippingRate, 
          deliveryRate,
          exceptions,
          原始数据: {
            pickupTimeout: brand.pickupTimeout,
            shippingTimeout: brand.shippingTimeout,
            deliveryTimeout: brand.deliveryTimeout,
            noUpdate48h: brand.noUpdate48h
          },
          dataSource: 'brandLogisticsData接口'
        });
        
        return {
          brand: brandName,
          logo: getBrandIcon(brandName),
          ...getBrandColor(brandName),
          orderVolume: totalOrders,
          logistics: {
            pickupRate: pickupRate,
            shippingRate: shippingRate,
            deliveryRate: deliveryRate
          },
          exceptions: exceptions,
          trend: 0, // API暂不提供趋势数据
          dataSource: 'brandLogisticsData' // 标记数据源为brandLogisticsData接口
        };
      });
    }
    
    // 🎯 回退策略1：检查其他可能的数据路径
    if (rawApiData?.data?.brandLogistics?.data?.brandExceptions && Array.isArray(rawApiData.data.brandLogistics.data.brandExceptions)) {
      const brandLogisticsData = rawApiData.data.brandLogistics.data.brandExceptions;
      console.log('🎯 [CourierMonitoring] 使用回退路径1: data.brandLogistics.data.brandExceptions:', brandLogisticsData.length, '个品牌');
      
      return brandLogisticsData.map((brand: any) => {
        const brandName = brand.brandName || brand.brand_name || brand.brand;
        
        // 计算物流率
        const totalOrders = brand.orderCount || brand.total_orders || 0;
        const pickedOrders = brand.pickedCount || brand.picked_count || 0;
        const shippedOrders = brand.shippedCount || brand.shipped_count || 0;
        const deliveredOrders = brand.deliveredCount || brand.delivered_count || 0;
        
        const pickupRate = totalOrders > 0 ? Math.round((pickedOrders / totalOrders) * 100 * 100) / 100 : 0;
        const shippingRate = totalOrders > 0 ? Math.round((shippedOrders / totalOrders) * 100 * 100) / 100 : 0;
        const deliveryRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100 * 100) / 100 : 0;
        
        // 🔥 关键：从回退路径获取异常数据
        const exceptions = {
          pickup: brand.pickupTimeout || brand.pickup_timeout || 0,
          shipping: brand.shippingTimeout || brand.shipping_timeout || 0,
          noUpdate48h: brand.noUpdate48h || brand.no_update_48h || 0,
          delivery: brand.deliveryTimeout || brand.delivery_timeout || 0
        };
        
        console.log(`🔧 [CourierMonitoring] 处理回退品牌数据 ${brandName}:`, {
          totalOrders,
          pickupRate,
          shippingRate, 
          deliveryRate,
          exceptions,
          dataSource: '回退路径brandLogistics'
        });
        
        return {
          brand: brandName,
          logo: getBrandIcon(brandName),
          ...getBrandColor(brandName),
          orderVolume: totalOrders,
          logistics: {
            pickupRate: pickupRate,
            shippingRate: shippingRate,
            deliveryRate: deliveryRate
          },
          exceptions: exceptions,
          trend: 0, // API暂不提供趋势数据
          dataSource: 'logistics-brands-fallback' // 标记数据源为回退的物流品牌接口
        };
      });
    }
    
    // 🎯 回退策略2：从overview/kpi接口的brandDistribution获取基础品牌数据
    if (rawApiData?.data?.brandDistribution && Array.isArray(rawApiData.data.brandDistribution)) {
      const brandDistribution = rawApiData.data.brandDistribution;
      console.log('🎯 [CourierMonitoring] 使用回退路径2: overview/kpi 的 brandDistribution 数据:', brandDistribution.length);
      
      return brandDistribution.map((brand: any) => {
        const brandName = brand.brandName || brand.brand_name;
        
        // 计算物流率
        const totalOrders = brand.orderCount || brand.total_orders || 0;
        const pickedOrders = brand.pickedCount || brand.picked_count || 0;
        const shippedOrders = brand.shippedCount || brand.shipped_count || 0;
        const deliveredOrders = brand.deliveredCount || brand.delivered_count || 0;
        
        const pickupRate = totalOrders > 0 ? Math.round((pickedOrders / totalOrders) * 100 * 100) / 100 : 0;
        const shippingRate = totalOrders > 0 ? Math.round((shippedOrders / totalOrders) * 100 * 100) / 100 : 0;
        const deliveryRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100 * 100) / 100 : 0;
        
        // ⚠️ 警告：overview/kpi接口可能没有提供准确的品牌异常数据
        const exceptions = {
          pickup: brand.pickupTimeout || brand.pickup_timeout || 0,
          shipping: brand.shippingTimeout || brand.shipping_timeout || 0,
          noUpdate48h: brand.noUpdate48h || brand.no_update_48h || 0,
          delivery: brand.deliveryTimeout || brand.delivery_timeout || 0
        };
        
        console.warn(`⚠️ [CourierMonitoring] 使用overview/kpi品牌数据 ${brandName} - 异常数据可能不准确:`, {
          totalOrders,
          pickupRate,
          shippingRate, 
          deliveryRate,
          exceptions,
          dataSource: 'overview/kpi - 异常数据可能不完整'
        });
        
        return {
          brand: brandName,
          logo: getBrandIcon(brandName),
          ...getBrandColor(brandName),
          orderVolume: totalOrders,
          logistics: {
            pickupRate: pickupRate,
            shippingRate: shippingRate,
            deliveryRate: deliveryRate
          },
          exceptions: exceptions,
          trend: 0, // API暂不提供趋势数据
          dataSource: 'overview-kpi-fallback' // 标记数据源为回退的overview/kpi
        };
      });
    }
    
    console.log('⚠️ [CourierMonitoring] 未找到任何品牌数据，原因:', {
      useRealData,
      hasRawApiData: !!rawApiData,
      rawApiDataKeys: rawApiData ? Object.keys(rawApiData) : 'null',
      hasBrandLogisticsData: !!(rawApiData?.brandLogisticsData),
      hasDataBrandLogistics: !!(rawApiData?.data?.brandLogistics),
      hasDirectBrandDistribution: !!(rawApiData?.data?.brandDistribution),
      brandLogisticsDataSuccess: rawApiData?.brandLogisticsData?.success,
      brandLogisticsDataCount: rawApiData?.brandLogisticsData?.data?.brandExceptions?.length || 0
    });
    
    return null;
  };

  // 🔥 品牌数据处理（❌ 删除模拟数据fallback，仅使用API数据）
  const apiBrandLogisticsData = getBrandLogisticsDataFromAPI();
  // ❌ 删除：约100行的品牌模拟数据fallback
  let brandLogisticsData = apiBrandLogisticsData || [];
  
  // ❌ 删除：不需要前端二次过滤，后端已经根据用户权限返回了正确的数据
  // 🔍 调试：打印API返回的品牌数据
  console.log('🔍 [CourierMonitoring] API品牌数据:', {
    apiBrandLogisticsData: apiBrandLogisticsData,
    品牌名称列表: apiBrandLogisticsData?.map(b => b.brand) || [],
    品牌数量: apiBrandLogisticsData?.length || 0,
    数据源: apiBrandLogisticsData ? 'API' : '无数据'
  });
  
  // 🔥 应用筛选逻辑（在权限过滤之后）
  let filteredBrandData = (selectedBrand && selectedBrand !== 'all')
    ? brandLogisticsData.filter(brand => brand.brand === selectedBrand)
    : brandLogisticsData; // "all" 时显示用户有权限的所有品牌

  if (exceptionFilter?.brand) {
    filteredBrandData = brandLogisticsData.filter(brand => brand.brand === exceptionFilter.brand);
  }
  
  // 🔍 调试：打印筛选信息
  console.log('🔍 [CourierMonitoring] 品牌数据筛选:', {
    selectedBrand,
    selectedBrandIsAll: selectedBrand === 'all',
    exceptionFilterBrand: exceptionFilter?.brand,
    brandLogisticsDataCount: brandLogisticsData.length,
    brandLogisticsDataBrands: brandLogisticsData.map(b => b.brand),
    filteredBrandDataCount: filteredBrandData.length,
    filteredBrandDataBrands: filteredBrandData.map(b => b.brand),
    apiBrandLogisticsData: apiBrandLogisticsData ? 'has data' : 'null',
    useRealData
  });

  const brandOverallTimeouts = {
    totalPickupTimeouts: selectedBrand || exceptionFilter?.brand ? 
      filteredBrandData.reduce((sum, brand) => sum + brand.exceptions.pickup, 0) : 
      totalDelayedPickup,
    totalShippingTimeouts: selectedBrand || exceptionFilter?.brand ? 
      filteredBrandData.reduce((sum, brand) => sum + brand.exceptions.shipping, 0) : 
      totalDelayedShipping,
    totalNoUpdate48hTimeouts: selectedBrand || exceptionFilter?.brand ? 
      filteredBrandData.reduce((sum, brand) => sum + brand.exceptions.noUpdate48h, 0) : 
      totalNoUpdate48h,
    totalDeliveryTimeouts: selectedBrand || exceptionFilter?.brand ? 
      filteredBrandData.reduce((sum, brand) => sum + brand.exceptions.delivery, 0) : 
      totalDelayedDelivery,
    totalOrders: filteredBrandData.reduce((sum, brand) => sum + brand.orderVolume, 0)
  };

  const brandTotalExceptions = brandOverallTimeouts.totalPickupTimeouts + 
                              brandOverallTimeouts.totalShippingTimeouts + 
                              brandOverallTimeouts.totalNoUpdate48hTimeouts + 
                              brandOverallTimeouts.totalDeliveryTimeouts;
  const brandExceptionRate = brandOverallTimeouts.totalOrders > 0 ? 
    ((brandTotalExceptions / brandOverallTimeouts.totalOrders) * 100) : 0;

  console.log('📊 [CourierMonitoring] 品牌异常数据汇总:', {
    selectedBrand,
    exceptionFilter,
    品牌数量: filteredBrandData.length,
    品牌列表: filteredBrandData.map(b => b.brand),
    总异常统计: brandOverallTimeouts,
    总异常数: brandTotalExceptions,
    异常率: brandExceptionRate.toFixed(1) + '%',
    数据源: useRealData && apiBrandLogisticsData ? 'API' : '模拟'
  });

  // 异常高亮逻辑
  const isExceptionHighlighted = (exceptionType: string, brandData?: any) => {
    if (!exceptionFilter?.type) return false;
    
    const typeMatch = 
      (exceptionFilter.type === 'pickup_timeout' && exceptionType === 'pickup') ||
      (exceptionFilter.type === 'shipping_timeout' && exceptionType === 'shipping') ||
      (exceptionFilter.type === 'shipping_no_update_48h' && exceptionType === 'noUpdate48h') ||
      (exceptionFilter.type === 'delivery_timeout' && exceptionType === 'delivery');
    
    if (!typeMatch) return false;
    
    if (exceptionFilter.brand && brandData) {
      return brandData.brand === exceptionFilter.brand;
    }
    
    return true;
  };

  const getBrandCardHighlightClasses = (brandData: any) => {
    // 异常监控模式激活时的突出显示逻辑
    if (exceptionFilter?.type) {
      // 全局异常类型监控 - 检查是否有对应异常
      const hasMatchingException = 
        (exceptionFilter.type === 'pickup_timeout' && brandData.exceptions.pickup > 0) ||
        (exceptionFilter.type === 'shipping_timeout' && brandData.exceptions.shipping > 0) ||
        (exceptionFilter.type === 'shipping_no_update_48h' && brandData.exceptions.noUpdate48h > 0) ||
        (exceptionFilter.type === 'delivery_timeout' && brandData.exceptions.delivery > 0);
      
      if (hasMatchingException) {
        return 'exception-monitoring-card-focused';
      }
    }
    
    return '';
  };

  const getExceptionTypeName = (type?: string) => {
    switch (type) {
      case 'pickup_timeout': return '超时未揽收';
      case 'shipping_timeout': return '超时未发运';
      case 'shipping_no_update_48h': return '超48h未更新';
      case 'delivery_timeout': return '超时未签收';
      default: return '未知异常类型';
    }
  };

  return (
    <div className="space-y-6">
      {/* 🔥 总览统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-maersk-blue" />
              <div>
                <p className="text-sm text-functional-mid-grey">总订单</p>
                <p className="text-xl font-medium text-maersk-black">{totalOrders.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-accent-mid-orange" />
              <div>
                <p className="text-sm text-functional-mid-grey">总异常</p>
                <p className="text-xl font-medium text-accent-dark-orange">{totalExceptions.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-accent-mid-red" />
              <div>
                <p className="text-sm text-functional-mid-grey">异常率</p>
                <p className="text-xl font-medium text-accent-dark-red">{overallExceptionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Truck className="h-5 w-5 text-functional-mid-blue" />
              <div>
                <p className="text-sm text-functional-mid-grey">快递商</p>
                <p className="text-xl font-medium text-functional-dark-blue">{processedCouriers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🔥 异常类型统计 - 使用功能性亮灰色背景 */}
      <Card className="maersk-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-accent-mid-orange" />
            <span>异常类型统计</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="text-center p-3 rounded bg-accent-bright-orange">
              <div className="font-medium text-accent-dark-orange">{totalDelayedPickup}</div>
              <div className="text-accent-mid-orange">超时未揽收</div>
            </div>
            <div className="text-center p-3 rounded bg-accent-bright-red">
              <div className="font-medium text-accent-dark-red">{totalDelayedShipping}</div>
              <div className="text-accent-mid-red">超时未发运</div>
            </div>
            <div className="text-center p-3 rounded bg-functional-bright-blue">
              <div className="font-medium text-functional-dark-blue">{totalNoUpdate48h}</div>
              <div className="text-functional-mid-blue">超48h未更新</div>
            </div>
            <div className="text-center p-3 rounded bg-accent-bright-teal">
              <div className="font-medium text-accent-dark-teal">{totalDelayedDelivery}</div>
              <div className="text-accent-mid-teal">超时未签收</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 🔥 主要内容区域 - Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="courier" className="flex items-center space-x-2">
            <Truck className="h-4 w-4" />
            <span>快递商监控</span>
          </TabsTrigger>
          <TabsTrigger value="brand" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>品牌维度监控</span>
          </TabsTrigger>
        </TabsList>
        
        {/* 导出按钮 */}
        <Button 
          variant="outline" 
          size="sm"
          className="maersk-button-secondary"
          onClick={() => {
            // 准备导出数据 - 基于当前Tab
            const exportData = {
              courierData: processedCouriers.map(courier => ({ 
                courierName: courier.name,
                orderCount: courier.total || 0,
                pickedCount: courier.picked || 0,
                shippedCount: courier.shipped || 0,
                deliveredCount: courier.delivered || 0,
                forwardedCount: 0, // TODO: 添加转寄数据
                returnedCount: 0, // TODO: 添加退货数据
                cancelledCount: 0, // TODO: 添加取消数据
                exceptionCount: (courier.exceptions?.pickupTimeout || 0) + 
                                (courier.exceptions?.shippingTimeout || 0) + 
                                (courier.exceptions?.deliveryTimeout || 0) + 
                                (courier.exceptions?.noUpdate48h || 0),
                pickupTimeout: courier.exceptions?.pickupTimeout || 0,
                shippingTimeout: courier.exceptions?.shippingTimeout || 0,
                deliveryTimeout: courier.exceptions?.deliveryTimeout || 0,
                noUpdate48h: courier.exceptions?.noUpdate48h || 0,
                pickupRate: courier.pickupRate || 0,
                shippingRate: courier.shippingRate || 0,
                deliveryRate: courier.deliveryRate || 0,
                exceptionRate: courier.total > 0 
                  ? (((courier.exceptions?.pickupTimeout || 0) + 
                      (courier.exceptions?.shippingTimeout || 0) + 
                      (courier.exceptions?.deliveryTimeout || 0) + 
                      (courier.exceptions?.noUpdate48h || 0)) / courier.total) * 100
                  : 0,
                avgDeliveryTime: 0 // TODO: 添加配送时长数据
              })),
              selectedBrand: selectedBrand,
              selectedPlatform: selectedPlatform,
              selectedSelfFlag: selectedSelfFlag,
              dateRange: undefined // TODO: 从props获取dateRange
            };
            exportLogisticsData(exportData);
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          导出数据
        </Button>

        {/* 快递商监控 */}
        <TabsContent value="courier" className="space-y-4">
          <div className="grid gap-4">
            {processedCouriers.map((courier, index) => (
              <Card key={index} className="maersk-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Truck className="h-5 w-5 text-functional-mid-blue" />
                      <div>
                        <h3 className="font-medium text-maersk-black">{courier.name}</h3>
                        <p className="text-sm text-functional-mid-grey">
                          总订单: {courier.total?.toLocaleString() || 0} | 
                          占比: {courier.percentage ? courier.percentage.toFixed(1) : '0.0'}%
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="maersk-badge-secondary">
                      {courier.dataSource && courier.dataSource !== 'mock' ? 'API数据' : '模拟数据'}
                    </Badge>
                  </div>

                  {/* 物流进度 */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-sm text-functional-mid-grey">揽收率</div>
                      <div className="text-lg font-medium text-maersk-black">
                        {courier.pickupRate ? courier.pickupRate.toFixed(1) : '0.0'}%
                      </div>
                      <Progress value={courier.pickupRate || 0} className="w-full h-2 mt-1" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-functional-mid-grey">发运率</div>
                      <div className="text-lg font-medium text-maersk-black">
                        {courier.shippingRate ? courier.shippingRate.toFixed(1) : '0.0'}%
                      </div>
                      <Progress value={courier.shippingRate || 0} className="w-full h-2 mt-1" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-functional-mid-grey">签收率</div>
                      <div className="text-lg font-medium text-maersk-black">
                        {courier.deliveryRate ? courier.deliveryRate.toFixed(1) : '0.0'}%
                      </div>
                      <Progress value={courier.deliveryRate || 0} className="w-full h-2 mt-1" />
                    </div>
                  </div>

                  {/* 异常统计 - 使用功能性亮灰色背景 */}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center p-2 rounded bg-functional-bright-grey">
                      <div className="font-medium text-functional-dark-grey">{courier.exceptions.pickupTimeout || courier.exceptions.pickup_timeout || courier.exceptions.notPickedOver2h || 0}</div>
                      <div className="text-functional-mid-grey">超时未揽收</div>
                    </div>
                    <div className="text-center p-2 rounded bg-functional-bright-grey">
                      <div className="font-medium text-functional-dark-grey">{courier.exceptions.shippingTimeout || courier.exceptions.shipping_timeout || courier.exceptions.notShippedOver12h || 0}</div>
                      <div className="text-functional-mid-grey">超时未发运</div>
                    </div>
                    <div className="text-center p-2 rounded bg-functional-bright-grey">
                      <div className="font-medium text-functional-dark-grey">{courier.exceptions.noUpdate48h || courier.exceptions.no_update_48h || courier.exceptions.notUpdatedOver48h || 0}</div>
                      <div className="text-functional-mid-grey">超48h未更新</div>
                    </div>
                    <div className="text-center p-2 rounded bg-functional-bright-grey">
                      <div className="font-medium text-functional-dark-grey">{courier.exceptions.deliveryTimeout || courier.exceptions.delivery_timeout || courier.exceptions.notDeliveredOver3days || 0}</div>
                      <div className="text-functional-mid-grey">超时未签收</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 品牌维度监控 */}
        <TabsContent value="brand" className="space-y-4">
          {/* 🔔 数据源提示 */}
          {!apiBrandLogisticsData && useRealData && (
            <Alert className="maersk-alert-warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>数据来源提示：</strong> 品牌维度监控暂无实时数据（可能原因：当前筛选条件下没有订单数据，或后端接口返回为空），正在显示模拟数据供参考。
              </AlertDescription>
            </Alert>
          )}
          
          {/* 品牌卡片列表 */}
          <div className="grid gap-4">
            {filteredBrandData.length === 0 ? (
              <Card className="maersk-card">
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 text-functional-mid-grey mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-maersk-black mb-2">暂无品牌数据</h3>
                  <p className="text-sm text-functional-mid-grey mb-4">
                    {selectedBrand 
                      ? `当前筛选条件下没有找到品牌"${selectedBrand}"的数据`
                      : '当前筛选条件下没有品牌数据'}
                  </p>
                  <p className="text-xs text-functional-mid-grey">
                    提示：尝试调整日期范围或品牌筛选条件
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredBrandData.map((brand, index) => (
                <Card key={index} className={`maersk-card ${getBrandCardHighlightClasses(brand)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{brand.logo}</span>
                        <div>
                          <h3 className="font-medium text-maersk-black">{brand.brand}</h3>
                          <p className="text-sm text-functional-mid-grey">
                            总订单: {brand.orderVolume?.toLocaleString() || 0}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="maersk-badge-secondary">
                        {useRealData && apiBrandLogisticsData && apiBrandLogisticsData.length > 0 ? 'API数据' : '模拟数据'}
                      </Badge>
                    </div>

                    {/* 物流进度 */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-sm text-functional-mid-grey">揽收率</div>
                        <div className="text-lg font-medium text-maersk-black">
                          {brand.logistics.pickupRate ? brand.logistics.pickupRate.toFixed(1) : '0.0'}%
                        </div>
                        <Progress value={brand.logistics.pickupRate || 0} className="w-full h-2 mt-1" />
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-functional-mid-grey">发运率</div>
                        <div className="text-lg font-medium text-maersk-black">
                          {brand.logistics.shippingRate ? brand.logistics.shippingRate.toFixed(1) : '0.0'}%
                        </div>
                        <Progress value={brand.logistics.shippingRate || 0} className="w-full h-2 mt-1" />
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-functional-mid-grey">签收率</div>
                        <div className="text-lg font-medium text-maersk-black">
                          {brand.logistics.deliveryRate ? brand.logistics.deliveryRate.toFixed(1) : '0.0'}%
                        </div>
                        <Progress value={brand.logistics.deliveryRate || 0} className="w-full h-2 mt-1" />
                      </div>
                    </div>

                    {/* 异常统计 - 使用功能性亮灰色背景 */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className={`text-center p-2 rounded bg-functional-bright-grey ${
                          isExceptionHighlighted('pickup', brand) ? 'exception-metric-focused' : ''
                        }`}>
                        <div className="font-medium text-functional-dark-grey">{brand.exceptions.pickup || 0}</div>
                        <div className="text-functional-mid-grey">超时未揽收</div>
                      </div>
                      <div className={`text-center p-2 rounded bg-functional-bright-grey ${
                          isExceptionHighlighted('shipping', brand) ? 'exception-metric-focused' : ''
                        }`}>
                        <div className="font-medium text-functional-dark-grey">{brand.exceptions.shipping || 0}</div>
                        <div className="text-functional-mid-grey">超时未发运</div>
                      </div>
                      <div className={`text-center p-2 rounded bg-functional-bright-grey ${
                          isExceptionHighlighted('noUpdate48h', brand) ? 'exception-metric-focused' : ''
                        }`}>
                        <div className="font-medium text-functional-dark-grey">{brand.exceptions.noUpdate48h || 0}</div>
                        <div className="text-functional-mid-grey">超48h未更新</div>
                      </div>
                      <div className={`text-center p-2 rounded bg-functional-bright-grey ${
                          isExceptionHighlighted('delivery', brand) ? 'exception-metric-focused' : ''
                        }`}>
                        <div className="font-medium text-functional-dark-grey">{brand.exceptions.delivery || 0}</div>
                        <div className="text-functional-mid-grey">超时未签收</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
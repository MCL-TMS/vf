import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { AlertTriangle, CheckCircle, Clock, Package, Truck, Users, TrendingUp, TrendingDown, Activity, Filter } from "lucide-react";
import { courierData } from "../data/orderData";
import { getUnifiedExceptionData, formatExceptionStatsForCourier } from "../utils/exceptionDataCalculator";

interface CourierMonitoringProps {
  selectedBrand?: string;
  exceptionFilter?: {
    type?: string;
    brand?: string;
    courier?: string;
  };
  useRealData?: boolean;
  rawApiData?: any;
  onNavigateToMonitoring?: (filter: {
    type: string;
    brand?: string;
    courier?: string;
  }) => void;
}

export function CourierMonitoring({ 
  selectedBrand, 
  exceptionFilter, 
  useRealData = false, 
  rawApiData,
  onNavigateToMonitoring
}: CourierMonitoringProps) {
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

  // 🔥 修复：使用统一的异常数据计算工具
  const getExceptionStatsFromAPI = () => {
    const unifiedData = getUnifiedExceptionData(useRealData, rawApiData, 'CourierMonitoring');
    return formatExceptionStatsForCourier(unifiedData);
  };

  // 🔥 修复：根据您提供的API数据结构获取快递商数据
  const getCourierDataFromAPI = () => {
    if (!useRealData || !rawApiData?.data) return courierData;

    console.log('🔍 [CourierMonitoring] 开始处理API快递商数据:', rawApiData.data);

    // 检查不同的API数据路径
    let apiCouriers = [];
    if (Array.isArray(rawApiData.data)) {
      // 如果data直接是数组（您提供的API结构）
      apiCouriers = rawApiData.data;
    } else if (rawApiData.data.couriers) {
      apiCouriers = rawApiData.data.couriers;
    } else if (rawApiData.data.courierStats) {
      apiCouriers = rawApiData.data.courierStats;
    }

    if (apiCouriers.length === 0) {
      console.log('⚠️ [CourierMonitoring] 未找到快递商数据，使用模拟数据');
      return courierData;
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
      
      return {
        name: courierName,
        picked: courier.pickedOrders || 0,
        shipped: courier.shippedOrders || 0,
        delivered: courier.deliveredOrders || 0,
        total: courier.totalOrders || 0,
        pickupRate: courier.pickupRate || 0,
        shippingRate: courier.shippingRate || 0,
        deliveryRate: courier.deliveryRate || 0,
        exceptions: {
          notPickedOver2h: courier.pickupTimeout || 0,
          notShippedOver12h: courier.shippingTimeout || 0,
          notUpdatedOver48h: courier.timeout48hOrders || 0,
          notDeliveredOver3days: courier.deliveryTimeout || 0
        }
      };
    });

    console.log('✅ [CourierMonitoring] API快递商数据处理完成:', processedCouriers);
    return processedCouriers;
  };

  // 获取处理后的快递商数据
  const processedCouriers = getCourierDataFromAPI();

  // 🔥 修复：从快递商数据计算总异常数
  const calculateTotalExceptionsFromCouriers = () => {
    if (!useRealData) {
      return {
        totalPickupTimeouts: courierData.reduce((sum, courier) => sum + courier.exceptions.notPickedOver2h, 0),
        totalShippingTimeouts: courierData.reduce((sum, courier) => sum + courier.exceptions.notShippedOver12h, 0),
        totalNoUpdate48h: courierData.reduce((sum, courier) => sum + courier.exceptions.notUpdatedOver48h, 0),
        totalDeliveryTimeouts: courierData.reduce((sum, courier) => sum + courier.exceptions.notDeliveredOver3days, 0)
      };
    }

    return {
      totalPickupTimeouts: processedCouriers.reduce((sum, courier) => sum + courier.exceptions.notPickedOver2h, 0),
      totalShippingTimeouts: processedCouriers.reduce((sum, courier) => sum + courier.exceptions.notShippedOver12h, 0),
      totalNoUpdate48h: processedCouriers.reduce((sum, courier) => sum + courier.exceptions.notUpdatedOver48h, 0),
      totalDeliveryTimeouts: processedCouriers.reduce((sum, courier) => sum + courier.exceptions.notDeliveredOver3days, 0)
    };
  };

  const {
    totalPickupTimeouts: totalDelayedPickup,
    totalShippingTimeouts: totalDelayedShipping,
    totalNoUpdate48h,
    totalDeliveryTimeouts: totalDelayedDelivery
  } = calculateTotalExceptionsFromCouriers();

  // 🔥 修复：从快递商数据计算总订单数
  const totalOrders = useRealData ? 
    processedCouriers.reduce((sum, courier) => sum + courier.total, 0) :
    courierData.reduce((sum, courier) => sum + courier.delivered + courier.shipped + courier.picked, 0);

  const totalExceptions = totalDelayedPickup + totalDelayedShipping + totalNoUpdate48h + totalDelayedDelivery;
  const overallExceptionRate = totalOrders > 0 ? ((totalExceptions / totalOrders) * 100) : 0;

  console.log('📊 [CourierMonitoring] 数据汇总:', {
    useRealData,
    totalOrders,
    totalExceptions,
    overallExceptionRate: overallExceptionRate.toFixed(1) + '%',
    courierCount: processedCouriers.length
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

  // 品牌数据处理（使用模拟数据）
  const brandLogisticsData = [
    {
      brand: "TNF",
      logo: "🏔️",
      color: "text-accent-dark-green",
      bgColor: "bg-accent-bright-green",
      borderColor: "border-accent-light-green",
      orderVolume: 45820,
      logistics: {
        pickupRate: 94.2,
        shippingRate: 96.8,
        deliveryRate: 92.5
      },
      exceptions: {
        pickup: 1472,
        shipping: 1190,
        noUpdate48h: 1102,
        delivery: 1050
      },
      trend: -8.5
    },
    {
      brand: "DICKIES",
      logo: "👔",
      color: "text-accent-dark-orange",
      bgColor: "bg-accent-bright-orange",
      borderColor: "border-accent-light-orange",
      orderVolume: 38650,
      logistics: {
        pickupRate: 95.8,
        shippingRate: 94.2,
        deliveryRate: 93.7
      },
      exceptions: {
        pickup: 1140,
        shipping: 1318,
        noUpdate48h: 988,
        delivery: 1176
      },
      trend: -5.2
    },
    {
      brand: "VANS",
      logo: "👟",
      color: "text-accent-dark-teal",
      bgColor: "bg-accent-bright-teal",
      borderColor: "border-accent-light-teal",
      orderVolume: 35240,
      logistics: {
        pickupRate: 93.5,
        shippingRate: 95.6,
        deliveryRate: 94.2
      },
      exceptions: {
        pickup: 1330,
        shipping: 1063,
        noUpdate48h: 912,
        delivery: 924
      },
      trend: -3.8
    },
    {
      brand: "TIMBERLAND",
      logo: "🥾",
      color: "text-functional-dark-blue",
      bgColor: "bg-functional-bright-blue",
      borderColor: "border-functional-light-blue",
      orderVolume: 28960,
      logistics: {
        pickupRate: 96.3,
        shippingRate: 93.8,
        deliveryRate: 91.6
      },
      exceptions: {
        pickup: 855,
        shipping: 1360,
        noUpdate48h: 1178,
        delivery: 1470
      },
      trend: 2.5
    },
    {
      brand: "ICEBREAKER",
      logo: "🧊",
      color: "text-accent-dark-red",
      bgColor: "bg-accent-bright-red",
      borderColor: "border-accent-light-red",
      orderVolume: 15680,
      logistics: {
        pickupRate: 92.8,
        shippingRate: 97.2,
        deliveryRate: 95.1
      },
      exceptions: {
        pickup: 1663,
        shipping: 510,
        noUpdate48h: 684,
        delivery: 630
      },
      trend: -12.8
    }
  ];

  // 应用筛选逻辑
  let filteredBrandData = selectedBrand 
    ? brandLogisticsData.filter(brand => brand.brand === selectedBrand)
    : brandLogisticsData;

  if (exceptionFilter?.brand) {
    filteredBrandData = brandLogisticsData.filter(brand => brand.brand === exceptionFilter.brand);
  }

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
    if (exceptionFilter?.brand && brandData.brand === exceptionFilter.brand) {
      return 'brand-card-highlighted';
    }
    
    if (exceptionFilter?.type) {
      const hasMatchingException = 
        (exceptionFilter.type === 'pickup_timeout' && brandData.exceptions.pickup > 0) ||
        (exceptionFilter.type === 'shipping_timeout' && brandData.exceptions.shipping > 0) ||
        (exceptionFilter.type === 'shipping_no_update_48h' && brandData.exceptions.noUpdate48h > 0) ||
        (exceptionFilter.type === 'delivery_timeout' && brandData.exceptions.delivery > 0);
      
      if (hasMatchingException && !exceptionFilter.brand) {
        return 'brand-card-highlighted';
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
      default: return type;
    }
  };

  return (
    <Card className="maersk-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-maersk-black">
          <span>🚚</span>
          <span>物流全程监控</span>
          {selectedBrand && (
            <Badge variant="outline" className="ml-2 bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue">
              {selectedBrand}
            </Badge>
          )}
          {exceptionFilter?.type && (
            <Badge variant="outline" className="ml-2 bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange">
              <Filter className="h-3 w-3 mr-1" />
              {getExceptionTypeName(exceptionFilter.type)}
            </Badge>
          )}
          {useRealData && (
            <Badge variant="outline" className="ml-2 bg-accent-bright-green text-accent-dark-green border-accent-light-green">
              实时数据
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 全局异常率展示 */}
        <div className="mb-6 p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-maersk-black mb-1">
                {selectedBrand || exceptionFilter?.brand ? `${selectedBrand || exceptionFilter?.brand}品牌` : 'VF全品牌'}异常率统计
              </h4>
              <div className="text-sm text-functional-mid-grey">
                仅包含核心异常指标：超时未揽收、超时未发运、超48h未更新、超时未签收
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-accent-mid-red">
                {activeTab === 'brand' ? brandExceptionRate.toFixed(1) : overallExceptionRate.toFixed(1)}%
              </div>
              <div className="text-sm text-functional-mid-grey">总异常率</div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-functional-bright-grey">
            <TabsTrigger value="courier" className="flex items-center space-x-2 text-maersk-black">
              <Truck className="h-4 w-4" />
              <span>快递公司监控</span>
            </TabsTrigger>
            <TabsTrigger 
              value="brand" 
              className={`flex items-center space-x-2 text-maersk-black ${
                exceptionFilter?.type ? 'bg-accent-bright-orange border-accent-mid-orange' : ''
              }`}
            >
              <Users className="h-4 w-4" />
              <span>品牌维度监控</span>
              {exceptionFilter?.type && (
                <AlertTriangle className="h-3 w-3 text-accent-mid-orange" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* 快递公司维度监控 */}
          <TabsContent value="courier" className="space-y-4">
            {/* 总体异常提醒 - 四个核心异常指标 */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="flex items-center justify-between p-3 bg-accent-bright-orange rounded-lg transition-all duration-200 hover:shadow-sm">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-accent-mid-orange" />
                  <span className="text-sm text-accent-dark-orange">超时未揽收</span>
                </div>
                <span className="text-lg font-semibold text-accent-dark-orange">{totalDelayedPickup}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-accent-bright-red rounded-lg transition-all duration-200 hover:shadow-sm">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-accent-mid-red" />
                  <span className="text-sm text-accent-dark-red">超时未发运</span>
                </div>
                <span className="text-lg font-semibold text-accent-dark-red">{totalDelayedShipping}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-functional-bright-blue rounded-lg transition-all duration-200 hover:shadow-sm">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-functional-mid-blue" />
                  <span className="text-sm text-functional-dark-blue">超48h未更新</span>
                </div>
                <span className="text-lg font-semibold text-functional-dark-blue">{totalNoUpdate48h}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-accent-bright-teal rounded-lg transition-all duration-200 hover:shadow-sm">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-accent-mid-teal" />
                  <span className="text-sm text-accent-dark-teal">超时未签收</span>
                </div>
                <span className="text-lg font-semibold text-accent-dark-teal">{totalDelayedDelivery}</span>
              </div>
            </div>
            
            {/* 快递公司详情 */}
            <div className="space-y-3">
              {processedCouriers.map((courier, index) => (
                <Card key={courier.name || index} className="maersk-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-maersk-blue rounded-full"></div>
                        <h4 className="font-medium text-maersk-black">{courier.name}</h4>
                        <Badge variant="outline" className="maersk-badge-secondary">
                          {courier.total?.toLocaleString()} 单
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-lg font-semibold text-maersk-black">
                            {courier.deliveryRate?.toFixed(1)}%
                          </div>
                          <div className="text-xs text-functional-mid-grey">签收率</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-sm font-medium text-accent-dark-green">
                          {courier.pickupRate?.toFixed(1)}%
                        </div>
                        <Progress value={courier.pickupRate} className="h-2 mb-1" />
                        <div className="text-xs text-functional-mid-grey">揽收率</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-functional-dark-blue">
                          {courier.shippingRate?.toFixed(1)}%
                        </div>
                        <Progress value={courier.shippingRate} className="h-2 mb-1" />
                        <div className="text-xs text-functional-mid-grey">发运率</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-accent-dark-teal">
                          {courier.deliveryRate?.toFixed(1)}%
                        </div>
                        <Progress value={courier.deliveryRate} className="h-2 mb-1" />
                        <div className="text-xs text-functional-mid-grey">签收率</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center p-2 rounded bg-accent-bright-orange">
                        <div className="font-medium text-accent-dark-orange">{courier.exceptions.notPickedOver2h}</div>
                        <div className="text-accent-mid-orange">超时未揽收</div>
                      </div>
                      <div className="text-center p-2 rounded bg-accent-bright-red">
                        <div className="font-medium text-accent-dark-red">{courier.exceptions.notShippedOver12h}</div>
                        <div className="text-accent-mid-red">超时未发运</div>
                      </div>
                      <div className="text-center p-2 rounded bg-functional-bright-blue">
                        <div className="font-medium text-functional-dark-blue">{courier.exceptions.notUpdatedOver48h}</div>
                        <div className="text-functional-mid-blue">超48h未更新</div>
                      </div>
                      <div className="text-center p-2 rounded bg-accent-bright-teal">
                        <div className="font-medium text-accent-dark-teal">{courier.exceptions.notDeliveredOver3days}</div>
                        <div className="text-accent-mid-teal">超时未签收</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 品牌维度监控 */}
          <TabsContent value="brand" className="space-y-4">
            {/* 品牌总体异常提醒 - 四个核心异常指标 */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:shadow-sm ${
                isExceptionHighlighted('pickup') ? 
                'bg-accent-bright-orange border border-accent-mid-orange shadow-md' : 
                'bg-accent-bright-orange'
              }`}>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-accent-mid-orange" />
                  <span className="text-sm text-accent-dark-orange">超时未揽收</span>
                </div>
                <span className="text-lg font-semibold text-accent-dark-orange">{brandOverallTimeouts.totalPickupTimeouts}</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:shadow-sm ${
                isExceptionHighlighted('shipping') ? 
                'bg-accent-bright-orange border border-accent-mid-orange shadow-md' : 
                'bg-accent-bright-red'
              }`}>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-accent-mid-red" />
                  <span className="text-sm text-accent-dark-red">超时未发运</span>
                </div>
                <span className="text-lg font-semibold text-accent-dark-red">{brandOverallTimeouts.totalShippingTimeouts}</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:shadow-sm ${
                isExceptionHighlighted('noUpdate48h') ? 
                'bg-accent-bright-orange border border-accent-mid-orange shadow-md' : 
                'bg-functional-bright-blue'
              }`}>
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-functional-mid-blue" />
                  <span className="text-sm text-functional-dark-blue">超48h未更新</span>
                </div>
                <span className="text-lg font-semibold text-functional-dark-blue">{brandOverallTimeouts.totalNoUpdate48hTimeouts}</span>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:shadow-sm ${
                isExceptionHighlighted('delivery') ? 
                'bg-accent-bright-orange border border-accent-mid-orange shadow-md' : 
                'bg-accent-bright-teal'
              }`}>
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-accent-mid-teal" />
                  <span className="text-sm text-accent-dark-teal">超时未签收</span>
                </div>
                <span className="text-lg font-semibold text-accent-dark-teal">{brandOverallTimeouts.totalDeliveryTimeouts}</span>
              </div>
            </div>

            {/* 品牌详情 */}
            <div className="space-y-3">
              {filteredBrandData.map((brand, index) => (
                <Card key={brand.brand || index} className={`maersk-card transition-all duration-200 ${getBrandCardHighlightClasses(brand)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{brand.logo}</span>
                        <h4 className="font-medium text-maersk-black">{brand.brand}</h4>
                        <Badge variant="outline" className="maersk-badge-secondary">
                          {brand.orderVolume?.toLocaleString()} 单
                        </Badge>
                        {brand.trend !== undefined && (
                          <Badge variant="outline" className={`text-xs ${
                            brand.trend > 0 ? 'text-accent-dark-green' : brand.trend < 0 ? 'text-accent-dark-red' : 'text-functional-dark-grey'
                          }`}>
                            {brand.trend > 0 ? '↗' : brand.trend < 0 ? '↘' : '→'} {Math.abs(brand.trend).toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-sm font-medium text-accent-dark-green">
                          {brand.logistics.pickupRate?.toFixed(1)}%
                        </div>
                        <Progress value={brand.logistics.pickupRate} className="h-2 mb-1" />
                        <div className="text-xs text-functional-mid-grey">揽收率</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-functional-dark-blue">
                          {brand.logistics.shippingRate?.toFixed(1)}%
                        </div>
                        <Progress value={brand.logistics.shippingRate} className="h-2 mb-1" />
                        <div className="text-xs text-functional-mid-grey">发运率</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-accent-dark-teal">
                          {brand.logistics.deliveryRate?.toFixed(1)}%
                        </div>
                        <Progress value={brand.logistics.deliveryRate} className="h-2 mb-1" />
                        <div className="text-xs text-functional-mid-grey">签收率</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className={`text-center p-2 rounded transition-all duration-200 ${
                        isExceptionHighlighted('pickup', brand) ? 
                        'bg-accent-bright-orange border border-accent-mid-orange shadow-md' : 
                        'bg-functional-bright-grey border border-functional-light-grey hover:shadow-sm'
                      }`}>
                        <div className="font-medium text-maersk-black">
                          {brand.exceptions.pickup}
                        </div>
                        <div className="text-functional-mid-grey">
                          超时未揽收
                        </div>
                      </div>
                      <div className={`text-center p-2 rounded transition-all duration-200 ${
                        isExceptionHighlighted('shipping', brand) ? 
                        'bg-accent-bright-orange border border-accent-mid-orange shadow-md' : 
                        'bg-functional-bright-grey border border-functional-light-grey hover:shadow-sm'
                      }`}>
                        <div className="font-medium text-maersk-black">
                          {brand.exceptions.shipping}
                        </div>
                        <div className="text-functional-mid-grey">
                          超时未发运
                        </div>
                      </div>
                      <div className={`text-center p-2 rounded transition-all duration-200 ${
                        isExceptionHighlighted('noUpdate48h', brand) ? 
                        'bg-accent-bright-orange border border-accent-mid-orange shadow-md' : 
                        'bg-functional-bright-grey border border-functional-light-grey hover:shadow-sm'
                      }`}>
                        <div className="font-medium text-maersk-black">
                          {brand.exceptions.noUpdate48h}
                        </div>
                        <div className="text-functional-mid-grey">
                          超48h未更新
                        </div>
                      </div>
                      <div className={`text-center p-2 rounded transition-all duration-200 ${
                        isExceptionHighlighted('delivery', brand) ? 
                        'bg-accent-bright-orange border border-accent-mid-orange shadow-md' : 
                        'bg-functional-bright-grey border border-functional-light-grey hover:shadow-sm'
                      }`}>
                        <div className="font-medium text-maersk-black">
                          {brand.exceptions.delivery}
                        </div>
                        <div className="text-functional-mid-grey">
                          超时未签收
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
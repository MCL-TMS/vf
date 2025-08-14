import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription } from "./ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { AlertTriangle, CheckCircle, Clock, Package, Truck, Users, TrendingUp, TrendingDown, Activity, Filter } from "lucide-react";
import { courierData } from "../data/orderData";

interface CourierMonitoringProps {
  selectedBrand?: string;
  exceptionFilter?: {
    type?: string;
    brand?: string;
    courier?: string;
  };
}

export function CourierMonitoring({ selectedBrand, exceptionFilter }: CourierMonitoringProps) {
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

  // 计算总异常数量
  const totalDelayedPickup = courierData.reduce((sum, courier) => sum + courier.exceptions.notPickedOver2h, 0);
  const totalDelayedShipping = courierData.reduce((sum, courier) => sum + courier.exceptions.notShippedOver12h, 0);
  const totalNoUpdate48h = courierData.reduce((sum, courier) => sum + courier.exceptions.notUpdatedOver48h, 0);
  const totalDelayedDelivery = courierData.reduce((sum, courier) => sum + courier.exceptions.notDeliveredOver3days, 0);

  // 简化的品牌物流数据
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
        pickup: Math.round(totalDelayedPickup * 0.31),
        shipping: Math.round(totalDelayedShipping * 0.28),
        noUpdate48h: Math.round(totalNoUpdate48h * 0.29),
        delivery: Math.round(totalDelayedDelivery * 0.25)
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
        pickup: Math.round(totalDelayedPickup * 0.24),
        shipping: Math.round(totalDelayedShipping * 0.31),
        noUpdate48h: Math.round(totalNoUpdate48h * 0.26),
        delivery: Math.round(totalDelayedDelivery * 0.28)
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
        pickup: Math.round(totalDelayedPickup * 0.28),
        shipping: Math.round(totalDelayedShipping * 0.25),
        noUpdate48h: Math.round(totalNoUpdate48h * 0.24),
        delivery: Math.round(totalDelayedDelivery * 0.22)
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
        pickup: Math.round(totalDelayedPickup * 0.18),
        shipping: Math.round(totalDelayedShipping * 0.32),
        noUpdate48h: Math.round(totalNoUpdate48h * 0.31),
        delivery: Math.round(totalDelayedDelivery * 0.35)
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
        pickup: Math.round(totalDelayedPickup * 0.35),
        shipping: Math.round(totalDelayedShipping * 0.12),
        noUpdate48h: Math.round(totalNoUpdate48h * 0.18),
        delivery: Math.round(totalDelayedDelivery * 0.15)
      },
      trend: -12.8
    },
    {
      brand: "KIPLING",
      logo: "🎒",
      color: "text-functional-dark-grey",
      bgColor: "bg-functional-bright-grey",
      borderColor: "border-functional-light-grey",
      orderVolume: 12450,
      logistics: {
        pickupRate: 94.7,
        shippingRate: 92.5,
        deliveryRate: 96.3
      },
      exceptions: {
        pickup: Math.round(totalDelayedPickup * 0.22),
        shipping: Math.round(totalDelayedShipping * 0.38),
        noUpdate48h: Math.round(totalNoUpdate48h * 0.35),
        delivery: Math.round(totalDelayedDelivery * 0.08)
      },
      trend: -6.8
    }
  ];

  // 应用筛选逻辑
  let filteredBrandData = selectedBrand 
    ? brandLogisticsData.filter(brand => brand.brand === selectedBrand)
    : brandLogisticsData;

  // 如果有异常筛选中的品牌，进一步筛选
  if (exceptionFilter?.brand) {
    filteredBrandData = brandLogisticsData.filter(brand => brand.brand === exceptionFilter.brand);
  }

  // 计算品牌总体超时统计
  const brandOverallTimeouts = {
    totalPickupTimeouts: filteredBrandData.reduce((sum, brand) => sum + brand.exceptions.pickup, 0),
    totalShippingTimeouts: filteredBrandData.reduce((sum, brand) => sum + brand.exceptions.shipping, 0),
    totalNoUpdate48hTimeouts: filteredBrandData.reduce((sum, brand) => sum + brand.exceptions.noUpdate48h, 0),
    totalDeliveryTimeouts: filteredBrandData.reduce((sum, brand) => sum + brand.exceptions.delivery, 0),
    totalOrders: filteredBrandData.reduce((sum, brand) => sum + brand.orderVolume, 0)
  };

  // 根据异常类型高亮显示相关数据
  const isExceptionHighlighted = (exceptionType: string, brandData?: any) => {
    if (!exceptionFilter?.type) return false;
    
    // 检查异常类型是否匹配
    const typeMatch = 
      (exceptionFilter.type === 'pickup_timeout' && exceptionType === 'pickup') ||
      (exceptionFilter.type === 'shipping_timeout' && exceptionType === 'shipping') ||
      (exceptionFilter.type === 'shipping_no_update_48h' && exceptionType === 'noUpdate48h') ||
      (exceptionFilter.type === 'delivery_timeout' && exceptionType === 'delivery');
    
    if (!typeMatch) return false;
    
    // 如果有品牌筛选，检查品牌是否匹配
    if (exceptionFilter.brand && brandData) {
      return brandData.brand === exceptionFilter.brand;
    }
    
    return true;
  };

  // 获取异常类型的显示名称
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
        </CardTitle>
      </CardHeader>
      <CardContent>
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
            {/* 总体异常提醒 - 紧凑卡片形式 */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="flex items-center justify-between p-3 bg-accent-bright-orange border border-accent-light-orange rounded-lg">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-accent-mid-orange" />
                  <span className="text-sm text-accent-dark-orange">超时未揽收</span>
                </div>
                <span className="text-lg font-semibold text-accent-dark-orange">{totalDelayedPickup}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-accent-bright-red border border-accent-light-red rounded-lg">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-accent-mid-red" />
                  <span className="text-sm text-accent-dark-red">超时未发运</span>
                </div>
                <span className="text-lg font-semibold text-accent-dark-red">{totalDelayedShipping}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-functional-bright-blue border border-functional-light-blue rounded-lg">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-functional-mid-blue" />
                  <span className="text-sm text-functional-dark-blue">超48h未更新</span>
                </div>
                <span className="text-lg font-semibold text-functional-dark-blue">{totalNoUpdate48h}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-accent-bright-teal border border-accent-light-teal rounded-lg">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-accent-mid-teal" />
                  <span className="text-sm text-accent-dark-teal">超时未签收</span>
                </div>
                <span className="text-lg font-semibold text-accent-dark-teal">{totalDelayedDelivery}</span>
              </div>
            </div>
            
            {/* 快递公司详情 */}
            <div className="space-y-3">
              {courierData.map((courier, index) => {
                // 检查快递商是否匹配异常筛选
                const isHighlighted = exceptionFilter?.courier === courier.name;
                
                return (
                  <div 
                    key={index} 
                    className={`border ${isHighlighted ? 'border-accent-mid-orange bg-accent-bright-orange' : 'border-functional-light-grey'} rounded-lg p-3 space-y-3 hover:bg-functional-bright-grey transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">
                          {courier.name === '顺丰' ? '🚀' : '🚚'}
                        </span>
                        <h4 className="font-medium text-maersk-black">{courier.name}</h4>
                        <span className="text-xs text-functional-mid-grey">
                          {courier.name === '顺丰' ? '高端时效' : '性价比优'}
                        </span>
                        {isHighlighted && (
                          <Badge variant="outline" className="bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange text-xs">
                            筛选匹配
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={courier.pickupRate >= 95 ? "default" : "destructive"}>
                          揽收率 {courier.pickupRate}%
                        </Badge>
                        <Badge variant={courier.shippingRate >= 95 ? "default" : "destructive"}>
                          发运率 {courier.shippingRate}%
                        </Badge>
                        <Badge variant={courier.deliveryRate >= 95 ? "default" : "destructive"}>
                          签收率 {courier.deliveryRate}%
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-functional-mid-grey">已揽收</span>
                          <span className="text-maersk-black">{courier.picked.toLocaleString()}</span>
                        </div>
                        <Progress value={courier.pickupRate} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-functional-mid-grey">已发运</span>
                          <span className="text-maersk-black">{courier.shipped.toLocaleString()}</span>
                        </div>
                        <Progress value={courier.shippingRate} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-functional-mid-grey">已签收</span>
                          <span className="text-maersk-black">{courier.delivered.toLocaleString()}</span>
                        </div>
                        <Progress value={courier.deliveryRate} className="h-2" />
                      </div>
                    </div>
                    
                    {/* 异常监控 */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className={`flex items-center space-x-1 ${
                        exceptionFilter?.type === 'pickup_timeout' && isHighlighted ? 'bg-accent-bright-red p-2 rounded' : ''
                      }`}>
                        <Clock className="h-3 w-3 text-accent-mid-orange" />
                        <span className="text-functional-mid-grey truncate">超时未揽收:</span>
                        <Badge variant="outline" className="text-xs">
                          {courier.exceptions.notPickedOver2h}
                        </Badge>
                      </div>
                      <div className={`flex items-center space-x-1 ${
                        exceptionFilter?.type === 'shipping_timeout' && isHighlighted ? 'bg-accent-bright-red p-2 rounded' : ''
                      }`}>
                        <Clock className="h-3 w-3 text-accent-mid-red" />
                        <span className="text-functional-mid-grey truncate">超时未发运:</span>
                        <Badge variant="outline" className="text-xs">
                          {courier.exceptions.notShippedOver12h}
                        </Badge>
                      </div>
                      <div className={`flex items-center space-x-1 ${
                        exceptionFilter?.type === 'shipping_no_update_48h' && isHighlighted ? 'bg-accent-bright-red p-2 rounded' : ''
                      }`}>
                        <Activity className="h-3 w-3 text-functional-mid-blue" />
                        <span className="text-functional-mid-grey truncate">超48h未更新:</span>
                        <Badge variant="outline" className="text-xs">
                          {courier.exceptions.notUpdatedOver48h}
                        </Badge>
                      </div>
                      <div className={`flex items-center space-x-1 ${
                        exceptionFilter?.type === 'delivery_timeout' && isHighlighted ? 'bg-accent-bright-red p-2 rounded' : ''
                      }`}>
                        <Package className="h-3 w-3 text-accent-mid-teal" />
                        <span className="text-functional-mid-grey truncate">超时未签收:</span>
                        <Badge variant="outline" className="text-xs">
                          {courier.exceptions.notDeliveredOver3days}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>


          </TabsContent>

          {/* 品牌维度监控 - 增强版 */}
          <TabsContent value="brand" className="space-y-4">
            {/* 异常监控聚焦说明 */}
            {exceptionFilter?.type && (
              <div className="mb-4 p-3 bg-accent-bright-orange border border-accent-light-orange rounded-lg">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-accent-mid-orange" />
                  <div className="text-sm">
                    <strong className="text-accent-dark-orange">
                      异常监控聚焦: {getExceptionTypeName(exceptionFilter.type)}
                    </strong>
                    {exceptionFilter.brand && (
                      <span className="ml-2 text-accent-dark-orange">({exceptionFilter.brand}品牌)</span>
                    )}
                    {exceptionFilter.courier && (
                      <span className="ml-2 text-accent-dark-orange">({exceptionFilter.courier}快递)</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 品牌总体异常统计 - 紧凑卡片形式 */}
            <div className="mb-4">
              <div className="text-sm text-functional-mid-grey mb-3">
                {selectedBrand || exceptionFilter?.brand ? `${selectedBrand || exceptionFilter?.brand}品牌` : 'VF全品牌'}当前异常统计：
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="flex items-center justify-between p-3 bg-accent-bright-orange border border-accent-light-orange rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-accent-mid-orange" />
                    <span className="text-sm text-accent-dark-orange">超时未揽收</span>
                  </div>
                  <span className="text-lg font-semibold text-accent-dark-orange">{brandOverallTimeouts.totalPickupTimeouts}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-accent-bright-red border border-accent-light-red rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-accent-mid-red" />
                    <span className="text-sm text-accent-dark-red">超时未发运</span>
                  </div>
                  <span className="text-lg font-semibold text-accent-dark-red">{brandOverallTimeouts.totalShippingTimeouts}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-functional-bright-blue border border-functional-light-blue rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-functional-mid-blue" />
                    <span className="text-sm text-functional-dark-blue">超48h未更新</span>
                  </div>
                  <span className="text-lg font-semibold text-functional-dark-blue">{brandOverallTimeouts.totalNoUpdate48hTimeouts}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-accent-bright-teal border border-accent-light-teal rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Package className="h-4 w-4 text-accent-mid-teal" />
                    <span className="text-sm text-accent-dark-teal">超时未签收</span>
                  </div>
                  <span className="text-lg font-semibold text-accent-dark-teal">{brandOverallTimeouts.totalDeliveryTimeouts}</span>
                </div>
              </div>
            </div>

            {/* 增强的品牌监控卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBrandData.map((brand, index) => {
                // 检查品牌是否匹配异常筛选
                const isBrandHighlighted = exceptionFilter?.brand === brand.brand || (!exceptionFilter?.brand && exceptionFilter?.type);
                
                return (
                  <div 
                    key={index} 
                    className={`border ${isBrandHighlighted ? 'border-accent-mid-orange' : brand.borderColor} rounded-lg p-4 space-y-3 ${
                      isBrandHighlighted ? 'bg-accent-bright-orange bg-opacity-30' : `hover:${brand.bgColor} hover:bg-opacity-30`
                    } transition-colors`}
                  >
                    {/* 品牌头部信息 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-6 h-6 ${brand.bgColor} rounded-full flex items-center justify-center border ${brand.borderColor}`}>
                          <span className="text-sm">{brand.logo}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-maersk-black">{brand.brand}</h4>
                          <div className="text-xs text-functional-mid-grey">
                            {brand.orderVolume.toLocaleString()} 单
                          </div>
                        </div>
                        {isBrandHighlighted && exceptionFilter?.type && (
                          <Badge variant="outline" className="bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange text-xs">
                            异常关注
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-functional-mid-grey">异常趋势:</span>
                        <div className={`flex items-center ${brand.trend >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                          {brand.trend >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span className="text-xs ml-1">{Math.abs(brand.trend).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* 物流KPI */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-sm font-medium text-maersk-black">{brand.logistics.pickupRate}%</div>
                        <div className="text-functional-mid-grey">揽收率</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-maersk-black">{brand.logistics.shippingRate}%</div>
                        <div className="text-functional-mid-grey">发运率</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-maersk-black">{brand.logistics.deliveryRate}%</div>
                        <div className="text-functional-mid-grey">签收率</div>
                      </div>
                    </div>

                    {/* 异常统计 - 根据筛选条件高亮显示 */}
                    <div className="border-t border-functional-light-grey pt-2">
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className={`text-center ${
                          isExceptionHighlighted('pickup', brand) ? 'bg-accent-bright-red p-2 rounded-lg border border-accent-light-red' : ''
                        }`}>
                          <div className="flex items-center justify-center space-x-1">
                            <Clock className="h-3 w-3 text-accent-mid-orange" />
                            <span className="font-medium text-accent-mid-orange">{brand.exceptions.pickup}</span>
                          </div>
                          <div className="text-functional-mid-grey mt-1">超时未揽收</div>
                          {isExceptionHighlighted('pickup', brand) && (
                            <div className="text-xs text-accent-dark-red mt-1">
                              ⚠️ 异常聚焦
                            </div>
                          )}
                        </div>
                        <div className={`text-center ${
                          isExceptionHighlighted('shipping', brand) ? 'bg-accent-bright-red p-2 rounded-lg border border-accent-light-red' : ''
                        }`}>
                          <div className="flex items-center justify-center space-x-1">
                            <Clock className="h-3 w-3 text-accent-mid-red" />
                            <span className="font-medium text-accent-mid-red">{brand.exceptions.shipping}</span>
                          </div>
                          <div className="text-functional-mid-grey mt-1">超时未发运</div>
                          {isExceptionHighlighted('shipping', brand) && (
                            <div className="text-xs text-accent-dark-red mt-1">
                              ⚠️ 异常聚焦
                            </div>
                          )}
                        </div>
                        <div className={`text-center ${
                          isExceptionHighlighted('noUpdate48h', brand) ? 'bg-accent-bright-red p-2 rounded-lg border border-accent-light-red' : ''
                        }`}>
                          <div className="flex items-center justify-center space-x-1">
                            <Activity className="h-3 w-3 text-functional-mid-blue" />
                            <span className="font-medium text-functional-mid-blue">{brand.exceptions.noUpdate48h}</span>
                          </div>
                          <div className="text-functional-mid-grey mt-1">超48h未更新</div>
                          {isExceptionHighlighted('noUpdate48h', brand) && (
                            <div className="text-xs text-accent-dark-red mt-1">
                              ⚠️ 异常聚焦
                            </div>
                          )}
                        </div>
                        <div className={`text-center ${
                          isExceptionHighlighted('delivery', brand) ? 'bg-accent-bright-red p-2 rounded-lg border border-accent-light-red' : ''
                        }`}>
                          <div className="flex items-center justify-center space-x-1">
                            <Package className="h-3 w-3 text-accent-mid-teal" />
                            <span className="font-medium text-accent-mid-teal">{brand.exceptions.delivery}</span>
                          </div>
                          <div className="text-functional-mid-grey mt-1">超时未签收</div>
                          {isExceptionHighlighted('delivery', brand) && (
                            <div className="text-xs text-accent-dark-red mt-1">
                              ⚠️ 异常聚焦
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>


          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
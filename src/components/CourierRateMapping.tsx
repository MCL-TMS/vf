import React, { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Alert, AlertDescription } from './ui/alert';
import { TrendingUp, TrendingDown, Award, AlertCircle, Package, Truck, CheckCircle, Database, Wifi, WifiOff } from 'lucide-react';
import { 
  processCourierDataFromStatusDistribution, 
  combineCourierDataWithMetrics,
  processCourierDataLegacy,
  getCourierRankings, 
  calculateCourierScore, 
  validateCourierData,
  type CourierProcessedData,
  type CourierStatusStats 
} from '../utils/courierRateCalculator';
import { ApiService } from '../services/apiService';

interface CourierRateMappingProps {
  rawCourierData?: any[];
  selectedBrand?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  usingApiData?: boolean;
}

export function CourierRateMapping({ 
  rawCourierData = [], 
  selectedBrand, 
  dateRange,
  usingApiData = false 
}: CourierRateMappingProps) {
  
  const [statusDistributionData, setStatusDistributionData] = useState<CourierStatusStats[]>([]);
  const [loadingStatusData, setLoadingStatusData] = useState(false);
  const [statusDataError, setStatusDataError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'precise' | 'estimated' | 'none'>('none');

  // 获取状态分布数据
  useEffect(() => {
    if (!usingApiData || !dateRange) {
      return;
    }

    const fetchStatusDistribution = async () => {
      setLoadingStatusData(true);
      setStatusDataError(null);
      
      try {
        console.log('🔄 [CourierRateMapping] 获取状态分布数据...');
        const response = await ApiService.getLogisticsStatusDistribution({
          dateRange,
          brand: selectedBrand
        });
        
        if (response.success && response.data?.courierStats) {
          setStatusDistributionData(response.data.courierStats);
          setDataSource('precise');
          console.log('✅ [CourierRateMapping] 状态分布数据获取成功:', response.data.courierStats.length, '个快递公司');
        } else {
          throw new Error('状态分布数据格式错误');
        }
      } catch (error: any) {
        console.error('❌ [CourierRateMapping] 状态分布数据获取失败:', error);
        setStatusDataError(error.message);
        setDataSource('estimated');
      } finally {
        setLoadingStatusData(false);
      }
    };

    fetchStatusDistribution();
  }, [usingApiData, dateRange, selectedBrand]);

  // 处理快递公司数据，计算各项指标
  const processedData = useMemo(() => {
    if (!usingApiData || statusDistributionData.length === 0) {
      // 使用传统估算方法作为备选
      if (rawCourierData && rawCourierData.length > 0) {
        setDataSource('estimated');
        return processCourierDataLegacy(rawCourierData);
      }
      return [];
    }

    // 使用精确的状态分布数据
    if (rawCourierData && rawCourierData.length > 0) {
      // 结合状态分布数据和传统API数据，提供完整信息
      return combineCourierDataWithMetrics(statusDistributionData, rawCourierData);
    } else {
      // 仅使用状态分布数据
      return processCourierDataFromStatusDistribution(statusDistributionData);
    }
  }, [statusDistributionData, rawCourierData, usingApiData]);

  // 获取排名数据
  const rankings = useMemo(() => {
    return getCourierRankings(processedData);
  }, [processedData]);

  // 计算综合评分
  const dataWithScores = useMemo(() => {
    return processedData.map(courier => ({
      ...courier,
      overallScore: calculateCourierScore(courier)
    }));
  }, [processedData]);

  // 数据验证
  const dataValidation = useMemo(() => {
    return validateCourierData(processedData);
  }, [processedData]);

  // 获取快递公司图标
  const getCourierIcon = (carrierId: string): string => {
    const iconMap: { [key: string]: string } = {
      'SF': '🚀',
      'JD': '📦',
      'STO': '🚚',
      'YTO': '🚛',
      'ZTO': '🚐',
      'YUNDA': '🚌',
      'EMS': '📮',
      'HTKY': '🚙',
      'DEPPON': '🚚',
      'DHL': '✈️',
      'FEDEX': '🛩️',
      'UPS': '📫',
      'TNT': '🚁',
    };
    return iconMap[carrierId] || '🚚';
  };

  // 获取指标等级
  const getRateLevel = (rate: number): { level: string; color: string; bgColor: string } => {
    if (rate >= 95) {
      return { level: '优秀', color: 'text-accent-dark-green', bgColor: 'bg-accent-bright-green' };
    } else if (rate >= 90) {
      return { level: '良好', color: 'text-functional-dark-blue', bgColor: 'bg-functional-bright-blue' };
    } else if (rate >= 85) {
      return { level: '一般', color: 'text-accent-dark-orange', bgColor: 'bg-accent-bright-orange' };
    } else {
      return { level: '待改进', color: 'text-accent-dark-red', bgColor: 'bg-accent-bright-red' };
    }
  };

  // 获取数据源标识
  const getDataSourceBadge = () => {
    if (loadingStatusData) {
      return (
        <Badge variant="outline" className="bg-functional-bright-grey text-functional-dark-grey border-functional-light-grey">
          <Wifi className="h-3 w-3 mr-1 animate-pulse" />
          加载中...
        </Badge>
      );
    }

    switch (dataSource) {
      case 'precise':
        return (
          <Badge variant="outline" className="bg-accent-bright-green text-accent-dark-green border-accent-light-green">
            <Database className="h-3 w-3 mr-1" />
            精确数据
          </Badge>
        );
      case 'estimated':
        return (
          <Badge variant="outline" className="bg-accent-bright-orange text-accent-dark-orange border-accent-light-orange">
            <AlertCircle className="h-3 w-3 mr-1" />
            估算数据
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-functional-bright-grey text-functional-dark-grey border-functional-light-grey">
            <WifiOff className="h-3 w-3 mr-1" />
            离线模式
          </Badge>
        );
    }
  };

  if (processedData.length === 0 && !loadingStatusData) {
    return (
      <Card className="maersk-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-maersk-black">
            <Truck className="h-5 w-5" />
            <span>快递公司指标映射</span>
            {getDataSourceBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-functional-mid-grey">
            <div className="text-center">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{usingApiData ? '暂无快递公司数据' : '请连接API获取快递公司数据'}</p>
              {statusDataError && (
                <p className="text-xs text-accent-mid-red mt-1">
                  错误: {statusDataError}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="maersk-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-maersk-black">
          <Truck className="h-5 w-5" />
          <span>快递公司指标映射</span>
          {selectedBrand && (
            <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue">
              {selectedBrand}
            </Badge>
          )}
          {getDataSourceBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 数据质量提示 */}
        {!dataValidation.isValid && (
          <Alert className="mb-4 border-accent-light-orange bg-accent-bright-orange">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-accent-dark-orange">
              <strong>数据质量警告:</strong> {dataValidation.issues.join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* 数据源说明 */}
        {dataSource === 'estimated' && (
          <Alert className="mb-4 border-accent-light-orange bg-accent-bright-orange">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-accent-dark-orange">
              <strong>使用估算数据:</strong> 当前揽收率和发运率基于行业经验估算。
              {statusDataError && ` 原因: ${statusDataError}`}
              建议检查API连接以获取精确数据。
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-functional-bright-grey">
            <TabsTrigger value="overview" className="text-maersk-black">指标总览</TabsTrigger>
            <TabsTrigger value="pickup" className="text-maersk-black">揽收率排名</TabsTrigger>
            <TabsTrigger value="shipping" className="text-maersk-black">发运率排名</TabsTrigger>
            <TabsTrigger value="delivery" className="text-maersk-black">签收率排名</TabsTrigger>
          </TabsList>

          {/* 指标总览 */}
          <TabsContent value="overview" className="space-y-4">
            {loadingStatusData ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Wifi className="h-8 w-8 mx-auto mb-2 animate-pulse text-maersk-blue" />
                  <p className="text-functional-mid-grey">正在获取精确数据...</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {dataWithScores
                  .sort((a, b) => b.overallScore - a.overallScore)
                  .map((courier, index) => {
                    const pickupLevel = getRateLevel(courier.pickupRate);
                    const shippingLevel = getRateLevel(courier.shippingRate);
                    const deliveryLevel = getRateLevel(courier.deliveryRate);
                    
                    return (
                      <div key={courier.carrierId} className="border border-functional-light-grey rounded-lg p-4 hover:bg-functional-bright-grey transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-functional-bright-blue rounded-full flex items-center justify-center">
                              <span className="text-lg">{getCourierIcon(courier.carrierId)}</span>
                            </div>
                            <div>
                              <h4 className="font-medium text-maersk-black">{courier.courierName}</h4>
                              <div className="text-xs text-functional-mid-grey">
                                {courier.totalOrders.toLocaleString()} 总订单
                                {dataSource === 'precise' && (
                                  <span className="ml-2 text-accent-mid-green">✓ 精确统计</span>
                                )}
                              </div>
                            </div>
                            {index < 3 && (
                              <Badge variant="outline" className="bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange">
                                <Award className="h-3 w-3 mr-1" />
                                TOP {index + 1}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-maersk-blue">
                              {courier.overallScore.toFixed(1)}分
                            </div>
                            <div className="text-xs text-functional-mid-grey">综合评分</div>
                          </div>
                        </div>

                        {/* 三大指标 */}
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-1 mb-1">
                              <Package className="h-4 w-4 text-accent-mid-orange" />
                              <span className="text-sm font-medium text-maersk-black">
                                {courier.pickupRate.toFixed(1)}%
                              </span>
                            </div>
                            <Badge variant="outline" className={`text-xs ${pickupLevel.color} ${pickupLevel.bgColor} border-current`}>
                              揽收率 {pickupLevel.level}
                            </Badge>
                            <div className="mt-1 text-xs text-functional-mid-grey">
                              {courier.pickedOrders.toLocaleString()}单
                              {dataSource === 'precise' ? ' (实际)' : ' (估算)'}
                            </div>
                          </div>
                          
                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-1 mb-1">
                              <Truck className="h-4 w-4 text-functional-mid-blue" />
                              <span className="text-sm font-medium text-maersk-black">
                                {courier.shippingRate.toFixed(1)}%
                              </span>
                            </div>
                            <Badge variant="outline" className={`text-xs ${shippingLevel.color} ${shippingLevel.bgColor} border-current`}>
                              发运率 {shippingLevel.level}
                            </Badge>
                            <div className="mt-1 text-xs text-functional-mid-grey">
                              {courier.shippedOrders.toLocaleString()}单
                              {dataSource === 'precise' ? ' (实际)' : ' (估算)'}
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-1 mb-1">
                              <CheckCircle className="h-4 w-4 text-accent-mid-green" />
                              <span className="text-sm font-medium text-maersk-black">
                                {courier.deliveryRate.toFixed(1)}%
                              </span>
                            </div>
                            <Badge variant="outline" className={`text-xs ${deliveryLevel.color} ${deliveryLevel.bgColor} border-current`}>
                              签收率 {deliveryLevel.level}
                            </Badge>
                            <div className="mt-1 text-xs text-functional-mid-grey">
                              {courier.deliveredOrders.toLocaleString()}单 (实际)
                            </div>
                          </div>
                        </div>

                        {/* 时效和异常指标 */}
                        <div className="grid grid-cols-4 gap-2 text-xs border-t border-functional-light-grey pt-2">
                          <div className="text-center">
                            <div className="text-maersk-black font-medium">
                              {courier.avgFirstDispatchHours?.toFixed(1) || '-'}h
                            </div>
                            <div className="text-functional-mid-grey">首派时长</div>
                          </div>
                          <div className="text-center">
                            <div className="text-maersk-black font-medium">
                              {courier.firstDispatchSuccessRate?.toFixed(1) || '-'}%
                            </div>
                            <div className="text-functional-mid-grey">首派成功率</div>
                          </div>
                          <div className="text-center">
                            <div className="text-maersk-black font-medium">
                              {courier.exceptionRate.toFixed(1)}%
                            </div>
                            <div className="text-functional-mid-grey">异常率</div>
                          </div>
                          <div className="text-center">
                            <div className="text-accent-mid-red font-medium">
                              {courier.totalTimeout || 0}
                            </div>
                            <div className="text-functional-mid-grey">超时订单</div>
                          </div>
                        </div>

                        {/* 状态分布详情（仅在有数据时显示） */}
                        {courier.statusDistribution && courier.statusDistribution.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-functional-light-grey">
                            <div className="text-xs text-functional-mid-grey mb-2">状态分布详情:</div>
                            <div className="grid grid-cols-4 gap-1 text-xs">
                              {courier.statusDistribution.slice(0, 4).map((status, idx) => (
                                <div key={idx} className="text-center p-1 bg-functional-bright-grey rounded">
                                  <div className="text-maersk-black font-medium">{status.statusCode}</div>
                                  <div className="text-functional-mid-grey truncate">{status.statusName}</div>
                                  <div className="text-maersk-blue">{status.orderCount}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          {/* 揽收率排名 */}
          <TabsContent value="pickup">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 mb-4">
                <Package className="h-5 w-5 text-accent-mid-orange" />
                <h3 className="font-medium text-maersk-black">揽收率排名</h3>
                <Badge variant="outline" className="bg-accent-bright-orange text-accent-dark-orange border-accent-light-orange">
                  按揽收效率排序 {dataSource === 'precise' ? '(精确数据)' : '(估算数据)'}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">排名</TableHead>
                    <TableHead>快递公司</TableHead>
                    <TableHead className="text-right">总订单</TableHead>
                    <TableHead className="text-right">已揽收</TableHead>
                    <TableHead className="text-right">揽收率</TableHead>
                    <TableHead className="text-right">超时未揽收</TableHead>
                    <TableHead>等级</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankings.byPickupRate.map((courier, index) => {
                    const level = getRateLevel(courier.pickupRate);
                    return (
                      <TableRow key={courier.carrierId}>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {index < 3 && <Award className="h-4 w-4 text-accent-mid-orange" />}
                            <span className="font-medium">#{index + 1}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{getCourierIcon(courier.carrierId)}</span>
                            <span className="font-medium">{courier.courierName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{courier.totalOrders.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {courier.pickedOrders.toLocaleString()}
                          {dataSource === 'estimated' && <span className="text-xs text-accent-mid-orange ml-1">*</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium text-maersk-blue">
                            {courier.pickupRate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-accent-mid-red">
                            {courier.pickupTimeout || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${level.color} ${level.bgColor} border-current`}>
                            {level.level}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {dataSource === 'estimated' && (
                <div className="text-xs text-accent-mid-orange mt-2">
                  * 标记的数据为基于行业经验的估算值
                </div>
              )}
            </div>
          </TabsContent>

          {/* 发运率排名 */}
          <TabsContent value="shipping">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 mb-4">
                <Truck className="h-5 w-5 text-functional-mid-blue" />
                <h3 className="font-medium text-maersk-black">发运率排名</h3>
                <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue">
                  按发运效率排序 {dataSource === 'precise' ? '(精确数据)' : '(估算数据)'}
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">排名</TableHead>
                    <TableHead>快递公司</TableHead>
                    <TableHead className="text-right">总订单</TableHead>
                    <TableHead className="text-right">已发运</TableHead>
                    <TableHead className="text-right">发运率</TableHead>
                    <TableHead className="text-right">超时未发运</TableHead>
                    <TableHead>等级</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankings.byShippingRate.map((courier, index) => {
                    const level = getRateLevel(courier.shippingRate);
                    return (
                      <TableRow key={courier.carrierId}>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {index < 3 && <Award className="h-4 w-4 text-functional-mid-blue" />}
                            <span className="font-medium">#{index + 1}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{getCourierIcon(courier.carrierId)}</span>
                            <span className="font-medium">{courier.courierName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{courier.totalOrders.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {courier.shippedOrders.toLocaleString()}
                          {dataSource === 'estimated' && <span className="text-xs text-accent-mid-orange ml-1">*</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium text-maersk-blue">
                            {courier.shippingRate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-accent-mid-red">
                            {courier.shippingTimeout || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${level.color} ${level.bgColor} border-current`}>
                            {level.level}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {dataSource === 'estimated' && (
                <div className="text-xs text-accent-mid-orange mt-2">
                  * 标记的数据为基于行业经验的估算值
                </div>
              )}
            </div>
          </TabsContent>

          {/* 签收率排名 */}
          <TabsContent value="delivery">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 mb-4">
                <CheckCircle className="h-5 w-5 text-accent-mid-green" />
                <h3 className="font-medium text-maersk-black">签收率排名</h3>
                <Badge variant="outline" className="bg-accent-bright-green text-accent-dark-green border-accent-light-green">
                  按签收效率排序 (精确数据)
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">排名</TableHead>
                    <TableHead>快递公司</TableHead>
                    <TableHead className="text-right">总订单</TableHead>
                    <TableHead className="text-right">已签收</TableHead>
                    <TableHead className="text-right">签收率</TableHead>
                    <TableHead className="text-right">超时未签收</TableHead>
                    <TableHead>等级</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankings.byDeliveryRate.map((courier, index) => {
                    const level = getRateLevel(courier.deliveryRate);
                    return (
                      <TableRow key={courier.carrierId}>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {index < 3 && <Award className="h-4 w-4 text-accent-mid-green" />}
                            <span className="font-medium">#{index + 1}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{getCourierIcon(courier.carrierId)}</span>
                            <span className="font-medium">{courier.courierName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{courier.totalOrders.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{courier.deliveredOrders.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium text-maersk-blue">
                            {courier.deliveryRate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-accent-mid-red">
                            {courier.deliveryTimeout || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${level.color} ${level.bgColor} border-current`}>
                            {level.level}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
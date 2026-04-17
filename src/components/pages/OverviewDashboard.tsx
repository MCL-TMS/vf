import React from "react";
import { EnhancedKPICard } from "../EnhancedKPICard";
import { ImpactChart } from "../ImpactChart";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { AlertTriangle, Clock, CheckCircle, Shield, TrendingUp, TrendingDown, Package, Truck, BarChart3, ArrowRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { OrderKPIData } from "../../data/orderData";
import { FilteredData } from "../../utils/dataFilter";
import { getUnifiedExceptionData } from "../../utils/exceptionDataCalculator";
import { DataLoadingState } from "../DataLoadingState";

interface OverviewDashboardProps {
  filteredData: FilteredData;
  selectedBrand: string | string[] | null;
  selectedPlatform: string | null;
  onKPIDetailClick: (kpi: OrderKPIData) => void; // 修改为接受OrderKPIData对象
  onExceptionClick?: (exceptionType: string, brand?: string, courier?: string) => void;
  useRealData?: boolean;
  apiLoading?: boolean;
  dateRange?: { from: string; to: string };
  rawApiData?: any; // 新增：API原始数据，用于获取异常统计
  unifiedCourierData?: any; // 新增：统一的快递商数据
}

export function OverviewDashboard({ 
  filteredData, 
  selectedBrand, 
  selectedPlatform, 
  onKPIDetailClick, 
  onExceptionClick,
  useRealData = false,
  apiLoading = false,
  dateRange,
  rawApiData
}: OverviewDashboardProps) {
  // 添加安全检查，防止 filteredData 为 undefined
  if (!filteredData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg font-medium text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  if (useRealData && apiLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <DataLoadingState
            loading={true}
            dataType="总览指标"
            loadingMessage="正在加载总览指标..."
            minHeight="140px"
          />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <DataLoadingState
            loading={true}
            dataType="KPI卡片"
            loadingMessage="正在加载KPI卡片..."
            minHeight="240px"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DataLoadingState
            loading={true}
            dataType="异常监控模块"
            loadingMessage="正在加载异常监控模块..."
            minHeight="260px"
          />
          <DataLoadingState
            loading={true}
            dataType="快递占比模块"
            loadingMessage="正在加载快递占比模块..."
            minHeight="260px"
          />
        </div>
      </div>
    );
  }

  // 安全获取KPI数据的辅助函数
  const getKPIByLabel = (label: string) => {
    return filteredData.kpiData?.find(kpi => kpi.label === label);
  };

  // 🔥 修复：使用统一的异常数据计算工具，确保与物流页面完全一致
  const getExceptionDataFromApi = () => {
    console.log('🔍 [OverviewDashboard] rawApiData:', rawApiData);
    console.log('🔍 [OverviewDashboard] rawApiData.data:', rawApiData?.data);
    console.log('🔍 [OverviewDashboard] rawApiData.data.exceptionStats:', rawApiData?.data?.exceptionStats);
    return getUnifiedExceptionData(useRealData, rawApiData, 'OverviewDashboard');
  };

  const apiExceptionData = getExceptionDataFromApi();
  console.log('🔍 [OverviewDashboard] apiExceptionData:', apiExceptionData);
  console.log('🔍 [OverviewDashboard] selectedBrand:', selectedBrand, 'isArray:', Array.isArray(selectedBrand));
  console.log('🔍 [OverviewDashboard] apiExceptionData.brandDistribution:', apiExceptionData.brandDistribution);
  console.log('🔍 [OverviewDashboard] apiExceptionData.totalOrders:', apiExceptionData.totalOrders);
  
  // 🔥 修复：计算筛选后的异常数据，支持多品牌（数组）
  const filterRatio = (() => {
    console.log('🔍 [OverviewDashboard] 开始计算 filterRatio...');
    
    // 🔥 新增：如果是"全部品牌"，直接返回1（显示全部数据）
    if (!selectedBrand || selectedBrand === 'all') {
      console.log('🔍 [OverviewDashboard] 选择了全部品牌，filterRatio = 1');
      return 1;
    }
    
    if (!apiExceptionData.brandDistribution || apiExceptionData.totalOrders === 0) {
      console.log('🔍 [OverviewDashboard] 使用默认 filterRatio = 1，原因:', {
        hasSelectedBrand: !!selectedBrand,
        hasBrandDistribution: !!apiExceptionData.brandDistribution,
        totalOrders: apiExceptionData.totalOrders
      });
      return 1; // 没有品牌筛选或没有品牌分布数据，返回完整数据
    }
    
    // 🔥 新增：如果selectedBrand是数组，计算多个品牌的总订单数
    if (Array.isArray(selectedBrand)) {
      const totalBrandOrders = selectedBrand.reduce((sum, brand) => {
        const brandOrders = apiExceptionData.brandDistribution[brand] || 0;
        console.log(`🔍 [OverviewDashboard] 品牌 ${brand} 订单数:`, brandOrders);
        return sum + brandOrders;
      }, 0);
      
      const ratio = totalBrandOrders / apiExceptionData.totalOrders;
      
      console.log('🔍 [OverviewDashboard] 多品牌过滤比例计算:', {
        selectedBrands: selectedBrand,
        totalBrandOrders,
        totalOrders: apiExceptionData.totalOrders,
        filterRatio: ratio
      });
      
      return ratio;
    }
    
    // 单个品牌
    const brandOrders = apiExceptionData.brandDistribution[selectedBrand] || 0;
    const ratio = brandOrders / apiExceptionData.totalOrders;
    console.log('🔍 [OverviewDashboard] 单品牌过滤比例:', { selectedBrand, brandOrders, totalOrders: apiExceptionData.totalOrders, filterRatio: ratio });
    return ratio;
  })();
  
  const totalPickupExceptions = Math.round(apiExceptionData.exceptions.pickupTimeout * filterRatio);
  const totalShippingExceptions = Math.round(apiExceptionData.exceptions.shippingTimeout * filterRatio);
  const totalDeliveryExceptions = Math.round(apiExceptionData.exceptions.deliveryTimeout * filterRatio);
  const totalUpdateExceptions = Math.round(apiExceptionData.exceptions.noUpdate48h * filterRatio);
  
  console.log('🔍 [OverviewDashboard] 异常数据计算结果:', {
    filterRatio,
    原始异常数据: apiExceptionData.exceptions,
    计算后异常数据: {
      totalPickupExceptions,
      totalShippingExceptions,
      totalDeliveryExceptions,
      totalUpdateExceptions
    }
  });
  
  // 获取各个KPI数据 - 添加安全检查
  const pickedKPI = getKPIByLabel('已揽收');
  const shippedKPI = getKPIByLabel('已发运');
  const deliveredKPI = getKPIByLabel('已签收');
  const forwardedKPI = getKPIByLabel('已转寄');
  const returnedKPI = getKPIByLabel('已退回');
  const cancelledKPI = getKPIByLabel('已取消');

  // 计算总订单数（使用品牌统计中的总订单数）- 处理null值
  const totalOrders = filteredData.brandStats?.totalOrders;
  const totalOrdersDisplay = totalOrders !== null && totalOrders !== undefined ? 
    totalOrders.toLocaleString() : 'null';

  // 安全处理KPI值，如果是null或'null'字符串则显示为0
  const parseKPIValue = (kpi: any) => {
    if (!kpi || kpi.value === 'null' || kpi.value === null) {
      return 0;
    }
    const numValue = parseInt(kpi.value.toString().replace(/,/g, ''));
    return isNaN(numValue) ? 0 : numValue;
  };

  const statusDistribution = [
    { 
      name: '已揽收', 
      value: parseKPIValue(pickedKPI), 
      color: '#119c85', // accent-mid-teal: 青绿色 - 起始状态
      isNull: !pickedKPI || pickedKPI.value === 'null'
    },
    { 
      name: '已发运', 
      value: parseKPIValue(shippedKPI), 
      color: '#42b0d5', // maersk-blue: 蓝色 - 运输状态
      isNull: !shippedKPI || shippedKPI.value === 'null'
    },
    { 
      name: '已签收', 
      value: parseKPIValue(deliveredKPI), 
      color: '#6ca926', // accent-mid-green: 绿色 - 成功状态
      isNull: !deliveredKPI || deliveredKPI.value === 'null'
    },
    { 
      name: '已转寄', 
      value: parseKPIValue(forwardedKPI), 
      color: '#ea5d4b', // accent-mid-red: 红色 - 特殊处理
      isNull: !forwardedKPI || forwardedKPI.value === 'null'
    },
    { 
      name: '已退回', 
      value: parseKPIValue(returnedKPI), 
      color: '#f3870c', // accent-mid-orange: 橙色 - 退回状态
      isNull: !returnedKPI || returnedKPI.value === 'null'
    },
    { 
      name: '已取消', 
      value: parseKPIValue(cancelledKPI), 
      color: '#6a6a6a', // functional-mid-grey: 灰色 - 取消状态
      isNull: !cancelledKPI || cancelledKPI.value === 'null'
    },
  ];
  
  // 计算占比 - 处理null值
  statusDistribution.forEach(status => {
    if (status.isNull || totalOrders === 0 || totalOrders === null || totalOrders === undefined) {
      status.percentage = 'null';
    } else {
      status.percentage = ((status.value / totalOrders) * 100).toFixed(1);
    }
  });

  // 异常监控数据 - 使用马士基配色方案，基于与流向分析一致的API异常统计数据
  const exceptionData = [
    { 
      name: '超时未揽收', 
      value: totalPickupExceptions, 
      threshold: '48小时', 
      color: '#f3870c',
      description: 'WMS出库后48小时仍未揽收'
    }, // accent-mid-orange: 橙色
    { 
      name: '超时未发运', 
      value: totalShippingExceptions, 
      threshold: '72小时', 
      color: '#ea5d4b',
      description: 'WMS出库后72小时仍未发运'
    }, // accent-mid-red: 红色
    { 
      name: '超时未签收', 
      value: totalDeliveryExceptions, 
      threshold: '72小时', 
      color: '#6ca926',
      description: '首次派送后72小时仍未签收'
    }, // accent-mid-green: 绿色
    { 
      name: '超48H未更新', 
      value: totalUpdateExceptions, 
      threshold: '48小时', 
      color: '#42b0d5',
      description: '订单状态超过48小时未更新'
    }, // maersk-blue: 蓝色
  ];

  // 计算快递公司订单量占比 - 使用API真实数据，基于CARRIERID字段统计
  const courierOrderData = React.useMemo(() => {
    if (!filteredData.courierData || !Array.isArray(filteredData.courierData)) {
      return [];
    }

    return filteredData.courierData.map((courier, index) => {
      // 使用API返回的真实数据，不再使用硬编码比例
      const orderCount = courier.orderCount || 0;
      const percentage = (courier.percentage !== null && courier.percentage !== undefined) ? 
        courier.percentage.toFixed(1) : '0.0';
      
      return {
        name: courier.name,
        orderCount: orderCount,
        percentage: percentage,
        color: index === 0 ? 'var(--chart-1)' : 
               index === 1 ? 'var(--chart-4)' : 
               index === 2 ? 'var(--chart-2)' :
               index === 3 ? 'var(--chart-3)' : 'var(--chart-5)', // 支持更多快递商颜色
        deliveryRate: courier.deliveryRate !== null ? courier.deliveryRate : 'null',
        pickupRate: courier.pickupRate !== null ? courier.pickupRate : 'null',
        shippingRate: courier.shippingRate !== null ? courier.shippingRate : 'null'
      };
    });
  }, [filteredData.courierData]);

  // 将KPI数据按行分组 - 添加安全检查
  const kpiRows = [
    filteredData.kpiData?.slice(0, 3) || [], // 第一行：已揽收、已发运、已签收
    filteredData.kpiData?.slice(3, 6) || [], // 第二行：已转寄、已退回、已取消
    filteredData.kpiData?.slice(6, 9) || []  // 第三行：首派成功率、平均首派时长、平均签收时长
  ];

  // 处理KPI卡片点击事件
  const handleKPIClick = (kpi: OrderKPIData) => {
    if (onKPIDetailClick) {
      onKPIDetailClick(kpi); // 传递完整的KPI对象
    }
  };

  // 处理增长率显示 - 安全处理null值
  const formatGrowth = (growth: number | null) => {
    if (growth === null || growth === undefined) {
      return 'null';
    }
    return Math.abs(growth).toFixed(1) + '%';
  };

  // 🔥 修复：使用真实的总单量同比环比数据
  const totalOrdersGrowth = filteredData.brandStats?.totalOrdersGrowth;
  const momGrowth = totalOrdersGrowth?.mom;
  const yoyGrowth = totalOrdersGrowth?.yoy;

  return (
    <div className="space-y-6">
      {/* 总单量概览 */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">总单量</p>
                <p className="text-3xl font-semibold">{totalOrdersDisplay}</p>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">环比:</span>
                    <div className={`flex items-center space-x-1 ${momGrowth !== null && momGrowth >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                      {momGrowth !== null ? (
                        <>
                          {momGrowth >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span>{formatGrowth(momGrowth)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-muted-foreground">同比:</span>
                    <div className={`flex items-center space-x-1 ${yoyGrowth !== null && yoyGrowth >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                      {yoyGrowth !== null ? (
                        <>
                          {yoyGrowth >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span>{formatGrowth(yoyGrowth)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 核心KPI指标 - 新的3行×3列布局 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">📊 核心指标</h2>
          <div className="flex items-center space-x-2">
            {selectedBrand && (
              <Badge variant="outline" className="maersk-badge-secondary">
                品牌: {selectedBrand}
              </Badge>
            )}
            {selectedPlatform && (
              <Badge variant="outline" className="maersk-badge-secondary">
                平台: {selectedPlatform}
              </Badge>
            )}

          </div>
        </div>
        
        {/* 第一行：已揽收、已发运、已签收 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {kpiRows[0]?.map((kpi, index) => (
            <EnhancedKPICard 
              key={`row1-${index}`} 
              data={kpi} 
              onDetailClick={handleKPIClick}
            />
          ))}
        </div>

        {/* 第二行：已转寄、已退回、已取消 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {kpiRows[1]?.map((kpi, index) => (
            <EnhancedKPICard 
              key={`row2-${index}`} 
              data={kpi} 
              onDetailClick={handleKPIClick}
            />
          ))}
        </div>

        {/* 第三行：首派成功率、平均首派时长、平均签收时长 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiRows[2]?.map((kpi, index) => (
            <EnhancedKPICard 
              key={`row3-${index}`} 
              data={kpi} 
              onDetailClick={handleKPIClick}
            />
          ))}
        </div>
      </section>

      {/* 订单状态分布 - 调整为单独占用一行 */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="h-5 w-5 mr-2" />
              订单状态分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isNull ? '#d4d4d4' : entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [
                      `${parseInt(value).toLocaleString()} 单`, 
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {statusDistribution.map((status, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: status.isNull ? '#d4d4d4' : status.color }}
                    />
                    <span className={status.isNull ? 'text-functional-mid-grey' : ''}>{status.name}</span>
                  </div>
                  <span className={`font-medium ${status.isNull ? 'text-functional-mid-grey' : ''}`}>
                    {status.percentage === 'null' ? 'null' : `${status.percentage}%`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 品牌×平台影响力分析 - 新增的冲击图 */}
      <div className="grid grid-cols-1 gap-6">
        <ImpactChart 
          selectedBrand={selectedBrand} 
          selectedPlatform={selectedPlatform} 
          onExceptionClick={onExceptionClick}
          useRealData={useRealData}
          dateRange={dateRange}
        />
      </div>

      {/* 超时监控详情和快递公司订单占比 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 超时监控详情 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                超时监控详情
              </div>
              <div className="flex items-center space-x-2">
                {useRealData && (
                  <Badge variant="outline" className="text-xs bg-accent-bright-green text-accent-dark-green border-accent-mid-green">
                    实时数据
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exceptionData}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${value} 单`,
                      props.payload.description
                    ]}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[4, 4, 0, 0]}
                  >
                    {exceptionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {exceptionData.map((exception, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between text-sm p-3 maersk-alert-warning rounded-lg cursor-pointer hover:bg-accent-bright-orange transition-colors"
                  onClick={() => onExceptionClick && onExceptionClick(
                    exception.name.includes('未揽收') ? 'pickup_timeout' : 
                    exception.name.includes('未发运') ? 'shipping_timeout' : 
                    exception.name.includes('未签收') ? 'delivery_timeout' : 
                    exception.name.includes('未更新') ? 'shipping_no_update_48h' : 'update_timeout'
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: exception.color }}
                    />
                    <div>
                      <div className="font-medium text-accent-dark-orange">{exception.name}</div>
                      
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-accent-dark-orange">{exception.value} 单</div>
                   {/* <div className="text-xs text-functional-mid-grey">阈值: {exception.threshold}</div>*/}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 快递公司订单占比 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Truck className="h-5 w-5 mr-2" />
                快递公司订单占比
              </div>
              {useRealData && (
                <Badge variant="outline" className="text-xs bg-accent-bright-green text-accent-dark-green border-accent-mid-green">
                  实时数据
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 总订单量 */}
              <div className="text-center pb-4 border-b">
                <div className="text-2xl font-semibold text-maersk-blue">
                  {totalOrdersDisplay}
                </div>
                <div className="text-sm text-muted-foreground">总订单量</div>
              </div>

              {/* 数据状态显示 */}
              {courierOrderData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <div className="text-sm">
                    {useRealData ? '暂无快递公司数据' : '请连接到API获取实时数据'}
                  </div>
                  {useRealData && (
                    <div className="text-xs mt-2 text-red-500">
                      检查后端是否正确返回courierDistribution数据
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* 快递公司占比详情 */}
                  {courierOrderData.map((courier, index) => (
                    <div key={index} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div 
                            className="w-4 h-4 rounded-full mr-3" 
                            style={{ backgroundColor: courier.color }}
                          />
                          <span className="font-medium">{courier.name}</span>
                        </div>
                        <Badge variant="outline" className="text-lg px-3 py-1">
                          {courier.percentage}%
                        </Badge>
                      </div>
                      
                      {/* 进度条显示占比 */}
                      <Progress value={parseFloat(courier.percentage)} className="h-2" />
                      
                      {/* 详细数据 */}
                      <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">订单数量</span>
                          <span className="font-semibold">{courier.orderCount.toLocaleString()} 单</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <div className="font-medium">
                              {courier.pickupRate === 'null' ? 'null' : `${parseFloat(courier.pickupRate).toFixed(2)}%`}
                            </div>
                            <div className="text-muted-foreground">揽收率</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">
                              {courier.shippingRate === 'null' ? 'null' : `${parseFloat(courier.shippingRate).toFixed(2)}%`}
                            </div>
                            <div className="text-muted-foreground">发运率</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">
                              {courier.deliveryRate === 'null' ? 'null' : `${parseFloat(courier.deliveryRate).toFixed(2)}%`}
                            </div>
                            <div className="text-muted-foreground">签收率</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* 占比总结 */}
                  <div className="pt-4 border-t">
                    <div className="text-center text-sm text-muted-foreground">
                      覆盖率: {courierOrderData.reduce((sum, c) => sum + parseFloat(c.percentage), 0).toFixed(1)}%
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 品牌统计摘要 - 🔥 排除"all"品牌 */}
      {selectedBrand && selectedBrand !== 'all' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>🎯</span>
              <span>{selectedBrand} 品牌概览</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-semibold text-maersk-blue">
                  {filteredData.brandStats.totalOrders !== null ? 
                    filteredData.brandStats.totalOrders.toLocaleString() : 'null'}
                </div>
                <div className="text-sm text-muted-foreground">总订单数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-accent-mid-green">
                  {filteredData.brandStats.marketShare !== null ? 
                    `${filteredData.brandStats.marketShare}%` : 'null'}
                </div>
                <div className="text-sm text-muted-foreground">市场份额</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-accent-mid-orange">
                  {filteredData.brandStats.growth !== null ? 
                    `+${filteredData.brandStats.growth}%` : 'null'}
                </div>
                <div className="text-sm text-muted-foreground">月度增长</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
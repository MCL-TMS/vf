import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Clock, Package, Target, TrendingUp, Truck, Award, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface S2DTimeAnalysisResultCardProps {
  analysisResult: any;
  selectedBrand?: string;
}

export function S2DTimeAnalysisResultCard({ 
  analysisResult,
  selectedBrand
}: S2DTimeAnalysisResultCardProps) {
  console.log('🎨 S2DTimeAnalysisResultCard 接收到的数据:', {
    hasAnalysisResult: !!analysisResult,
    hasS2dAnalysis: !!analysisResult?.s2dAnalysis,
    analysisResult
  });
  
  if (!analysisResult || !analysisResult.s2dAnalysis) {
    console.warn('⚠️ S2D分析数据缺失，无法渲染组件');
    return null;
  }

  /**
   * 📊 S2D时效分析数据结构说明
   * 
   * 后端状态码逻辑（已修正）:
   * - ✅ Actual时效: 使用 DIS_STATUS='95'（已签收状态）
   * - ✅ Plan时效: 不受订单状态限制（所有匹配到SLA的订单）
   * - ✅ totalS2DOrders: 已签收订单总数（DIS_STATUS='95'）
   * 
   * 数据来源:
   * - Actual数据: TSK_LIST_TASK.SUM_SEND_TIME2（实际配送时长，只统计已签收订单）
   * - Plan数据: TSK_TIMELINESS_DATA.TIME_VALUE（用户上传的时效表目标，所有订单）
   * - 匹配逻辑: 品牌 + 快递商 + 城市 三元组匹配
   * 
   * 详见文档: /S2D_FRONTEND_BACKEND_DATA_MAPPING.md
   */
  const { s2dAnalysis, matchingStats, totalOrders } = analysisResult;
  const { totalS2DOrders, categories, brandStats, carrierStats, overallAvgActualHours, overallAvgPlanHours } = s2dAnalysis;
  
  console.log('📊 S2D分析数据详情（Plan vs Actual）:', {
    totalOrders,
    totalS2DOrders,
    categories,
    brandStatsKeys: Object.keys(brandStats || {}),
    carrierStatsKeys: Object.keys(carrierStats || {}),
    overallAvgActualHours,
    overallAvgPlanHours
  });

  // 计算Actual时效达成率（基于实际配送时长）
  const getActual24HRate = () => {
    if (!totalS2DOrders || !categories || !categories['24H']) return 0;
    return Math.round(((categories['24H'].actualCount || 0) / totalS2DOrders) * 100);
  };

  const getActual48HRate = () => {
    if (!totalS2DOrders || !categories) return 0;
    const count24 = categories['24H']?.actualCount || 0;
    const count48 = categories['48H']?.actualCount || 0;
    return Math.round(((count24 + count48) / totalS2DOrders) * 100);
  };

  const getActual72HRate = () => {
    if (!totalS2DOrders || !categories) return 0;
    const count24 = categories['24H']?.actualCount || 0;
    const count48 = categories['48H']?.actualCount || 0;
    const count72 = categories['72H']?.actualCount || 0;
    return Math.round(((count24 + count48 + count72) / totalS2DOrders) * 100);
  };

  // 计算Plan时效达成率（基于用户上传的时效表）
  const getPlan24HRate = () => {
    if (!totalS2DOrders || !categories || !categories['24H']) return 0;
    const rate = ((categories['24H'].planCount || 0) / totalS2DOrders) * 100;
    return isNaN(rate) || !isFinite(rate) ? 0 : Math.round(rate);
  };

  const getPlan48HRate = () => {
    if (!totalS2DOrders || !categories) return 0;
    const count24 = categories['24H']?.planCount || 0;
    const count48 = categories['48H']?.planCount || 0;
    const rate = ((count24 + count48) / totalS2DOrders) * 100;
    return isNaN(rate) || !isFinite(rate) ? 0 : Math.round(rate);
  };

  const getPlan72HRate = () => {
    if (!totalS2DOrders || !categories) return 0;
    const count24 = categories['24H']?.planCount || 0;
    const count48 = categories['48H']?.planCount || 0;
    const count72 = categories['72H']?.planCount || 0;
    const rate = ((count24 + count48 + count72) / totalS2DOrders) * 100;
    return isNaN(rate) || !isFinite(rate) ? 0 : Math.round(rate);
  };
  
  // ⚠️  检查是否有Plan数据
  const hasPlanData = categories && (
    (categories['24H']?.planCount || 0) > 0 ||
    (categories['48H']?.planCount || 0) > 0 ||
    (categories['72H']?.planCount || 0) > 0 ||
    (categories['72H+']?.planCount || 0) > 0
  );

  // 获取评级
  const getPerformanceLevel = (rate: number) => {
    if (rate >= 90) return { label: '优秀', color: 'text-accent-dark-green', bgColor: 'bg-accent-bright-green' };
    if (rate >= 80) return { label: '良好', color: 'text-accent-dark-teal', bgColor: 'bg-accent-bright-teal' };
    if (rate >= 70) return { label: '一般', color: 'text-accent-dark-orange', bgColor: 'bg-accent-bright-orange' };
    return { label: '需改进', color: 'text-accent-dark-red', bgColor: 'bg-accent-bright-red' };
  };

  const performanceActual72H = getPerformanceLevel(getActual72HRate());
  const performancePlan72H = getPerformanceLevel(getPlan72HRate());

  return (
    <div className="space-y-6">
      {/* ⚠️  Plan数据缺失警告 */}
      {!hasPlanData && (
        <div className="maersk-alert-warning p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-accent-dark-orange mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-accent-dark-orange mb-1">
                时效标准数据未找到
              </div>
              <div className="text-sm text-accent-dark-orange">
                当前只显示Actual时效数据（实际表现）。Plan时效数据为0可能是因为：
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>尚未上传时效标准Excel文件</li>
                  <li>上传的时效表数据未保存到文件系统</li>
                  <li>时效表中的品牌/快递商/城市组合与订单数据不匹配</li>
                </ul>
                <div className="mt-2 font-medium">
                  💡 解决方法：请先上传时效标准Excel文件，系统会自动保存数据用于Plan vs Actual对比分析。
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 总体指标卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Package className="h-4 w-4 text-maersk-blue" />
              <span className="text-sm text-functional-mid-grey">总订单数</span>
            </div>
            <div className="text-2xl font-bold">{totalS2DOrders.toLocaleString()}</div>
            <div className="text-xs text-functional-mid-grey mt-1">已签收订单</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="h-4 w-4 text-accent-mid-green" />
              <span className="text-sm text-functional-mid-grey">平均Actual时效</span>
            </div>
            <div className="text-2xl font-bold">{overallAvgActualHours?.toFixed(1) || 0}h</div>
            <div className="text-xs text-functional-mid-grey mt-1">
              Plan: {overallAvgPlanHours?.toFixed(1) || 0}h
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="h-4 w-4 text-accent-mid-teal" />
              <span className="text-sm text-functional-mid-grey">72H达成率</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-xl font-bold ${performanceActual72H.color}`}>
                  {getActual72HRate()}%
                </div>
                <div className="text-xs text-functional-mid-grey">Actual</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-functional-mid-grey">
                  {getPlan72HRate()}%
                </div>
                <div className="text-xs text-functional-mid-grey">Plan</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="h-4 w-4 text-accent-mid-orange" />
              <span className="text-sm text-functional-mid-grey">SLA匹配率</span>
            </div>
            <div className="text-2xl font-bold">
              {matchingStats?.overallMatchingRate || 0}%
            </div>
            <div className="text-xs text-functional-mid-grey mt-1">
              已匹配 {matchingStats?.slaMatchedOrders?.toLocaleString() || 0} 单
            </div>
          </CardContent>
        </Card>
      </div>

      {/* S2D时效分布图表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-maersk-blue" />
            <span>S2D时效分布分析</span>
            {selectedBrand && (
              <Badge variant="outline" className="ml-2">{selectedBrand}</Badge>
            )}
          </CardTitle>
          <p className="text-sm text-functional-mid-grey">
            发运到签收（Ship to Delivery）时效区间统计
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* 24H */}
            <div className="text-center p-4 bg-accent-bright-green rounded-lg">
              <div className="text-sm text-functional-mid-grey mb-2">≤24小时</div>
              <div className="space-y-2">
                <div>
                  <div className="text-2xl font-bold text-accent-dark-green">
                    {(categories?.['24H']?.actualCount || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-functional-mid-grey">Actual ({getActual24HRate()}%)</div>
                </div>
                <div className="border-t border-accent-light-green pt-1">
                  <div className="text-lg font-bold text-accent-mid-green">
                    {(categories?.['24H']?.planCount || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-functional-mid-grey">Plan ({getPlan24HRate()}%)</div>
                </div>
              </div>
            </div>

            {/* 48H */}
            <div className="text-center p-4 bg-accent-bright-teal rounded-lg">
              <div className="text-sm text-functional-mid-grey mb-2">24-48小时</div>
              <div className="space-y-2">
                <div>
                  <div className="text-2xl font-bold text-accent-dark-teal">
                    {(categories?.['48H']?.actualCount || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-functional-mid-grey">Actual ({Math.round(((categories?.['48H']?.actualCount || 0) / totalS2DOrders) * 100)}%)</div>
                </div>
                <div className="border-t border-accent-light-teal pt-1">
                  <div className="text-lg font-bold text-accent-mid-teal">
                    {(categories?.['48H']?.planCount || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-functional-mid-grey">Plan ({Math.round(((categories?.['48H']?.planCount || 0) / totalS2DOrders) * 100)}%)</div>
                </div>
              </div>
            </div>

            {/* 72H */}
            <div className="text-center p-4 bg-accent-bright-orange rounded-lg">
              <div className="text-sm text-functional-mid-grey mb-2">48-72小时</div>
              <div className="space-y-2">
                <div>
                  <div className="text-2xl font-bold text-accent-dark-orange">
                    {(categories?.['72H']?.actualCount || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-functional-mid-grey">Actual ({Math.round(((categories?.['72H']?.actualCount || 0) / totalS2DOrders) * 100)}%)</div>
                </div>
                <div className="border-t border-accent-light-orange pt-1">
                  <div className="text-lg font-bold text-accent-mid-orange">
                    {(categories?.['72H']?.planCount || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-functional-mid-grey">Plan ({Math.round(((categories?.['72H']?.planCount || 0) / totalS2DOrders) * 100)}%)</div>
                </div>
              </div>
            </div>

            {/* 72H+ */}
            <div className="text-center p-4 bg-accent-bright-red rounded-lg">
              <div className="text-sm text-functional-mid-grey mb-2">&gt;72小时</div>
              <div className="space-y-2">
                <div>
                  <div className="text-2xl font-bold text-accent-dark-red">
                    {(categories?.['72H+']?.actualCount || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-functional-mid-grey">Actual ({Math.round(((categories?.['72H+']?.actualCount || 0) / totalS2DOrders) * 100)}%)</div>
                </div>
                <div className="border-t border-accent-light-red pt-1">
                  <div className="text-lg font-bold text-accent-mid-red">
                    {(categories?.['72H+']?.planCount || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-functional-mid-grey">Plan ({Math.round(((categories?.['72H+']?.planCount || 0) / totalS2DOrders) * 100)}%)</div>
                </div>
              </div>
            </div>
          </div>

          {/* 累计达成率进度条 - Plan vs Actual对比 */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">24H达成率</span>
                <div className="flex items-center space-x-3">
                  <span className="text-accent-dark-green font-bold">Actual: {getActual24HRate()}%</span>
                  <span className="text-functional-mid-grey">|</span>
                  <span className="text-accent-mid-green font-bold">Plan: {getPlan24HRate()}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Progress value={getActual24HRate()} className="h-2 bg-accent-bright-green" />
                <Progress value={getPlan24HRate()} className="h-1 bg-accent-light-green opacity-60" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">48H达成率</span>
                <div className="flex items-center space-x-3">
                  <span className="text-accent-dark-teal font-bold">Actual: {getActual48HRate()}%</span>
                  <span className="text-functional-mid-grey">|</span>
                  <span className="text-accent-mid-teal font-bold">Plan: {getPlan48HRate()}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Progress value={getActual48HRate()} className="h-2 bg-accent-bright-teal" />
                <Progress value={getPlan48HRate()} className="h-1 bg-accent-light-teal opacity-60" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">72H达成率</span>
                <div className="flex items-center space-x-3">
                  <span className={`font-bold ${performanceActual72H.color}`}>Actual: {getActual72HRate()}%</span>
                  <span className="text-functional-mid-grey">|</span>
                  <span className="text-accent-mid-orange font-bold">Plan: {getPlan72HRate()}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Progress value={getActual72HRate()} className={`h-2 ${performanceActual72H.bgColor}`} />
                <Progress value={getPlan72HRate()} className="h-1 bg-accent-light-orange opacity-60" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 品牌和快递商详细分析 */}
      <Tabs defaultValue="brand" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="brand" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>按品牌分析</span>
          </TabsTrigger>
          <TabsTrigger value="carrier" className="flex items-center space-x-2">
            <Truck className="h-4 w-4" />
            <span>按快递商分析</span>
          </TabsTrigger>
        </TabsList>

        {/* 品牌分析 */}
        <TabsContent value="brand" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(brandStats || {}).map(([brand, stats]: [string, any]) => (
              <Card key={brand}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{brand}</CardTitle>
                    <Badge variant="outline">{stats.total.toLocaleString()} 单</Badge>
                  </div>
                  <div className="text-sm text-functional-mid-grey">
                    <div>Actual平均: {stats.avgActualHours?.toFixed(1) || 0}h</div>
                    <div>Plan平均: {stats.avgPlanHours?.toFixed(1) || 0}h</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.keys(stats.actualCategories || {}).map((timeRange) => {
                      const actualCount = stats.actualCategories[timeRange] || 0;
                      const planCount = stats.planCategories[timeRange] || 0;
                      const actualPercentage = stats.total > 0 ? Math.round((actualCount / stats.total) * 100) : 0;
                      const planPercentage = stats.total > 0 ? Math.round((planCount / stats.total) * 100) : 0;
                      const colors: Record<string, string> = {
                        '24H': 'bg-accent-mid-green',
                        '48H': 'bg-accent-mid-teal',
                        '72H': 'bg-accent-mid-orange',
                        '72H+': 'bg-accent-mid-red'
                      };
                      
                      return (
                        <div key={timeRange} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{timeRange}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-functional-dark-grey">A:{actualCount}</span>
                              <span className="text-functional-mid-grey">P:{planCount}</span>
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="w-full bg-functional-bright-grey rounded-full h-1.5">
                              <div 
                                className={`${colors[timeRange]} h-1.5 rounded-full transition-all`}
                                style={{ width: `${actualPercentage}%` }}
                              />
                            </div>
                            <div className="w-full bg-functional-bright-grey rounded-full h-1 opacity-60">
                              <div 
                                className={`${colors[timeRange]} opacity-50 h-1 rounded-full transition-all`}
                                style={{ width: `${planPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 快递商分析 */}
        <TabsContent value="carrier" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(carrierStats || {}).map(([carrier, stats]: [string, any]) => (
              <Card key={carrier}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{carrier}</CardTitle>
                    <Badge variant="outline">{stats.total.toLocaleString()} 单</Badge>
                  </div>
                  <div className="text-sm text-functional-mid-grey">
                    <div>Actual平均: {stats.avgActualHours?.toFixed(1) || 0}h</div>
                    <div>Plan平均: {stats.avgPlanHours?.toFixed(1) || 0}h</div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.keys(stats.actualCategories || {}).map((timeRange) => {
                      const actualCount = stats.actualCategories[timeRange] || 0;
                      const planCount = stats.planCategories[timeRange] || 0;
                      const actualPercentage = stats.total > 0 ? Math.round((actualCount / stats.total) * 100) : 0;
                      const planPercentage = stats.total > 0 ? Math.round((planCount / stats.total) * 100) : 0;
                      const colors: Record<string, string> = {
                        '24H': 'bg-accent-mid-green',
                        '48H': 'bg-accent-mid-teal',
                        '72H': 'bg-accent-mid-orange',
                        '72H+': 'bg-accent-mid-red'
                      };
                      
                      return (
                        <div key={timeRange} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{timeRange}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-functional-dark-grey">A:{actualCount}</span>
                              <span className="text-functional-mid-grey">P:{planCount}</span>
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="w-full bg-functional-bright-grey rounded-full h-1.5">
                              <div 
                                className={`${colors[timeRange]} h-1.5 rounded-full transition-all`}
                                style={{ width: `${actualPercentage}%` }}
                              />
                            </div>
                            <div className="w-full bg-functional-bright-grey rounded-full h-1 opacity-60">
                              <div 
                                className={`${colors[timeRange]} opacity-50 h-1 rounded-full transition-all`}
                                style={{ width: `${planPercentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 说明卡片 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start space-x-2 text-sm text-functional-mid-grey">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>S2D时效说明：</strong>
              Ship to Delivery（发运到签收）时效指从仓库发运（WMS_OUTBOUND_TIME）到客户签收（DIS_STATUS=99）的实际配送时长。
              通过对比各品牌、快递商在不同时效区间的订单分布，可以评估配送效率和服务质量。
              {matchingStats?.slaMatchedOrders > 0 && (
                <span className="block mt-1">
                  当前已为 {matchingStats.slaMatchedOrders.toLocaleString()} 单订单匹配Plan时效标准，
                  可通过Actual vs Plan对比分析时效达成情况。
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

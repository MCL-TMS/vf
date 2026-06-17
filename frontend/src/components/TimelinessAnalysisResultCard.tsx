import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { TrendingUp, TrendingDown, Clock, Target, Award, AlertTriangle } from "lucide-react";

interface TimelinessAnalysisResultCardProps {
  analysisResult: any;
  onClose?: () => void;
}

export function TimelinessAnalysisResultCard({ 
  analysisResult, 
  onClose 
}: TimelinessAnalysisResultCardProps) {
  if (!analysisResult) return null;

  const { data } = analysisResult;
  const { summary, results, analysisType } = data || {};
  const { s2d, c2d } = results || {};

  // 获取分析类型
  const isS2DAnalysis = analysisType === 'S2D' || analysisType === 'both';
  const isC2DAnalysis = analysisType === 'C2D' || analysisType === 'both';

  // Plan vs Actual性能评估
  const getPerformanceLevel = (onTimeRate: number) => {
    if (onTimeRate >= 90) return { level: '优秀', color: 'text-accent-dark-green', bgColor: 'bg-accent-bright-green', icon: Award };
    if (onTimeRate >= 80) return { level: '良好', color: 'text-accent-dark-teal', bgColor: 'bg-accent-bright-teal', icon: TrendingUp };
    if (onTimeRate >= 70) return { level: '一般', color: 'text-accent-dark-orange', bgColor: 'bg-accent-bright-orange', icon: Clock };
    return { level: '需改进', color: 'text-accent-dark-red', bgColor: 'bg-accent-bright-red', icon: AlertTriangle };
  };

  // 渲染Plan vs Actual分析卡片
  const renderPlanVsActualCard = (data: any, title: string, subtitle: string, color: string) => {
    if (!data) return null;

    const performance = getPerformanceLevel(data.onTimeRate || 0);
    const IconComponent = performance.icon;

    return (
      <Card className={`border-${color}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Target className={`h-5 w-5 text-${color}`} />
              <span>{title}</span>
            </span>
            <Badge variant="secondary" className="text-xs">
              {subtitle}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 总体达成率 */}
            <div className="text-center">
              <div className={`text-4xl font-bold ${performance.color} mb-2`}>
                {data.onTimeRate || 0}%
              </div>
              <div className="text-sm text-muted-foreground mb-3 flex items-center justify-center space-x-2">
                <IconComponent className="h-4 w-4" />
                <span>Plan时效达成率 - {performance.level}</span>
              </div>
              <Progress 
                value={data.onTimeRate || 0} 
                className="h-3"
              />
            </div>

            {/* Plan vs Actual分布 */}
            <div className="space-y-3">
              {data.data?.map((item: any, index: number) => {
                const colors = [
                  'bg-accent-mid-green',
                  'bg-accent-mid-teal', 
                  'bg-accent-mid-orange'
                ];
                
                return (
                  <div key={item.category} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.category}</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{item.count?.toLocaleString()}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.percentage}%
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full bg-functional-bright-grey rounded-full h-2">
                      <div 
                        className={`${colors[index]} h-2 rounded-full transition-all duration-300`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 详细统计 */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-lg font-semibold text-accent-mid-green">
                  {data.early || 0}
                </div>
                <div className="text-xs text-muted-foreground">提前完成</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-accent-mid-teal">
                  {data.onTime || 0}
                </div>
                <div className="text-xs text-muted-foreground">按时完成</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-accent-mid-orange">
                  {data.delayed || 0}
                </div>
                <div className="text-xs text-muted-foreground">延迟完成</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Plan vs Actual 总体概览 */}
      <Card className="border-accent-mid-teal">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-accent-dark-teal" />
              <span>Plan vs Actual 时效分析结果</span>
            </span>
            <Badge variant="outline" className="text-xs">
              共 {summary?.totalOrders?.toLocaleString() || 0} 条订单
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* 总体达成率 */}
            <div className="text-center">
              <div className="text-3xl font-bold text-accent-dark-teal mb-2">
                {summary?.overallOnTimeRate || 0}%
              </div>
              <div className="text-sm text-accent-mid-teal mb-3">总体达成率</div>
              <Progress 
                value={summary?.overallOnTimeRate || 0} 
                className="h-2"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Plan vs Actual 综合评估
              </div>
            </div>

            {/* S2D达成率 */}
            {isS2DAnalysis && (
              <div className="text-center">
                <div className="text-3xl font-bold text-functional-dark-blue mb-2">
                  {summary?.s2dOnTimeRate || 0}%
                </div>
                <div className="text-sm text-functional-mid-blue mb-3">S2D达成率</div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="text-xs text-muted-foreground">
                    发运到签收时效
                  </div>
                </div>
              </div>
            )}

            {/* C2D达成率 */}
            {isC2DAnalysis && (
              <div className="text-center">
                <div className="text-3xl font-bold text-accent-dark-orange mb-2">
                  {summary?.c2dOnTimeRate || 0}%
                </div>
                <div className="text-sm text-accent-mid-orange mb-3">C2D达成率</div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="text-xs text-muted-foreground">
                    创建到签收时效
                  </div>
                </div>
              </div>
            )}

            {/* Plan时效匹配率 */}
            <div className="text-center">
              <div className="text-3xl font-bold text-accent-dark-green mb-2">
                {summary?.matchingRate || 0}%
              </div>
              <div className="text-sm text-accent-mid-green mb-3">Plan匹配率</div>
              <div className="text-xs text-muted-foreground mt-1">
                {summary?.planTimeMatched || 0} / {summary?.totalOrders || 0} 匹配成功
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan vs Actual分析详情 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* S2D Plan vs Actual分析 */}
        {isS2DAnalysis && renderPlanVsActualCard(
          s2d, 
          "S2D时效分析", 
          "发运到签收", 
          "functional-mid-blue"
        )}

        {/* C2D Plan vs Actual分析 */}
        {isC2DAnalysis && renderPlanVsActualCard(
          c2d, 
          "C2D时效分析", 
          "创建到签收", 
          "accent-mid-orange"
        )}
      </div>

      {/* 业务洞察和建议 */}
      <Card className="border-accent-mid-green">
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-accent-dark-green" />
            <span>Plan vs Actual 业务洞察</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 核心指标解读 */}
              <div>
                <h4 className="font-medium mb-3 text-accent-dark-teal">核心指标解读</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>总订单数:</span>
                    <span className="font-semibold">{summary?.totalOrders?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Plan时效匹配:</span>
                    <span className="font-semibold text-accent-dark-green">
                      {summary?.planTimeMatched?.toLocaleString() || 0} 条
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>平均实际时效:</span>
                    <span className="font-semibold">{summary?.overallAvgHours || 0}小时</span>
                  </div>
                  <div className="flex justify-between">
                    <span>时效达成范围:</span>
                    <span className="font-semibold">
                      {summary?.minDeliveryTime || 0}h - {summary?.maxDeliveryTime || 0}h
                    </span>
                  </div>
                </div>
              </div>

              {/* 改进建议 */}
              <div>
                <h4 className="font-medium mb-3 text-accent-dark-orange">改进建议</h4>
                <div className="space-y-2 text-sm">
                  {(summary?.overallOnTimeRate || 0) < 80 && (
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-4 w-4 text-accent-mid-orange mt-0.5 flex-shrink-0" />
                      <span>总体达成率偏低，建议优化物流时效管理</span>
                    </div>
                  )}
                  {(summary?.s2dOnTimeRate || 0) < (summary?.c2dOnTimeRate || 0) && (
                    <div className="flex items-start space-x-2">
                      <Clock className="h-4 w-4 text-functional-mid-blue mt-0.5 flex-shrink-0" />
                      <span>S2D时效相对较低，关注发运到签收环节</span>
                    </div>
                  )}
                  {(summary?.matchingRate || 0) < 100 && (
                    <div className="flex items-start space-x-2">
                      <Target className="h-4 w-4 text-accent-mid-teal mt-0.5 flex-shrink-0" />
                      <span>Plan时效匹配不完整，建议完善时效标准表</span>
                    </div>
                  )}
                  {(summary?.overallOnTimeRate || 0) >= 90 && (
                    <div className="flex items-start space-x-2">
                      <Award className="h-4 w-4 text-accent-mid-green mt-0.5 flex-shrink-0" />
                      <span>时效表现优秀，可考虑制定更高标准</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
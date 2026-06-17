import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  Database, 
  GitCompare,
  RefreshCw,
  Settings,
  Clock,
  AlertCircle
} from 'lucide-react';
import type { DetailedConsistencyReport } from '../utils/unifiedCourierDataProcessor';

interface CourierDataConsistencyReportProps {
  report: DetailedConsistencyReport;
  className?: string;
}

export function CourierDataConsistencyReport({ 
  report, 
  className = '' 
}: CourierDataConsistencyReportProps) {
  
  if (!report) {
    return null;
  }

  const { isConsistent, issues, summary, courierComparison, possibleCauses, recommendations } = report;

  // 获取状态颜色
  const getStatusColor = (isConsistent: boolean) => {
    return isConsistent ? 'text-accent-dark-green' : 'text-accent-dark-red';
  };

  const getStatusIcon = (isConsistent: boolean) => {
    return isConsistent ? CheckCircle : AlertTriangle;
  };

  const getStatusBadge = (isConsistent: boolean) => {
    return isConsistent ? (
      <Badge className="bg-accent-bright-green text-accent-dark-green border-accent-light-green">
        数据一致
      </Badge>
    ) : (
      <Badge className="bg-accent-bright-red text-accent-dark-red border-accent-light-red">
        存在差异
      </Badge>
    );
  };

  const getDifferenceSeverity = (percentage: number) => {
    if (percentage < 1) return { level: 'low', color: 'text-accent-dark-green', label: '轻微' };
    if (percentage < 5) return { level: 'medium', color: 'text-accent-dark-orange', label: '中等' };
    return { level: 'high', color: 'text-accent-dark-red', label: '严重' };
  };

  const StatusIcon = getStatusIcon(isConsistent);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 总体状态 */}
      <Card className="maersk-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <StatusIcon className={`h-5 w-5 ${getStatusColor(isConsistent)}`} />
              <span>快递商数据一致性报告</span>
            </div>
            {getStatusBadge(isConsistent)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-maersk-blue">
                {summary.overviewCouriers}
              </div>
              <div className="text-sm text-functional-mid-grey">总览快递商</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-maersk-blue">
                {summary.logisticsCouriers}
              </div>
              <div className="text-sm text-functional-mid-grey">物流快递商</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-accent-mid-orange">
                {summary.ordersDifference.toLocaleString()}
              </div>
              <div className="text-sm text-functional-mid-grey">订单差异</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-semibold ${getDifferenceSeverity(summary.ordersDifferencePercentage).color}`}>
                {summary.ordersDifferencePercentage.toFixed(2)}%
              </div>
              <div className="text-sm text-functional-mid-grey">差异比例</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 问题汇总 */}
      {issues.length > 0 && (
        <Alert className="maersk-alert-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-medium">发现 {issues.length} 个数据一致性问题：</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* 快递商详细对比 */}
      <Card className="maersk-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GitCompare className="h-5 w-5 text-maersk-blue" />
            <span>快递商数据详细对比</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {courierComparison
              .sort((a, b) => b.differences.ordersPercentageDiff - a.differences.ordersPercentageDiff)
              .map((courier) => {
                const severity = getDifferenceSeverity(courier.differences.ordersPercentageDiff);
                
                return (
                  <div 
                    key={courier.carrierId} 
                    className={`p-4 rounded-lg border ${
                      courier.differences.isSignificant 
                        ? 'border-accent-light-red bg-accent-bright-red' 
                        : 'border-functional-light-grey bg-functional-bright-grey'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="font-medium text-maersk-black">
                          {courier.name} ({courier.carrierId})
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            courier.differences.isSignificant
                              ? 'bg-accent-bright-red text-accent-dark-red border-accent-mid-red'
                              : 'bg-functional-bright-grey text-functional-dark-grey'
                          }`}
                        >
                          {severity.label}差异
                        </Badge>
                      </div>
                      <div className="text-sm text-functional-mid-grey">
                        {courier.differences.analysis}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* 总览数据 */}
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-functional-dark-blue flex items-center space-x-1">
                          <Database className="h-4 w-4" />
                          <span>总览接口数据</span>
                        </div>
                        {courier.overviewData ? (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="text-functional-mid-grey">总订单</div>
                              <div className="font-medium">{courier.overviewData.totalOrders.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-functional-mid-grey">签收率</div>
                              <div className="font-medium">{courier.overviewData.deliveryRate.toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-functional-mid-grey">已揽收</div>
                              <div className="font-medium">{courier.overviewData.pickedCount.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-functional-mid-grey">已签收</div>
                              <div className="font-medium">{courier.overviewData.deliveredCount.toLocaleString()}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-functional-mid-grey text-sm">无数据</div>
                        )}
                      </div>

                      {/* 物流数据 */}
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-accent-dark-teal flex items-center space-x-1">
                          <Database className="h-4 w-4" />
                          <span>物流接口数据</span>
                        </div>
                        {courier.logisticsData ? (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className="text-functional-mid-grey">总订单</div>
                              <div className="font-medium">{courier.logisticsData.totalOrders.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-functional-mid-grey">签收率</div>
                              <div className="font-medium">{courier.logisticsData.deliveryRate.toFixed(1)}%</div>
                            </div>
                            <div>
                              <div className="text-functional-mid-grey">已揽收</div>
                              <div className="font-medium">{courier.logisticsData.pickedOrders.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-functional-mid-grey">已签收</div>
                              <div className="font-medium">{courier.logisticsData.deliveredOrders.toLocaleString()}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-functional-mid-grey text-sm">无数据</div>
                        )}
                      </div>
                    </div>

                    {/* 差异指标 */}
                    {courier.differences.isSignificant && (
                      <div className="mt-3 pt-3 border-t border-accent-light-red">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <div className="text-functional-mid-grey">订单数差异</div>
                            <div className={`font-medium ${severity.color}`}>
                              {courier.differences.ordersDiff.toLocaleString()}单 
                              ({courier.differences.ordersPercentageDiff.toFixed(1)}%)
                            </div>
                          </div>
                          <div>
                            <div className="text-functional-mid-grey">配送率差异</div>
                            <div className={`font-medium ${severity.color}`}>
                              {courier.differences.deliveryRateDiff.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* 可能原因分析 */}
      {possibleCauses.length > 0 && (
        <Card className="maersk-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-accent-mid-orange" />
              <span>可能原因分析</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {possibleCauses.map((cause, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-accent-bright-orange rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-accent-mid-orange text-maersk-white flex items-center justify-center text-xs font-medium mt-0.5">
                    {index + 1}
                  </div>
                  <div className="text-sm text-accent-dark-orange">{cause}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 修复建议 */}
      {recommendations.length > 0 && (
        <Card className="maersk-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-accent-mid-green" />
              <span>修复建议</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-accent-bright-green rounded-lg">
                  <CheckCircle className="h-5 w-5 text-accent-mid-green mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-accent-dark-green">{recommendation}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 监控建议 */}
      <Alert className="maersk-alert-info">
        <Clock className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <div className="font-medium">持续监控建议：</div>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>设置数据差异阈值告警（建议：订单数差异 &gt; 5% 或配送率差异 &gt; 2%）</li>
              <li>定期对比两个接口的响应时间戳，确保数据时效性</li>
              <li>建立自动化数据一致性检查，每小时运行一次</li>
              <li>记录历史差异数据，分析差异趋势和模式</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
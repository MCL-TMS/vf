import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { TrendingUp, TrendingDown, Clock, AlertCircle, Loader2 } from "lucide-react";
import { ApiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext'; // 🔥 新增：导入认证上下文

// 快递商图标映射
const COURIER_LOGOS: Record<string, string> = {
  'SF': '🚀',
  'ZTO': '🚚',
  'YTO': '📦',
  'STO': '🏃',
  'JD': '🛒',
  'EMS': '✉️',
  'YUNDA': '🌟'
};

// 快递商颜色映射
const COURIER_COLORS: Record<string, {
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  'SF': {
    color: 'text-accent-dark-green',
    bgColor: 'bg-accent-bright-green',
    borderColor: 'border-accent-light-green'
  },
  'ZTO': {
    color: 'text-functional-dark-blue',
    bgColor: 'bg-functional-bright-blue',
    borderColor: 'border-functional-light-blue'
  },
  'YTO': {
    color: 'text-accent-dark-teal',
    bgColor: 'bg-accent-bright-teal',
    borderColor: 'border-accent-light-teal'
  },
  'STO': {
    color: 'text-accent-dark-orange',
    bgColor: 'bg-accent-bright-orange',
    borderColor: 'border-accent-light-orange'
  },
  'default': {
    color: 'text-functional-dark-grey',
    bgColor: 'bg-functional-light-grey',
    borderColor: 'border-functional-mid-grey'
  }
};

const formatNumber = (value: number | null | undefined) => Number(value || 0).toLocaleString();

const calculateSuccessRate = (successCount: number, totalCount: number) => {
  return totalCount > 0 ? (successCount / totalCount) * 100 : 0;
};

interface InterceptionAnalysisProps {
  dateRange: {
    from: string;
    to: string;
  };
  selectedBrand?: string;
  platform?: string;
  selfFlag?: string;
}

export function InterceptionAnalysis({
  dateRange,
  selectedBrand = 'all',
  platform = 'all',
  selfFlag = 'all'
}: InterceptionAnalysisProps) {
  const { user } = useAuth(); // 🔥 新增：获取用户信息
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interceptionData, setInterceptionData] = useState<any>(null);

  // 获取拦截分析数据
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🛑 [InterceptionAnalysis] 请求拦截分析数据:', {
          dateRange,
          selectedBrand,
          platform,
          selfFlag,
          userBrands: user?.customerNos // 🔥 新增：记录用户品牌权限
        });

        const response = await ApiService.getInterceptionData({
          dateRange: {
            startDate: dateRange.from,
            endDate: dateRange.to
          },
          brand: selectedBrand,
          platform,
          selfFlag,
          userBrands: user?.customerNos, // 🔥 新增：传递用户品牌权限
          signal: controller.signal
        });

        if (!isMounted) return;

        if (response.success && response.data) {
          console.log('✅ [InterceptionAnalysis] 拦截分析数据获取成功:', response.data);
          setInterceptionData(response.data);
        } else {
          throw new Error('数据格式错误');
        }
      } catch (err: any) {
        if (!isMounted) return;
        
        if (err.name === 'AbortError') {
          console.log('⏹️ [InterceptionAnalysis] 请求已取消');
          return;
        }

        console.error('❌ [InterceptionAnalysis] 数据获取失败:', err);
        setError(err.message || '获取拦截分析数据失败');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [dateRange, selectedBrand, platform, selfFlag, user]);

  // 处理快递商拦截数据
  const courierInterceptionData = useMemo(() => {
    if (!interceptionData?.carrierStats) return [];

    return interceptionData.carrierStats.map((stat: any) => {
      const carrierId = stat.carrierId;
      const colors = COURIER_COLORS[carrierId] || COURIER_COLORS['default'];
      const warehouseCount = stat.warehouseCount || 0;
      const externalCount = stat.externalCount || 0;
      const warehouseSuccessCount = stat.warehouseSuccessCount || stat.warehouse_success_count || 0;
      const externalSuccessCount = stat.externalSuccessCount || stat.external_success_count || 0;
      const warehouseAvgHours = stat.warehouseAvgHours || stat.warehouse_avg_hours || 0;
      const externalAvgHours = stat.externalAvgHours || stat.external_avg_hours || 0;

      return {
        id: carrierId,
        name: stat.carrierId,
        logo: COURIER_LOGOS[carrierId] || '🚛',
        ...colors,
        internal: {
          count: warehouseCount,
          successCount: warehouseSuccessCount,
          successRate: calculateSuccessRate(warehouseSuccessCount, warehouseCount),
          avgTime: warehouseAvgHours,
          trend: 0 // 暂无趋势数据
        },
        external: {
          count: externalCount,
          successCount: externalSuccessCount,
          successRate: calculateSuccessRate(externalSuccessCount, externalCount),
          avgTime: externalAvgHours,
          trend: 0 // 暂无趋势数据
        },
        totalCount: stat.totalCount,
        successCount: stat.successCount,
        successRate: stat.successRate
      };
    });
  }, [interceptionData]);

  // 格式化时长显示（小时）
  const formatTime = (hours: number) => {
    if (hours < 1) {
      return `${(hours * 60).toFixed(0)}分钟`;
    } else if (hours < 24) {
      return `${hours.toFixed(1)}小时`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return remainingHours > 0 
        ? `${days}天${remainingHours.toFixed(0)}小时` 
        : `${days}天`;
    }
  };

  // 加载状态
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-maersk-blue" />
            <p className="text-sm text-functional-mid-grey">加载拦截分析数据...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <AlertCircle className="h-8 w-8 text-accent-mid-red" />
            <p className="text-sm text-functional-mid-grey">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 无数据状态
  if (!interceptionData || courierInterceptionData.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-functional-mid-grey">暂无拦截分析数据</p>
        </CardContent>
      </Card>
    );
  }

  const overview = interceptionData.overview || {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>🛡️</span>
          <span>拦截分析 - 快递商统计</span>
          <Badge variant="default" className="text-xs bg-green-600">
            ✓ 真实数据
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 整体统计概览 */}
          <div className="bg-functional-bright-blue rounded-lg p-4">
            <h4 className="font-medium text-maersk-black mb-3">整体拦截统计</h4>
            <div className="grid grid-cols-4 gap-4 text-center text-sm">
              <div>
                <div className="font-semibold text-functional-dark-blue">
                  {overview.totalCount?.toLocaleString() || 0}
                </div>
                <div className="text-functional-mid-grey">总拦截数</div>
              </div>
              <div>
                <div className="font-semibold text-accent-mid-green">
                  {overview.successRate?.toFixed(1) || 0}%
                </div>
                <div className="text-functional-mid-grey">拦截成功率</div>
              </div>
              <div>
                <div className="font-semibold text-accent-mid-teal">
                  {overview.warehouseRate?.toFixed(1) || 0}%
                </div>
                <div className="text-functional-mid-grey">库内拦截率</div>
              </div>
              <div>
                <div className="font-semibold text-accent-mid-orange">
                  {formatTime(overview.avgCompletionHours || 0)}
                </div>
                <div className="text-functional-mid-grey">平均完结用时</div>
              </div>
            </div>
          </div>

          <h4 className="font-medium text-maersk-black">库内外拦截按快递商统计</h4>
          
          {courierInterceptionData.map((courier: any, index: number) => (
            <div 
              key={courier.id || index} 
              className={`border ${courier.borderColor} rounded-lg p-4 space-y-4 hover:${courier.bgColor} hover:bg-opacity-30 transition-colors`}
            >
              {/* 快递商头部信息 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${courier.bgColor} rounded-full flex items-center justify-center border ${courier.borderColor}`}>
                    <span className="text-lg">{courier.logo}</span>
                  </div>
                  <div>
                    <h5 className="font-medium text-maersk-black">{courier.name}</h5>
                    <div className="text-xs text-functional-mid-grey">
                      总拦截: {formatNumber(courier.totalCount)} 单
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className={`${courier.bgColor} ${courier.color} ${courier.borderColor}`}>
                    综合成功率: {(courier.successRate || 0).toFixed(1)}%
                  </Badge>
                </div>
              </div>

              {/* 库内外拦截对比 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 库内拦截 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h6 className="text-sm font-medium text-maersk-black">库内拦截</h6>
                    <Badge variant="default" className="text-xs">
                      {(courier.internal.successRate || 0).toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-functional-mid-grey">拦截数量:</span>
                      <span className="text-maersk-black">{formatNumber(courier.internal.count)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-functional-mid-grey">成功数量:</span>
                      <span className="text-maersk-black">{formatNumber(courier.internal.successCount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-functional-mid-grey">平均时长:</span>
                      <span className="text-maersk-black">{formatTime(courier.internal.avgTime)}</span>
                    </div>
                  </div>
                  <Progress value={courier.internal.successRate} className="h-2" />
                </div>

                {/* 库外拦截 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h6 className="text-sm font-medium text-maersk-black">库外拦截</h6>
                    <Badge 
                      variant={courier.external.successRate >= 75 ? "default" : "destructive"} 
                      className="text-xs"
                    >
                      {(courier.external.successRate || 0).toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-functional-mid-grey">拦截数量:</span>
                      <span className="text-maersk-black">{formatNumber(courier.external.count)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-functional-mid-grey">成功数量:</span>
                      <span className="text-maersk-black">{formatNumber(courier.external.successCount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-functional-mid-grey">平均时长:</span>
                      <span className="text-maersk-black">{formatTime(courier.external.avgTime)}</span>
                    </div>
                  </div>
                  <Progress value={courier.external.successRate} className="h-2" />
                </div>
              </div>

              {/* 快递商总结 */}
              <div className="pt-2 border-t border-functional-light-grey">
                <div className="grid grid-cols-3 gap-4 text-center text-xs">
                  <div>
                    <div className="font-semibold text-maersk-black">
                      {formatNumber(courier.successCount)}
                    </div>
                    <div className="text-functional-mid-grey">成功拦截</div>
                  </div>
                  <div>
                    <div className="font-semibold text-maersk-black">
                      {formatTime(
                        (courier.internal.count * courier.internal.avgTime + 
                         courier.external.count * courier.external.avgTime) / 
                        (courier.internal.count + courier.external.count) || 0
                      )}
                    </div>
                    <div className="text-functional-mid-grey">平均时长</div>
                  </div>
                  <div>
                    <div className={`font-semibold ${
                      courier.external.count > courier.internal.count 
                        ? 'text-accent-mid-orange' 
                        : 'text-accent-mid-green'
                    }`}>
                      {(
                        (courier.external.count / (courier.internal.count + courier.external.count)) * 100
                      ).toFixed(1)}%
                    </div>
                    <div className="text-functional-mid-grey">库外占比</div>
                  </div>
                </div>
              </div>
            </div>
          ))}

        </div>
      </CardContent>
    </Card>
  );
}
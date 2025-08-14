import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import { interceptionData } from "../data/orderData";

export function InterceptionAnalysis() {
  const internalData = interceptionData.find(d => d.type === 'warehouse_internal');
  const externalData = interceptionData.find(d => d.type === 'warehouse_external');

  // 快递商拦截数据
  const courierInterceptionData = [
    {
      name: '顺丰',
      logo: '🚀',
      color: 'text-accent-dark-green',
      bgColor: 'bg-accent-bright-green',
      borderColor: 'border-accent-light-green',
      internal: {
        count: 287,
        successRate: 96.8,
        avgTime: 15.2,
        trend: -3.5
      },
      external: {
        count: 156,
        successRate: 78.2,
        avgTime: 185.6,
        trend: 2.8
      }
    },
    {
      name: '中通',
      logo: '🚚',
      color: 'text-functional-dark-blue',
      bgColor: 'bg-functional-bright-blue',
      borderColor: 'border-functional-light-blue',
      internal: {
        count: 342,
        successRate: 94.1,
        avgTime: 18.7,
        trend: -1.2
      },
      external: {
        count: 198,
        successRate: 72.3,
        avgTime: 203.4,
        trend: 4.1
      }
    }
  ];

  // 计算总体平均时长
  const totalCount = (internalData?.count || 0) + (externalData?.count || 0);
  const weightedAvgTime = totalCount > 0 ? 
    (((internalData?.count || 0) * (internalData?.avgTime || 0) + 
      (externalData?.count || 0) * (externalData?.avgTime || 0)) / totalCount) : 0;

  // 格式化时长显示
  const formatTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes.toFixed(1)}分钟`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}小时${mins.toFixed(0)}分钟` : `${hours}小时`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>🛡️</span>
          <span>拦截分析 - 快递商统计</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <h4 className="font-medium text-maersk-black">库内外拦截按快递商统计</h4>
          
          {courierInterceptionData.map((courier, index) => (
            <div key={index} className={`border ${courier.borderColor} rounded-lg p-4 space-y-4 hover:${courier.bgColor} hover:bg-opacity-30 transition-colors`}>
              {/* 快递商头部信息 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 ${courier.bgColor} rounded-full flex items-center justify-center border ${courier.borderColor}`}>
                    <span className="text-lg">{courier.logo}</span>
                  </div>
                  <div>
                    <h5 className="font-medium text-maersk-black">{courier.name}</h5>
                    <div className="text-xs text-functional-mid-grey">
                      总拦截: {(courier.internal.count + courier.external.count).toLocaleString()} 单
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className={`${courier.bgColor} ${courier.color} ${courier.borderColor}`}>
                    综合成功率: {(
                      (courier.internal.count * courier.internal.successRate + courier.external.count * courier.external.successRate) / 
                      (courier.internal.count + courier.external.count)
                    ).toFixed(1)}%
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
                      {courier.internal.successRate}%
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-functional-mid-grey">拦截数量:</span>
                      <span className="text-maersk-black">{courier.internal.count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-functional-mid-grey">平均时长:</span>
                      <div className="flex items-center space-x-1">
                        <span className="text-maersk-black">{formatTime(courier.internal.avgTime)}</span>
                        <div className={`flex items-center space-x-1 ${courier.internal.trend >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                          {courier.internal.trend >= 0 ? (
                            <TrendingUp className="h-2 w-2" />
                          ) : (
                            <TrendingDown className="h-2 w-2" />
                          )}
                          <span>{Math.abs(courier.internal.trend)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Progress value={courier.internal.successRate} className="h-2" />
                </div>

                {/* 库外拦截 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h6 className="text-sm font-medium text-maersk-black">库外拦截</h6>
                    <Badge variant={courier.external.successRate >= 75 ? "default" : "destructive"} className="text-xs">
                      {courier.external.successRate}%
                    </Badge>
                  </div>
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-functional-mid-grey">拦截数量:</span>
                      <span className="text-maersk-black">{courier.external.count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-functional-mid-grey">平均时长:</span>
                      <div className="flex items-center space-x-1">
                        <span className="text-maersk-black">{formatTime(courier.external.avgTime)}</span>
                        <div className={`flex items-center space-x-1 ${courier.external.trend >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                          {courier.external.trend >= 0 ? (
                            <TrendingUp className="h-2 w-2" />
                          ) : (
                            <TrendingDown className="h-2 w-2" />
                          )}
                          <span>{Math.abs(courier.external.trend)}%</span>
                        </div>
                      </div>
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
                      {Math.round((courier.internal.count * courier.internal.successRate + courier.external.count * courier.external.successRate) / 100).toLocaleString()}
                    </div>
                    <div className="text-functional-mid-grey">成功拦截</div>
                  </div>
                  <div>
                    <div className="font-semibold text-maersk-black">
                      {formatTime((courier.internal.count * courier.internal.avgTime + courier.external.count * courier.external.avgTime) / (courier.internal.count + courier.external.count))}
                    </div>
                    <div className="text-functional-mid-grey">平均时长</div>
                  </div>
                  <div>
                    <div className={`font-semibold ${courier.external.count > courier.internal.count ? 'text-accent-mid-orange' : 'text-accent-mid-green'}`}>
                      {((courier.external.count / (courier.internal.count + courier.external.count)) * 100).toFixed(1)}%
                    </div>
                    <div className="text-functional-mid-grey">库外占比</div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 快递商汇总统计 */}
          <div className="border-t border-functional-light-grey pt-4">
            <h4 className="text-sm font-medium mb-3 text-maersk-black">快递商拦截表现汇总</h4>
            <div className="grid grid-cols-4 gap-4 text-center text-sm">
              <div>
                <div className="font-semibold text-functional-dark-blue">
                  {courierInterceptionData.reduce((sum, c) => sum + c.internal.count + c.external.count, 0).toLocaleString()}
                </div>
                <div className="text-functional-mid-grey">总拦截数</div>
              </div>
              <div>
                <div className="font-semibold text-accent-mid-green">
                  {(courierInterceptionData.reduce((sum, c) => 
                    sum + (c.internal.count * c.internal.successRate + c.external.count * c.external.successRate) / 
                    (c.internal.count + c.external.count), 0) / courierInterceptionData.length).toFixed(1)}%
                </div>
                <div className="text-functional-mid-grey">平均成功率</div>
              </div>
              <div>
                <div className="font-semibold text-accent-mid-teal">
                  {courierInterceptionData.reduce((sum, c) => 
                    sum + Math.round((c.internal.count * c.internal.successRate + c.external.count * c.external.successRate) / 100), 0).toLocaleString()}
                </div>
                <div className="text-functional-mid-grey">成功拦截总数</div>
              </div>
              <div>
                <div className="font-semibold text-accent-mid-orange">
                  {(courierInterceptionData.reduce((sum, c) => 
                    sum + (c.external.count / (c.internal.count + c.external.count)), 0) / 
                    courierInterceptionData.length * 100).toFixed(1)}%
                </div>
                <div className="text-functional-mid-grey">平均库外占比</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
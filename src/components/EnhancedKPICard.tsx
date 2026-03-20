import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { TrendingUp, TrendingDown, AlertTriangle, Info, Code } from "lucide-react";
import { OrderKPIData } from "../data/orderData";
import { formatGrowthRate, analyzeGrowthTrend } from "../utils/apiDataTransformer";

interface EnhancedKPICardProps {
  data: OrderKPIData;
  onDetailClick?: (data: OrderKPIData) => void;
}

export function EnhancedKPICard({ data, onDetailClick }: EnhancedKPICardProps) {
  const { label, value, icon, change, details } = data;

  const hasExceptions = details?.exceptions && details.exceptions.length > 0;
  const hasGrowthData = change && (change.mom !== null || change.yoy !== null);
  const isNullValue = value === 'null' || value === null;
  
  // 状态码信息（如果存在）
  const hasStatusCode = data.statusCode !== undefined;

  // 判断指标是否需要显示同比环比数据
  const shouldShowGrowthData = (kpiLabel: string): boolean => {
    // 已揽收、已发运、已签收不显示同比环比
    const noGrowthIndicators = ['已揽收', '已发运', '已签收'];
    return !noGrowthIndicators.includes(kpiLabel);
  };

  // 添加调试日志
  console.log('KPI Card Debug:', {
    label,
    hasExceptions,
    hasStatusCode,
    exceptionsData: details?.exceptions,
    brandsData: details?.brands,
    statusCode: data.statusCode
  });

  return (
    <Card 
<<<<<<< HEAD
      className={`bg-white hover:shadow-lg transition-all duration-200 cursor-pointer group ${
=======
      className={`hover:shadow-lg transition-all duration-200 cursor-pointer group ${
>>>>>>> main
        isNullValue ? 'border-functional-light-grey bg-functional-bright-grey' : 'border-functional-light-grey'
      }`}
      onClick={() => onDetailClick && onDetailClick(data)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`text-lg ${isNullValue ? 'opacity-50' : ''}`}>{icon}</span>
            <h3 className={`font-medium text-sm ${isNullValue ? 'text-functional-mid-grey' : ''}`}>{label}</h3>
          </div>
          <div className="flex items-center space-x-1">
            {/* 异常监控 - 优先显示 */}
            {hasExceptions && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlertTriangle className="h-4 w-4 text-accent-mid-orange" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" side="top">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">异常监控</h4>
                    {details?.exceptions?.map((exception, index) => (
                      <div key={index} className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{exception.type}</span>
                          <Badge variant="destructive" className="text-xs">
                            {exception.count}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">
                          阈值: {exception.threshold}
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* 状态码标识 - 当没有异常时才显示 */}
            {!hasExceptions && hasStatusCode && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Code className="h-3 w-3 text-maersk-blue" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" side="top">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">状态码映射</h4>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">状态码:</span>
                        <Badge variant="outline" className="text-xs bg-functional-bright-blue text-maersk-blue border-maersk-blue">
                          {data.statusCode}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        状态字段映射
                      </div>
                      {details?.growthAnalysis && (
                        <div className="mt-2 pt-2 border-t border-functional-light-grey">
                          <div className="text-xs text-muted-foreground">当前值: {details.growthAnalysis.current?.toLocaleString()}</div>
                          {details.growthAnalysis.lastMonth !== null && (
                            <div className="text-xs text-muted-foreground">上月: {details.growthAnalysis.lastMonth?.toLocaleString()}</div>
                          )}
                          {details.growthAnalysis.lastYear !== null && (
                            <div className="text-xs text-muted-foreground">去年同期: {details.growthAnalysis.lastYear?.toLocaleString()}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {/* 详细信息 */}
            {details && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Info className="h-4 w-4 text-maersk-blue" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top">
                  <div className="space-y-3">
                    <h4 className="font-medium">详细信息</h4>
                    
                    {/* 增长分析 - 只为支持的指标显示 */}
                    {hasGrowthData && shouldShowGrowthData(label) && (
                      <div>
                        <p className="text-sm font-medium mb-2">增长分析:</p>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span>环比增长:</span>
                            <div className={`flex items-center space-x-1 ${change.mom !== null && change.mom >= 0 ? 'text-accent-mid-green' : 'text-accent-mid-red'}`}>
                              {change.mom !== null && (change.mom >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                              <span>{formatGrowthRate(change.mom)}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span>同比增长:</span>
                            <div className={`flex items-center space-x-1 ${change.yoy !== null && change.yoy >= 0 ? 'text-accent-mid-green' : 'text-accent-mid-red'}`}>
                              {change.yoy !== null && (change.yoy >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
                              <span>{formatGrowthRate(change.yoy)}</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                    
                    {/* 🔥 修复：品牌分布 - 显示状态码对应的品牌分布信息 */}
                    {details.brands && (
                      <div>
                        <p className="text-sm font-medium mb-2">{label}按品牌分布:</p>
                        <div className="space-y-1">
                          {details.brands.map((brand, index) => (
                            <div key={index} className="flex justify-between text-xs">
                              <span>{brand.name}</span>
                              <div className="flex items-center space-x-2">
                                <span>{typeof brand.value === 'number' ? brand.value.toLocaleString() : brand.value}</span>
                                <Badge variant="outline" className="text-xs">
                                  {typeof brand.percentage === 'number' ? `${brand.percentage}%` : brand.percentage}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 状态信息 */}
                    {details.status && (
                      <div className="text-sm text-muted-foreground">
                        {details.status}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* 主要数值 */}
          <div className={`text-2xl font-semibold ${isNullValue ? 'text-functional-mid-grey' : ''}`}>
            {value}
          </div>
          
          {/* 统一的同比环比数据显示 - 只为支持的指标显示 */}
          {shouldShowGrowthData(label) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-1">
                <span className="text-muted-foreground">环比:</span>
                {change && change.mom !== null ? (
                  <div className={`flex items-center space-x-1 ${change.mom >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                    {change.mom >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{Math.abs(change.mom).toFixed(2)}%</span>
                  </div>
                ) : (
                  <span className="text-functional-mid-grey">null</span>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-muted-foreground">同比:</span>
                {change && change.yoy !== null ? (
                  <div className={`flex items-center space-x-1 ${change.yoy >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                    {change.yoy >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{Math.abs(change.yoy).toFixed(2)}%</span>
                  </div>
                ) : (
                  <span className="text-functional-mid-grey">null</span>
                )}
              </div>
            </div>
          )}
          
          {/* 查看详情按钮 */}
          {onDetailClick && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免重复触发
                onDetailClick(data);
              }}
            >
              查看详情
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
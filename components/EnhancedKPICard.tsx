import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";
import { OrderKPIData } from "../data/orderData";

interface EnhancedKPICardProps {
  data: OrderKPIData;
  onDetailClick?: (data: OrderKPIData) => void;
}

export function EnhancedKPICard({ data, onDetailClick }: EnhancedKPICardProps) {
  const { label, value, icon, change, details } = data;

  const hasExceptions = details?.exceptions && details.exceptions.length > 0;

  return (
    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{icon}</span>
            <h3 className="font-medium text-sm">{label}</h3>
          </div>
          <div className="flex items-center space-x-1">
            {hasExceptions && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
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
            {details && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Info className="h-4 w-4 text-maersk-blue" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top">
                  <div className="space-y-3">
                    <h4 className="font-medium">详细信息</h4>
                    
                    {details.brands && (
                      <div>
                        <p className="text-sm font-medium mb-2">按品牌分布:</p>
                        <div className="space-y-1">
                          {details.brands.map((brand, index) => (
                            <div key={index} className="flex justify-between text-xs">
                              <span>{brand.name}</span>
                              <div className="flex items-center space-x-2">
                                <span>{brand.value.toLocaleString()}</span>
                                <Badge variant="outline" className="text-xs">
                                  {brand.percentage}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
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
          <div className="text-2xl font-semibold">{value}</div>
          
          {/* 统一的同比环比数据显示 - 保留两位小数 */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground">环比:</span>
              <div className={`flex items-center space-x-1 ${change.mom >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                {change.mom >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(change.mom).toFixed(2)}%</span>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground">同比:</span>
              <div className={`flex items-center space-x-1 ${change.yoy >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                {change.yoy >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(change.yoy).toFixed(2)}%</span>
              </div>
            </div>
          </div>
          
          {/* 点击查看详情 */}
          {onDetailClick && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onDetailClick(data)}
            >
              查看详情
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
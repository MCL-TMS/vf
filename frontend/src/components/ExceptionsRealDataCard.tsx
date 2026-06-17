import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { 
  AlertTriangle, 
  Clock, 
  Package,
  Truck,
  Timer,
  Archive
} from 'lucide-react';

interface ExceptionsRealDataCardProps {
  realExceptionsData: {
    pickupTimeout: number;
    shippingTimeout: number;
    deliveryTimeout: number;
    updateTimeout: number;
  } | null;
}

export function ExceptionsRealDataCard({ realExceptionsData }: ExceptionsRealDataCardProps) {
  if (!realExceptionsData) {
    return (
      <Card className="maersk-card border-accent-light-orange">
        <CardHeader>
          <CardTitle className="text-accent-dark-orange flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>核心异常监控</span>
            <Badge variant="outline" className="bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange">
              使用估算数据
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-functional-mid-grey">
            当前显示的异常数据基于订单状态估算，不是基于四种核心超时条件的真实统计。
          </p>
        </CardContent>
      </Card>
    );
  }

  const total = realExceptionsData.pickupTimeout + realExceptionsData.shippingTimeout + 
                realExceptionsData.deliveryTimeout + realExceptionsData.updateTimeout;

  const exceptionTypes = [
    {
      type: '超时未揽收',
      count: realExceptionsData.pickupTimeout,
      icon: <Package className="h-4 w-4" />,
      color: 'text-accent-dark-red',
      bgColor: 'bg-accent-bright-red',
      description: 'WMS出库后48小时仍未揽收',
      percentage: total > 0 ? Math.round((realExceptionsData.pickupTimeout / total) * 100) : 0
    },
    {
      type: '超时未发运',
      count: realExceptionsData.shippingTimeout,
      icon: <Truck className="h-4 w-4" />,
      color: 'text-functional-dark-blue',
      bgColor: 'bg-functional-bright-blue',
      description: 'WMS出库后72小时仍未发运',
      percentage: total > 0 ? Math.round((realExceptionsData.shippingTimeout / total) * 100) : 0
    },
    {
      type: '超时未签收',
      count: realExceptionsData.deliveryTimeout,
      icon: <Timer className="h-4 w-4" />,
      color: 'text-accent-dark-orange',
      bgColor: 'bg-accent-bright-orange',
      description: '首次派送后72小时仍未签收',
      percentage: total > 0 ? Math.round((realExceptionsData.deliveryTimeout / total) * 100) : 0
    },
    {
      type: '超48H未更新',
      count: realExceptionsData.updateTimeout,
      icon: <Archive className="h-4 w-4" />,
      color: 'text-functional-dark-grey',
      bgColor: 'bg-functional-bright-grey',
      description: 'IS48H_FLAG标记为Y的订单',
      percentage: total > 0 ? Math.round((realExceptionsData.updateTimeout / total) * 100) : 0
    }
  ];

  return (
    <Card className="maersk-card border-accent-light-green">
      <CardHeader>
        <CardTitle className="text-accent-dark-green flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5" />
          <span>核心异常监控</span>
          <Badge variant="outline" className="bg-accent-bright-green text-accent-dark-green border-accent-mid-green">
            真实数据统计
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-functional-mid-grey mb-4">
          基于四种核心超时条件的真实数据统计，异常总数: <span className="font-semibold text-maersk-black">{total}</span> 单
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {exceptionTypes.map((exception, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 rounded-lg border border-functional-light-grey">
              <div className={`p-2 rounded-full ${exception.bgColor}`}>
                <span className={exception.color}>{exception.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-maersk-black text-sm">{exception.type}</div>
                  <Badge variant="outline" className="text-xs">
                    {exception.count}单
                  </Badge>
                </div>
                <div className="text-xs text-functional-mid-grey mb-1">
                  {exception.description}
                </div>
                <div className="text-xs font-medium text-maersk-blue">
                  占比: {exception.percentage}%
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {total > 0 && (
          <div className="mt-4 p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
            <div className="text-xs text-functional-mid-grey">
              <strong>异常率分析:</strong> 
              {' '}超时未揽收占{exceptionTypes[0].percentage}%，
              超时未发运占{exceptionTypes[1].percentage}%，
              超时未签收占{exceptionTypes[2].percentage}%，
              超48H未更新占{exceptionTypes[3].percentage}%
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
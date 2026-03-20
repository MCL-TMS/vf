import React from 'react';
import { Badge } from './ui/badge';
import { AlertTriangle, Clock, Package, Truck, Activity, X } from 'lucide-react';

interface ExceptionFilterAlertProps {
  filter: {
    type?: string;
    brand?: string;
    courier?: string;
  };
  onClear: () => void;
}

export function ExceptionFilterAlert({ filter, onClear }: ExceptionFilterAlertProps) {
  if (!filter.type) return null;

  const getExceptionTypeDisplay = (type: string) => {
    switch (type) {
      case 'pickup_timeout': return '超时未揽收';
      case 'shipping_timeout': return '超时未发运';
      case 'shipping_no_update_48h': return '超48h未更新';
      case 'delivery_timeout': return '超时未签收';
      default: return type;
    }
  };

  const getExceptionIcon = (type: string) => {
    switch (type) {
      case 'pickup_timeout': return <Clock className="h-3 w-3 mr-1" />;
      case 'shipping_timeout': return <Truck className="h-3 w-3 mr-1" />;
      case 'shipping_no_update_48h': return <Activity className="h-3 w-3 mr-1" />;
      case 'delivery_timeout': return <Package className="h-3 w-3 mr-1" />;
      default: return <Clock className="h-3 w-3 mr-1" />;
    }
  };

  return (
    <div className="exception-filter-alert relative overflow-hidden rounded-lg border border-accent-light-orange bg-gradient-to-r from-accent-bright-orange to-accent-bright-red shadow-lg hover:shadow-xl transition-shadow duration-300">
      {/* 背景装饰图案 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent-mid-orange rounded-full transform translate-x-16 -translate-y-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent-mid-red rounded-full transform -translate-x-12 translate-y-12"></div>
      </div>
      

    </div>
  );
}
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface CourierDataDebugProps {
  rawApiData?: any;
  filteredData?: any;
  useRealData?: boolean;
}

export function CourierDataDebug({ rawApiData, filteredData, useRealData }: CourierDataDebugProps) {
  if (!useRealData) {
    return null; // 只在使用真实数据时显示调试信息
  }

  const courierDistribution = rawApiData?.data?.courierDistribution;
  const courierDataFiltered = filteredData?.courierData;

  return (
    <Card className="mt-4 border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-sm text-red-600">🔧 快递公司数据调试信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-red-600">API原始数据 (courierDistribution):</h4>
          <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-32">
            {JSON.stringify(courierDistribution || 'null', null, 2)}
          </pre>
        </div>
        
        <div>
          <h4 className="font-medium text-red-600">转换后的数据 (filteredData.courierData):</h4>
          <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-32">
            {JSON.stringify(courierDataFiltered || 'null', null, 2)}
          </pre>
        </div>
        
        <div>
          <h4 className="font-medium text-red-600">数据状态:</h4>
          <ul className="text-xs space-y-1">
            <li>✓ 使用真实数据: {useRealData ? '是' : '否'}</li>
            <li>✓ 有API原始数据: {!!rawApiData ? '是' : '否'}</li>
            <li>✓ 有courierDistribution: {!!courierDistribution ? '是' : '否'}</li>
            <li>✓ courierDistribution长度: {Array.isArray(courierDistribution) ? courierDistribution.length : 'N/A'}</li>
            <li>✓ 转换后数据长度: {Array.isArray(courierDataFiltered) ? courierDataFiltered.length : 'N/A'}</li>
          </ul>
        </div>
        
        {Array.isArray(courierDistribution) && courierDistribution.length > 0 && (
          <div>
            <h4 className="font-medium text-red-600">第一个快递商原始数据:</h4>
            <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-32">
              {JSON.stringify(courierDistribution[0], null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
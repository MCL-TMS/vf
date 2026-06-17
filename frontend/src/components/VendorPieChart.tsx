import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { courierData } from "../data/orderData";

const COLORS = ['var(--maersk-blue)', 'var(--accent-mid-green)', 'var(--accent-mid-teal)', 'var(--accent-mid-orange)', 'var(--accent-mid-red)'];

interface VendorPieChartProps {
  courierData?: Array<{
    name: string;
    orderCount: number | null;
    deliveryRate: number | null;
    pickupRate: number | null;
    shippingRate: number | null;
    percentage: number | null;
    exceptions: {
      notPickedOver2h: number | null;
      notShippedOver12h: number | null;
      notUpdatedOver48h: number | null;
      notDeliveredOver3days: number | null;
    };
  }> | null;
  useRealData?: boolean;
}

export function VendorPieChart({ courierData: apiCourierData, useRealData = false }: VendorPieChartProps) {
  // 使用API数据或模拟数据
  const sourceCourierData = (useRealData && apiCourierData && apiCourierData.length > 0) 
    ? apiCourierData 
    : courierData;
  
  let vendorDistribution: Array<{
    name: string;
    value: number;
    orders: number;
    pickupRate: number | null;
    shippingRate: number | null;
    deliveryRate: number | null;
  }> = [];
  
  let primaryVendor: {
    name: string;
    value: number;
    orders: number;
    pickupRate: number | null;
    shippingRate: number | null;
    deliveryRate: number | null;
  } | null = null;

  if (useRealData && apiCourierData && apiCourierData.length > 0) {
    // 使用API数据
    vendorDistribution = apiCourierData.map((courier) => ({
      name: courier.name || '未知快递商',
      value: courier.percentage || 0,
      orders: courier.orderCount || 0,
      pickupRate: courier.pickupRate,
      shippingRate: courier.shippingRate,
      deliveryRate: courier.deliveryRate
    }));
  } else {
    // 使用模拟数据
    const totalOrders = courierData.reduce((sum, courier) => sum + courier.picked + courier.shipped, 0);
    
    vendorDistribution = courierData.map((courier) => ({
      name: courier.name,
      value: Math.round(((courier.picked + courier.shipped) / totalOrders) * 100),
      orders: courier.picked + courier.shipped,
      pickupRate: courier.pickupRate,
      shippingRate: courier.shippingRate,
      deliveryRate: courier.deliveryRate
    }));
  }

  if (vendorDistribution.length > 0) {
    primaryVendor = vendorDistribution.reduce((prev, current) => 
      prev.value > current.value ? prev : current
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>快递公司分布</CardTitle>
        {useRealData && (
          <div className="text-sm text-functional-mid-grey">
            {vendorDistribution.length > 0 ? '基于真实API数据' : '暂无数据'}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {vendorDistribution.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-functional-mid-grey">
            <div className="text-center">
              <div className="text-lg mb-2">📦</div>
              <div>暂无快递公司数据</div>
              <div className="text-sm mt-1">等待API数据加载</div>
            </div>
          </div>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vendorDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {vendorDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${value}% (${props.payload.orders.toLocaleString()}单)`, 
                      '订单占比'
                    ]} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* 详细统计 */}
            <div className="mt-4 space-y-3">
              {primaryVendor && (
                <div className="text-center">
                  <span className="text-2xl font-semibold text-maersk-blue">{primaryVendor.value}%</span>
                  <p className="text-sm text-functional-mid-grey">主要快递商: {primaryVendor.name}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                {vendorDistribution.slice(0, 4).map((vendor, index) => (
                  <div key={index} className="text-center p-3 bg-functional-bright-grey rounded-lg">
                    <div className="font-medium text-functional-dark-grey">{vendor.name}</div>
                    <div className="text-xs text-functional-mid-grey mt-1">
                      <div>订单量: {vendor.orders.toLocaleString()}</div>
                      <div>占比: {vendor.value.toFixed(1)}%</div>
                      {vendor.deliveryRate !== null && (
                        <div>签收率: {vendor.deliveryRate.toFixed(1)}%</div>
                      )}
                      {useRealData && (
                        <div className="text-maersk-blue mt-1">API数据</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
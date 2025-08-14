import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { courierData } from "../data/orderData";

const COLORS = ['var(--maersk-blue)', 'var(--accent-mid-green)'];

export function VendorPieChart() {
  // 基于快递公司数据计算分布
  const totalOrders = courierData.reduce((sum, courier) => sum + courier.picked + courier.shipped, 0);
  
  const vendorDistribution = courierData.map((courier) => ({
    name: courier.name,
    value: Math.round(((courier.picked + courier.shipped) / totalOrders) * 100),
    orders: courier.picked + courier.shipped,
    pickupRate: courier.pickupRate,
    shippingRate: courier.shippingRate,
    deliveryRate: courier.deliveryRate
  }));

  const primaryVendor = vendorDistribution.reduce((prev, current) => 
    prev.value > current.value ? prev : current
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>快递公司分布</CardTitle>
      </CardHeader>
      <CardContent>
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
          <div className="text-center">
            <span className="text-2xl font-semibold text-maersk-blue">{primaryVendor.value}%</span>
            <p className="text-sm text-muted-foreground">主要快递商: {primaryVendor.name}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            {vendorDistribution.map((vendor, index) => (
              <div key={index} className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="font-medium">{vendor.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  <div>订单量: {vendor.orders.toLocaleString()}</div>
                  <div>揽收率: {vendor.pickupRate}%</div>
                  <div>发运率: {vendor.shippingRate}%</div>
                  <div>签收率: {vendor.deliveryRate}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
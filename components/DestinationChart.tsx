import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const destinationData = [
  { name: "华东", orders: 856234, growth: 15.3, percentage: 32.1 },
  { name: "华南", orders: 665478, growth: 12.8, percentage: 25.0 },
  { name: "华北", orders: 532547, growth: 18.2, percentage: 20.0 },
  { name: "华中", orders: 319528, growth: 9.7, percentage: 12.0 },
  { name: "西南", orders: 199705, growth: 22.1, percentage: 7.5 },
  { name: "西北", orders: 133137, growth: 14.6, percentage: 5.0 },
  { name: "东北", orders: 93191, growth: 6.4, percentage: 3.5 }
];

const monthlyDestinationTrend = [
  { month: "1月", 华东: 71353, 华南: 55456, 华北: 44379, 华中: 26627, 西南: 16642, 西北: 11095, 东北: 7766 },
  { month: "2月", 华东: 69845, 华南: 54321, 华北: 43456, 华中: 26078, 西南: 16304, 西北: 10870, 东北: 7604 },
  { month: "3月", 华东: 73567, 华南: 57123, 华北: 45789, 华中: 27456, 西南: 17134, 西北: 11432, 东北: 7990 },
  { month: "4月", 华东: 76234, 华南: 58967, 华北: 47123, 华中: 28234, 西南: 17623, 西北: 11756, 东北: 8214 },
  { month: "5月", 华东: 78456, 华南: 60234, 华北: 48567, 华中: 28967, 西南: 18123, 西北: 12089, 东北: 8456 },
  { month: "6月", 华东: 76789, 华南: 59456, 华北: 47890, 华中: 28567, 西南: 17890, 西北: 11923, 东北: 8345 }
];

export function DestinationChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>目的地分析</span>
          <Badge variant="outline">实时数据</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 目的地分布图表 */}
          <div>
            <h4 className="text-sm font-medium mb-3">各地区订单分布</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={destinationData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={50} />
                  <Tooltip 
                    formatter={(value) => [value.toLocaleString(), '订单数']}
                    labelFormatter={(label) => `地区: ${label}`}
                  />
                  <Bar dataKey="orders" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 增长率对比 */}
          <div>
            <h4 className="text-sm font-medium mb-3">各地区增长率</h4>
            <div className="space-y-2">
              {destinationData.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm">{item.name}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          item.growth >= 20 ? 'bg-green-500' : 
                          item.growth >= 15 ? 'bg-blue-500' : 
                          item.growth >= 10 ? 'bg-yellow-500' : 'bg-gray-400'
                        }`}
                        style={{ width: `${Math.min(item.growth / 25 * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium w-12 text-right">+{item.growth}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 月度趋势概览 */}
          <div>
            <h4 className="text-sm font-medium mb-3">主要地区月度趋势</h4>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyDestinationTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="华东" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="华南" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="华北" stroke="#f59e0b" strokeWidth={2} />
                  <Line type="monotone" dataKey="西南" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
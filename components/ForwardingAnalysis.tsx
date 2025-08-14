import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { forwardingData } from "../data/orderData";

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16'];

// 完整的省份数据 - 按快递公司分组
const getFullDestinationData = () => {
  // 所有省份的超区转寄数据
  const allProvinces = [
    { province: '新疆', total: 234, zt: 168, sf: 66, recommendation: '建议使用邮政或德邦' },
    { province: '西藏', total: 187, zt: 134, sf: 53, recommendation: '建议使用邮政' },
    { province: '内蒙古', total: 156, zt: 109, sf: 47, recommendation: '建议使用中通' },
    { province: '甘肃', total: 134, zt: 89, sf: 45, recommendation: '建议使用顺丰' },
    { province: '青海', total: 89, zt: 62, sf: 27, recommendation: '建议使用邮政' },
    { province: '宁夏', total: 81, zt: 55, sf: 26, recommendation: '建议使用中通' },
    { province: '黑龙江', total: 76, zt: 48, sf: 28, recommendation: '建议使用中通' },
    { province: '吉林', total: 65, zt: 39, sf: 26, recommendation: '建议使用顺丰' },
    { province: '辽宁', total: 58, zt: 34, sf: 24, recommendation: '建议使用中通' },
    { province: '云南', total: 52, zt: 31, sf: 21, recommendation: '建议使用顺丰' },
    { province: '贵州', total: 48, zt: 29, sf: 19, recommendation: '建议使用中通' },
    { province: '海南', total: 43, zt: 25, sf: 18, recommendation: '建议使用顺丰' },
    { province: '山西', total: 39, zt: 23, sf: 16, recommendation: '建议使用中通' },
    { province: '陕西', total: 35, zt: 21, sf: 14, recommendation: '建议使用顺丰' },
    { province: '河北', total: 32, zt: 19, sf: 13, recommendation: '建议使用中通' },
    { province: '河南', total: 29, zt: 17, sf: 12, recommendation: '建议使用中通' },
    { province: '安徽', total: 26, zt: 15, sf: 11, recommendation: '建议使用顺丰' },
    { province: '湖北', total: 23, zt: 14, sf: 9, recommendation: '建议使用中通' },
    { province: '湖南', total: 21, zt: 12, sf: 9, recommendation: '建议使用顺丰' },
    { province: '江西', total: 18, zt: 11, sf: 7, recommendation: '建议使用中通' },
    { province: '福建', total: 16, zt: 9, sf: 7, recommendation: '建议使用顺丰' },
    { province: '广西', total: 14, zt: 8, sf: 6, recommendation: '建议使用中通' },
    { province: '四川', total: 12, zt: 7, sf: 5, recommendation: '建议使用顺丰' },
    { province: '重庆', total: 10, zt: 6, sf: 4, recommendation: '建议使用中通' },
    { province: '山东', total: 8, zt: 5, sf: 3, recommendation: '建议使用顺丰' },
    { province: '江苏', total: 6, zt: 4, sf: 2, recommendation: '建议使用中通' },
    { province: '浙江', total: 5, zt: 3, sf: 2, recommendation: '建议使用顺丰' },
    { province: '广东', total: 4, zt: 2, sf: 2, recommendation: '建议使用中通' },
    { province: '上海', total: 3, zt: 2, sf: 1, recommendation: '建议使用顺丰' },
    { province: '北京', total: 2, zt: 1, sf: 1, recommendation: '建议使用中通' },
    { province: '天津', total: 1, zt: 1, sf: 0, recommendation: '建议使用中通' }
  ];

  // 按快递公司分组
  const ztProvinces = allProvinces.map(p => ({
    province: p.province,
    count: p.zt,
    percentage: ((p.zt / 599) * 100).toFixed(1), // 中通总数599
    recommendation: p.recommendation
  })).filter(p => p.count > 0);

  const sfProvinces = allProvinces.map(p => ({
    province: p.province,
    count: p.sf,
    percentage: ((p.sf / 282) * 100).toFixed(1), // 顺丰总数282
    recommendation: p.recommendation
  })).filter(p => p.count > 0);

  return { ztProvinces, sfProvinces };
};

export function ForwardingAnalysis() {
  const addressChangeData = forwardingData.find(d => d.type === 'address_change');
  const outOfRangeData = forwardingData.find(d => d.type === 'out_of_range');
  const { ztProvinces, sfProvinces } = getFullDestinationData();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>🔁</span>
          <span>转寄单分析 - 顺丰🚀 vs 中通🚚</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="address">改地址</TabsTrigger>
            <TabsTrigger value="outrange">超区转寄</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-semibold text-blue-600">
                  {addressChangeData?.count.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">改地址</div>
                <Badge variant="outline" className="mt-1">
                  {addressChangeData?.percentage}%
                </Badge>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-semibold text-orange-600">
                  {outOfRangeData?.count.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">超区转寄</div>
                <Badge variant="outline" className="mt-1">
                  {outOfRangeData?.percentage}%
                </Badge>
              </div>
            </div>
            
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={forwardingData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="count"
                    label={({ type, percentage }) => `${type === 'address_change' ? '改地址' : '超区转寄'} ${percentage}%`}
                  >
                    {forwardingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, '数量']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="address" className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-semibold">改地址转寄分布</div>
              <div className="text-sm text-muted-foreground">按快递公司统计</div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={addressChangeData?.couriers}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [value, '数量']} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="outrange" className="space-y-4">
            {/* 快递公司占比概览 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 border rounded-lg bg-blue-50">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <span className="text-2xl">🚚</span>
                  <span className="font-semibold">中通</span>
                </div>
                <div className="text-2xl font-semibold text-blue-600">
                  {outOfRangeData?.couriers.find(c => c.name === '中通')?.count}
                </div>
                <Badge variant="destructive" className="mt-1">
                  {outOfRangeData?.couriers.find(c => c.name === '中通')?.percentage}%
                </Badge>
              </div>
              <div className="text-center p-4 border rounded-lg bg-orange-50">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <span className="text-2xl">🚀</span>
                  <span className="font-semibold">顺丰</span>
                </div>
                <div className="text-2xl font-semibold text-orange-600">
                  {outOfRangeData?.couriers.find(c => c.name === '顺丰')?.count}
                </div>
                <Badge variant="outline" className="mt-1">
                  {outOfRangeData?.couriers.find(c => c.name === '顺丰')?.percentage}%
                </Badge>
              </div>
            </div>

            {/* 按快递公司分组显示全部目的地省份 */}
            <div className="grid grid-cols-2 gap-6">
              {/* 中通目的地省份 */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-lg">🚚</span>
                  <h4 className="font-semibold">中通目的地省份</h4>
                  <Badge variant="destructive" className="text-xs">
                    {ztProvinces.length}个省份
                  </Badge>
                </div>
                <ScrollArea className="h-80 border rounded-lg p-3">
                  <div className="space-y-3">
                    {ztProvinces.map((dest, index) => (
                      <div key={index} className="border-l-4 border-blue-500 pl-3 py-2 bg-blue-50 rounded-r-lg">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-blue-900">{dest.province}</span>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-blue-600">{dest.count}单</div>
                            <div className="text-xs text-blue-500">{dest.percentage}%</div>
                          </div>
                        </div>
                        <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                          {dest.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* 顺丰目的地省份 */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-lg">🚀</span>
                  <h4 className="font-semibold">顺丰目的地省份</h4>
                  <Badge variant="outline" className="text-xs">
                    {sfProvinces.length}个省份
                  </Badge>
                </div>
                <ScrollArea className="h-80 border rounded-lg p-3">
                  <div className="space-y-3">
                    {sfProvinces.map((dest, index) => (
                      <div key={index} className="border-l-4 border-orange-500 pl-3 py-2 bg-orange-50 rounded-r-lg">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-orange-900">{dest.province}</span>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-orange-600">{dest.count}单</div>
                            <div className="text-xs text-orange-500">{dest.percentage}%</div>
                          </div>
                        </div>
                        <div className="text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded">
                          {dest.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* 汇总统计 */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-4 gap-4 text-center text-sm">
                <div>
                  <div className="font-semibold text-gray-700">总省份数</div>
                  <div className="text-lg text-gray-900">{ztProvinces.length + sfProvinces.length}</div>
                </div>
                <div>
                  <div className="font-semibold text-blue-600">中通覆盖</div>
                  <div className="text-lg text-blue-700">{ztProvinces.length}省份</div>
                </div>
                <div>
                  <div className="font-semibold text-orange-600">顺丰覆盖</div>
                  <div className="text-lg text-orange-700">{sfProvinces.length}省份</div>
                </div>
                <div>
                  <div className="font-semibold text-purple-600">平均每省</div>
                  <div className="text-lg text-purple-700">
                    {Math.round((outOfRangeData?.count || 0) / (ztProvinces.length + sfProvinces.length))}单
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
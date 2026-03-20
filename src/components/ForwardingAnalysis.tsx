import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Alert, AlertDescription } from "./ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { forwardingData } from "../data/orderData";
import { ApiService } from "../services/apiService";
import { useAuth } from "../contexts/AuthContext"; // 🔥 新增：引入权限管理
import type { DateRange } from "../data/types";

const COLORS = ['#42b0d5', '#119c85', '#6ca926', '#f3870c'];

interface ForwardingAnalysisProps {
  useRealData?: boolean;
  dateRange?: DateRange;
  selectedBrand?: string | null;
  selectedPlatform?: string | null;
  selectedSelfFlag?: string | null;
}

// 快递公司图标映射
const COURIER_ICON_MAPPING: { [key: string]: string } = {
  '中通': '🚚',
  '顺丰': '🚀',
  '圆通': '📦',
  '申通': '📮',
  '京东': '🏪',
  '邮政EMS': '✉️',
  '韵达': '🎯',
  '百世': '🌐',
  '德邦': '🔷',
  '优速': '⚡'
};

// 获取快递商图标
const getCourierIcon = (courierName: string): string => {
  return COURIER_ICON_MAPPING[courierName] || '📦';
};

// 完整的省份数据 - 按快递公司分组（模拟数据）
const getFullDestinationData = () => {
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

  const ztProvinces = allProvinces.map(p => ({
    province: p.province,
    count: p.zt,
    percentage: ((p.zt / 599) * 100).toFixed(1),
    recommendation: p.recommendation
  })).filter(p => p.count > 0);

  const sfProvinces = allProvinces.map(p => ({
    province: p.province,
    count: p.sf,
    percentage: ((p.sf / 282) * 100).toFixed(1),
    recommendation: p.recommendation
  })).filter(p => p.count > 0);

  return { ztProvinces, sfProvinces };
};

export function ForwardingAnalysis({
  useRealData = false,
  dateRange,
  selectedBrand,
  selectedPlatform,
  selectedSelfFlag
}: ForwardingAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiData, setApiData] = useState<any>(null);
  const [isUsingRealData, setIsUsingRealData] = useState(false); // 🔥 新增：标记当前是否使用真实数据
  const { user } = useAuth(); // 🔥 新增：获取当前用户信息

  // 🔥 获取真实API数据
  useEffect(() => {
    if (!useRealData) {
      console.log('📊 [ForwardingAnalysis] 使用模拟数据模式');
      setIsUsingRealData(false);
      return;
    }

    // 创建 AbortController 以支持请求取消
    const abortController = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('🔁 [ForwardingAnalysis] 开始获取转寄数据:', {
          dateRange,
          selectedBrand,
          selectedPlatform,
          selectedSelfFlag,
          userBrands: user?.customerNos // 🔥 新增：记录用户品牌权限
        });

        const response = await ApiService.getForwardingData({
          dateRange,
          brand: selectedBrand,
          platform: selectedPlatform,
          selfFlag: selectedSelfFlag,
          userBrands: user?.customerNos, // 🔥 新增：传递用户品牌权限
          signal: abortController.signal // 传递 AbortSignal
        });

        if (response.success && response.data) {
          console.log('✅ [ForwardingAnalysis] 转寄数据获取成功，切换到真实数据:', response.data);
          setApiData(response);
          setIsUsingRealData(true); // ✅ 成功获取真实数据
        } else {
          throw new Error('API返回失败状态');
        }
      } catch (err: any) {
        // 忽略取消错误
        if (err.name === 'AbortError') {
          console.log('🔄 [ForwardingAnalysis] 请求已取消（组件卸载或参数变化）');
          return;
        }
        
        console.warn('⚠️ [ForwardingAnalysis] API连接失败，继续使用虚拟数据:', err.message);
        setError(err.message || '获取数据失败');
        setIsUsingRealData(false); // ❌ API失败，使用虚拟数据
        setApiData(null); // 清空API数据
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 清理函数：组件卸载或依赖项变化时取消请求
    return () => {
      console.log('🧹 [ForwardingAnalysis] 取消进行中的API请求');
      abortController.abort();
    };
  }, [useRealData, dateRange, selectedBrand, selectedPlatform, selectedSelfFlag]);

  // 🔥 数据处理逻辑 - 优先使用虚拟数据，只有API成功时才用真实数据
  const getProcessedData = () => {
    // ✅ 只有当isUsingRealData=true且apiData存在时才使用真实数据
    if (isUsingRealData && apiData?.data) {
      const { addressChange, outOfRange } = apiData.data;
      
      console.log('🔄 [ForwardingAnalysis] 使用API真实数据:', { addressChange, outOfRange });

      // 处理改地址数据
      const addressChangeProcessed = {
        type: 'address_change',
        count: addressChange.totalCount || 0,
        percentage: addressChange.percentage || 0,
        couriers: (addressChange.byCourier || []).map((c: any) => ({
          name: c.courierName || c.courier,
          count: c.count,
          percentage: c.percentage
        }))
      };

      // 处理超区转寄数据
      const outOfRangeProcessed = {
        type: 'out_of_range',
        count: outOfRange.totalCount || 0,
        percentage: outOfRange.percentage || 0,
        couriers: (outOfRange.byCourier || []).map((c: any) => ({
          name: c.courierName || c.courier,
          count: c.count,
          percentage: c.percentage
        }))
      };

      // 处理省份数据 - 按快递公司分组
      const provincesByCourier: { [key: string]: any[] } = {};
      
      (outOfRange.byProvince || []).forEach((p: any) => {
        const courierName = p.courierName || p.courier;
        if (!provincesByCourier[courierName]) {
          provincesByCourier[courierName] = [];
        }
        
        provincesByCourier[courierName].push({
          province: p.destProvince || p.province,
          count: p.count,
          percentage: p.percentage,
          recommendation: `建议优化${courierName}在${p.destProvince || p.province}的配送路线`
        });
      });

      return {
        addressChange: addressChangeProcessed,
        outOfRange: outOfRangeProcessed,
        provincesByCourier,
        forwardingData: [addressChangeProcessed, outOfRangeProcessed]
      };
    }

    // 🔥 默认使用虚拟数据
    console.log('📊 [ForwardingAnalysis] 使用虚拟模拟数据');
    const addressChangeData = forwardingData.find(d => d.type === 'address_change');
    const outOfRangeData = forwardingData.find(d => d.type === 'out_of_range');
    const { ztProvinces, sfProvinces } = getFullDestinationData();

    return {
      addressChange: addressChangeData,
      outOfRange: outOfRangeData,
      provincesByCourier: {
        '中通': ztProvinces,
        '顺丰': sfProvinces
      },
      forwardingData
    };
  };

  const { addressChange, outOfRange, provincesByCourier, forwardingData: chartData } = getProcessedData();

  // 🔥 加载状态显示（不阻塞UI，显示虚拟数据）
  // 移除了阻塞式的loading和error状态，改为在标题处显示数据源

  // 获取所有快递商的省份数据（用于超区转寄Tab）
  const courierKeys = Object.keys(provincesByCourier);

  return (
    <Card className="maersk-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span>🔁</span>
            <span>转寄单分析</span>
          </div>
          {isUsingRealData && apiData && (
            <Badge variant="outline" className="maersk-badge-primary">
              实时数据
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-functional-bright-grey">
            <TabsTrigger value="overview" className="text-black">总览</TabsTrigger>
            <TabsTrigger value="address" className="text-black">改地址</TabsTrigger>
            <TabsTrigger value="outrange" className="text-black">超区转寄</TabsTrigger>
          </TabsList>
          
          {/* 总览Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 border border-functional-light-grey rounded-lg">
                <div className="text-2xl font-semibold text-maersk-blue">
                  {addressChange?.count.toLocaleString()}
                </div>
                <div className="text-sm text-functional-mid-grey">改地址</div>
                <Badge variant="outline" className="mt-1 maersk-badge-secondary">
                  {addressChange?.percentage}%
                </Badge>
              </div>
              <div className="text-center p-4 border border-functional-light-grey rounded-lg">
                <div className="text-2xl font-semibold text-accent-mid-orange">
                  {outOfRange?.count.toLocaleString()}
                </div>
                <div className="text-sm text-functional-mid-grey">超区转寄</div>
                <Badge variant="outline" className="mt-1 maersk-badge-secondary">
                  {outOfRange?.percentage}%
                </Badge>
              </div>
            </div>
            
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="count"
                    label={({ type, percentage }) => `${type === 'address_change' ? '改地址' : '超区转寄'} ${percentage}%`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [value, '数量']} 
                    contentStyle={{
                      backgroundColor: 'var(--maersk-white)',
                      border: '1px solid var(--functional-light-grey)',
                      borderRadius: '6px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          {/* 改地址Tab */}
          <TabsContent value="address" className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-maersk-black">改地址转寄分布</div>
              <div className="text-sm text-functional-mid-grey">按快递公司统计（TR_FLAG='Y'）</div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={addressChange?.couriers}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => [value, '数量']}
                    contentStyle={{
                      backgroundColor: 'var(--maersk-white)',
                      border: '1px solid var(--functional-light-grey)',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="count" fill="var(--maersk-blue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 快递商详情列表 */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {addressChange?.couriers.map((courier: any, index: number) => (
                <div key={index} className="p-3 border border-functional-light-grey rounded-lg bg-functional-bright-grey">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{getCourierIcon(courier.name)}</span>
                      <span className="font-medium text-maersk-black">{courier.name}</span>
                    </div>
                    <Badge variant="outline">{courier.percentage}%</Badge>
                  </div>
                  <div className="text-2xl font-semibold text-maersk-blue mt-2">
                    {courier.count.toLocaleString()}
                  </div>
                  <div className="text-xs text-functional-mid-grey">改地址订单</div>
                </div>
              ))}
            </div>
          </TabsContent>
          
          {/* 超区转寄Tab */}
          <TabsContent value="outrange" className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-maersk-black">超区转寄分布</div>
              <div className="text-sm text-functional-mid-grey">按快递公司和目的省份统计（TR_FLAG2='Y'）</div>
            </div>

            {/* 快递公司占比概览 */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {outOfRange?.couriers.map((courier: any, index: number) => (
                <div key={index} className="p-6 border-2 border-functional-light-grey rounded-lg bg-maersk-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{getCourierIcon(courier.name)}</span>
                      <span className="text-lg font-semibold text-maersk-black">{courier.name}</span>
                    </div>
                    <Badge variant="outline" className="bg-accent-bright-red text-accent-dark-red border-accent-mid-red">
                      {courier.percentage}%
                    </Badge>
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <div className="text-3xl font-bold text-maersk-blue">
                      {courier.count.toLocaleString()}
                    </div>
                    <div className="text-sm text-functional-mid-grey">超区转寄订单</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 按快递公司分组显示目的地省份 */}
            <div className={`grid gap-6 ${courierKeys.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {courierKeys.map((courierName, courierIndex) => {
                const provinces = provincesByCourier[courierName] || [];
                const colorScheme = courierIndex % 2 === 0 ? 
                  {
                    border: 'border-functional-mid-blue',
                    bg: 'bg-functional-bright-blue',
                    textDark: 'text-functional-dark-blue',
                    textMid: 'text-functional-mid-blue'
                  } : 
                  {
                    border: 'border-accent-mid-orange',
                    bg: 'bg-accent-bright-orange',
                    textDark: 'text-accent-dark-orange',
                    textMid: 'text-accent-mid-orange'
                  };

                return (
                  <div key={courierIndex}>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-lg">{getCourierIcon(courierName)}</span>
                      <h4 className="font-semibold text-maersk-black">{courierName} 目的地省份</h4>
                      <Badge variant="destructive" className="text-xs">
                        {provinces.length}个省份
                      </Badge>
                    </div>
                    <ScrollArea className="h-80 border border-functional-light-grey rounded-lg p-3">
                      <div className="space-y-3">
                        {provinces.map((dest: any, index: number) => (
                          <div key={index} className={`border-l-4 ${colorScheme.border} pl-3 py-2 ${colorScheme.bg} rounded-r-lg`}>
                            <div className="flex justify-between items-start mb-1">
                              <span className={`font-medium ${colorScheme.textDark}`}>{dest.province}</span>
                              <div className="text-right">
                                <div className={`text-sm font-semibold ${colorScheme.textDark}`}>{dest.count}单</div>
                                <div className={`text-xs ${colorScheme.textMid}`}>{dest.percentage}%</div>
                              </div>
                            </div>
                            <div className={`text-xs ${colorScheme.textDark} bg-functional-bright-grey px-2 py-1 rounded`}>
                              {dest.recommendation}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                );
              })}
            </div>

            {/* 汇总统计 */}
            <div className="mt-4 p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
              <div className="grid grid-cols-4 gap-4 text-center text-sm">
                <div>
                  <div className="font-semibold text-functional-dark-grey">总快递商</div>
                  <div className="text-lg text-maersk-black">{courierKeys.length}</div>
                </div>
                <div>
                  <div className="font-semibold text-functional-dark-grey">总省份数</div>
                  <div className="text-lg text-maersk-black">
                    {Object.values(provincesByCourier).flat().length}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-functional-dark-blue">超区订单</div>
                  <div className="text-lg text-functional-dark-blue">{outOfRange?.count.toLocaleString()}</div>
                </div>
                <div>
                  <div className="font-semibold text-accent-dark-orange">占比</div>
                  <div className="text-lg text-accent-dark-orange">{outOfRange?.percentage}%</div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
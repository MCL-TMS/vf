import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Badge } from "./ui/badge";
import { Calendar, Package, Target, TrendingUp, Truck } from "lucide-react";
import { logisticsOrders, filterValidOrders } from "../data/logisticsOrderData";
import { courierCompanies } from "../data/slaData";
import { useMemo } from "react";
import { useBrand } from "../contexts/BrandContext"; // 🔥 导入useBrand Hook

interface C2DTimeChartProps {
  selectedBrand?: string;
  apiData?: any; // 新增：API返回的数据
  isLoading?: boolean; // 新增：加载状态
  accessibleBrandCodes?: string[]; // 🆕 新增：用户有权限查看的品牌代码列表
}

interface CourierC2DData {
  courier: string;
  brand?: string;
  "1d": number;
  "2d": number;
  "3d": number;
  "3+d": number;
  totalOrders: number;
  avgTime: number;
  completionRate: number;
}

export function C2DTimeChart({ selectedBrand, apiData, isLoading = false, accessibleBrandCodes }: C2DTimeChartProps) {
  const { brandMappings, nameToCodeMap } = useBrand(); // 🔥 获取动态品牌映射
  
  // 🔥 新增：从API数据生成图表数据
  const courierC2DStatsFromAPI = useMemo(() => {
    console.log('🔄 C2DTimeChart: courierC2DStatsFromAPI useMemo 执行中...');
    console.log('  - hasApiData:', !!apiData);
    console.log('  - apiData整体结构:', apiData);
    console.log('  - apiData.keys:', apiData ? Object.keys(apiData) : 'null');
    console.log('  - hasC2dAnalysis:', !!(apiData && apiData.c2dAnalysis));
    console.log('  - hasS2dAnalysis:', !!(apiData && apiData.s2dAnalysis));
    
    if (!apiData || !apiData.c2dAnalysis) {
      console.warn('⚠️ C2DTimeChart: C2D API数据不可用，返回null');
      console.warn('   可能原因：');
      console.warn('   1. 后端返回的数据结构中没有 c2dAnalysis 字段');
      console.warn('   2. 当前Tab是C2D，但API请求的analysisType参数可能还是S2D');
      console.warn('   3. 后端处理C2D请求时出错');
      return null;
    }

    const c2dAnalysis = apiData.c2dAnalysis;
    console.log('✅ C2DTimeChart: 开始处理C2D API数据');
    console.log('   c2dAnalysis结构:', c2dAnalysis);
    
    const carrierStats = c2dAnalysis.carrierStats || {};
    console.log('🚚 C2D API数据 - 快递商统计:', carrierStats);

    const courierData: CourierC2DData[] = [];

    // 遍历所有快递商
    Object.entries(carrierStats).forEach(([carrierId, carrierStat]: [string, any]) => {
      if (carrierStat && carrierStat.total > 0) {
        const actualCats = carrierStat.actualCategories || {};
        const planCats = carrierStat.planCategories || {};
        const totalOrders = carrierStat.total || 0;
        
        // C2D使用24H/48H/72H/72H+作为天数分类
        const time1d = actualCats['24H'] || 0;
        const time2d = actualCats['48H'] || 0;
        const time3d = actualCats['72H'] || 0;
        const time3Plus = actualCats['72H+'] || 0;
        
        // 计算平均时间（小时转天）
        const avgTimeHours = parseFloat(carrierStat.avgActualHours) || 0;
        const avgTime = avgTimeHours / 24; // 转换为天数
        
        // 计算完成率（实际时间相对于计划时间的比例）
        const totalActualOrders = time1d + time2d + time3d + time3Plus;
        const totalPlanOrders = (planCats['24H'] || 0) + (planCats['48H'] || 0) + (planCats['72H'] || 0) + (planCats['72H+'] || 0);
        const completionRate = totalPlanOrders > 0 ? (totalActualOrders / totalPlanOrders) * 100 : 100;
        
        console.log(`  ✅ 快递商 ${carrierId} - C2D数据:`, {
          totalOrders,
          time1d,
          time2d,
          time3d,
          time3Plus,
          avgTime: avgTime.toFixed(2) + '天',
          completionRate: completionRate.toFixed(1) + '%'
        });
        
        courierData.push({
          courier: carrierId,
          "1d": time1d,
          "2d": time2d,
          "3d": time3d,
          "3+d": time3Plus,
          totalOrders,
          avgTime,
          completionRate: Math.min(completionRate, 150) // 限制最大值为150%
        });
      }
    });

    // 按订单数量排序
    courierData.sort((a, b) => b.totalOrders - a.totalOrders);
    
    console.log(`📊 C2DTimeChart: 生成了 ${courierData.length} 个快递商的C2D数据`);
    
    return courierData.length > 0 ? courierData : null;
  }, [apiData]);

  // 生成按快递商分组的C2D统计数据（虚拟数据）
  const courierC2DStatsMock = useMemo(() => {
    const validOrders = filterValidOrders(logisticsOrders).filter(order => 
      order.actualC2D !== undefined && order.planC2D !== undefined && order.status === 'delivered'
    );

    // 如果选择了品牌，则过滤订单
    const filteredOrders = selectedBrand ? 
      validOrders.filter(order => order.brand === selectedBrand) : 
      validOrders;

    const courierData: CourierC2DData[] = [];

    courierCompanies.forEach(courier => {
      const courierOrders = filteredOrders.filter(order => order.courierCompany === courier);
      
      if (courierOrders.length > 0) {
        // 按C2D时效分类（天数）
        const time1d = courierOrders.filter(order => order.actualC2D! <= 24).length;
        const time2d = courierOrders.filter(order => order.actualC2D! > 24 && order.actualC2D! <= 48).length;
        const time3d = courierOrders.filter(order => order.actualC2D! > 48 && order.actualC2D! <= 72).length;
        const time3Plus = courierOrders.filter(order => order.actualC2D! > 72).length;
        
        const totalOrders = courierOrders.length;
        const avgTime = courierOrders.reduce((sum, order) => sum + order.actualC2D!, 0) / totalOrders;
        const avgPlanTime = courierOrders.reduce((sum, order) => sum + order.planC2D!, 0) / totalOrders;
        const completionRate = avgPlanTime > 0 ? (avgPlanTime / avgTime) * 100 : 100;

        courierData.push({
          courier,
          "1d": time1d,
          "2d": time2d,
          "3d": time3d,
          "3+d": time3Plus,
          totalOrders,
          avgTime: avgTime / 24, // 转换为天数
          completionRate: Math.min(completionRate, 150) // 限制最大值为150%
        });
      }
    });

    return courierData.sort((a, b) => b.totalOrders - a.totalOrders);
  }, [selectedBrand]);

  // 🆕 从API数据生成品牌×快递商分析数据
  const brandCourierStatsFromAPI = useMemo(() => {
    if (!apiData || !apiData.c2dAnalysis || !apiData.c2dAnalysis.brandCarrierStats) {
      return null;
    }

    const brandCarrierStats = apiData.c2dAnalysis.brandCarrierStats;
    console.log('📊 C2D品牌×快递商 - API原始数据:', brandCarrierStats);
    console.log('📊 C2D品牌×快递商 - 原始数据的key列表:', Object.keys(brandCarrierStats));

    // 🔥 重要：后端SQL已将CUSTOMERNO转换为品牌名称，brandCode就是品牌名称
    // BRAND_CODE字段值示例：'DICKIES', 'TNF', 'ICEBREAKER' 等
    // 所以不需要再做品牌代码到品牌名称的映射！

    // 快递商代码到名称的映射
    const CARRIER_NAME_MAP: Record<string, string> = {
      'SF': '顺丰速运',
      'ZTO': '中通快递',
      'YTO': '圆通速递',
      'STO': '申通快递',
      'EMS': 'EMS',
      'JD': '京东物流',
      'YD': '韵达快递'
    };

    // 按品牌分组数据
    const brandData: Record<string, CourierC2DData[]> = {};

    Object.entries(brandCarrierStats).forEach(([key, stat]) => {
      const [brandName, carrierId] = key.split('|');  // 🔥 brandName已经是品牌名称
      
      if (!brandName) {
        console.warn(`⚠️ 空品牌名称: ${key}`);
        return;
      }

      // 🔥 处理品牌名称大小写问题：统一转为大写进行比较
      const brandNameUpper = brandName.toUpperCase();

      // 🔥 权限过滤：如果提供了accessibleBrandCodes，只显示用户有权限的品牌
      if (accessibleBrandCodes && accessibleBrandCodes.length > 0) {
        // 🔥 使用动态的nameToCodeMap替代硬编码
        const brandCode = nameToCodeMap[brandNameUpper] || nameToCodeMap[brandName];
        
        console.log(`🔍 品牌权限检查: ${brandName} (原始) / ${brandNameUpper} (大写)`, {
          找到的品牌代码: brandCode,
          用户权限品牌代码: accessibleBrandCodes,
          是否有权限: brandCode && accessibleBrandCodes.includes(brandCode)
        });
        
        if (!brandCode || !accessibleBrandCodes.includes(brandCode)) {
          console.log(`🔒 过滤掉无权限品牌: ${brandName} (${brandCode || '未知代码'})`);
          return;
        }
      }

      const courierName = CARRIER_NAME_MAP[carrierId] || carrierId;
      const actualCats = stat.actualCategories || {};
      const totalOrders = stat.total || 0;

      if (totalOrders === 0) return;

      // 🔥 C2D使用24H/48H/72H/72H+对应1天/2天/3天/3+天
      const time1d = actualCats['24H'] || 0;   // ≤24小时 = 1天内
      const time2d = actualCats['48H'] || 0;   // 24-48小时 = 2天内
      const time3d = actualCats['72H'] || 0;   // 48-72小时 = 3天内
      const time3Plus = actualCats['72H+'] || 0; // >72小时 = 3+天

      const avgActualHours = parseFloat(stat.avgActualHours) || 0;
      const avgPlanHours = parseFloat(stat.avgPlanHours) || 0;
      const avgTime = avgActualHours / 24; // 转换为天数
      const completionRate = avgActualHours > 0 ? (avgPlanHours / avgActualHours) * 100 : 100;

      if (!brandData[brandName]) {
        brandData[brandName] = [];
      }

      brandData[brandName].push({
        courier: courierName,
        brand: brandName,
        "1d": time1d,
        "2d": time2d,
        "3d": time3d,
        "3+d": time3Plus,
        totalOrders,
        avgTime,
        completionRate: Math.min(completionRate, 150)
      });
    });

    // 对每个品牌的快递商按订单量排序
    Object.keys(brandData).forEach(brand => {
      brandData[brand].sort((a, b) => b.totalOrders - a.totalOrders);
    });

    console.log('✅ C2D品牌×快递商 - 处理后数据:', {
      品牌数量: Object.keys(brandData).length,
      品牌列表: Object.keys(brandData),
      accessibleBrandCodes,
      详细数据: brandData
    });

    return brandData;
  }, [apiData, accessibleBrandCodes]);

  // 生成按品牌分组的快递商数据（Mock虚拟数据，作为降级方案）
  const brandCourierStatsFromMock = useMemo(() => {
    const validOrders = filterValidOrders(logisticsOrders).filter(order => 
      order.actualC2D !== undefined && order.planC2D !== undefined && order.status === 'delivered'
    );

    const brandData: Record<string, CourierC2DData[]> = {};

    // 🔥 根据用户权限过滤品牌：只显示用户有权限查看的品牌
    const allBrandNames = brandMappings.map(b => b.brandName);
    const brandsToDisplay = accessibleBrandCodes && accessibleBrandCodes.length > 0 
      ? allBrandNames.filter(brandName => {
          const brandCode = nameToCodeMap[brandName];
          return brandCode && accessibleBrandCodes.includes(brandCode);
        })
      : allBrandNames; // 如果没有传入权限信息，显示全部品牌（兼容旧代码）

    console.log('🔐 C2D品牌权限过滤:', { 
      accessibleBrandCodes, 
      brandsToDisplay,
      原始品牌列表: allBrandNames 
    });

    brandsToDisplay.forEach(brand => {
      const brandOrders = validOrders.filter(order => order.brand === brand);
      const brandCourierData: CourierC2DData[] = [];

      courierCompanies.forEach(courier => {
        const courierOrders = brandOrders.filter(order => order.courierCompany === courier);
        
        if (courierOrders.length > 0) {
          const time1d = courierOrders.filter(order => order.actualC2D! <= 24).length;
          const time2d = courierOrders.filter(order => order.actualC2D! > 24 && order.actualC2D! <= 48).length;
          const time3d = courierOrders.filter(order => order.actualC2D! > 48 && order.actualC2D! <= 72).length;
          const time3Plus = courierOrders.filter(order => order.actualC2D! > 72).length;
          
          const totalOrders = courierOrders.length;
          const avgTime = courierOrders.reduce((sum, order) => sum + order.actualC2D!, 0) / totalOrders;
          const avgPlanTime = courierOrders.reduce((sum, order) => sum + order.planC2D!, 0) / totalOrders;
          const completionRate = avgPlanTime > 0 ? (avgPlanTime / avgTime) * 100 : 100;

          brandCourierData.push({
            courier,
            brand,
            "1d": time1d,
            "2d": time2d,
            "3d": time3d,
            "3+d": time3Plus,
            totalOrders,
            avgTime: avgTime / 24, // 转换为天数
            completionRate: Math.min(completionRate, 150)
          });
        }
      });

      brandData[brand] = brandCourierData.sort((a, b) => b.totalOrders - a.totalOrders);
    });

    return brandData;
  }, [accessibleBrandCodes]);

  // 计算总体指标
  const totalStats = useMemo(() => {
    // ✅ 优先使用API数据
    const courierStats = courierC2DStatsFromAPI || courierC2DStatsMock;
    
    const totalOrders = courierStats.reduce((sum, courier) => sum + courier.totalOrders, 0);
    const weightedAvgTime = courierStats.reduce((sum, courier) => sum + courier.avgTime * courier.totalOrders, 0) / totalOrders || 0;
    const avgCompletionRate = courierStats.reduce((sum, courier) => sum + courier.completionRate * courier.totalOrders, 0) / totalOrders || 0;
    
    return {
      totalOrders,
      avgC2DTime: weightedAvgTime,
      avgCompletionRate
    };
  }, [courierC2DStatsFromAPI, courierC2DStatsMock]);

  // 快递商图标
  const getCourierIcon = (courierName: string) => {
    const iconMap: Record<string, string> = {
      '顺丰速运': '🚀',
      '中通快递': '🚚'
    };
    return iconMap[courierName] || '📦';
  };

  // 品牌图标
  const getBrandIcon = (brandName: string) => {
    const brandIcons: Record<string, string> = {
      'TNF': '🏔️',
      'DICKIES': '👔',
      'VANS': '👟',
      'TIMBERLAND': '🥾',
      'ICEBREAKER': '🧊',
      'KIPLING': '🎒'
    };
    return brandIcons[brandName] || '🏷️';
  };

  return (
    <div className="space-y-6">
      {/* ⚠️ C2D数据状态提示 */}
      {!apiData?.c2dAnalysis ? (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                ℹ️ 提示
              </Badge>
              <span className="text-sm text-yellow-800">
                C2D分析后端接口暂未实现，当前显示为虚拟演示数据
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                ✓ 真实数据
              </Badge>
              <span className="text-sm text-green-800">
                当前显示为真实C2D分析数据
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* 总体概览指标 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Total Orders</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{totalStats.totalOrders.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">C2D总订单数</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Average C2D Time</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{totalStats.avgC2DTime.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">天</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Completion Rate</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{totalStats.avgCompletionRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">平均完成率</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="courier" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="courier" className="flex items-center space-x-2">
            <Truck className="h-4 w-4" />
            <span>快递商分析</span>
          </TabsTrigger>
          <TabsTrigger value="brand" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>品牌×快递商</span>
          </TabsTrigger>
        </TabsList>

        {/* 快递商分析 */}
        <TabsContent value="courier" className="space-y-6">
          {/* 快递商C2D时效分布图 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <span>C2D时效分布 - 按快递商</span>
                {selectedBrand && (
                  <Badge variant="outline" className="ml-2">
                    {selectedBrand} 品牌
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedBrand 
                  ? `${selectedBrand} 品牌的C2D时效分析`
                  : '各品牌C2D时效分析'
                }
              </p>
            </CardHeader>
            
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={courierC2DStatsFromAPI || courierC2DStatsMock}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="courier" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#666' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#666' }}
                    label={{ 
                      value: '订单数量', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle' }
                    }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      value.toLocaleString(), 
                      `${name} 时效`
                    ]}
                    labelFormatter={(label) => `快递商: ${label}`}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="1d" stackId="a" fill="#22c55e" name="1d" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="2d" stackId="a" fill="#3b82f6" name="2d" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="3d" stackId="a" fill="#f59e0b" name="3d" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="3+d" stackId="a" fill="#ef4444" name="3+d" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 快递商详细数据卡片 */}
          <div className="grid grid-cols-2 gap-6">
            {(courierC2DStatsFromAPI || courierC2DStatsMock).map((courier, index) => (
              <Card key={index} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-lg">{getCourierIcon(courier.courier)}</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">{courier.courier}</CardTitle>
                        <div className="text-sm text-muted-foreground">
                          平均时效: {courier.avgTime.toFixed(1)}天
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="bg-purple-50">
                        {courier.totalOrders.toLocaleString()}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">总订单</div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* 时效分布条形图 */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span>1天 ({courier["1d"]})</span>
                      <span>{((courier["1d"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${(courier["1d"] / courier.totalOrders) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span>2天 ({courier["2d"]})</span>
                      <span>{((courier["2d"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${(courier["2d"] / courier.totalOrders) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span>3天 ({courier["3d"]})</span>
                      <span>{((courier["3d"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-yellow-500 h-2 rounded-full" 
                        style={{ width: `${(courier["3d"] / courier.totalOrders) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span>3天+ ({courier["3+d"]})</span>
                      <span>{((courier["3+d"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{ width: `${(courier["3+d"] / courier.totalOrders) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* 表现评级 */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium">完成率:</span>
                    <div className="flex items-center space-x-2">
                      <span className={`font-bold ${
                        courier.completionRate >= 100 ? 'text-green-600' : 
                        courier.completionRate >= 90 ? 'text-blue-600' : 
                        courier.completionRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {courier.completionRate.toFixed(1)}%
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          courier.completionRate >= 100 ? 'bg-green-50 text-green-700 border-green-300' : 
                          courier.completionRate >= 90 ? 'bg-blue-50 text-blue-700 border-blue-300' : 
                          courier.completionRate >= 80 ? 'bg-yellow-50 text-yellow-700 border-yellow-300' : 
                          'bg-red-50 text-red-700 border-red-300'
                        }`}
                      >
                        {courier.completionRate >= 100 ? '优秀' : 
                         courier.completionRate >= 90 ? '良好' : 
                         courier.completionRate >= 80 ? '一般' : '待改进'}
                      </Badge>
                    </div>
                  </div>

                  {/* 快速配送指标 */}
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">快速配送率 (≤2天):</span>
                      <span className="font-medium text-purple-600">
                        {(((courier["1d"] + courier["2d"]) / courier.totalOrders) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 品牌×快递商分析 */}
        <TabsContent value="brand" className="space-y-6">
          {selectedBrand && selectedBrand !== 'all' ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Package className="h-12 w-12 mx-auto opacity-30 mb-4" />
                <h4 className="font-medium mb-2">单品牌视图</h4>
                <p className="text-sm text-muted-foreground">
                  当前已选择 {selectedBrand} 品牌，请查看"快递商分析"标签页了解该品牌的快递商表现详情。
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* 🔥 遍历所有用户有权限的品牌（基于实际数据） */}
              {Object.keys(brandCourierStatsFromAPI || brandCourierStatsFromMock).map(brand => {
                const brandData = brandCourierStatsFromAPI ? brandCourierStatsFromAPI[brand] : brandCourierStatsFromMock[brand] || [];
                if (brandData.length === 0) return null;

                return (
                  <Card key={brand}>
                    <CardHeader>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getBrandIcon(brand)}</span>
                        <CardTitle>{brand} 品牌 - 快递商C2D表现</CardTitle>
                        {brandCourierStatsFromAPI && (
                          <Badge variant="default" className="text-xs bg-green-600">
                            ✓ 真实数据
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={brandData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                          barCategoryGap="30%"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="courier" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#666' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#666' }}
                            label={{ 
                              value: '订单数量', 
                              angle: -90, 
                              position: 'insideLeft',
                              style: { textAnchor: 'middle' }
                            }}
                          />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              value.toLocaleString(), 
                              `${name} 时效`
                            ]}
                            labelFormatter={(label) => `${brand} - ${label}`}
                            contentStyle={{
                              backgroundColor: '#fff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }}
                          />
                          <Legend />
                          <Bar dataKey="1d" stackId="a" fill="#22c55e" name="1d" />
                          <Bar dataKey="2d" stackId="a" fill="#3b82f6" name="2d" />
                          <Bar dataKey="3d" stackId="a" fill="#f59e0b" name="3d" />
                          <Bar dataKey="3+d" stackId="a" fill="#ef4444" name="3+d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 快速配送表现分析 */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>快速配送表现对比</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(courierC2DStatsFromAPI || courierC2DStatsMock).map((courier, index) => {
                const fastDelivery = courier["1d"] + courier["2d"]; // 1天 + 2天
                const fastRate = courier.totalOrders > 0 ? (fastDelivery / courier.totalOrders) * 100 : 0;
                
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getCourierIcon(courier.courier)}</span>
                      <span className="font-medium">{courier.courier}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-purple-600">{fastRate.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">2天内配送</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* C2D指标说明 */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">
            <h4 className="font-medium mb-2 text-foreground">C2D (Customer to Delivery) 时效分析说明：</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-foreground mb-1">分析重点：</h5>
                <ul className="space-y-1 list-disc list-inside">
                  <li>C2D包含订单处理、仓储、配送全链路</li>
                  <li>反映消费者从下单到收货的完整体验</li>
                  <li>绿色和蓝色区域占比越高表示服务越好</li>
                  <li>快速配送率（≤2天）是重要竞争指标</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-foreground mb-1">优化建议：</h5>
                <ul className="space-y-1 list-disc list-inside">
                  <li>关注红色区域（3+天）占比高的快递商</li>
                  <li>重点提升2天内配送率</li>
                  <li>根据品牌特性选择最适合的快递商</li>
                  <li>定期评估和调整快递商合作策略</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 p-2 bg-purple-50 rounded text-purple-700">
              💡 <strong>分析说明</strong>：C2D反映完整的消费者体验。
              快速配送率直接影响客户满意度。
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
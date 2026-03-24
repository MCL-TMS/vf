import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Badge } from "./ui/badge";
import { Clock, Package, Target, TrendingUp, Truck } from "lucide-react";
import { logisticsOrders, filterValidOrders } from "../data/logisticsOrderData";
import { vfBrands, courierCompanies } from "../data/slaData";
import { useMemo } from "react";
import { useBrand } from "../contexts/BrandContext"; // 🔥 导入useBrand Hook
import { DataLoadingState } from "./DataLoadingState"; // 🔥 新增：统一加载状态组件

interface S2DTimeChartProps {
  selectedBrand?: string;
  apiData?: any; // 新增：API返回的数据
  isLoading?: boolean; // 新增：加载状态
  accessibleBrandCodes?: string[]; // 🆕 新增：用户有权限查看的品牌代码列表
}

interface CourierS2DData {
  courier: string;
  brand?: string;
  "24H": number;
  "48H": number;
  "72H": number;
  "72H+": number;
  totalOrders: number;
  avgTime: number;
  completionRate: number;
}

export function S2DTimeChart({ selectedBrand, apiData, isLoading = false, accessibleBrandCodes }: S2DTimeChartProps) {
  const { nameToCodeMap } = useBrand(); // 🔥 获取动态品牌映射
  
  // 🔥 新增：从API数据生成图表数据
  const courierS2DStatsFromAPI = useMemo(() => {
    if (!apiData || !apiData.s2dAnalysis) {
      return null;
    }

    const s2dAnalysis = apiData.s2dAnalysis;
    const carrierStats = s2dAnalysis.carrierStats || {};

    console.log('📊 S2DTimeChart - API数据 - 快递商统计:', carrierStats);

    const courierData: CourierS2DData[] = [];

    Object.keys(carrierStats).forEach((carrierId) => {
      const carrierStat = carrierStats[carrierId];
      
      if (!carrierStat || carrierStat.total === 0) {
        return;
      }

      const actualCats = carrierStat.actualCategories || {};
      const planCats = carrierStat.planCategories || {};
      const totalOrders = carrierStat.total || 0;
      const avgActualHours = parseFloat(carrierStat.avgActualHours) || 0;  // ✅ 确保转换为数字
      const avgPlanHours = parseFloat(carrierStat.avgPlanHours) || 0;  // ✅ 确保转换为数字

      // 快递商名称映射
      const CARRIER_NAME_MAP: Record<string, string> = {
        'SF': '顺丰速运',
        'ZTO': '中通快递'
      };

      const courierName = CARRIER_NAME_MAP[carrierId] || carrierId;

      // 计算完成率（Plan / Actual * 100，Plan是目标，Actual是实际）
      const completionRate = avgActualHours > 0 ? (avgPlanHours / avgActualHours) * 100 : 100;

      courierData.push({
        courier: courierName,
        "24H": actualCats['24H'] || 0,
        "48H": actualCats['48H'] || 0,
        "72H": actualCats['72H'] || 0,
        "72H+": actualCats['72H+'] || 0,
        totalOrders,
        avgTime: avgActualHours,  // ✅ 已确保是数字
        completionRate: Math.min(completionRate, 150) // 限制最大值为150%
      });
    });

    return courierData.sort((a, b) => b.totalOrders - a.totalOrders);
  }, [apiData]);

  // 🔥 修改：不再使用虚拟数据fallback，仅返回API数据或null
  const courierS2DStats = useMemo(() => {
    if (courierS2DStatsFromAPI && courierS2DStatsFromAPI.length > 0) {
      console.log('✅ S2DTimeChart使用真实API数据');
      return courierS2DStatsFromAPI;
    }
    
    console.log('⚠️ S2DTimeChart无API数据，返回null');
    return null; // ❌ 删除：不再fallback到courierS2DStatsFromMock
  }, [courierS2DStatsFromAPI]);

  // 🆕 从API数据生成品牌×快递商分析数据
  const brandCourierStatsFromAPI = useMemo(() => {
    if (!apiData || !apiData.s2dAnalysis || !apiData.s2dAnalysis.brandCarrierStats) {
      return null;
    }

    const brandCarrierStats = apiData.s2dAnalysis.brandCarrierStats;
    console.log('📊 S2D品牌×快递商 - API原始数据:', brandCarrierStats);
    console.log('📊 S2D品牌×快递商 - 原始数据的key列表:', Object.keys(brandCarrierStats));

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
    const brandData: Record<string, CourierS2DData[]> = {};

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

      const avgActualHours = parseFloat(stat.avgActualHours) || 0;
      const avgPlanHours = parseFloat(stat.avgPlanHours) || 0;
      const completionRate = avgActualHours > 0 ? (avgPlanHours / avgActualHours) * 100 : 100;

      if (!brandData[brandName]) {
        brandData[brandName] = [];
      }

      brandData[brandName].push({
        courier: courierName,
        brand: brandName,
        "24H": actualCats['24H'] || 0,
        "48H": actualCats['48H'] || 0,
        "72H": actualCats['72H'] || 0,
        "72H+": actualCats['72H+'] || 0,
        totalOrders,
        avgTime: avgActualHours,
        completionRate: Math.min(completionRate, 150)
      });
    });

    // 对每个品牌的快递商按订单量排序
    Object.keys(brandData).forEach(brand => {
      brandData[brand].sort((a, b) => b.totalOrders - a.totalOrders);
    });

    console.log('✅ S2D品牌×快递商 - 处理后数据:', {
      品牌数量: Object.keys(brandData).length,
      品牌列表: Object.keys(brandData),
      accessibleBrandCodes,
      详细数据: brandData
    });

    return brandData;
  }, [apiData, accessibleBrandCodes]);

  // 生成按品牌×快递商分组的S2D统计数据（Mock虚拟数据，作为降级方案）
  const brandCourierStatsFromMock = useMemo(() => {
    const validOrders = filterValidOrders(logisticsOrders).filter(order => 
      order.actualS2D !== undefined && order.planS2D !== undefined && order.status === 'delivered'
    );

    const brandData: Record<string, CourierS2DData[]> = {};

    // 🔥 根据用户权限过滤品牌：只显示用户有权限查看的品牌
    const brandsToDisplay = accessibleBrandCodes && accessibleBrandCodes.length > 0 
      ? vfBrands.filter(brand => {
          // 将品牌名称映射到品牌代码进行权限检查
          const brandCodeMap: Record<string, string> = {
            'DICKIES': '18405',
            'TNF': '18405-1',
            'ICEBREAKER': '18405-2',
            'VANS': '18405-3',
            'TIMBERLAND': '18405-4',
            'SMARTWOOL': '18405-5'
          };
          const brandCode = brandCodeMap[brand];
          return brandCode && accessibleBrandCodes.includes(brandCode);
        })
      : vfBrands; // 如果没有传入权限信息，显示全部品牌（兼容旧代码）

    console.log('🔐 S2D品牌权限过滤:', { 
      accessibleBrandCodes, 
      brandsToDisplay,
      原始品牌列表: vfBrands 
    });

    brandsToDisplay.forEach(brand => {
      const brandOrders = validOrders.filter(order => order.brand === brand);
      const brandCourierData: CourierS2DData[] = [];

      courierCompanies.forEach(courier => {
        const courierOrders = brandOrders.filter(order => order.courierCompany === courier);
        
        if (courierOrders.length > 0) {
          const time24H = courierOrders.filter(order => order.actualS2D! <= 24).length;
          const time48H = courierOrders.filter(order => order.actualS2D! > 24 && order.actualS2D! <= 48).length;
          const time72H = courierOrders.filter(order => order.actualS2D! > 48 && order.actualS2D! <= 72).length;
          const time72Plus = courierOrders.filter(order => order.actualS2D! > 72).length;
          
          const totalOrders = courierOrders.length;
          const avgTime = courierOrders.reduce((sum, order) => sum + order.actualS2D!, 0) / totalOrders;
          const avgPlanTime = courierOrders.reduce((sum, order) => sum + order.planS2D!, 0) / totalOrders;
          const completionRate = avgPlanTime > 0 ? (avgPlanTime / avgTime) * 100 : 100;

          brandCourierData.push({
            courier,
            brand,
            "24H": time24H,
            "48H": time48H,
            "72H": time72H,
            "72H+": time72Plus,
            totalOrders,
            avgTime,
            completionRate: Math.min(completionRate, 150)
          });
        }
      });

      brandData[brand] = brandCourierData.sort((a, b) => b.totalOrders - a.totalOrders);
    });

    return brandData;
  }, [accessibleBrandCodes]);

  // 🔥 优先使用API数据，失败时回退到虚拟数据
  const brandCourierStats = useMemo(() => {
    if (brandCourierStatsFromAPI && Object.keys(brandCourierStatsFromAPI).length > 0) {
      console.log('✅ S2D品牌×快递商使用真实API数据');
      return brandCourierStatsFromAPI;
    }
    
    console.log('⚠️ S2D品牌×快递商使用虚拟数据');
    return brandCourierStatsFromMock;
  }, [brandCourierStatsFromAPI, brandCourierStatsFromMock]);

  // 计算总体指标（添加空数据检查）
  const totalStats = useMemo(() => {
    // ✅ 添加空数据检查
    if (!courierS2DStats || courierS2DStats.length === 0) {
      return {
        totalOrders: 0,
        avgS2DTime: 0,
        avgCompletionRate: 0
      };
    }
    
    const totalOrders = courierS2DStats.reduce((sum, courier) => sum + courier.totalOrders, 0);
    const weightedAvgTime = totalOrders > 0 ? 
      courierS2DStats.reduce((sum, courier) => sum + courier.avgTime * courier.totalOrders, 0) / totalOrders : 0;
    const avgCompletionRate = totalOrders > 0 ?
      courierS2DStats.reduce((sum, courier) => sum + courier.completionRate * courier.totalOrders, 0) / totalOrders : 0;
    
    return {
      totalOrders,
      avgS2DTime: weightedAvgTime,
      avgCompletionRate
    };
  }, [courierS2DStats]);

  // 快递商图标
  const getCourierIcon = (courierName: string) => {
    const iconMap: Record<string, string> = {
      '顺丰速运': '🚀',
      '中通快递': '🚚'
    };
    return iconMap[courierName] || '📦';
  };

  // 🆕 品牌图标
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
      {/* ✅ 添加数据加载状态检查 */}
      {!courierS2DStats ? (
        <DataLoadingState 
          hasData={false} 
          dataType="S2D时效数据" 
          message="当前筛选条件下没有S2D时效数据，请尝试调整日期范围或品牌筛选条件"
          mode="card"
        />
      ) : (
        <>
          {/* 总体概览指标 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Total Orders</span>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold">{totalStats.totalOrders.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">S2D总订单数</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Average S2D Time</span>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold">{totalStats.avgS2DTime.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">小时</div>
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

          {/* 🆕 Tab结构 */}
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

            {/* 快递商分析 Tab */}
            <TabsContent value="courier" className="space-y-6">
              {/* 快递商S2D时效分布图 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      <CardTitle>S2D时效分布 - 按快递商</CardTitle>
                      {selectedBrand && (
                        <Badge variant="outline" className="ml-2">
                          {selectedBrand} 品牌
                        </Badge>
                      )}
                      {isLoading && (
                        <Badge variant="secondary" className="text-xs">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-maersk-blue mr-2"></div>
                          加载中...
                        </Badge>
                      )}
                      {courierS2DStatsFromAPI && (
                        <Badge variant="default" className="text-xs bg-green-600">
                          ✓ 真实数据
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedBrand 
                      ? `${selectedBrand} 品牌的S2D时效分析`
                      : '各快递商S2D时效分析'
                    }
                  </p>
                </CardHeader>
                
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={courierS2DStats}
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
                      <Bar dataKey="24H" stackId="a" fill="#22c55e" name="24H" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="48H" stackId="a" fill="#3b82f6" name="48H" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="72H" stackId="a" fill="#f59e0b" name="72H" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="72H+" stackId="a" fill="#ef4444" name="72H+" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 快递商详细数据卡片 */}
              <div className="grid grid-cols-2 gap-6">
                {courierS2DStats.map((courier, index) => (
                  <Card key={index} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-lg">{getCourierIcon(courier.courier)}</span>
                          </div>
                          <div>
                            <CardTitle className="text-lg">{courier.courier}</CardTitle>
                            <div className="text-sm text-muted-foreground">
                              平均时效: {courier.avgTime.toFixed(1)}小时
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="bg-blue-50">
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
                          <span>24H ({courier["24H"]})</span>
                          <span>{((courier["24H"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full" 
                            style={{ width: `${(courier["24H"] / courier.totalOrders) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-xs">
                          <span>48H ({courier["48H"]})</span>
                          <span>{((courier["48H"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full" 
                            style={{ width: `${(courier["48H"] / courier.totalOrders) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-xs">
                          <span>72H ({courier["72H"]})</span>
                          <span>{((courier["72H"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-yellow-500 h-2 rounded-full" 
                            style={{ width: `${(courier["72H"] / courier.totalOrders) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-xs">
                          <span>72H+ ({courier["72H+"]})</span>
                          <span>{((courier["72H+"] / courier.totalOrders) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-red-500 h-2 rounded-full" 
                            style={{ width: `${(courier["72H+"] / courier.totalOrders) * 100}%` }}
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
                          <span className="text-muted-foreground">快速配送率 (≤48h):</span>
                          <span className="font-medium text-blue-600">
                            {(((courier["24H"] + courier["48H"]) / courier.totalOrders) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* 🆕 品牌×快递商分析 Tab */}
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
                  {/* 🔥 遍历所有用户有权限的品牌（基于brandCourierStats的实际数据） */}
                  {Object.keys(brandCourierStats).map(brand => {
                    const brandData = brandCourierStats[brand] || [];
                    if (brandData.length === 0) return null;

                    return (
                      <Card key={brand}>
                        <CardHeader>
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getBrandIcon(brand)}</span>
                            <CardTitle>{brand} 品牌 - 快递商S2D表现</CardTitle>
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
                              <Bar dataKey="24H" stackId="a" fill="#22c55e" name="24H" />
                              <Bar dataKey="48H" stackId="a" fill="#3b82f6" name="48H" />
                              <Bar dataKey="72H" stackId="a" fill="#f59e0b" name="72H" />
                              <Bar dataKey="72H+" stackId="a" fill="#ef4444" name="72H+" />
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
                  {courierS2DStats.map((courier, index) => {
                    const fastDelivery = courier["24H"] + courier["48H"]; // 24H + 48H
                    const fastRate = courier.totalOrders > 0 ? (fastDelivery / courier.totalOrders) * 100 : 0;
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getCourierIcon(courier.courier)}</span>
                          <span className="font-medium">{courier.courier}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-600">{fastRate.toFixed(1)}%</div>
                          <div className="text-sm text-muted-foreground">48h内配送</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* 说明信息 */}
          <Card className="bg-muted/30">
            <CardContent className="p-4 bg-white">
              <h4 className="font-medium mb-2">📊 S2D时效分析说明</h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <h5 className="font-medium text-foreground mb-1">分析重点：</h5>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>S2D专注于配送环节的时效表现</li>
                    <li>绿色和蓝色区域占比越高表示配送越快</li>
                    <li>快速配送率（≤48h）是评估快递商的关键指标</li>
                    <li>品牌×快递商交叉分析帮助识别最佳组合</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium text-foreground mb-1">优化建议：</h5>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>关注红色区域（72H+）占比高的快递商</li>
                    <li>重点提升48小时内配送率</li>
                    <li>根据品牌特性选择最适合的快递商</li>
                    <li>定期评估和调整快递商合作策略</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 p-2 bg-blue-50 rounded text-blue-700">
                💡 <strong>提示</strong>：S2D反映快递商纯配送能力。
                24H和48H占比高的快递商配送效率更优。
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Calculator } from "lucide-react";
import { CourierPerformanceTable } from "./CourierPerformanceTable";
import { S2DTimeChart } from "./S2DTimeChart";
import { C2DTimeChart } from "./C2DTimeChart";
import { UnifiedAIChatAssistant } from "./UnifiedAIChatAssistant";
import { useState, useEffect, useCallback, useMemo } from "react"; // 🔥 添加useMemo
import { toast } from "sonner@2.0.3";
import { COMPETITOR_BENCHMARK_CONFIG } from "./CompetitorBenchmarkConfig"; // 🆕 导入竞品配置
import { useAuth } from "../contexts/AuthContext"; // 🔥 导入useAuth获取用户权限

interface TimeEfficiencyAnalysisProps {
  selectedBrand?: string;
  selectedSelfFlag?: string;
  dateRange?: { from: string; to: string };
}

// 🔧 竞品对比配置：/components/CompetitorBenchmarkConfig.tsx
// 竞品数据从API获取，与当前品牌使用同一接口，只是 CUSTOMERNO 不同
// 竞品数据不做前台展示，仅在AI助手回答时使用

export function TimeEfficiencyAnalysis({ selectedBrand, selectedSelfFlag, dateRange }: TimeEfficiencyAnalysisProps) {
  const { user, getAccessibleBrands } = useAuth(); // 🔥 获取当前用户信息和品牌访问方法
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [competitorData, setCompetitorData] = useState<any>(null); // 🆕 竞品数据
  const [isLoading, setIsLoading] = useState(false);
  const [currentMetricType, setCurrentMetricType] = useState<'S2D' | 'C2D'>('S2D');
  
  // 🔥 获取用户可访问的品牌代码列表
  const accessibleBrandCodes = useMemo(() => {
    return getAccessibleBrands();
  }, [getAccessibleBrands]);
  
  console.log('🔥🔥🔥 TimeEfficiencyAnalysis组件渲染:', {
    selectedBrand,
    selectedSelfFlag,
    dateRange,
    hasDateRange: !!dateRange,
    dateRangeFrom: dateRange?.from,
    dateRangeTo: dateRange?.to,
    currentMetricType,
    accessibleBrandCodes, // 🔥 添加日志
    user // 🔥 打印用户对象查看结构
  });
  
  // 加载时效分析数据（支持S2D和C2D）
  const loadTimelinessAnalysis = useCallback(async (analysisType: 'S2D' | 'C2D') => {
    console.log(`🚀 loadTimelinessAnalysis被调用，准备开始${analysisType}时效分析...`);
    setIsLoading(true);
    
    try {
      const requestBody = {
        dateRange,
        selectedBrand,
        selectedSelfFlag,
        selectedCarrier: null,
        analysisType,
        userBrands: accessibleBrandCodes // 🔥 修复：改为userBrands与后端参数名一致
      };

      console.log(`🔍 自动执行${analysisType}时效分析:`, requestBody);

      const response = await fetch('http://localhost:3001/api/upload/analyze-timeliness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `${analysisType}时效分析失败`);
      }

      const result = await response.json();
      console.log(`✅ ${analysisType}时效分析完成:`, result);
      
      // 🔍 详细检查返回的数据结构
      console.log(`🔍 ${analysisType} 数据结构检查:`, {
        hasResult: !!result,
        hasData: !!result.data,
        dataKeys: result.data ? Object.keys(result.data) : [],
        hasS2DAnalysis: !!result.data?.s2dAnalysis,
        hasC2DAnalysis: !!result.data?.c2dAnalysis,
        hasRawOrders: !!result.data?.rawOrders,  // 🔥 新增：检查rawOrders
        rawOrdersCount: result.data?.rawOrders?.length || 0,  // 🔥 新增：订单数量
        analysisType: analysisType
      });

      setAnalysisResult(result.data);

    } catch (error) {
      console.error(`❌ ${analysisType}时效分析失败:`, error);
      setAnalysisResult(null);
      // 不显示错误toast，让表格和图表组件使用自己的虚拟数据
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, selectedBrand, selectedSelfFlag, accessibleBrandCodes]);

  // 🆕 加载竞品数据（从API获取）
  const loadCompetitorData = useCallback(async (analysisType: 'S2D' | 'C2D') => {
    if (!COMPETITOR_BENCHMARK_CONFIG.enabled) {
      console.log('🔒 竞品对比功能已关闭');
      setCompetitorData(null);
      return;
    }

    console.log('🏆 开始加载竞品数据...', {
      enabled: COMPETITOR_BENCHMARK_CONFIG.enabled,
      competitors: COMPETITOR_BENCHMARK_CONFIG.competitors,
      analysisType
    });

    try {
      // 🔄 并发加载所有竞品数据（与当前品牌使用同一API接口）
      const competitorResults = await Promise.all(
        COMPETITOR_BENCHMARK_CONFIG.competitors.map(async (competitorBrand) => {
          try {
            const requestBody = {
              dateRange,
              selectedBrand: competitorBrand, // 🔑 使用竞品品牌代码（如 'ANF', 'STICHDMAN'）
              selectedSelfFlag: null,
              selectedCarrier: null,
              analysisType
            };

            console.log(`📡 请求竞品 ${competitorBrand} 数据:`, requestBody);

            const response = await fetch('http://localhost:3001/api/upload/analyze-timeliness', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
              console.warn(`⚠️ 竞品 ${competitorBrand} 数据加载失败`);
              return null;
            }

            const result = await response.json();
            console.log(`✅ 竞品 ${competitorBrand} 数据加载成功:`, result);
            
            // 🔍 详细检查返回的数据结构
            console.log(`🔍 竞品 ${competitorBrand} 详细数据检查:`, {
              hasResult: !!result,
              hasData: !!result.data,
              dataKeys: result.data ? Object.keys(result.data) : [],
              hasS2DAnalysis: !!result.data?.s2dAnalysis,
              hasC2DAnalysis: !!result.data?.c2dAnalysis,
              s2dKeys: result.data?.s2dAnalysis ? Object.keys(result.data.s2dAnalysis) : [],
              c2dKeys: result.data?.c2dAnalysis ? Object.keys(result.data.c2dAnalysis) : [],
              hasBrandCarrierStats: !!(result.data?.s2dAnalysis?.brandCarrierStats || result.data?.c2dAnalysis?.brandCarrierStats),
              statsCount: result.data?.s2dAnalysis?.brandCarrierStats 
                ? Object.keys(result.data.s2dAnalysis.brandCarrierStats).length 
                : result.data?.c2dAnalysis?.brandCarrierStats
                ? Object.keys(result.data.c2dAnalysis.brandCarrierStats).length
                : 0
            });
            
            // 🚨 检查是否真的有数据
            const hasActualData = result.data?.s2dAnalysis?.brandCarrierStats 
              ? Object.keys(result.data.s2dAnalysis.brandCarrierStats).length > 0
              : result.data?.c2dAnalysis?.brandCarrierStats
              ? Object.keys(result.data.c2dAnalysis.brandCarrierStats).length > 0
              : false;
            
            if (!hasActualData) {
              console.warn(`⚠️ 竞品 ${competitorBrand} 没有返回任何订单数据！可能原因：
1. 数据库中存在 CUSTOMERNO='${competitorBrand}' 的订单数据
2. 当前日期范围内没有该品牌的订单
3. 品牌代码拼写错误

建议操作：
- 检查数据库：SELECT COUNT(*) FROM APP_CMS.TSK_LIST_TASK WHERE CUSTOMERNO='${competitorBrand}';
- 或将配置文件中的 enabled 设置为 false 禁用竞品对比功能`);
            }

            return {
              brand: competitorBrand,
              data: result.data
            };
          } catch (error) {
            console.error(`❌ 竞品 ${competitorBrand} 数据加载异常:`, error);
            return null;
          }
        })
      );

      // 过滤掉加载失败的竞品
      const validCompetitors = competitorResults.filter(c => c !== null);

      if (validCompetitors.length > 0) {
        setCompetitorData({
          enabled: true,
          competitors: validCompetitors,
          displayMode: 'ratio-only' // 只显示比率，不显示具体数值
        });
        console.log('✅ 竞品数据加载完成:', {
          count: validCompetitors.length,
          brands: validCompetitors.map(c => c.brand)
        });
      } else {
        setCompetitorData(null);
        console.log('⚠️ 没有成功加载任何竞品数据');
      }
    } catch (error) {
      console.error('❌ 竞品数据加载失败:', error);
      setCompetitorData(null);
    }
  }, [dateRange]);

  // 自动加载时效分析数据（根据当前Tab类型）
  useEffect(() => {
    if (dateRange && dateRange.from && dateRange.to) {
      console.log(`🔄 useEffect触发，加载${currentMetricType}数据...`);
      loadTimelinessAnalysis(currentMetricType); // ✅ 修复：使用currentMetricType而不是硬编码'S2D'
      loadCompetitorData(currentMetricType); // 🆕 同时加载竞品数据
    }
  }, [dateRange, selectedBrand, selectedSelfFlag, currentMetricType, loadTimelinessAnalysis, loadCompetitorData]); // ✅ 添加currentMetricType依赖

  // 当切换Tab时重新加载对应类型的数据
  const handleTabChange = (value: string) => {
    // ✅ 修复：将小写的tab value转换为大写的分析类型
    const metricType = value.toUpperCase() as 'S2D' | 'C2D';
    setCurrentMetricType(metricType);
    
    console.log(`🔄 Tab切换事件触发:`, {
      tabValue: value,
      metricType: metricType,
      hasDateRange: !!dateRange
    });
    
    if (dateRange && dateRange.from && dateRange.to) {
      console.log(`🔄 切换到${metricType}，重新加载数据...`);
      loadTimelinessAnalysis(metricType);
      loadCompetitorData(metricType); // 🆕 同时加载竞品数据
    } else {
      console.warn('⚠️ 无法加载数据：缺少dateRange');
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">时效分析</h2>
        {/*  <p className="text-sm text-muted-foreground mt-1">
            基于预配置时效标准的Plan vs Actual对比分析
          </p> */}
        </div>
        <div className="flex items-center space-x-3">
          {selectedBrand && (
            <Badge variant="outline" className="text-sm bg-maersk-blue text-maersk-white border-maersk-blue">
              🎯 当前筛选品牌: {selectedBrand}
            </Badge>
          )}

          
          {isLoading && (
            <Badge variant="outline" className="text-sm">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-maersk-blue mr-2"></div>
              加载中...(正在分析{currentMetricType}数据)
            </Badge>
          )}
        </div>
      </div>

      <Tabs 
        defaultValue="s2d" 
        className="space-y-6"
        onValueChange={handleTabChange}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="s2d" className="flex items-center space-x-2">
            <span>📊</span>
            <span>S2D 时效分析</span>
          </TabsTrigger>
          <TabsTrigger value="c2d" className="flex items-center space-x-2">
            <span>📈</span>
            <span>C2D 时效分析</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="s2d" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* S2D 表格分析 */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                <span>📋</span>
                <span>S2D 数据表格</span>
               {/* <Badge variant="secondary" className="text-xs">
                  发运到签收时效统计
                </Badge>*/}
              </h3>
              <CourierPerformanceTable 
                selectedBrand={selectedBrand} 
                metricType="S2D"
                apiData={analysisResult}
                isLoading={isLoading}
                rawOrders={analysisResult?.rawOrders || []} // ✅ 从API获取原始订单数据
              />
            </div>

            {/* S2D 图表分析 */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                <span>📊</span>
                <span>S2D 图表分析</span>
                {/*  <Badge variant="secondary" className="text-xs">
                  可视化趋势与分布
                </Badge>*/}
              </h3>
              <S2DTimeChart 
                selectedBrand={selectedBrand} 
                apiData={analysisResult}
                isLoading={isLoading}
                accessibleBrandCodes={accessibleBrandCodes}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="c2d" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* C2D 表格分析 */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                <span>📋</span>
                <span>C2D 数据表格</span>
               {/*   <Badge variant="secondary" className="text-xs">
                  付款到签收时效统计
                </Badge>*/}
              </h3>
              <CourierPerformanceTable 
                selectedBrand={selectedBrand} 
                metricType="C2D"
                apiData={analysisResult}
                isLoading={isLoading}
                rawOrders={analysisResult?.rawOrders || []} // ✅ 从API获取原始订单数据
              />
            </div>

            {/* C2D 图表分析 */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                <span>📈</span>
                <span>C2D 图表分析</span>
               {/*  <Badge variant="secondary" className="text-xs">
                  可视化趋势与分布
                </Badge>*/}
              </h3>
              <C2DTimeChart 
                selectedBrand={selectedBrand} 
                apiData={analysisResult}
                isLoading={isLoading}
                accessibleBrandCodes={accessibleBrandCodes}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* AI 问答助手 - 悬浮在右下角 */}
      <UnifiedAIChatAssistant 
        analysisData={analysisResult}
        competitorData={competitorData} 
        selectedBrand={selectedBrand}
        dateRange={dateRange}
        metricType={currentMetricType}
      />

      {/* 时效分析说明已删除 */}
    </div>
  );
}
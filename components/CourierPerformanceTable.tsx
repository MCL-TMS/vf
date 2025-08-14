import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { logisticsOrders, filterValidOrders } from "../data/logisticsOrderData";
import { vfBrands } from "../data/slaData";
import { useMemo } from "react";

interface CourierPerformanceTableProps {
  selectedBrand?: string;
  metricType: 'S2D' | 'C2D';
  compact?: boolean; // 新增紧凑模式
}

interface BrandMetrics {
  brand: string;
  order: number;
  "24H": { count: number; ratio: number; actualVsPlan: number };
  "48H": { count: number; ratio: number; actualVsPlan: number };
  "72H": { count: number; ratio: number; actualVsPlan: number };
  "72H+": { count: number; ratio: number; actualVsPlan: number };
  totalTime: number;
}

interface CourierData {
  courier: 'SF' | 'ZTO' | 'SF+ZTO';
  brands: BrandMetrics[];
  total: BrandMetrics;
}

export function CourierPerformanceTable({ selectedBrand, metricType, compact = false }: CourierPerformanceTableProps) {
  
  const courierData = useMemo(() => {
    const validOrders = filterValidOrders(logisticsOrders).filter(order => 
      order.status === 'delivered'
    );

    const filteredOrders = selectedBrand ? 
      validOrders.filter(order => order.brand === selectedBrand) : 
      validOrders;

    // Define the keys based on metric type
    const actualTimeKey = metricType === 'S2D' ? 'actualS2D' : 'actualC2D';
    const planTimeKey = metricType === 'S2D' ? 'planS2D' : 'planC2D';

    // 计算单个快递商的数据
    const calculateCourierData = (courierName: string): CourierData => {
      const courierOrders = filteredOrders.filter(order => 
        order.courierCompany === (courierName === 'SF' ? '顺丰速运' : '中通快递')
      );

      const brands: BrandMetrics[] = [];
      let totalOrderCount = 0;
      let totalCounts = { "24H": 0, "48H": 0, "72H": 0, "72H+": 0 };

      // 处理品牌名称映射
      const brandMapping: Record<string, string> = {
        'DICKIES': 'DKS',
        'TIMBERLAND': 'TBL', 
        'TNF': 'TNF',
        'KIPLING': 'kipling',
        'VANS': 'VANS',
        'ICEBREAKER': 'IB'
      };

      // 计算每个品牌的数据
      const brandsToProcess = selectedBrand ? [selectedBrand] : vfBrands;
      
      brandsToProcess.forEach(brand => {
        const brandOrders = courierOrders.filter(order => order.brand === brand);
        
        if (brandOrders.length > 0) {
          const displayBrand = brandMapping[brand] || brand;
          const brandMetric: BrandMetrics = {
            brand: displayBrand,
            order: brandOrders.length,
            "24H": { count: 0, ratio: 0, actualVsPlan: 0 },
            "48H": { count: 0, ratio: 0, actualVsPlan: 0 },
            "72H": { count: 0, ratio: 0, actualVsPlan: 0 },
            "72H+": { count: 0, ratio: 0, actualVsPlan: 0 },
            totalTime: 0
          };

          // 过滤出有时效数据的订单
          const ordersWithTime = brandOrders.filter(order => 
            order[actualTimeKey] !== undefined && order[planTimeKey] !== undefined
          );

          // 分类统计
          const timeCategories = ["24H", "48H", "72H", "72H+"] as const;
          timeCategories.forEach(category => {
            let categoryOrders;
            
            if (category === "24H") {
              categoryOrders = ordersWithTime.filter(order => order[actualTimeKey]! <= 24);
            } else if (category === "48H") {
              categoryOrders = ordersWithTime.filter(order => order[actualTimeKey]! > 24 && order[actualTimeKey]! <= 48);
            } else if (category === "72H") {
              categoryOrders = ordersWithTime.filter(order => order[actualTimeKey]! > 48 && order[actualTimeKey]! <= 72);
            } else {
              categoryOrders = ordersWithTime.filter(order => order[actualTimeKey]! > 72);
            }

            const count = categoryOrders.length;
            const ratio = ordersWithTime.length > 0 ? (count / ordersWithTime.length) * 100 : 0;
            
            // 计算实际vs计划比例
            let actualVsPlan = 0;
            if (count > 0) {
              const avgActual = categoryOrders.reduce((sum, order) => sum + order[actualTimeKey]!, 0) / count;
              const avgPlan = categoryOrders.reduce((sum, order) => sum + order[planTimeKey]!, 0) / count;
              actualVsPlan = avgPlan > 0 ? (avgActual / avgPlan) * 100 : 100;
            }

            brandMetric[category] = { count, ratio, actualVsPlan };
            totalCounts[category] += count;
          });

          // 计算总体时间
          if (ordersWithTime.length > 0) {
            const avgTime = ordersWithTime.reduce((sum, order) => sum + order[actualTimeKey]!, 0) / ordersWithTime.length;
            brandMetric.totalTime = metricType === 'S2D' ? avgTime : avgTime / 24; // C2D转换为天
          }

          brands.push(brandMetric);
          totalOrderCount += ordersWithTime.length;
        }
      });

      // 计算总计行
      const ordersWithTime = courierOrders.filter(order => 
        order[actualTimeKey] !== undefined && order[planTimeKey] !== undefined
      );

      const total: BrandMetrics = {
        brand: 'Total',
        order: totalOrderCount,
        "24H": { 
          count: totalCounts["24H"], 
          ratio: totalOrderCount > 0 ? (totalCounts["24H"] / totalOrderCount) * 100 : 0,
          actualVsPlan: 0
        },
        "48H": { 
          count: totalCounts["48H"], 
          ratio: totalOrderCount > 0 ? (totalCounts["48H"] / totalOrderCount) * 100 : 0,
          actualVsPlan: 0
        },
        "72H": { 
          count: totalCounts["72H"], 
          ratio: totalOrderCount > 0 ? (totalCounts["72H"] / totalOrderCount) * 100 : 0,
          actualVsPlan: 0
        },
        "72H+": { 
          count: totalCounts["72H+"], 
          ratio: totalOrderCount > 0 ? (totalCounts["72H+"] / totalOrderCount) * 100 : 0,
          actualVsPlan: 0
        },
        totalTime: 0
      };

      // 计算总计的实际vs计划比例和平均时间
      if (ordersWithTime.length > 0) {
        const avgTime = ordersWithTime.reduce((sum, order) => sum + order[actualTimeKey]!, 0) / ordersWithTime.length;
        total.totalTime = metricType === 'S2D' ? avgTime : avgTime / 24;

        const timeCategories = ["24H", "48H", "72H", "72H+"] as const;
        timeCategories.forEach(category => {
          const categoryOrders = ordersWithTime.filter(order => {
            const actualTime = order[actualTimeKey]!;
            if (category === "24H") return actualTime <= 24;
            if (category === "48H") return actualTime > 24 && actualTime <= 48;
            if (category === "72H") return actualTime > 48 && actualTime <= 72;
            return actualTime > 72;
          });
          
          if (categoryOrders.length > 0) {
            const avgActual = categoryOrders.reduce((sum, order) => sum + order[actualTimeKey]!, 0) / categoryOrders.length;
            const avgPlan = categoryOrders.reduce((sum, order) => sum + order[planTimeKey]!, 0) / categoryOrders.length;
            total[category].actualVsPlan = avgPlan > 0 ? (avgActual / avgPlan) * 100 : 100;
          }
        });
      }

      return {
        courier: courierName as 'SF' | 'ZTO' | 'SF+ZTO',
        brands: brands.sort((a, b) => b.order - a.order), // 按订单数量排序
        total
      };
    };

    // 计算SF、ZTO和合计数据
    const sfData = calculateCourierData('SF');
    const ztoData = calculateCourierData('ZTO');
    
    // 计算SF+ZTO合计
    const combinedBrands: BrandMetrics[] = [];
    const allBrands = [...new Set([...sfData.brands.map(b => b.brand), ...ztoData.brands.map(b => b.brand)])];
    
    allBrands.forEach(brandName => {
      const sfBrand = sfData.brands.find(b => b.brand === brandName);
      const ztoBrand = ztoData.brands.find(b => b.brand === brandName);
      
      if (sfBrand || ztoBrand) {
        const combinedBrand: BrandMetrics = {
          brand: brandName,
          order: (sfBrand?.order || 0) + (ztoBrand?.order || 0),
          "24H": { 
            count: (sfBrand?.["24H"].count || 0) + (ztoBrand?.["24H"].count || 0),
            ratio: 0,
            actualVsPlan: 0
          },
          "48H": { 
            count: (sfBrand?.["48H"].count || 0) + (ztoBrand?.["48H"].count || 0),
            ratio: 0,
            actualVsPlan: 0
          },
          "72H": { 
            count: (sfBrand?.["72H"].count || 0) + (ztoBrand?.["72H"].count || 0),
            ratio: 0,
            actualVsPlan: 0
          },
          "72H+": { 
            count: (sfBrand?.["72H+"].count || 0) + (ztoBrand?.["72H+"].count || 0),
            ratio: 0,
            actualVsPlan: 0
          },
          totalTime: 0
        };

        // 计算合并后的比例
        const timeCategories = ["24H", "48H", "72H", "72H+"] as const;
        timeCategories.forEach(category => {
          combinedBrand[category].ratio = combinedBrand.order > 0 ? 
            (combinedBrand[category].count / combinedBrand.order) * 100 : 0;
        });

        // 计算加权平均的总时间和实际vs计划比例
        const sfWeight = sfBrand?.order || 0;
        const ztoWeight = ztoBrand?.order || 0;
        const totalWeight = sfWeight + ztoWeight;

        if (totalWeight > 0) {
          combinedBrand.totalTime = ((sfBrand?.totalTime || 0) * sfWeight + (ztoBrand?.totalTime || 0) * ztoWeight) / totalWeight;
          
          timeCategories.forEach(category => {
            const sfActualVsPlan = sfBrand?.[category].actualVsPlan || 0;
            const ztoActualVsPlan = ztoBrand?.[category].actualVsPlan || 0;
            const sfCategoryWeight = sfBrand?.[category].count || 0;
            const ztoCategoryWeight = ztoBrand?.[category].count || 0;
            const categoryTotalWeight = sfCategoryWeight + ztoCategoryWeight;
            
            if (categoryTotalWeight > 0) {
              combinedBrand[category].actualVsPlan = 
                (sfActualVsPlan * sfCategoryWeight + ztoActualVsPlan * ztoCategoryWeight) / categoryTotalWeight;
            }
          });
        }

        combinedBrands.push(combinedBrand);
      }
    });

    // 计算合计的总计行
    const combinedTotal: BrandMetrics = {
      brand: 'Total',
      order: sfData.total.order + ztoData.total.order,
      "24H": { 
        count: sfData.total["24H"].count + ztoData.total["24H"].count,
        ratio: 0,
        actualVsPlan: 0
      },
      "48H": { 
        count: sfData.total["48H"].count + ztoData.total["48H"].count,
        ratio: 0,
        actualVsPlan: 0
      },
      "72H": { 
        count: sfData.total["72H"].count + ztoData.total["72H"].count,
        ratio: 0,
        actualVsPlan: 0
      },
      "72H+": { 
        count: sfData.total["72H+"].count + ztoData.total["72H+"].count,
        ratio: 0,
        actualVsPlan: 0
      },
      totalTime: 0
    };

    // 计算合计比例
    const timeCategories = ["24H", "48H", "72H", "72H+"] as const;
    timeCategories.forEach(category => {
      combinedTotal[category].ratio = combinedTotal.order > 0 ? 
        (combinedTotal[category].count / combinedTotal.order) * 100 : 0;
    });

    // 计算加权平均
    if (combinedTotal.order > 0) {
      const sfWeight = sfData.total.order;
      const ztoWeight = ztoData.total.order;
      combinedTotal.totalTime = (sfData.total.totalTime * sfWeight + ztoData.total.totalTime * ztoWeight) / combinedTotal.order;
      
      timeCategories.forEach(category => {
        const sfCount = sfData.total[category].count;
        const ztoCount = ztoData.total[category].count;
        const totalCount = sfCount + ztoCount;
        
        if (totalCount > 0) {
          combinedTotal[category].actualVsPlan = 
            (sfData.total[category].actualVsPlan * sfCount + ztoData.total[category].actualVsPlan * ztoCount) / totalCount;
        }
      });
    }

    const combinedData: CourierData = {
      courier: 'SF+ZTO',
      brands: combinedBrands.sort((a, b) => b.order - a.order),
      total: combinedTotal
    };

    return [sfData, ztoData, combinedData];
  }, [selectedBrand, metricType]);

  const getBrandIcon = (brandName: string) => {
    const brandIcons: Record<string, string> = {
      'DKS': '👔',
      'TBL': '🥾',
      'TNF': '🏔️',
      'kipling': '🎒',
      'VANS': '👟',
      'IB': '🧊'
    };
    return brandIcons[brandName] || '🏷️';
  };

  const getCourierIcon = (courier: string) => {
    if (courier === 'SF') return '🚀';
    if (courier === 'ZTO') return '🚚';
    return '📊';
  };

  const getPerformanceColor = (actualVsPlan: number) => {
    if (actualVsPlan === 0) return 'text-gray-400 bg-gray-50';
    if (actualVsPlan <= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (actualVsPlan <= 100) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (actualVsPlan <= 120) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getDeliveryRatioColor = (ratio: number) => {
    if (ratio >= 40) return 'text-green-600 font-semibold';
    if (ratio >= 20) return 'text-blue-600 font-medium';
    if (ratio >= 10) return 'text-orange-600';
    if (ratio > 0) return 'text-red-600';
    return 'text-gray-400';
  };

  const renderBrandRow = (brand: BrandMetrics, isTotal: boolean = false) => {
    const timeCategories = ["24H", "48H", "72H", "72H+"] as const;
    
    return (
      <tr key={brand.brand} className={`border-b hover:bg-muted/30 ${isTotal ? 'bg-muted/50 font-medium border-t-2' : ''}`}>
        <td className={`${compact ? 'p-1 pl-2' : 'p-2 pl-4'}`}>
          <div className="flex items-center space-x-2">
            {!isTotal && <span className="text-sm">{getBrandIcon(brand.brand)}</span>}
            <span className={isTotal ? 'font-bold' : 'font-medium'}>{brand.brand}</span>
          </div>
        </td>
        <td className={`${compact ? 'p-1' : 'p-2'} text-center font-semibold`}>
          {brand.order > 0 ? brand.order.toLocaleString() : '-'}
        </td>
        {timeCategories.map(category => (
          <td key={category} className={compact ? 'p-1' : 'p-2'}>
            <div className="space-y-1 text-center">
              <div className={`text-sm ${getDeliveryRatioColor(brand[category].ratio)}`}>
                {brand[category].ratio > 0 ? `${brand[category].ratio.toFixed(1)}%` : '0.0%'}
              </div>
              <div className="text-xs text-muted-foreground">
                {brand[category].count > 0 ? brand[category].count : '0'}
              </div>
              <div className="flex justify-center">
                <Badge 
                  variant="outline" 
                  className={`text-xs px-1 py-0 ${getPerformanceColor(brand[category].actualVsPlan)}`}
                >
                  {brand[category].actualVsPlan > 0 ? `${brand[category].actualVsPlan.toFixed(0)}%` : '#DIV/0!'}
                </Badge>
              </div>
            </div>
          </td>
        ))}
        <td className={`${compact ? 'p-1' : 'p-2'} text-center`}>
          <div className="font-semibold text-blue-600">
            {brand.totalTime > 0 ? brand.totalTime.toFixed(metricType === 'S2D' ? 0 : 3) : '-'}
          </div>
        </td>
      </tr>
    );
  };

  const renderCourierSection = (data: CourierData) => (
    <div className="space-y-4">
      <div className={`flex items-center space-x-2 ${compact ? 'mb-2' : 'mb-3'}`}>
        <span className="text-lg">{getCourierIcon(data.courier)}</span>
        <h3 className={`font-semibold ${compact ? 'text-base' : 'text-lg'}`}>
          {data.courier === 'SF' ? 'SF (顺丰速运)' : 
           data.courier === 'ZTO' ? 'ZTO (中通快递)' : 
           'SF+ZTO (合计)'}
        </h3>
        <Badge variant="outline" className="text-xs">
          {data.total.order.toLocaleString()} 订单
        </Badge>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border rounded-lg">
          <thead>
            <tr className="bg-muted/50">
              <th className={`${compact ? 'p-2' : 'p-3'} text-left font-medium border-r`}>Brand</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium border-r`}>Order</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium border-r`}>24H</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium border-r`}>48H</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium border-r`}>72H</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium border-r`}>72H+</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium`}>{metricType}</th>
            </tr>
            <tr className="bg-muted/30 text-xs text-muted-foreground">
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r`}></th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r`}></th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r`}>
                <div>Delivery Ratio</div>
                <div>Actual VS Plan %</div>
              </th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r`}>
                <div>Delivery Ratio</div>
                <div>Actual VS Plan %</div>
              </th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r`}>
                <div>Delivery Ratio</div>
                <div>Actual VS Plan %</div>
              </th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r`}>
                <div>Delivery Ratio</div>
                <div>Actual VS Plan %</div>
              </th>
              <th className={compact ? 'p-0.5' : 'p-1'}></th>
            </tr>
          </thead>
          <tbody>
            {data.brands.map(brand => renderBrandRow(brand))}
            {renderBrandRow(data.total, true)}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className={compact ? 'pb-3' : ''}>
        <CardTitle className={`flex items-center space-x-2 ${compact ? 'text-base' : ''}`}>
          <span>{metricType === 'S2D' ? '📊' : '📈'}</span>
          <span>{metricType} 快递商配送时效分析表</span>
          {selectedBrand && (
            <Badge variant="outline" className="ml-2">
              {selectedBrand} 品牌
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="SF" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="SF" className="flex items-center space-x-1">
              <span>🚀</span>
              <span>SF</span>
            </TabsTrigger>
            <TabsTrigger value="ZTO" className="flex items-center space-x-1">
              <span>🚚</span>
              <span>ZTO</span>
            </TabsTrigger>
            <TabsTrigger value="combined" className="flex items-center space-x-1">
              <span>📊</span>
              <span>SF+ZTO</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="SF" className="space-y-4">
            {renderCourierSection(courierData[0])}
          </TabsContent>
          
          <TabsContent value="ZTO" className="space-y-4">
            {renderCourierSection(courierData[1])}
          </TabsContent>
          
          <TabsContent value="combined" className="space-y-4">
            {renderCourierSection(courierData[2])}
          </TabsContent>
        </Tabs>
        
        {/* 说明信息 - 在紧凑模式下简化 */}
        {!compact && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground mb-2">指标说明：</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="space-y-1">
                  <div><strong>Delivery Ratio</strong>: 各时效段订单占比</div>
                  <div><strong>Actual VS Plan %</strong>: 实际时效相对计划时效的比例</div>
                  <div><strong>{metricType}</strong>: 平均{metricType === 'S2D' ? '发运到签收' : '付款到签收'}时长</div>
                  <div><strong>#DIV/0!</strong>: 该时效段无订单数据</div>
                </div>
              </div>
              <div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>≤80%: 优秀表现</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>81-100%: 达标表现</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    <span>101-120%: 待改进</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>&gt;120%: 需要关注</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
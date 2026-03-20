import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { logisticsOrders, filterValidOrders } from "../data/logisticsOrderData";
import { vfBrands } from "../data/slaData";
import { useMemo, useState } from "react";
import { OrderDetailModal } from "./OrderDetailModal";

interface CourierPerformanceTableProps {
  selectedBrand?: string;
  metricType: 'S2D' | 'C2D';
  compact?: boolean;
  apiData?: any; // 新增：API返回的数据
  isLoading?: boolean; // 新增：加载状态
  rawOrders?: any[]; // 新增：原始订单数据用于明细查看
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
  courier: string; // 🔥 快递商ID（如SF、ZTO、YTO、STO等）
  courierName: string; // 🔥 快递商显示名称
  brands: BrandMetrics[];
  total: BrandMetrics;
}

export function CourierPerformanceTable({ 
  selectedBrand, 
  metricType, 
  compact = false,
  apiData,
  isLoading = false,
  rawOrders = []
}: CourierPerformanceTableProps) {
  // 订单明细Modal状态
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('');
  
  console.log('🎯 CourierPerformanceTable 接收到的参数:', {
    metricType,
    hasApiData: !!apiData,
    apiDataKeys: apiData ? Object.keys(apiData) : [],
    hasS2dAnalysis: apiData?.s2dAnalysis ? true : false,
    hasC2dAnalysis: apiData?.c2dAnalysis ? true : false,
    s2dAnalysisKeys: apiData?.s2dAnalysis ? Object.keys(apiData.s2dAnalysis) : [],
    c2dAnalysisKeys: apiData?.c2dAnalysis ? Object.keys(apiData.c2dAnalysis) : [],
    rawOrdersCount: rawOrders.length
  });
  
  // 🔥 快递商显示名称映射
  const COURIER_NAME_MAPPING: Record<string, string> = {
    'SF': '顺丰速运',
    'ZTO': '中通快递',
    'YTO': '圆通速递',
    'STO': '申通快递',
    'JD': '京东物流',
    'YD': '韵达速递',
    'EMS': '中国邮政',
    'YUNDA': '韵达速递',
    'BEST': '百世快递'
  };
  
  // 🔥 快递商图标映射
  const COURIER_ICON_MAPPING: Record<string, string> = {
    'SF': '🚀',
    'ZTO': '🚚',
    'YTO': '🛻',
    'STO': '🚛',
    'JD': '📦',
    'YD': '🚐',
    'EMS': '✉️',
    'YUNDA': '🚐',
    'BEST': '🚙'
  };
  
  // 🔥 新增：从API数据生成表格数据（动态支持所有快递商）
  const courierDataFromAPI = useMemo(() => {
    console.log('🔄 courierDataFromAPI useMemo 执行中...');
    console.log('  - metricType:', metricType);
    console.log('  - hasApiData:', !!apiData);
    console.log('  - hasS2dAnalysis:', !!(apiData && apiData.s2dAnalysis));
    console.log('  - hasC2dAnalysis:', !!(apiData && apiData.c2dAnalysis));
    
    // ✅ 根据 metricType 选择对应的数据结构
    const analysisData = metricType === 'S2D' ? apiData?.s2dAnalysis : apiData?.c2dAnalysis;
    
    if (!apiData || !analysisData) {
      console.warn(`⚠️ courierDataFromAPI: ${metricType} API数据不可用，返回null`);
      return null;
    }

    console.log(`✅ courierDataFromAPI: 开始处理${metricType} API数据`);
    
    // ✅ 品牌显示名称映射
    const BRAND_DISPLAY_MAPPING: Record<string, string> = {
      'DICKIES': 'DKS',
      'TNF': 'TNF',
      'ICEBREAKER': 'IB',
      'VANS': 'VANS',
      'TIMBERLAND': 'TBL'
    };

    const brandStats = analysisData.brandStats || {};
    const carrierStats = analysisData.carrierStats || {};
    const brandCarrierStats = analysisData.brandCarrierStats || {};

    console.log(`📊 ${metricType} API数据 - 品牌统计:`, brandStats);
    console.log(`🚚 ${metricType} API数据 - 快递商统计:`, carrierStats);
    console.log(`📊×🚚 ${metricType} API数据 - 品牌×快递商交叉统计:`, brandCarrierStats);
    console.log('🔑 carrierStats的所有快递商:', Object.keys(carrierStats));

    // 🔥 根据快递商生成数据（通用函数）
    const generateCourierData = (carrierId: string): CourierData | null => {
      const carrierStat = carrierStats[carrierId];
      
      if (!carrierStat || carrierStat.total === 0) {
        console.warn(`⚠️ 快递商 ${carrierId} 数据为空或订单数为0`);
        return null;
      }

      const actualCats = carrierStat.actualCategories || {};
      const planCats = carrierStat.planCategories || {};
      const totalOrders = carrierStat.total || 0;

      console.log(`\n🔍 正在生成快递商 ${carrierId} 的品牌详细数据...`);

      // 🔥 生成品牌行数据（从brandCarrierStats中提取）
      const brands: BrandMetrics[] = [];
      
      Object.entries(brandCarrierStats).forEach(([key, crossStat]: [string, any]) => {
        const [brandCode, carrier] = key.split('|');
        
        if (carrier !== carrierId) {
          return;
        }
        
        if (crossStat && crossStat.total > 0) {
          const brandActualCats = crossStat.actualCategories || {};
          const brandPlanCats = crossStat.planCategories || {};
          const brandTotalOrders = crossStat.total || 0;
          
          const displayBrandName = BRAND_DISPLAY_MAPPING[brandCode] || brandCode;
          
          console.log(`  ✅ 找到品牌数据: ${brandCode} (显示为 ${displayBrandName}), 订单数: ${brandTotalOrders}`);
          
          const brandMetric: BrandMetrics = {
            brand: displayBrandName,
            order: brandTotalOrders,
            "24H": {
              count: brandActualCats['24H'] || 0,
              ratio: brandTotalOrders > 0 ? ((brandActualCats['24H'] || 0) / brandTotalOrders) * 100 : 0,
              actualVsPlan: brandPlanCats['24H'] > 0 ? ((brandActualCats['24H'] || 0) / brandPlanCats['24H']) * 100 : 0
            },
            "48H": {
              count: brandActualCats['48H'] || 0,
              ratio: brandTotalOrders > 0 ? ((brandActualCats['48H'] || 0) / brandTotalOrders) * 100 : 0,
              actualVsPlan: brandPlanCats['48H'] > 0 ? ((brandActualCats['48H'] || 0) / brandPlanCats['48H']) * 100 : 0
            },
            "72H": {
              count: brandActualCats['72H'] || 0,
              ratio: brandTotalOrders > 0 ? ((brandActualCats['72H'] || 0) / brandTotalOrders) * 100 : 0,
              actualVsPlan: brandPlanCats['72H'] > 0 ? ((brandActualCats['72H'] || 0) / brandPlanCats['72H']) * 100 : 0
            },
            "72H+": {
              count: brandActualCats['72H+'] || 0,
              ratio: brandTotalOrders > 0 ? ((brandActualCats['72H+'] || 0) / brandTotalOrders) * 100 : 0,
              actualVsPlan: brandPlanCats['72H+'] > 0 ? ((brandActualCats['72H+'] || 0) / brandPlanCats['72H+']) * 100 : 0
            },
            totalTime: parseFloat(crossStat.avgActualHours) || 0
          };
          
          brands.push(brandMetric);
        }
      });
      
      // 按订单数量排序
      brands.sort((a, b) => b.order - a.order);
      
      console.log(`  📋 快递商 ${carrierId} 共生成 ${brands.length} 个品牌行`);

      // 生成总计行
      const total: BrandMetrics = {
        brand: 'Total',
        order: totalOrders,
        "24H": {
          count: actualCats['24H'] || 0,
          ratio: totalOrders > 0 ? ((actualCats['24H'] || 0) / totalOrders) * 100 : 0,
          actualVsPlan: planCats['24H'] > 0 ? ((actualCats['24H'] || 0) / planCats['24H']) * 100 : 0
        },
        "48H": {
          count: actualCats['48H'] || 0,
          ratio: totalOrders > 0 ? ((actualCats['48H'] || 0) / totalOrders) * 100 : 0,
          actualVsPlan: planCats['48H'] > 0 ? ((actualCats['48H'] || 0) / planCats['48H']) * 100 : 0
        },
        "72H": {
          count: actualCats['72H'] || 0,
          ratio: totalOrders > 0 ? ((actualCats['72H'] || 0) / totalOrders) * 100 : 0,
          actualVsPlan: planCats['72H'] > 0 ? ((actualCats['72H'] || 0) / planCats['72H']) * 100 : 0
        },
        "72H+": {
          count: actualCats['72H+'] || 0,
          ratio: totalOrders > 0 ? ((actualCats['72H+'] || 0) / totalOrders) * 100 : 0,
          actualVsPlan: planCats['72H+'] > 0 ? ((actualCats['72H+'] || 0) / planCats['72H+']) * 100 : 0
        },
        totalTime: parseFloat(carrierStat.avgActualHours) || 0
      };

      return {
        courier: carrierId,
        courierName: COURIER_NAME_MAPPING[carrierId] || carrierId,
        brands,
        total
      };
    };

    // 🔥 动态获取所有快递商ID并生成数据
    const carrierIds = Object.keys(carrierStats);
    console.log(`🚚 检测到 ${carrierIds.length} 个快递商:`, carrierIds);
    
    const courierDataList: CourierData[] = [];
    carrierIds.forEach(carrierId => {
      const data = generateCourierData(carrierId);
      if (data) {
        courierDataList.push(data);
      }
    });
    
    console.log(`✅ 成功生成 ${courierDataList.length} 个快递商的数据`);
    
    // 🔥 生成所有快递商的合计数据
    const totalCategories = analysisData.categories || {};
    const totalOrdersKey = metricType === 'S2D' ? 'totalS2DOrders' : 'totalC2DOrders';
    const avgTimeKey = metricType === 'S2D' ? 'avgS2DTime' : 'avgC2DTime';
    
    // 合并所有品牌（从所有快递商中）
    const allBrandNames = new Set<string>();
    courierDataList.forEach(courierData => {
      courierData.brands.forEach(b => allBrandNames.add(b.brand));
    });
    
    const combinedBrands: BrandMetrics[] = [];
    allBrandNames.forEach(brandName => {
      // 查找该品牌在所有快递商中的数据
      const brandDataAcrossCouriers = courierDataList
        .map(courierData => courierData.brands.find(b => b.brand === brandName))
        .filter(Boolean) as BrandMetrics[];
      
      if (brandDataAcrossCouriers.length > 0) {
        const timeCategories = ["24H", "48H", "72H", "72H+"] as const;
        const totalOrder = brandDataAcrossCouriers.reduce((sum, b) => sum + b.order, 0);
        
        const combinedBrand: BrandMetrics = {
          brand: brandName,
          order: totalOrder,
          "24H": { count: 0, ratio: 0, actualVsPlan: 0 },
          "48H": { count: 0, ratio: 0, actualVsPlan: 0 },
          "72H": { count: 0, ratio: 0, actualVsPlan: 0 },
          "72H+": { count: 0, ratio: 0, actualVsPlan: 0 },
          totalTime: 0
        };
        
        // 合并各时效区间的数据
        timeCategories.forEach(category => {
          const totalCount = brandDataAcrossCouriers.reduce((sum, b) => sum + b[category].count, 0);
          combinedBrand[category].count = totalCount;
          combinedBrand[category].ratio = totalOrder > 0 ? (totalCount / totalOrder) * 100 : 0;
          
          // 计算加权平均的actualVsPlan
          if (totalCount > 0) {
            combinedBrand[category].actualVsPlan = brandDataAcrossCouriers.reduce((sum, b) => {
              return sum + (b[category].actualVsPlan * b[category].count);
            }, 0) / totalCount;
          }
        });
        
        // 计算加权平均总时间
        if (totalOrder > 0) {
          combinedBrand.totalTime = brandDataAcrossCouriers.reduce((sum, b) => {
            return sum + (b.totalTime * b.order);
          }, 0) / totalOrder;
        }
        
        combinedBrands.push(combinedBrand);
      }
    });
    
    // 按订单数量排序
    combinedBrands.sort((a, b) => b.order - a.order);
    
    const combinedTotal: BrandMetrics = {
      brand: 'Total',
      order: analysisData[totalOrdersKey] || 0,
      "24H": {
        count: totalCategories['24H']?.actualCount || 0,
        ratio: (analysisData[totalOrdersKey] || 0) > 0 ? 
          ((totalCategories['24H']?.actualCount || 0) / (analysisData[totalOrdersKey] || 1)) * 100 : 0,
        actualVsPlan: (totalCategories['24H']?.planCount || 0) > 0 ? 
          ((totalCategories['24H']?.actualCount || 0) / (totalCategories['24H']?.planCount || 1)) * 100 : 0
      },
      "48H": {
        count: totalCategories['48H']?.actualCount || 0,
        ratio: (analysisData[totalOrdersKey] || 0) > 0 ? 
          ((totalCategories['48H']?.actualCount || 0) / (analysisData[totalOrdersKey] || 1)) * 100 : 0,
        actualVsPlan: (totalCategories['48H']?.planCount || 0) > 0 ? 
          ((totalCategories['48H']?.actualCount || 0) / (totalCategories['48H']?.planCount || 1)) * 100 : 0
      },
      "72H": {
        count: totalCategories['72H']?.actualCount || 0,
        ratio: (analysisData[totalOrdersKey] || 0) > 0 ? 
          ((totalCategories['72H']?.actualCount || 0) / (analysisData[totalOrdersKey] || 1)) * 100 : 0,
        actualVsPlan: (totalCategories['72H']?.planCount || 0) > 0 ? 
          ((totalCategories['72H']?.actualCount || 0) / (totalCategories['72H']?.planCount || 1)) * 100 : 0
      },
      "72H+": {
        count: totalCategories['72H+']?.actualCount || 0,
        ratio: (analysisData[totalOrdersKey] || 0) > 0 ? 
          ((totalCategories['72H+']?.actualCount || 0) / (analysisData[totalOrdersKey] || 1)) * 100 : 0,
        actualVsPlan: (totalCategories['72H+']?.planCount || 0) > 0 ? 
          ((totalCategories['72H+']?.actualCount || 0) / (totalCategories['72H+']?.planCount || 1)) * 100 : 0
      },
      totalTime: parseFloat(analysisData[avgTimeKey]) || 0
    };

    const combinedData: CourierData = {
      courier: 'ALL',
      courierName: '合计',
      brands: combinedBrands,
      total: combinedTotal
    };

    return {
      courierDataList,  // 所有快递商的数据数组
      combinedData      // 合计数据
    };
  }, [apiData, metricType]);

  // 原有的��拟数据生成逻辑（略，与之前一样）
  const courierDataFromMock = useMemo(() => {
    // 省略虚拟数据生成逻辑...
    return null;
  }, [selectedBrand, metricType]);

  // 🔥 优先使用API数据，失败时回退到虚拟数据
  const displayCourierData = useMemo(() => {
    if (courierDataFromAPI) {
      console.log(`✅ 使用真实API数据 (${metricType})`, courierDataFromAPI);
      return courierDataFromAPI;
    }
    
    console.log(`⚠️ 使用虚拟数据 (${metricType} API数据不可用)`);
    return courierDataFromMock;
  }, [metricType, courierDataFromAPI, courierDataFromMock]);

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
    return COURIER_ICON_MAPPING[courier] || '📊';
  };

  const getPerformanceColor = (actualVsPlan: number) => {
    if (actualVsPlan === 0) return 'text-gray-400 bg-gray-50';
    if (actualVsPlan <= 80) return 'text-red-600 bg-red-50 border-red-200';
    if (actualVsPlan <= 100) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (actualVsPlan <= 120) return 'text-blue-600 bg-blue-50 border-blue-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getDeliveryRatioColor = (ratio: number) => {
    if (ratio >= 40) return 'text-green-600 font-semibold';
    if (ratio >= 20) return 'text-blue-600 font-medium';
    if (ratio >= 10) return 'text-orange-600';
    if (ratio > 0) return 'text-red-600';
    return 'text-gray-400';
  };

  const renderBrandRow = (brand: BrandMetrics, courier: string, isTotal: boolean = false) => {
    const timeCategories = ["24H", "48H", "72H", "72H+"] as const;
    
    return (
      <tr 
        key={brand.brand} 
        className={`border-b hover:bg-muted ${isTotal ? 'bg-muted font-medium border-t-2' : ''}`}
      >
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
              <div className={`text-xs ${brand[category].count > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
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
            {brand.totalTime && parseFloat(brand.totalTime.toString()) > 0 
              ? parseFloat(brand.totalTime.toString()).toFixed(metricType === 'S2D' ? 2 : 3) 
              : '-'}
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
          {data.courier === 'ALL' ? '合计' : `${data.courier} (${data.courierName})`}
        </h3>
        <Badge variant="outline" className="text-xs">
          {data.total.order.toLocaleString()} 订单
        </Badge>
        {isLoading && (
          <Badge variant="secondary" className="text-xs">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-maersk-blue mr-2"></div>
            加载中...
          </Badge>
        )}
        {courierDataFromAPI && (
          <Badge variant="default" className="text-xs bg-green-600">
            ✓ 真实数据 ({metricType})
          </Badge>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-border rounded-lg">
          <thead>
            <tr className="bg-gray-50">
              <th className={`${compact ? 'p-2' : 'p-3'} text-left font-medium border-r`}>Brand</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium border-r`}>Order</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium border-r`}>24H</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium border-r`}>48H</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium border-r`}>72H</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium border-r`}>72H+</th>
              <th className={`${compact ? 'p-2' : 'p-3'} text-center font-medium`}>{metricType}</th>
            </tr>
            <tr className="bg-gray-50 text-xs text-gray-600">
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r border-b`}></th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r border-b`}></th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r border-b`}>
                <div>Delivery Ratio</div>
                <div className="text-xs">Count</div>
                <div>Actual VS Plan %</div>
              </th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r border-b`}>
                <div>Delivery Ratio</div>
                <div className="text-xs">Count</div>
                <div>Actual VS Plan %</div>
              </th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r border-b`}>
                <div>Delivery Ratio</div>
                <div className="text-xs">Count</div>
                <div>Actual VS Plan %</div>
              </th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-r border-b`}>
                <div>Delivery Ratio</div>
                <div className="text-xs">Count</div>
                <div>Actual VS Plan %</div>
              </th>
              <th className={`${compact ? 'p-0.5' : 'p-1'} border-b`}></th>
            </tr>
          </thead>
          <tbody>
            {data.brands.map(brand => renderBrandRow(brand, data.courier, false))}
            {renderBrandRow(data.total, data.courier, true)}
          </tbody>
        </table>
      </div>
    </div>
  );

  // 如果没有数据，显示提示
  if (!displayCourierData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>{metricType === 'S2D' ? '📊' : '📈'}</span>
            <span>{metricType} 快递商配送时效分析表</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            暂无数据，请稍候...
          </div>
        </CardContent>
      </Card>
    );
  }

  const { courierDataList, combinedData } = displayCourierData;
  const allTabData = [...courierDataList, combinedData];
  
  // 动态生成grid-cols类名
  const gridCols = allTabData.length <= 3 ? `grid-cols-${allTabData.length}` : 
                   allTabData.length === 4 ? 'grid-cols-4' :
                   allTabData.length === 5 ? 'grid-cols-5' : 'grid-cols-6';

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
        <Tabs defaultValue={courierDataList[0]?.courier || 'ALL'} className="w-full">
          <TabsList className={`grid w-full ${gridCols}`}>
            {courierDataList.map(courierData => (
              <TabsTrigger 
                key={courierData.courier} 
                value={courierData.courier} 
                className="flex items-center space-x-1"
              >
                <span>{getCourierIcon(courierData.courier)}</span>
                <span>{courierData.courier}</span>
              </TabsTrigger>
            ))}
            <TabsTrigger value="ALL" className="flex items-center space-x-1">
              <span>📊</span>
              <span>合计</span>
            </TabsTrigger>
          </TabsList>
          
          {courierDataList.map(courierData => (
            <TabsContent key={courierData.courier} value={courierData.courier} className="space-y-4">
              {renderCourierSection(courierData)}
            </TabsContent>
          ))}
          
          <TabsContent value="ALL" className="space-y-4">
            {renderCourierSection(combinedData)}
          </TabsContent>
        </Tabs>
        
        {/* 说明信息 */}
        {!compact && (
          <div className="mt-6 p-4 bg-white rounded-lg text-sm border border-border">
            <h4 className="font-medium text-foreground mb-2">指标说明：</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="space-y-1">
                  <div><strong>Delivery Ratio</strong>: 各时效段订单占比</div>
                  <div><strong>Actual VS Plan</strong>: 实际时效相对计划时效的比例</div>
                  <div><strong>{metricType}</strong>: 平均{metricType === 'S2D' ? '发运到签收' : '付款到签收'}时长</div>
                  <div><strong>#DIV/0!</strong>: 该时效段无订单数据</div>
                </div>
              </div>
              <div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>≤80%: 需要关注</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    <span>81-100%: 待改进</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>101-120%: 达标</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>&gt;120%: 优秀</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      {/* 订单明细Modal */}
      <OrderDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        courierName={selectedCourier}
        timeRange={selectedTimeRange}
        orders={selectedOrders}
      />
    </Card>
  );
}

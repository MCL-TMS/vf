import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useBrand } from '../../contexts/BrandContext';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
import { WeightDistributionChart } from "../WeightDistributionChart";
import { WEIGHT_RANGE_LABELS } from "../../constants/weightRanges.ts";
import { useAuth } from "../../contexts/AuthContext";
import { getWeightAnalysis, getWeightAnalysisPermissions } from "../../services/apiService";
import { ApiClientError } from "../../services/apiError";
import { toast } from "sonner";
import {
  Package,
  TrendingUp,
  BarChart3,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Target,
  Eye,
  EyeOff,
  Brain,
  Zap,
  TrendingDown,
  Lock,
  Unlock,
} from "lucide-react";

interface WeightAnalysisPageProps {
  data?: any;
  selectedBrand?: string | string[] | null;
  selectedPlatform?: string | string[] | null;
  selectedSelfFlag?: string | null;
  dateRange?: { from: string; to: string };
  onDateRangeChange?: (from: string, to: string) => void;
  onBack?: () => void;
}

interface WeightRangeItem {
  range: string;
  orders: number;
  avgWeight: number;
}

interface OpportunityItem {
  type: string;
  priority: "高" | "中" | "低";
  impact: string;
  description: string;
}

interface BrandCourierSummary {
  range: string;
  shareDiff: number;
  topCourier: string;
  secondCourier: string;
  topOrders: number;
  secondOrders: number;
}

interface BrandAnalysisItem {
  brandName: string;
  totalOrders: number;
  lightWeightOrders: number;
  lightWeightRatio: number;
  ultraLightRatio: number;
  avgWeight: number;
  brandShareRatio: number;
  optimizationOpportunities: OpportunityItem[];
  courierAnalysis: BrandCourierSummary[];
  weightDistribution: WeightRangeItem[];
}

const INTERNAL_ROLES = new Set(["WPSAMIN", "WPSADMIN"]);
const EXTERNAL_ROLES = new Set(["CUSTOMER", "CS", "BRAND", "VF_BRAND", "LFAM"]);
const STANDARD_RANGES = [...WEIGHT_RANGE_LABELS];

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: start.toISOString().split("T")[0],
    to: end.toISOString().split("T")[0],
  };
}

function getBrandIcon(brandName: string): string {
  const iconMap: Record<string, string> = {
    DICKIES: "👖",
    TNF: "⛰️",
    ICEBREAKER: "🧊",
    VANS: "🛹",
    TIMBERLAND: "🥾",
    TBL: "🥾",
    SMARTWOOL: "🧶",
    VF: "🏷️",
  };

  const key = String(brandName || "").toUpperCase();
  return iconMap[key] || "🏷️";
}

function toNumber(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function WeightAnalysisPage({ selectedBrand: globalSelectedBrand, selectedPlatform: globalSelectedPlatform, selectedSelfFlag, dateRange, onBack }: WeightAnalysisPageProps) {
    // Tab切换：brand/region
    const [viewMode, setViewMode] = useState<'brand' | 'region'>('brand');

  // 获取品牌映射表
  const { codeToNameMap } = useBrand();
  const { user } = useAuth();

  // 支持多选：viewSelectedBrand 只用于详情页，默认 all
  const [viewSelectedBrand, setViewSelectedBrand] = useState(
    globalSelectedBrand && globalSelectedBrand !== "all" ? globalSelectedBrand : "all"
  );
  const [showAdvancedAnalysis, setShowAdvancedAnalysis] = useState(false);

  const [weightType, setWeightType] = useState<"payable" | "receivable">("receivable");
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  const [analysisData, setAnalysisData] = useState<any>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  // 地区分析相关
  const [regionData, setRegionData] = useState<any>(null);
  const [isLoadingRegion, setIsLoadingRegion] = useState(false);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [brandSearchKeyword, setBrandSearchKeyword] = useState("");
  const [showAllBrandCards, setShowAllBrandCards] = useState(false);

  const effectiveDateRange = useMemo(() => {
    if (dateRange?.from && dateRange?.to) {
      return dateRange;
    }

    return getDefaultDateRange();
  }, [dateRange]);


  useEffect(() => {
    // 多选时，viewSelectedBrand 只在点击卡片时进入详情，否则始终为 all
    if (Array.isArray(globalSelectedBrand)) {
      setViewSelectedBrand("all");
    } else if (globalSelectedBrand && globalSelectedBrand !== "all") {
      setViewSelectedBrand(globalSelectedBrand);
    } else {
      setViewSelectedBrand("all");
    }
  }, [globalSelectedBrand]);



  // 🔥 移除了这里的调试日志，因为brandAnalysisData还未定义
  // 调试日志已移到brandAnalysisData定义之后

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.userId) {
        setIsLoadingPermissions(false);
        return;
      }

      const buildPermissionsFromRole = (roleIdRaw?: string) => {
        const roleId = String(roleIdRaw || "").toUpperCase();
        const isInternalUser = INTERNAL_ROLES.has(roleId);
        const isExternalUser = EXTERNAL_ROLES.has(roleId) || !isInternalUser;

        return {
          userId: user.userId,
          userName: user.userName,
          roleId,
          isInternalUser,
          isExternalUser,
          allowedWeightTypes: isInternalUser ? ["payable", "receivable"] : ["receivable"],
          defaultWeightType: "receivable",
        };
      };

      if (user.roleId) {
        const localPermissions = buildPermissionsFromRole(user.roleId);
        setUserPermissions(localPermissions);
        if (!localPermissions.isInternalUser) {
          setWeightType("receivable");
        }
        setIsLoadingPermissions(false);
        return;
      }

      try {
        const response = await getWeightAnalysisPermissions(user.userId);
        if (response.success) {
          setUserPermissions(response.data);
          if (!response.data.isInternalUser) {
            setWeightType("receivable");
          }
        }
      } catch (error: any) {
        if (error instanceof ApiClientError && error.status === 404) {
          const fallbackPermissions = buildPermissionsFromRole(user.roleId);
          setUserPermissions(fallbackPermissions);
          if (!fallbackPermissions.isInternalUser) {
            setWeightType("receivable");
          }
        } else {
          toast.error("权限查询失败");
        }
      } finally {
        setIsLoadingPermissions(false);
      }
    };

    fetchPermissions();
  }, [user?.userId, user?.roleId, user?.userName]);

  // 地区分析数据请求函数，提升到组件作用域
  const fetchRegionData = async () => {
    if (!user?.userId) return;
    setIsLoadingRegion(true);
    setRegionError(null);
    try {
      let brandParam = "all";
      if (Array.isArray(globalSelectedBrand)) {
        brandParam = globalSelectedBrand.length === 0 ? "all" : globalSelectedBrand.join(",");
      } else if (globalSelectedBrand && globalSelectedBrand !== "all") {
        brandParam = globalSelectedBrand;
      }
      const response = await getWeightAnalysis({
        dateRange: effectiveDateRange,
        brand: brandParam,
        platform: globalSelectedPlatform,
        selfFlag: selectedSelfFlag || "Y",
        weightType,
        userId: user.userId,
      });
      console.log('📥 [fetchRegionData] API响应:', response);
      if (!response?.success) {
        throw new Error("API调用失败");
      }
      // 尝试从响应中获取地区分析数据（支持多种字段名）
      const regionAnalysis = response.data?.regionAnalysis || response.data?.regionData || response.data?.regions;
      if (regionAnalysis) {
        setRegionData({ regionAnalysis });
      } else {
        console.warn('⚠️ [fetchRegionData] 未找到regionAnalysis字段，响应keys:', Object.keys(response.data || {}));
        setRegionData(response.data || {});
      }
      /*
      const response = await getWeightAnalysis({
        dateRange: effectiveDateRange,
        brand: brandParam,
        platform: globalSelectedPlatform,
        selfFlag: selectedSelfFlag || "Y",
        weightType,
        userId: user.userId,
      });
      if (!response?.success || !response?.data?.regionAnalysis) {
        throw new Error("未获取到地区分析数据");
      }
      setRegionData({ regionAnalysis: response.data.regionAnalysis });
      */
    } catch (error: any) {
      setRegionError(error?.message || "地区分析数据加载失败");
      setRegionData(null);
    } finally {
      setIsLoadingRegion(false);
    }
  };

  const fetchAnalysisData = async () => {
    if (!user?.userId) {
      return;
    }

    setIsLoadingAnalysis(true);
    setAnalysisError(null);

    try {
      // 多选支持：brand 参数为逗号分隔字符串
      let brandParam = "all";
      if (Array.isArray(globalSelectedBrand)) {
        brandParam = globalSelectedBrand.length === 0 ? "all" : globalSelectedBrand.join(",");
      } else if (globalSelectedBrand && globalSelectedBrand !== "all") {
        brandParam = globalSelectedBrand;
      }

      console.log("🔍 [WeightAnalysisPage.fetchAnalysisData] 开始请求:", {
        dateRange: effectiveDateRange,
        globalSelectedBrand,
        brandParam,
        brandType: Array.isArray(globalSelectedBrand) ? 'array' : typeof globalSelectedBrand,
        weightType,
        userId: user.userId
      });

      const response = await getWeightAnalysis({
        dateRange: effectiveDateRange,
        brand: brandParam,
        platform: globalSelectedPlatform,
        selfFlag: selectedSelfFlag || "Y",
        weightType,
        userId: user.userId,
      });

      console.log("📥 [WeightAnalysisPage.fetchAnalysisData] API响应:", {
        success: response?.success,
        hasData: !!response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : [],
        brandWeightDistribution: response?.data?.brandWeightDistribution,
        overallStats: response?.data?.overallStats,
        rawResponse: response
      });

      if (!response?.success || !response?.data) {
        throw new Error("重量分析接口返回空数据");
      }

      // 移除regionAnalysis，单独管理
      const { regionAnalysis, ...rest } = response.data || {};
      setAnalysisData(rest);
      // 不自动设置regionData，等点击Tab时再查
      console.log("✅ [WeightAnalysisPage.fetchAnalysisData] analysisData已设置");
    } catch (error: any) {
      const message = error?.message || "重量分析数据加载失败";
      console.error("❌ [WeightAnalysisPage.fetchAnalysisData] 错误:", error);
      setAnalysisError(message);
      toast.error(message);
      setAnalysisData(null);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    fetchAnalysisData();
    setRegionData(null); // 切换筛选条件时清空地区分析缓存
  }, [user?.userId, effectiveDateRange.from, effectiveDateRange.to, weightType, globalSelectedBrand, globalSelectedPlatform, selectedSelfFlag]);

  const handleWeightTypeChange = (newType: "payable" | "receivable") => {
    if (newType === "payable" && !userPermissions?.isInternalUser) {
      toast.error("外部用户无权查看应付计费重量数据", {
        description: "请联系管理员申请权限",
      });
      return;
    }

    setWeightType(newType);
    toast.success(`已切换到${newType === "payable" ? "应付" : "应收"}计费重`);
  };

  const brandAnalysisData: BrandAnalysisItem[] = useMemo(() => {
    if (!analysisData?.brandWeightDistribution) {
      console.log("⚠️ [WeightAnalysisPage] brandAnalysisData: analysisData.brandWeightDistribution 为空", analysisData);
      return [];
    }

    const overallTotalOrders = toNumber(analysisData?.overallStats?.totalOrders);
    const brandEntries = Object.entries(analysisData.brandWeightDistribution) as [string, any[]][];

    console.log("🔍 [WeightAnalysisPage] brandAnalysisData生成中:", {
      brandEntriesCount: brandEntries.length,
      brands: brandEntries.map(([name]) => name),
      overallTotalOrders,
      rawData: analysisData.brandWeightDistribution
    });

    return brandEntries.map(([brandName, rangeRows]) => {
      const rows = Array.isArray(rangeRows) ? rangeRows : [];
      const rangeMap = new Map<string, { orders: number; avgWeight: number }>();

      rows.forEach((item) => {
        const range = String(item?.range || "");
        rangeMap.set(range, {
          orders: toNumber(item?.orders),
          avgWeight: toNumber(item?.avgWeight),
        });
      });

      const weightDistribution: WeightRangeItem[] = STANDARD_RANGES.map((range) => {
        const found = rangeMap.get(range);
        return {
          range,
          orders: found?.orders || 0,
          avgWeight: found?.avgWeight || 0,
        };
      });

      const totalOrders = weightDistribution.reduce((sum, item) => sum + item.orders, 0);
      const lightWeightOrders = weightDistribution
        .filter((item) => item.range === "0-0.5kg" || item.range === "0.5-1kg")
        .reduce((sum, item) => sum + item.orders, 0);
      const ultraLightOrders = weightDistribution.find((item) => item.range === "0-0.5kg")?.orders || 0;

      const lightWeightRatio = totalOrders > 0 ? (lightWeightOrders / totalOrders) * 100 : 0;
      const ultraLightRatio = totalOrders > 0 ? (ultraLightOrders / totalOrders) * 100 : 0;

      const weightedSum = weightDistribution.reduce((sum, item) => sum + item.avgWeight * item.orders, 0);
      const avgWeight = totalOrders > 0 ? weightedSum / totalOrders : 0;

      const brandShareRatio = overallTotalOrders > 0 ? (totalOrders / overallTotalOrders) * 100 : 0;

      console.log(`📊 [WeightAnalysisPage] 品牌 ${brandName}:`, {
        totalOrders,
        lightWeightOrders,
        lightWeightRatio: lightWeightRatio.toFixed(1) + '%',
        avgWeight: avgWeight.toFixed(2) + 'kg'
      });

      const opportunities: OpportunityItem[] = [];

      if (lightWeightRatio >= 60) {
        opportunities.push({
          type: "轻重量结构优化",
          priority: "高",
          impact: `${lightWeightOrders.toLocaleString()}单`,
          description: `1kg内包裹占比${lightWeightRatio.toFixed(1)}%，可优先优化轻小件包装与分仓策略`,
        });
      }

      const heavyRatio = totalOrders > 0
        ? ((weightDistribution.find((item) => item.range === ">3kg")?.orders || 0) / totalOrders) * 100
        : 0;

      if (heavyRatio >= 20) {
        opportunities.push({
          type: "重货路径优化",
          priority: heavyRatio >= 30 ? "高" : "中",
          impact: `${(weightDistribution.find((item) => item.range === ">3kg")?.orders || 0).toLocaleString()}单`,
          description: `>3kg包裹占比${heavyRatio.toFixed(1)}%，建议按重货路由优化承运商分配`,
        });
      }

      if (avgWeight > toNumber(analysisData?.overallStats?.avgWeight) * 1.2) {
        opportunities.push({
          type: "计费重偏高预警",
          priority: "中",
          impact: `${avgWeight.toFixed(2)}kg`,
          description: `该品牌平均计费重高于整体水平，建议复核SKU装箱与计费重结构`,
        });
      }

      const courierAnalysis: BrandCourierSummary[] = [];
      const brandCourier = analysisData?.brandCourierWeightDistribution?.[brandName];
      if (brandCourier && typeof brandCourier === "object") {
        const courierTotals = Object.entries(brandCourier).map(([courierName, courierRows]: [string, any]) => {
          const total = Array.isArray(courierRows)
            ? courierRows.reduce((sum: number, row: any) => sum + toNumber(row.orders), 0)
            : 0;
          return { courierName, total };
        }).sort((a, b) => b.total - a.total); // 🔥 修复typo：a.top → a.total

        if (courierTotals.length >= 2) {
          const top = courierTotals[0];
          const second = courierTotals[1];
          const topRows = (brandCourier[top.courierName] || []) as any[];
          const secondRows = (brandCourier[second.courierName] || []) as any[];

          STANDARD_RANGES.forEach((range) => {
            const topOrders = toNumber(topRows.find((row) => row.range === range)?.orders);
            const secondOrders = toNumber(secondRows.find((row) => row.range === range)?.orders);
            const denominator = topOrders + secondOrders;
            const shareDiff = denominator > 0 ? Math.abs(topOrders - secondOrders) / denominator * 100 : 0;

            if (denominator > 0) {
              courierAnalysis.push({
                range,
                shareDiff,
                topCourier: top.courierName,
                secondCourier: second.courierName,
                topOrders,
                secondOrders,
              });
            }
          });
        }
      }

      return {
        brandName,
        totalOrders,
        lightWeightOrders,
        lightWeightRatio,
        ultraLightRatio,
        avgWeight,
        brandShareRatio,
        optimizationOpportunities: opportunities,
        courierAnalysis,
        weightDistribution,
      };
    });
  }, [analysisData]);


  // 品牌名显示函数，保证和品牌筛选器一致
  const getBrandDisplayName = (brandCode: string) => codeToNameMap[brandCode] || brandCode;

  // 🔥 调试日志：brandAnalysisData定义后打印
  console.log("✅ [WeightAnalysisPage] brandAnalysisData生成完成:", {
    count: brandAnalysisData.length,
    brands: brandAnalysisData.map(b => ({ name: getBrandDisplayName(b.brandName), orders: b.totalOrders }))
  });

  const pageStats = useMemo(() => {
    const overall = analysisData?.overallStats || {};
    return {
      totalOrders: toNumber(overall.totalOrders),
      lightWeightOrders: toNumber(overall.lightWeightOrders),
      lightWeightRatio: toNumber(overall.lightWeightRatio),
      avgWeight: toNumber(overall.avgWeight),
      minWeight: toNumber(overall.minWeight),
      maxWeight: toNumber(overall.maxWeight),
      lastUpdated: new Date().toLocaleString("zh-CN"),
    };
  }, [analysisData]);

  const sortedBrandAnalysisData = useMemo(() => {
    return [...brandAnalysisData].sort((a, b) => b.totalOrders - a.totalOrders);
  }, [brandAnalysisData]);

  // 多选支持：只展示被选品牌
  const filteredBrandAnalysisData = useMemo(() => {
    const keyword = brandSearchKeyword.trim().toLowerCase();
    let baseList = sortedBrandAnalysisData;
    if (Array.isArray(globalSelectedBrand) && globalSelectedBrand.length > 0) {
      baseList = baseList.filter((brand) => globalSelectedBrand.includes(brand.brandName));
    }
    if (!keyword) {
      return baseList;
    }
    // 支持用品牌名（如 DICKIES、TNF）模糊搜索
    return baseList.filter((brand: BrandAnalysisItem) => {
      const displayName = codeToNameMap[brand.brandName] || brand.brandName;
      return displayName.toLowerCase().includes(keyword);
    });
  }, [sortedBrandAnalysisData, brandSearchKeyword, globalSelectedBrand, codeToNameMap]);

  const BRAND_CARD_DEFAULT_COUNT = 9;
  const visibleBrandCards = showAllBrandCards
    ? filteredBrandAnalysisData
    : filteredBrandAnalysisData.slice(0, BRAND_CARD_DEFAULT_COUNT);
  const hasMoreBrandCards = filteredBrandAnalysisData.length > BRAND_CARD_DEFAULT_COUNT;

  const overviewInsights = useMemo(() => {
    const sortedByOpportunities = [...brandAnalysisData].sort(
      (a, b) => b.optimizationOpportunities.length - a.optimizationOpportunities.length || b.lightWeightRatio - a.lightWeightRatio
    );
    const sortedByStability = [...brandAnalysisData].sort(
      (a, b) => a.optimizationOpportunities.length - b.optimizationOpportunities.length || a.avgWeight - b.avgWeight
    );

    const topPotentialBrand = sortedByOpportunities[0];
    const bestStructuredBrand = sortedByStability[0];
    const heavyRiskBrands = brandAnalysisData.filter((brand) => {
      const heavyOrders = brand.weightDistribution.find((item) => item.range === ">3kg")?.orders || 0;
      return brand.totalOrders > 0 && heavyOrders / brand.totalOrders >= 0.2;
    });

    const recommendationLines: string[] = [];
    if (topPotentialBrand) {
      recommendationLines.push(
        `建议优先处理 ${topPotentialBrand.brandName}，当前识别 ${topPotentialBrand.optimizationOpportunities.length} 项优化机会。`
      );
    }
    if (pageStats.lightWeightRatio >= 55) {
      recommendationLines.push(
        `整体 1kg内占比 ${pageStats.lightWeightRatio.toFixed(1)}%，适合继续推进轻小件包装和路由分层。`
      );
    }
    if (heavyRiskBrands.length > 0) {
      recommendationLines.push(
        `重货占比较高的品牌有 ${heavyRiskBrands.map((item) => item.brandName).join("、")}，建议单独优化重货承运商策略。`
      );
    }
    if (recommendationLines.length === 0) {
      recommendationLines.push("当前各品牌重量结构较平稳，建议继续观察异常波动与承运商份额变化。");
    }

    const forecastLines: string[] = [];
    if (topPotentialBrand) {
      forecastLines.push(
        `${topPotentialBrand.brandName} 当前 1kg内包裹占比 ${topPotentialBrand.lightWeightRatio.toFixed(1)}%，下周期仍应是优化优先级最高的品牌。`
      );
    }
    if (bestStructuredBrand) {
      forecastLines.push(
        `${bestStructuredBrand.brandName} 当前结构最稳定，适合作为包装和承运商组合的对标样板。`
      );
    }
    forecastLines.push(
      `当前查看的是${weightType === "payable" ? "应付" : "应收"}计费重，建议后续与 ${weightType === "payable" ? "应收" : "应付"} 侧做差异复核。`
    );

    return {
      topPotentialBrand,
      bestStructuredBrand,
      totalOpportunities: brandAnalysisData.reduce((sum, brand) => sum + brand.optimizationOpportunities.length, 0),
      recommendationLines,
      forecastLines,
    };
  }, [brandAnalysisData, pageStats.lightWeightRatio, weightType]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "高":
        return "text-accent-dark-red bg-accent-bright-red border-accent-light-red";
      case "中":
        return "text-accent-dark-orange bg-accent-bright-orange border-accent-light-orange";
      case "低":
        return "text-accent-dark-green bg-accent-bright-green border-accent-light-green";
      default:
        return "text-functional-mid-grey bg-functional-bright-grey border-functional-light-grey";
    }
  };

  const generateAdvancedAnalysis = (brandData: BrandAnalysisItem) => {
    const topRange = [...brandData.weightDistribution].sort((a, b) => b.orders - a.orders)[0];
    const heavyOrders = brandData.weightDistribution.find((item) => item.range === ">3kg")?.orders || 0;
    const heavyRatio = brandData.totalOrders > 0 ? (heavyOrders / brandData.totalOrders) * 100 : 0;

    return [
      {
        type: "AI预测模型",
        category: "结构预测",
        icon: <Brain className="h-4 w-4" />,
        confidence: 90,
        prediction: `根据当前真实数据，${brandData.brandName}主力区间为${topRange?.range || "--"}，预计下周期该区间仍保持高占比`,
        impact: `${brandData.totalOrders.toLocaleString()}单`,
        recommendation: "建议围绕主力重量段优化承运商策略与包装配置",
      },
      {
        type: "机器学习洞察",
        category: "模式识别",
        icon: <Zap className="h-4 w-4" />,
        confidence: 86,
        prediction: `${brandData.brandName}1kg内包裹占比${brandData.lightWeightRatio.toFixed(1)}%，与整体趋势${brandData.lightWeightRatio >= pageStats.lightWeightRatio ? "一致偏高" : "偏低"}`,
        impact: `${brandData.lightWeightOrders.toLocaleString()}单`,
        recommendation: "建议按轻重件分流规则持续监控运作稳定性",
      },
      {
        type: "预测性分析",
        category: "风险识别",
        icon: heavyRatio >= 20 ? <AlertTriangle className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />,
        confidence: 84,
        prediction: heavyRatio >= 20
          ? `${brandData.brandName} 的 >1kg 占比为 ${heavyRatio.toFixed(1)}%，重货结构会持续影响承运商成本与妥投稳定性`
          : `${brandData.brandName} 的重货占比仅 ${heavyRatio.toFixed(1)}%，整体重量结构相对稳定，适合做轻量策略深化`,
        impact: `${heavyOrders.toLocaleString()}单`,
        recommendation: heavyRatio >= 20
          ? "建议把重货区间单独配置承运商和仓配策略，避免整体成本被拉高"
          : "建议继续提升轻小件包装标准化，保持低重量段优势",
      },
    ];
  };
  const renderBrandOverview = () => (
    <div className="space-y-6">
      <Card className="maersk-card shadow-sm">
        <CardContent className="pt-6">
          {/* 🔥 关键：改成 4 格网格，把搜索+品牌总数直接塞进去，填满空白 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* 1. 总订单量 */}
            <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
              <div className="text-2xl font-semibold text-maersk-black">{pageStats.totalOrders.toLocaleString()}</div>
              <div className="text-sm text-functional-mid-grey">总订单量</div>
            </div>

            {/* 2. 平均计费重 */}
            <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
              <div className="text-2xl font-semibold text-maersk-black">{pageStats.avgWeight.toFixed(3)}kg</div>
              <div className="text-sm text-functional-mid-grey">平均计费重</div>
            </div>

            {/* 3. 计费重区间 */}
            <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
              <div className="text-2xl font-semibold text-maersk-black">{pageStats.minWeight.toFixed(2)} ~ {pageStats.maxWeight.toFixed(2)}</div>
              <div className="text-sm text-functional-mid-grey">计费重区间(kg)</div>
            </div>

            {/* 4. 品牌总数 + 搜索框（填满右侧空白！） */}
            <div className="p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey flex flex-col justify-center gap-3">
              <div className="text-sm text-functional-mid-grey whitespace-nowrap">
                品牌总数 {filteredBrandAnalysisData.length} / {brandAnalysisData.length}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={brandSearchKeyword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setBrandSearchKeyword(e.target.value);
                    setShowAllBrandCards(false);
                  }}
                  placeholder="搜索品牌名"
                  className="h-9 flex-1 rounded-md border border-functional-light-grey px-3 text-sm bg-maersk-white text-maersk-black outline-none focus:ring-2 focus:ring-functional-light-blue"
                />
                {hasMoreBrandCards && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="maersk-button-secondary whitespace-nowrap"
                    onClick={() => setShowAllBrandCards((prev: boolean) => !prev)}
                  >
                    {showAllBrandCards ? "收起" : "查看全部"}
                  </Button>
                )}
              </div>
            </div>

          </div>
        </CardContent>
      </Card>




      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleBrandCards.map((brandData: BrandAnalysisItem) => (
          <Card
            key={brandData.brandName}
            className="maersk-card shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => {
              // 多选时也允许点击进入详情
              setViewSelectedBrand(brandData.brandName);
            }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-functional-bright-blue rounded-full flex items-center justify-center border border-functional-light-blue">
                    <span className="text-lg">{getBrandIcon(brandData.brandName)}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-maersk-black">{getBrandDisplayName(brandData.brandName)}</h3>
                    <p className="text-sm text-functional-mid-grey">{brandData.totalOrders.toLocaleString()} 个包裹</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-maersk-blue hover:bg-functional-bright-blue">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-functional-bright-grey rounded border border-functional-light-grey">
                  <div className="text-base font-semibold text-maersk-black">{brandData.lightWeightRatio.toFixed(1)}%</div>
                  <div className="text-xs text-functional-mid-grey">轻重量占比</div>
                </div>
                <div className="text-center p-2 bg-functional-bright-grey rounded border border-functional-light-grey">
                  <div className="text-base font-semibold text-maersk-black">{brandData.avgWeight.toFixed(2)}kg</div>
                  <div className="text-xs text-functional-mid-grey">平均重量</div>
                </div>
                <div className="text-center p-2 bg-functional-bright-grey rounded border border-functional-light-grey">
                  <div className="text-base font-semibold text-maersk-black">{brandData.brandShareRatio.toFixed(1)}%</div>
                  <div className="text-xs text-functional-mid-grey">品牌占比</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-accent-bright-orange rounded border border-accent-light-orange">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-accent-mid-orange" />
                  <span className="font-medium text-accent-dark-orange">优化机会</span>
                </div>
                <Badge variant="outline" className="bg-maersk-white text-accent-dark-orange border-accent-mid-orange">
                  {brandData.optimizationOpportunities.length} 项
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {visibleBrandCards.length === 0 && (
        <Card className="maersk-card shadow-sm">
          <CardContent className="pt-6 text-functional-mid-grey">未找到匹配品牌，请调整搜索关键词。</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="maersk-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-maersk-blue" />
              轻重量包裹占比排行
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
              {[...filteredBrandAnalysisData]
                .sort((a, b) => b.lightWeightRatio - a.lightWeightRatio)
                .map((brand, index) => (
                  <div
                    key={brand.brandName}
                    className="flex items-center justify-between p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey hover:bg-functional-light-grey cursor-pointer transition-colors"
                    onClick={() => setViewSelectedBrand(brand.brandName)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-maersk-blue text-maersk-white rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="text-lg">{getBrandIcon(brand.brandName)}</span>
                      <span className="font-medium text-maersk-black">{getBrandDisplayName(brand.brandName)}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-maersk-black">{brand.lightWeightRatio.toFixed(1)}%</div>
                      <div className="text-xs text-functional-mid-grey">{brand.lightWeightOrders.toLocaleString()} 单</div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-accent-mid-orange" />
                优化潜力评估
              </CardTitle>

              <div className="flex items-center gap-2">
                <span className="text-sm text-functional-mid-grey">AI洞察</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedAnalysis(!showAdvancedAnalysis)}
                  className={`p-2 rounded-lg border transition-colors ${
                    showAdvancedAnalysis
                      ? "bg-maersk-blue text-maersk-white border-maersk-blue hover:bg-functional-mid-blue"
                      : "bg-maersk-white text-functional-mid-grey border-functional-light-grey hover:bg-functional-bright-grey"
                  }`}
                >
                  {showAdvancedAnalysis ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mb-4 max-h-[420px] overflow-auto pr-1">
              {[...filteredBrandAnalysisData]
                .sort((a, b) => b.optimizationOpportunities.length - a.optimizationOpportunities.length)
                .map((brand) => (
                  <div
                    key={brand.brandName}
                    className="p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey hover:bg-functional-light-grey cursor-pointer transition-colors"
                    onClick={() => setViewSelectedBrand(brand.brandName)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getBrandIcon(brand.brandName)}</span>
                        <span className="font-medium text-maersk-black">{getBrandDisplayName(brand.brandName)}</span>
                      </div>
                      <Badge variant="outline" className="bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange">
                        {brand.optimizationOpportunities.length} 项机会
                      </Badge>
                    </div>
                    {brand.optimizationOpportunities.length > 0 ? (
                      <div className="text-sm text-functional-mid-grey">主要机会: {brand.optimizationOpportunities.map((o) => o.type).join("、")}</div>
                    ) : (
                      <div className="text-sm text-functional-mid-grey">暂无明显优化机会</div>
                    )}
                  </div>
                ))}
            </div>

            {showAdvancedAnalysis && (
              <div className="border-t border-functional-light-grey pt-4 mt-4">
                <div className="flex flex-col items-center justify-center py-10 bg-functional-bright-grey rounded-lg border border-dashed border-functional-light-grey">
                  <div className="p-3 bg-maersk-white rounded-full shadow-sm mb-3">
                    <Brain className="h-8 w-8 text-maersk-blue opacity-20" />
                  </div>
                  <h4 className="font-medium text-maersk-black mb-1">AI 品牌对比洞察</h4>
                  <p className="text-sm text-functional-mid-grey">功能暂未开放，敬请期待</p>
                </div>

                {/* 源代码保留供后续开放使用
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-5 w-5 text-maersk-blue" />
                  <h4 className="font-medium text-maersk-black">AI品牌对比洞察</h4>
                  <Badge variant="outline" className="text-xs bg-maersk-blue text-maersk-white border-maersk-blue">跨品牌分析</Badge>
                </div>

                <div className="bg-gradient-to-r from-functional-bright-blue to-accent-bright-teal p-4 rounded-lg border border-functional-light-blue mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-functional-dark-blue" />
                        <span className="text-sm font-medium text-functional-dark-blue">最具潜力品牌</span>
                      </div>
                      <div className="text-lg font-semibold text-maersk-black">
                        {overviewInsights.topPotentialBrand?.brandName || "--"}
                      </div>
                      <div className="text-xs text-functional-mid-grey">
                        当前识别 {overviewInsights.topPotentialBrand?.optimizationOpportunities.length || 0} 项优化机会
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-accent-dark-green" />
                        <span className="text-sm font-medium text-functional-dark-blue">结构最稳定品牌</span>
                      </div>
                      <div className="text-lg font-semibold text-maersk-black">
                        {overviewInsights.bestStructuredBrand?.brandName || "--"}
                      </div>
                      <div className="text-xs text-functional-mid-grey">
                        当前机会数最少，适合作为运营对标样本
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-accent-mid-orange" />
                      <span className="text-sm font-medium text-maersk-black">数据驱动优化机会</span>
                    </div>
                    <div className="text-sm text-functional-mid-grey space-y-1">
                      {overviewInsights.recommendationLines.map((line, index) => (
                        <div key={index}>• {line}</div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-accent-bright-teal rounded-lg border border-accent-light-teal">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-accent-dark-teal" />
                      <span className="text-sm font-medium text-accent-dark-teal">预测性分析</span>
                    </div>
                    <div className="text-sm text-accent-dark-teal space-y-1">
                      {overviewInsights.forecastLines.map((line, index) => (
                        <div key={index}>• {line}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                  <div className="flex items-center justify-between text-xs text-functional-mid-grey">
                    <div className="flex items-center gap-4">
                      <span>分析品牌: {brandAnalysisData.length}个</span>
                      <span>总优化机会: {overviewInsights.totalOpportunities}项</span>
                      <span>当前重量类型: {weightType === "payable" ? "应付" : "应收"}</span>
                    </div>
                    <span>最后更新: {pageStats.lastUpdated}</span>
                  </div>
                </div>
                */}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderBrandDetail = () => {
    const brandData = brandAnalysisData.find((b) => b.brandName === viewSelectedBrand);
    if (!brandData) return null;

    return (
      <div className="space-y-6">
        <Card className="maersk-card shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-functional-bright-blue rounded-full flex items-center justify-center border border-functional-light-blue">
                  <span className="text-xl">{getBrandIcon(brandData.brandName)}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-maersk-black">{getBrandDisplayName(brandData.brandName)}</h2>
                  <p className="text-sm text-functional-mid-grey">{brandData.totalOrders.toLocaleString()} 个包裹的重量分析详情</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setViewSelectedBrand("all")} className="maersk-button-secondary">
                返回总览
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                <div className="text-2xl font-semibold text-maersk-black">{brandData.lightWeightRatio.toFixed(1)}%</div>
                <div className="text-sm text-functional-mid-grey">轻重量包裹占比(1kg内)</div>
              </div>
              <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                <div className="text-2xl font-semibold text-maersk-black">{brandData.avgWeight.toFixed(2)}kg</div>
                <div className="text-sm text-functional-mid-grey">平均重量</div>
              </div>
              <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                <div className="text-2xl font-semibold text-maersk-black">{brandData.brandShareRatio.toFixed(1)}%</div>
                <div className="text-sm text-functional-mid-grey">总订单占比</div>
              </div>
              <div className="text-center p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                <div className="text-2xl font-semibold text-maersk-black">{brandData.optimizationOpportunities.length}</div>
                <div className="text-sm text-functional-mid-grey">识别机会数</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="maersk-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-maersk-blue" />
                重量分布详情
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {brandData.weightDistribution.map((range, idx) => {
                  const percentage = brandData.totalOrders > 0 ? (range.orders / brandData.totalOrders) * 100 : 0;
                  const isLight = range.range === "0-0.5kg" || range.range === "0.5-1kg";

                  return (
                    <div key={idx} className="flex items-center justify-between py-3 px-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded ${isLight ? "bg-accent-mid-green" : "bg-functional-mid-grey"}`} />
                        <span className="font-medium text-maersk-black">{range.range}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-maersk-black">{range.orders.toLocaleString()}</div>
                        <div className="text-sm text-functional-mid-grey">{percentage.toFixed(1)}% | 平均{range.avgWeight.toFixed(2)}kg</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="maersk-card shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-accent-mid-orange" />
                  优化建议
                </CardTitle>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-functional-mid-grey">AI分析</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedAnalysis(!showAdvancedAnalysis)}
                    className={`p-2 rounded-lg border transition-colors ${
                      showAdvancedAnalysis
                        ? "bg-maersk-blue text-maersk-white border-maersk-blue hover:bg-functional-mid-blue"
                        : "bg-maersk-white text-functional-mid-grey border-functional-light-grey hover:bg-functional-bright-grey"
                    }`}
                  >
                    {showAdvancedAnalysis ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {brandData.optimizationOpportunities.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {brandData.optimizationOpportunities.map((opportunity, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border ${getPriorityColor(opportunity.priority)}`}>
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-medium">{opportunity.type}</span>
                        <Badge variant="outline" className="text-xs">
                          {opportunity.priority}优先级
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{opportunity.description}</p>
                      <div className="font-medium">预估影响: {opportunity.impact}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-functional-mid-grey mb-4">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">当前品牌暂无明显优化机会</p>
                </div>
              )}

              {showAdvancedAnalysis && (
                <div className="border-t border-functional-light-grey pt-4">
                  <div className="flex flex-col items-center justify-center py-10 bg-functional-bright-grey rounded-lg border border-dashed border-functional-light-grey">
                    <div className="p-3 bg-maersk-white rounded-full shadow-sm mb-3">
                      <Brain className="h-8 w-8 text-maersk-blue opacity-20" />
                    </div>
                    <h4 className="font-medium text-maersk-black mb-1">AI 驱动优化分析</h4>
                    <p className="text-sm text-functional-mid-grey">功能暂未开放，敬请期待</p>
                  </div>

                  {/* 源代码保留供后续开放使用
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="h-5 w-5 text-maersk-blue" />
                    <h4 className="font-medium text-maersk-black">AI驱动优化分析</h4>
                    <Badge variant="outline" className="text-xs bg-maersk-blue text-maersk-white border-maersk-blue">
                      基于真实数据
                    </Badge>
                  </div>

                  <div className="bg-functional-bright-blue p-3 rounded-lg border border-functional-light-blue mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-functional-dark-blue" />
                      <span className="text-sm font-medium text-functional-dark-blue">AI分析说明</span>
                    </div>
                    <p className="text-xs text-functional-dark-blue">
                      以下判断基于当前品牌真实重量分布、品牌占比与承运商结构生成，用于帮助识别优先优化区间，不再使用模拟样例。
                    </p>
                  </div>

                  <div className="space-y-3">
                  {generateAdvancedAnalysis(brandData).map((insight, idx) => (
                    <div key={idx} className="p-4 bg-gradient-to-r from-maersk-white to-functional-bright-blue rounded-lg border border-functional-light-blue">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {insight.icon}
                          <span className="font-medium text-maersk-black">{insight.type}</span>
                          <Badge variant="outline" className="text-xs bg-maersk-blue text-maersk-white border-maersk-blue">
                            {insight.category}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium text-maersk-blue">置信度: {insight.confidence}%</div>
                      </div>
                      <div className="text-sm text-maersk-black mb-1"><strong>预测:</strong> {insight.prediction}</div>
                      <div className="text-sm text-functional-mid-grey mb-1"><strong>建议:</strong> {insight.recommendation}</div>
                      <div className="text-sm font-medium text-accent-dark-green">预估影响: {insight.impact}</div>
                    </div>
                  ))}
                  </div>

                  <div className="mt-4 p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                    <div className="flex items-center justify-between text-xs text-functional-mid-grey">
                      <div className="flex items-center gap-4">
                        <span>分析区间: {brandData.weightDistribution.length}个</span>
                        <span>识别机会: {brandData.optimizationOpportunities.length}项</span>
                        <span>主力区间: {[...brandData.weightDistribution].sort((a, b) => b.orders - a.orders)[0]?.range || "--"}</span>
                      </div>
                      <span>最后更新: {pageStats.lastUpdated}</span>
                    </div>
                  </div>
                  */}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {brandData.courierAnalysis.length > 0 && (
          <Card className="maersk-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-accent-mid-teal" />
                快递结构差异分析
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {brandData.courierAnalysis.map((analysis, idx) => (
                  <div key={idx} className="p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                    <h4 className="font-medium text-maersk-black mb-2">{analysis.range}</h4>
                    <div className="text-sm text-functional-mid-grey space-y-1">
                      <div>份额差异: <span className="font-medium text-maersk-black">{analysis.shareDiff.toFixed(1)}%</span></div>
                      <div>{analysis.topCourier}: <span className="font-medium">{analysis.topOrders.toLocaleString()}单</span></div>
                      <div>{analysis.secondCourier}: <span className="font-medium">{analysis.secondOrders.toLocaleString()}单</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-0 flex items-center gap-2 text-functional-mid-grey hover:text-maersk-black">
              <ArrowLeft className="h-4 w-4" />返回概览
            </Button>
          )}

          <div className="flex items-center gap-3">
            <div className="p-2 bg-functional-bright-blue rounded-lg">
              <Package className="h-6 w-6 text-maersk-blue" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-maersk-black">重量分析</h1>
              <p className="text-muted-foreground mt-1">
                {(() => {
                  if (Array.isArray(globalSelectedBrand) && globalSelectedBrand.length > 0) {
                    return `已选品牌：${globalSelectedBrand.map(code => codeToNameMap[code] || code).join('、')}`;
                  }
                  return viewSelectedBrand === "all" ? "品牌总览和对比分析" : `${codeToNameMap[viewSelectedBrand] || viewSelectedBrand} 品牌详细分析`;
                })()}
              </p>
            </div>
          </div>
        </div>

        {!isLoadingPermissions && userPermissions?.isInternalUser && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-functional-bright-blue rounded-lg border border-functional-light-blue shrink-0">
            <Label className="text-sm text-functional-mid-grey">重量类型:</Label>
            <Select value={weightType} onValueChange={(value: "payable" | "receivable") => handleWeightTypeChange(value)}>
              <SelectTrigger className="w-[140px] h-8 border-functional-light-grey">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receivable">
                  <div className="flex items-center gap-2">
                    <Unlock className="h-3 w-3 text-accent-mid-green" />应收计费重
                  </div>
                </SelectItem>
                <SelectItem value="payable">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3 w-3 text-accent-mid-orange" />应付计费重
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs bg-maersk-blue text-maersk-white border-maersk-blue">内部用户</Badge>
          </div>
        )}
{/*
        <div className="flex items-center space-x-3">
          <div className="text-sm text-functional-mid-grey">更新时间: {pageStats.lastUpdated}</div>

          <Button variant="outline" size="sm" className="flex items-center gap-2 maersk-button-secondary" onClick={fetchAnalysisData}>
            <RefreshCw className="h-4 w-4" />刷新数据
          </Button>

          <Button variant="outline" size="sm" className="flex items-center gap-2 maersk-button-secondary">
            <Download className="h-4 w-4" />导出报告
          </Button>
        </div>
        */}
      </div>

      {analysisError && (
        <Card className="maersk-card shadow-sm border-accent-light-red bg-accent-bright-red">
          <CardContent className="pt-4 text-accent-dark-red">{analysisError}</CardContent>
        </Card>
      )}

      {isLoadingAnalysis ? (
        <Card className="maersk-card shadow-sm">
          <CardContent className="pt-6 text-functional-mid-grey">重量分析数据加载中...</CardContent>
        </Card>
      ) : (
        <>
          {/* 🔥 调试日志：打印传递给WeightDistributionChart的props */}
          {(() => {
            let chartBrand = undefined;
            if (Array.isArray(globalSelectedBrand) && globalSelectedBrand.length > 0) {
              chartBrand = globalSelectedBrand;
            } else if (viewSelectedBrand !== "all") {
              chartBrand = viewSelectedBrand;
            }
            console.log("📊 [WeightAnalysisPage] 传递给WeightDistributionChart的props:", {
              viewSelectedBrand,
              chartBrand,
              chartBrandType: Array.isArray(chartBrand) ? 'array' : typeof chartBrand,
              chartBrandLength: Array.isArray(chartBrand) ? chartBrand.length : 'N/A',
              hasPrefetchedData: !!analysisData
            });
            return null;
          })()}




          <WeightDistributionChart
            selectedBrand={
              Array.isArray(globalSelectedBrand) && globalSelectedBrand.length > 0
                ? globalSelectedBrand
                : viewSelectedBrand === "all"
                ? undefined
                : viewSelectedBrand
            }
            dateRange={effectiveDateRange}
            weightType={weightType}
            prefetchedData={viewMode === 'region' ? regionData : analysisData}
            regionData={regionData}
            analysisData={analysisData}
            compact={viewMode === 'region'}
            viewMode={viewMode}
            isLoadingRegion={isLoadingRegion}
            regionError={regionError}
            onRegionTabClick={fetchRegionData}
          />

          {/* 多选或全选时显示品牌卡片和排行榜，单品牌时显示详情 */}
          {(viewSelectedBrand === "all")
            ? renderBrandOverview()
            : renderBrandDetail()}
        </>
      )}
    </div>
  );
}
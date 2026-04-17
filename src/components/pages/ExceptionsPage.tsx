import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Package, 
  Truck, 
  MapPin, 
  Settings, 
  Users, 
  Building2,
  ShieldAlert,
  Timer,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Filter,
  Target,
  FileX,
  Phone,
  Calendar,
  Zap,
  Shield,
  Home,
  Navigation,
  MessageCircle,
  Warehouse,
  DollarSign,
  BookOpen,
  Lock,
  Cloud,
  PhoneOff,
  Archive,
  Loader2
} from "lucide-react";
import type { FilteredData } from "../../utils/dataFilter";
import { ApiService } from "../../services/apiService";
import { DataLoadingState } from "../DataLoadingState";

interface ExceptionsPageProps {
  filteredData: FilteredData;
  selectedBrand: string | null;
  dateRange?: { from: string; to: string };
  onDateRangeChange?: (from: string, to: string) => void;
  useRealData?: boolean;
  apiLoading?: boolean;
  selectedPlatform?: string | null;
  selectedSelfFlag?: string;
  userBrands?: string[];
}

export function ExceptionsPage({ 
  filteredData, 
  selectedBrand, 
  dateRange,
  useRealData = true,
  apiLoading = false,
  selectedPlatform,
  selectedSelfFlag,
  userBrands
}: ExceptionsPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedResponsibility, setSelectedResponsibility] = useState<string>("all");
  
  // 🔥 新增：API数据状态
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔥 新增：从API加载异常数据
  useEffect(() => {
    if (!useRealData) return;
    
    const loadExceptionData = async () => {
      if (!dateRange?.from || !dateRange?.to) {
        console.warn('⚠️ [ExceptionsPage] 缺少日期范围，跳过API调用');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log('🔍 [ExceptionsPage] 调用异常分析API，参数:', {
          dateRange,
          brand: selectedBrand,
          platform: selectedPlatform,
          selfFlag: selectedSelfFlag,
          userBrands
        });

        const data = await ApiService.getExceptionAnalysis({
          dateRange,
          brand: selectedBrand,
          platform: selectedPlatform,
          selfFlag: selectedSelfFlag,
          userBrands
        });

        console.log('✅ [ExceptionsPage] 异常分析数据加载成功:', data);
        console.log('📊 [ExceptionsPage] 数据详情:', {
          success: data?.success,
          hasSummary: !!data?.data?.summary,
          summary: data?.data?.summary,
          byCarrierLength: data?.data?.byCarrier?.length,
          byCarrier: data?.data?.byCarrier,
          byCarrierFirstItem: data?.data?.byCarrier?.[0],
          byReasonLength: data?.data?.byReason?.length,
          byReasonFirstItem: data?.data?.byReason?.[0]
        });
        setApiData(data);
        setError(null);
      } catch (err: any) {
        console.error('❌ [ExceptionsPage] 异常分析数据加载失败:', err);
        setError(err.message || '加载异常数据失败');
      } finally {
        setIsLoading(false);
      }
    };

    loadExceptionData();
  }, [useRealData, dateRange, selectedBrand, selectedPlatform, selectedSelfFlag, userBrands]);

  // 🔥 使用真实API数据或回退到旧数据
  const useApiData = apiData?.success && apiData?.data;
  
  // 从API数据中提取统计信息
  const actualTotal = useApiData 
    ? (apiData.data.summary?.totalExceptions || 0)
    : (filteredData?.courierData || []).reduce(
        (sum, courier) => {
          const notPickedOver2h = courier.exceptions?.notPickedOver2h || 0;
          const notShippedOver12h = courier.exceptions?.notShippedOver12h || 0;
          const notDeliveredOver3days = courier.exceptions?.notDeliveredOver3days || 0;
          return sum + notPickedOver2h + notShippedOver12h + notDeliveredOver3days;
        },
        0
      );
  
  const courierResponsibleCount = useApiData
    ? (apiData.data.summary?.carrierResponsibilityCount || 0)
    : Math.round(actualTotal * 0.45);
  
  const nonCourierResponsibleCount = useApiData
    ? (apiData.data.summary?.otherResponsibilityCount || 0)
    : Math.round(actualTotal * 0.55);
  
  const courierResponsiblePercentage = useApiData
    ? (apiData.data.summary?.carrierResponsibilityPercentage || 0)
    : 45;
  
  const nonCourierResponsiblePercentage = useApiData
    ? (apiData.data.summary?.otherResponsibilityPercentage || 0)
    : 55;

  // 计算基础异常数量 - 添加安全检查避免NaN（旧逻辑，保留作为后备）
  const totalExceptions = (filteredData?.courierData || []).reduce(
    (sum, courier) => {
      const notPickedOver2h = courier.exceptions?.notPickedOver2h || 0;
      const notShippedOver12h = courier.exceptions?.notShippedOver12h || 0;
      const notDeliveredOver3days = courier.exceptions?.notDeliveredOver3days || 0;
      return sum + notPickedOver2h + notShippedOver12h + notDeliveredOver3days;
    },
    0
  );

  // 安全的数学运算函数
  const safeRound = (value: number): number => {
    return Number.isFinite(value) ? Math.round(value) : 0;
  };

  const safeReduce = (courier: any, property: string): number => {
    return courier.exceptions?.[property] || 0;
  };

  // 根据实际表格定义异常类型和责任归属
  const exceptionsByResponsibility = [
    {
      category: "快递责任异常",
      responsibility: "快递承运商",
      icon: <Truck className="h-5 w-5" />,
      color: "text-accent-dark-red",
      bgColor: "bg-accent-bright-red",
      borderColor: "border-accent-light-red",
      percentage: 45,
      exceptions: [
        {
          type: "丢失/破损",
          icon: <Package className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.15),
          severity: "high",
          trend: -8.2,
          description: "快递包裹在运输过程中遗失或破损"
        },
        {
          type: "快递拒绝",
          icon: <XCircle className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.08),
          severity: "medium",
          trend: -12.5,
          description: "快递员拒绝揽收或配送包裹"
        },
        {
          type: "路由异常",
          icon: <Navigation className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.12),
          severity: "medium",
          trend: 3.1,
          description: "包裹运输路径出现异常偏离"
        },
        {
          type: "中转延误",
          icon: <Clock className="h-4 w-4" />,
          count: (filteredData?.courierData || []).reduce((sum, c) => sum + safeReduce(c, 'notShippedOver12h'), 0),
          severity: "high",
          trend: 5.8,
          description: "包裹在中转站滞留时间超过标准"
        },

        {
          type: "派送网点问题",
          icon: <Building2 className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.06),
          severity: "medium",
          trend: -2.3,
          description: "末端派送网点服务异常"
        },
        {
          type: "签收未及时",
          icon: <Timer className="h-4 w-4" />,
          count: (filteredData?.courierData || []).reduce((sum, c) => sum + safeReduce(c, 'notDeliveredOver3days'), 0),
          severity: "medium",
          trend: -1.7,
          description: "包裹已送达但签收确认不及时"
        },
        {
          type: "货物积压",
          icon: <Archive className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.04),
          severity: "low",
          trend: -15.6,
          description: "仓库或中转站货物堆积严重"
        }
      ]
    },
    {
      category: "非快递商责任异常",
      responsibility: "其他方",
      icon: <Users className="h-5 w-5" />,
      color: "text-functional-dark-blue",
      bgColor: "bg-functional-bright-blue",
      borderColor: "border-functional-light-blue",
      percentage: 55,
      exceptions: [
        {
          type: "快件寄存",
          icon: <Warehouse className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.12),
          severity: "low",
          trend: 2.1,
          description: "客户主动要求包裹寄存代收点",
          responsibility: "客户选择"
        },
        {
          type: "快件拦截",
          icon: <Shield className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.03),
          severity: "medium",
          trend: -5.8,
          description: "客户或发件方要求中途拦截包裹",
          responsibility: "客户需求"
        },
        {
          type: "快件自取",
          icon: <Target className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.18),
          severity: "low",
          trend: 8.4,
          description: "客户选择到网点或代收点自取",
          responsibility: "客户选择"
        },
        {
          type: "快件超区",
          icon: <MapPin className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.07),
          severity: "medium",
          trend: -3.2,
          description: "收货地址超出配送服务范围",
          responsibility: "地址限制"
        },
        {
          type: "天气原因",
          icon: <Cloud className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.05),
          severity: "medium",
          trend: 12.5,
          description: "恶劣天气影响正常配送",
          responsibility: "不可抗力"
        },
        {
          type: "政策原因",
          icon: <FileX className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.02),
          severity: "high",
          trend: -8.9,
          description: "政府管控措施影响配送",
          responsibility: "政府管控"
        },
        {
          type: "法定假日",
          icon: <Calendar className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.04),
          severity: "low",
          trend: 0.0,
          description: "法定节假日服务时间调整",
          responsibility: "节假日安排"
        },
        {
          type: "快递拒签",
          icon: <XCircle className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.06),
          severity: "medium",
          trend: -4.1,
          description: "收件人拒绝签收快递包裹",
          responsibility: "客户拒签"
        },
        {
          type: "客户拒收",
          icon: <MessageCircle className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.08),
          severity: "medium",
          trend: 1.8,
          description: "客户主动拒绝接收包裹",
          responsibility: "客户拒收"
        },
        {
          type: "电话无人接听",
          icon: <PhoneOff className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.10),
          severity: "low",
          trend: -2.5,
          description: "联系收件人电话无人应答",
          responsibility: "联系方式"
        },
        {
          type: "客户指定日期",
          icon: <Calendar className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.09),
          severity: "low",
          trend: 6.7,
          description: "客户要求指定特定配送时间",
          responsibility: "客户需求"
        },
        {
          type: "仓库原因",
          icon: <Warehouse className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.03),
          severity: "medium",
          trend: -7.3,
          description: "发货仓库操作异常或延误",
          responsibility: "仓储管理"
        },
        {
          type: "修改配送作业",
          icon: <Settings className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.02),
          severity: "low",
          trend: 4.2,
          description: "客户要求修改配送方式或地址",
          responsibility: "客户变更"
        },
        {
          type: "需向买家补偿",
          icon: <DollarSign className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.01),
          severity: "high",
          trend: -18.5,
          description: "因服务问题需要向客户提供补偿",
          responsibility: "服务补偿"
        },
        {
          type: "安检查验",
          icon: <Shield className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.02),
          severity: "medium",
          trend: 3.8,
          description: "包裹需要接受安全检查",
          responsibility: "安全检查"
        },
        {
          type: "校园快件",
          icon: <BookOpen className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.03),
          severity: "low",
          trend: 15.2,
          description: "校园配送受管理规定限制",
          responsibility: "校园管理"
        },
        {
          type: "无法进入",
          icon: <Lock className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.04),
          severity: "medium",
          trend: -1.9,
          description: "无法进入小区或办公楼",
          responsibility: "门禁限制"
        },
        {
          type: "疫情原因",
          icon: <ShieldAlert className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.01),
          severity: "high",
          trend: -25.6,
          description: "疫情防控措施影响正常配送",
          responsibility: "疫情防控"
        },
        {
          type: "电话异常",
          icon: <Phone className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.02),
          severity: "low",
          trend: -6.4,
          description: "收件人电话号码异常或停机",
          responsibility: "联系方式"
        },
        {
          type: "未出库/体检",
          icon: <Archive className="h-4 w-4" />,
          count: safeRound(totalExceptions * 0.01),
          severity: "medium",
          trend: -12.8,
          description: "包裹未能及时出库或需体检",
          responsibility: "仓储操作"
        }
      ]
    }
  ];

  // 计算责任方统计 - 添加安全检查
  const processedCount = safeRound(actualTotal * 0.78);
  const processingRate = actualTotal > 0 ? safeRound((processedCount / actualTotal) * 100) : 0;

  // 获取筛选后的异常数据
  const getFilteredExceptions = () => {
    let filtered = exceptionsByResponsibility.flatMap(category => 
      category.exceptions.map(exception => ({
        ...exception,
        category: category.category,
        categoryIcon: category.icon,
        categoryColor: category.color,
        responsibilityParty: category.responsibility
      }))
    );

    if (selectedSeverity !== "all") {
      filtered = filtered.filter(ex => ex.severity === selectedSeverity);
    }

    if (selectedResponsibility !== "all") {
      if (selectedResponsibility === "courier") {
        filtered = filtered.filter(ex => ex.responsibilityParty === "快递承运商");
      } else if (selectedResponsibility === "non-courier") {
        filtered = filtered.filter(ex => ex.responsibilityParty === "其他方");
      }
    }

    return filtered;
  };

  const filteredExceptions = getFilteredExceptions();
  const highPriorityCount = filteredExceptions.filter(ex => ex.severity === "high").length;

  // 🔥 Loading状态（模块级）
  if (isLoading || (useRealData && apiLoading)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-maersk-black">⚠️ 异常监控分析</h1>
            <p className="text-functional-mid-grey">
              基于实际业务数据的异常类型分析，按责任归属精准分类统计
            </p>
          </div>
        </div>
        <DataLoadingState
          loading={true}
          dataType="异常监控模块"
          loadingMessage="正在加载异常分析数据..."
          minHeight="420px"
        />
      </div>
    );
  }

  // 🔥 Error状态（模块级）
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-maersk-black">⚠️ 异常监控分析</h1>
            <p className="text-functional-mid-grey">
              基于实际业务数据的异常类型分析，按责任归属精准分类统计
            </p>
          </div>
        </div>
        <DataLoadingState
          error={error}
          hasData={false}
          dataType="异常监控模块"
          noDataMessage="异常数据加载失败，请稍后重试"
          minHeight="420px"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-maersk-black">⚠️ 异常监控分析</h1>
          <p className="text-functional-mid-grey">
            基于实际业务数据的异常类型分析，按责任归属精准分类统计
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedBrand && (
            <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue">
              品牌筛选: {selectedBrand}
            </Badge>
          )}
          
        </div>
      </div>

      {/* 异常概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-accent-bright-red rounded-full">
                <AlertTriangle className="h-4 w-4 text-accent-dark-red" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-accent-dark-red">{actualTotal || 0}</div>
                <div className="text-sm text-functional-mid-grey">总异常数</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-accent-bright-red rounded-full">
                <Truck className="h-4 w-4 text-accent-dark-red" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-accent-dark-red">{courierResponsiblePercentage.toFixed(1)}%</div>
                <div className="text-sm text-functional-mid-grey">快递商责任占比</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-functional-bright-blue rounded-full">
                <Users className="h-4 w-4 text-functional-dark-blue" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-functional-dark-blue">{nonCourierResponsiblePercentage.toFixed(1)}%</div>
                <div className="text-sm text-functional-mid-grey">非快递商责任占比</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-accent-bright-orange rounded-full">
                <Package className="h-4 w-4 text-accent-dark-orange" />
              </div>
              <div>
                {(() => {
                  // 计算各快递商异常占比，显示最高的一个
                  const carrierStats = useApiData && apiData.data.byCarrier 
                    ? apiData.data.byCarrier 
                    : [];
                  const topCarrier = carrierStats.length > 0 ? carrierStats[0] : null;
                  const topCarrierPct = topCarrier ? (topCarrier.percentage || 0).toFixed(1) : '0.0';
                  const topCarrierName = topCarrier ? (topCarrier.carrierName || '未知') : '暂无';
                  
                  return (
                    <>
                      <div className="text-2xl font-semibold text-accent-dark-orange">{topCarrierPct}%</div>
                      <div className="text-sm text-functional-mid-grey">{topCarrierName} 占比最高</div>
                    </>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 责任分类概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="maersk-card">
          <CardHeader className="bg-accent-bright-red border-b border-accent-light-red">
            <CardTitle className="flex items-center justify-between text-accent-dark-red">
              <div className="flex items-center space-x-2">
                <Truck className="h-5 w-5" />
                <span>快递责任异常</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-maersk-white text-accent-dark-red border-accent-mid-red">
                  {courierResponsibleCount || 0} 单
                </Badge>
                <Badge variant="outline" className="bg-maersk-white text-accent-dark-red border-accent-mid-red">
                  {courierResponsiblePercentage.toFixed(1)}%
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-functional-mid-grey">占比:</span>
                <span className="font-medium text-maersk-black">{courierResponsiblePercentage.toFixed(1)}%</span>
              </div>
              <Progress value={courierResponsiblePercentage} className="h-2" />
              <div className="text-xs text-functional-mid-grey">
                主要包括路由异常，中转延误等异常监控
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card">
          <CardHeader className="bg-functional-bright-blue border-b border-functional-light-blue">
            <CardTitle className="flex items-center justify-between text-functional-dark-blue">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>非快递商责任异常</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-maersk-white text-functional-dark-blue border-functional-mid-blue">
                  {nonCourierResponsibleCount || 0} 单
                </Badge>
                <Badge variant="outline" className="bg-maersk-white text-functional-dark-blue border-functional-mid-blue">
                  {nonCourierResponsiblePercentage.toFixed(1)}%
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-functional-mid-grey">占比:</span>
                <span className="font-medium text-maersk-black">{nonCourierResponsiblePercentage.toFixed(1)}%</span>
              </div>
              <Progress value={nonCourierResponsiblePercentage} className="h-2" />
              <div className="text-xs text-functional-mid-grey">
                包括客户因素、外部环境、政策法规等非快递公司可控因素
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细异常分析 */}
      <Tabs defaultValue="courier" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-functional-bright-grey">
          <TabsTrigger value="courier" className="flex items-center space-x-2 text-maersk-black">
            <Truck className="h-4 w-4" />
            <span>快递责任异常</span>
          </TabsTrigger>
          <TabsTrigger value="non-courier" className="flex items-center space-x-2 text-maersk-black">
            <Users className="h-4 w-4" />
            <span>非快递商责任异常</span>
          </TabsTrigger>
        </TabsList>

        {/* 快递责任异常详情 */}
        <TabsContent value="courier" className="space-y-6">
          <Card className="maersk-card">
            <CardHeader>
              <CardTitle className="text-accent-dark-red">🚚 快递承运商责任异常详情</CardTitle>

            </CardHeader>
            <CardContent>
              {/* 快递商占比分析 - 🔥 动态渲染所有快递商 */}
              <div className="mb-6">
                <h4 className="font-medium mb-4 text-maersk-black flex items-center space-x-2">
                  <Truck className="h-4 w-4" />
                  <span>快递商异常占比分析</span>
                </h4>
                {(() => {
                  // 🔥 使用真实API数据动态渲染所有快递商
                  const carrierStats = useApiData && apiData.data.byCarrier 
                    ? apiData.data.byCarrier 
                    : [];
                  
                  if (carrierStats.length === 0) {
                    return (
                      <div className="text-center text-functional-mid-grey py-8 border border-functional-light-grey rounded-lg">
                        暂无快递商异常数据
                      </div>
                    );
                  }

                  // 快递商颜色映射
                  const carrierColorMap: Record<string, { bg: string; border: string; text: string; emoji: string }> = {
                    '顺丰': { bg: 'bg-accent-bright-green', border: 'border-accent-light-green', text: 'text-accent-dark-green', emoji: '🚀' },
                    'SF': { bg: 'bg-accent-bright-green', border: 'border-accent-light-green', text: 'text-accent-dark-green', emoji: '🚀' },
                    '中通': { bg: 'bg-functional-bright-blue', border: 'border-functional-light-blue', text: 'text-functional-dark-blue', emoji: '🚚' },
                    'ZTO': { bg: 'bg-functional-bright-blue', border: 'border-functional-light-blue', text: 'text-functional-dark-blue', emoji: '🚚' },
                    '圆通': { bg: 'bg-accent-bright-orange', border: 'border-accent-light-orange', text: 'text-accent-dark-orange', emoji: '🚛' },
                    'YTO': { bg: 'bg-accent-bright-orange', border: 'border-accent-light-orange', text: 'text-accent-dark-orange', emoji: '🚛' },
                    '申通': { bg: 'bg-functional-bright-grey', border: 'border-functional-mid-grey', text: 'text-functional-mid-grey', emoji: '📦' },
                    'STO': { bg: 'bg-functional-bright-grey', border: 'border-functional-mid-grey', text: 'text-functional-mid-grey', emoji: '📦' },
                  };
                  const defaultColors = { bg: 'bg-functional-bright-grey', border: 'border-functional-light-grey', text: 'text-functional-mid-grey', emoji: '📦' };

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {carrierStats.map((carrier: any, index: number) => {
                          const name = carrier.carrierName || '未知快递商';
                          const count = carrier.exceptionCount || 0;
                          const pct = carrier.percentage || 0;
                          const colors = carrierColorMap[name] || defaultColors;

                          return (
                            <div key={`carrier-stat-${name}-${index}`} className={`p-4 border ${colors.border} rounded-lg ${colors.bg} bg-opacity-30`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <div className={`w-8 h-8 ${colors.bg} rounded-full flex items-center justify-center border ${colors.border}`}>
                                    <span className="text-sm">{colors.emoji}</span>
                                  </div>
                                  <div>
                                    <div className="font-medium text-maersk-black">{name}</div>
                                    <div className="text-xs text-functional-mid-grey">{count} 单异常</div>
                                  </div>
                                </div>
                                {index < 2 && (
                                  <Badge variant="outline" className={`${colors.bg} ${colors.text} ${colors.border} text-xs`}>
                                    {index === 0 ? '占比最高' : '占比次高'}
                                  </Badge>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-functional-mid-grey">占比:</span>
                                  <span className={`font-semibold ${colors.text}`}>{pct.toFixed(1)}%</span>
                                </div>
                                <Progress value={pct} className="h-2" />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 快递商对比总结 */}
                      <div className="p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                        <div className={`grid grid-cols-${Math.min(carrierStats.length + 1, 4)} gap-3 text-center text-sm`}>
                          <div>
                            <div className="font-semibold text-maersk-black">{courierResponsibleCount || 0}</div>
                            <div className="text-xs text-functional-mid-grey">快递责任异常总数</div>
                          </div>
                          {carrierStats.slice(0, 3).map((carrier: any, idx: number) => {
                            const name = carrier.carrierName || '未知';
                            const pct = (carrier.percentage || 0).toFixed(1);
                            const colors = carrierColorMap[name] || defaultColors;
                            return (
                              <div key={`summary-stat-${name}-${idx}`}>
                                <div className={`font-semibold ${colors.text}`}>{name} {pct}%</div>
                                <div className="text-xs text-functional-mid-grey">异常占比{idx === 0 ? '最高' : idx === 1 ? '次高' : ''}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* 异常类型详情 */}
              <div>
                <h4 className="font-medium mb-4 text-maersk-black">异常类型详情</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(() => {
                    // 优先使用真实 API byReason 数据（过滤快递责任）
                    const reasonItems: any[] = useApiData
                      ? (apiData.data.byReason || []).filter(
                          (r: any) => r.responsibility === '快递责任'
                        )
                      : exceptionsByResponsibility[0].exceptions.map((e) => ({
                          reasonName: e.type,
                          exceptionCount: e.count,
                          percentage: 0,
                          responsibility: '快递责任',
                          _fallback: true,
                          _icon: e.icon,
                          _severity: e.severity,
                          _trend: e.trend,
                          _description: e.description,
                        }));

                    if (reasonItems.length === 0) {
                      return (
                        <div className="col-span-2 text-center text-functional-mid-grey py-8">
                          暂无快递责任异常类型数据
                        </div>
                      );
                    }

                    const maxCount = Math.max(
                      ...reasonItems.map((r: any) =>
                        useApiData ? (r.exceptionCount || 0) : (r.count || 0)
                      )
                    );

                    const carrierColorMap: Record<string, { dot: string; bar: string; emoji: string }> = {
                      顺丰: { dot: 'bg-accent-bright-green border-accent-light-green', bar: 'bg-accent-mid-green', emoji: '🚀' },
                      中通: { dot: 'bg-functional-bright-blue border-functional-light-blue', bar: 'bg-functional-mid-blue', emoji: '🚚' },
                      圆通: { dot: 'bg-accent-bright-orange border-accent-light-orange', bar: 'bg-accent-mid-orange', emoji: '🚛' },
                      申通: { dot: 'bg-functional-bright-grey border-functional-mid-grey', bar: 'bg-functional-mid-grey', emoji: '📦' },
                    };
                    const defaultCarrierColor = { dot: 'bg-functional-bright-grey border-functional-mid-grey', bar: 'bg-functional-mid-grey', emoji: '📦' };
                    const barColorPool = ['bg-accent-mid-green', 'bg-functional-mid-blue', 'bg-accent-mid-orange', 'bg-functional-mid-grey'];

                    return reasonItems.map((item: any, index: number) => {
                      const isFallback = !!item._fallback;
                      const count = isFallback ? (item.count || 0) : (item.exceptionCount || 0);
                      const name = isFallback ? item.reasonName : (item.reasonName || '未分类');
                      const pct = isFallback ? 0 : (item.percentage || 0);

                      // 从 crossAnalysis 获取该原因下各快递商的分布
                      const carrierBreakdown: any[] = useApiData
                        ? (apiData.data.crossAnalysis || [])
                            .filter(
                              (c: any) =>
                                c.reasonName === item.reasonName &&
                                c.responsibility === '快递责任'
                            )
                            .sort(
                              (a: any, b: any) =>
                                (b.exceptionCount || 0) - (a.exceptionCount || 0)
                            )
                            .slice(0, 4)
                        : [];

                      const totalForReason = carrierBreakdown.reduce(
                        (sum: number, c: any) => sum + (c.exceptionCount || 0),
                        0
                      );

                      return (
                        <div
                          key={`courier-${name}-${index}`}
                          className="p-4 border border-accent-light-red rounded-lg hover:bg-accent-bright-red hover:bg-opacity-30 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              <div className="p-1 bg-accent-bright-red rounded">
                                {isFallback ? item._icon : <AlertTriangle className="h-4 w-4 text-accent-dark-red" />}
                              </div>
                              <div>
                                <div className="font-medium text-maersk-black">{name}</div>
                                {isFallback ? (
                                  <Badge
                                    variant={
                                      item._severity === 'high'
                                        ? 'destructive'
                                        : item._severity === 'medium'
                                        ? 'secondary'
                                        : 'outline'
                                    }
                                    className="text-xs mt-1"
                                  >
                                    {item._severity === 'high' ? '高' : item._severity === 'medium' ? '中' : '低'}
                                  </Badge>
                                ) : (
                                  <div className="text-xs text-functional-mid-grey mt-1">
                                    占总异常 {pct.toFixed(1)}%
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-semibold text-maersk-black">
                                {count}
                              </div>
                              {isFallback ? (
                                <div className="flex items-center space-x-1 text-sm">
                                  {item._trend > 0 ? (
                                    <TrendingUp className="h-3 w-3 text-accent-mid-red" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3 text-accent-mid-green" />
                                  )}
                                  <span className={item._trend > 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}>
                                    {Math.abs(item._trend).toFixed(1)}%
                                  </span>
                                </div>
                              ) : (
                                <div className="text-xs text-functional-mid-grey">异常单</div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            {isFallback && (
                              <div className="text-sm text-functional-mid-grey">
                                {item._description}
                              </div>
                            )}
                            <Progress
                              value={
                                maxCount > 0
                                  ? Math.min((count / maxCount) * 100, 100)
                                  : 0
                              }
                              className="h-2"
                            />

                            {/* 快递商占比详情 */}
                            {carrierBreakdown.length > 0 ? (
                              <div className="mt-3 p-2 bg-functional-bright-grey rounded border border-functional-light-grey">
                                <div className="text-xs text-functional-mid-grey mb-2">快递商占比分布</div>
                                <div className="grid grid-cols-2 gap-2">
                                  {carrierBreakdown.map((carrier: any, ci: number) => {
                                    const cName = carrier.carrierName || '未知';
                                    const cCount = carrier.exceptionCount || 0;
                                    const cPct =
                                      totalForReason > 0
                                        ? Math.round((cCount / totalForReason) * 100)
                                        : 0;
                                    const colors =
                                      carrierColorMap[cName] || defaultCarrierColor;
                                    return (
                                      <div key={`carrier-${name}-${cName}-${ci}`} className="flex items-center justify-between">
                                        <div className="flex items-center space-x-1">
                                          <div
                                            className={`w-3 h-3 ${colors.dot} rounded-full border flex items-center justify-center`}
                                          >
                                            <span className="text-xs">{colors.emoji}</span>
                                          </div>
                                          <span className="text-xs text-functional-mid-grey">
                                            {cName}
                                          </span>
                                        </div>
                                        <div className="text-xs font-medium text-maersk-black">
                                          {cCount} 单 ({cPct}%)
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* 分段占比进度条 */}
                                <div className="mt-2 flex h-1 bg-functional-light-grey rounded overflow-hidden">
                                  {carrierBreakdown.map((carrier: any, ci: number) => {
                                    const cCount = carrier.exceptionCount || 0;
                                    const cName = carrier.carrierName || '未知';
                                    const cPct =
                                      totalForReason > 0
                                        ? (cCount / totalForReason) * 100
                                        : 0;
                                    return (
                                      <div
                                        key={`bar-${name}-${cName}-${ci}`}
                                        className={barColorPool[ci % barColorPool.length]}
                                        style={{ width: `${cPct}%` }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              /* 无 crossAnalysis 数据时回退到旧的硬编码显示 */
                              <div className="mt-3 p-2 bg-functional-bright-grey rounded border border-functional-light-grey">
                                <div className="text-xs text-functional-mid-grey mb-2">快递商占比分布</div>
                                <div className="grid grid-cols-2 gap-2">
                                  {/* 顺丰 */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-1">
                                      <div className="w-3 h-3 bg-accent-bright-green rounded-full border border-accent-light-green flex items-center justify-center">
                                        <span className="text-xs">🚀</span>
                                      </div>
                                      <span className="text-xs text-functional-mid-grey">顺丰</span>
                                    </div>
                                    <div className="text-xs font-medium text-maersk-black">
                                      {safeRound(count * 0.42)} 单 (42%)
                                    </div>
                                  </div>
                                  {/* 中通 */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-1">
                                      <div className="w-3 h-3 bg-functional-bright-blue rounded-full border border-functional-light-blue flex items-center justify-center">
                                        <span className="text-xs">🚚</span>
                                      </div>
                                      <span className="text-xs text-functional-mid-grey">中通</span>
                                    </div>
                                    <div className="text-xs font-medium text-maersk-black">
                                      {safeRound(count * 0.58)} 单 (58%)
                                    </div>
                                  </div>
                                </div>
                                {/* 占比进度条 */}
                                <div className="mt-2 flex h-1 bg-functional-light-grey rounded overflow-hidden">
                                  <div className="bg-accent-mid-green" style={{ width: '42%' }}></div>
                                  <div className="bg-functional-mid-blue" style={{ width: '58%' }}></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 非快递商责任异常详情 */}
        <TabsContent value="non-courier" className="space-y-6">
          <Card className="maersk-card">
            <CardHeader>
              <CardTitle className="text-functional-dark-blue">👥 非快递商责任异常详情</CardTitle>
              <div className="text-sm text-functional-mid-grey">
                这些异常由客户需求、外部环境、政策因素等非快递公司可控因素导致
              </div>
            </CardHeader>
            <CardContent>
              {/* 🔥 新增：非快递商责任异常的快递商占比分析 */}
              <div className="mb-6">
                <h4 className="font-medium mb-4 text-maersk-black flex items-center space-x-2">
                  <Truck className="h-4 w-4" />
                  <span>非快递商责任异常的快递商占比分析</span>
                </h4>
                {(() => {
                  // 🔥 计算非快递商责任异常下的快递商占比
                  const nonCourierCarrierStats = useApiData && apiData.data.crossAnalysis
                    ? (() => {
                        // 过滤出所有非快递责任的数据
                        const nonCourierData = apiData.data.crossAnalysis.filter((c: any) => c.responsibility !== '快递责任');
                        
                        // 按快递商聚合
                        const carrierMap = new Map();
                        nonCourierData.forEach((item: any) => {
                          const name = item.carrierName || '未知';
                          const count = item.exceptionCount || 0;
                          if (carrierMap.has(name)) {
                            carrierMap.set(name, carrierMap.get(name) + count);
                          } else {
                            carrierMap.set(name, count);
                          }
                        });
                        
                        // 计算总数和百分比
                        const total = Array.from(carrierMap.values()).reduce((sum: number, count: number) => sum + count, 0);
                        const result = Array.from(carrierMap.entries()).map(([name, count]) => ({
                          carrierName: name,
                          exceptionCount: count,
                          percentage: total > 0 ? (count / total) * 100 : 0
                        }));
                        
                        // 按数量排序
                        return result.sort((a, b) => b.exceptionCount - a.exceptionCount);
                      })()
                    : [];
                  
                  if (nonCourierCarrierStats.length === 0) {
                    return (
                      <div className="text-center text-functional-mid-grey py-8 border border-functional-light-grey rounded-lg">
                        暂无快递商数据
                      </div>
                    );
                  }

                  // 快递商颜色映射
                  const carrierColorMap: Record<string, { bg: string; border: string; text: string; emoji: string }> = {
                    '顺丰': { bg: 'bg-accent-bright-green', border: 'border-accent-light-green', text: 'text-accent-dark-green', emoji: '🚀' },
                    'SF': { bg: 'bg-accent-bright-green', border: 'border-accent-light-green', text: 'text-accent-dark-green', emoji: '🚀' },
                    '中通': { bg: 'bg-functional-bright-blue', border: 'border-functional-light-blue', text: 'text-functional-dark-blue', emoji: '🚚' },
                    'ZTO': { bg: 'bg-functional-bright-blue', border: 'border-functional-light-blue', text: 'text-functional-dark-blue', emoji: '🚚' },
                    '圆通': { bg: 'bg-accent-bright-orange', border: 'border-accent-light-orange', text: 'text-accent-dark-orange', emoji: '🚛' },
                    'YTO': { bg: 'bg-accent-bright-orange', border: 'border-accent-light-orange', text: 'text-accent-dark-orange', emoji: '🚛' },
                    '申通': { bg: 'bg-functional-bright-grey', border: 'border-functional-mid-grey', text: 'text-functional-mid-grey', emoji: '📦' },
                    'STO': { bg: 'bg-functional-bright-grey', border: 'border-functional-mid-grey', text: 'text-functional-mid-grey', emoji: '📦' },
                  };
                  const defaultColors = { bg: 'bg-functional-bright-grey', border: 'border-functional-light-grey', text: 'text-functional-mid-grey', emoji: '📦' };

                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {nonCourierCarrierStats.map((carrier: any, index: number) => {
                          const name = carrier.carrierName || '未知快递商';
                          const count = carrier.exceptionCount || 0;
                          const pct = carrier.percentage || 0;
                          const colors = carrierColorMap[name] || defaultColors;

                          return (
                            <div key={`non-carrier-stat-${name}-${index}`} className={`p-4 border ${colors.border} rounded-lg ${colors.bg} bg-opacity-30`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <div className={`w-8 h-8 ${colors.bg} rounded-full flex items-center justify-center border ${colors.border}`}>
                                    <span className="text-sm">{colors.emoji}</span>
                                  </div>
                                  <div>
                                    <div className="font-medium text-maersk-black">{name}</div>
                                    <div className="text-xs text-functional-mid-grey">{count} 单异常</div>
                                  </div>
                                </div>
                                {index < 2 && (
                                  <Badge variant="outline" className={`${colors.bg} ${colors.text} ${colors.border} text-xs`}>
                                    {index === 0 ? '占比最高' : '占比次高'}
                                  </Badge>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-functional-mid-grey">占比:</span>
                                  <span className={`font-semibold ${colors.text}`}>{pct.toFixed(1)}%</span>
                                </div>
                                <Progress value={pct} className="h-2" />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 快递商对比总结 */}
                      <div className="p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                        <div className={`grid grid-cols-${Math.min(nonCourierCarrierStats.length + 1, 4)} gap-3 text-center text-sm`}>
                          <div>
                            <div className="font-semibold text-maersk-black">{nonCourierResponsibleCount || 0}</div>
                            <div className="text-xs text-functional-mid-grey">非快递责任异常总数</div>
                          </div>
                          {nonCourierCarrierStats.slice(0, 3).map((carrier: any, idx: number) => {
                            const name = carrier.carrierName || '未知';
                            const pct = (carrier.percentage || 0).toFixed(1);
                            const colors = carrierColorMap[name] || defaultColors;
                            return (
                              <div key={`non-summary-stat-${name}-${idx}`}>
                                <div className={`font-semibold ${colors.text}`}>{name} {pct}%</div>
                                <div className="text-xs text-functional-mid-grey">异常占比{idx === 0 ? '最高' : idx === 1 ? '次高' : ''}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* 异常类型详情 */}
              <div>
                <h4 className="font-medium mb-4 text-maersk-black">异常类型详情</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  // 🐛 首先查看所有 byReason 数据
                  if (useApiData && apiData.data.byReason) {
                    console.log('🔍 [非快递责任] byReason数量:', apiData.data.byReason.length);
                    
                    // 查看所有责任类型的唯一值
                    const uniqueResponsibilities = [...new Set(apiData.data.byReason.map((r: any) => r.responsibility))];
                    console.log('🔍 [非快递责任] 所有唯一的责任类型:', uniqueResponsibilities);
                    
                    // 只打印前3条数据的摘要（避免循环引用）
                    const sampleData = apiData.data.byReason.slice(0, 3).map((r: any) => ({
                      reasonName: r.reasonName,
                      responsibility: r.responsibility,
                      exceptionCount: r.exceptionCount,
                      percentage: r.percentage
                    }));
                    console.log('🔍 [非快递责任] byReason样本数据:', sampleData);
                  }

                  // 🔥 优先使用真实 API byReason 数据（过滤非快递责任）
                  const reasonItems: any[] = useApiData
                    ? (apiData.data.byReason || []).filter((r: any) => {
                        const isCarrier = r.responsibility === '快递责任';
                        // 只要不是"快递责任"，都算作非快递责任
                        return !isCarrier;
                      })
                    : exceptionsByResponsibility[1].exceptions.map((e) => ({
                        reasonName: e.type,
                        exceptionCount: e.count,
                        percentage: 0,
                        responsibility: '非快递责任',
                        _fallback: true,
                        _icon: e.icon,
                        _severity: e.severity,
                        _trend: e.trend,
                        _description: e.description,
                        _responsibilityDetail: e.responsibility,
                      }));

                  console.log('🔍 [非快递责任] 过滤后的结果数量:', reasonItems.length);
                  if (reasonItems.length > 0) {
                    // 只打印摘要信息
                    const summary = reasonItems.slice(0, 3).map((r: any) => ({
                      reasonName: r.reasonName || r.type,
                      count: r.exceptionCount || r.count,
                      responsibility: r.responsibility
                    }));
                    console.log('🔍 [非快递责任] 过滤后的样本数据:', summary);
                  }

                  if (reasonItems.length === 0) {
                    return (
                      <div className="col-span-2 text-center text-functional-mid-grey py-8">
                        暂无非快递责任异常类型数据
                      </div>
                    );
                  }

                  const maxCount = Math.max(
                    ...reasonItems.map((r: any) =>
                      useApiData ? (r.exceptionCount || 0) : (r.count || 0)
                    )
                  );

                  const carrierColorMap: Record<string, { dot: string; bar: string; emoji: string }> = {
                    顺丰: { dot: 'bg-accent-bright-green border-accent-light-green', bar: 'bg-accent-mid-green', emoji: '🚀' },
                    中通: { dot: 'bg-functional-bright-blue border-functional-light-blue', bar: 'bg-functional-mid-blue', emoji: '🚚' },
                    圆通: { dot: 'bg-accent-bright-orange border-accent-light-orange', bar: 'bg-accent-mid-orange', emoji: '🚛' },
                    申通: { dot: 'bg-functional-bright-grey border-functional-mid-grey', bar: 'bg-functional-mid-grey', emoji: '📦' },
                  };
                  const defaultCarrierColor = { dot: 'bg-functional-bright-grey border-functional-mid-grey', bar: 'bg-functional-mid-grey', emoji: '📦' };

                  return reasonItems.map((item: any, index: number) => {
                    const isFallback = !!item._fallback;
                    const count = isFallback ? (item.count || 0) : (item.exceptionCount || 0);
                    const name = isFallback ? item.reasonName : (item.reasonName || '未分类');
                    const pct = isFallback ? 0 : (item.percentage || 0);

                    // 🔥 从 crossAnalysis 获取该原因下各快递商的分布
                    const carrierBreakdown: any[] = useApiData
                      ? (apiData.data.crossAnalysis || [])
                          .filter(
                            (c: any) =>
                              c.reasonName === item.reasonName &&
                              c.responsibility !== '快递责任'  // 🔥 修改：只要不是快递责任就是非快递责任
                          )
                          .sort(
                            (a: any, b: any) =>
                              (b.exceptionCount || 0) - (a.exceptionCount || 0)
                          )
                          .slice(0, 4)
                      : [];

                    const totalForReason = carrierBreakdown.reduce(
                      (sum: number, c: any) => sum + (c.exceptionCount || 0),
                      0
                    );

                    return (
                      <div
                        key={`non-courier-${name}-${index}`}
                        className="p-4 border border-functional-light-blue rounded-lg hover:bg-functional-bright-blue hover:bg-opacity-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="p-1 bg-functional-bright-blue rounded">
                              {isFallback ? item._icon : <Users className="h-4 w-4 text-functional-dark-blue" />}
                            </div>
                            <div>
                              <div className="font-medium text-maersk-black">{name}</div>
                              <div className="flex items-center space-x-2 mt-1">
                                {isFallback ? (
                                  <>
                                    <Badge
                                      variant={
                                        item._severity === 'high'
                                          ? 'destructive'
                                          : item._severity === 'medium'
                                          ? 'secondary'
                                          : 'outline'
                                      }
                                      className="text-xs"
                                    >
                                      {item._severity === 'high' ? '高' : item._severity === 'medium' ? '中' : '低'}
                                    </Badge>
                                    {item._responsibilityDetail && (
                                      <Badge variant="outline" className="text-xs bg-functional-bright-grey text-functional-dark-grey">
                                        {item._responsibilityDetail}
                                      </Badge>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-xs text-functional-mid-grey">
                                    占总异常 {pct.toFixed(1)}%
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-semibold text-maersk-black">
                              {count}
                            </div>
                            {isFallback ? (
                              <div className="flex items-center space-x-1 text-sm">
                                {item._trend > 0 ? (
                                  <TrendingUp className="h-3 w-3 text-accent-mid-red" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 text-accent-mid-green" />
                                )}
                                <span className={item._trend > 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}>
                                  {Math.abs(item._trend).toFixed(1)}%
                                </span>
                              </div>
                            ) : (
                              <div className="text-xs text-functional-mid-grey">异常单</div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {isFallback && (
                            <div className="text-sm text-functional-mid-grey">
                              {item._description}
                            </div>
                          )}
                          <Progress
                            value={
                              maxCount > 0
                                ? Math.min((count / maxCount) * 100, 100)
                                : 0
                            }
                            className="h-2"
                          />

                          {/* 🔥 快递商占比详情 - 使用真实数据 */}
                          {carrierBreakdown.length > 0 ? (
                            <div className="mt-3 p-2 bg-functional-bright-grey rounded border border-functional-light-grey">
                              <div className="text-xs text-functional-mid-grey mb-2">快递商占比分布</div>
                              <div className="grid grid-cols-2 gap-2">
                                {carrierBreakdown.map((carrier: any, ci: number) => {
                                  const cName = carrier.carrierName || '未知';
                                  const cCount = carrier.exceptionCount || 0;
                                  const cPct =
                                    totalForReason > 0
                                      ? ((cCount / totalForReason) * 100).toFixed(1)
                                      : '0.0';
                                  const colors = carrierColorMap[cName] || defaultCarrierColor;

                                  return (
                                    <div key={`non-carrier-${name}-${cName}-${ci}`} className="flex items-center justify-between">
                                      <div className="flex items-center space-x-1">
                                        <div
                                          className={`w-3 h-3 ${colors.dot} rounded-full border flex items-center justify-center`}
                                        >
                                          <span className="text-xs">{colors.emoji}</span>
                                        </div>
                                        <span className="text-xs text-functional-mid-grey">{cName}</span>
                                      </div>
                                      <div className="text-xs font-medium text-maersk-black">
                                        {cCount} 单 ({cPct}%)
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* 占比进度条 */}
                              <div className="mt-2 flex h-1 bg-functional-light-grey rounded overflow-hidden">
                                {carrierBreakdown.map((carrier: any, ci: number) => {
                                  const cName = carrier.carrierName || '未知';
                                  const cCount = carrier.exceptionCount || 0;
                                  const cPct =
                                    totalForReason > 0 ? (cCount / totalForReason) * 100 : 0;
                                  const colors = carrierColorMap[cName] || defaultCarrierColor;
                                  return (
                                    <div
                                      key={`non-bar-${name}-${cName}-${ci}`}
                                      className={colors.bar}
                                      style={{ width: `${cPct}%` }}
                                    ></div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : isFallback ? (
                            <div className="mt-3 p-2 bg-functional-bright-grey rounded border border-functional-light-grey">
                              <div className="text-xs text-functional-mid-grey mb-2">快递商占比分布</div>
                              <div className="grid grid-cols-2 gap-2">
                                {/* 回退数据：固定比例 */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-accent-bright-green rounded-full border border-accent-light-green flex items-center justify-center">
                                      <span className="text-xs">🚀</span>
                                    </div>
                                    <span className="text-xs text-functional-mid-grey">顺丰</span>
                                  </div>
                                  <div className="text-xs font-medium text-maersk-black">
                                    {safeRound(count * 0.42)} 单 (42%)
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-1">
                                    <div className="w-3 h-3 bg-functional-bright-blue rounded-full border border-functional-light-blue flex items-center justify-center">
                                      <span className="text-xs">🚚</span>
                                    </div>
                                    <span className="text-xs text-functional-mid-grey">中通</span>
                                  </div>
                                  <div className="text-xs font-medium text-maersk-black">
                                    {safeRound(count * 0.58)} 单 (58%)
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 flex h-1 bg-functional-light-grey rounded overflow-hidden">
                                <div className="bg-accent-mid-green" style={{ width: '42%' }}></div>
                                <div className="bg-functional-mid-blue" style={{ width: '58%' }}></div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
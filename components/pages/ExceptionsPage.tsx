import { useState } from "react";
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
  Archive
} from "lucide-react";
import { FilteredData } from "../../utils/dataFilter";

interface ExceptionsPageProps {
  data: FilteredData;
  selectedBrand: string;
}

export function ExceptionsPage({ data, selectedBrand }: ExceptionsPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedResponsibility, setSelectedResponsibility] = useState<string>("all");

  // 计算基础异常数量 - 添加安全检查避免NaN
  const totalExceptions = data.courierData.reduce(
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
          count: data.courierData.reduce((sum, c) => sum + safeReduce(c, 'notShippedOver12h'), 0),
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
          count: data.courierData.reduce((sum, c) => sum + safeReduce(c, 'notDeliveredOver3days'), 0),
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
  const courierResponsibleCount = exceptionsByResponsibility[0].exceptions.reduce((sum, ex) => sum + (ex.count || 0), 0);
  const nonCourierResponsibleCount = exceptionsByResponsibility[1].exceptions.reduce((sum, ex) => sum + (ex.count || 0), 0);
  const actualTotal = courierResponsibleCount + nonCourierResponsibleCount;
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
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-functional-mid-grey" />
            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue placeholder="严重程度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="high">高</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedResponsibility} onValueChange={setSelectedResponsibility}>
              <SelectTrigger className="w-28 h-8 text-sm">
                <SelectValue placeholder="责任方" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="courier">快递方</SelectItem>
                <SelectItem value="non-courier">非快递方</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              <div className="p-2 bg-accent-bright-orange rounded-full">
                <Timer className="h-4 w-4 text-accent-dark-orange" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-accent-dark-orange">{highPriorityCount || 0}</div>
                <div className="text-sm text-functional-mid-grey">高优先级</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-accent-bright-green rounded-full">
                <CheckCircle className="h-4 w-4 text-accent-dark-green" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-accent-dark-green">{processedCount || 0}</div>
                <div className="text-sm text-functional-mid-grey">已处理</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-functional-bright-blue rounded-full">
                <AlertCircle className="h-4 w-4 text-functional-dark-blue" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-functional-dark-blue">{processingRate || 0}%</div>
                <div className="text-sm text-functional-mid-grey">处理率</div>
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
                  45%
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-functional-mid-grey">占比:</span>
                <span className="font-medium text-maersk-black">45%</span>
              </div>
              <Progress value={45} className="h-2" />
              <div className="text-xs text-functional-mid-grey">
                主要包括物流运输、中转处理、末端配送环节的服务问题，涵盖超时未揽收、超时未发运、超48h未更新、超时未签收等时效性异常监控
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
                  55%
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-functional-mid-grey">占比:</span>
                <span className="font-medium text-maersk-black">55%</span>
              </div>
              <Progress value={55} className="h-2" />
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
              {/* 快递商占比分析 */}
              <div className="mb-6">
                <h4 className="font-medium mb-4 text-maersk-black flex items-center space-x-2">
                  <Truck className="h-4 w-4" />
                  <span>快递商异常占比分析</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* 顺丰快递 */}
                  <div className="p-4 border border-accent-light-green rounded-lg bg-accent-bright-green bg-opacity-30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-accent-bright-green rounded-full flex items-center justify-center border border-accent-light-green">
                          <span className="text-sm">🚀</span>
                        </div>
                        <div>
                          <div className="font-medium text-maersk-black">顺丰速运</div>
                          <div className="text-xs text-functional-mid-grey">SF Express</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-accent-bright-green text-accent-dark-green border-accent-mid-green text-xs">
                        主力承运商
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-functional-mid-grey">异常数量:</span>
                        <span className="font-semibold text-maersk-black">{safeRound(courierResponsibleCount * 0.42)} 单</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-functional-mid-grey">占比:</span>
                        <span className="font-semibold text-accent-dark-green">42%</span>
                      </div>
                      <Progress value={42} className="h-2" />
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-functional-mid-grey">环比:</span>
                          <div className="flex items-center space-x-1 text-accent-mid-green">
                            <TrendingDown className="h-3 w-3" />
                            <span className="font-medium">2.8%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 中通快递 */}
                  <div className="p-4 border border-functional-light-blue rounded-lg bg-functional-bright-blue bg-opacity-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-functional-bright-blue rounded-full flex items-center justify-center border border-functional-light-blue">
                          <span className="text-sm">🚚</span>
                        </div>
                        <div>
                          <div className="font-medium text-maersk-black">中通快递</div>
                          <div className="text-xs text-functional-mid-grey">ZTO Express</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-mid-blue text-xs">
                        主力承运商
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-functional-mid-grey">异常数量:</span>
                        <span className="font-semibold text-maersk-black">{safeRound(courierResponsibleCount * 0.58)} 单</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-functional-mid-grey">占比:</span>
                        <span className="font-semibold text-functional-dark-blue">58%</span>
                      </div>
                      <Progress value={58} className="h-2" />
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-functional-mid-grey">环比:</span>
                          <div className="flex items-center space-x-1 text-accent-mid-red">
                            <TrendingUp className="h-3 w-3" />
                            <span className="font-medium">1.5%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 快递商对比总结 */}
                <div className="p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
                    <div>
                      <div className="font-semibold text-maersk-black">{courierResponsibleCount || 0}</div>
                      <div className="text-xs text-functional-mid-grey">快递责任异常总数</div>
                    </div>
                    <div>
                      <div className="font-semibold text-accent-dark-green">顺丰42%</div>
                      <div className="text-xs text-functional-mid-grey">异常占比较低</div>
                    </div>
                    <div>
                      <div className="font-semibold text-functional-dark-blue">中通58%</div>
                      <div className="text-xs text-functional-mid-grey">异常占比较高</div>
                    </div>
                    <div>
                      <div className="font-semibold text-maersk-blue">81%</div>
                      <div className="text-xs text-functional-mid-grey">整体处理率</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 异常类型详情 */}
              <div>
                <h4 className="font-medium mb-4 text-maersk-black">异常类型详情</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exceptionsByResponsibility[0].exceptions.map((exception, index) => (
                    <div key={index} className="p-4 border border-accent-light-red rounded-lg hover:bg-accent-bright-red hover:bg-opacity-30 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="p-1 bg-accent-bright-red rounded">
                            {exception.icon}
                          </div>
                          <div>
                            <div className="font-medium text-maersk-black">{exception.type}</div>
                            <Badge 
                              variant={
                                exception.severity === 'high' ? 'destructive' : 
                                exception.severity === 'medium' ? 'secondary' : 'outline'
                              }
                              className="text-xs mt-1"
                            >
                              {exception.severity === 'high' ? '高' : exception.severity === 'medium' ? '中' : '低'}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-semibold text-maersk-black">
                            {exception.count || 0}
                          </div>
                          <div className="flex items-center space-x-1 text-sm">
                            {exception.trend > 0 ? (
                              <TrendingUp className="h-3 w-3 text-accent-mid-red" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-accent-mid-green" />
                            )}
                            <span className={exception.trend > 0 ? "text-accent-mid-red" : "text-accent-mid-green"}>
                              {Math.abs(exception.trend).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-functional-mid-grey">
                          {exception.description}
                        </div>
                        <Progress 
                          value={Math.min((exception.count / Math.max(...exceptionsByResponsibility[0].exceptions.map(e => e.count))) * 100, 100)} 
                          className="h-2"
                        />
                        
                        {/* 快递商��比详情 */}
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
                                {safeRound(exception.count * 0.42)} 单 (42%)
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
                                {safeRound(exception.count * 0.58)} 单 (58%)
                              </div>
                            </div>
                          </div>
                          
                          {/* 占比进度条 */}
                          <div className="mt-2 flex h-1 bg-functional-light-grey rounded overflow-hidden">
                            <div 
                              className="bg-accent-mid-green" 
                              style={{ width: '42%' }}
                            ></div>
                            <div 
                              className="bg-functional-mid-blue" 
                              style={{ width: '58%' }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exceptionsByResponsibility[1].exceptions.map((exception, index) => (
                  <div key={index} className="p-4 border border-functional-light-blue rounded-lg hover:bg-functional-bright-blue hover:bg-opacity-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="p-1 bg-functional-bright-blue rounded">
                          {exception.icon}
                        </div>
                        <div>
                          <div className="font-medium text-maersk-black">{exception.type}</div>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge 
                              variant={
                                exception.severity === 'high' ? 'destructive' : 
                                exception.severity === 'medium' ? 'secondary' : 'outline'
                              }
                              className="text-xs"
                            >
                              {exception.severity === 'high' ? '高' : exception.severity === 'medium' ? '中' : '低'}
                            </Badge>
                            {exception.responsibility && (
                              <Badge variant="outline" className="text-xs bg-functional-bright-grey text-functional-dark-grey">
                                {exception.responsibility}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-maersk-black">
                          {exception.count || 0}
                        </div>
                        <div className="flex items-center space-x-1 text-sm">
                          {exception.trend > 0 ? (
                            <TrendingUp className="h-3 w-3 text-accent-mid-red" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-accent-mid-green" />
                          )}
                          <span className={exception.trend > 0 ? "text-accent-mid-red" : "text-accent-mid-green"}>
                            {Math.abs(exception.trend).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-functional-mid-grey">
                        {exception.description}
                      </div>
                      <Progress 
                        value={Math.min((exception.count / Math.max(...exceptionsByResponsibility[1].exceptions.map(e => e.count))) * 100, 100)} 
                        className="h-2"
                      />
                      
                      {/* 快递商占比详情 - 非快递责任异常也显示快递商分布 */}
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
                              {safeRound(exception.count * 0.42)} 单 (42%)
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
                              {safeRound(exception.count * 0.58)} 单 (58%)
                            </div>
                          </div>
                        </div>
                        
                        {/* 占比进度条 */}
                        <div className="mt-2 flex h-1 bg-functional-light-grey rounded overflow-hidden">
                          <div 
                            className="bg-accent-mid-green" 
                            style={{ width: '42%' }}
                          ></div>
                          <div 
                            className="bg-functional-mid-blue" 
                            style={{ width: '58%' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import React, { useState, useMemo, useRef, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopToolbar } from "./components/TopToolbar";
import { FilterPanel } from "./components/FilterPanel";
import { OverviewDashboard } from "./components/pages/OverviewDashboard";
import { LogisticsPage } from "./components/pages/LogisticsPage";
import { RegionalPage } from "./components/pages/RegionalPage";
import { ExceptionsPage } from "./components/pages/ExceptionsPage";
import { TrendsPage } from "./components/pages/TrendsPage";
import { WeightAnalysisPage } from "./components/pages/WeightAnalysisPage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Label } from "./components/ui/label";
import { Info, Package, TrendingUp, TrendingDown, X, Maximize2, Minimize2 } from "lucide-react";
import { orderKPIData, OrderKPIData } from "./data/orderData";
import { filterData } from "./utils/dataFilter";
import { getBrandPlatformCrossAnalysis, getPlatformKPIData, platformsData } from "./data/platformData";
import { CrossAnalysisChart } from "./components/CrossAnalysisChart";
import { getCurrentFiscalMonth } from "./utils/dateUtils";

export default function App() {
  const [activeMenu, setActiveMenu] = useState("overview-dashboard");
  const [dateRange, setDateRange] = useState({ from: "2025-01-01", to: "2025-12-31" });
  
  // 主内容区域滚动容器的引用
  const mainContentRef = useRef<HTMLDivElement>(null);
  
  // 地域分析专用的日期范围状态
  const [regionalDateRange, setRegionalDateRange] = useState(() => getCurrentFiscalMonth());

  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [filters, setFilters] = useState({});
  const [selectedKPI, setSelectedKPI] = useState<OrderKPIData | null>(null);
  
  // 添加KPI详情弹窗中当前选中标签页的状态
  const [activeKPITab, setActiveKPITab] = useState("brand");

  // 物流监控异常联动状态 - 修改为物流监控专用
  const [logisticsExceptionFilter, setLogisticsExceptionFilter] = useState<{
    type?: string;
    brand?: string;
    courier?: string;
  }>({});

  // 使用新的综合筛选函数
  const filteredData = useMemo(() => {
    return filterData(selectedBrand, selectedPlatform);
  }, [selectedBrand, selectedPlatform]);

  // 获取品牌×平台交叉分析数据
  const brandPlatformData = useMemo(() => {
    return getBrandPlatformCrossAnalysis(selectedBrand, selectedPlatform);
  }, [selectedBrand, selectedPlatform]);

  // 获取平台KPI数据
  const platformKPIData = useMemo(() => {
    return getPlatformKPIData(selectedPlatform);
  }, [selectedPlatform]);

  const handleDateRangeChange = (from: string, to: string) => {
    setDateRange({ from, to });
    console.log("Global date range changed:", { from, to });
  };

  // 地域分析专用日期范围变更处理
  const handleRegionalDateRangeChange = (from: string, to: string) => {
    setRegionalDateRange({ from, to });
    console.log("Regional date range changed:", { from, to });
  };

  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand);
    console.log("Brand filter changed:", brand);
  };

  const handlePlatformChange = (platform: string) => {
    setSelectedPlatform(platform);
    console.log("Platform filter changed:", platform);
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters({ ...filters, ...newFilters });
    console.log("Filters changed:", newFilters);
  };

  const handleMenuSelect = (menu: string) => {
    setActiveMenu(menu);
    console.log("Menu selected:", menu);
  };

  // 页面切换时自动滚动到顶部
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({
        top: 0,
        behavior: 'smooth' // 使用平滑滚动效果
      });
    }
  }, [activeMenu]); // 监听activeMenu变化

  const handleKPIDetailClick = (data: OrderKPIData) => {
    setSelectedKPI(data);
    setActiveKPITab("brand"); // 打开弹窗时重置到品牌标签页
  };

  // 修改异常点击处理，跳转到物流监控页面
  const handleExceptionClick = (exceptionType: string, brand?: string, courier?: string) => {
    // 设置物流监控异常筛选条件
    setLogisticsExceptionFilter({
      type: exceptionType,
      brand,
      courier
    });
    // 跳转到物流监控页面，查看全程监控
    setActiveMenu("overview-logistics");
    console.log("Exception clicked, redirecting to logistics with filter:", { exceptionType, brand, courier });
  };

  const renderPageContent = () => {
    switch (activeMenu) {
      case "overview-dashboard":
        return (
          <OverviewDashboard 
            data={filteredData}
            selectedBrand={selectedBrand}
            selectedPlatform={selectedPlatform}
            onKPIDetailClick={handleKPIDetailClick}
            onExceptionClick={handleExceptionClick}
          />
        );
      case "overview-logistics":
        return (
          <LogisticsPage 
            data={filteredData}
            selectedBrand={selectedBrand}
            exceptionFilter={logisticsExceptionFilter}
            onClearExceptionFilter={() => setLogisticsExceptionFilter({})}
          />
        );
      case "overview-regional":
        return (
          <RegionalPage 
            data={filteredData}
            selectedBrand={selectedBrand}
            dateRange={regionalDateRange}
            onDateRangeChange={handleRegionalDateRangeChange}
          />
        );
      case "overview-exceptions":
        return (
          <ExceptionsPage 
            data={filteredData}
            selectedBrand={selectedBrand}
          />
        );
      case "overview-trends":
        return (
          <TrendsPage 
            data={filteredData}
            selectedBrand={selectedBrand}
          />
        );
      case "overview-weight":
        return (
          <WeightAnalysisPage 
            data={filteredData}
            selectedBrand={selectedBrand}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
          />
        );
      case "kpi":
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">KPI Dashboard</h2>
            <p className="text-muted-foreground">KPI Dashboard 功能开发中...</p>
          </div>
        );
      case "schedules":
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">Schedules</h2>
            <p className="text-muted-foreground">Schedules 功能开发中...</p>
          </div>
        );
      case "fulfillment":
        return (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">myFulfillment</h2>
            <p className="text-muted-foreground">myFulfillment 功能开发中...</p>
          </div>
        );
      default:
        return (
          <OverviewDashboard 
            data={filteredData}
            selectedBrand={selectedBrand}
            selectedPlatform={selectedPlatform}
            onKPIDetailClick={handleKPIDetailClick}
          />
        );
    }
  };

  const getPageTitle = () => {
    switch (activeMenu) {
      case "overview-dashboard":
        return "订单总览";
      case "overview-logistics":
        return "物流监控";
      case "overview-regional":
        return "地域分析";
      case "overview-exceptions":
        return "异常监控";
      case "overview-trends":
        return "趋势分析";
      case "overview-weight":
        return "重量分析";
      default:
        return "订单数据看板";
    }
  };

  // 获取当前选中的平台信息
  const currentPlatform = selectedPlatform ? platformsData.find(p => p.name === selectedPlatform) : null;

  // 确定当前页面使用的日期范围
  const getCurrentDateRange = () => {
    if (activeMenu === "overview-regional") {
      return regionalDateRange;
    }
    return dateRange;
  };

  const currentDateRange = getCurrentDateRange();

  // 渲染交叉分析全屏视图
  const renderCrossAnalysisFullscreen = () => {
    return (
      <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm">
        <div className="fixed inset-2 z-50 bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col">
          {/* 全屏模式顶部工具栏 */}
          <div className="flex-shrink-0 bg-functional-dark-blue text-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-lg">{selectedKPI?.icon}</span>
                <h2 className="text-lg font-medium">{selectedKPI?.label} - 交叉分析</h2>
                {selectedBrand && selectedPlatform && (
                  <Badge variant="outline" className="bg-maersk-blue text-white border-white/30">
                    {selectedBrand} × {currentPlatform?.displayName}
                  </Badge>
                )}
                <Badge variant="outline" className="bg-functional-mid-blue text-white border-white/30">
                  🔄 全屏交叉分析
                </Badge>
                {selectedKPI && (
                  <Badge variant="outline" className="bg-accent-mid-teal text-white border-white/30">
                    当前指标: {selectedKPI.label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setActiveKPITab("brand")}
                  className="p-2 hover:bg-functional-mid-blue rounded transition-colors"
                  title="返回标准视图"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedKPI(null);
                    setActiveKPITab("brand");
                  }}
                  className="p-2 hover:bg-accent-mid-red rounded transition-colors"
                  title="关闭弹窗"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 全屏交叉分析图表区域 */}
          <div className="flex-1 overflow-hidden bg-functional-bright-grey">
            <div className="h-full p-4">
              <CrossAnalysisChart 
                selectedBrand={selectedBrand}
                selectedPlatform={selectedPlatform}
                selectedKPI={selectedKPI?.label}
              />
            </div>
          </div>

          {/* 全屏模式底部状态栏 */}
          <div className="flex-shrink-0 bg-functional-bright-grey border-t border-functional-light-grey px-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4 text-functional-mid-grey">
                <span>🔍 全屏交叉分析模式</span>
                <span>热力图自动适应窗口大小</span>
              </div>
              <div className="flex items-center space-x-4 text-functional-mid-grey">
                <span>ESC键快速退出</span>
                <span className="text-maersk-blue">Maersk © 2025</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 监听ESC键退出全屏
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeKPITab === 'cross') {
        setActiveKPITab('brand');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeKPITab]);

  return (
    <div className="h-screen flex bg-functional-bright-grey">
      {/* 左侧导航栏 */}
      <Sidebar onMenuSelect={handleMenuSelect} />
      
      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部工具栏 - 地域分析页面不显示，因为有自己的日期选择器 */}
        {activeMenu !== "overview-regional" && (
          <TopToolbar
            onDateRangeChange={handleDateRangeChange}
            onBrandChange={handleBrandChange}
            onPlatformChange={handlePlatformChange}
            selectedBrand={selectedBrand}
            selectedPlatform={selectedPlatform}
            activeMenu={activeMenu}
          />
        )}
        
        {/* 品牌选择工具栏 - 地域分析页面简化版 */}
        {activeMenu === "overview-regional" && (
          <div className="h-12 bg-white border-b border-functional-light-grey flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-medium text-black">地域分析</h2>
            </div>
            <div className="flex items-center space-x-4">
              {/* 品牌筛选器 */}
              <div className="flex items-center space-x-2">
                <Label className="text-sm text-functional-mid-grey whitespace-nowrap">品牌筛选:</Label>
                <Select value={selectedBrand || "all"} onValueChange={handleBrandChange}>
                  <SelectTrigger className="w-32 h-8 text-sm border-functional-light-grey">
                    <SelectValue placeholder="选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部品牌</SelectItem>
                    {['TNF', 'DICKIES', 'VANS', 'TIMBERLAND', 'ICEBREAKER', 'KIPLING'].map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
        
        {/* 筛选面板 - 地域分析页面和重量分析页面不显示 */}
        {!activeMenu.startsWith("overview-regional") && activeMenu !== "overview-weight" && (
          <FilterPanel onFilterChange={handleFilterChange} />
        )}
        
        {/* 主要内容 */}
        <div 
          ref={mainContentRef}
          className="flex-1 overflow-auto bg-functional-bright-grey"
        >
          <div className="p-6 space-y-6">
            {/* 筛选提示 - 只有总览界面显示平台筛选 */}
            {(selectedBrand || (selectedPlatform && activeMenu === "overview-dashboard")) && (
              <div className="maersk-alert-info p-4">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-functional-dark-blue mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-functional-dark-blue">
                      当前筛选条件: 
                      {selectedBrand && <Badge variant="outline" className="ml-1 mr-1 maersk-badge-secondary">品牌: {selectedBrand}</Badge>}
                      {selectedPlatform && activeMenu === "overview-dashboard" && <Badge variant="outline" className="ml-1 maersk-badge-secondary">平台: {currentPlatform?.displayName}</Badge>}
                      {" "}所有图表和统计都已根据筛选条件进行过滤。
                      {selectedBrand && selectedPlatform && activeMenu === "overview-dashboard" && (
                        <span className="ml-2 text-maersk-blue font-medium">
                          📊 已应用品牌×平台联合筛选
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 异常筛选提示 - 物流监控页面显示 */}
            {activeMenu === "overview-logistics" && logisticsExceptionFilter.type && (
              <div className="maersk-alert-warning p-4">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-accent-dark-orange mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-accent-dark-orange">
                      <strong>异常监控筛选激活</strong>: 
                      <Badge variant="outline" className="ml-2 mr-1 bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange">
                        异常类型: {
                          logisticsExceptionFilter.type === 'pickup_timeout' ? '超时未揽收' :
                          logisticsExceptionFilter.type === 'shipping_timeout' ? '超时未发运' :
                          logisticsExceptionFilter.type === 'delivery_timeout' ? '超时未签收' : 
                          logisticsExceptionFilter.type
                        }
                      </Badge>
                      {logisticsExceptionFilter.brand && (
                        <Badge variant="outline" className="mr-1 bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange">
                          品牌: {logisticsExceptionFilter.brand}
                        </Badge>
                      )}
                      {logisticsExceptionFilter.courier && (
                        <Badge variant="outline" className="mr-1 bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange">
                          快递商: {logisticsExceptionFilter.courier}
                        </Badge>
                      )}
                      物流监控已聚焦显示相关异常订单的全程监控详情。
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 页面内容 */}
            {renderPageContent()}
            
            {/* 状态信息栏 */}
            <div className="maersk-card p-4">
              <div className="flex items-center justify-between text-sm text-functional-mid-grey">
                <div className="flex items-center space-x-4">
                  <span>当前页面: {getPageTitle()}</span>
                  <span>时间范围: {currentDateRange.from} 至 {currentDateRange.to}</span>
                  {selectedBrand && <span>品牌筛选: {selectedBrand}</span>}
                  {selectedPlatform && activeMenu === "overview-dashboard" && <span>平台筛选: {currentPlatform?.displayName}</span>}
                  {activeMenu === "overview-regional" && <span>🗺️ 地图交互已启用</span>}
                  {activeMenu === "overview-weight" && <span>📊 重量分析已启用</span>}
                  {activeMenu === "overview-logistics" && logisticsExceptionFilter.type && (
                    <span className="text-accent-mid-orange font-medium">⚠️ 异常监控激活</span>
                  )}
                  {selectedBrand && selectedPlatform && activeMenu === "overview-dashboard" && (
                    <span className="text-maersk-blue font-medium">🔗 联合筛选激活</span>
                  )}
                </div>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-accent-mid-green rounded-full animate-pulse"></div>
                    <span>实时数据</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>异常监控:</span>
                    <span className="text-accent-mid-orange font-medium">
                      {Math.round(390 * filteredData.brandStats.marketShare / 100)} 单
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span>数据状态:</span>
                    <span className="text-accent-mid-green font-medium">正常</span>
                  </div>
                  {activeMenu === "overview-regional" && (
                    <div className="flex items-center space-x-2">
                      <span>地图覆盖:</span>
                      <span className="text-maersk-blue font-medium">34省份</span>
                    </div>
                  )}
                  {activeMenu === "overview-weight" && (
                    <div className="flex items-center space-x-2">
                      <span>重量区间:</span>
                      <span className="text-maersk-blue font-medium">8个档次</span>
                    </div>
                  )}
                  {activeMenu === "overview-logistics" && (
                    <div className="flex items-center space-x-2">
                      <span>物流节点:</span>
                      <span className="text-maersk-blue font-medium">全程监控</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <span>Maersk</span>
                    <span className="text-maersk-blue font-medium">© 2025</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI详情弹窗 - 标准模式和全屏模式 */}
      {selectedKPI && activeKPITab === 'cross' ? (
        // 交叉分析全屏模式
        renderCrossAnalysisFullscreen()
      ) : (
        // 标准弹窗模式
        <Dialog open={!!selectedKPI} onOpenChange={() => {
          setSelectedKPI(null);
          setActiveKPITab("brand");
        }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden maersk-card">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="flex items-center space-x-2 text-black">
                <span>{selectedKPI?.icon}</span>
                <span>{selectedKPI?.label} - 详细分析</span>
                {selectedBrand && selectedPlatform && (
                  <Badge variant="outline" className="ml-2 bg-functional-bright-blue text-maersk-blue border-maersk-blue">
                    {selectedBrand} × {currentPlatform?.displayName}
                  </Badge>
                )}
                {/* 显示当前标签页状态 */}
                <Badge variant="outline" className="ml-2 text-xs">
                  {activeKPITab === "brand" && "📊 品牌分析"}
                  {activeKPITab === "platform" && "🏪 平台分析"}
                  {activeKPITab === "cross" && "🔄 交叉分析"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-functional-mid-grey">
                综合分析 {selectedKPI?.label} 指标的品牌分布、平台表现和交叉分析数据
                {selectedBrand && selectedPlatform && (
                  <span className="text-maersk-blue ml-2">（当前显示联合筛选结果）</span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden flex flex-col">
              <Tabs value={activeKPITab} onValueChange={setActiveKPITab} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-3 bg-functional-bright-grey flex-shrink-0">
                  <TabsTrigger value="brand" className="text-black">品牌分析</TabsTrigger>
                  <TabsTrigger value="platform" className="text-black">平台分析</TabsTrigger>
                  <TabsTrigger 
                    value="cross" 
                    className="text-black flex items-center space-x-1"
                  >
                    <span>交叉分析</span>
                    <Maximize2 className="h-3 w-3" />
                  </TabsTrigger>
                </TabsList>
                
                <div className="flex-1 overflow-hidden">
                  {/* 按品牌分析 */}
                  <TabsContent value="brand" className="space-y-4 p-1 h-full overflow-auto">
                    {selectedKPI?.details?.brands && selectedKPI.details.brands.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium text-black">VF子品牌分布详情</h4>
                          <div className="bg-functional-bright-blue px-3 py-1 rounded-lg border border-functional-light-blue">
                            <span className="text-sm text-maersk-blue">共 {selectedKPI.details.brands.length} 个子品牌</span>
                            {selectedPlatform && (
                              <span className="text-xs text-functional-mid-grey ml-2">
                                （{currentPlatform?.displayName}平台数据）
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                          {selectedKPI.details.brands.map((brand, index) => {
                            // 获取品牌图标
                            const getBrandIcon = (brandName: string) => {
                              const brandIcons = {
                                'TNF': '🏔️',
                                'DICKIES': '👔',
                                'VANS': '👟',
                                'TIMBERLAND': '🥾',
                                'ICEBREAKER': '🧊',
                                'KIPLING': '🎒'
                              };
                              return brandIcons[brandName] || '🏷️';
                            };

                            // 如果有平台筛选，调整品牌数据
                            const adjustedValue = selectedPlatform ? 
                              Math.round(brand.value * (currentPlatform?.marketShare || 100) / 100) :
                              brand.value;

                            // 对于时长类指标，显示时长而不是数量
                            const isTimeMetric = selectedKPI.label.includes('时长');
                            const displayValue = isTimeMetric ? 
                              `${brand.value}${selectedKPI.label.includes('首派') ? '小时' : '天'}` :
                              adjustedValue.toLocaleString();
                            
                            const displayPercentage = isTimeMetric ?
                              `${brand.percentage.toFixed(1)}%相对表现` :
                              `${((adjustedValue / filteredData.brandStats.totalOrders) * 100).toFixed(1)}%`;

                            return (
                              <div key={index} className="flex flex-col p-3 border border-functional-light-grey rounded-lg hover:bg-functional-bright-grey transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-7 h-7 bg-functional-bright-blue rounded-full flex items-center justify-center border border-functional-light-blue">
                                      <span className="text-sm">{getBrandIcon(brand.name)}</span>
                                    </div>
                                    <div className="font-medium text-black text-sm">{brand.name}</div>
                                  </div>
                                  {isTimeMetric && brand.percentage < 100 && (
                                    <Badge variant="outline" className="bg-accent-bright-green text-accent-dark-green border-accent-mid-green text-xs">
                                      优于平均
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-center">
                                  <div className="font-semibold text-black text-lg">{displayValue}</div>
                                  <div className="text-xs text-functional-mid-grey">
                                    {displayPercentage}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* 异常监控 - 只在有异常数据时显示 */}
                        {selectedKPI.details.exceptions && selectedKPI.details.exceptions.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-3 text-black">异常监控</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {selectedKPI.details.exceptions.map((exception, index) => {
                                // 根据平台筛选调整异常数量
                                const adjustedCount = selectedPlatform ? 
                                  Math.round(exception.count * (currentPlatform?.marketShare || 100) / 100) :
                                  exception.count;
                                  
                                return (
                                  <div key={index} className="flex justify-between items-center p-3 maersk-alert-warning">
                                    <div>
                                      <div className="font-medium text-accent-dark-orange">{exception.type}</div>
                                      <div className="text-sm text-accent-mid-orange">阈值: {exception.threshold}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-lg font-semibold text-accent-dark-orange">
                                        {adjustedCount}
                                      </div>
                                      <div className="text-xs text-accent-mid-orange">异常数量</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 当没有异常监控数据时的提示 */}
                        {(!selectedKPI.details.exceptions || selectedKPI.details.exceptions.length === 0) && (
                          <div className="p-4 bg-functional-bright-grey rounded-lg text-center border border-functional-light-grey">
                            <div className="text-sm text-functional-mid-grey">
                              📊 当前指标 "{selectedKPI.label}" 不涉及时效性异常监控
                            </div>
                            {selectedKPI.details.status && (
                              <div className="text-xs text-functional-mid-grey mt-1">
                                状态: {selectedKPI.details.status}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-functional-mid-grey">
                        <div className="mb-4">
                          <Package className="h-12 w-12 mx-auto opacity-30" />
                        </div>
                        <h4 className="font-medium mb-2 text-black">暂无品牌分布数据</h4>
                        <p className="text-sm">当前KPI指标 "{selectedKPI?.label}" 没有品牌分布统计数据</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* 按平台分析 */}
                  <TabsContent value="platform" className="space-y-4 p-1 h-full overflow-auto">
                    <div>
                      <h4 className="font-medium mb-3 text-black">
                        平台表现分析
                        {selectedPlatform && (
                          <span className="text-sm text-maersk-blue ml-2">
                            （当前筛选：{currentPlatform?.displayName}）
                          </span>
                        )}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {platformKPIData.map((platform, index) => {
                          const platformInfo = platformsData.find(p => p.name === platform.platform);
                          const kpiValue = platform.kpiData[selectedKPI?.label === '已揽收' ? 'picked' : 
                                                           selectedKPI?.label === '已发运' ? 'shipped' :
                                                           selectedKPI?.label === '已签收' ? 'delivered' :
                                                           selectedKPI?.label === '已转寄' ? 'forwarded' :
                                                           selectedKPI?.label === '已退回' ? 'returned' :
                                                           selectedKPI?.label === '已取消' ? 'cancelled' : 
                                                           selectedKPI?.label === '首派成功率' ? 'delivered' :
                                                           selectedKPI?.label === '平均首派时长' ? 'delivered' :
                                                           selectedKPI?.label === '平均签收时长' ? 'delivered' : 'delivered'];
                          
                          // 如果已选择平台，只显示当前平台，否则显示所有平台
                          if (selectedPlatform && platform.platform !== selectedPlatform) {
                            return null;
                          }
                          
                          return (
                            <div key={index} className="p-4 border border-functional-light-grey rounded-lg hover:bg-functional-bright-grey transition-colors">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">{platformInfo?.logo}</span>
                                  <span className="font-medium text-black">{platformInfo?.displayName}</span>
                                  {selectedPlatform === platform.platform && (
                                    <Badge variant="default" className="text-xs maersk-badge-primary">当前筛选</Badge>
                                  )}
                                </div>
                                <Badge 
                                  variant="outline" 
                                  style={{ borderColor: platformInfo?.color, color: platformInfo?.color }}
                                  className="bg-white"
                                >
                                  {platformInfo?.marketShare}% 市场份额
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-functional-mid-grey">数据值:</span>
                                  <span className="font-semibold text-black">
                                    {selectedKPI?.label.includes('时长') ? 
                                      `${kpiValue.value.toLocaleString()}${selectedKPI.label.includes('首派') ? '小时' : '天'}` :
                                      selectedKPI?.label === '首派成功率' ? 
                                      `${kpiValue.value.toLocaleString()}%` :
                                      kpiValue.value.toLocaleString()
                                    }
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="flex items-center space-x-1">
                                    <span className="text-functional-mid-grey">环比:</span>
                                    <div className={`flex items-center space-x-1 ${kpiValue.change.mom >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                                      {kpiValue.change.mom >= 0 ? (
                                        <TrendingUp className="h-3 w-3" />
                                      ) : (
                                        <TrendingDown className="h-3 w-3" />
                                      )}
                                      <span>{Math.abs(kpiValue.change.mom).toFixed(2)}%</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <span className="text-functional-mid-grey">同比:</span>
                                    <div className={`flex items-center space-x-1 ${kpiValue.change.yoy >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'}`}>
                                      {kpiValue.change.yoy >= 0 ? (
                                        <TrendingUp className="h-3 w-3" />
                                      ) : (
                                        <TrendingDown className="h-3 w-3" />
                                      )}
                                      <span>{Math.abs(kpiValue.change.yoy).toFixed(2)}%</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {selectedPlatform && (
                        <div className="mt-4 p-3 maersk-alert-info text-sm">
                          📊 当前仅显示 {currentPlatform?.displayName} 平台的数据，清除平台筛选可查看所有平台对比
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
            
            {/* 趋势数据 - 固定在底部 */}
            <div className="flex-shrink-0 grid grid-cols-2 gap-4 pt-4 border-t border-functional-light-grey">
              <div className="text-center">
                <div className="text-sm text-functional-mid-grey mb-1">环比变化</div>
                <div className="flex items-center justify-center space-x-1">
                  {selectedKPI?.change?.mom && selectedKPI.change.mom >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-accent-mid-red" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-accent-mid-green" />
                  )}
                  <span className={`font-semibold ${
                    selectedKPI?.change?.mom && selectedKPI.change.mom >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'
                  }`}>
                    {selectedKPI?.change?.mom ? Math.abs(selectedKPI.change.mom).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-functional-mid-grey mb-1">同比变化</div>
                <div className="flex items-center justify-center space-x-1">
                  {selectedKPI?.change?.yoy && selectedKPI.change.yoy >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-accent-mid-red" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-accent-mid-green" />
                  )}
                  <span className={`font-semibold ${
                    selectedKPI?.change?.yoy && selectedKPI.change.yoy >= 0 ? 'text-accent-mid-red' : 'text-accent-mid-green'
                  }`}>
                    {selectedKPI?.change?.yoy ? Math.abs(selectedKPI.change.yoy).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
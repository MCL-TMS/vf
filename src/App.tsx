import React, { useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopToolbar } from "./components/TopToolbar";
import { FilterPanel } from "./components/FilterPanel";
import { KPIDetailDialog } from "./components/KPIDetailDialog";
import { PageRouter } from "./components/PageRouter";
import { ExceptionFilterAlert } from "./components/ExceptionFilterAlert";
import { LoginPage } from "./components/LoginPage";
import { Badge } from "./components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Label } from "./components/ui/label";
import { Button } from "./components/ui/button";
import { Info, AlertTriangle, Clock, Package, Truck, Activity, X, LogOut } from "lucide-react";
import { useAppState } from "./hooks/useAppState";
import { createEventHandlers } from "./utils/eventHandlers";
import { getPageTitle, getCurrentDateRange, scrollToTop } from "./utils/appUtils";
import { useAuth, AuthProvider } from "./contexts/AuthContext";
import { BrandProvider } from "./contexts/BrandContext";
import { PlatformProvider } from "./contexts/PlatformContext";

import { ApiService } from "./services/apiService";
import { Toaster } from "./components/ui/sonner";

// 主应用组件（需要认证）
function AppContent() {
  // 认证相关
  const { user, isAuthenticated, logout, isLoading } = useAuth();

  const [apiConnectionStatus, setApiConnectionStatus] = React.useState<'checking' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastConnectionCheck, setLastConnectionCheck] = React.useState<Date>(new Date());
  
  const {
    activeMenu,
    setActiveMenu,
    dateRange,
    setDateRange,
    regionalDateRange,
    setRegionalDateRange,
    selectedBrand,
    setSelectedBrand,
    selectedPlatform,
    setSelectedPlatform,
    selectedSelfFlag,
    setSelectedSelfFlag,
    filters,
    setFilters,
    selectedKPI,
    setSelectedKPI,
    activeKPITab,
    setActiveKPITab,
    logisticsExceptionFilter,
    setLogisticsExceptionFilter,
    mainContentRef,
    apiLoading,
    apiError,
    refetchData,
    filteredData,
    platformKPIData,
    brandKPIData,
    hasData,
    usingApiData,
    rawApiData,
    unifiedCourierData
  } = useAppState();

  // 静默检查API连接状态 - 不在UI中显示任何API相关提示
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let isCheckingRef = { current: false };
    
    const checkApiConnection = async () => {
      if (isCheckingRef.current) {
        return;
      }
      
      isCheckingRef.current = true;
      
      try {
        const isConnected = await ApiService.quickHealthCheck();
        setApiConnectionStatus(isConnected ? 'connected' : 'disconnected');
        setLastConnectionCheck(new Date());
      } catch (error) {
        setApiConnectionStatus('error');
        setLastConnectionCheck(new Date());
      } finally {
        isCheckingRef.current = false;
      }
    };

    // 在总览和物流页面时都进行API连接检查
    if (activeMenu === 'overview-dashboard' || activeMenu === 'overview-logistics' || activeMenu === 'overview-exceptions') {
      const initialCheckTimeout = setTimeout(() => {
        checkApiConnection();
      }, 1000);
      
      intervalId = setInterval(checkApiConnection, 600000); // 10分钟检查一次
      
      return () => {
        clearTimeout(initialCheckTimeout);
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    } else {
      setApiConnectionStatus('disconnected');
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [activeMenu]);

  const eventHandlers = createEventHandlers(
    setDateRange,
    setRegionalDateRange,
    setSelectedBrand,
    setSelectedPlatform,
    setSelectedSelfFlag,
    setFilters,
    setActiveMenu,
    setSelectedKPI,
    setActiveKPITab,
    setLogisticsExceptionFilter
  );

  // Auto scroll to top when page changes
  useEffect(() => {
    scrollToTop(mainContentRef);
  }, [activeMenu]);

  // 🔐 根据用户权限初始化默认品牌选择
  useEffect(() => {
    if (!isLoading && user) {
      // 如果已经有选择的品牌，不做改变
      if (selectedBrand) return;

      // 所有用户默认选择"all"（显示他们有权限的所有品牌数据）
      setSelectedBrand('all');
    }
  }, [user, isLoading]); // 只在用户信息变化时执行

  const currentDateRange = getCurrentDateRange(activeMenu, dateRange, regionalDateRange);

  // 判断是否应该使用真实数据 - 基于API连接状态，支持总览和物流页面
  const shouldUseRealDataInApp = (
    activeMenu === 'overview-dashboard' || 
    activeMenu === 'overview-logistics' || 
    activeMenu === 'overview-exceptions'
  ) && apiConnectionStatus === 'connected';
  
  // 🔍 调试实时数据状态
  if (activeMenu === 'overview-logistics') {
    console.log('🔧 [App] 物流页面实时数据状态调试:', {
      activeMenu,
      apiConnectionStatus,
      shouldUseRealDataInApp,
      hasRawApiData: !!rawApiData,
      rawApiDataKeys: rawApiData ? Object.keys(rawApiData) : 'null'
    });
  }

  // ================= 认证检查 =================
  // 如果正在加载认证状态，显示加载界面
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-functional-bright-grey">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-maersk-blue mx-auto mb-4"></div>
          <p className="text-functional-mid-grey">正在加载...</p>
        </div>
      </div>
    );
  }

  // 如果未登录，显示登录页面
  if (!isAuthenticated) {
    return <LoginPage />;
  }
  // ================= 认证检查结束 =================

  return (
    <div className="h-screen flex bg-functional-bright-grey">
      {/* Left Sidebar */}
      <Sidebar 
        onMenuSelect={eventHandlers.handleMenuSelect} 
        activeMenu={activeMenu}
      />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Toolbar - hidden on regional page */}
        {activeMenu !== "overview-regional" && (
          <TopToolbar
            onDateRangeChange={(dateRange) => {
              eventHandlers.handleDateRangeChange(dateRange.from, dateRange.to);
            }}
            onBrandChange={eventHandlers.handleBrandChange}
            onPlatformChange={eventHandlers.handlePlatformChange}
            onSelfFlagChange={eventHandlers.handleSelfFlagChange}
            selectedBrand={selectedBrand}
            selectedPlatform={selectedPlatform}
            selectedSelfFlag={selectedSelfFlag}
            activeMenu={activeMenu}
            currentDateRange={dateRange}
          />
        )}
        
        {/* Regional Page Simplified Toolbar */}
        {activeMenu === "overview-regional" && (
          <div className="h-12 bg-white border-b border-functional-light-grey flex items-center justify-between px-6">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-medium text-black">地域分析</h2>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Label className="text-sm text-functional-mid-grey whitespace-nowrap">品牌筛选:</Label>
                <Select value={selectedBrand || "all"} onValueChange={eventHandlers.handleBrandChange}>
                  <SelectTrigger className="w-32 h-8 text-sm border-functional-light-grey">
                    <SelectValue placeholder="选择品牌" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部品牌</SelectItem>
                    {['TNF', 'DICKIES', 'VANS', 'TIMBERLAND', 'ICEBREAKER', 'SMARTWOOL'].map((brand) => (
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
        
        {/* Filter Panel - hidden on regional and weight pages */}
        {!activeMenu.startsWith("overview-regional") && activeMenu !== "overview-weight" && (
          <FilterPanel onFilterChange={eventHandlers.handleFilterChange} />
        )}
        
        {/* Main Content */}
        <div 
          ref={mainContentRef}
          className="flex-1 overflow-auto bg-functional-bright-grey"
        >
          <div className="p-6 space-y-6">
            {/* Filter Alert - only show when filters are active */}
            {(selectedBrand || selectedPlatform || (selectedSelfFlag && selectedSelfFlag !== 'Y')) && (
              <div className="maersk-alert-info p-4">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-functional-dark-blue mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-functional-dark-blue">
                      当前筛选条件: 
                      {selectedBrand && <Badge variant="outline" className="ml-1 mr-1 maersk-badge-secondary">品牌: {selectedBrand}</Badge>}
                      {selectedPlatform && <Badge variant="outline" className="ml-1 mr-1 maersk-badge-secondary">平台: {selectedPlatform === 'tmall' ? '天猫' : selectedPlatform === 'douyin' ? '抖音' : selectedPlatform === 'jd' ? '京东' : selectedPlatform === 'pdd' ? '拼多多' : selectedPlatform === 'official' ? '官网/小程序' : selectedPlatform === 'o2o' ? 'O2O' : selectedPlatform === 'xiaohongshu' ? '小红书' : selectedPlatform === 'wechat' ? '微信小程序' : selectedPlatform}</Badge>}
                      {selectedSelfFlag && selectedSelfFlag !== 'Y' && <Badge variant="outline" className="ml-1 mr-1 maersk-badge-secondary">自管: {selectedSelfFlag === 'N' ? '非自管' : selectedSelfFlag === 'all' ? '全部' : selectedSelfFlag}</Badge>}
                      {" "}所有图表和统计都已根据筛选条件进行过滤。
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Exception Filter Alert - logistics page */}
            {activeMenu === "overview-logistics" && logisticsExceptionFilter.type && (
              <ExceptionFilterAlert 
                filter={logisticsExceptionFilter}
                onClear={() => eventHandlers.handleClearExceptionFilter()}
              />
            )}

            {/* Page Content */}
            <PageRouter
              activeMenu={activeMenu}
              filteredData={filteredData}
              selectedBrand={selectedBrand}
              selectedPlatform={selectedPlatform}
              selectedSelfFlag={selectedSelfFlag}
              regionalDateRange={regionalDateRange}
              onRegionalDateRangeChange={eventHandlers.handleRegionalDateRangeChange}
              dateRange={dateRange}
              onDateRangeChange={eventHandlers.handleDateRangeChange}
              onKPIDetailClick={eventHandlers.handleKPIDetailClick}
              onExceptionClick={eventHandlers.handleExceptionClick}
              logisticsExceptionFilter={logisticsExceptionFilter}
              onClearExceptionFilter={eventHandlers.handleClearExceptionFilter}
              useRealData={shouldUseRealDataInApp}
              rawApiData={rawApiData}
              unifiedCourierData={unifiedCourierData}
              userBrands={user?.customerNos || []} // 🔥 新增：传递用户品牌权限
            />
            
            {/* Status Bar - 简化版，移除所有API状态显示 */}
            <div className="maersk-card p-4">
              <div className="flex items-center justify-between text-sm text-functional-mid-grey">
                <div className="flex items-center space-x-4">
                  <span>当前页面: {getPageTitle(activeMenu)}</span>
                  <span>时间范围: {currentDateRange.from} 至 {currentDateRange.to}</span>
                  {selectedBrand && <span>品牌筛选: {selectedBrand}</span>}
                  {selectedPlatform && <span>平台筛选: {selectedPlatform === 'tmall' ? '天猫' : selectedPlatform === 'douyin' ? '抖音' : selectedPlatform === 'jd' ? '京东' : selectedPlatform === 'pdd' ? '拼多多' : selectedPlatform === 'official' ? '官网/小程序' : selectedPlatform === 'o2o' ? 'O2O' : selectedPlatform === 'xiaohongshu' ? '小红书' : selectedPlatform === 'wechat' ? '微信小程序' : selectedPlatform}</span>}
                  {selectedSelfFlag && selectedSelfFlag !== 'Y' && <span>自管筛选: {selectedSelfFlag === 'N' ? '非自管' : selectedSelfFlag === 'all' ? '全部' : selectedSelfFlag}</span>}
                  {activeMenu === "overview-regional" && <span>🗺️ 地图交互已启用</span>}
                  {activeMenu === "overview-weight" && <span>📊 重量分析已启用</span>}
                  {activeMenu === "overview-logistics" && logisticsExceptionFilter.type && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-accent-bright-orange text-accent-dark-orange font-medium text-xs animate-pulse">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      异常监控激活
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <span>异常监控:</span>
                    <span className="text-accent-mid-orange font-medium">已启用</span>
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
                    <span className="text-maersk-blue font-medium">© 2026</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Detail Dialog */}
      <KPIDetailDialog
        selectedKPI={selectedKPI}
        activeKPITab={activeKPITab}
        setActiveKPITab={setActiveKPITab}
        onClose={eventHandlers.handleKPIDialogClose}
        selectedBrand={selectedBrand}
        platformKPIData={platformKPIData}
        brandKPIData={brandKPIData}
        filteredData={filteredData}
        rawApiData={rawApiData}
        usingApiData={usingApiData}
      />

      {/* Toast通知组件 */}
      <Toaster />
    </div>
  );
}

// 默认导出：用 AuthProvider 包裹 AppContent
export default function App() {
  return (
    <AuthProvider>
      <BrandProvider>
        <PlatformProvider>
          <AppContent />
        </PlatformProvider>
      </BrandProvider>
    </AuthProvider>
  );
}
import { OrderKPIData } from "../data/orderData";

export const createEventHandlers = (
  setDateRange: (range: { from: string; to: string }) => void,
  setRegionalDateRange: (range: { from: string; to: string }) => void,
  setSelectedBrand: (brand: string | string[] | null) => void, // 🔥 修复：支持数组
  setSelectedPlatform: (platform: string | null) => void,
  setSelectedSelfFlag: (selfFlag: string | null) => void,
  setFilters: (filters: any) => void,
  setActiveMenu: (menu: string) => void,
  setSelectedKPI: (kpi: OrderKPIData | null) => void,
  setActiveKPITab: (tab: string) => void,
  setLogisticsExceptionFilter: (filter: any) => void
) => {
  const handleDateRangeChange = (from: string, to: string) => {
    console.log("🔄 [EventHandlers] handleDateRangeChange called with:", { from, to });
    setDateRange({ from, to });
    console.log("✅ [EventHandlers] Date range state updated");
  };

  const handleRegionalDateRangeChange = (from: string, to: string) => {
    setRegionalDateRange({ from, to });
    console.log("Regional date range changed:", { from, to });
  };

  const handleBrandChange = (brand: string | string[]) => { // 🔥 修复：支持数组
    // 修复品牌筛选逻辑：如果选择"all"，则传递null给状态
    const brandValue = brand === 'all' ? null : brand;
    setSelectedBrand(brandValue);
    console.log("🏷️ [EventHandlers] Brand filter changed:", { 
      original: brand, 
      resolved: brandValue,
      isArray: Array.isArray(brand)
    });
  };

  const handlePlatformChange = (platform: string) => {
    // 修复平台筛选逻辑：如果选择"all"，则传递null给状态
    const platformValue = platform === 'all' ? null : platform;
    setSelectedPlatform(platformValue);
    console.log("🏪 [EventHandlers] Platform filter changed:", { original: platform, resolved: platformValue });
  };

  const handleSelfFlagChange = (selfFlag: string) => {
    // 自管筛选逻辑：如果选择"all"，则传递null给状态，否则保持原值
    const selfFlagValue = selfFlag === 'all' ? null : selfFlag;
    setSelectedSelfFlag(selfFlagValue);
    console.log("🔧 [EventHandlers] Self flag filter changed:", { original: selfFlag, resolved: selfFlagValue });
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters((prevFilters: any) => ({ ...prevFilters, ...newFilters }));
    console.log("Filters changed:", newFilters);
  };

  const handleMenuSelect = (menu: string) => {
    setActiveMenu(menu);
    console.log("Menu selected:", menu);
  };

  const handleKPIDetailClick = (data: OrderKPIData) => {
    setSelectedKPI(data);
    setActiveKPITab("brand");
  };

  const handleExceptionClick = (exceptionType: string, brand?: string, courier?: string) => {
    setLogisticsExceptionFilter({
      type: exceptionType,
      brand,
      courier
    });
    setActiveMenu("overview-logistics");
    console.log("Exception clicked, redirecting to logistics with filter:", { exceptionType, brand, courier });
  };

  const handleKPIDialogClose = () => {
    setSelectedKPI(null);
    setActiveKPITab("brand");
  };

  const handleClearExceptionFilter = () => {
    setLogisticsExceptionFilter({});
  };

  return {
    handleDateRangeChange,
    handleRegionalDateRangeChange,
    handleBrandChange,
    handlePlatformChange,
    handleSelfFlagChange,
    handleFilterChange,
    handleMenuSelect,
    handleKPIDetailClick,
    handleExceptionClick,
    handleKPIDialogClose,
    handleClearExceptionFilter
  };
};
export const getPageTitle = (activeMenu: string): string => {
  switch (activeMenu) {
    case "overview-dashboard":
      return "订单总览";
    case "overview-logistics":
      return "物流监控";
    case "overview-regional":
      return "地域分析";
    case "overview-platform":
      return "平台分析";
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

export const getCurrentDateRange = (activeMenu: string, dateRange: any, regionalDateRange: any) => {
  if (activeMenu === "overview-regional") {
    return regionalDateRange;
  }
  return dateRange;
};

export const scrollToTop = (mainContentRef: React.RefObject<HTMLDivElement>) => {
  if (mainContentRef.current) {
    mainContentRef.current.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
};
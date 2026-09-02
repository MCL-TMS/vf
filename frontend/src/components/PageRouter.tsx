import React from 'react';
import { OverviewDashboard } from './pages/OverviewDashboard';
import { RegionalPage } from './pages/RegionalPage';
import { WeightAnalysisPage } from './pages/WeightAnalysisPage';
import { LogisticsPage } from './pages/LogisticsPage';
import { TrendsPage } from './pages/TrendsPage';
import { ExceptionsPage } from './pages/ExceptionsPage';
import { CarrierPerformance } from './pages/CarrierPerformance';
import { CostAnalysis } from './pages/CostAnalysis';
import { CapacityPlanning } from './pages/CapacityPlanning';
import { VendorManagement } from './pages/VendorManagement';
import { FourPLTimeEfficiency } from './pages/FourPLTimeEfficiency';
import { TimeEfficiencyAnalysis } from './TimeEfficiencyAnalysis';
import { ForwardingAnalysis } from './ForwardingAnalysis';

import type { DateRange, FilteredOrderData, LogisticsExceptionFilter } from '../data/types';

interface PageRouterProps {
  activeMenu: string;
  filteredData: FilteredOrderData;
  selectedBrand: string | string[] | null;
  selectedPlatform: string | string[] | null;
  selectedSelfFlag?: string | null;
  regionalDateRange: DateRange;
  onRegionalDateRangeChange: (from: string, to: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (from: string, to: string) => void;
  onKPIDetailClick: (kpi: any) => void;
  onExceptionClick: (filter: LogisticsExceptionFilter) => void;
  onRefetchData?: () => void;
  logisticsExceptionFilter: LogisticsExceptionFilter;
  onClearExceptionFilter: () => void;
  useRealData?: boolean;
  apiLoading?: boolean;
  rawApiData?: any;
  unifiedCourierData?: any;
  userBrands?: string[]; // 🔥 新增：用户品牌权限
}

export function PageRouter({
  activeMenu,
  filteredData,
  selectedBrand,
  selectedPlatform,
  selectedSelfFlag,
  regionalDateRange,
  onRegionalDateRangeChange,
  dateRange,
  onDateRangeChange,
  onKPIDetailClick,
  onExceptionClick,
  onRefetchData,
  logisticsExceptionFilter,
  onClearExceptionFilter,
  useRealData = false,
  apiLoading = false,
  rawApiData,
  unifiedCourierData,
  userBrands // 🔥 新增：接收用户品牌权限
}: PageRouterProps) {
  const commonProps = {
    filteredData,
    selectedBrand,
    selectedPlatform,
    selectedSelfFlag,
    useRealData,
    rawApiData,
    unifiedCourierData,
    dateRange,
    userBrands // 🔥 新增：添加到commonProps
  };

  switch (activeMenu) {
    case "overview-dashboard":
      return (
        <OverviewDashboard
          {...commonProps}
          onKPIDetailClick={onKPIDetailClick}
          onExceptionClick={onExceptionClick}
          apiLoading={apiLoading}
        />
      );
      
    case "overview-regional":
      return (
        <RegionalPage
          {...commonProps}
          dateRange={regionalDateRange}
          onDateRangeChange={onRegionalDateRangeChange}
        />
      );
      
    case "overview-weight":
      return (
        <WeightAnalysisPage
          selectedBrand={selectedBrand}
          selectedPlatform={selectedPlatform}
          selectedSelfFlag={selectedSelfFlag}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
        />
      );
      

    case "overview-logistics":
      return (
        <LogisticsPage
          data={filteredData}
          selectedBrand={selectedBrand}
          selectedPlatform={selectedPlatform}  // ✅ 新增：传递platform参数
          selectedSelfFlag={selectedSelfFlag}  // ✅ 新增：传递selfFlag参数
          dateRange={dateRange}
          exceptionFilter={logisticsExceptionFilter}
          onClearExceptionFilter={onClearExceptionFilter}
          onNavigateToMonitoring={onExceptionClick}
          useRealData={useRealData}
          apiLoading={apiLoading}
          onRefetchData={onRefetchData}
          rawApiData={rawApiData}
          unifiedCourierData={unifiedCourierData}
        />
      );
      
    case "overview-trends":
      return (
        <TrendsPage
          data={filteredData}
          selectedBrand={selectedBrand}
          selectedPlatform={selectedPlatform}
          selectedSelfFlag={selectedSelfFlag}
          dateRange={dateRange}
        />
      );
      
    case "overview-exceptions":
      return (
        <ExceptionsPage
          {...commonProps}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          useRealData={useRealData}
          apiLoading={apiLoading}
        />
      );
      
    // 4PL Management 模块
    case "4pl-carrier-performance":
      return <CarrierPerformance unifiedCourierData={unifiedCourierData} />;      
    case "4pl-time-efficiency":
      return <FourPLTimeEfficiency unifiedCourierData={unifiedCourierData} />;      
    case "4pl-flow-direction":
      return (
        <ForwardingAnalysis 
          useRealData={true}
          dateRange={dateRange}
          selectedBrand={selectedBrand}
          selectedPlatform={selectedPlatform}
          selectedSelfFlag={selectedSelfFlag}
        />
      );      
    case "4pl-cost-analysis":
      return <CostAnalysis />;      
    case "4pl-capacity-planning":
      return <CapacityPlanning />;      
    case "4pl-vendor-management":
      return <VendorManagement />;
    
    default:
      return (
        <OverviewDashboard
          {...commonProps}
          onKPIDetailClick={onKPIDetailClick}
        />
      );
  }
}
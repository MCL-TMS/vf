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
import { AuthDebugger } from './AuthDebugger';

import type { DateRange, FilteredOrderData, LogisticsExceptionFilter } from '../data/types';

interface PageRouterProps {
  activeMenu: string;
  filteredData: FilteredOrderData;
  selectedBrand: string | null;
  selectedPlatform: string | null;
  selectedSelfFlag?: string | null;
  regionalDateRange: DateRange;
  onRegionalDateRangeChange: (from: string, to: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (from: string, to: string) => void;
  onKPIDetailClick: (kpi: any) => void;
  onExceptionClick: (filter: LogisticsExceptionFilter) => void;
  logisticsExceptionFilter: LogisticsExceptionFilter;
  onClearExceptionFilter: () => void;
  useRealData?: boolean;
  rawApiData?: any;
  unifiedCourierData?: any;
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
  logisticsExceptionFilter,
  onClearExceptionFilter,
  useRealData = false,
  rawApiData,
  unifiedCourierData
}: PageRouterProps) {
  const commonProps = {
    filteredData,
    selectedBrand,
    selectedPlatform,
    selectedSelfFlag,
    useRealData,
    rawApiData,
    unifiedCourierData,
    dateRange
  };

  switch (activeMenu) {
    case "overview-dashboard":
      return (
        <OverviewDashboard
          {...commonProps}
          onKPIDetailClick={onKPIDetailClick}
          onExceptionClick={onExceptionClick}
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
          {...commonProps}
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
          rawApiData={rawApiData}
          unifiedCourierData={unifiedCourierData}
        />
      );
      
    case "overview-trends":
      return (
        <TrendsPage
          {...commonProps}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
        />
      );
      
    case "overview-exceptions":
      return (
        <ExceptionsPage
          {...commonProps}
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
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
    
    // 🔧 调试工具（仅用于开发）
    case "debug-auth":
      return <AuthDebugger />;
      
    default:
      return (
        <OverviewDashboard
          {...commonProps}
          onKPIDetailClick={onKPIDetailClick}
        />
      );
  }
}
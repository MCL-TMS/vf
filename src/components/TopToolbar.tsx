import React, { useState } from "react";
import { Calendar, Upload, Download, Filter, X } from "lucide-react";
import { DatePickerWithRange } from "./ui/date-picker-with-range";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { useAuth } from '../contexts/AuthContext'; // 导入 useAuth
import { useBrand } from '../contexts/BrandContext'; // 🔥 导入 useBrand Hook
import { usePlatform } from '../contexts/PlatformContext'; // 🔥 导入 usePlatform Hook
import { exportOrderDetails as exportOrderDetailsToExcel } from '../utils/excelExport'; // 🔥 导入Excel导出函数
import { exportTimelinessRawData as exportTimelinessRawDataToExcel } from '../utils/excelExport'; // 🔥 导入时效分析RawData导出函数
import { exportOrderDetails, exportTimelinessRawData } from '../services/apiService'; // 🔥 导入API服务
import { toast } from 'sonner'; // 🔥 导入toast提示

// 🔥 平台数据类型
interface PlatformOption {
  code: string;
  name: string;
}

interface TopToolbarProps {
  onDateRangeChange: (dateRange: { from: string; to: string }) => void;
  onBrandChange: (brand: string) => void;
  onPlatformChange?: (platform: string) => void;
  onSelfFlagChange?: (selfFlag: string) => void;
  selectedBrand: string | null;
  selectedPlatform?: string | null;
  selectedSelfFlag?: string | null;
  activeMenu: string;
  currentDateRange?: { from: string; to: string };
}

export function TopToolbar({ 
  onDateRangeChange, 
  onBrandChange, 
  onPlatformChange,
  onSelfFlagChange,
  selectedBrand,
  selectedPlatform,
  selectedSelfFlag,
  activeMenu,
  currentDateRange
}: TopToolbarProps) {
  const { user } = useAuth(); // 获取用户信息
  const { brandMappings, codeToNameMap } = useBrand(); // 🔥 获取动态品牌映射
  const { platformOptions } = usePlatform(); // 🔥 获取平台选项
  const [isExporting, setIsExporting] = useState(false); // 🔥 导出状态

  // 获取用户可访问的品牌列表
  const getAccessibleBrands = (): Array<{ code: string; name: string }> => {
    if (user?.isAdmin) {
      // 🔥 管理员可查看所有品牌（从动态品牌映射获取）
      return brandMappings.map(brand => ({ code: brand.brandCode, name: brand.brandName }));
    } else if (user?.customerNos && user.customerNos.length > 0) {
      // 🔥 普通用户只能查看授权的品牌（从动态品牌映射获取）
      return user.customerNos
        .filter(code => codeToNameMap[code]) // 确保品牌代码有效
        .map(code => ({ code, name: codeToNameMap[code] }));
    }
    return [];
  };

  const accessibleBrands = getAccessibleBrands();
  const isOverviewDashboard = activeMenu === 'overview-dashboard';



  const handleDateRangeChange = (range: { from: string; to: string }) => {
    console.log('TopToolbar received date range:', range);
    if (range?.from && range?.to) {
      onDateRangeChange({
        from: range.from,
        to: range.to
      });
    }
  };

  const handleExportData = async () => {
    // 🔥 根据不同页面导出不同的数据
    console.log('🔍🔍🔍 [TopToolbar] 导出按钮被点击，当前activeMenu:', activeMenu);
    
    if (!currentDateRange || !currentDateRange.from || !currentDateRange.to) {
      toast.error('请先选择日期范围');
      return;
    }

    setIsExporting(true);
    
    try {
      // 获取用户品牌权限
      const userBrands = user?.customerNos || [];
      
      // 🔥 根据activeMenu判断导出哪种数据
      // ✅ 物流监控页面(overview-logistics)包含时效分析Tab，需要导出时效RawData
      if (activeMenu === 'time-efficiency' || activeMenu === 'overview-logistics' || activeMenu === '4pl-time-efficiency') {
        console.log('✅ 识别为时效分析页面，导出时效RawData');
        // ✅ 时效分析页面 - 导出时效RawData
        toast.info('正在获取时效分析数据...', { duration: 2000 });
        
        const rawData = await exportTimelinessRawData({
          dateRange: currentDateRange,
          selectedBrand: selectedBrand || 'all',
          selectedSelfFlag: selectedSelfFlag || 'Y',
          selectedCarrier: null,
          analysisType: 'S2D', // 默认S2D，也可以根据当前Tab动态切换
          userBrands: userBrands
        });

        if (rawData && rawData.length > 0) {
          // 导出到Excel
          exportTimelinessRawDataToExcel(rawData, {
            selectedBrand: selectedBrand || 'all',
            analysisType: 'S2D',
            dateRange: currentDateRange
          });

          toast.success(`✅ 成功导出 ${rawData.length} 条时效分析数据`);
        } else {
          toast.warning('没有符合条件的时效分析数据');
        }
      } else {
        // ✅ 其他页面（总览等） - 导出订单明细
        toast.info('正在获取订单数据...', { duration: 2000 });
        
        const orderData = await exportOrderDetails({
          startDate: currentDateRange.from,
          endDate: currentDateRange.to,
          brand: selectedBrand || 'all',
          platform: selectedPlatform,
          selfFlag: selectedSelfFlag || 'Y',
          userBrands: userBrands,
          batchSize: 10000
        });

        if (orderData && orderData.length > 0) {
          // 导出到Excel
          exportOrderDetailsToExcel(orderData, {
            brand: selectedBrand || 'all',
            platform: selectedPlatform || 'all',
            selfFlag: selectedSelfFlag || 'Y',
            dateRange: currentDateRange
          });

          toast.success(`✅ 成功导出 ${orderData.length} 条订单明细数据`);
        } else {
          toast.warning('没有符合条件的订单数据');
        }
      }
    } catch (error: any) {
      console.error('数据导出失败:', error);
      toast.error(`导出失败: ${error.message || '未知错误'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = () => {
    // 模拟导入功能 - 创建文件输入
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.xlsx';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        console.log('导入文件:', file.name);
        // 这里应该调用后端API处理文件导入
        alert(`导入功能 - 选择的文件: ${file.name}\n实际项目中将处理文件并更新数据库`);
      }
    };
    input.click();
  };

  const clearAllFilters = () => {
    onBrandChange('all');
    if (onPlatformChange) {
      onPlatformChange('all');
    }
    if (onSelfFlagChange) {
      onSelfFlagChange('Y'); // 默认回到自管
    }
  };

  const hasActiveFilters = selectedBrand && selectedBrand !== 'all' || 
                          selectedPlatform && selectedPlatform !== 'all' ||
                          selectedSelfFlag && selectedSelfFlag !== 'Y';

  return (
    <div className="h-16 bg-white border-b border-functional-light-grey flex items-center justify-between px-6">
      {/* Left side - Date Range and Status */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-functional-mid-grey" />
          <Label className="text-sm text-functional-mid-grey whitespace-nowrap">时间范围:</Label>
          <DatePickerWithRange 
            onDateRangeChange={handleDateRangeChange}
            className="w-72"
            initialDateRange={currentDateRange}
          />
        </div>
        

      </div>

      {/* Right side - Filters and Actions */}
      <div className="flex items-center space-x-4">
        {/* Brand Filter */}
        <div className="flex items-center space-x-2">
          <Label className="text-sm text-functional-mid-grey whitespace-nowrap">品牌:</Label>
          <Select value={selectedBrand || "all"} onValueChange={onBrandChange}>
            <SelectTrigger className="w-32 h-8 text-sm border-functional-light-grey bg-white">
              <SelectValue placeholder="选择品牌" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-functional-light-grey shadow-md rounded-lg">
              <SelectItem value="all">全部品牌</SelectItem>
              {accessibleBrands.map((brand) => (
                <SelectItem key={brand.code} value={brand.code}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Platform Filter */}
        <div className="flex items-center space-x-2">
          <Label className="text-sm text-functional-mid-grey whitespace-nowrap">平台:</Label>
          <Select 
            value={selectedPlatform || "all"} 
            onValueChange={onPlatformChange || (() => {})}
          >
            <SelectTrigger className="w-32 h-8 text-sm border-functional-light-grey bg-white">
              <SelectValue placeholder="选择平台" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-functional-light-grey shadow-md rounded-lg">
              <SelectItem value="all">全部平台</SelectItem>
              {platformOptions.map((platform) => (
                <SelectItem key={platform.code} value={platform.code}>
                  {platform.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Self-Managed Filter */}
        <div className="flex items-center space-x-2">
          <Label className="text-sm text-functional-mid-grey whitespace-nowrap">自管:</Label>
          <Select 
            value={selectedSelfFlag || "Y"} 
            onValueChange={onSelfFlagChange || (() => {})}
          >
            <SelectTrigger className="w-28 h-8 text-sm border-functional-light-grey bg-white">
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-functional-light-grey shadow-md rounded-lg">
              <SelectItem value="Y">自管</SelectItem>
              <SelectItem value="N">非自管</SelectItem>
              <SelectItem value="all">全部</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters Indicator */}
        {hasActiveFilters && (
          <div className="flex items-center space-x-2">
            <Filter className="h-3 w-3 text-functional-mid-grey" />
            <div className="flex items-center space-x-1">
              {selectedBrand && selectedBrand !== 'all' && (
                <Badge variant="outline" className="maersk-badge-secondary text-xs">
                  品牌: {selectedBrand}
                </Badge>
              )}
              {selectedPlatform && selectedPlatform !== 'all' && (
                <Badge variant="outline" className="maersk-badge-secondary text-xs">
                  平台: {selectedPlatform === 'tmall' ? '天猫' : 
                         selectedPlatform === 'douyin' ? '抖音' : 
                         selectedPlatform === 'jd' ? '京东' : 
                         selectedPlatform === 'pdd' ? '拼多多' : 
                         selectedPlatform === 'official' ? '官网/小程序' : 
                         selectedPlatform === 'o2o' ? 'O2O' : 
                         selectedPlatform === 'xiaohongshu' ? '小红书' : 
                         selectedPlatform === 'wechat' ? '微信小程序' : selectedPlatform}
                </Badge>
              )}
              {selectedSelfFlag && selectedSelfFlag !== 'Y' && (
                <Badge variant="outline" className="maersk-badge-secondary text-xs">
                  自管: {selectedSelfFlag === 'N' ? '非自管' : selectedSelfFlag === 'all' ? '全部' : selectedSelfFlag}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="h-6 w-6 p-0 text-functional-mid-grey hover:text-accent-mid-red"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        <Separator orientation="vertical" className="h-6" />

        {/* 🔧 导入/导出按钮 - 根据页面动态显示 */}
        {/* 总览页面(overview-dashboard)：隐藏 */}
        {/* 物流监控页面(overview-logistics)：显示导出按钮 */}
        {/* 其他页面：显示导出按钮 */}
        <div className={`flex items-center space-x-2 ${isOverviewDashboard|| activeMenu === 'overview-exceptions' ? 'hidden' : ''}`}>
          {/* 导入按钮 - 所有页面都隐藏 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportData}
            className="h-8 px-3 text-xs border-functional-light-grey hover:bg-functional-bright-grey hidden"
          >
            <Upload className="h-3 w-3 mr-1" />
            导入
          </Button>
          {/* 导出按钮 - 仅总览页面隐藏 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            disabled={isExporting}
            className="h-8 px-3 text-xs border-functional-light-grey hover:bg-functional-bright-grey text-[rgba(0,0,0,1)] hover:text-functional-dark-blue"
          >
            <Download className="h-3 w-3 mr-1" />
            {isExporting ? '导出中...' : '导出'}
          </Button>
        </div>
      </div>
    </div>
  );
}
import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Upload, Download } from "lucide-react";
import { DatePickerWithRange } from "./ui/date-picker-with-range";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { MultiSelect } from "./ui/multi-select";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { useAuth } from '../contexts/AuthContext'; // 导入 useAuth
import { useBrand } from '../contexts/BrandContext'; // 🔥 导入 useBrand Hook
import { usePlatform } from '../contexts/PlatformContext'; // 🔥 导入 usePlatform Hook
import { exportOrderDetails as exportOrderDetailsToExcel } from '../utils/excelExport'; // 🔥 导入Excel导出函数
import { exportTimelinessRawData as exportTimelinessRawDataToExcel } from '../utils/excelExport'; // 🔥 导入时效分析RawData导出函数
import { exportOrderDetails, exportTimelinessRawData, getLogisticsBrands, getAvailableBrands, getAvailablePlatforms } from '../services/apiService'; // 🔥 导入API服务
import { toast } from 'sonner'; // 🔥 导入toast提示

// 🔥 平台数据类型
interface TopToolbarProps {
  onDateRangeChange: (dateRange: { from: string; to: string }) => void;
  onBrandChange: (brand: string | string[]) => void;
  onPlatformChange?: (platform: string | string[]) => void;
  onSelfFlagChange?: (selfFlag: string) => void;
  selectedBrand: string | string[] | null;
  selectedPlatform?: string | string[] | null;
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
  const [orderBasedBrands, setOrderBasedBrands] = useState<Array<{ code: string; name: string }> | null>(null);
  const [orderBrandsStatus, setOrderBrandsStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  // 🔥 新增：基于订单相关的动态平台
  const [orderBasedPlatforms, setOrderBasedPlatforms] = useState<Array<{ code: string; name: string }> | null>(null);
  const [orderPlatformsStatus, setOrderPlatformsStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  // 新增：本地待确认品牌选择
  const [pendingSelectedBrands, setPendingSelectedBrands] = useState<Array<string>>(
    Array.isArray(selectedBrand)
      ? selectedBrand
      : selectedBrand && selectedBrand !== 'all'
      ? [selectedBrand]
      : []
  );

  // 🔥 新增：本地待确认平台选择
  const [pendingSelectedPlatforms, setPendingSelectedPlatforms] = useState<Array<string>>(
    Array.isArray(selectedPlatform)
      ? selectedPlatform
      : selectedPlatform && selectedPlatform !== 'all'
      ? [selectedPlatform]
      : []
  );

  // 同步外部selectedBrand变化到本地pendingSelectedBrands
  useEffect(() => {
    setPendingSelectedBrands(
      Array.isArray(selectedBrand)
        ? selectedBrand
        : selectedBrand && selectedBrand !== 'all'
        ? [selectedBrand]
        : []
    );
  }, [selectedBrand]);

  // 🔥 同步外部selectedPlatform变化到本地pendingSelectedPlatforms
  useEffect(() => {
    setPendingSelectedPlatforms(
      Array.isArray(selectedPlatform)
        ? selectedPlatform
        : selectedPlatform && selectedPlatform !== 'all'
        ? [selectedPlatform]
        : []
    );
  }, [selectedPlatform]);

  const brandNameToCodeMap = useMemo(() => {
    const nameToCode: Record<string, string> = {};
    brandMappings.forEach((brand) => {
      const key = String(brand.brandName || '').trim().toUpperCase();
      if (key) {
        nameToCode[key] = brand.brandCode;
      }
    });
    return nameToCode;
  }, [brandMappings]);

  // 获取用户可访问的品牌列表
  const getAccessibleBrands = (): Array<{ code: string; name: string }> => {
    const hasOrderBrands = Array.isArray(orderBasedBrands) && orderBasedBrands.length > 0;

    console.log('🔍 [TopToolbar.getAccessibleBrands] 调试信息:', {
      isAdmin: user?.isAdmin,
      orderBrandsStatus,
      hasOrderBrands,
      orderBasedBrandsCount: orderBasedBrands?.length || 0,
      userCustomerNos: user?.customerNos
    });

    if (user?.isAdmin) {
      // 管理员只使用订单加载得到的品牌列表（来自 view_TSK_LIST_TASK）。
      console.log('👑 [TopToolbar] 管理员模式，返回品牌数量:', hasOrderBrands ? orderBasedBrands.length : 0);
      return hasOrderBrands ? orderBasedBrands : [];
    }

    // 全应用基线：先给出"权限内品牌"，保证任何页面都可下拉筛选品牌。
    const baseBrands = (user?.customerNos && user.customerNos.length > 0)
      ? user.customerNos
          .filter((code) => codeToNameMap[code])
          .map((code) => ({ code, name: codeToNameMap[code] }))
      : [];

    console.log('👤 [TopToolbar] 普通用户基础品牌:', baseBrands.map(b => b.code).join(', '));

    if (baseBrands.length === 0) {
      return [];
    }

    // 若有"订单涉及品牌"结果，则在权限基线上做收敛；无结果时保持全量可用。
    if (orderBrandsStatus === 'loaded' && hasOrderBrands) {
      const orderBrandCodeSet = new Set(orderBasedBrands.map((brand) => brand.code));
      const narrowed = baseBrands.filter((brand) => orderBrandCodeSet.has(brand.code));
      return narrowed.length > 0 ? narrowed : baseBrands;
    }

    return baseBrands;
  };

  const accessibleBrands = useMemo(() => getAccessibleBrands(), [user?.isAdmin, user?.customerNos, codeToNameMap, orderBasedBrands, orderBrandsStatus]);
  
  // 获取可用的平台列表
  const getAccessiblePlatforms = (): Array<{ code: string; name: string }> => {
    const hasOrderPlatforms = Array.isArray(orderBasedPlatforms) && orderBasedPlatforms.length > 0;
    
    if (user?.isAdmin) {
      // 管理员优先使用“有订单平台”，但接口空结果/失败时回退到完整平台映射，避免下拉只剩“全部平台”。
      return hasOrderPlatforms ? orderBasedPlatforms : platformOptions;
    }

    // 普通用户：如果有订单获取到的平台，与平台全集求交集；没获取到则返回全集
    if (orderPlatformsStatus === 'loaded' && hasOrderPlatforms) {
      const orderPlatformCodeSet = new Set(orderBasedPlatforms.map(p => p.code));
      const narrowed = platformOptions.filter(p => orderPlatformCodeSet.has(p.code));
      return narrowed.length > 0 ? narrowed : platformOptions;
    }
    
    return platformOptions;
  };

  const accessiblePlatforms = useMemo(() => getAccessiblePlatforms(), [user?.isAdmin, platformOptions, orderBasedPlatforms, orderPlatformsStatus]);

  const isOverviewDashboard = activeMenu === 'overview-dashboard';
  // 隐藏趋势分析和重量分析页面的导出按钮（严格判断 overview-weight 和 weight-analysis 相关页面）
  const isWeightAnalysisPage = activeMenu === 'overview-weight' || activeMenu === 'weight-analysis' || activeMenu?.includes('weight-analysis');
  const isTrendPage = activeMenu?.includes('trend');

  useEffect(() => {
    let cancelled = false;

    const extractBrandsFromResult = (result: any): Array<{ code: string; name: string }> => {
      const exceptions = result?.data?.brandExceptions || [];
      const brandMap = new Map<string, string>();

      exceptions.forEach((item: any) => {
        let code = String(item?.brandCode || item?.brand_code || '').trim();
        if (!code) {
          const normalizedName = String(item?.brandName || item?.brand_name || '').trim().toUpperCase();
          code = brandNameToCodeMap[normalizedName] || '';
        }
        if (!code) {
          return;
        }

        const name = String(item?.brandName || item?.brand_name || code).trim() || code;
        if (!brandMap.has(code)) {
          brandMap.set(code, name);
        }
      });

      return Array.from(brandMap.entries()).map(([code, name]) => ({ code, name }));
    };

    const queryOrderBrands = async (selfFlagValue: string, userBrands?: string[]) => {
      const result = await getLogisticsBrands({
        dateRange: currentDateRange,
        brand: 'all',
        platform: selectedPlatform || 'all',
        selfFlag: selfFlagValue,
        userBrands
      });

      return extractBrandsFromResult(result);
    };

    // 🆕 管理员专用：查询VIEW_TSK_LIST_TASK中有订单的品牌
    const queryAdminAvailableBrands = async (selfFlagValue: string): Promise<Array<{ code: string; name: string }>> => {
      if (!currentDateRange?.from || !currentDateRange?.to) {
        console.warn('⚠️ [TopToolbar.queryAdminAvailableBrands] 缺少日期范围，无法查询');
        return [];
      }

      console.log('🔍 [TopToolbar] 管理员查询可用品牌（基于VIEW_TSK_LIST_TASK）:', {
        startDate: currentDateRange.from,
        endDate: currentDateRange.to,
        selfFlag: selfFlagValue
      });

      try {
        const result = await getAvailableBrands({
          startDate: currentDateRange.from,
          endDate: currentDateRange.to,
          selfFlag: selfFlagValue
        });

        console.log('📊 [TopToolbar.queryAdminAvailableBrands] API返回结果:', result);

        if (result?.success && Array.isArray(result.data)) {
          const brands = result.data.map((item: any) => ({
            code: item.brandCode,
            name: item.brandName || item.brandCode  // 🔥 移除fullName回退，直接使用brandCode
          }));
          console.log('✅ [TopToolbar] 管理员可用品牌:', brands.map(b => `${b.code}(${b.name})`).join(', '));
          return brands;
        } else {
          console.warn('⚠️ [TopToolbar.queryAdminAvailableBrands] API返回格式错误或无数据:', result);
          return [];
        }
      } catch (error) {
        console.error('❌ [TopToolbar.queryAdminAvailableBrands] API调用失败:', error);
        return [];
      }
    };

    // 🆕 管理员专用：查询VIEW_TSK_LIST_TASK中有订单的平台
    const queryAdminAvailablePlatforms = async (selfFlagValue: string): Promise<Array<{ code: string; name: string }>> => {
      if (!currentDateRange?.from || !currentDateRange?.to) {
        console.warn('⚠️ [TopToolbar.queryAdminAvailablePlatforms] 缺少日期范围，无法查询');
        return [];
      }

      console.log('🔍 [TopToolbar] 管理员查询可用平台（基于VIEW_TSK_LIST_TASK）:', {
        startDate: currentDateRange.from,
        endDate: currentDateRange.to,
        selfFlag: selfFlagValue,
        brand: selectedBrand
      });

      try {
        const result = await getAvailablePlatforms({
          startDate: currentDateRange.from,
          endDate: currentDateRange.to,
          selfFlag: selfFlagValue,
          brand: selectedBrand || 'all'
        });

        console.log('📊 [TopToolbar.queryAdminAvailablePlatforms] API返回结果:', result);

        if (result?.success && Array.isArray(result.data)) {
          const platforms = result.data.map((item: any) => ({
            code: item.platformCode || item.platformName,
            name: item.platformName || item.platformCode
          }));
          console.log('✅ [TopToolbar] 管理员可用平台:', platforms.map(p => `${p.name}`).join(', '));
          return platforms;
        } else {
          console.warn('⚠️ [TopToolbar.queryAdminAvailablePlatforms] API返回格式错误或无数据:', result);
          return [];
        }
      } catch (error) {
        console.error('❌ [TopToolbar.queryAdminAvailablePlatforms] API调用失败:', error);
        return [];
      }
    };

    const loadBrandsWithOrders = async () => {
      if (!user) {
        setOrderBasedBrands(null);
        setOrderBrandsStatus('idle');
        return;
      }

      if (!currentDateRange?.from || !currentDateRange?.to) {
        setOrderBasedBrands(null);
        setOrderBrandsStatus('idle');
        return;
      }

      try {
        if (!cancelled) {
          setOrderBrandsStatus('loading');
        }

        const preferredSelfFlag = selectedSelfFlag || 'Y';
        let loadedBrands: Array<{ code: string; name: string }> = [];

        if (user.isAdmin) {
          // 管理员：使用新API查询 VIEW_TSK_LIST_TASK
          loadedBrands = await queryAdminAvailableBrands(preferredSelfFlag);
          
          // 智能回退：当前条件无数据时自动放宽为"all"
          if (loadedBrands.length === 0 && preferredSelfFlag !== 'all') {
            loadedBrands = await queryAdminAvailableBrands('all');
          }
        } else {
          // 普通用户：保持原有逻辑
          const userBrands = Array.isArray(user.customerNos) && user.customerNos.length > 0
            ? user.customerNos
            : undefined;

          loadedBrands = await queryOrderBrands(preferredSelfFlag, userBrands);

          // 若按当前自管条件无品牌数据，自动放宽为 all，避免下拉只剩“全部品牌”。
          if (loadedBrands.length === 0 && preferredSelfFlag !== 'all') {
            loadedBrands = await queryOrderBrands('all', userBrands);
          }
        }

        if (!cancelled) {
          if (loadedBrands.length > 0) {
            setOrderBasedBrands(loadedBrands);
          }
          setOrderBrandsStatus('loaded');
        }
      } catch (error) {
        if ((error as any)?.name === 'AbortError') {
          console.info('ℹ️ 获取有订单品牌请求被取消，继续使用当前品牌列表');
          if (!cancelled) {
            setOrderBrandsStatus('loaded');
          }
          return;
        }
        console.warn('⚠️ 获取有订单品牌失败，保留上次成功的品牌列表', error);
        if (!cancelled) {
          setOrderBrandsStatus('error');
        }
      }
    };

      const loadPlatformsWithOrders = async () => {
        if (!user) {
          setOrderBasedPlatforms(null);
          setOrderPlatformsStatus('idle');
          return;
        }

        if (!currentDateRange?.from || !currentDateRange?.to) {
          setOrderBasedPlatforms(null);
          setOrderPlatformsStatus('idle');
          return;
        }

        try {
          if (!cancelled) {
            setOrderPlatformsStatus('loading');
          }

          const preferredSelfFlag = selectedSelfFlag || 'Y';
          let loadedPlatforms: Array<{ code: string; name: string }> = [];

          if (user.isAdmin) {
            // 管理员：使用新API查询 VIEW_TSK_LIST_TASK 获取可用平台
            loadedPlatforms = await queryAdminAvailablePlatforms(preferredSelfFlag);

            // 智能回退：当前条件无数据时自动放宽为"all"
            if (loadedPlatforms.length === 0 && preferredSelfFlag !== 'all') {
              loadedPlatforms = await queryAdminAvailablePlatforms('all');
            }
          }

          if (!cancelled) {
            // ALWAYS update orderBasedPlatforms, even if empty, to reflect "no orders for these filters"
            setOrderBasedPlatforms(loadedPlatforms);
            setOrderPlatformsStatus('loaded');
          }
        } catch (error) {
          if ((error as any)?.name === 'AbortError') {
            console.info('ℹ️ 获取有订单平台请求被取消，继续使用当前平台列表');
            if (!cancelled) {
              setOrderPlatformsStatus('loaded');
            }
            return;
          }
          console.warn('⚠️ 获取有订单平台失败，保留上次成功的平台列表', error);
          if (!cancelled) {
            setOrderPlatformsStatus('error');
          }
        }
      };

      loadBrandsWithOrders();
      loadPlatformsWithOrders();

      return () => {
        cancelled = true;
      };
    }, [user, currentDateRange?.from, currentDateRange?.to, selectedBrand, selectedPlatform, selectedSelfFlag, brandNameToCodeMap]);

    // 管理员筛选器保持可点击，避免因接口瞬时失败导致无法切换品牌。
    const isBrandSelectDisabled = false;

    useEffect(() => {
      if (!selectedBrand || selectedBrand === 'all' || (Array.isArray(selectedBrand) && selectedBrand.length === 0)) {
        return;
      }

      let allSelectedVisible = true;
      if (Array.isArray(selectedBrand)) {
        allSelectedVisible = selectedBrand.every(brandCode => accessibleBrands.some((b: { code: string; name: string }) => b.code === brandCode));
      } else {
        allSelectedVisible = accessibleBrands.some((brand: { code: string; name: string }) => brand.code === selectedBrand);
      }

      if (!allSelectedVisible) {
        onBrandChange('all');
      }
    }, [selectedBrand, accessibleBrands, onBrandChange]);



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
      const currentTimelinessMetric = (() => {
        try {
          const value = String(sessionStorage.getItem('vf_timeliness_metric_type') || 'S2D').toUpperCase();
          return value === 'C2D' ? 'C2D' : 'S2D';
        } catch {
          return 'S2D';
        }
      })();
      
      // 🔥 根据activeMenu判断导出哪种数据
      // ✅ 物流监控页面(overview-logistics)包含时效分析Tab，需要导出时效RawData
      if (activeMenu === 'time-efficiency' || activeMenu === 'overview-logistics' || activeMenu === '4pl-time-efficiency') {
        console.log('✅ 识别为时效分析页面，导出时效RawData');
        // ✅ 时效分析页面 - 导出时效RawData
        toast.info('正在获取时效分析数据...', { duration: 2000 });
        
        const rawData = await exportTimelinessRawData({
          dateRange: currentDateRange,
          selectedBrand: selectedBrand || 'all',
          selectedPlatform: selectedPlatform || 'all',
          selectedSelfFlag: selectedSelfFlag || 'Y',
          selectedCarrier: null,
          analysisType: currentTimelinessMetric,
          userBrands: userBrands
        });

        if (rawData && rawData.length > 0) {
          // 导出到Excel
          exportTimelinessRawDataToExcel(rawData, {
            selectedBrand: selectedBrand || 'all',
            analysisType: currentTimelinessMetric,
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

  return (
    <div className="h-16 bg-white border-b border-functional-light-grey flex items-center justify-between px-6">
      {/* Left side - Date Range and Status */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-functional-mid-grey" />
          <Label className="text-sm text-functional-mid-grey whitespace-nowrap">时间范围:</Label>
          <DatePickerWithRange 
            onDateRangeChange={handleDateRangeChange}
            className="w-[370px]"
            initialDateRange={currentDateRange}
          />
        </div>
        

      </div>

      {/* Right side - Filters and Actions */}
      <div className="flex items-center space-x-4">
        {/* Brand Filter */}
        <div className="flex items-center space-x-2">
          <Label className="text-sm text-functional-mid-grey whitespace-nowrap">品牌:</Label>
          <MultiSelect
            options={accessibleBrands.map((b: { code: string; name: string }) => ({ label: b.name, value: b.code }))}
            selected={pendingSelectedBrands}
            onChange={setPendingSelectedBrands}
            placeholder="选择品牌"
            disabled={isBrandSelectDisabled}
            className="w-48 bg-white border-functional-light-grey"
            footer={
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2"
                onClick={() => {
                  if (pendingSelectedBrands.length === 0) onBrandChange('all');
                  else onBrandChange(pendingSelectedBrands);
                }}
              >
                确定
              </Button>
            }
          />
        </div>

        {/* Platform Filter */}
        <div className="flex items-center space-x-2">
          <Label className="text-sm text-functional-mid-grey whitespace-nowrap">平台:</Label>
          <MultiSelect
            options={accessiblePlatforms.map((p: { code: string; name: string }) => ({ label: p.name, value: p.code }))}
            selected={pendingSelectedPlatforms}
            onChange={setPendingSelectedPlatforms}
            placeholder="选择平台"
            className="w-40 bg-white border-functional-light-grey"
            footer={
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2"
                onClick={() => {
                  if (onPlatformChange) {
                    if (pendingSelectedPlatforms.length === 0) onPlatformChange('all');
                    else onPlatformChange(pendingSelectedPlatforms);
                  }
                }}
              >
                确定
              </Button>
            }
          />
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

        <Separator orientation="vertical" className="h-6" />

        {/* 🔧 导入/导出按钮 - 根据页面动态显示 */}
        {/* 总览页面(overview-dashboard)：隐藏 */}
        {/* 物流监控页面(overview-logistics)：显示导出按钮 */}
        {/* 其他页面：显示导出按钮 */}
        <div className={`flex items-center space-x-2${isOverviewDashboard || activeMenu === 'overview-exceptions' || isTrendPage || isWeightAnalysisPage ? ' hidden' : ''}`}>
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
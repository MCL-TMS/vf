import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiService } from '../services/apiService';
import type { DateRange } from '../data/types';
import { getTodayDateRange } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';

interface UseAPIDataOptions {
  enabled?: boolean;
  dateRange?: DateRange;
  selectedBrand?: string | string[] | null;
  selectedPlatform?: string | null;
  selectedSelfFlag?: string | null;
  activeMenu?: string;
}

interface APIDataState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
  logisticsData?: T | null;
  brandLogisticsData?: T | null;
}

export function useAPIData(options: UseAPIDataOptions = {}) {
  const { 
    enabled = true, 
    dateRange, 
    selectedBrand, 
    selectedPlatform,
    selectedSelfFlag,
    activeMenu 
  } = options;
  
  // 🔥 新增：获取用户认证信息和品牌权限
  const { user, isLoading: authLoading } = useAuth(); // ✅ 获取isLoading状态
  const userBrands = user?.customerNos || []; // ✅ 修复：使用customerNos（复数），如果是管理员则为空数组
  const userBrandsKey = userBrands.join(',');
  
  console.log('🔐 [useAPIData] 用户品牌权限:', { 
    userId: user?.userId,
    isAdmin: user?.isAdmin,
    customerNos: user?.customerNos, // ✅ 显示正确的字段
    userBrands,
    userBrandsCount: userBrands.length,
    authLoading // ✅ 新增：显示认证加载状态
  });
  
  const [state, setState] = useState<APIDataState>({
    data: null,
    loading: false,
    error: null,
    logisticsData: null,
    brandLogisticsData: null
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchParamsRef = useRef<string>('');
  const isInitializedRef = useRef(false);

  const fetchData = useCallback(async (force = false) => {
    const currentActiveMenu = activeMenu || 'overview-dashboard';
    
    // ✅ 新增：如果认证还在加载中，不发起API请求
    if (authLoading) {
      console.log('⏸️ [useAPIData] 等待用户认证完成...');
      return;
    }
    
    // 如果未启用，直接返回
    if (!enabled) {
      if (isInitializedRef.current) {
        setState({
          data: null,
          loading: false,
          error: null,
          logisticsData: null,
          brandLogisticsData: null
        });
      }
      return;
    }

    // 确保总是有日期范围 - 如果没有提供，使用今天的日期范围
    const effectiveDateRange = dateRange || getTodayDateRange();
    
    console.log('📊 [useAPIData] fetchData called with:', {
      enabled,
      effectiveDateRange,
      selectedBrand,
      selectedPlatform,
      selectedSelfFlag,
      activeMenu,
      force,
      authLoading,
      hasUser: !!user
    });
    
    // 生成当前请求参数的唯一标识 - 确保参数稳定
    const currentParams = JSON.stringify({
      dateRange: {
        from: effectiveDateRange.from,
        to: effectiveDateRange.to
      },
      selectedBrand: selectedBrand || null,
      selectedPlatform: selectedPlatform || null,
      selectedSelfFlag: selectedSelfFlag || null,
      activeMenu: activeMenu || 'overview-dashboard',
      force: force ? Date.now() : undefined
    });
    
    console.log('🔍 [useAPIData] Current params:', currentParams);
    console.log('🔍 [useAPIData] Last params:', lastFetchParamsRef.current);
    
    // 🔥 修复：检测 activeMenu 是否改变
    const lastParams = lastFetchParamsRef.current ? JSON.parse(lastFetchParamsRef.current) : null;
    const menuChanged = lastParams && lastParams.activeMenu !== (activeMenu || 'overview-dashboard');
    
    if (menuChanged) {
      console.log('🔄 [useAPIData] activeMenu changed, forcing data reload:', {
        from: lastParams?.activeMenu,
        to: activeMenu
      });
    }
    
    const hasRequiredData = (activeMenu === 'overview-logistics')
      ? !!(state.logisticsData || state.brandLogisticsData || state.data)
      : !!state.data;

    // 🔥 修复：如果activeMenu改变了，必须重新加载（即使其他参数相同）
    if (!force && !menuChanged && currentParams === lastFetchParamsRef.current && hasRequiredData && !state.error) {
      console.log('⏭️ [useAPIData] Skipping request - params unchanged and has data');
      return;
    }
    
    // 如果正在加载中，跳过重复请求
    if (state.loading && !force) {
      return;
    }
    
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    
    // 🔥 修复：如果是页面切换，先清空不相关的数据
    if (menuChanged) {
      setState({
        data: null,  // 清空旧数据
        loading: true,
        error: null,
        logisticsData: null,  // 清空物流数据
        brandLogisticsData: null  // 清空品牌物流数据
      });
    } else {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }
    
    try {
      // 健康检查仅作参考，不再阻断真实数据请求。
      const isHealthy = await ApiService.quickHealthCheck();
      
      if (!isHealthy) {
        console.warn('⚠️ [useAPIData] 健康检查未通过，但继续尝试真实数据请求');
      }

      // 根据页面类型获取不同的API数据
      let overviewData = null;
      let logisticsData = null;
      let brandLogisticsData = null;
      
      if (activeMenu === 'overview-logistics') {
        // 物流页面：获取物流数据、总览数据和专门的品牌物流异常数据
        console.log('🚚 [useAPIData] Calling logistics, overview and brand logistics APIs for logistics page with:', {
          dateRange: effectiveDateRange,
          brand: selectedBrand
        });
        
        // 🔥 并行获取三种数据源
        const [logisticsResponse, overviewResponse, brandLogisticsResponse] = await Promise.all([
          // 获取物流数据（快递商维度）
          ApiService.getLogisticsData({
            dateRange: effectiveDateRange,
            brand: selectedBrand,
            platform: selectedPlatform,  // ✅ 修复：添加platform参数
            selfFlag: selectedSelfFlag,
            userBrands: userBrands.length > 0 ? userBrands : undefined, // ✅ 修复：只要有userBrands就传递
            signal: abortControllerRef.current.signal
          }),
          
          // 获取总览数据（基础品牌数据）
          ApiService.getOverviewData({
            dateRange: effectiveDateRange,
            brand: selectedBrand,
            platform: selectedPlatform,
            selfFlag: selectedSelfFlag,
            userBrands: userBrands.length > 0 ? userBrands : undefined, // ✅ 修复：只要有userBrands就传递
            signal: abortControllerRef.current.signal
          }),
          
          // 🔥 新增：获取专门的品牌物流异常数据
          ApiService.getLogisticsBrands({
            dateRange: effectiveDateRange,
            brand: selectedBrand,
            platform: selectedPlatform,
            selfFlag: selectedSelfFlag,
            userBrands: userBrands.length > 0 ? userBrands : undefined, // ✅ 修复：只要有userBrands就传递
            signal: abortControllerRef.current.signal
          }).catch(error => {
            console.warn('⚠️ [useAPIData] 品牌物流异常接口调用失败，将回退到overview数据:', error);
            return null; // 允许失败，回退到overview数据
          })
        ]);
        
        logisticsData = logisticsResponse;
        overviewData = overviewResponse;
        brandLogisticsData = brandLogisticsResponse;
        
        console.log('✅ [useAPIData] Logistics page API requests completed:', {
          logisticsData: !!logisticsData,
          overviewData: !!overviewData,
          brandLogisticsData: !!brandLogisticsData,
          brandLogisticsCount: brandLogisticsData?.data?.brandExceptions?.length || 0,
          brandLogisticsSuccess: brandLogisticsData?.success,
          brandLogisticsError: brandLogisticsData?.error
        });
        
        // 🔥 详细的品牌物流数据调试信息
        if (brandLogisticsData) {
          console.log('🏷️ [useAPIData] 品牌物流异常数据详情:', {
            hasData: !!brandLogisticsData.data,
            brandExceptionsArray: Array.isArray(brandLogisticsData.data?.brandExceptions),
            firstBrandExample: brandLogisticsData.data?.brandExceptions?.[0],
            dataStructure: brandLogisticsData.data ? Object.keys(brandLogisticsData.data) : [],
            responseTimestamp: brandLogisticsData.timestamp
          });
        } else {
          console.warn('⚠️ [useAPIData] 品牌物流异常数据为空，可能的原因:');
          console.warn('   1. logistics/brands 接口不存在或返回404');
          console.warn('   2. 接口调用失败被catch捕获');
          console.warn('   3. 后端服务未启动或无法连接');
        }
      } else {
        // 总览页面：获取总览数据
        console.log('🌐 [useAPIData] Calling ApiService.getOverviewData for overview page with:', {
          dateRange: effectiveDateRange,
          brand: selectedBrand,
          platform: selectedPlatform
        });
        
        overviewData = await ApiService.getOverviewData({
          dateRange: effectiveDateRange,
          brand: selectedBrand,
          platform: selectedPlatform,
          selfFlag: selectedSelfFlag,
          signal: abortControllerRef.current.signal
        });
        
        console.log('✅ [useAPIData] Overview API request successful:', overviewData);
      }
      
      setState({
        data: overviewData,
        loading: false,
        error: null,
        logisticsData,
        brandLogisticsData
      });
      
      // 更新最后请求参数
      lastFetchParamsRef.current = currentParams;
      isInitializedRef.current = true;
      
    } catch (error: any) {
      // 如果请求被取消，不更新状态
      if (error.name === 'AbortError') {
        return;
      }
      
      console.error('❌ [useAPIData] API数据获取失败:', error);
      
      // 根据错误类型设置不同的错误信息
      let errorMessage = '数据获取失败';
      
      if (error.message.includes('连接') || error.message.includes('fetch')) {
        errorMessage = 'API服务连接失败，请检查后端服务是否已启动';
      } else if (error.message.includes('超时')) {
        errorMessage = 'API请求超时，请稍后重试';
      } else if (error.message.includes('404')) {
        errorMessage = 'API接口不存在';
      } else if (error.message.includes('400')) {
        errorMessage = '请求参数错误，请检查日期范围设置';
      } else if (error.message.includes('500')) {
        errorMessage = '服务器内部错误';
      } else {
        errorMessage = error.message || '未知错误';
      }
      
      setState({
        data: null,
        loading: false,
        error: errorMessage,
        logisticsData: null,
        brandLogisticsData: null
      });
      
      isInitializedRef.current = true;
    }
  }, [
    enabled,
    dateRange?.from,
    dateRange?.to,
    selectedBrand,
    selectedPlatform,
    selectedSelfFlag,
    activeMenu,
    authLoading,
    user?.userId,
    userBrandsKey,
    state.loading,
    state.error,
    state.data,
    state.logisticsData,
    state.brandLogisticsData
  ]); // 依赖认证与当前数据状态，避免拿到过期闭包导致请求不再触发

  // 强制重新获取数据
  const refetch = useCallback(() => {
    if (enabled) {
      console.log('🔄 [useAPIData] Manual refetch triggered');
      fetchData(true);
    }
  }, [fetchData, enabled]);

  // 监听参数变化，自动获取数据 - 使用 useRef 避免无限循环
  useEffect(() => {
    console.log('🔄 [useAPIData] useEffect triggered with dependencies:', {
      enabled,
      dateFrom: dateRange?.from,
      dateTo: dateRange?.to,
      selectedBrand,
      selectedPlatform,
      selectedSelfFlag,
      activeMenu,
      authLoading, // ✅ 新增：监听认证状态
      hasUser: !!user // ✅ 新增：监听用户对象
    });
    
    // ✅ 如果认证还在加载中，不触发API请求
    if (authLoading) {
      console.log('⏸️ [useAPIData] 认证加载中，跳过API请求');
      return;
    }
    
    // 使用 setTimeout 来避免在同一个渲染周期内多次调用
    const timeoutId = setTimeout(() => {
      console.log('⚡ [useAPIData] Calling fetchData after timeout');
      fetchData();
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, dateRange?.from, dateRange?.to, selectedBrand, selectedPlatform, selectedSelfFlag, activeMenu, authLoading, user?.userId]); // ✅ 添加authLoading和user.userId到依赖项

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refetch,
    isEnabled: enabled,
    hasData: !!(state.data || state.logisticsData || state.brandLogisticsData) && isInitializedRef.current,
    logisticsData: state.logisticsData, // 新增：返回物流数据
    brandLogisticsData: state.brandLogisticsData // 新增：返回品牌物流异常数据
  };
}
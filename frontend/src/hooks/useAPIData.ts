import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiService } from '../services/apiService';
import type { DateRange } from '../data/types';
import { getTodayDateRange } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';

interface UseAPIDataOptions {
  enabled?: boolean;
  dateRange?: DateRange;
  selectedBrand?: string | string[] | null;
  selectedPlatform?: string | string[] | null; // 🔥 修复：支持多选平台
  selectedSelfFlag?: string | null;
  activeMenu?: string;
}

interface APIDataState<T = any> {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  logisticsData?: T | null;
  brandLogisticsData?: T | null;
}

interface CachedAPIData<T = any> {
  data: T | null;
  logisticsData?: T | null;
  brandLogisticsData?: T | null;
  timestamp: number;
}

const MENU_CACHE_TTL_MS = 120000;
const MENU_CACHE_MAX_ENTRIES = 60;

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
    refreshing: false,
    error: null,
    logisticsData: null,
    brandLogisticsData: null
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchParamsRef = useRef<string>('');
  const isInitializedRef = useRef(false);
  const requestSeqRef = useRef(0);
  const lastActiveMenuRef = useRef<string | undefined>(activeMenu);
  const responseCacheRef = useRef<Map<string, CachedAPIData>>(new Map());

  const buildRequestCacheKey = useCallback((effectiveDateRange: DateRange) => {
    return JSON.stringify({
      userId: user?.userId || 'anonymous',
      activeMenu: activeMenu || 'overview-dashboard',
      dateRange: {
        from: effectiveDateRange.from,
        to: effectiveDateRange.to
      },
      selectedBrand: selectedBrand || null,
      selectedPlatform: selectedPlatform || null,
      selectedSelfFlag: selectedSelfFlag || null,
      userBrands
    });
  }, [
    user?.userId,
    activeMenu,
    selectedBrand,
    selectedPlatform,
    selectedSelfFlag,
    userBrands
  ]);

  const getCachedData = useCallback((cacheKey: string): CachedAPIData | null => {
    const cached = responseCacheRef.current.get(cacheKey);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > MENU_CACHE_TTL_MS) {
      responseCacheRef.current.delete(cacheKey);
      return null;
    }

    return cached;
  }, []);

  const setCachedData = useCallback((cacheKey: string, nextValue: CachedAPIData) => {
    const cacheMap = responseCacheRef.current;
    if (cacheMap.size >= MENU_CACHE_MAX_ENTRIES) {
      const oldestKey = cacheMap.keys().next().value;
      if (oldestKey) {
        cacheMap.delete(oldestKey);
      }
    }

    cacheMap.set(cacheKey, nextValue);
  }, []);

  const fetchData = useCallback(async (force = false) => {
    const requestSeq = ++requestSeqRef.current;
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
          refreshing: false,
          error: null,
          logisticsData: null,
          brandLogisticsData: null
        });
      }
      return;
    }

    // 确保总是有日期范围 - 如果没有提供，使用今天的日期范围
    const effectiveDateRange = dateRange || getTodayDateRange();
    const cacheKey = buildRequestCacheKey(effectiveDateRange);
    
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
    
    // 如果正在加载中，仅在“参数完全相同”时跳过，避免筛选变化后被旧请求锁住一直loading。
    if (state.loading && !force && currentParams === lastFetchParamsRef.current) {
      return;
    }
    
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    
    const cachedData = !force ? getCachedData(cacheKey) : null;
    const hasCachedData = !!(cachedData?.data || cachedData?.logisticsData || cachedData?.brandLogisticsData);
    const hasCurrentData = !!(state.data || state.logisticsData || state.brandLogisticsData);

    // 命中菜单+筛选缓存时先秒开，再静默刷新
    if (cachedData) {
      setState({
        data: cachedData.data ?? null,
        loading: false,
        refreshing: true,
        error: null,
        logisticsData: cachedData.logisticsData ?? null,
        brandLogisticsData: cachedData.brandLogisticsData ?? null
      });
      console.log('⚡ [useAPIData] 命中菜单缓存，先展示缓存并后台刷新');
    } else if (menuChanged && !hasCurrentData) {
      setState({
        data: null,
        loading: true,
        refreshing: false,
        error: null,
        logisticsData: null,
        brandLogisticsData: null
      });
    } else if (hasCurrentData || hasCachedData) {
      setState(prev => ({ ...prev, loading: false, refreshing: true, error: null }));
    } else {
      setState(prev => ({ ...prev, loading: true, refreshing: false, error: null }));
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
        // 物流页面：仅获取物流专用数据，避免切换到转寄/拦截分析时额外请求overview/kpi。
        console.log('🚚 [useAPIData] Calling logistics and brand logistics APIs for logistics page with:', {
          dateRange: effectiveDateRange,
          brand: selectedBrand
        });
        
        // 并行获取物流数据源，但不让单个慢/失败请求阻塞整页
        const [logisticsSettled, brandLogisticsSettled] = await Promise.allSettled([
          ApiService.getLogisticsData({
            dateRange: effectiveDateRange,
            brand: selectedBrand,
            platform: selectedPlatform,
            selfFlag: selectedSelfFlag,
            userBrands: userBrands.length > 0 ? userBrands : undefined,
            signal: abortControllerRef.current.signal
          }),
          ApiService.getLogisticsBrands({
            dateRange: effectiveDateRange,
            brand: selectedBrand,
            platform: selectedPlatform,
            selfFlag: selectedSelfFlag,
            userBrands: userBrands.length > 0 ? userBrands : undefined,
            signal: abortControllerRef.current.signal
          })
        ]);

        if (logisticsSettled.status === 'fulfilled') {
          logisticsData = logisticsSettled.value;
        } else {
          console.warn('⚠️ [useAPIData] 物流快递商接口失败:', logisticsSettled.reason);
        }

        if (brandLogisticsSettled.status === 'fulfilled') {
          brandLogisticsData = brandLogisticsSettled.value;
        } else {
          console.warn('⚠️ [useAPIData] 品牌物流异常接口失败，将回退到overview数据:', brandLogisticsSettled.reason);
          brandLogisticsData = null;
        }

        // 物流页核心数据只依赖物流专用接口。
        if (!logisticsData) {
          throw new Error('物流页面核心数据接口请求失败');
        }
        
        console.log('✅ [useAPIData] Logistics page API requests completed:', {
          logisticsData: !!logisticsData,
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
          preferLite: false,
          requireCrossAnalysis: true,
          signal: abortControllerRef.current.signal
        });
        
        console.log('✅ [useAPIData] Overview API request successful:', overviewData);
      }
      
      if (requestSeq !== requestSeqRef.current) {
        console.log('⏭️ [useAPIData] 忽略过期响应（已有更新请求在途）');
        return;
      }

      const nextData = overviewData || state.data || null;
      const nextLogisticsData = logisticsData || state.logisticsData || null;
      const nextBrandLogisticsData = brandLogisticsData || state.brandLogisticsData || null;

      setState({
        data: nextData,
        loading: false,
        refreshing: false,
        error: null,
        logisticsData: nextLogisticsData,
        brandLogisticsData: nextBrandLogisticsData
      });

      setCachedData(cacheKey, {
        data: nextData,
        logisticsData: nextLogisticsData,
        brandLogisticsData: nextBrandLogisticsData,
        timestamp: Date.now()
      });
      
      // 更新最后请求参数
      lastFetchParamsRef.current = currentParams;
      isInitializedRef.current = true;
      
    } catch (error: any) {
      // 如果请求被取消，也要结束loading，避免界面一直转圈
      if (error.name === 'AbortError') {
        if (requestSeq !== requestSeqRef.current) {
          return;
        }

        setState(prev => ({
          ...prev,
          loading: false,
          refreshing: false
        }));
        isInitializedRef.current = true;
        return;
      }
      
      console.error('❌ [useAPIData] API数据获取失败:', error);

      if (requestSeq !== requestSeqRef.current) {
        return;
      }
      
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
      
      const fallbackCachedData = getCachedData(cacheKey);
      const fallbackData = fallbackCachedData?.data ?? state.data ?? null;
      const fallbackLogisticsData = fallbackCachedData?.logisticsData ?? state.logisticsData ?? null;
      const fallbackBrandLogisticsData = fallbackCachedData?.brandLogisticsData ?? state.brandLogisticsData ?? null;

      setState({
        data: fallbackData,
        loading: false,
        refreshing: false,
        error: errorMessage,
        logisticsData: fallbackLogisticsData,
        brandLogisticsData: fallbackBrandLogisticsData
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
    
    const previousActiveMenu = lastActiveMenuRef.current;
    const menuChanged = previousActiveMenu !== (activeMenu || 'overview-dashboard');
    lastActiveMenuRef.current = activeMenu;

    // 菜单快速切换时增加短防抖，减少无效请求风暴
    const fetchDelayMs = menuChanged ? 220 : 0;

    // 使用 setTimeout 来避免在同一个渲染周期内多次调用
    const timeoutId = setTimeout(() => {
      console.log('⚡ [useAPIData] Calling fetchData after timeout');
      fetchData();
    }, fetchDelayMs);
    
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
    refreshing: state.refreshing,
    error: state.error,
    refetch,
    isEnabled: enabled,
    hasData: !!(state.data || state.logisticsData || state.brandLogisticsData) && isInitializedRef.current,
    logisticsData: state.logisticsData, // 新增：返回物流数据
    brandLogisticsData: state.brandLogisticsData // 新增：返回品牌物流异常数据
  };
}
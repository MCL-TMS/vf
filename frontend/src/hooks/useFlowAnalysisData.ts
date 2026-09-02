import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiService } from '../services/apiService';
import type { DateRange } from '../data/types';
import { getTodayDateRange } from '../utils/dateUtils';

interface UseFlowAnalysisDataOptions {
  enabled?: boolean;
  dateRange?: DateRange;
  selectedBrand?: string | null;
  selectedPlatform?: string | null;
}

interface FlowAnalysisDataState {
  data: any | null;
  loading: boolean;
  error: string | null;
}

export function useFlowAnalysisData(options: UseFlowAnalysisDataOptions = {}) {
  const { 
    enabled = true, 
    dateRange, 
    selectedBrand, 
    selectedPlatform 
  } = options;
  
  const [state, setState] = useState<FlowAnalysisDataState>({
    data: null,
    loading: false,
    error: null
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFetchParamsRef = useRef<string>('');

  const fetchFlowAnalysisData = useCallback(async (force = false) => {
    // 如果未启用，直接返回
    if (!enabled) {
      setState({
        data: null,
        loading: false,
        error: null
      });
      return;
    }

    // 确保总是有日期范围
    const effectiveDateRange = dateRange || getTodayDateRange();
    
    console.log('📊 [useFlowAnalysisData] fetchData called with:', {
      enabled,
      effectiveDateRange,
      selectedBrand,
      selectedPlatform,
      force
    });
    
    // 生成当前请求参数的唯一标识
    const currentParams = JSON.stringify({
      dateRange: {
        from: effectiveDateRange.from,
        to: effectiveDateRange.to
      },
      selectedBrand: selectedBrand || null,
      selectedPlatform: selectedPlatform || null,
      force: force ? Date.now() : undefined
    });
    
    // 如果参数未变化且不是强制刷新，跳过请求
    if (!force && currentParams === lastFetchParamsRef.current && state.data && !state.error) {
      console.log('⏭️ [useFlowAnalysisData] Skipping request - params unchanged and has data');
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
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // 先检查API连接状态
      const isHealthy = await ApiService.quickHealthCheck();
      
      if (!isHealthy) {
        console.warn('⚠️ [useFlowAnalysisData] 健康检查未通过，但继续尝试真实数据请求');
      }

      // 获取订单流向与异常分析数据
      console.log('🔄 [useFlowAnalysisData] Calling ApiService.getOverviewFlowAnalysis with:', {
        dateRange: effectiveDateRange,
        brand: selectedBrand,
        platform: selectedPlatform
      });
      
      const flowAnalysisData = await ApiService.getOverviewFlowAnalysis({
        dateRange: effectiveDateRange,
        brand: selectedBrand,
        platform: selectedPlatform,
        signal: abortControllerRef.current.signal
      });
      
      console.log('✅ [useFlowAnalysisData] API request successful:', flowAnalysisData);
      
      setState({
        data: flowAnalysisData,
        loading: false,
        error: null
      });
      
      // 更新最后请求参数
      lastFetchParamsRef.current = currentParams;
      
    } catch (error: any) {
      // 请求被取消时也要结束loading，避免界面持续转圈
      if (error.name === 'AbortError') {
        setState(prev => ({
          ...prev,
          loading: false
        }));
        return;
      }
      
      console.error('❌ [useFlowAnalysisData] API数据获取失败:', error);
      
      // 根据错误类型设置不同的错误信息
      let errorMessage = '订单流向与异常分析数据获取失败';
      
      if (error.message.includes('连接') || error.message.includes('fetch')) {
        errorMessage = 'API服务连接失败，请检查后端服务是否已启动';
      } else if (error.message.includes('超时')) {
        errorMessage = 'API请求超时，请稍后重试';
      } else if (error.message.includes('404')) {
        errorMessage = '订单流向分析接口不存在';
      } else if (error.message.includes('400')) {
        errorMessage = '请求参数错误，请检查日期范围设置';
      } else if (error.message.includes('500')) {
        errorMessage = '服务器内部错误';
      } else {
        errorMessage = error.message || '未知错误';
      }
      
      setState(prev => ({
        data: prev.data,
        loading: false,
        error: errorMessage
      }));
    }
  }, [enabled, dateRange?.from, dateRange?.to, selectedBrand, selectedPlatform]);

  // 强制重新获取数据
  const refetch = useCallback(() => {
    if (enabled) {
      console.log('🔄 [useFlowAnalysisData] Manual refetch triggered');
      fetchFlowAnalysisData(true);
    }
  }, [fetchFlowAnalysisData, enabled]);

  // 监听参数变化，自动获取数据
  useEffect(() => {
    console.log('🔄 [useFlowAnalysisData] useEffect triggered with dependencies:', {
      enabled,
      dateFrom: dateRange?.from,
      dateTo: dateRange?.to,
      selectedBrand,
      selectedPlatform
    });
    
    // 使用 setTimeout 来避免在同一个渲染周期内多次调用
    const timeoutId = setTimeout(() => {
      console.log('⚡ [useFlowAnalysisData] Calling fetchFlowAnalysisData after timeout');
      fetchFlowAnalysisData();
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, dateRange?.from, dateRange?.to, selectedBrand, selectedPlatform]);

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
    hasData: !!state.data
  };
}
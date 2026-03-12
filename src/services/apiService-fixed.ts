import type { DateRange } from '../data/types';

interface APIRequestOptions {
  dateRange?: DateRange;
  brand?: string | null;
  platform?: string | null;
  signal?: AbortSignal;
}

interface HealthCheckCache {
  isHealthy: boolean;
  timestamp: number;
}

interface ApiPerformanceMetrics {
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

class ApiServiceClass {
  private baseURL = '/api';
  private healthCheckCache: HealthCheckCache | null = null;
  private readonly HEALTH_CHECK_CACHE_DURATION = 30000; // 30秒缓存
  private performanceMetrics: ApiPerformanceMetrics[] = [];
  private readonly MAX_METRICS_HISTORY = 50; // 保留最近50条记录

  // 🔥 重要修复：添加品牌和平台映射配置，与后端保持一致
  private readonly BRAND_MAPPING = {
    'DICKIES': '18405',
    'TNF': '18405-1', 
    'ICEBREAKER': '18405-2',
    'VANS': '18405-3',
    'TIMBERLAND': '18405-4'
  };

  // 🔥 关键修复：平台映射配置 - 前端选择器值到后端数据库查询值的映射
  // 这个映射将前端的平台选择转换为后端能够识别的查询条件
  private readonly PLATFORM_MAPPING = {
    'tmall': '天猫',        // 天猫
    'douyin': '抖音',       // 抖音  
    'jd': '京东',           // 京东
    'pdd': '拼多多',         // 拼多多
    'official': '官网',     // 官网/小程序
    'o2o': 'O2O',          // O2O
    'xiaohongshu': '小红书', // 小红书
    'wechat': '微信'        // 微信小程序
  };

  // 记录API性能指标
  private recordPerformance(
    url: string,
    method: string,
    startTime: number,
    endTime: number,
    success: boolean,
    error?: string
  ): void {
    const metric: ApiPerformanceMetrics = {
      url,
      method,
      startTime,
      endTime,
      responseTime: endTime - startTime,
      success,
      error,
      timestamp: Date.now()
    };

    this.performanceMetrics.unshift(metric);
    
    // 保持历史记录在限制范围内
    if (this.performanceMetrics.length > this.MAX_METRICS_HISTORY) {
      this.performanceMetrics = this.performanceMetrics.slice(0, this.MAX_METRICS_HISTORY);
    }
  }

  // 获取性能指标
  getPerformanceMetrics(): ApiPerformanceMetrics[] {
    return [...this.performanceMetrics];
  }

  // 获取按API分组的性能统计
  getPerformanceStats(): { [key: string]: { avgResponseTime: number; successRate: number; count: number } } {
    const stats: { [key: string]: { totalTime: number; successCount: number; totalCount: number } } = {};
    
    this.performanceMetrics.forEach(metric => {
      const key = `${metric.method} ${this.extractEndpoint(metric.url)}`;
      if (!stats[key]) {
        stats[key] = { totalTime: 0, successCount: 0, totalCount: 0 };
      }
      
      stats[key].totalTime += metric.responseTime;
      stats[key].totalCount += 1;
      if (metric.success) {
        stats[key].successCount += 1;
      }
    });

    const result: { [key: string]: { avgResponseTime: number; successRate: number; count: number } } = {};
    
    Object.entries(stats).forEach(([key, data]) => {
      result[key] = {
        avgResponseTime: Math.round(data.totalTime / data.totalCount),
        successRate: Math.round((data.successCount / data.totalCount) * 100),
        count: data.totalCount
      };
    });

    return result;
  }

  // 提取API端点名称
  private extractEndpoint(url: string): string {
    const urlObj = new URL(url);
    return urlObj.pathname.replace('/api', '');
  }

  // 清除性能指标历史
  clearPerformanceMetrics(): void {
    this.performanceMetrics = [];
  }

  // 🔥 新增：安全的JSON解析方法，处理HTML错误响应
  private async safeJsonParse(response: Response, operation: string = 'API请求'): Promise<any> {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error(`❌ [ApiService] ${operation}返回非JSON响应:`, { 
        contentType, 
        responsePreview: responseText.substring(0, 200) 
      });
      
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html>')) {
        throw new Error(`${operation}返回了HTML页面而不是JSON数据，可能是服务器配置错误或端点不存在`);
      }
      
      throw new Error(`${operation}返回了无效的内容类型: ${contentType}`);
    }

    try {
      return await response.json();
    } catch (parseError: any) {
      console.error(`❌ [ApiService] ${operation}JSON解析失败:`, parseError);
      throw new Error(`${operation}的响应数据格式错误: ${parseError.message}`);
    }
  }

  // 增强的fetch方法，包含性能监控
  private async performanceFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const startTime = performance.now();
    let success = false;
    let error: string | undefined;

    try {
      const response = await fetch(url, options);
      success = response.ok;
      if (!response.ok) {
        error = `HTTP ${response.status} ${response.statusText}`;
      }
      
      const endTime = performance.now();
      this.recordPerformance(url, options.method || 'GET', startTime, endTime, success, error);
      
      return response;
    } catch (err: any) {
      const endTime = performance.now();
      error = err.message || '网络错误';
      this.recordPerformance(url, options.method || 'GET', startTime, endTime, false, error);
      throw err;
    }
  }

  // 快速健康检查（带缓存）
  async quickHealthCheck(): Promise<boolean> {
    const now = Date.now();
    
    // 如果有缓存且未过期，直接返回缓存结果
    if (this.healthCheckCache && 
        (now - this.healthCheckCache.timestamp) < this.HEALTH_CHECK_CACHE_DURATION) {
      return this.healthCheckCache.isHealthy;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时
      
      const response = await this.performanceFetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      const isHealthy = response.ok;
      
      // 更新缓存
      this.healthCheckCache = {
        isHealthy,
        timestamp: now
      };
      
      return isHealthy;
    } catch (error: any) {
      // 更新缓存为失败状态
      this.healthCheckCache = {
        isHealthy: false,
        timestamp: now
      };
      
      return false;
    }
  }

  // 详细健康检查
  async getHealthStatus(): Promise<any> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await this.performanceFetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`健康检查失败: ${response.status}`);
      }

      return await this.safeJsonParse(response, '健康检查');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('健康检查超时');
      }
      console.error('健康检查失败:', error);
      throw error;
    }
  }

  // 🔥 修复版：获取包含真实同比环比数据的总览数据
  async getOverviewData(options: APIRequestOptions = {}): Promise<any> {
    const { dateRange, brand, platform, signal } = options;
    
    try {
      const params = new URLSearchParams();
      
      // 修正参数名称匹配后端期望的参数
      if (dateRange?.from) {
        params.append('dateFrom', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('dateTo', dateRange.to);
      }
      
      // 🔥 重要修复：处理品牌和平台参数映射
      console.log('🔍 [ApiService] Processing filter parameters:', { brand, platform });
      
      if (brand && brand !== 'all') {
        // 品牌映射：前端品牌名称 -> 后端品牌代码
        const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
        console.log('🏷️ [ApiService] Brand mapping:', { original: brand, mapped: mappedBrand });
        params.append('brand', mappedBrand);
      } else {
        console.log('🏷️ [ApiService] Brand parameter not added:', brand);
      }
      
      if (platform && platform !== 'all') {
        // 🔥 关键修复：平台映射 - 前端选择器值 -> 后端查询值
        const mappedPlatform = this.PLATFORM_MAPPING[platform as keyof typeof this.PLATFORM_MAPPING] || platform;
        console.log('🏪 [ApiService] Platform mapping:', { 
          original: platform, 
          mapped: mappedPlatform,
          explanation: '前端选择器值映射为数据库BAS_CODES表UDF1字段查询值'
        });
        params.append('platform', mappedPlatform);
      } else {
        console.log('🏪 [ApiService] Platform parameter not added:', platform);
      }

      // 🔥 修复：调用包含同比环比数据的新API端点
      const url = `${this.baseURL}/overview/kpi-with-trends${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('🌐 [ApiService] Making request to (with trends):', url);
      console.log('📋 [ApiService] Query parameters:', params.toString());
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
      
      const response = await this.performanceFetch(url, {
        method: 'GET',
        signal: signal || controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await this.safeJsonParse(response, '总览数据获取（含同比环比）');
      
      // 🔥 修复：验证同比环比数据
      const kpiData = data.data?.kpi || {};
      const hasHistoricalData = kpiData.lastMonthOrders !== undefined || kpiData.lastYearOrders !== undefined;
      const hasTrendData = kpiData.momGrowth !== undefined || kpiData.yoyGrowth !== undefined;
      const hasExceptionStats = data.data?.exceptionStats;
      
      console.log('✅ [ApiService] API response with trends received:', {
        success: data.success,
        hasData: !!data.data,
        filters: data.filters,
        trendsInfo: {
          hasHistoricalData: hasHistoricalData,
          hasTrendData: hasTrendData,
          momGrowth: kpiData.momGrowth,
          yoyGrowth: kpiData.yoyGrowth,
          lastMonthOrders: kpiData.lastMonthOrders,
          lastYearOrders: kpiData.lastYearOrders
        },
        exceptionStats: hasExceptionStats ? {
          pickupTimeouts: data.data.exceptionStats.pickupTimeouts || 0,
          shippingTimeouts: data.data.exceptionStats.shippingTimeouts || 0,
          deliveryTimeouts: data.data.exceptionStats.deliveryTimeouts || 0,
          noUpdate48h: data.data.exceptionStats.noUpdate48h || 0
        } : null
      });
      
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }
      
      // 如果新的API不存在，回退到原来的API
      if (error.message.includes('404')) {
        console.warn('⚠️ [ApiService] 新API不存在，回退到原API');
        return this.getOverviewDataFallback(options);
      }
      
      if (error.message.includes('fetch')) {
        throw new Error('无法连接到API服务器，请确认后端服务是否已启动');
      }
      
      console.error('❌ [ApiService] 获取总览数据失败:', error);
      throw new Error(`获取总览数据失败: ${error.message}`);
    }
  }

  // 🔥 新增：回退到原有API的方法（用于向后兼容）
  private async getOverviewDataFallback(options: APIRequestOptions = {}): Promise<any> {
    const { dateRange, brand, platform, signal } = options;
    
    try {
      const params = new URLSearchParams();
      
      if (dateRange?.from) {
        params.append('dateFrom', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('dateTo', dateRange.to);
      }
      
      if (brand && brand !== 'all') {
        const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
        params.append('brand', mappedBrand);
      }
      
      if (platform && platform !== 'all') {
        const mappedPlatform = this.PLATFORM_MAPPING[platform as keyof typeof this.PLATFORM_MAPPING] || platform;
        params.append('platform', mappedPlatform);
      }

      // 回退到原来的API端点
      const url = `${this.baseURL}/overview/kpi${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('🔄 [ApiService] Fallback to original API:', url);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await this.performanceFetch(url, {
        method: 'GET',
        signal: signal || controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await this.safeJsonParse(response, '总览数据获取（回退版）');
      
      // 添加空的同比环比数据，确保前端兼容性
      if (data.data && data.data.kpi) {
        data.data.kpi.lastMonthOrders = null;
        data.data.kpi.lastYearOrders = null;
        data.data.kpi.momGrowth = null;
        data.data.kpi.yoyGrowth = null;
      }
      
      console.log('✅ [ApiService] Fallback API response received (without trends)');
      
      return data;
    } catch (error: any) {
      console.error('❌ [ApiService] 回退API也失败了:', error);
      throw error;
    }
  }

  // 🔥 修复：获取物流数据，支持异常数据接口
  async getLogisticsData(options: APIRequestOptions = {}): Promise<any> {
    const { dateRange, brand, signal } = options;
    
    try {
      const params = new URLSearchParams();
      
      if (dateRange?.from) {
        params.append('dateFrom', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('dateTo', dateRange.to);
      }
      if (brand && brand !== 'all') {
        const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
        params.append('brand', mappedBrand);
      }

      console.log('🚚 [ApiService] 获取物流数据，参数:', { dateRange, brand });

      // 🔥 同时获取快递商数据和异常数据
      const [couriersResponse, exceptionsResponse] = await Promise.all([
        // 获取快递商基础数据
        this.fetchLogisticsCouriers(params, signal),
        // 获取异常数据详情
        this.fetchLogisticsExceptions(params, signal)
      ]);

      console.log('✅ [ApiService] 物流数据获取成功:', {
        快递商数据: !!couriersResponse.data,
        异常数据: !!exceptionsResponse.data,
        快递商数量: couriersResponse.data?.length || 0,
        异常统计: exceptionsResponse.data?.summary || {}
      });

      // 🔥 合并快递商数据和异常数据
      const mergedData = this.mergeCouriersWithExceptions(couriersResponse, exceptionsResponse);

      return {
        success: true,
        data: mergedData,
        timestamp: new Date().toISOString(),
        sources: {
          couriers: couriersResponse.success,
          exceptions: exceptionsResponse.success
        }
      };

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }
      
      if (error.message.includes('fetch')) {
        throw new Error('无法连接到API服务器，请确认后端服务是否已启动');
      }
      
      console.error('❌ [ApiService] 获取物流数据失败:', error);
      throw new Error(`获取物流数据失败: ${error.message}`);
    }
  }

  // 🔥 新增：获取快递商基础数据
  private async fetchLogisticsCouriers(params: URLSearchParams, signal?: AbortSignal): Promise<any> {
    const url = `${this.baseURL}/logistics/couriers${params.toString() ? `?${params.toString()}` : ''}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await this.performanceFetch(url, {
        method: 'GET',
        signal: signal || controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`快递商数据API请求失败: ${response.status} ${response.statusText}`);
      }

      return await this.safeJsonParse(response, '快递商数据获取');
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // 🔥 新增：获取异常数据详情
  private async fetchLogisticsExceptions(params: URLSearchParams, signal?: AbortSignal): Promise<any> {
    const url = `${this.baseURL}/logistics/exceptions${params.toString() ? `?${params.toString()}` : ''}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await this.performanceFetch(url, {
        method: 'GET',
        signal: signal || controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // 如果异常接口不存在，返回空数据而不报错
        if (response.status === 404) {
          console.warn('⚠️ [ApiService] 异常数据接口不存在，使用空数据');
          return { success: false, data: { courierExceptions: [], summary: {} } };
        }
        throw new Error(`异常数据API请求失败: ${response.status} ${response.statusText}`);
      }

      return await this.safeJsonParse(response, '异常数据获取');
    } catch (error) {
      clearTimeout(timeoutId);
      
      // 如果异常接口调用失败，返回空数据继续执行
      console.warn('⚠️ [ApiService] 异常数据获取失败，继续使用快递商数据:', error);
      return { success: false, data: { courierExceptions: [], summary: {} } };
    }
  }

  // 🔥 新增：合并快递商数据和异常数据
  private mergeCouriersWithExceptions(couriersResponse: any, exceptionsResponse: any): any[] {
    const couriers = couriersResponse.data || [];
    const exceptions = exceptionsResponse.data?.courierExceptions || [];
    
    if (!Array.isArray(couriers)) {
      console.warn('⚠️ [ApiService] 快递商数据格式异常，返回空数组');
      return [];
    }

    console.log('🔀 [ApiService] 合并快递商数据和异常数据:', {
      快递商数量: couriers.length,
      异常数据数量: exceptions.length
    });

    // 合并数据
    const mergedCouriers = couriers.map(courier => {
      // 查找对应的异常数据
      const courierExceptions = exceptions.find(ex => ex.carrierId === courier.carrierId);
      
      if (courierExceptions) {
        // 如果找到异常数据，合并到快递商数据中
        return {
          ...courier,
          // 🔥 关键：添加详细的异常数据字段
          pickupTimeout: courierExceptions.pickupTimeout || 0,
          shippingTimeout: courierExceptions.shippingTimeout || 0,
          deliveryTimeout: courierExceptions.deliveryTimeout || 0,
          noUpdate48h: courierExceptions.noUpdate48h || 0,
          // 🔥 兼容多种字段名格式
          pickup_timeout: courierExceptions.pickupTimeout || 0,
          shipping_timeout: courierExceptions.shippingTimeout || 0,
          delivery_timeout: courierExceptions.deliveryTimeout || 0,
          no_update_48h: courierExceptions.noUpdate48h || 0,
          // 保留原有异常字段以确保兼容性
          notPickedOver2h: courierExceptions.pickupTimeout || courier.notPickedOver2h || 0,
          notShippedOver12h: courierExceptions.shippingTimeout || courier.notShippedOver12h || 0,
          notUpdatedOver48h: courierExceptions.noUpdate48h || courier.notUpdatedOver48h || 0,
          notDeliveredOver3days: courierExceptions.deliveryTimeout || courier.notDeliveredOver3days || 0,
          // 异常率信息
          exceptionRate: courierExceptions.exceptionRate || courier.exceptionRate || 0,
          totalExceptions: courierExceptions.totalExceptions || courier.totalExceptions || 0
        };
      } else {
        // 如果没有找到异常数据，使用原始数据或默认值
        return {
          ...courier,
          pickupTimeout: 0,
          shippingTimeout: 0,
          deliveryTimeout: 0,
          noUpdate48h: 0,
          pickup_timeout: 0,
          shipping_timeout: 0,
          delivery_timeout: 0,
          no_update_48h: 0,
          notPickedOver2h: courier.notPickedOver2h || 0,
          notShippedOver12h: courier.notShippedOver12h || 0,
          notUpdatedOver48h: courier.notUpdatedOver48h || 0,
          notDeliveredOver3days: courier.notDeliveredOver3days || 0
        };
      }
    });

    console.log('✅ [ApiService] 数据合并完成，返回', mergedCouriers.length, '个快递商');
    return mergedCouriers;
  }

  // 🔥 新增：获取物流品牌维度数据
  async getLogisticsBrands(options: APIRequestOptions = {}): Promise<any> {
    const { dateRange, brand, platform, signal } = options;
    
    try {
      const params = new URLSearchParams();
      
      if (dateRange?.from) {
        params.append('dateFrom', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('dateTo', dateRange.to);
      }
      if (brand && brand !== 'all') {
        const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
        params.append('brand', mappedBrand);
      }
      if (platform && platform !== 'all') {
        const mappedPlatform = this.PLATFORM_MAPPING[platform as keyof typeof this.PLATFORM_MAPPING] || platform;
        params.append('platform', mappedPlatform);
      }

      const url = `${this.baseURL}/logistics/brands${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('🏷️ [ApiService] 获取物流品牌数据:', url);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await this.performanceFetch(url, {
        method: 'GET',
        signal: signal || controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`品牌物流数据API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await this.safeJsonParse(response, '品牌物流数据获取');
      console.log('✅ [ApiService] 品牌物流数据获取成功:', {
        success: data.success,
        brandCount: data.data?.brandExceptions?.length || 0
      });

      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }
      
      if (error.message.includes('fetch')) {
        throw new Error('无法连接到API服务器，请确认后端服务是否已启动');
      }
      
      console.error('❌ [ApiService] 获取品牌物流数据失败:', error);
      throw new Error(`获取品牌物流数据失败: ${error.message}`);
    }
  }
}

export const ApiService = new ApiServiceClass();
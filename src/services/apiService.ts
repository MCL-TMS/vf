import type { DateRange } from '../data/types';

interface APIRequestOptions {
  dateRange?: DateRange;
  brand?: string | string[] | null;
  platform?: string | null;
  selfFlag?: string | null;
  userBrands?: string[]; // 🔥 新增：用户品牌权限
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
  private baseURL = 'http://localhost:3001/api';
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

  /**
   * 导出订单明细数据（支持分批导出，无数量上限）
   */
  async exportOrderDetails(filters: {
    startDate: string;
    endDate: string;
    brand?: string;
    platform?: string;
    selfFlag?: string;
    batchSize?: number;  // 每批次数量（默认5000）
  }): Promise<any[]> {
    try {
      const batchSize = filters.batchSize || 10000;  // 🔥 默认批次大小从5000改为10000，加快导出速度
      
      console.log('📊 开始导出订单明细（无数量限制）...');
      console.log('筛选条件:', filters);
      
      // 第一批：获取数据并检查总量
      const firstBatchData = await this.fetchOrderDetailsBatch(filters, batchSize);
      
      console.log(`✅ 第一批数据获取成功: ${firstBatchData.length} 条`);
      
      // 如果第一批就少于批次大小，说明数据已全部获取
      if (firstBatchData.length < batchSize) {
        console.log('✅ 数据量较小，一次性导出完成');
        return firstBatchData;
      }
      
      // 数据量较大，需要分批导出
      console.log('📦 数据量较大，开始分批导出...');
      let allData = [...firstBatchData];
      let offset = batchSize;
      let batchNumber = 2;
      
      // ♾️ 无限循环，直到获取所有数据
      while (true) {
        console.log(`📥 获取第 ${batchNumber} 批数据 (offset: ${offset})...`);
        
        const batchData = await this.fetchOrderDetailsBatch(
          { ...filters, offset },
          batchSize
        );
        
        // 如果没有数据返回，说明已经获取完毕
        if (batchData.length === 0) {
          console.log('✅ 所有数据已获取完毕');
          break;
        }
        
        allData = [...allData, ...batchData];
        console.log(`✅ 第 ${batchNumber} 批数据获取成功: ${batchData.length} 条，累计: ${allData.length} 条`);
        
        // 如果本批数据少于批次大小，说明已经是最后一批
        if (batchData.length < batchSize) {
          console.log('✅ 已获取最后一批数据');
          break;
        }
        
        offset += batchSize;
        batchNumber++;
        
        // 安全检查：如果批次数超过合理范围（200批 = 100万条），给出警告但继续
        if (batchNumber > 200) {
          console.warn(`⚠️ 已获取 ${batchNumber} 批数据 (${allData.length} 条)，数据量非常大，请确认筛选条件是否正确`);
        }
      }
      
      console.log(`🎉 导出完成！共获取 ${allData.length} 条数据`);
      return allData;
      
    } catch (error) {
      console.error('❌ 导出订单明细失败:', error);
      throw error;
    }
  }

  /**
   * 获取单批订单明细数据
   */
  private async fetchOrderDetailsBatch(
    filters: {
      startDate: string;
      endDate: string;
      brand?: string;
      platform?: string;
      selfFlag?: string;
      offset?: number;
    },
    limit: number
  ): Promise<any[]> {
    const params = new URLSearchParams();
    params.append('startDate', filters.startDate);
    params.append('endDate', filters.endDate);
    
    if (filters.brand && filters.brand !== 'all') {
      params.append('brand', filters.brand);
    }
    
    if (filters.platform && filters.platform !== 'all') {
      params.append('platform', filters.platform);
    }
    
    if (filters.selfFlag) {
      params.append('selfFlag', filters.selfFlag);
    }
    
    // 分批参数
    params.append('limit', limit.toString());
    if (filters.offset) {
      params.append('offset', filters.offset.toString());
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

    try {
      const response = await fetch(`${this.baseURL}/logistics/order-details/export?${params.toString()}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '导出失败');
      }

      return result.data || [];
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请缩小日期范围或添加更多筛选条件');
      }
      
      throw error;
    }
  }

  /**
   * 导出时效分析原始数据（RawData）
   */
  async exportTimelinessRawData(filters: {
    dateRange: { from: string; to: string };
    selectedBrand?: string;
    selectedSelfFlag?: string;
    selectedCarrier?: string;
    analysisType?: string;
    userBrands?: string[];
  }): Promise<any[]> {
    try {
      console.log('📊 开始导出时效分析RawData...', filters);
      
      const response = await fetch(`${this.baseURL}/upload/export-timeliness-rawdata`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '导出失败');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '导出失败');
      }

      console.log(`✅ 时效分析RawData获取功: ${result.data?.length || 0} 条`);
      
      // 🔍 调试：打印第一条数据查看字段
      if (result.data && result.data.length > 0) {
        console.log('🔍 API返回的第一条数据:', result.data[0]);
        console.log('🔍 实际时效区间:', result.data[0]['实际时效区间']);
        console.log('🔍 计划时效区间:', result.data[0]['计划时效区间']);
      }
      
      return result.data || [];
      
    } catch (error: any) {
      console.error('❌ 时效分析RawData导出失败:', error);
      throw error;
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
    const { dateRange, brand, platform, selfFlag, userBrands, signal } = options;
    
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
      console.log('🔍 [ApiService] Processing filter parameters:', { 
        brand, 
        brandType: Array.isArray(brand) ? 'array' : typeof brand,  // 🔍 检查类型
        brandLength: Array.isArray(brand) ? brand.length : 'N/A',   // 🔍 数组长度
        platform, 
        selfFlag 
      });
      
      if (brand && brand !== 'all') {
        // 🔐 品牌权限控制：支持单个品牌、多个品牌（数组）或品牌代码
        // 类型：string | string[]
        
        if (Array.isArray(brand)) {
          // ✅ 方案A：直接是数组 ['18405-1', '18405-2']
          // 使用HTTP标准的多参数方式：?brand=18405-1&brand=18405-2
          brand.forEach(brandCode => {
            params.append('brand', brandCode);
          });
          console.log('🏷️ [ApiService] 多品牌查询（数组）:', brand);
        } else {
          // 单个品牌（字符串）
          const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
          console.log('🏷️ [ApiService] Brand mapping:', { original: brand, mapped: mappedBrand });
          params.append('brand', mappedBrand);
        }
      }
      
      // 🔥 新增：始终传递用户品牌权限（无论是否选择了specific品牌）
      if (userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
        params.append('userBrands', userBrands.join(','));  // 🔥 使用逗号分隔，而不是JSON
        console.log('🔐 [ApiService] 传递用户品牌权限:', userBrands.join(','));
      } else {
        console.log('🏷️ [ApiService] Brand parameter not added:', brand);
      }
      
      if (platform && platform !== 'all') {
        // 直接发送平台代码给后端，由后端负责映射
        console.log('🏪 [ApiService] Sending platform code to backend:', platform);
        params.append('platform', platform);
      } else {
        console.log('🏪 [ApiService] Platform parameter not added:', platform);
      }

      // 🔥 修复：自管筛选参数处理 - 解决数据不一致问题
      // ⚠️ 重要说明：此处传递的selfFlag参数将直接用于数据库TSK_LIST_TASK.SELF_FLAG字段查询
      // 真实API返回的数据完全基于订单的实际SELF_FLAG值，无任何比例调整
      if (selfFlag && selfFlag !== 'all') {
        console.log('🔧 [ApiService] Self flag mapping (real data query):', { original: selfFlag });
        params.append('selfFlag', selfFlag);
      } else if (selfFlag === 'all') {
        console.log('🔧 [ApiService] Self flag = all, no SELF_FLAG filter applied:', selfFlag);
        // ❌ 修复：当选择"全部"时，不传递selfFlag参数，后端将不添加SELF_FLAG筛选条件
        // 不添加 params.append('selfFlag', ...)
      } else {
        console.log('🔧 [ApiService] Self flag empty, using default Y:', selfFlag);
        // 仅当selfFlag为null/undefined时才默认为自管
        params.append('selfFlag', 'Y');
      }

      // 🔥 修复：调用KPI数据API端点
      const url = `${this.baseURL}/overview/kpi${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('🌐 [ApiService] Making request to:', url);
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
      
      // 🔥 新增：调试 crossAnalysisData 是否包含效率指标
      console.log('🔍 [ApiService] 原始 API 响应 - crossAnalysisData 结构检查:', {
        hasCrossAnalysisData: !!data.data?.crossAnalysisData,
        crossAnalysisDataLength: data.data?.crossAnalysisData?.length || 0,
        firstRecordKeys: data.data?.crossAnalysisData?.[0] ? Object.keys(data.data.crossAnalysisData[0]) : [],
        firstRecordValues: data.data?.crossAnalysisData?.[0] || null,
        hasEfficiencyFields: data.data?.crossAnalysisData?.[0] ? {
          hasFirstDispatchSuccessRate: 'firstDispatchSuccessRate' in data.data.crossAnalysisData[0],
          hasAvgFirstDispatchHours: 'avgFirstDispatchHours' in data.data.crossAnalysisData[0],
          hasAvgDeliveryHours: 'avgDeliveryHours' in data.data.crossAnalysisData[0]
        } : null
      });
      
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
      
      // 🔍 调试：完整的exceptionStats数据
      if (hasExceptionStats) {
        console.log('🔍 [ApiService] 完整的 exceptionStats 数据:', data.data.exceptionStats);
      } else {
        console.warn('⚠️ [ApiService] 响应中没有 exceptionStats 数据！');
      }
      
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
    const { dateRange, brand, platform, selfFlag, signal } = options;
    
    try {
      const params = new URLSearchParams();
      
      if (dateRange?.from) {
        params.append('dateFrom', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('dateTo', dateRange.to);
      }
      
      if (brand && brand !== 'all') {
        // 🔐 品牌权限控制：支持多品牌数组（与主方法保持一致）
        if (Array.isArray(brand)) {
          // 多个品牌：使用HTTP标准的多参数方式
          brand.forEach(brandCode => {
            params.append('brand', brandCode);
          });
          console.log('🏷️ [ApiService.Fallback] 多品牌查询（数组）:', brand);
        } else {
          // 单个品牌
          const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
          params.append('brand', mappedBrand);
        }
      }
      
      if (platform && platform !== 'all') {
        const mappedPlatform = this.PLATFORM_MAPPING[platform as keyof typeof this.PLATFORM_MAPPING] || platform;
        params.append('platform', mappedPlatform);
      }

      // 🔥 修复：自管筛选参数 - 回退版本
      if (selfFlag && selfFlag !== 'all') {
        params.append('selfFlag', selfFlag);
      } else if (selfFlag === 'all') {
        // ❌ 修复：当选择"全部"时，不传递selfFlag参数
        // 不添加 params.append('selfFlag', ...)
      } else {
        params.append('selfFlag', 'Y'); // 仅当selfFlag为空时默认为自管
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
      console.error('❌ [ApiService] 回退API也败了:', error);
      throw error;
    }
  }

  // 🔥 修复：获取物流数据，支持异常数据接口
  async getLogisticsData(options: APIRequestOptions = {}): Promise<any> {
    const { dateRange, brand, selfFlag, signal } = options;
    
    try {
      const params = new URLSearchParams();
      
      if (dateRange?.from) {
        params.append('dateFrom', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('dateTo', dateRange.to);
      }
      if (brand && brand !== 'all') {
        // 🔐 品牌权限控制：支持多品牌代码（数组）
        if (Array.isArray(brand)) {
          // ✅ 方案A：直接是数组 ['18405-1', '18405-2']
          brand.forEach(brandCode => {
            params.append('brand', brandCode);
          });
          console.log('🏷️ [ApiService.getLogisticsData] 多品牌查询（数组）:', brand);
        } else {
          const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
          params.append('brand', mappedBrand);
        }
      }
      
      // 🔥 修复：自管筛选参数
      if (selfFlag && selfFlag !== 'all') {
        params.append('selfFlag', selfFlag);
      } else if (selfFlag === 'all') {
        // ❌ 修复：当选择"全部"时，不传递selfFlag参数
        // 不添加 params.append('selfFlag', ...)
      } else {
        params.append('selfFlag', 'Y'); // 仅当selfFlag为空时默认为自管
      }

      console.log('🚚 [ApiService] 获取物流数据，参数:', { dateRange, brand, selfFlag });

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
    const { dateRange, brand, platform, selfFlag, userBrands, signal } = options; // 🔥 添加userBrands
    
    try {
      const params = new URLSearchParams();
      
      if (dateRange?.from) {
        params.append('dateFrom', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('dateTo', dateRange.to);
      }
      if (brand && brand !== 'all') {
        // 🔐 品牌权限控制：支持多品牌代码（数组）
        if (Array.isArray(brand)) {
          // ✅ 方案A：直接是数组 ['18405-1', '18405-2']
          brand.forEach(brandCode => {
            params.append('brand', brandCode);
          });
          console.log('🏷️ [ApiService.getLogisticsBrands] 多品牌查询（数组）:', brand);
        } else {
          const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
          params.append('brand', mappedBrand);
        }
      } else if (brand === 'all' && userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
        // 🔥 新增：当选择"全部品牌"时，传递用户品牌权限
        params.append('userBrands', userBrands.join(','));  // 🔥 使用逗号分隔，而不是JSON
        console.log('🔐 [ApiService.getLogisticsBrands] 传递用户品牌权限:', userBrands.join(','));
      }
      if (platform && platform !== 'all') {
        const mappedPlatform = this.PLATFORM_MAPPING[platform as keyof typeof this.PLATFORM_MAPPING] || platform;
        params.append('platform', mappedPlatform);
      }
      
      // 🔥 修复：自管筛选参数
      if (selfFlag && selfFlag !== 'all') {
        params.append('selfFlag', selfFlag);
      } else if (selfFlag === 'all') {
        // ❌ 修复：当选择"全部"时，不传递selfFlag参数
        // 不添加 params.append('selfFlag', ...)
      } else {
        params.append('selfFlag', 'Y'); // 仅当selfFlag为空时默认为自管
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

  // 🔥 新增：获取转寄分析数据
  async getForwardingData(options: APIRequestOptions = {}): Promise<any> {
    const { dateRange, brand, platform, selfFlag, userBrands, signal } = options; // 🔥 新增：接收userBrands
    
    try {
      const params = new URLSearchParams();
      
      if (dateRange?.from) {
        params.append('startDate', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to);
      }
      if (brand && brand !== 'all') {
        // 🔐 品牌权限控制：支持多品牌代码（数组）
        if (Array.isArray(brand)) {
          // ✅ 方案A：直接是数组 ['18405-1', '18405-2']
          brand.forEach(brandCode => {
            params.append('brand', brandCode);
          });
          console.log('🏷️ [ApiService.getForwardingData] 多品牌查询（数组）:', brand);
        } else {
          const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
          params.append('brand', mappedBrand);
        }
      }
      
      // 🔥 新增：添加用户品牌权限参数
      if (userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
        params.append('userBrands', userBrands.join(','));  // 🔥 使用逗号分隔，而不是JSON
        console.log('🔐 [ApiService.getForwardingData] 用户品牌权限:', userBrands.join(','));
      }
      
      if (platform && platform !== 'all') {
        const mappedPlatform = this.PLATFORM_MAPPING[platform as keyof typeof this.PLATFORM_MAPPING] || platform;
        params.append('platform', mappedPlatform);
      }
      
      // 自管筛选参数
      if (selfFlag && selfFlag !== 'all') {
        params.append('selfFlag', selfFlag);
      } else if (selfFlag === 'all') {
        // 当选择"全部"时，不传递selfFlag参数
      } else {
        params.append('selfFlag', 'Y'); // 默认为自管
      }

      const url = `${this.baseURL}/logistics/forwarding${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('🔁 [ApiService] 获取转寄分析数据:', url);
      console.log('📋 [ApiService] 查询参数:', { dateRange, brand, platform, selfFlag });
      
      // 🔧 增加超时时间到30秒（转寄分析需要执行4个SQL查询）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn('⏱️ [ApiService] 转寄分析API请求超时（30秒）');
        controller.abort();
      }, 30000); // 从10秒增加到30秒
      
      const response = await this.performanceFetch(url, {
        method: 'GET',
        signal: signal || controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`转寄数据API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await this.safeJsonParse(response, '转寄分析数据获取');
      console.log('✅ [ApiService] 转寄分析数据获取成功:', {
        success: data.success,
        addressChangeCount: data.data?.addressChange?.totalCount || 0,
        outOfRangeCount: data.data?.outOfRange?.totalCount || 0,
        courierCount: {
          addressChange: data.data?.addressChange?.byCourier?.length || 0,
          outOfRange: data.data?.outOfRange?.byCourier?.length || 0
        },
        provinceCount: data.data?.outOfRange?.byProvince?.length || 0
      });

      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }
      
      if (error.message.includes('fetch')) {
        throw new Error('无法连接到API服务器，请确认后端服务是否已启动');
      }
      
      console.error('❌ [ApiService] 获取转寄分析数据失败:', error);
      throw new Error(`获取转寄分析数据失败: ${error.message}`);
    }
  }

  // 🔥 新增：获取拦截分析数据
  async getInterceptionData(options: APIRequestOptions & {
    interceptionStatus?: 'success' | 'failed' | 'all';
    interceptLocation?: 'warehouse' | 'external' | 'all';
    userBrands?: string[]; // 🔥 新增：用户品牌权限
  } = {}): Promise<any> {
    const { 
      dateRange, 
      brand, 
      platform, 
      selfFlag, 
      signal,
      interceptionStatus = 'all',
      interceptLocation = 'all',
      userBrands // 🔥 新增
    } = options;
    
    try {
      const params = new URLSearchParams();
      
      // 日期范围
      if (dateRange) {
        params.append('startDate', dateRange.startDate);
        params.append('endDate', dateRange.endDate);
      }
      
      // 品牌筛选
      if (brand && brand !== 'all') {
        if (Array.isArray(brand)) {
          brand.forEach(brandCode => {
            params.append('brand', brandCode);
          });
          console.log('🏷️ [ApiService.getInterceptionData] 多品牌查询（数组）:', brand);
        } else {
          const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
          params.append('brand', mappedBrand);
        }
      }
      
      // 🔥 新增：用户品牌权限（仅当选择"全部品牌"时传递）
      if (userBrands && userBrands.length > 0 && (!brand || brand === 'all')) {
        params.append('userBrands', userBrands.join(','));  // 🔥 使用逗号分隔，而不是JSON
        console.log('🔐 [ApiService.getInterceptionData] 传递用户品牌权限:', userBrands.join(','));
      }
      
      // 平台筛选
      if (platform && platform !== 'all') {
        const mappedPlatform = this.PLATFORM_MAPPING[platform as keyof typeof this.PLATFORM_MAPPING] || platform;
        params.append('platform', mappedPlatform);
      }
      
      // 自管筛选
      if (selfFlag && selfFlag !== 'all') {
        params.append('selfFlag', selfFlag);
      }

      // 拦截状态筛选
      if (interceptionStatus && interceptionStatus !== 'all') {
        params.append('interceptionStatus', interceptionStatus);
      }

      // 拦截位置筛选
      if (interceptLocation && interceptLocation !== 'all') {
        params.append('interceptLocation', interceptLocation);
      }
      
      const apiUrl = import.meta.env.DEV 
        ? `http://localhost:3001/api/logistics/interception?${params.toString()}`
        : `/api/logistics/interception?${params.toString()}`;
      
      console.log('🛑 [ApiService] 拦截分析请求URL:', apiUrl);
      console.log('🛑 [ApiService] 拦截分析请求参数:', {
        dateRange,
        brand,
        platform,
        selfFlag,
        interceptionStatus,
        interceptLocation
      });

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: signal || undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || '拦截分析数据获取失败');
      }
      
      console.log('✅ [ApiService] 拦截分析数据获取成功:', {
        totalCount: data.data?.overview?.totalCount,
        carrierStatsCount: data.data?.carrierStats?.length,
        brandStatsCount: data.data?.brandStats?.length,
        dailyTrendCount: data.data?.dailyTrend?.length,
        orderDetailsCount: data.data?.orderDetails?.length
      });

      return data;
    } catch (error: any) {
      console.error('❌ [ApiService] 拦截分析数据获取失败:', error);
      throw new Error(`获取拦截分析数据失败: ${error.message}`);
    }
  }
  
  // 🔥 新增：获取平台列表（从PLATFORM_MAPPING动态生成）
  async getPlatformList(): Promise<Array<{ code: string; name: string }>> {
    // 从平台映射中动态生成平台列表
    const platformList = Object.entries(this.PLATFORM_MAPPING).map(([code, name]) => ({
      code,
      name
    }));
    
    console.log('✅ [ApiService.getPlatformList] 返回平台列表:', platformList);
    return platformList;
  }

  // 🔥 新增：获取异常监控分析数据
  async getExceptionAnalysisData(options?: APIRequestOptions): Promise<any> {
    try {
      const params = new URLSearchParams();
      
      // 🔥 必需参数：日期范围
      if (options?.dateFrom) params.append('dateFrom', options.dateFrom);
      if (options?.dateTo) params.append('dateTo', options.dateTo);
      
      // 🔥 可选参数：品牌、平台、自管
      if (options?.selectedBrand) params.append('brand', options.selectedBrand);
      if (options?.selectedPlatform) params.append('platform', options.selectedPlatform);
      if (options?.selfFlag !== undefined) params.append('selfFlag', options.selfFlag);
      
      // 🔥 用户品牌权限
      if (options?.userBrands) params.append('userBrands', options.userBrands);
      
      const url = `${this.baseURL}/exception-analysis/overview${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('🔍 [ApiService] 获取异常监控分析数据:', url);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await this.performanceFetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log('✅ [ApiService] 异常监控分析数据获取成功:', {
        totalExceptions: data.data?.summary?.totalExceptions,
        responsibilityCount: data.data?.byResponsibility?.length,
        carrierCount: data.data?.byCarrier?.length,
        reasonCount: data.data?.byReason?.length,
        crossAnalysisCount: data.data?.crossAnalysis?.length
      });
      
      return data;
    } catch (error: any) {
      console.error('❌ [ApiService] 异常监控分析数据获取失败:', error);
      throw new Error(`获取异常监控分析数据失败: ${error.message}`);
    }
  }

  // 🔥 新增：获取快递商异常详情
  async getCarrierExceptionDetails(carrierName: string, options: APIRequestOptions = {}): Promise<any> {
    const { dateRange, brand, platform, selfFlag, userBrands } = options;
    
    try {
      const params = new URLSearchParams();
      
      if (dateRange?.from) {
        params.append('dateFrom', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('dateTo', dateRange.to);
      }
      if (brand && brand !== 'all') {
        if (Array.isArray(brand)) {
          brand.forEach(brandCode => {
            params.append('brand', brandCode);
          });
        } else {
          const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
          params.append('brand', mappedBrand);
        }
      } else if (brand === 'all' && userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
        params.append('userBrands', userBrands.join(','));
      }
      if (platform && platform !== 'all') {
        const mappedPlatform = this.PLATFORM_MAPPING[platform as keyof typeof this.PLATFORM_MAPPING] || platform;
        params.append('platform', mappedPlatform);
      }
      if (selfFlag && selfFlag !== 'all') {
        params.append('selfFlag', selfFlag);
      }
      
      const url = `${this.baseURL}/logistics/carriers/${encodeURIComponent(carrierName)}/exceptions?${params.toString()}`;
      
      console.log(`🔍 [ApiService] 获取快递商异常详情: ${carrierName}`, url);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await this.performanceFetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      console.log(`✅ [ApiService] ${carrierName} 异常详情获取成功:`, {
        detailsCount: data.data?.details?.length
      });
      
      return data;
    } catch (error: any) {
      console.error(`❌ [ApiService] ${carrierName} 异常详情获取失败:`, error);
      throw new Error(`获取快递商异常详情失败: ${error.message}`);
    }
  }

  // 🎯 新增：获取异常监控分析数据（基于责任方和异常原因）
  async getExceptionAnalysis(options: APIRequestOptions = {}): Promise<any> {
    const { dateRange, brand, platform, selfFlag, userBrands, signal } = options;
    
    console.log('🔍 [ApiService.getExceptionAnalysis] 接收到的参数:', {
      dateRange,
      brand,
      platform,
      selfFlag,
      userBrands
    });
    
    try {
      const params = new URLSearchParams();
      
      // 日期范围（必需）
      if (dateRange?.from) {
        params.append('dateFrom', dateRange.from);
      }
      if (dateRange?.to) {
        params.append('dateTo', dateRange.to);
      }
      
      // 品牌筛选
      if (brand && brand !== 'all') {
        if (Array.isArray(brand)) {
          brand.forEach(brandCode => {
            params.append('brand', brandCode);
          });
          console.log('🏷️ [ApiService.getExceptionAnalysis] 多品牌查询:', brand);
        } else {
          const mappedBrand = this.BRAND_MAPPING[brand as keyof typeof this.BRAND_MAPPING] || brand;
          params.append('brand', mappedBrand);
          console.log('🏷️ [ApiService.getExceptionAnalysis] 单品牌查询:', mappedBrand);
        }
      } else if (brand === 'all' && userBrands && Array.isArray(userBrands) && userBrands.length > 0) {
        // 用户品牌权限
        params.append('userBrands', userBrands.join(','));
        console.log('🔐 [ApiService.getExceptionAnalysis] 用户品牌权限:', userBrands.join(','));
      } else {
        // 如果没有指定品牌，也没有用户品牌权限，添加 brand=all
        console.log('⚠️ [ApiService.getExceptionAnalysis] 无品牌筛选条件，添加 brand=all');
        params.append('brand', 'all');
      }
      
      // 平台筛选
      if (platform && platform !== 'all') {
        const mappedPlatform = this.PLATFORM_MAPPING[platform as keyof typeof this.PLATFORM_MAPPING] || platform;
        params.append('platform', mappedPlatform);
      }
      
      // 自管筛选
      if (selfFlag && selfFlag !== 'all') {
        params.append('selfFlag', selfFlag);
      } else if (!selfFlag || selfFlag === '') {
        params.append('selfFlag', 'Y'); // 默认自管
      }
      
      const url = `${this.baseURL}/exception-analysis/overview?${params.toString()}`;
      
      console.log('📊 [ApiService] 获取异常监控分析数据:', url);
      console.log('筛选参数:', { dateRange, brand, platform, selfFlag, userBrands });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await this.performanceFetch(url, {
        method: 'GET',
        signal: signal || controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`异常监控分析API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await this.safeJsonParse(response, '异常监控分析数据获取');
      
      console.log('✅ [ApiService] 异常监控分析数据获取成功:', {
        success: data.success,
        totalExceptions: data.data?.summary?.totalExceptions || 0,
        responsibilityGroups: data.data?.byResponsibility?.length || 0,
        carrierGroups: data.data?.byCarrier?.length || 0,
        reasonGroups: data.data?.byReason?.length || 0,
        crossAnalysisRecords: data.data?.crossAnalysis?.length || 0
      });

      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }
      
      if (error.message.includes('fetch')) {
        throw new Error('无法连接到API服务器，请确认后端服务是否已启动');
      }
      
      console.error('❌ [ApiService] 获取异常监控分析数据失败:', error);
      throw new Error(`获取异常监控分析数据失败: ${error.message}`);
    }
  }
}

export const ApiService = new ApiServiceClass();

// 🔥 导出常用方法的简化版本
export const getHealthStatus = () => ApiService.getHealthStatus();
export const quickHealthCheck = () => ApiService.quickHealthCheck();
export const getOverviewData = (options?: APIRequestOptions) => ApiService.getOverviewData(options);
export const getLogisticsData = (options?: APIRequestOptions) => ApiService.getLogisticsData(options);
export const getLogisticsBrands = (options?: APIRequestOptions) => ApiService.getLogisticsBrands(options);
export const getForwardingData = (options?: APIRequestOptions) => ApiService.getForwardingData(options);
export const getInterceptionData = (options?: any) => ApiService.getInterceptionData(options);
export const getPlatformList = () => ApiService.getPlatformList(); // 🔥 导出平台列表方法
export const exportOrderDetails = (options: APIRequestOptions) => ApiService.exportOrderDetails(options); // 🔥 导出订单明细
export const exportTimelinessRawData = (options: any) => ApiService.exportTimelinessRawData(options); // 🔥 导出时效分析RawData
export const getExceptionAnalysisData = (options?: any) => ApiService.getExceptionAnalysisData(options); // 🔥 异常监控分析数据
export const getCarrierExceptionDetails = (carrierName: string, options?: any) => ApiService.getCarrierExceptionDetails(carrierName, options); // 🔥 快递商异常详情
export const getExceptionAnalysis = (options?: APIRequestOptions) => ApiService.getExceptionAnalysis(options); // 🔥 异常监控分析数据（基于责任方和异常原因）
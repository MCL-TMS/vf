/**
 * 自动注入运行时监测
 * 自动追踪 API 调用、路由变化等
 */

import { runtimeMonitor } from './runtimeMonitor';

/**
 * 注入 API 监测
 * 拦截 fetch 和 XMLHttpRequest
 */
export function injectAPIMonitoring() {
  // 拦截 fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const startTime = performance.now();
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    const method = args[1]?.method || 'GET';

    try {
      const response = await originalFetch.apply(this, args);
      const duration = performance.now() - startTime;
      
      runtimeMonitor.recordAPI(url, method, duration, {
        status: response.status,
        statusText: response.statusText
      });
      
      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      runtimeMonitor.recordAPI(url, method, duration, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  };

  console.log('✅ [RuntimeMonitor] API监测已注入');
}

/**
 * 注入路由监测
 * 监听 popstate 和 pushState/replaceState
 */
export function injectRouteMonitoring() {
  // 监听 popstate（浏览器前进/后退）
  window.addEventListener('popstate', () => {
    runtimeMonitor.recordRoute(window.location.pathname);
  });

  // 拦截 pushState
  const originalPushState = history.pushState;
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    const result = originalPushState.apply(this, args);
    runtimeMonitor.recordRoute(window.location.pathname);
    return result;
  };

  // 拦截 replaceState
  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    const result = originalReplaceState.apply(this, args);
    runtimeMonitor.recordRoute(window.location.pathname);
    return result;
  };

  console.log('✅ [RuntimeMonitor] 路由监测已注入');
}

/**
 * 注入性能监测
 * 使用 Performance Observer API
 */
export function injectPerformanceMonitoring() {
  if ('PerformanceObserver' in window) {
    // 监测资源加载
    const resourceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resourceEntry = entry as PerformanceResourceTiming;
          runtimeMonitor.recordFunction(
            `Load: ${resourceEntry.name.split('/').pop() || resourceEntry.name}`,
            resourceEntry.name,
            resourceEntry.duration
          );
        }
      }
    });

    try {
      resourceObserver.observe({ entryTypes: ['resource'] });
      console.log('✅ [RuntimeMonitor] 资源加载监测已注入');
    } catch (e) {
      console.warn('⚠️ [RuntimeMonitor] 资源加载监测不支持');
    }

    // 监测长任务
    if ('PerformanceObserver' in window && 'PerformanceLongTaskTiming' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          runtimeMonitor.recordFunction(
            'Long Task',
            'performance',
            entry.duration
          );
        }
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        console.log('✅ [RuntimeMonitor] 长任务监测已注入');
      } catch (e) {
        console.warn('⚠️ [RuntimeMonitor] 长任务监测不支持');
      }
    }
  }
}

/**
 * 注入错误监测
 */
export function injectErrorMonitoring() {
  // 监听全局错误
  window.addEventListener('error', (event) => {
    runtimeMonitor.recordCall({
      type: 'function',
      name: `Error: ${event.message}`,
      file: event.filename || 'unknown',
      details: {
        message: event.message,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      }
    });
  });

  // 监听未捕获的 Promise 错误
  window.addEventListener('unhandledrejection', (event) => {
    runtimeMonitor.recordCall({
      type: 'function',
      name: `Unhandled Promise Rejection: ${event.reason}`,
      file: 'promise',
      details: {
        reason: event.reason
      }
    });
  });

  console.log('✅ [RuntimeMonitor] 错误监测已注入');
}

/**
 * 注入控制台监测
 * 追踪 console.log/warn/error 调用
 */
export function injectConsoleMonitoring() {
  const consoleTypes = ['log', 'warn', 'error', 'info'] as const;
  
  consoleTypes.forEach((type) => {
    const original = console[type];
    console[type] = function (...args: any[]) {
      // 只记录包含特定标记的日志（避免日志爆炸）
      const firstArg = String(args[0] || '');
      if (firstArg.includes('[') || firstArg.includes('🔍')) {
        runtimeMonitor.recordFunction(
          `console.${type}: ${firstArg.substring(0, 50)}`,
          'console',
          0
        );
      }
      original.apply(console, args);
    };
  });

  console.log('✅ [RuntimeMonitor] 控制台监测已注入');
}

/**
 * 初始化所有监测
 */
export function initializeMonitoring(options: {
  api?: boolean;
  route?: boolean;
  performance?: boolean;
  error?: boolean;
  console?: boolean;
} = {}) {
  const {
    api = true,
    route = true,
    performance = true,
    error = true,
    console: enableConsole = false // 默认关闭，避免日志爆炸
  } = options;

  console.log('🔍 [RuntimeMonitor] 正在初始化运行时监测...');

  if (api) injectAPIMonitoring();
  if (route) injectRouteMonitoring();
  if (performance) injectPerformanceMonitoring();
  if (error) injectErrorMonitoring();
  if (enableConsole) injectConsoleMonitoring();

  console.log('✅ [RuntimeMonitor] 运行时监测初始化完成！');
  console.log('💡 使用 window.runtimeMonitor 访问监测工具');
}

// 自动初始化（开发环境）
// 🔧 修复：安全检查 import.meta 是否存在
if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
  initializeMonitoring({
    api: true,
    route: true,
    performance: true,
    error: true,
    console: false
  });
}

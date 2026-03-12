
console.clear();
console.log('🔧 VF物流平台筛选实时调试工具');
console.log('=' .repeat(50));

// 创建全局调试对象
window.platformDebugger = {
  logs: [],
  originalFetch: null,
  interceptors: {
    fetch: null,
    console: null
  },

  // 启动监控
  startMonitoring() {
    console.log('🚀 启动平台筛选监控...\n');
    
    // 1. 拦截 fetch 请求
    if (!this.originalFetch) {
      this.originalFetch = window.fetch;
    }
    
    window.fetch = async (...args) => {
      const url = args[0];
      const options = args[1] || {};
      
      // 检查是否是API请求
      if (typeof url === 'string' && url.includes('/api/')) {
        console.group('🌐 API请求拦截');
        console.log('📍 URL:', url);
        
        // 解析URL参数
        try {
          const urlObj = new URL(url, window.location.origin);
          const params = Object.fromEntries(urlObj.searchParams.entries());
          
          console.log('📋 所有参数:', params);
          
          if (params.platform) {
            console.log('✅ 发现平台参数:', params.platform);
          } else {
            console.warn('⚠️ 缺少平台参数！');
          }
          
          if (params.brand) {
            console.log('✅ 发现品牌参数:', params.brand);
          }
          
          console.log('📅 时间参数:', {
            dateFrom: params.dateFrom,
            dateTo: params.dateTo
          });
          
        } catch (e) {
          console.error('❌ 解析URL失败:', e);
        }
        
        console.groupEnd();
        
        // 记录到日志
        this.logs.push({
          timestamp: new Date().toISOString(),
          type: 'api_request',
          url: url,
          hasplatformParam: url.includes('platform=')
        });
      }
      
      // 调用原始fetch
      return this.originalFetch.apply(window, args);
    };
    
    // 2. 监听状态变化
    this.monitorStateChanges();
    
    console.log('✅ 监控已启动');
    console.log('🎯 请现在选择一个平台，观察输出...\n');
  },
  
  // 监控状态变化
  monitorStateChanges() {
    // 检查是否有React开发工具
    const checkReactState = () => {
      try {
        const reactRoot = document.querySelector('#root');
        if (reactRoot && reactRoot._reactInternalInstance) {
          console.log('🔍 检测到React实例');
        }
      } catch (e) {
        // React状态监控需要开发工具
      }
    };
    
    checkReactState();
    
    // 监听DOM变化
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // 检查是否有平台相关的DOM变化
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.textContent) {
              if (node.textContent.includes('平台') || node.textContent.includes('天猫') || node.textContent.includes('抖音')) {
                console.log('📱 检测到平台相关DOM变化:', node.textContent.substring(0, 50));
              }
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.domObserver = observer;
  },
  
  // 停止监控
  stopMonitoring() {
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      console.log('🛑 fetch拦截已恢复');
    }
    
    if (this.domObserver) {
      this.domObserver.disconnect();
      console.log('🛑 DOM监控已停止');
    }
    
    console.log('✅ 监控已停止');
  },
  
  // 手动测试平台选择
  simulatePlatformSelection(platform = 'tmall') {
    console.group('🧪 模拟平台选择:', platform);
    
    // 查找平台选择器
    const selects = document.querySelectorAll('select, [role="combobox"]');
    console.log('📝 找到选择器数量:', selects.length);
    
    selects.forEach((select, index) => {
      console.log(`选择器 ${index}:`, select.className, select.value || select.getAttribute('data-value'));
    });
    
    // 尝试触发平台选择事件
    const event = new CustomEvent('platformSelectionTest', {
      detail: { platform },
      bubbles: true
    });
    
    document.dispatchEvent(event);
    console.log('✅ 自定义事件已触发');
    
    console.groupEnd();
  },
  
  // 检查当前状态
  checkCurrentState() {
    console.group('🔍 当前状态检查');
    
    // 检查URL
    console.log('🌐 当前URL:', window.location.href);
    
    // 检查本地存储
    const relevantStorage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('platform') || key.includes('brand') || key.includes('vf'))) {
        relevantStorage[key] = localStorage.getItem(key);
      }
    }
    console.log('💾 相关存储:', relevantStorage);
    
    // 检查平台选择器的值
    const platformElements = document.querySelectorAll('[data-testid*="platform"], .platform-selector, select');
    console.log('🏪 平台相关元素:', platformElements.length);
    
    platformElements.forEach((el, i) => {
      console.log(`  元素 ${i}:`, {
        tagName: el.tagName,
        value: el.value || el.getAttribute('data-value'),
        className: el.className,
        id: el.id
      });
    });
    
    console.groupEnd();
  },
  
  // 显示日志统计
  showLogs() {
    console.group('📊 调试日志统计');
    console.log('总请求数:', this.logs.length);
    
    const apiRequests = this.logs.filter(log => log.type === 'api_request');
    const withPlatform = apiRequests.filter(log => log.hasplatformParam);
    
    console.log('API请求数:', apiRequests.length);
    console.log('包含平台参数的请求:', withPlatform.length);
    
    if (apiRequests.length > 0) {
      console.log('最近5个API请求:');
      apiRequests.slice(-5).forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.url} ${log.hasplatformParam ? '✅' : '❌'}`);
      });
    }
    
    console.groupEnd();
  },
  
  // 完整诊断
  fullDiagnosis() {
    console.clear();
    console.log('🩺 VF物流平台筛选完整诊断');
    console.log('=' .repeat(50));
    
    this.checkCurrentState();
    this.startMonitoring();
    
    console.log('\n📋 诊断步骤:');
    console.log('1. 监控已启动，现在选择一个平台');
    console.log('2. 观察控制台输出的API请求信息');
    console.log('3. 运行 platformDebugger.showLogs() 查看统计');
    console.log('4. 运行 platformDebugger.simulatePlatformSelection("tmall") 测试');
    console.log('5. 运行 platformDebugger.stopMonitoring() 停止监控');
    
    // 5秒后自动显示提示
    setTimeout(() => {
      if (this.logs.filter(log => log.type === 'api_request').length === 0) {
        console.warn('\n⚠️ 5秒内未检测到API请求');
        console.log('💡 建议操作:');
        console.log('  - 确认后端服务是否启动');
        console.log('  - 检查是否在总览页面');
        console.log('  - 尝试刷新页面后重新选择平台');
      }
    }, 5000);
  }
};

// 自动启动诊断
window.platformDebugger.fullDiagnosis();

// 提供便捷访问
console.log('\n🛠️ 可用命令:');
console.log('- platformDebugger.fullDiagnosis() // 重新开始诊断');
console.log('- platformDebugger.simulatePlatformSelection("tmall") // 模拟选择天猫');
console.log('- platformDebugger.checkCurrentState() // 检查当前状态');
console.log('- platformDebugger.showLogs() // 显示请求统计');
console.log('- platformDebugger.stopMonitoring() // 停止监控');
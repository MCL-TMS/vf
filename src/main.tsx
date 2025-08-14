import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App.tsx';
import '../styles/globals.css';

// 确保DOM已加载
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Please ensure index.html contains a div with id="root"');
}

// 创建React根实例并渲染应用
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 开发环境下的热重载支持
if (import.meta.hot) {
  import.meta.hot.accept('../App.tsx', (newApp) => {
    if (newApp) {
      root.render(
        <React.StrictMode>
          <newApp.default />
        </React.StrictMode>
      );
    }
  });
}

// 性能监控 (开发环境)
if (import.meta.env.DEV) {
  // 输出应用加载信息
  console.log('🚀 VF物流仪表板已启动');
  console.log('📊 开发模式 - 热重载已启用');
  
  // 监控性能
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const loadTime = performance.now();
      console.log(`⚡ 应用加载耗时: ${loadTime.toFixed(2)}ms`);
    });
  }
}

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('❌ 应用错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ 未处理的Promise拒绝:', event.reason);
});
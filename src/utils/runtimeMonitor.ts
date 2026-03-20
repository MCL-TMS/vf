/**
 * 运行时监测工具
 * 用于追踪应用运行过程中的文件调用、API请求、组件渲染等
 */

import React from 'react';

export interface CallRecord {
  timestamp: number;
  type: 'component' | 'hook' | 'api' | 'function' | 'route';
  name: string;
  file?: string;
  duration?: number;
  details?: any;
  stackTrace?: string;
}

export interface FileAccessRecord {
  file: string;
  firstAccess: number;
  lastAccess: number;
  accessCount: number;
  type: 'component' | 'hook' | 'util' | 'service' | 'data' | 'other';
}

class RuntimeMonitor {
  private static instance: RuntimeMonitor;
  private enabled: boolean = false;
  private records: CallRecord[] = [];
  private fileAccess: Map<string, FileAccessRecord> = new Map();
  private startTime: number = Date.now();
  
  private constructor() {
    // 私有构造函数，确保单例
  }

  static getInstance(): RuntimeMonitor {
    if (!RuntimeMonitor.instance) {
      RuntimeMonitor.instance = new RuntimeMonitor();
    }
    return RuntimeMonitor.instance;
  }

  /**
   * 启用监测
   */
  enable() {
    this.enabled = true;
    this.startTime = Date.now();
    console.log('🔍 [RuntimeMonitor] 监测已启用');
  }

  /**
   * 禁用监测
   */
  disable() {
    this.enabled = false;
    console.log('🔍 [RuntimeMonitor] 监测已禁用');
  }

  /**
   * 是否已启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 记录调用
   */
  recordCall(record: Omit<CallRecord, 'timestamp'>) {
    if (!this.enabled) return;

    const fullRecord: CallRecord = {
      ...record,
      timestamp: Date.now(),
      stackTrace: this.getStackTrace()
    };

    this.records.push(fullRecord);

    // 更新文件访问记录
    if (record.file) {
      this.updateFileAccess(record.file, record.type);
    }

    // 限制记录数量，避免内存溢出
    if (this.records.length > 10000) {
      this.records = this.records.slice(-5000);
    }
  }

  /**
   * 记录组件渲染
   */
  recordComponent(componentName: string, file: string, duration?: number) {
    this.recordCall({
      type: 'component',
      name: componentName,
      file,
      duration
    });
  }

  /**
   * 记录Hook调用
   */
  recordHook(hookName: string, file: string, duration?: number) {
    this.recordCall({
      type: 'hook',
      name: hookName,
      file,
      duration
    });
  }

  /**
   * 记录API调用
   */
  recordAPI(endpoint: string, method: string, duration?: number, details?: any) {
    this.recordCall({
      type: 'api',
      name: `${method} ${endpoint}`,
      file: 'apiService.ts',
      duration,
      details
    });
  }

  /**
   * 记录函数调用
   */
  recordFunction(functionName: string, file: string, duration?: number) {
    this.recordCall({
      type: 'function',
      name: functionName,
      file,
      duration
    });
  }

  /**
   * 记录路由变化
   */
  recordRoute(route: string) {
    this.recordCall({
      type: 'route',
      name: route,
      file: 'router'
    });
  }

  /**
   * 更新文件访问记录
   */
  private updateFileAccess(file: string, type: CallRecord['type']) {
    const now = Date.now();
    const existing = this.fileAccess.get(file);

    if (existing) {
      existing.lastAccess = now;
      existing.accessCount++;
    } else {
      const fileType = this.detectFileType(file);
      this.fileAccess.set(file, {
        file,
        firstAccess: now,
        lastAccess: now,
        accessCount: 1,
        type: fileType
      });
    }
  }

  /**
   * 检测文件类型
   */
  private detectFileType(file: string): FileAccessRecord['type'] {
    if (file.includes('/components/')) return 'component';
    if (file.includes('/hooks/')) return 'hook';
    if (file.includes('/utils/')) return 'util';
    if (file.includes('/services/')) return 'service';
    if (file.includes('/data/')) return 'data';
    return 'other';
  }

  /**
   * 获取调用栈
   */
  private getStackTrace(): string {
    try {
      const stack = new Error().stack || '';
      const lines = stack.split('\n').slice(3, 6); // 跳过前3行，取3行调用栈
      return lines.join('\n').trim();
    } catch {
      return '';
    }
  }

  /**
   * 获取所有记录
   */
  getRecords(): CallRecord[] {
    return [...this.records];
  }

  /**
   * 获取文件访问记录
   */
  getFileAccess(): FileAccessRecord[] {
    return Array.from(this.fileAccess.values());
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    const totalRecords = this.records.length;
    const uniqueFiles = this.fileAccess.size;
    const componentRenders = this.records.filter(r => r.type === 'component').length;
    const hookCalls = this.records.filter(r => r.type === 'hook').length;
    const apiCalls = this.records.filter(r => r.type === 'api').length;
    const routeChanges = this.records.filter(r => r.type === 'route').length;

    // 计算平均duration
    const recordsWithDuration = this.records.filter(r => r.duration !== undefined);
    const avgDuration = recordsWithDuration.length > 0
      ? recordsWithDuration.reduce((sum, r) => sum + (r.duration || 0), 0) / recordsWithDuration.length
      : 0;

    // 最常调用的文件
    const topFiles = Array.from(this.fileAccess.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    // 最慢的调用
    const slowestCalls = [...this.records]
      .filter(r => r.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    return {
      totalRecords,
      uniqueFiles,
      componentRenders,
      hookCalls,
      apiCalls,
      routeChanges,
      avgDuration: Math.round(avgDuration * 100) / 100,
      topFiles,
      slowestCalls,
      runningTime: Date.now() - this.startTime
    };
  }

  /**
   * 按类型过滤记录
   */
  getRecordsByType(type: CallRecord['type']): CallRecord[] {
    return this.records.filter(r => r.type === type);
  }

  /**
   * 按文件过滤记录
   */
  getRecordsByFile(file: string): CallRecord[] {
    return this.records.filter(r => r.file === file);
  }

  /**
   * 导出报告（JSON格式）
   */
  exportReport() {
    const report = {
      timestamp: new Date().toISOString(),
      statistics: this.getStatistics(),
      records: this.records,
      fileAccess: Array.from(this.fileAccess.values())
    };

    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `runtime-monitor-${Date.now()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    console.log('📊 [RuntimeMonitor] 报告已导出');
  }

  /**
   * 清空记录
   */
  clear() {
    this.records = [];
    this.fileAccess.clear();
    this.startTime = Date.now();
    console.log('🧹 [RuntimeMonitor] 记录已清空');
  }

  /**
   * 打印统计信息到控制台
   */
  printStatistics() {
    const stats = this.getStatistics();
    
    console.log('\n📊 ========== 运行时监测统计 ==========');
    console.log(`⏱️  运行时间: ${Math.round(stats.runningTime / 1000)}秒`);
    console.log(`📝 总记录数: ${stats.totalRecords}`);
    console.log(`📁 唯一文件数: ${stats.uniqueFiles}`);
    console.log(`🎨 组件渲染: ${stats.componentRenders}`);
    console.log(`🔧 Hook调用: ${stats.hookCalls}`);
    console.log(`🌐 API调用: ${stats.apiCalls}`);
    console.log(`🧭 路由变化: ${stats.routeChanges}`);
    console.log(`⚡ 平均耗时: ${stats.avgDuration}ms`);
    
    console.log('\n🔥 最常调用的文件 (Top 10):');
    stats.topFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.file} (${file.accessCount}次)`);
    });
    
    console.log('\n🐢 最慢的调用 (Top 10):');
    stats.slowestCalls.forEach((call, index) => {
      console.log(`  ${index + 1}. ${call.name} - ${call.duration}ms (${call.file})`);
    });
    
    console.log('========================================\n');
  }
}

// 导出单例实例
export const runtimeMonitor = RuntimeMonitor.getInstance();

// 性能监测装饰器
export function monitored(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    const duration = performance.now() - start;
    
    runtimeMonitor.recordFunction(
      `${target.constructor.name}.${propertyKey}`,
      target.constructor.name,
      duration
    );
    
    return result;
  };
  
  return descriptor;
}

// React组件监测HOC
export function withMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const name = componentName || Component.displayName || Component.name || 'Unknown';
  
  return (props: P) => {
    const start = performance.now();
    
    React.useEffect(() => {
      const duration = performance.now() - start;
      runtimeMonitor.recordComponent(name, `components/${name}.tsx`, duration);
    });
    
    return React.createElement(Component, props);
  };
}

// 全局暴露到window，方便控制台调用
if (typeof window !== 'undefined') {
  (window as any).runtimeMonitor = runtimeMonitor;
  console.log('🔍 运行时监测工具已加载！使用 window.runtimeMonitor 访问');
  console.log('💡 快速开始:');
  console.log('  - runtimeMonitor.enable()        // 启用监测');
  console.log('  - runtimeMonitor.printStatistics()  // 查看统计');
  console.log('  - runtimeMonitor.exportReport()  // 导出报告');
  console.log('  - runtimeMonitor.clear()         // 清空记录');
}
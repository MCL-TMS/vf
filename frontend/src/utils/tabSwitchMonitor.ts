/**
 * Tab切换数据加载诊断工具
 * 用于检测和修复快速切换Tab时数据不加载的问题
 */

import { useEffect, useRef } from 'react';

interface TabSwitchDiagnostics {
  lastActiveMenu: string;
  lastSwitchTime: number;
  switchCount: number;
  loadAttempts: number;
  successfulLoads: number;
  failedLoads: number;
  skippedLoads: number;
  issues: Array<{
    timestamp: number;
    issue: string;
    context: any;
  }>;
}

class TabSwitchMonitor {
  private static instance: TabSwitchMonitor;
  private diagnostics: Map<string, TabSwitchDiagnostics> = new Map();
  private enabled: boolean = true;

  private constructor() {}

  static getInstance(): TabSwitchMonitor {
    if (!TabSwitchMonitor.instance) {
      TabSwitchMonitor.instance = new TabSwitchMonitor();
    }
    return TabSwitchMonitor.instance;
  }

  /**
   * 记录Tab切换
   */
  recordSwitch(fromMenu: string, toMenu: string) {
    if (!this.enabled) return;

    const key = `${fromMenu}->${toMenu}`;
    const existing = this.diagnostics.get(key) || {
      lastActiveMenu: fromMenu,
      lastSwitchTime: 0,
      switchCount: 0,
      loadAttempts: 0,
      successfulLoads: 0,
      failedLoads: 0,
      skippedLoads: 0,
      issues: []
    };

    const now = Date.now();
    const timeSinceLastSwitch = now - existing.lastSwitchTime;

    existing.switchCount++;
    existing.lastSwitchTime = now;

    // 检测快速切换（<1秒）
    if (timeSinceLastSwitch < 1000 && timeSinceLastSwitch > 0) {
      this.recordIssue(key, 'fast_switch', {
        timeSinceLastSwitch,
        message: '⚠️ 快速切换检测到！可能导致数据加载问题'
      });
    }

    this.diagnostics.set(key, existing);

    console.log(`🔄 [TabSwitchMonitor] Tab切换: ${fromMenu} → ${toMenu}`, {
      switchCount: existing.switchCount,
      timeSinceLastSwitch: `${timeSinceLastSwitch}ms`
    });
  }

  /**
   * 记录加载尝试
   */
  recordLoadAttempt(menu: string, context: any) {
    if (!this.enabled) return;

    const keys = Array.from(this.diagnostics.keys()).filter(k => k.endsWith(`->${menu}`));
    keys.forEach(key => {
      const diag = this.diagnostics.get(key);
      if (diag) {
        diag.loadAttempts++;
        console.log(`📡 [TabSwitchMonitor] 加载尝试 #${diag.loadAttempts} for ${menu}`, context);
      }
    });
  }

  /**
   * 记录加载成功
   */
  recordLoadSuccess(menu: string, dataInfo: any) {
    if (!this.enabled) return;

    const keys = Array.from(this.diagnostics.keys()).filter(k => k.endsWith(`->${menu}`));
    keys.forEach(key => {
      const diag = this.diagnostics.get(key);
      if (diag) {
        diag.successfulLoads++;
        console.log(`✅ [TabSwitchMonitor] 加载成功 for ${menu}`, dataInfo);
      }
    });
  }

  /**
   * 记录加载失败
   */
  recordLoadFailure(menu: string, error: any) {
    if (!this.enabled) return;

    const keys = Array.from(this.diagnostics.keys()).filter(k => k.endsWith(`->${menu}`));
    keys.forEach(key => {
      const diag = this.diagnostics.get(key);
      if (diag) {
        diag.failedLoads++;
        this.recordIssue(key, 'load_failed', {
          menu,
          error: error?.message || error
        });
        console.error(`❌ [TabSwitchMonitor] 加载失败 for ${menu}`, error);
      }
    });
  }

  /**
   * 记录加载跳过
   */
  recordLoadSkipped(menu: string, reason: string) {
    if (!this.enabled) return;

    const keys = Array.from(this.diagnostics.keys()).filter(k => k.endsWith(`->${menu}`));
    keys.forEach(key => {
      const diag = this.diagnostics.get(key);
      if (diag) {
        diag.skippedLoads++;
        this.recordIssue(key, 'load_skipped', {
          menu,
          reason
        });
        console.warn(`⏭️ [TabSwitchMonitor] 加载跳过 for ${menu}: ${reason}`);
      }
    });
  }

  /**
   * 记录问题
   */
  private recordIssue(key: string, issue: string, context: any) {
    const diag = this.diagnostics.get(key);
    if (diag) {
      diag.issues.push({
        timestamp: Date.now(),
        issue,
        context
      });

      // 只保留最近20条问题
      if (diag.issues.length > 20) {
        diag.issues = diag.issues.slice(-20);
      }
    }
  }

  /**
   * 生成诊断报告
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalSwitches: 0,
      totalLoadAttempts: 0,
      totalSuccessfulLoads: 0,
      totalFailedLoads: 0,
      totalSkippedLoads: 0,
      successRate: 0,
      routes: [] as any[]
    };

    this.diagnostics.forEach((diag, key) => {
      report.totalSwitches += diag.switchCount;
      report.totalLoadAttempts += diag.loadAttempts;
      report.totalSuccessfulLoads += diag.successfulLoads;
      report.totalFailedLoads += diag.failedLoads;
      report.totalSkippedLoads += diag.skippedLoads;

      const routeSuccessRate = diag.loadAttempts > 0
        ? (diag.successfulLoads / diag.loadAttempts * 100).toFixed(1)
        : 'N/A';

      report.routes.push({
        route: key,
        switchCount: diag.switchCount,
        loadAttempts: diag.loadAttempts,
        successfulLoads: diag.successfulLoads,
        failedLoads: diag.failedLoads,
        skippedLoads: diag.skippedLoads,
        successRate: routeSuccessRate + '%',
        recentIssues: diag.issues.slice(-5)
      });
    });

    report.successRate = report.totalLoadAttempts > 0
      ? parseFloat((report.totalSuccessfulLoads / report.totalLoadAttempts * 100).toFixed(1))
      : 0;

    return report;
  }

  /**
   * 打印诊断报告
   */
  printReport() {
    const report = this.generateReport();

    console.log('\n🔍 ========== Tab切换诊断报告 ==========');
    console.log(`📊 总切换次数: ${report.totalSwitches}`);
    console.log(`📡 总加载尝试: ${report.totalLoadAttempts}`);
    console.log(`✅ 成功加载: ${report.totalSuccessfulLoads}`);
    console.log(`❌ 失败加载: ${report.totalFailedLoads}`);
    console.log(`⏭️ 跳过加载: ${report.totalSkippedLoads}`);
    console.log(`📈 成功率: ${report.successRate}%`);

    console.log('\n📋 各路由详情:');
    report.routes.forEach(route => {
      console.log(`\n  ${route.route}:`);
      console.log(`    切换: ${route.switchCount}次`);
      console.log(`    尝试: ${route.loadAttempts}次`);
      console.log(`    成功: ${route.successfulLoads}次`);
      console.log(`    失败: ${route.failedLoads}次`);
      console.log(`    跳过: ${route.skippedLoads}次`);
      console.log(`    成功率: ${route.successRate}`);

      if (route.recentIssues.length > 0) {
        console.log(`    最近问题:`);
        route.recentIssues.forEach((issue: any) => {
          console.log(`      - ${issue.issue}: ${JSON.stringify(issue.context)}`);
        });
      }
    });

    console.log('========================================\n');

    // 识别问题路由
    const problemRoutes = report.routes.filter(r => {
      const rate = parseFloat(r.successRate);
      return !isNaN(rate) && rate < 80;
    });

    if (problemRoutes.length > 0) {
      console.log('⚠️ 发现问题路由（成功率<80%）:');
      problemRoutes.forEach(route => {
        console.log(`  - ${route.route}: ${route.successRate}`);
      });
      console.log('\n💡 建议:');
      console.log('  1. 检查useAPIData的依赖数组是否完整');
      console.log('  2. 确认activeMenu变化时是否清空了旧数据');
      console.log('  3. 检查是否有重复的API请求被跳过');
      console.log('  4. 查看是否有错误被静默处理');
    }
  }

  /**
   * 导出报告
   */
  exportReport() {
    const report = this.generateReport();
    const dataStr = JSON.stringify(report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `tab-switch-diagnostics-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);

    console.log('📊 [TabSwitchMonitor] 诊断报告已导出');
  }

  /**
   * 清空诊断数据
   */
  clear() {
    this.diagnostics.clear();
    console.log('🧹 [TabSwitchMonitor] 诊断数据已清空');
  }

  /**
   * 启用/禁用监测
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    console.log(`🔍 [TabSwitchMonitor] 监测${enabled ? '已启用' : '已禁用'}`);
  }
}

// 导出单例
export const tabSwitchMonitor = TabSwitchMonitor.getInstance();

/**
 * React Hook - 自动监测Tab切换
 */
export function useTabSwitchMonitor(activeMenu: string) {
  const previousMenuRef = useRef<string>(activeMenu);

  useEffect(() => {
    if (previousMenuRef.current !== activeMenu) {
      tabSwitchMonitor.recordSwitch(previousMenuRef.current, activeMenu);
      previousMenuRef.current = activeMenu;
    }
  }, [activeMenu]);
}

// 全局暴露
if (typeof window !== 'undefined') {
  (window as any).tabSwitchMonitor = tabSwitchMonitor;
  console.log('🔍 Tab切换监测工具已加载！');
  console.log('💡 使用方法:');
  console.log('  - tabSwitchMonitor.printReport()  // 查看诊断报告');
  console.log('  - tabSwitchMonitor.exportReport() // 导出报告');
  console.log('  - tabSwitchMonitor.clear()        // 清空数据');
}

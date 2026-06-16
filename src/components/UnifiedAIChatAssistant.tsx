import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User,
  X,
  Minimize2,
  Sparkles,
  Loader2,
  AlertCircle,
  Zap,
  Brain,
  Settings,
  RotateCcw
} from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  aiMode?: 'local' | 'gpt';
}

interface UnifiedAIChatAssistantProps {
  analysisData: any;
  competitorData?: any; // 🆕 竞品数据（包含ANF、STICHDMAN等）
  selectedBrand?: string;
  dateRange?: { from: string; to: string };
  metricType?: 'S2D' | 'C2D';
}

// 🔧 Dify配置 - Maersk Dify服务配置
const DIFY_CONFIG = {
  API_KEY: (import.meta.env.VITE_DIFY_API_KEY || '').trim(),
  API_URL: import.meta.env.VITE_DIFY_API_URL || 'https://service-dify-devs.maersk-digital.net/v1',
};

// 🔍 调试：输出配置状态
console.log('🔧 Dify配置检查:', {
  apiKeyLength: DIFY_CONFIG.API_KEY.length,
  startsWithApp: DIFY_CONFIG.API_KEY.startsWith('app-'),
  isConfigured: DIFY_CONFIG.API_KEY.length > 0
});

// 🔥 专家系统：快递商映射表
const CARRIER_NAME_MAP: { [key: string]: string } = {
  'SF': '顺丰速运',
  'ZTO': '中通快递',
  'YTO': '圆通速递',
  'STO': '申通快递',
  'YD': '韵达速递',
  'HTKY': '百世快递',
  'JD': '京东物流',
  'EMS': '中国邮政'
};

// 🔥 专家系统：同义词词典
const SYNONYM_DICT: { [key: string]: string[] } = {
  'best': ['最好', '最优', '表现好', '优秀', '第一', '冠军', '领先', '最强'],
  'worst': ['最差', '最弱', '表现差', '问题', '落后', '垫底', '需要改进'],
  'compare': ['对比', '比较', 'vs', '对抗', '排名', '排行', '谁更好'],
  'improve': ['提升', '改善', '优化', '改进', '增长', '提高', '如何做好'],
  'rate': ['达成率', '完成率', '准时率', '及时率', '时效率'],
  'data': ['数据', '统计', '概览', '总览', '汇总', '摘要'],
  'trend': ['趋势', '变化', '走势', '发展'],
  'region': ['区域', '地区', '省份', '城市'],
  'cost': ['成本', '费用', '价格', '开销'],
  'recommend': ['建议', '推荐', '应该', '怎么办', '怎么做'],
  'benchmark': ['行业', '竞品', '对标', '行业水平', '行业平均', '竞争对手', '对比竞品', '行业对比', 'benchmark'] // 🆕 竞品对比
};

// 🔥 本地专家系统引擎（与AIChatAssistant.tsx相同逻辑）
class TimeEfficiencyExpertSystem {
  private analysisData: any;
  private competitorData: any; // 🆕 竞品数据
  private metricType: 'S2D' | 'C2D';
  private selectedBrand?: string;
  private dateRange?: { from: string; to: string };

  constructor(analysisData: any, metricType: 'S2D' | 'C2D', selectedBrand?: string, dateRange?: { from: string; to: string }, competitorData?: any) {
    this.analysisData = analysisData;
    this.competitorData = competitorData; // 🆕 存储竞品数据
    this.metricType = metricType;
    this.selectedBrand = selectedBrand;
    this.dateRange = dateRange;

    // 🔍 调试：打印竞品数据状态
    console.log('🔧 专家系统构造函数 - 行业数据:', {
      hasCompetitorData: !!competitorData,
      enabled: competitorData?.enabled,
      competitorCount: competitorData?.competitors?.length || 0,
      competitorBrands: competitorData?.competitors?.map((c: any) => c.brand) || []
    });
  }

  calculateCarrierPerformance() {
    if (!this.analysisData || !this.analysisData.brandCarrierStats) {
      return null;
    }

    const stats = this.analysisData.brandCarrierStats;
    const entries = Object.entries(stats);
    const carrierPerformance: { 
      [key: string]: { 
        actual: number; 
        plan: number; 
        rate: number;
        onTime: number;
        delayed: number;
        avgDelay: number;
        grade: 'A' | 'B' | 'C' | 'D';
      } 
    } = {};

    entries.forEach(([key, stat]: [string, any]) => {
      const [, carrier] = key.split('|');
      
      const actual24h = stat.actual24h || 0;
      const actual48h = stat.actual48h || 0;
      const actual72h = stat.actual72h || 0;
      const actualOver72h = stat.actualOver72h || 0;
      
      const plan24h = stat.plan24h || 0;
      const plan48h = stat.plan48h || 0;
      const plan72h = stat.plan72h || 0;
      const planOver72h = stat.planOver72h || 0;
      
      const actual = actual24h + actual48h + actual72h + actualOver72h;
      const plan = plan24h + plan48h + plan72h + planOver72h;
      const onTime = actual24h + actual48h;
      const delayed = actual72h + actualOver72h;
      
      if (!carrierPerformance[carrier]) {
        carrierPerformance[carrier] = { 
          actual: 0, 
          plan: 0, 
          rate: 0,
          onTime: 0,
          delayed: 0,
          avgDelay: 0,
          grade: 'D'
        };
      }
      
      carrierPerformance[carrier].actual += actual;
      carrierPerformance[carrier].plan += plan;
      carrierPerformance[carrier].onTime += onTime;
      carrierPerformance[carrier].delayed += delayed;
    });

    Object.keys(carrierPerformance).forEach(carrier => {
      const perf = carrierPerformance[carrier];
      perf.rate = perf.plan > 0 ? (perf.actual / perf.plan) * 100 : 0;
      perf.avgDelay = perf.actual > 0 ? (perf.delayed / perf.actual) * 100 : 0;
      
      if (perf.rate > 95) {
        perf.grade = 'A';
      } else if (perf.rate >= 80) {
        perf.grade = 'B';
      } else if (perf.rate >= 70) {
        perf.grade = 'C';
      } else {
        perf.grade = 'D';
      }
    });

    return carrierPerformance;
  }

  getBestCarrier() {
    const performance = this.calculateCarrierPerformance();
    if (!performance) return null;
    return Object.entries(performance).sort((a, b) => b[1].rate - a[1].rate)[0];
  }

  getWorstCarrier() {
    const performance = this.calculateCarrierPerformance();
    if (!performance) return null;
    return Object.entries(performance)
      .filter(([, perf]) => perf.actual > 50)
      .sort((a, b) => a[1].rate - b[1].rate)[0];
  }

  calculateOverallRate() {
    const performance = this.calculateCarrierPerformance();
    if (!performance) return null;

    const totalActual = Object.values(performance).reduce((sum, p) => sum + p.actual, 0);
    const totalPlan = Object.values(performance).reduce((sum, p) => sum + p.plan, 0);
    const totalOnTime = Object.values(performance).reduce((sum, p) => sum + p.onTime, 0);
    const totalDelayed = Object.values(performance).reduce((sum, p) => sum + p.delayed, 0);
    
    return {
      rate: totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0,
      actual: totalActual,
      plan: totalPlan,
      gap: totalPlan - totalActual,
      onTimeRate: totalActual > 0 ? (totalOnTime / totalActual) * 100 : 0,
      delayRate: totalActual > 0 ? (totalDelayed / totalActual) * 100 : 0
    };
  }

  getRankingComparison() {
    const performance = this.calculateCarrierPerformance();
    if (!performance) return null;

    return Object.entries(performance)
      .sort((a, b) => b[1].rate - a[1].rate)
      .map(([carrier, perf], index) => ({
        rank: index + 1,
        carrier,
        name: CARRIER_NAME_MAP[carrier] || carrier,
        rate: perf.rate,
        actual: perf.actual,
        plan: perf.plan,
        grade: perf.grade,
        onTimeRate: perf.actual > 0 ? (perf.onTime / perf.actual) * 100 : 0,
        delayRate: perf.avgDelay
      }));
  }

  generateOptimizationSuggestions() {
    const overall = this.calculateOverallRate();
    const performance = this.calculateCarrierPerformance();
    
    if (!overall || !performance) return [];

    const suggestions = [];

    if (overall.rate < 100) {
      suggestions.push({
        priority: 'high',
        category: '整体优化',
        title: '提升整体达成率',
        detail: `当前达成率${overall.rate.toFixed(1)}%，距离目标还有${overall.gap.toLocaleString()}单差距`,
        actions: [
          '优先优化达成率<80%的快递商',
          '评估Plan时效设置是否过于严格',
          '加强过程监控，减少延迟订单'
        ]
      });
    }

    const lowPerformers = Object.entries(performance)
      .filter(([, perf]) => perf.rate < 80 && perf.actual > 50);
    
    if (lowPerformers.length > 0) {
      suggestions.push({
        priority: 'high',
        category: '快递商优化',
        title: `关注${lowPerformers.length}家低达成率快递商`,
        detail: lowPerformers.map(([c]) => CARRIER_NAME_MAP[c] || c).join('、'),
        actions: [
          '与快递商沟通改进方案',
          '评估是否需要调整合作比例',
          '考虑引入新的优质快递商'
        ]
      });
    }

    if (overall.delayRate > 30) {
      suggestions.push({
        priority: 'medium',
        category: '时效优化',
        title: '降低延迟订单比例',
        detail: `当前延迟率${overall.delayRate.toFixed(1)}%，超过30%警戒线`,
        actions: [
          '分析延迟订单的共性特征',
          '优化路由分配策略',
          '加强揽收和发运环节管控'
        ]
      });
    }

    return suggestions;
  }

  analyzeCarrier(carrierCode: string) {
    const performance = this.calculateCarrierPerformance();
    if (!performance || !performance[carrierCode]) {
      return null;
    }

    const perf = performance[carrierCode];
    const ranking = this.getRankingComparison();
    const rank = ranking?.findIndex(r => r.carrier === carrierCode) + 1;

    return {
      carrier: carrierCode,
      name: CARRIER_NAME_MAP[carrierCode] || carrierCode,
      rate: perf.rate,
      actual: perf.actual,
      plan: perf.plan,
      grade: perf.grade,
      rank: rank || 0,
      totalCarriers: ranking?.length || 0,
      onTimeRate: perf.actual > 0 ? (perf.onTime / perf.actual) * 100 : 0,
      delayRate: perf.avgDelay,
      assessment: this.getCarrierAssessment(perf)
    };
  }

  private getCarrierAssessment(perf: any) {
    if (perf.rate >= 95) {
      return {
        level: '优秀',
        emoji: '🌟',
        comment: '表现优秀，达成率95%以上',
        suggestion: '建议增加订单分配比例，建立战略合作关系'
      };
    } else if (perf.rate >= 80) {
      return {
        level: '达标',
        emoji: '✅',
        comment: '达标，达成率80%以上',
        suggestion: '继续保持现有合作水平，定期评估优化空间'
      };
    } else if (perf.rate >= 70) {
      return {
        level: '待改进',
        emoji: '⚠️',
        comment: '待改进，达成率70-80%之间',
        suggestion: '分析未达标原因，制定改进计划'
      };
    } else {
      return {
        level: '需关注',
        emoji: '🚨',
        comment: '低于70%，需要重点关注',
        suggestion: '紧急沟通改进方案，考虑调整合作策略'
      };
    }
  }

  // 🆕 竞品对标分析方法（只显示比率，不显示具体数值）
  calculateBenchmarkComparison() {
    // 检查是否启用竞品对比
    if (!this.competitorData || !this.competitorData.enabled) {
      return null;
    }

    // 检查当前品牌数据
    if (!this.analysisData || !this.analysisData.brandCarrierStats) {
      return null;
    }

    try {
      // 计算当前品牌的整体指标
      const currentMetrics = this.calculateBrandMetrics(this.analysisData);

      // 计算各竞品的指标
      const competitorMetrics: Array<{
        brand: string;
        achievementRate: number;
        onTimeRate: number;
        delayRate: number;
        avgS2DTime: number;
        carriers: { [key: string]: { achievementRate: number; avgS2DTime: number } };
      }> = [];
      
      if (this.competitorData.competitors && Array.isArray(this.competitorData.competitors)) {
        this.competitorData.competitors.forEach((competitor: any) => {
          // 🔑 修复：从竞品数据中提取brandCarrierStats（支持s2dAnalysis/c2dAnalysis结构）
          let competitorStats = null;
          if (competitor.data?.s2dAnalysis?.brandCarrierStats) {
            competitorStats = competitor.data.s2dAnalysis.brandCarrierStats;
          } else if (competitor.data?.c2dAnalysis?.brandCarrierStats) {
            competitorStats = competitor.data.c2dAnalysis.brandCarrierStats;
          } else if (competitor.data?.brandCarrierStats) {
            competitorStats = competitor.data.brandCarrierStats;
          }
          
          console.log(`🔍 处理其他品牌 ${competitor.brand}:`, {
            hasData: !!competitor.data,
            hasS2DAnalysis: !!competitor.data?.s2dAnalysis,
            hasC2DAnalysis: !!competitor.data?.c2dAnalysis,
            hasBrandCarrierStats: !!competitor.data?.brandCarrierStats,
            extractedStatsCount: competitorStats ? Object.keys(competitorStats).length : 0
          });
          
          if (competitorStats) {
            // 🔑 使用兼容的数据结构
            const compatibleCompetitorData = {
              brandCarrierStats: competitorStats
            };
            const metrics = this.calculateBrandMetrics(compatibleCompetitorData);
            
            // 计算按快递商维度的细分指标
            const carrierBreakdown: { [key: string]: { achievementRate: number; avgS2DTime: number } } = {};
            Object.entries(competitorStats).forEach(([key, stats]: [string, any]) => {
              const carrier = key.split('|')[1]; // 提取快递商代码
              const planTotal = (stats.plan24h || 0) + (stats.plan48h || 0) + (stats.plan72h || 0) + (stats.planOver72h || 0);
              const actualTotal = (stats.actual24h || 0) + (stats.actual48h || 0) + (stats.actual72h || 0) + (stats.actualOver72h || 0);
              const achievementRate = planTotal > 0 ? (actualTotal / planTotal) * 100 : 0;
              const avgS2DTime = stats.avgS2DTime || 0;
              
              carrierBreakdown[carrier] = {
                achievementRate: parseFloat(achievementRate.toFixed(1)),
                avgS2DTime: parseFloat(avgS2DTime.toFixed(1))
              };
            });
            
            competitorMetrics.push({
              brand: competitor.brand,
              achievementRate: metrics.achievementRate,
              onTimeRate: metrics.onTimeRate,
              delayRate: metrics.delayRate,
              avgS2DTime: metrics.avgS2DTime,
              carriers: carrierBreakdown
            });
          }
        });
      }

      console.log('✅ 其它品牌指标计算完成:', {
        currentBrand: this.selectedBrand,
        currentRate: currentMetrics.achievementRate,
        competitorCount: competitorMetrics.length,
        competitorRates: competitorMetrics.map(c => ({ brand: c.brand, rate: c.achievementRate }))
      });

      if (competitorMetrics.length === 0) {
        console.warn('⚠️ 没有有效的其他品牌数据可供对比');
        return null;
      }

      // 计算行业平均（当前品牌 + 所有竞品的平均值）
      const allRates = [currentMetrics.achievementRate, ...competitorMetrics.map(c => c.achievementRate)];
      const industryAverage = allRates.reduce((sum, rate) => sum + rate, 0) / allRates.length;

      // 计算准时率行业平均
      const allOnTimeRates = [currentMetrics.onTimeRate, ...competitorMetrics.map(c => c.onTimeRate)];
      const industryOnTimeAvg = allOnTimeRates.reduce((sum, rate) => sum + rate, 0) / allOnTimeRates.length;

      // 计算延迟率行业平均
      const allDelayRates = [currentMetrics.delayRate, ...competitorMetrics.map(c => c.delayRate)];
      const industryDelayAvg = allDelayRates.reduce((sum, rate) => sum + rate, 0) / allDelayRates.length;

      // 计算平均S2D时长行业平均
      const allS2DTimes = [currentMetrics.avgS2DTime, ...competitorMetrics.map(c => c.avgS2DTime)];
      const industryS2DAvg = allS2DTimes.reduce((sum, time) => sum + time, 0) / allS2DTimes.length;

      // 计算当前品牌按快递商维度的细分指标
      const currentCarrierBreakdown: { [key: string]: { achievementRate: number; avgS2DTime: number } } = {};
      if (this.analysisData.brandCarrierStats) {
        Object.entries(this.analysisData.brandCarrierStats).forEach(([key, stats]: [string, any]) => {
          const carrier = key.split('|')[1]; // 提取快递商代码
          const planTotal = (stats.plan24h || 0) + (stats.plan48h || 0) + (stats.plan72h || 0) + (stats.planOver72h || 0);
          const actualTotal = (stats.actual24h || 0) + (stats.actual48h || 0) + (stats.actual72h || 0) + (stats.actualOver72h || 0);
          const achievementRate = planTotal > 0 ? (actualTotal / planTotal) * 100 : 0;
          const avgS2DTime = stats.avgS2DTime || 0;
          
          currentCarrierBreakdown[carrier] = {
            achievementRate: parseFloat(achievementRate.toFixed(1)),
            avgS2DTime: parseFloat(avgS2DTime.toFixed(1))
          };
        });
      }

      const diff = currentMetrics.achievementRate - industryAverage;

      let position: { level: string; emoji: string; description: string };
      if (diff > 15) {
        position = {
          level: '领先',
          emoji: '🌟',
          description: `高于行业平均 ${diff.toFixed(1)}个百分点`
        };
      } else if (diff > 5) {
        position = {
          level: '良好',
          emoji: '✅',
          description: `高于行业平均 ${diff.toFixed(1)}个百分点`
        };
      } else if (diff > -5) {
        position = {
          level: '持平',
          emoji: '📊',
          description: `与行业平均持平（相差${Math.abs(diff).toFixed(1)}个百分点）`
        };
      } else if (diff > -10) {
        position = {
          level: '待改进',
          emoji: '⚠️',
          description: `低于行业平均 ${Math.abs(diff).toFixed(1)}个百分点`
        };
      } else {
        position = {
          level: '需提升',
          emoji: '📈',
          description: `低于行业平均 ${Math.abs(diff).toFixed(1)}个百分点`
        };
      }

      return {
        // 当前品牌整体指标
        currentRate: currentMetrics.achievementRate,
        currentOnTimeRate: currentMetrics.onTimeRate,
        currentDelayRate: currentMetrics.delayRate,
        currentAvgS2DTime: currentMetrics.avgS2DTime,
        currentCarriers: currentCarrierBreakdown,
        
        // 竞品指标
        competitors: competitorMetrics,
        
        // 行业平均指标
        industryAverage: industryAverage,
        industryOnTimeAvg: industryOnTimeAvg,
        industryDelayAvg: industryDelayAvg,
        industryS2DAvg: industryS2DAvg,
        
        // 对比分析
        position: position,
        diff: diff,
        competitorCount: competitorMetrics.length,
        displayMode: this.competitorData.displayMode || 'ratio-only'
      };

    } catch (error) {
      console.error('其他品牌对比计算失败:', error);
      return null;
    }
  }

  // 🆕 辅助方法：计算品牌整体指标（达成率、准时率、延迟率、平均S2D时长）
  private calculateBrandMetrics(analysisData: any): {
    achievementRate: number;
    onTimeRate: number;
    delayRate: number;
    avgS2DTime: number;
  } {
    if (!analysisData || !analysisData.brandCarrierStats) {
      return {
        achievementRate: 0,
        onTimeRate: 0,
        delayRate: 0,
        avgS2DTime: 0
      };
    }

    let totalPlan = 0;
    let totalActual = 0;
    let totalOnTime = 0; // ≤48h
    let totalDelay = 0;  // >72h
    let totalS2DTime = 0;
    let totalS2DCount = 0;

    Object.values(analysisData.brandCarrierStats).forEach((stats: any) => {
      const plan24h = stats.plan24h || 0;
      const plan48h = stats.plan48h || 0;
      const plan72h = stats.plan72h || 0;
      const planOver72h = stats.planOver72h || 0;
      
      const actual24h = stats.actual24h || 0;
      const actual48h = stats.actual48h || 0;
      const actual72h = stats.actual72h || 0;
      const actualOver72h = stats.actualOver72h || 0;

      totalPlan += plan24h + plan48h + plan72h + planOver72h;
      totalActual += actual24h + actual48h + actual72h + actualOver72h;
      totalOnTime += actual24h + actual48h;
      totalDelay += actualOver72h;

      const avgTime = stats.avgS2DTime || 0;
      const orderCount = actual24h + actual48h + actual72h + actualOver72h;
      if (avgTime > 0 && orderCount > 0) {
        totalS2DTime += avgTime * orderCount;
        totalS2DCount += orderCount;
      }
    });

    const achievementRate = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;
    const onTimeRate = totalActual > 0 ? (totalOnTime / totalActual) * 100 : 0;
    const delayRate = totalActual > 0 ? (totalDelay / totalActual) * 100 : 0;
    const avgS2DTime = totalS2DCount > 0 ? totalS2DTime / totalS2DCount : 0;

    return {
      achievementRate: parseFloat(achievementRate.toFixed(1)),
      onTimeRate: parseFloat(onTimeRate.toFixed(1)),
      delayRate: parseFloat(delayRate.toFixed(1)),
      avgS2DTime: parseFloat(avgS2DTime.toFixed(1))
    };
  }

  matchIntent(question: string): string {
    const q = question.toLowerCase();
    
    for (const [intent, synonyms] of Object.entries(SYNONYM_DICT)) {
      if (synonyms.some(word => q.includes(word))) {
        return intent;
      }
    }
    
    for (const [code, name] of Object.entries(CARRIER_NAME_MAP)) {
      if (q.includes(code.toLowerCase()) || q.includes(name)) {
        return `carrier_${code}`;
      }
    }
    
    return 'unknown';
  }
}

export function UnifiedAIChatAssistant({ 
  analysisData, 
  competitorData, // 🆕 竞品数据
  selectedBrand, 
  dateRange,
  metricType = 'S2D'
}: UnifiedAIChatAssistantProps) {
  // 🔒 功能暂未开放提示
  const handleNotOpenClick = () => {
    // 可以使用 toast 或者简单的提示
    alert("AI 问答助手功能暂未开放，敬请期待");
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={handleNotOpenClick}
        className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 opacity-80"
        title="AI 问答助手 (暂未开放)"
      >
        <MessageSquare className="h-6 w-6 text-white opacity-50" />
      </Button>
      <div className="absolute -top-1 -right-1">
        <Badge className="bg-functional-mid-grey h-5 px-1.5 text-[10px] rounded-full flex items-center justify-center border-2 border-white">
          SOON
        </Badge>
      </div>
    </div>
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiMode, setAiMode] = useState<'local' | 'gpt'>('local'); // 默认本地模式
  const [conversationId, setConversationId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // 🔑 关键修复：生成固定的userId，整个会话期间保持不变
  const userIdRef = useRef('vf-logistics-user-' + Date.now());

  // 检查Dify配置
  const isDifyConfigured = DIFY_CONFIG.API_KEY.length > 0 && DIFY_CONFIG.API_KEY.startsWith('app-');

  // 获取欢迎消息
  const getWelcomeMessage = (mode: 'local' | 'gpt'): string => {
    if (mode === 'local') {
      return `你好！我是AI时效分析助手 🤖

我是基于**专家经验算法**的智能分析系统，可以帮你：

📊 **数据分析**
• 分析${metricType}时效数据
• 计算达成率和准时率
• 对比快递商表现

🎯 **专业建议**
• 评估快递商绩效
• 提供行业对比

💡 **快速开始**
试着问我：
"哪个快递商表现最好？"
"顺丰和中通的对比如何？"

💡 提示：点击右上角设置图标可切换到GPT模式获得更强大的分析能力！`;
    } else {
      if (!isDifyConfigured) {
        return `⚠️ GPT模式尚未配置

请按以下步骤配置Dify：

1️⃣ 在Dify创建聊天助手应用
2️⃣ 复制 /DIFY_CHATBOT_PROMPT.md 中的提示词
3️⃣ 获取API密钥
4️⃣ 在前端环境变量中配置 VITE_DIFY_API_KEY

配置完成后即可使用GPT分析数据！

💡 你可以先切换回本地模式使用基础功能。`;
      }
      return `你好！我是VF物流时效分析助手 🤖

我由**GPT-4大模型**驱动，可以帮你：

📊 **深度数据分析**
• 分析${metricType}时效数据
• 计算多维度指标
• 对比快递商表现

💡 **快速开始**
试着问我：
"哪个快递商表现最好？"
"给我一份完整的优化建议报告"
"分析一下延迟订单的根本原因"`;
    }
  };

  // 初始欢迎消息
  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: getWelcomeMessage(aiMode),
        timestamp: new Date(),
        aiMode: aiMode
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, metricType]);

  // 切换AI模式时添加提示消息
  const handleAiModeChange = (newMode: 'local' | 'gpt') => {
    if (newMode === aiMode) return;
    
    // 🔑 切换模式时清空会话ID，避免会话冲突
    setConversationId('');
    setAiMode(newMode);
    
    // 添加模式切换提示
    const switchMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: newMode === 'local' 
        ? `✅ 已切换到**本地专家系统**模式\n\n• 响应速度：⚡ 极快（<1秒）\n• 分析深度：中等\n• 成本：完全免费\n• 数据安全：完全本地\n\n继续问我问题吧！` 
        : isDifyConfigured
        ? `✅ 已切换到**GPT大模型**模式\n\n• 分析能力：🌟 强大\n• 理解能力：自然语言深度理解\n• 特色功能：根因分析、趋势预测、ROI计算\n• 响应速度：约3-8秒\n\n现在可以问我更复杂的问题了！`
        : `⚠️ GPT模式未配置\n\n请先配置Dify API密钥才能使用GPT模式。\n查看 /AI_ASSISTANT_INTEGRATION_GUIDE.md 了解配置步骤。\n\n已自动切回本地模式。`,
      timestamp: new Date(),
      aiMode: newMode
    };
    
    setMessages(prev => [...prev, switchMessage]);
    
    // 如果切换到GPT但未配置，自动切回本地
    if (newMode === 'gpt' && !isDifyConfigured) {
      setTimeout(() => setAiMode('local'), 100);
    }
  };

  // 自动滚动到最新消息
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // 🔥 专家系统生成回答
  const generateLocalResponse = (userQuestion: string): string => {
    const question = userQuestion.toLowerCase();

    // 🔍 调试：检查竞品数据
    console.log('🔍 其他品牌数据检查:', {
      hasCompetitorData: !!competitorData,
      enabled: competitorData?.enabled,
      competitorCount: competitorData?.competitors?.length || 0,
      competitors: competitorData?.competitors?.map((c: any) => c.brand)
    });

    let brandCarrierStats = null;
    
    if (analysisData?.s2dAnalysis?.brandCarrierStats) {
      brandCarrierStats = analysisData.s2dAnalysis.brandCarrierStats;
    } else if (analysisData?.c2dAnalysis?.brandCarrierStats) {
      brandCarrierStats = analysisData.c2dAnalysis.brandCarrierStats;
    } else if (analysisData?.brandCarrierStats) {
      brandCarrierStats = analysisData.brandCarrierStats;
    }

    if (!analysisData || !brandCarrierStats) {
      return '抱歉，当前没有可用的分析数据。请先选择日期范围进行时效分析。📊';
    }

    const compatibleAnalysisData = {
      brandCarrierStats: brandCarrierStats
    };
    
    const expertSystem = new TimeEfficiencyExpertSystem(
      compatibleAnalysisData, 
      metricType, 
      selectedBrand, 
      dateRange,
      competitorData
    );

    const intent = expertSystem.matchIntent(question);

    // 场景1：询问最佳快递商
    if (intent === 'best') {
      const best = expertSystem.getBestCarrier();
      if (best) {
        const [carrier, perf] = best;
        const name = CARRIER_NAME_MAP[carrier] || carrier;
        const analysis = expertSystem.analyzeCarrier(carrier);
        
        return `🏆 **${name}** 表现最好！

📊 **核心数据**
• ${metricType}时效达成率: **${perf.rate.toFixed(1)}%**
• 已签收订单: ${perf.actual.toLocaleString()} 单
• Plan目标: ${perf.plan.toLocaleString()} 单
• 排名: 第${analysis?.rank}/${analysis?.totalCarriers}名
• 评级: ${perf.grade}级

✅ **绩效评估**
${analysis?.assessment.emoji} ${analysis?.assessment.comment}

💡 **建议**
${analysis?.assessment.suggestion}`;
      }
    }

    // 场景2：快递商对比排名
    if (intent === 'compare') {
      const ranking = expertSystem.getRankingComparison();
      if (ranking) {
        let response = `📊 **快递商${metricType}时效综合排名**\n\n`;
        ranking.forEach((item) => {
          const emoji = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '📦';
          const gradeColor = item.grade === 'A' ? '🌟' : item.grade === 'B' ? '✅' : item.grade === 'C' ? '⚠️' : '🚨';
          response += `${emoji} **${item.name}**\n`;
          response += `   达成率: ${item.rate.toFixed(1)}% | 评级: ${gradeColor}${item.grade}\n`;
          response += `   订单量: ${item.actual.toLocaleString()}单 | 准时率: ${item.onTimeRate.toFixed(1)}%\n\n`;
        });
        return response;
      }
    }

    // 场景3：优化改进建议
    if (intent === 'improve' || intent === 'recommend') {
      const suggestions = expertSystem.generateOptimizationSuggestions();
      const overall = expertSystem.calculateOverallRate();
      
      if (suggestions.length > 0) {
        let response = `💡 **${metricType}时效优化建议报告**\n\n`;
        response += `📈 **当前状态**\n`;
        response += `• 整体达成率: ${overall?.rate.toFixed(1)}%\n`;
        response += `• 准时订单率: ${overall?.onTimeRate.toFixed(1)}%\n`;
        response += `• 延迟订单率: ${overall?.delayRate.toFixed(1)}%\n`;
        response += `• 需改善订单: ${overall?.gap.toLocaleString()} 单\n\n`;
        
        suggestions.forEach((sug, index) => {
          const priorityEmoji = sug.priority === 'high' ? '🔴' : sug.priority === 'medium' ? '🟡' : '🟢';
          response += `${priorityEmoji} **${sug.title}**\n`;
          response += `   ${sug.detail}\n`;
          sug.actions.forEach((action, i) => {
            response += `   ${i + 1}. ${action}\n`;
          });
          response += `\n`;
        });
        
        return response;
      }
    }

    // 场景4：整体达成率查询
    if (intent === 'rate') {
      const overall = expertSystem.calculateOverallRate();
      if (overall) {
        const gradeEmoji = overall.rate > 95 ? '🌟 优秀' : 
                          overall.rate > 80 ? '🎯 达标' : 
                          overall.rate > 70 ? '📈 待改进' : '🚨 需关注';
        
        return `📊 **${metricType}整体时效达成率分析**

📈 **综合指标**
• 当前达成率: **${overall.rate.toFixed(1)}%**
• 已签收订单: ${overall.actual.toLocaleString()} 单
• Plan目标: ${overall.plan.toLocaleString()} 单
• 准时订单率: ${overall.onTimeRate.toFixed(1)}%
• 延迟订单率: ${overall.delayRate.toFixed(1)}%

🎯 **评级**: ${gradeEmoji}

${overall.rate >= 100 ? 
  `✅ **表现优异**\n超出目标 ${(overall.rate - 100).toFixed(1)}%，继续保持！` : 
  `⚠️ **改进空间**\n距离100%目标还需签收 ${overall.gap.toLocaleString()} 单`}`;
      }
    }

    // 场景5：数据统计概览
    if (intent === 'data') {
      const performance = expertSystem.calculateCarrierPerformance();
      const overall = expertSystem.calculateOverallRate();
      
      if (performance && overall) {
        const carrierCount = Object.keys(performance).length;
        const gradeA = Object.values(performance).filter(p => p.grade === 'A').length;
        const gradeB = Object.values(performance).filter(p => p.grade === 'B').length;
        const gradeC = Object.values(performance).filter(p => p.grade === 'C').length;
        const gradeD = Object.values(performance).filter(p => p.grade === 'D').length;
        
        return `📈 **${metricType}时效数据统计概览**

📦 **快递商分布**
• 合作快递商: ${carrierCount} 家
• A级(>95%): ${gradeA} 家
• B级(80-95%): ${gradeB} 家
• C级(70-80%): ${gradeC} 家
• D级(<70%): ${gradeD} 家

📊 **订单统计**
• 总签收订单: ${overall.actual.toLocaleString()} 单
• Plan目标: ${overall.plan.toLocaleString()} 单
• 准时订单: ${Math.round(overall.actual * overall.onTimeRate / 100).toLocaleString()} 单
• 延迟订单: ${Math.round(overall.actual * overall.delayRate / 100).toLocaleString()} 单

🗓️ **分析周期**
• 开始日期: ${dateRange?.from || '未设置'}
• 结束日期: ${dateRange?.to || '未设置'}
• 筛选品牌: ${selectedBrand || '全部品牌'}`;
      }
    }

    // 场景6：特定快递商分析
    if (intent.startsWith('carrier_')) {
      const carrierCode = intent.replace('carrier_', '');
      const analysis = expertSystem.analyzeCarrier(carrierCode);
      
      if (analysis) {
        return `📦 **${analysis.name}** ${metricType}时效分析报告

📊 **核心指标**
• 达成率: **${analysis.rate.toFixed(1)}%**
• 评级: ${analysis.assessment.emoji} ${analysis.grade}级
• 排名: 第${analysis.rank}/${analysis.totalCarriers}名

📈 **订单数据**
• 已签收: ${analysis.actual.toLocaleString()} 单
• Plan目标: ${analysis.plan.toLocaleString()} 单
• 准时率: ${analysis.onTimeRate.toFixed(1)}%
• 延迟率: ${analysis.delayRate.toFixed(1)}%

💬 **专家评价**
${analysis.assessment.comment}

💡 **建议措施**
${analysis.assessment.suggestion}`;
      }
    }

    // 🆕 场景7：竞品对标分析（只显示比率）
    if (intent === 'benchmark') {
      const benchmark = expertSystem.calculateBenchmarkComparison();
      
      if (!benchmark) {
        return `📊 **其他品牌对标功能提示**

⚠️ 行业对标功能未启用或暂无数据。

💡 **说明**：
行业对标功能可以帮助您了解在行业中的相对时效水平，但需要后台配置启用。

🔒 **隐私保护**：
我们承诺只展示比率数据，不泄露任何具体订单量信息。`;
      }

      const overall = expertSystem.calculateOverallRate();
      
      // 构建详细的竞品对比报告
      let report = `🏆 **行业对标分析报告** (${metricType})

━━━━━━━━━━━━━━━━━━━━

📊 **整体达成率对比** （仅显示百分比）

• 您的品牌 (${selectedBrand || 'VF'}): **${benchmark.currentRate.toFixed(1)}%**
• 行业平均值: **${benchmark.industryAverage.toFixed(1)}%**
• 相对位置: ${benchmark.position.emoji} **${benchmark.position.description}**

━━━━━━━━━━━━━━━━━━━━

📈 **多维度指标对比**

1️⃣ **Actual vs Plan 达成率**
   • 您的品牌: ${benchmark.currentRate.toFixed(1)}%
   • 行业平均: ${benchmark.industryAverage.toFixed(1)}%
   • 差距: ${benchmark.diff > 0 ? '+' : ''}${benchmark.diff.toFixed(1)}个百分点

2️⃣ **准时率** (≤48h订单占比)
   • 您的品牌: ${benchmark.currentOnTimeRate.toFixed(1)}%
   • 行业平均: ${benchmark.industryOnTimeAvg.toFixed(1)}%
   • 差距: ${(benchmark.currentOnTimeRate - benchmark.industryOnTimeAvg) > 0 ? '+' : ''}${(benchmark.currentOnTimeRate - benchmark.industryOnTimeAvg).toFixed(1)}个百分点

3️⃣ **延迟率** (>72h订单占比)
   • 您的品牌: ${benchmark.currentDelayRate.toFixed(1)}%
   • 行业平均: ${benchmark.industryDelayAvg.toFixed(1)}%
   • 差距: ${(benchmark.currentDelayRate - benchmark.industryDelayAvg) > 0 ? '+' : ''}${(benchmark.currentDelayRate - benchmark.industryDelayAvg).toFixed(1)}个百分点

4️⃣ **平均S2D时长**
   • 您的品牌: ${benchmark.currentAvgS2DTime.toFixed(1)}小时
   • 行业平均: ${benchmark.industryS2DAvg.toFixed(1)}小时
   • 差距: ${(benchmark.currentAvgS2DTime - benchmark.industryS2DAvg) > 0 ? '+' : ''}${(benchmark.currentAvgS2DTime - benchmark.industryS2DAvg).toFixed(1)}小时

━━━━━━━━━━━━━━━━━━━━

🚚 **快递商维度详细对比**

`;

      // 添加各竞品的快递商对比
      benchmark.competitors.forEach((comp, index) => {
        report += `\n【品牌${String.fromCharCode(65 + index)} vs 您的品牌】\n`;
        report += `品牌${String.fromCharCode(65 + index)}整体: 达成率${comp.achievementRate.toFixed(1)}%, S2D时长${comp.avgS2DTime.toFixed(1)}h\n\n`;
        
        // 获取所有快递商的并集
        const allCarriers = new Set([
          ...Object.keys(benchmark.currentCarriers),
          ...Object.keys(comp.carriers)
        ]);
        
        const carrierComparisons: Array<{carrier: string; yourRate: number; compRate: number; diff: number}> = [];
        
        allCarriers.forEach(carrier => {
          const yourCarrier = benchmark.currentCarriers[carrier];
          const compCarrier = comp.carriers[carrier];
          
          if (yourCarrier || compCarrier) {
            carrierComparisons.push({
              carrier,
              yourRate: yourCarrier?.achievementRate || 0,
              compRate: compCarrier?.achievementRate || 0,
              diff: (yourCarrier?.achievementRate || 0) - (compCarrier?.achievementRate || 0)
            });
          }
        });
        
        // 按差距排序（优势在前）
        carrierComparisons.sort((a, b) => b.diff - a.diff);
        
        carrierComparisons.forEach(comp_detail => {
          const carrierName = CARRIER_NAME_MAP[comp_detail.carrier] || comp_detail.carrier;
          const icon = comp_detail.diff > 5 ? '🌟' : comp_detail.diff > 0 ? '✅' : comp_detail.diff > -5 ? '📊' : '📈';
          
          if (comp_detail.yourRate > 0 && comp_detail.compRate > 0) {
            report += `   ${icon} ${carrierName}: 您${comp_detail.yourRate.toFixed(1)}% vs 品牌${comp_detail.compRate.toFixed(1)}% (${comp_detail.diff > 0 ? '+' : ''}${comp_detail.diff.toFixed(1)}%)\n`;
          } else if (comp_detail.yourRate > 0) {
            report += `   ℹ️  ${carrierName}: 您${comp_detail.yourRate.toFixed(1)}% vs 品牌无数据\n`;
          } else {
            report += `   ℹ️  ${carrierName}: 品牌${comp_detail.compRate.toFixed(1)}% vs 您无数据\n`;
          }
        });
      });

      report += `\n━━━━━━━━━━━━\n\n`;

      // 添加分析结论
      if (benchmark.diff > 0) {
        report += `✅ **优势分析**

• 您的${metricType}时效达成率处于 **${benchmark.position.level}** 水平
• 在整体达成率上领先行业平均 **${benchmark.diff.toFixed(1)}个百分点**
• 准时率表现${benchmark.currentOnTimeRate > benchmark.industryOnTimeAvg ? '优于' : '接近'}行业水平
• 建议继续保持优势，将成功经验推广到其他快递商

💡 **保持优势建议**
1. 继续加强与优质快递商（${Object.keys(benchmark.currentCarriers).slice(0, 2).map(c => CARRIER_NAME_MAP[c] || c).join('、')}）的合作
2. 定期监控准时率和延迟率指标，保持行业领先
3. 分析延迟订单根因，进一步降低延迟率
4. 将优势经验复制到表现较弱的快递商`;
      } else {
        report += `📈 **改进空间分析**

• 您的${metricType}时效达成率处于 **${benchmark.position.level}** 水平
• 与行业平均相差 **${Math.abs(benchmark.diff).toFixed(1)}个百分点**
• 建议参考行业最佳实践，优化快递商选择和订单分配策略

💡 **提升建议**
1. 分析与行业平均的差距根源（快递商选择、区域分布、SLA设定等）
2. 对比其他品牌在各快递商维度的表现，找出改进机会
3. ${benchmark.currentDelayRate > benchmark.industryDelayAvg ? '重点降低延迟率（当前高于行业平均）' : '保持当前延迟率水平'}
4. 加强时效监控和异常订单处理流程
5. 考虑引入更多优质快递商或优化现有快递商的合作条款`;
      }

      report += `\n\n🗓️ **分析周期**
• 时间范围: ${dateRange?.from} 至 ${dateRange?.to}
• 对比品牌数: ${benchmark.competitorCount}个品牌

⚠️ **数据说明**：
以上对比仅基于达成率、准时率、延迟率等比率指标，不涉及具体订单量，确保数据隐私安全。`;

      return report;
    }

    // 默认回复
    return `🤔 我理解你想了解 **"${userQuestion}"**

我可以为你分析以下内容：

📊 **快递商分析**
• "哪个快递商表现最好？"
• "顺丰的达成率怎么样？"

📈 **整体分析**
• "整体达成率是多少？"
• "数据统计概览"

🏆 **行业对标** (需启用)
• "我们的时效水平在行业中怎么样？"
• "和其他品牌对比如何？"

💡 提示：切换到GPT模式可以问更复杂的问题！`;
  };

  // 🔥 调用Dify GPT API
  const callDifyAPI = async (question: string): Promise<string> => {
    if (!isDifyConfigured) {
      return '⚠️ GPT模式未配置。请先配置Dify API密钥。\n\n查看 /AI_ASSISTANT_INTEGRATION_GUIDE.md 了解配置步骤。';
    }

    try {
      setError(null);

      // 🔥 提取关键数据摘要（避免超过Dify的256字符限制）
      const dataSummary = extractDataSummary(analysisData, metricType);

      // 🔥 将数据上下文附加到用户问题中
      const contextualQuery = `【数据分析上下文】
分析类型：${metricType}
时间范围：${dateRange ? `${dateRange.from} 至 ${dateRange.to}` : '未设置'}
筛选品牌：${selectedBrand || '全部品牌'}

${dataSummary}

【用户问题】
${question}`;

      // ✅ 修复：只有当conversationId存在时才发送，避免"Conversation Not Exists"错误
      const payload: any = {
        inputs: {}, // ✅ 不再使用inputs传递大量数据
        query: contextualQuery,
        response_mode: 'blocking',
        user: userIdRef.current
      };

      // 🔑 关键修复：只有当conversation_id有值时才添加到payload
      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      console.log('🚀 Dify API请求:', {
        url: `${DIFY_CONFIG.API_URL}/chat-messages`,
        queryLength: contextualQuery.length,
        conversationId: conversationId || '(首次对话)',
        hasConversationId: !!conversationId,
        userId: userIdRef.current,
        payload: payload
      });

      const response = await fetch(`${DIFY_CONFIG.API_URL}/chat-messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('📥 Dify API响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Dify API错误响应:', errorData);
        throw new Error(errorData.message || `API请求失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Dify API响应数据:', data);

      // 🔑 保存conversation_id用于后续对话
      if (data.conversation_id) {
        console.log('✅ 收到conversation_id:', data.conversation_id);
        setConversationId(data.conversation_id);
      }

      return data.answer || '抱歉，AI暂时无法回答这个问题';

    } catch (error: any) {
      console.error('❌ Dify API调用失败:', error);
      setError(error.message);
      
      // 🔑 如果是会话错误，自动清空会话ID重试
      if (error.message.includes('Conversation Not Exists')) {
        console.warn('⚠️ 会话不存在，清空conversation_id');
        setConversationId('');
        return '⚠️ 会话已过期或不存在。请重新开始对话。';
      }
      
      if (error.message.includes('401')) {
        return '⚠️ API密钥无效，请检查配置';
      } else if (error.message.includes('429')) {
        return '⚠️ 请求过于频繁，请稍后再试';
      } else if (error.message.includes('Failed to fetch')) {
        return '⚠️ 网络连接失败，请检查网络或API地址配置';
      } else {
        return `⚠️ AI服务暂时不可用：${error.message}`;
      }
    }
  };

  // 🔥 提取数据摘要函数（生成精简的数据上下文）
  const extractDataSummary = (data: any, metric: 'S2D' | 'C2D'): string => {
    if (!data) {
      return '暂无数据';
    }

    try {
      // 兼容不同的数据结构
      let brandCarrierStats = null;
      if (data?.s2dAnalysis?.brandCarrierStats) {
        brandCarrierStats = data.s2dAnalysis.brandCarrierStats;
      } else if (data?.c2dAnalysis?.brandCarrierStats) {
        brandCarrierStats = data.c2dAnalysis.brandCarrierStats;
      } else if (data?.brandCarrierStats) {
        brandCarrierStats = data.brandCarrierStats;
      }

      if (!brandCarrierStats) {
        return '暂无统计数据';
      }

      // 计算快递商汇总数据
      const carrierSummary: { [key: string]: { actual: number; plan: number; rate: number } } = {};
      
      Object.entries(brandCarrierStats).forEach(([key, stat]: [string, any]) => {
        const [, carrier] = key.split('|');
        
        const actual = (stat.actual24h || 0) + (stat.actual48h || 0) + (stat.actual72h || 0) + (stat.actualOver72h || 0);
        const plan = (stat.plan24h || 0) + (stat.plan48h || 0) + (stat.plan72h || 0) + (stat.planOver72h || 0);
        
        if (!carrierSummary[carrier]) {
          carrierSummary[carrier] = { actual: 0, plan: 0, rate: 0 };
        }
        
        carrierSummary[carrier].actual += actual;
        carrierSummary[carrier].plan += plan;
      });

      // 计算达成率
      Object.keys(carrierSummary).forEach(carrier => {
        const summary = carrierSummary[carrier];
        summary.rate = summary.plan > 0 ? (summary.actual / summary.plan) * 100 : 0;
      });

      // 生成摘要文本
      let summary = `【快递商${metric}时效数据摘要】\n\n`;
      
      const sortedCarriers = Object.entries(carrierSummary)
        .sort((a, b) => b[1].rate - a[1].rate);

      sortedCarriers.forEach(([carrier, stats]) => {
        const name = CARRIER_NAME_MAP[carrier] || carrier;
        summary += `${name}：达成率${stats.rate.toFixed(1)}%，已签收${stats.actual}单，Plan目标${stats.plan}单\n`;
      });

      // 计算总体数据
      const totalActual = Object.values(carrierSummary).reduce((sum, s) => sum + s.actual, 0);
      const totalPlan = Object.values(carrierSummary).reduce((sum, s) => sum + s.plan, 0);
      const overallRate = totalPlan > 0 ? (totalActual / totalPlan) * 100 : 0;

      summary += `\n【整体】：达成率${overallRate.toFixed(1)}%，总签收${totalActual}单，总Plan${totalPlan}单`;

      return summary;

    } catch (error) {
      console.error('数据摘要提取失败:', error);
      return '数据解析失败';
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      aiMode: aiMode
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // 根据模式调用不同的AI引擎
    let aiResponse: string;
    if (aiMode === 'local') {
      // 模拟思考时间
      await new Promise(resolve => setTimeout(resolve, 500));
      aiResponse = generateLocalResponse(userMessage.content);
    } else {
      aiResponse = await callDifyAPI(userMessage.content);
    }

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
      aiMode: aiMode
    };

    setMessages(prev => [...prev, assistantMessage]);
    setIsTyping(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 快捷问题
  const quickQuestions = aiMode === 'local' 
    ? [
        '哪个快递商表现最好？',
        '整体达成率怎么样？',
      ]
    : [
        '哪个快递商表现最好？',
        '给我完整的优化建议报告',
        '分析延迟订单的根本原因',
        '对比顺丰和中通的表现'
      ];

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className={`h-14 w-14 rounded-full shadow-lg ${
            aiMode === 'local' 
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
              : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
          }`}
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
        <div className="absolute -top-2 -right-2">
          <Badge className={`h-6 w-6 rounded-full flex items-center justify-center p-0 animate-pulse ${
            aiMode === 'local' ? 'bg-blue-500' : 'bg-gradient-to-r from-yellow-400 to-orange-500'
          }`}>
            {aiMode === 'local' ? (
              <Brain className="h-3 w-3" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
          </Badge>
        </div>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Card 
          className={`w-80 border-2 cursor-pointer shadow-lg ${
            aiMode === 'local'
              ? 'border-blue-500/30 bg-gradient-to-r from-blue-50 to-purple-50'
              : 'border-purple-500/30 bg-gradient-to-r from-purple-50 to-pink-50'
          }`}
          onClick={() => setIsMinimized(false)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`p-2 rounded-lg ${
                  aiMode === 'local'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                    : 'bg-gradient-to-r from-purple-500 to-pink-600'
                }`}>
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-sm">
                  {aiMode === 'local' ? '本地AI助手' : 'GPT AI助手'}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {messages.length} 条
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className={`w-[400px] max-h-[calc(100vh-3rem)] h-[580px] border-2 bg-white shadow-2xl flex flex-col ${
        aiMode === 'local' ? 'border-blue-500/30' : 'border-purple-500/30'
      }`}>
        <CardHeader className={`pb-3 border-b flex-shrink-0 ${
          aiMode === 'local' 
            ? 'bg-gradient-to-r from-blue-50 to-purple-50'
            : 'bg-gradient-to-r from-purple-50 to-pink-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`p-2 rounded-lg ${
                aiMode === 'local'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                  : 'bg-gradient-to-r from-purple-500 to-pink-600'
              }`}>
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm flex items-center space-x-1">
                  <span>{aiMode === 'local' ? '本地专家系统' : 'GPT时效分析'}</span>
                  {aiMode === 'gpt' && <Sparkles className="h-3 w-3 text-yellow-500" />}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {metricType} · {aiMode === 'local' ? '专家算法' : 'Powered by Dify'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              {/* AI模式切换下拉菜单 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>AI 模式切换</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleAiModeChange('local')}
                    className="cursor-pointer"
                  >
                    <Brain className="mr-2 h-4 w-4" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>本地专家系统</span>
                        {aiMode === 'local' && <span className="text-blue-500">✓</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        免费 · 极速 · 本地运算
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAiModeChange('gpt')}
                    className="cursor-pointer"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>GPT 大模型</span>
                        {aiMode === 'gpt' && <span className="text-purple-500">✓</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isDifyConfigured ? '强大 · 深度分析' : '未配置 · 可试用'}
                      </p>
                    </div>
                  </DropdownMenuItem>
                  
                  {/* 新建会话按钮 - 优化为所有模式可用 */}
                  {messages.length > 1 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          // 清空会话ID和消息
                          setConversationId('');
                          setMessages([{
                            id: Date.now().toString(),
                            role: 'assistant',
                            content: getWelcomeMessage(aiMode),
                            timestamp: new Date(),
                            aiMode: aiMode
                          }]);
                          setError(null);
                        }}
                        className="cursor-pointer text-orange-600"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        <div className="flex-1">
                          <div>新建会话</div>
                          <p className="text-xs text-muted-foreground">
                            清空聊天记录，开始新对话
                          </p>
                        </div>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          {/* 错误提示 */}
          {error && (
            <Alert variant="destructive" className="m-3 mb-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto p-3" ref={scrollAreaRef}>
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-2.5 ${
                      message.role === 'user'
                        ? message.aiMode === 'local'
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                          : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      {message.role === 'assistant' ? (
                        <>
                          <Bot className="h-3 w-3" />
                          {message.aiMode === 'gpt' && (
                            <Sparkles className="h-3 w-3 text-yellow-500" />
                          )}
                        </>
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                      <span className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-xs whitespace-pre-line leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-2.5 max-w-[80%]">
                    <div className="flex items-center space-x-2">
                      <Loader2 className={`h-4 w-4 animate-spin ${
                        aiMode === 'local' ? 'text-blue-500' : 'text-purple-500'
                      }`} />
                      <span className="text-xs text-gray-600">
                        {aiMode === 'local' ? 'AI正在分析...' : 'GPT正在深度分析...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 快捷问题 */}
          {messages.length <= 2 && (
            <div className="px-3 pb-2 space-y-2">
              <p className="text-xs text-muted-foreground">💡 快速开始：</p>
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((q, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setInputValue(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 输入区域 */}
          <div className="border-t p-3 bg-gray-50 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="问我任何问题..."
                disabled={isTyping}
                className="flex-1 text-xs h-8"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                size="sm"
                className={`h-8 w-8 p-0 ${
                  aiMode === 'local'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                    : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700'
                }`}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
              <div className="flex items-center">
                {aiMode === 'local' ? (
                  <>
                    <Brain className="h-3 w-3 mr-1" />
                    <span>专家算法 · 本地运算</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 mr-1 text-yellow-500" />
                    <span>GPT-4 · Dify驱动</span>
                  </>
                )}
              </div>
              {aiMode === 'gpt' && conversationId && (
                <Badge 
                  variant="secondary" 
                  className="text-xs h-4 cursor-pointer" 
                  title={`会话ID: ${conversationId.substring(0, 12)}...`}
                  onClick={() => {
                    console.log('📋 完整会话ID:', conversationId);
                    navigator.clipboard.writeText(conversationId);
                  }}
                >
                  会话中
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
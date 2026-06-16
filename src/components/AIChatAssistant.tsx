import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  User,
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  Loader2
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatAssistantProps {
  analysisData: any;
  selectedBrand?: string;
  dateRange?: { from: string; to: string };
  metricType?: 'S2D' | 'C2D';
}

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
  'recommend': ['建议', '推荐', '应该', '怎么办', '怎么做']
};

// 🔥 专家系统：核心分析引擎
class TimeEfficiencyExpertSystem {
  private analysisData: any;
  private metricType: 'S2D' | 'C2D';
  private selectedBrand?: string;
  private dateRange?: { from: string; to: string };

  constructor(analysisData: any, metricType: 'S2D' | 'C2D', selectedBrand?: string, dateRange?: { from: string; to: string }) {
    this.analysisData = analysisData;
    this.metricType = metricType;
    this.selectedBrand = selectedBrand;
    this.dateRange = dateRange;
  }

  // 🎯 计算快递商综合性能
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
        onTime: number; // 准时订单（24h+48h）
        delayed: number; // 延迟订单（72h+72h+）
        avgDelay: number; // 平均延迟率
        grade: 'A' | 'B' | 'C' | 'D'; // 评级
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

    // 计算达成率、延迟率、评级
    Object.keys(carrierPerformance).forEach(carrier => {
      const perf = carrierPerformance[carrier];
      perf.rate = perf.plan > 0 ? (perf.actual / perf.plan) * 100 : 0;
      perf.avgDelay = perf.actual > 0 ? (perf.delayed / perf.actual) * 100 : 0;
      
      // 评级逻辑：A(>120%) B(100-120%) C(80-100%) D(<80%)
      if (perf.rate > 120) {
        perf.grade = 'A';
      } else if (perf.rate >= 100) {
        perf.grade = 'B';
      } else if (perf.rate >= 80) {
        perf.grade = 'C';
      } else {
        perf.grade = 'D';
      }
    });

    return carrierPerformance;
  }

  // 🎯 获取最佳快递商
  getBestCarrier() {
    const performance = this.calculateCarrierPerformance();
    if (!performance) return null;

    return Object.entries(performance)
      .sort((a, b) => b[1].rate - a[1].rate)[0];
  }

  // 🎯 获取最差快递商
  getWorstCarrier() {
    const performance = this.calculateCarrierPerformance();
    if (!performance) return null;

    return Object.entries(performance)
      .filter(([, perf]) => perf.actual > 50) // 至少有50单才评估
      .sort((a, b) => a[1].rate - b[1].rate)[0];
  }

  // 🎯 计算整体达成率
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

  // 🎯 生成排名对比
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

  // 🎯 生成优化建议
  generateOptimizationSuggestions() {
    const overall = this.calculateOverallRate();
    const performance = this.calculateCarrierPerformance();
    
    if (!overall || !performance) return [];

    const suggestions = [];

    // 建议1：整体达成率分析
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

    // 建议2：低性能快递商优化
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

    // 建议3：延迟订单优化
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

    // 建议4：高性能快递商激励
    const topPerformers = Object.entries(performance)
      .filter(([, perf]) => perf.rate > 120);
    
    if (topPerformers.length > 0) {
      suggestions.push({
        priority: 'low',
        category: '合作优化',
        title: '增加优质快递商合作',
        detail: topPerformers.map(([c]) => CARRIER_NAME_MAP[c] || c).join('、') + '表现优异',
        actions: [
          '考虑增加订单分配比例',
          '建立长期战略合作关系',
          '设置激励机制维持高绩效'
        ]
      });
    }

    return suggestions;
  }

  // 🎯 分析特定快递商
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

  // 🎯 快递商评价
  private getCarrierAssessment(perf: any) {
    if (perf.rate > 120) {
      return {
        level: '优秀',
        emoji: '🌟',
        comment: '表现卓越，超出目标20%以上',
        suggestion: '建议增加订单分配比例，建立战略合作关系'
      };
    } else if (perf.rate >= 100) {
      return {
        level: '良好',
        emoji: '✅',
        comment: '达到目标，表现稳定',
        suggestion: '继续保持现有合作水平，定期评估优化空间'
      };
    } else if (perf.rate >= 80) {
      return {
        level: '待改进',
        emoji: '⚠️',
        comment: '接近目标，仍有提升空间',
        suggestion: '分析未达标原因，制定改进计划'
      };
    } else {
      return {
        level: '需关注',
        emoji: '🚨',
        comment: '低于目标20%以上，需要重点关注',
        suggestion: '紧急沟通改进方案，考虑调整合作策略'
      };
    }
  }

  // 🎯 智能问题匹配（支持模糊匹配和同义词）
  matchIntent(question: string): string {
    const q = question.toLowerCase();
    
    for (const [intent, synonyms] of Object.entries(SYNONYM_DICT)) {
      if (synonyms.some(word => q.includes(word))) {
        return intent;
      }
    }
    
    // 快递商匹配
    for (const [code, name] of Object.entries(CARRIER_NAME_MAP)) {
      if (q.includes(code.toLowerCase()) || q.includes(name)) {
        return `carrier_${code}`;
      }
    }
    
    return 'unknown';
  }
}

export function AIChatAssistant({ 
  analysisData, 
  selectedBrand, 
  dateRange,
  metricType = 'S2D'
}: AIChatAssistantProps) {
  // 🔒 功能暂未开放，直接返回 null 隐藏
  return null;

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 初始欢迎消息
  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `你好！我是AI时效分析助手 🤖

我是基于**专家经验算法**的智能分析系统，可以帮你：

📊 **数据分析**
• 分析${metricType}时效数据
• 计算达成率和准时率
• 对比快递商表现

🎯 **专业建议**
• 生成优化改进方案
• 评估快递商绩效
• 提供行业最佳实践

💡 **快速开始**
试着问我：
"哪个快递商表现最好？"
"如何提升时效达成率？"
"顺丰和中通的对比如何？"`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, metricType]);

  // 自动滚动到最新消息
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // 🔥 AI 回答生成逻辑 - 基于专家系统
  const generateAIResponse = (userQuestion: string): string => {
    const question = userQuestion.toLowerCase();

    // 🔍 兼容多种数据结构格式
    // 格式1: { s2dAnalysis: { brandCarrierStats: {...} } }  ← API返回格式
    // 格式2: { brandCarrierStats: {...} }  ← 直接格式
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

    // 初始化专家系统（使用兼容的数据结构）
    const compatibleAnalysisData = {
      brandCarrierStats: brandCarrierStats
    };
    
    const expertSystem = new TimeEfficiencyExpertSystem(
      compatibleAnalysisData, 
      metricType, 
      selectedBrand, 
      dateRange
    );

    // 智能意图识别
    const intent = expertSystem.matchIntent(question);

    // 🎯 场景1：询问最佳快递商
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

    // 🎯 场景2：询问最差快递商
    if (intent === 'worst') {
      const worst = expertSystem.getWorstCarrier();
      if (worst) {
        const [carrier, perf] = worst;
        const name = CARRIER_NAME_MAP[carrier] || carrier;
        const analysis = expertSystem.analyzeCarrier(carrier);
        
        return `⚠️ **${name}** 需要重点关注

📊 **核心数据**
• ${metricType}时效达成率: **${perf.rate.toFixed(1)}%**
• 已签收订单: ${perf.actual.toLocaleString()} 单
• 距离目标: 差 ${(100 - perf.rate).toFixed(1)}%
• 延迟率: ${perf.avgDelay.toFixed(1)}%

🚨 **问题分析**
${analysis?.assessment.comment}

🔧 **改进建议**
1️⃣ 与快递商紧急沟通，制定改进计划
2️⃣ 分析延迟订单的共性特征（区域、时段）
3️⃣ 评估Plan时效设置是否合理
4️⃣ 考虑调整订单分配策略`;
      }
    }

    // 🎯 场景3：快递商对比排名
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

    // 🎯 场景4：优化改进建议
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

    // 🎯 场景5：整体达成率查询
    if (intent === 'rate') {
      const overall = expertSystem.calculateOverallRate();
      if (overall) {
        const gradeEmoji = overall.rate > 120 ? '🌟 优秀' : 
                          overall.rate > 100 ? '🎯 达标' : 
                          overall.rate > 80 ? '📈 待改进' : '🚨 需关注';
        
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

    // 🎯 场景6：数据统计概览
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
• A级(>120%): ${gradeA} 家
• B级(100-120%): ${gradeB} 家
• C级(80-100%): ${gradeC} 家
• D级(<80%): ${gradeD} 家

📊 **订单统计**
• 总签收订单: ${overall.actual.toLocaleString()} 单
• Plan目标: ${overall.plan.toLocaleString()} 单
• 准时订单: ${Math.round(overall.actual * overall.onTimeRate / 100).toLocaleString()} 单
• 延迟订单: ${Math.round(overall.actual * overall.delayRate / 100).toLocaleString()} 单

🗓️ **分析周期**
• 开始日期: ${dateRange?.from || '未设置'}
• 结束日期: ${dateRange?.to || '未设置'}
• 筛选品牌: ${selectedBrand || '全部品牌'}

💡 试着问我更具体的问题，例如：
"顺丰的表现如何？"
"给我一些优化建议"`;
      }
    }

    // 🎯 场景7：特定快递商分析
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

    // 默认回复 - 智能引导
    return `🤔 我理解你想了解 **"${userQuestion}"**

我可以为你分析以下内容：

📊 **快递商分析**
• "哪个快递商表现最好？"
• "顺丰的达成率怎么样？"
• "中通和圆通的对比"

📈 **整体分析**
• "整体达成率是多少？"
• "数据统计概览"
• "给我看排名"

💡 **优化建议**
• "如何提升时效？"
• "有什么改进建议？"
• "怎么优化延迟订单？"

试试问我上面这些问题吧！`;
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // 模拟AI思考时间
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateAIResponse(userMessage.content),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 800);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-red-500 h-6 w-6 rounded-full flex items-center justify-center p-0 animate-pulse">
            AI
          </Badge>
        </div>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Card 
          className="w-80 border-2 border-blue-500/30 bg-gradient-to-r from-blue-50 to-purple-50 cursor-pointer shadow-lg"
          onClick={() => setIsMinimized(false)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-sm">AI问答助手</CardTitle>
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                  {messages.length} 条消息
                </Badge>
              </div>
              <div className="flex items-center space-x-1">
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
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card className="w-[360px] max-h-[calc(100vh-3rem)] h-[480px] border-2 border-blue-500/30 bg-white shadow-2xl flex flex-col">
        <CardHeader className="pb-3 border-b bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm">AI时效分析助手</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {metricType} · 专家系统算法驱动
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
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
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      {message.role === 'assistant' ? (
                        <Bot className="h-3 w-3" />
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
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      <span className="text-xs text-gray-600">AI正在分析...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t p-3 bg-gray-50 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="问我任何问题..."
                className="flex-1 text-xs h-8"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                size="sm"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 h-8 w-8 p-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-center mt-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 mr-1" />
              <span>专家算法 · 本地运算</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
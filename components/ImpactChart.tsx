
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Package, TrendingUp, AlertTriangle, Activity, Info, ExternalLink, Calculator, BarChart3 } from "lucide-react";
import { brandPlatformCrossData, platformsData, getPlatformKPIData } from "../data/platformData";
import { getAllCourierBaseExceptionRates, generateExceptionRateReport, getCourierBaseExceptionRate } from "../utils/baseExceptionRateCalculator";

interface ImpactChartProps {
  selectedBrand?: string;
  selectedPlatform?: string;
  onExceptionClick?: (exceptionType: string, brand?: string, courier?: string) => void;
}

// VF子品牌列表
const VF_SUB_BRANDS = ['TNF', 'DICKIES', 'VANS', 'TIMBERLAND', 'ICEBREAKER', 'KIPLING'];

// 快递商列表 - 只保留顺丰和中通
const COURIERS = ['中通', '顺丰'];

// 简化的超时异常分类 - 包含4种基础超时异常
const EXCEPTION_TYPES = [
  { key: 'pickup_timeout', name: '超时未揽收', icon: '⏰', color: 'var(--accent-mid-orange)', description: '超过2小时未完成揽收', threshold: '2小时' },
  { key: 'shipping_timeout', name: '超时未发运', icon: '🚛', color: 'var(--accent-mid-red)', description: '超过12小时未完成发运', threshold: '12小时' },
  { key: 'shipping_no_update_48h', name: '超48h未更新', icon: '📡', color: 'var(--functional-mid-blue)', description: '超过48小时无状态更新', threshold: '48小时' },
  { key: 'delivery_timeout', name: '超时未签收', icon: '📦', color: 'var(--accent-mid-teal)', description: '超过3天未完成签收', threshold: '3天' }
];

interface SankeyNode {
  id: string;
  name: string;
  layer: number; // 0: 品牌, 1: 快递商, 2: 异常类型
  value: number;
  x: number;
  y: number;
  height: number;
  color: string;
  icon?: string;
  clickable?: boolean;
  exceptionType?: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color: string;
  path: string;
  exceptionRate: number;
  brand?: string;
  courier?: string;
  exceptionType?: string;
}

export function ImpactChart({ selectedBrand, selectedPlatform, onExceptionClick }: ImpactChartProps) {
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [selectedExceptionType, setSelectedExceptionType] = useState<string | null>(null);
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);

  // 动态计算基础异常率
  const baseExceptionRates = useMemo(() => {
    return getAllCourierBaseExceptionRates({
      timeWindowDays: 30,
      minOrderThreshold: 1000,
      smoothingFactor: 0.8
    });
  }, []);

  // 生成异常率报告
  const exceptionRateReport = useMemo(() => {
    return generateExceptionRateReport({
      timeWindowDays: 30,
      minOrderThreshold: 1000,
      smoothingFactor: 0.8
    });
  }, []);

  // 模拟生成品牌×快递商×异常数据
  const generateSankeyData = () => {
    const data = [];
    
    VF_SUB_BRANDS.forEach(brand => {
      // 如果有品牌筛选且不匹配，跳过
      if (selectedBrand && selectedBrand !== brand) return;
      
      COURIERS.forEach(courier => {
        // 基础订单量（模拟数据）
        const baseOrders = Math.floor(Math.random() * 15000) + 10000;
        
        // 使用动态计算的基础异常率
        const baseExceptionRate = baseExceptionRates[courier] || getCourierBaseExceptionRate(courier);
        
        // 品牌影响系数
        const brandFactor = brand === 'TNF' ? 0.85 : 
                          brand === 'DICKIES' ? 1.15 : 
                          brand === 'VANS' ? 0.95 : 
                          brand === 'TIMBERLAND' ? 0.90 : 
                          brand === 'ICEBREAKER' ? 0.80 : 1.10;
        
        const totalExceptionRate = baseExceptionRate * brandFactor;
        const totalExceptionOrders = Math.floor(baseOrders * totalExceptionRate);
        const normalOrders = baseOrders - totalExceptionOrders;
        
        // 按异常类型分布 - 4种异常类型
        // 根据快递商特性调整分布比例
        const exceptionDistribution = {
          pickup_timeout: courier === '中通' ? 0.30 : 0.20,           // 超时未揽收：中通30%，顺丰20%
          shipping_timeout: courier === '中通' ? 0.25 : 0.22,         // 超时未发运：中通25%，顺丰22%
          shipping_no_update_48h: courier === '中通' ? 0.25 : 0.18,   // 超48h未更新：中通25%，顺丰18%
          delivery_timeout: courier === '中通' ? 0.20 : 0.40          // 超时未签收：中通20%，顺丰40%
        };
        
        const exceptionsByType = {};
        EXCEPTION_TYPES.forEach(type => {
          exceptionsByType[type.key] = Math.floor(totalExceptionOrders * exceptionDistribution[type.key]);
        });
        
        data.push({
          brand,
          courier,
          totalOrders: baseOrders,
          normalOrders,
          totalExceptionOrders,
          totalExceptionRate: totalExceptionRate * 100,
          baseExceptionRate: baseExceptionRate * 100,
          brandFactor,
          exceptionsByType
        });
      });
    });
    
    return data;
  };

  const rawData = generateSankeyData();

  // 构建Sankey节点和链接
  const buildSankeyData = () => {
    const nodes: SankeyNode[] = [];
    const links: SankeyLink[] = [];

    // 计算各层级的总值
    const brandTotals = new Map();
    const courierTotals = new Map();
    const exceptionTypeTotals = new Map();
    let normalTotal = 0;

    rawData.forEach(item => {
      // 品牌总计
      brandTotals.set(item.brand, (brandTotals.get(item.brand) || 0) + item.totalOrders);
      // 快递商总计
      courierTotals.set(item.courier, (courierTotals.get(item.courier) || 0) + item.totalOrders);
      // 正常订单总计
      normalTotal += item.normalOrders;
      // 异常类型总计
      EXCEPTION_TYPES.forEach(type => {
        const count = item.exceptionsByType[type.key] || 0;
        exceptionTypeTotals.set(type.key, (exceptionTypeTotals.get(type.key) || 0) + count);
      });
    });

    const totalOrders = normalTotal + Array.from(exceptionTypeTotals.values()).reduce((sum, val) => sum + val, 0);
    
    // 使用更紧凑的画布比例 - 再次大幅缩小尺寸
    const chartHeight = 200;
    const chartWidth = 420;

    // 品牌图标
    const getBrandIcon = (brand: string) => {
      const icons = {
        'TNF': '🏔️', 'DICKIES': '👔', 'VANS': '👟',
        'TIMBERLAND': '🥾', 'ICEBREAKER': '🧊', 'KIPLING': '🎒'
      };
      return icons[brand] || '🏷️';
    };

    // 快递商图标
    const getCourierIcon = (courier: string) => {
      const icons = { '中通': '🚛', '顺丰': '✈️' };
      return icons[courier] || '🚚';
    };

    // 统一节点颜色 - 所有节点使用马士基蓝
    const getUnifiedNodeColor = () => {
      return 'var(--maersk-blue)';
    };

    // 创建品牌节点 - 大幅缩小适配更小的图表，移动到最顶部
    let yOffset = 0;
    const brandNodes = Array.from(brandTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([brand, total], index) => {
        // 大幅减小最小高度
        const height = Math.max(30, (total / totalOrders) * chartHeight * 0.35);
        const node: SankeyNode = {
          id: `brand-${brand}`,
          name: brand,
          layer: 0,
          value: total,
          x: 20, // 调整位置
          y: yOffset,
          height,
          color: getUnifiedNodeColor(),
          icon: getBrandIcon(brand)
        };
        yOffset += height + 4; // 进一步减少间距
        return node;
      });

    // 创建快递商节点 - 大幅缩小适配更小的图表，向上移动
    yOffset = 20;
    const courierNodes = Array.from(courierTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([courier, total]) => {
        // 大幅减小最小高度
        const height = Math.max(40, (total / totalOrders) * chartHeight * 0.30);
        const node: SankeyNode = {
          id: `courier-${courier}`,
          name: courier,
          layer: 1,
          value: total,
          x: 175, // 调整位置
          y: yOffset,
          height,
          color: getUnifiedNodeColor(),
          icon: getCourierIcon(courier)
        };
        yOffset += height + 10;
        return node;
      });

    // 创建异常类型节点 - 大幅缩小适配更小的图表，向上移动
    yOffset = 10;
    const exceptionNodes: SankeyNode[] = [];
    
    // 正常订单节点
    const normalHeight = Math.max(28, (normalTotal / totalOrders) * chartHeight * 0.30);
    exceptionNodes.push({
      id: 'status-normal',
      name: '正常订单',
      layer: 2,
      value: normalTotal,
      x: 320, // 调整位置
      y: yOffset,
      height: normalHeight,
      color: getUnifiedNodeColor(),
      icon: '✅'
    });
    yOffset += normalHeight + 4;

    // 异常类型节点
    EXCEPTION_TYPES.forEach(type => {
      const total = exceptionTypeTotals.get(type.key) || 0;
      if (total > 0) {
        const height = Math.max(28, (total / totalOrders) * chartHeight * 0.30);
        exceptionNodes.push({
          id: `exception-${type.key}`,
          name: type.name,
          layer: 2,
          value: total,
          x: 320,
          y: yOffset,
          height,
          color: getUnifiedNodeColor(),
          icon: type.icon,
          clickable: true,
          exceptionType: type.key
        });
        yOffset += height + 4;
      }
    });

    nodes.push(...brandNodes, ...courierNodes, ...exceptionNodes);

    // 创建链接
    rawData.forEach(item => {
      const brandNode = brandNodes.find(n => n.name === item.brand);
      const courierNode = courierNodes.find(n => n.name === item.courier);
      
      if (brandNode && courierNode) {
        // 品牌到快递商的链接 - 简化为2级风险
        // 设定10%为风险阈值
        const isRisky = item.totalExceptionRate > 10;
        const linkColor = isRisky ? 'var(--accent-light-red)' : 'var(--accent-light-green)';
        
        links.push({
          source: brandNode.id,
          target: courierNode.id,
          value: item.totalOrders,
          color: linkColor,
          path: `${item.brand}-${item.courier}`,
          exceptionRate: item.totalExceptionRate,
          brand: item.brand,
          courier: item.courier
        });

        // 快递商到正常订单的链接 - 正常订单用绿色
        if (item.normalOrders > 0) {
          links.push({
            source: courierNode.id,
            target: 'status-normal',
            value: item.normalOrders,
            color: 'var(--accent-light-green)',
            path: `${item.courier}-normal`,
            exceptionRate: 0,
            courier: item.courier
          });
        }

        // 快递商到各异常类型的链接 - 异常链接统一用红色
        EXCEPTION_TYPES.forEach(type => {
          const exceptionCount = item.exceptionsByType[type.key] || 0;
          if (exceptionCount > 0) {
            links.push({
              source: courierNode.id,
              target: `exception-${type.key}`,
              value: exceptionCount,
              color: 'var(--accent-light-red)', // 统一使用红色表示异常
              path: `${item.courier}-${type.key}`,
              exceptionRate: (exceptionCount / item.totalOrders) * 100,
              brand: item.brand,
              courier: item.courier,
              exceptionType: type.key
            });
          }
        });
      }
    });

    return { nodes, links, chartWidth, chartHeight };
  };

  const { nodes, links, chartWidth, chartHeight } = buildSankeyData();

  // 统计数据
  const totalOrders = rawData.reduce((sum, item) => sum + item.totalOrders, 0);
  const totalExceptions = rawData.reduce((sum, item) => sum + item.totalExceptionOrders, 0);
  const overallExceptionRate = ((totalExceptions / totalOrders) * 100).toFixed(1);
  const ztData = rawData.filter(item => item.courier === '中通');
  const ztPercentage = ((ztData.reduce((sum, item) => sum + item.totalOrders, 0) / totalOrders) * 100).toFixed(0);
  const sfData = rawData.filter(item => item.courier === '顺丰');
  const sfPercentage = ((sfData.reduce((sum, item) => sum + item.totalOrders, 0) / totalOrders) * 100).toFixed(0);
  const activeBrands = selectedBrand ? 1 : VF_SUB_BRANDS.length;

  // 生成SVG路径
  const generatePath = (link: any) => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (!sourceNode || !targetNode) return '';

    // 调整节点宽度适配更小的图表
    const sourceNodeWidth = sourceNode.layer === 2 ? 90 : 85;
    const sourceX = sourceNode.x + sourceNodeWidth;
    const sourceY = sourceNode.y + sourceNode.height / 2;
    const targetX = targetNode.x;
    const targetY = targetNode.y + targetNode.height / 2;
    
    const midX = (sourceX + targetX) / 2;
    
    // 线条粗细适配更小的图表
    const strokeWidth = Math.max(1, (link.value / totalOrders) * 25);
    
    return {
      path: `M ${sourceX} ${sourceY} C ${midX} ${sourceY} ${midX} ${targetY} ${targetX} ${targetY}`,
      strokeWidth,
      opacity: hoveredPath && hoveredPath !== link.path ? 0.3 : 0.8
    };
  };

  // 处理异常节点点击
  const handleExceptionNodeClick = (node: SankeyNode) => {
    if (node.clickable && node.exceptionType && onExceptionClick) {
      onExceptionClick(node.exceptionType, selectedBrand, undefined);
    }
  };

  // 处理异常链接点击
  const handleExceptionLinkClick = (link: SankeyLink) => {
    if (link.exceptionType && onExceptionClick) {
      onExceptionClick(link.exceptionType, link.brand, link.courier);
    }
  };

  return (
    <Card className="maersk-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Package className="h-5 w-5 text-maersk-blue" />
          <span>VF子品牌×快递承运商×异常分类流向分析</span>
          {selectedBrand && VF_SUB_BRANDS.includes(selectedBrand) && (
            <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue ml-4">
              {selectedBrand}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCalculationDetails(!showCalculationDetails)}
            className="ml-4 text-maersk-blue hover:bg-functional-bright-blue"
          >
            <Calculator className="h-4 w-4 mr-1" />
            计算详情
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {/* 基础异常率计算详情 */}
        {showCalculationDetails && (
          <div className="mb-6 p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
            <h4 className="font-medium text-maersk-black mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-maersk-blue" />
              基础异常率计算详情
            </h4>
            
            {/* 计算方法说明 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="p-3 bg-maersk-white rounded border border-functional-light-grey">
                <h5 className="text-sm font-medium text-maersk-black mb-2">🧮 计算方法</h5>
                <div className="text-xs text-functional-mid-grey space-y-1">
                  <p><strong>数据来源:</strong> 过去30天历史订单数据</p>
                  <p><strong>计算公式:</strong> 基础异常率 = 总异常订单数 / 总订单数</p>
                  <p><strong>平滑处理:</strong> 80%当前数据 + 20%历史基准</p>
                  <p><strong>异常值处理:</strong> 限制在基准值的0.5-2倍范围内</p>
                </div>
              </div>
              
              <div className="p-3 bg-maersk-white rounded border border-functional-light-grey">
                <h5 className="text-sm font-medium text-maersk-black mb-2">📊 当前异常率</h5>
                <div className="space-y-2">
                  {COURIERS.map(courier => (
                    <div key={courier} className="flex items-center justify-between text-xs">
                      <span className="text-functional-mid-grey">
                        {courier === '中通' ? '🚛' : '✈️'} {courier}:
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-maersk-black">
                          {(baseExceptionRates[courier] * 100).toFixed(2)}%
                        </span>
                        <div className={`w-2 h-2 rounded-full ${
                          baseExceptionRates[courier] > 0.10 ? 'bg-accent-mid-red' : 'bg-accent-mid-green'
                        }`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 报告摘要 */}
            <div className="p-3 bg-maersk-white rounded border border-functional-light-grey">
              <h5 className="text-sm font-medium text-maersk-black mb-2">📋 异常率分析报告</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                <div className="text-center">
                  <div className="font-medium text-maersk-blue">{exceptionRateReport.summary.totalCouriers}</div>
                  <div className="text-functional-mid-grey">参与快递商</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-accent-mid-orange">
                    {(exceptionRateReport.summary.averageExceptionRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-functional-mid-grey">平均异常率</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-accent-mid-red">{exceptionRateReport.summary.highestRiskCourier}</div>
                  <div className="text-functional-mid-grey">最高风险</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-accent-mid-green">{exceptionRateReport.summary.lowestRiskCourier}</div>
                  <div className="text-functional-mid-grey">最低风险</div>
                </div>
              </div>
              
              {/* 建议 */}
              {exceptionRateReport.recommendations.length > 0 && (
                <div className="mt-3 p-2 bg-accent-bright-orange rounded text-xs">
                  <div className="font-medium text-accent-dark-orange mb-1">💡 优化建议:</div>
                  <ul className="text-accent-dark-orange space-y-1">
                    {exceptionRateReport.recommendations.slice(0, 2).map((rec, index) => (
                      <li key={index}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 统计概览 */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="text-center p-3 bg-functional-bright-blue rounded-lg border border-functional-light-blue">
            <div className="text-2xl font-semibold text-functional-dark-blue">
              {totalOrders.toLocaleString()}
            </div>
            <div className="text-sm text-functional-mid-blue">总订单量</div>
          </div>
          
          <div className="text-center p-3 bg-accent-bright-orange rounded-lg border border-accent-light-orange">
            <div className="text-2xl font-semibold text-accent-dark-orange">
              {ztPercentage}%
            </div>
            <div className="text-sm text-accent-mid-orange">中通占比</div>
            <div className="text-xs text-accent-mid-orange mt-1">
              基础异常率: {(baseExceptionRates['中通'] * 100).toFixed(1)}%
            </div>
          </div>
          
          <div className="text-center p-3 bg-accent-bright-green rounded-lg border border-accent-light-green">
            <div className="text-2xl font-semibold text-accent-dark-green">
              {sfPercentage}%
            </div>
            <div className="text-sm text-accent-mid-green">顺丰占比</div>
            <div className="text-xs text-accent-mid-green mt-1">
              基础异常率: {(baseExceptionRates['顺丰'] * 100).toFixed(1)}%
            </div>
          </div>
          
          <div className="text-center p-3 bg-accent-bright-red rounded-lg border border-accent-light-red">
            <div className="text-2xl font-semibold text-accent-dark-red">
              {overallExceptionRate}%
            </div>
            <div className="text-sm text-accent-mid-red">整体异常率</div>
          </div>
          
          <div className="text-center p-3 bg-accent-bright-teal rounded-lg border border-accent-light-teal">
            <div className="text-2xl font-semibold text-accent-dark-teal">
              {activeBrands}
            </div>
            <div className="text-sm text-accent-mid-teal">活跃子品牌</div>
          </div>
        </div>

        {/* Sankey流向图 - 响应式容器适配 */}
        <div className="bg-maersk-white p-6 rounded-lg border border-functional-light-grey">
          <div className="mb-6">
            <h4 className="font-medium text-maersk-black mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-maersk-blue" />
              订单流向与异常分类分析
              <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-light-blue text-xs">
                容器适配·简化风险分级
              </Badge>
            </h4>
            <p className="text-sm text-functional-mid-grey mb-6">
              所有节点统一使用马士基蓝色，流向线条颜色表示风险状态，线条粗细表示订单量。
              <strong className="text-maersk-blue ml-2">点击异常节点可查看物流监控详情</strong>
            </p>
          </div>

          {/* SVG Sankey图 - 极紧凑的响应式布局 */}
          <div className="relative w-full">
            <svg 
              width="100%" 
              height="160" 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* 绘制链接 */}
              {links.map((link, index) => {
                const pathData = generatePath(link);
                return (
                  <path
                    key={index}
                    d={pathData.path}
                    fill="none"
                    stroke={link.color}
                    strokeWidth={pathData.strokeWidth}
                    opacity={pathData.opacity}
                    className={`transition-opacity duration-200 ${link.exceptionType ? 'cursor-pointer hover:opacity-100' : ''}`}
                    onMouseEnter={() => setHoveredPath(link.path)}
                    onMouseLeave={() => setHoveredPath(null)}
                    onClick={() => link.exceptionType && handleExceptionLinkClick(link)}
                    title={link.exceptionType ? `点击查看${link.exceptionType}异常详情` : ''}
                  />
                );
              })}

              {/* 绘制节点 */}
              {nodes.map((node, index) => (
                <g key={index}>
                  {/* 节点矩形 - 大幅减小尺寸适配更小的图表 */}
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.layer === 2 ? 90 : 85} 
                    height={node.height}
                    fill={node.color}
                    rx={3}
                    opacity={0.9}
                    className={`${node.clickable ? 'cursor-pointer hover:opacity-100' : ''} transition-opacity`}
                    onClick={() => node.clickable && handleExceptionNodeClick(node)}
                  />
                  
                  {/* 可点击提示 */}
                  {node.clickable && (
                    <>
                      <circle
                        cx={node.x + (node.layer === 2 ? 90 : 85) - 10}
                        cy={node.y + 10}
                        r={5}
                        fill="var(--maersk-white)"
                        opacity={0.95}
                      />
                      <text
                        x={node.x + (node.layer === 2 ? 90 : 85) - 10}
                        y={node.y + 14}
                        textAnchor="middle"
                        fill="var(--functional-dark-blue)"
                        fontSize="6"
                        fontWeight="bold"
                      >
                        ↗
                      </text>
                    </>
                  )}
                  
                  {/* 节点标签 - 进一步缩小字体 */}
                  <text
                    x={node.x + (node.layer === 2 ? 45 : 42.5)}
                    y={node.y + node.height / 2 - 3}
                    textAnchor="middle"
                    fill="white"
                    fontSize="8"
                    fontWeight="700"
                  >
                    {/* 品牌图标和名称在一行 */}
                    <tspan x={node.x + (node.layer === 2 ? 45 : 42.5)} dy="0">
                      {node.icon} {node.name}
                    </tspan>
                    {/* 数据在下一行，使用更小字体 */}
                    <tspan x={node.x + (node.layer === 2 ? 45 : 42.5)} dy="10" fontSize="6" fontWeight="600">
                      {node.value.toLocaleString()}单
                    </tspan>
                  </text>
                </g>
              ))}


            </svg>
          </div>

          {/* 异常分类说明 */}
          <div className="mt-8 grid grid-cols-2 gap-6">
            {/* 异常类型详解 */}
            <div>
              <h5 className="text-sm font-medium text-maersk-black mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-accent-mid-red" />
                超时异常分类说明
              </h5>
              <div className="space-y-3">
                {EXCEPTION_TYPES.map(type => (
                  <div key={type.key} className="flex items-start space-x-3 p-3 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: type.color, marginTop: '2px' }}
                    ></div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{type.icon}</span>
                        <span className="font-medium text-maersk-black">{type.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-maersk-blue hover:bg-functional-bright-blue"
                          onClick={() => onExceptionClick && onExceptionClick(type.key)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          查看监控
                        </Button>
                      </div>
                      <p className="text-xs text-functional-mid-grey mt-1">
                        {type.description} (阈值: {type.threshold})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 简化的风险等级说明 */}
            <div>
              <h5 className="text-sm font-medium text-maersk-black mb-3">流向风险分级</h5>
              <div className="space-y-3 mb-6">
                <div className="p-3 bg-accent-bright-green rounded-lg border border-accent-light-green">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-3 rounded" style={{ backgroundColor: 'var(--accent-light-green)' }}></div>
                    <span className="font-medium text-accent-dark-green">无风险流向</span>
                  </div>
                  <p className="text-xs text-accent-dark-green">
                    异常率 ≤ 10%，表示该品牌×快递商组合表现良好，可以优先使用
                  </p>
                </div>
                
                <div className="p-3 bg-accent-bright-red rounded-lg border border-accent-light-red">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-3 rounded" style={{ backgroundColor: 'var(--accent-light-red)' }}></div>
                    <span className="font-medium text-accent-dark-red">有风险流向</span>
                  </div>
                  <p className="text-xs text-accent-dark-red">
                    异常率 &gt; 10%，表示该品牌×快递商组合存在较高异常风险，需要重点关注
                  </p>
                </div>
              </div>

              {/* 快递商表现对比 - 基于动态计算的异常率 */}
              <div>
                <h5 className="text-sm font-medium text-maersk-black mb-3">快递商表现对比</h5>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-accent-bright-green rounded border border-accent-light-green">
                    <span className="text-sm">✈️ 顺丰</span>
                    <div className="text-right">
                      <span className="text-sm font-medium text-accent-dark-green">
                        {((sfData.reduce((sum, item) => sum + item.totalExceptionOrders, 0) / 
                           sfData.reduce((sum, item) => sum + item.totalOrders, 0)) * 100).toFixed(1)}% 实际异常率
                      </span>
                      <div className="text-xs text-accent-mid-green">
                        基础: {(baseExceptionRates['顺丰'] * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-accent-bright-orange rounded border border-accent-light-orange">
                    <span className="text-sm">🚛 中通</span>
                    <div className="text-right">
                      <span className="text-sm font-medium text-accent-dark-orange">
                        {((ztData.reduce((sum, item) => sum + item.totalExceptionOrders, 0) / 
                           ztData.reduce((sum, item) => sum + item.totalOrders, 0)) * 100).toFixed(1)}% 实际异常率
                      </span>
                      <div className="text-xs text-accent-mid-orange">
                        基础: {(baseExceptionRates['中通'] * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 关键洞察 */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
            <h5 className="font-medium text-maersk-black mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent-mid-green" />
              无风险流向组合
            </h5>
            <div className="space-y-2 text-sm">
              {rawData
                .filter(item => item.totalExceptionRate <= 10)
                .sort((a, b) => a.totalExceptionRate - b.totalExceptionRate)
                .slice(0, 4)
                .map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--accent-light-green)' }}></div>
                      <span className="text-functional-mid-grey">
                        {item.brand} → {item.courier}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-accent-mid-green font-medium text-xs">
                        {item.totalExceptionRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-functional-mid-grey">
                        基础{item.baseExceptionRate.toFixed(1)}% × {item.brandFactor.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="p-4 bg-functional-bright-grey rounded-lg border border-functional-light-grey">
            <h5 className="font-medium text-maersk-black mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-accent-mid-red" />
              有风险流向组合
            </h5>
            <div className="space-y-2 text-sm">
              {rawData
                .filter(item => item.totalExceptionRate > 10)
                .sort((a, b) => b.totalExceptionRate - a.totalExceptionRate)
                .slice(0, 4)
                .map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--accent-light-red)' }}></div>
                      <span className="text-functional-mid-grey">
                        {item.brand} → {item.courier}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-accent-mid-red font-medium text-xs">
                        {item.totalExceptionRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-functional-mid-grey">
                        基础{item.baseExceptionRate.toFixed(1)}% × {item.brandFactor.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

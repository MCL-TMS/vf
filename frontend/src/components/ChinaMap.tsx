import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./ui/tooltip";
import { TrendingUp, TrendingDown } from "lucide-react";
import { 
  chinaProvinceData, 
  getOrderLevelColor,
  getOrderLevelBorderColor,
  getOrderLevelLabel,
  getOrderLevelDescription,
  getProvinceShortName,
  ORDER_LEVEL_CONFIG,
  totalChinaOrders,
  ProvinceMapData,
  MAERSK_MAP_THEME
} from "../data/chinaMapData";

interface ChinaMapProps {
  selectedBrand?: string;
  onProvinceClick?: (province: ProvinceMapData) => void;
}

export function ChinaMap({ selectedBrand, onProvinceClick }: ChinaMapProps) {
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  // 渲染省份圆点
  const renderProvinceMarker = (province: ProvinceMapData) => {
    const isHovered = hoveredProvince === province.code;
    const color = getOrderLevelColor(province.orders);
    const borderColor = getOrderLevelBorderColor(province.orders);
    const shortName = getProvinceShortName(province.name);
    
    return (
      <TooltipProvider key={province.code}>
        <Tooltip>
          <TooltipTrigger asChild>
            <g
              className="province-marker cursor-pointer transition-all duration-300"
              onMouseEnter={() => setHoveredProvince(province.code)}
              onMouseLeave={() => setHoveredProvince(null)}
              onClick={() => onProvinceClick?.(province)}
              transform={`translate(${province.coordinates[0]}, ${province.coordinates[1]})`}
            >
              {/* 外圈（hover效果） */}
              {isHovered && (
                <circle
                  r="18"
                  fill="none"
                  stroke="var(--maersk-blue)"
                  strokeWidth="2"
                  opacity="0.6"
                  className="animate-pulse"
                />
              )}
              
              {/* 主圆点 */}
              <circle
                r={isHovered ? "14" : "12"}
                fill={color}
                stroke={borderColor}
                strokeWidth="2"
                className="drop-shadow-md transition-all duration-300 province-circle"
                style={{
                  filter: isHovered ? 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
                }}
              />
              
              {/* 省份简称 */}
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dy="0.35em"
                className="pointer-events-none font-medium"
                style={{ 
                  fontSize: isHovered ? '11px' : '10px',
                  fill: 'var(--maersk-white)',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                }}
              >
                {shortName}
              </text>
              
              {/* 订单量标签（仅在hover时显示） */}
              {isHovered && (
                <text
                  x="0"
                  y="22"
                  textAnchor="middle"
                  className="pointer-events-none font-semibold"
                  style={{ 
                    fontSize: '11px',
                    fill: 'var(--maersk-blue)',
                    textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
                  }}
                >
                  {province.orders.toLocaleString()}
                </text>
              )}
            </g>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 maersk-card border-functional-light-grey">
            <div className="space-y-3">
              <div className="font-semibold text-maersk-black border-b border-functional-light-grey pb-2">
                {province.name}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-functional-mid-grey">订单量:</span>
                  <div className="font-semibold text-maersk-blue">
                    {province.orders.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-functional-mid-grey">占比:</span>
                  <div className="font-semibold text-maersk-black">
                    {province.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-functional-mid-grey">增长率:</span>
                <div className={`flex items-center space-x-1 ${
                  province.growth >= 0 ? 'text-accent-mid-green' : 'text-accent-mid-red'
                }`}>
                  {province.growth >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span className="font-medium">{Math.abs(province.growth).toFixed(1)}%</span>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-functional-mid-grey">级别: </span>
                <span 
                  className="font-medium px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: getOrderLevelColor(province.orders),
                    color: 'var(--maersk-white)'
                  }}
                >
                  {getOrderLevelLabel(province.orders)}
                </span>
              </div>
              <div className="text-xs text-functional-mid-grey border-t border-functional-light-grey pt-2">
                {getOrderLevelDescription(province.orders)}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Card className="h-full maersk-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-maersk-black">中国地图分布</CardTitle>
          {selectedBrand && (
            <Badge variant="outline" className="maersk-badge-secondary">
              品牌: {selectedBrand}
            </Badge>
          )}
        </div>
        <div className="text-sm text-functional-mid-grey">
          总订单量: <span className="font-semibold text-maersk-blue">{totalChinaOrders.toLocaleString()}</span>
        </div>
      </CardHeader>
      
      <CardContent className="h-full pb-4">
        <div className="h-[400px] mb-4 relative">
          {/* SVG地图容器 */}
          <svg
            viewBox="0 0 500 450"
            className="w-full h-full rounded-lg border"
            style={{ 
              background: `linear-gradient(135deg, ${MAERSK_MAP_THEME.background.primary} 0%, ${MAERSK_MAP_THEME.border.secondary} 100%)`,
              borderColor: MAERSK_MAP_THEME.border.primary
            }}
          >
            {/* 地图背景网格 */}
            <defs>
              <pattern id="maersk-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path 
                  d="M 20 0 L 0 0 0 20" 
                  fill="none" 
                  stroke="var(--functional-light-grey)" 
                  strokeWidth="0.5" 
                  opacity="0.2"
                />
              </pattern>
              <linearGradient id="map-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--functional-bright-blue)" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="var(--maersk-white)" stopOpacity="0.1"/>
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#maersk-grid)" />
            <rect width="100%" height="100%" fill="url(#map-gradient)" />
            
            {/* 中国轮廓简化边界 */}
            <path
              d="M 50 100 Q 100 80 150 90 L 200 85 Q 250 80 300 90 L 350 95 Q 400 100 450 120 L 480 150 Q 490 200 485 250 L 480 300 Q 470 350 450 380 L 400 400 Q 350 410 300 405 L 250 400 Q 200 395 150 390 L 100 380 Q 70 350 60 300 L 55 250 Q 50 200 55 150 Z"
              fill="none"
              stroke="var(--maersk-blue)"
              strokeWidth="2"
              strokeDasharray="8,4"
              opacity="0.4"
            />
            
            {/* 渲染所有省份标记点 */}
            {chinaProvinceData.map(renderProvinceMarker)}
            
            {/* 标题文本 */}
            <text
              x="250"
              y="30"
              textAnchor="middle"
              className="font-medium"
              style={{
                fontSize: '16px',
                fill: 'var(--maersk-blue)',
                textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
              }}
            >
              中华人民共和国物流订单分布图
            </text>
            
            {/* 订单量图例 - 左下角 */}
            <g className="map-legend" transform="translate(20, 280)">
              {/* 图例背景 */}
              <rect
                x="0"
                y="0"
                width="130"
                height="140"
                fill="var(--maersk-white)"
                stroke="var(--functional-light-grey)"
                strokeWidth="1"
                rx="6"
                opacity="0.95"
                style={{
                  filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1))'
                }}
              />
              
              {/* 图例标题 */}
              <text
                x="65"
                y="16"
                textAnchor="middle"
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  fill: 'var(--maersk-black)'
                }}
              >
                订单量图例
              </text>
              
              {/* 图例项目 */}
              {ORDER_LEVEL_CONFIG.map((level, index) => {
                const yPosition = 32 + index * 20;
                const provinceCount = chinaProvinceData.filter(p => 
                  p.orders >= level.min && p.orders <= level.max
                ).length;
                
                return (
                  <g key={index}>
                    {/* 颜色圆点 */}
                    <circle
                      cx="15"
                      cy={yPosition}
                      r="6"
                      fill={level.color}
                      stroke={level.borderColor}
                      strokeWidth="1.5"
                    />
                    
                    {/* 标签文本 */}
                    <text
                      x="28"
                      y={yPosition + 1}
                      style={{
                        fontSize: '10px',
                        fontWeight: '500',
                        fill: 'var(--maersk-black)'
                      }}
                    >
                      {level.label}
                    </text>
                    
                    {/* 省份数量 */}
                    <text
                      x="115"
                      y={yPosition + 1}
                      textAnchor="end"
                      style={{
                        fontSize: '9px',
                        fontWeight: '600',
                        fill: 'var(--maersk-blue)'
                      }}
                    >
                      {provinceCount}省
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Maersk标识 */}
            <text
              x="450"
              y="430"
              textAnchor="end"
              className="text-xs"
              style={{
                fill: 'var(--functional-mid-grey)',
                opacity: 0.6
              }}
            >
              Powered by Maersk
            </text>
          </svg>
        </div>
        

        
        {/* 交互提示 */}
        <div className="mt-3 text-center">
          <div className="text-xs text-functional-mid-grey">
            💡 鼠标悬停查看详细信息，点击省份标记查看更多数据
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
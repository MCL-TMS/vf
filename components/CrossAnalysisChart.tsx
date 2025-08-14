import { useState, useEffect, useRef } from "react";
import { ResponsiveContainer, Cell, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { getBrandPlatformCrossAnalysis, platformsData } from "../data/platformData";

interface CrossAnalysisChartProps {
  selectedBrand?: string;
  selectedPlatform?: string;
  selectedKPI?: string;
}

export function CrossAnalysisChart({ selectedBrand, selectedPlatform, selectedKPI }: CrossAnalysisChartProps) {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 监听容器大小变化
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height
        });
      }
    };

    // 初始化时延迟测量，确保DOM完全渲染
    const timer = setTimeout(updateSize, 100);
    
    window.addEventListener('resize', updateSize);
    
    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
  }, []);

  // 获取交叉分析数据，过滤掉VF母品牌
  const crossData = getBrandPlatformCrossAnalysis(selectedBrand, selectedPlatform)
    .filter(item => item.brand !== 'VF');
  
  // 只使用6个子品牌
  const allBrands = ['TNF', 'DICKIES', 'VANS', 'TIMBERLAND', 'ICEBREAKER', 'KIPLING'];
  const allPlatforms = platformsData.map(p => ({ name: p.name, displayName: p.displayName, logo: p.logo, color: p.color }));
  
  // 构建热力图数据矩阵
  const heatmapData = [];
  const maxOrderValue = Math.max(...crossData.map(item => item.orders));
  
  allBrands.forEach((brand, brandIndex) => {
    allPlatforms.forEach((platform, platformIndex) => {
      const dataPoint = crossData.find(item => item.brand === brand && item.platform === platform.name);
      const orders = dataPoint ? dataPoint.orders : 0;
      
      // 获取对应KPI的数值
      let kpiValue = 0;
      if (dataPoint && selectedKPI) {
        kpiValue = dataPoint.kpiBreakdown[
          selectedKPI === '已揽收' ? 'picked' : 
          selectedKPI === '已发运' ? 'shipped' :
          selectedKPI === '已签收' ? 'delivered' :
          selectedKPI === '已转寄' ? 'forwarded' :
          selectedKPI === '已退回' ? 'returned' :
          selectedKPI === '已取消' ? 'cancelled' : 'delivered'
        ] || 0;
      } else {
        kpiValue = orders;
      }
      
      heatmapData.push({
        brand,
        platform: platform.name,
        platformDisplay: platform.displayName,
        platformLogo: platform.logo,
        platformColor: platform.color,
        orders,
        kpiValue,
        intensity: maxOrderValue > 0 ? orders / maxOrderValue : 0,
        brandIndex,
        platformIndex
      });
    });
  });

  // 计算总计数据
  const brandTotals = allBrands.map(brand => {
    const total = heatmapData
      .filter(item => item.brand === brand)
      .reduce((sum, item) => sum + (selectedKPI ? item.kpiValue : item.orders), 0);
    return { brand, total };
  });

  const platformTotals = allPlatforms.map(platform => {
    const total = heatmapData
      .filter(item => item.platform === platform.name)
      .reduce((sum, item) => sum + (selectedKPI ? item.kpiValue : item.orders), 0);
    return { 
      platform: platform.name, 
      displayName: platform.displayName, 
      logo: platform.logo,
      color: platform.color,
      total 
    };
  });

  // 获取颜色强度
  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return 'var(--functional-bright-grey)';
    const alpha = Math.max(0.1, Math.min(1, intensity));
    return `rgba(66, 176, 213, ${alpha})`;
  };

  const getCellTextColor = (intensity: number) => {
    return intensity > 0.5 ? 'var(--maersk-white)' : 'var(--maersk-black)';
  };

  // 获取品牌显示图标
  const getBrandIcon = (brand: string) => {
    const brandIcons = {
      'TNF': '🏔️',
      'DICKIES': '👔',
      'VANS': '👟',
      'TIMBERLAND': '🥾',
      'ICEBREAKER': '🧊',
      'KIPLING': '🎒'
    };
    return brandIcons[brand] || '🏷️';
  };

  // 根据容器宽度动态计算列宽 - 优化计算逻辑
  const getColumnWidth = () => {
    if (containerSize.width === 0) return 120;
    const totalColumns = allPlatforms.length + 2; // 平台列 + 品牌列 + 总计列
    const brandColumnWidth = Math.max(120, Math.min(160, containerSize.width * 0.15)); // 品牌列自适应宽度
    const totalColumnWidth = Math.max(80, Math.min(120, containerSize.width * 0.1)); // 总计列自适应宽度
    const scrollbarWidth = 20; // 预留滚动条宽度
    const padding = 32; // 容器内边距
    const availableWidth = containerSize.width - brandColumnWidth - totalColumnWidth - scrollbarWidth - padding;
    const platformColumnWidth = Math.max(100, availableWidth / allPlatforms.length);
    return {
      brand: brandColumnWidth,
      platform: platformColumnWidth,
      total: totalColumnWidth
    };
  };

  const columnWidths = getColumnWidth();

  // 根据容器高度动态计算行高 - 优化计算逻辑
  const getRowHeight = () => {
    if (containerSize.height === 0) return 60;
    const totalRows = allBrands.length + 2; // 品牌行 + 表头 + 总计行
    const headerHeight = 60; // 标题区域高度
    const footerHeight = 40; // 底部说明高度
    const tableHeaderHeight = Math.max(60, containerSize.height * 0.1); // 表头自适应高度
    const padding = 24; // 容器内边距
    const availableHeight = containerSize.height - headerHeight - footerHeight - tableHeaderHeight - padding;
    const dataRowHeight = Math.max(45, availableHeight / (totalRows - 1)); // 数据行高度
    return {
      header: tableHeaderHeight,
      data: dataRowHeight
    };
  };

  const rowHeights = getRowHeight();

  // 判断是否为小屏设备
  const isSmallScreen = containerSize.width < 768;
  const isMediumScreen = containerSize.width >= 768 && containerSize.width < 1200;
  const isLargeScreen = containerSize.width >= 1200;

  // 根据屏幕大小调整字体和间距
  const getResponsiveStyles = () => {
    if (isSmallScreen) {
      return {
        titleSize: 'text-sm',
        fontSize: 'text-xs',
        logoSize: 'text-sm',
        spacing: 'space-x-1',
        padding: 'p-1'
      };
    } else if (isMediumScreen) {
      return {
        titleSize: 'text-base',
        fontSize: 'text-sm',
        logoSize: 'text-base',
        spacing: 'space-x-2',
        padding: 'p-2'
      };
    } else {
      return {
        titleSize: 'text-lg',
        fontSize: 'text-sm',
        logoSize: 'text-lg',
        spacing: 'space-x-2',
        padding: 'p-3'
      };
    }
  };

  const styles = getResponsiveStyles();

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col bg-maersk-white">
      {/* 标题区域 - 响应式布局 */}
      <div className={`flex-shrink-0 ${isSmallScreen ? 'flex-col space-y-2' : 'flex items-center justify-between'} mb-3 px-2`}>
        <h4 className={`font-medium text-maersk-black ${styles.titleSize}`}>
          子品牌×平台订单量分布热力图
          {selectedKPI && (
            <span className="text-maersk-blue ml-2">({selectedKPI})</span>
          )}
        </h4>
        <div className={`flex items-center ${styles.spacing}`}>
          <span className="text-xs text-functional-mid-grey">颜色深浅表示订单量大小</span>
          <div className={`flex items-center ${styles.spacing}`}>
            <div className="w-3 h-3 bg-functional-light-blue rounded" />
            <span className="text-xs">少</span>
            <div className="w-3 h-3 bg-maersk-blue rounded" />
            <span className="text-xs">多</span>
          </div>
        </div>
      </div>

      {/* 热力图表格 - 完全自适应 */}
      <div className="flex-1 overflow-auto border border-functional-light-grey rounded-lg bg-maersk-white">
        <div className="min-w-max h-full">
          <table className="w-full border-collapse h-full">
            <thead className="sticky top-0 bg-functional-bright-grey z-20">
              <tr>
                <th 
                  className={`${styles.padding} text-left font-medium text-functional-mid-grey border-b border-r border-functional-light-grey bg-functional-bright-grey sticky left-0 z-30`}
                  style={{ 
                    width: columnWidths.brand,
                    minWidth: columnWidths.brand,
                    height: rowHeights.header
                  }}
                >
                  <div className={`flex items-center ${styles.spacing}`}>
                    <span className={styles.fontSize}>品牌/平台</span>
                  </div>
                </th>
                {allPlatforms.map((platform) => (
                  <th 
                    key={platform.name} 
                    className={`${styles.padding} text-center font-medium border-b border-r border-functional-light-grey bg-functional-bright-grey`}
                    style={{ 
                      width: columnWidths.platform,
                      minWidth: columnWidths.platform,
                      height: rowHeights.header
                    }}
                  >
                    <div className="flex flex-col items-center space-y-1">
                      <div className={`flex items-center ${styles.spacing}`}>
                        <span className={styles.logoSize}>{platform.logo}</span>
                        <span className={`${styles.fontSize} text-maersk-black font-medium`}>
                          {isSmallScreen ? platform.name : platform.displayName}
                        </span>
                      </div>
                      <div className="text-xs text-functional-mid-grey">
                        {(() => {
                          const total = platformTotals.find(p => p.platform === platform.name)?.total || 0;
                          return isSmallScreen ? 
                            (total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total.toString()) :
                            total.toLocaleString();
                        })()}
                      </div>
                    </div>
                  </th>
                ))}
                <th 
                  className={`${styles.padding} text-center font-medium text-functional-mid-grey border-b border-functional-light-grey bg-functional-bright-grey`}
                  style={{ 
                    width: columnWidths.total,
                    minWidth: columnWidths.total,
                    height: rowHeights.header
                  }}
                >
                  <span className={styles.fontSize}>品牌总计</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {allBrands.map((brand, brandIndex) => {
                const brandTotal = brandTotals.find(b => b.brand === brand)?.total || 0;
                
                return (
                  <tr key={brand} className={brandIndex % 2 === 0 ? 'bg-maersk-white' : 'bg-functional-bright-grey/30'}>
                    <td 
                      className={`${styles.padding} font-medium border-b border-r border-functional-light-grey bg-functional-bright-grey/50 sticky left-0 z-10`}
                      style={{ 
                        width: columnWidths.brand,
                        minWidth: columnWidths.brand,
                        height: rowHeights.data
                      }}
                    >
                      <div className={`flex items-center ${styles.spacing}`}>
                        <span className={styles.logoSize}>{getBrandIcon(brand)}</span>
                        <span className={`${styles.fontSize} text-maersk-black font-medium`}>{brand}</span>
                      </div>
                    </td>
                    {allPlatforms.map((platform) => {
                      const cellData = heatmapData.find(
                        item => item.brand === brand && item.platform === platform.name
                      );
                      const value = selectedKPI ? (cellData?.kpiValue || 0) : (cellData?.orders || 0);
                      const intensity = cellData?.intensity || 0;
                      
                      return (
                        <td
                          key={platform.name}
                          className={`${styles.padding} text-center border-b border-r border-functional-light-grey transition-all hover:scale-105 cursor-pointer relative group`}
                          style={{
                            backgroundColor: getIntensityColor(intensity),
                            color: getCellTextColor(intensity),
                            width: columnWidths.platform,
                            minWidth: columnWidths.platform,
                            height: rowHeights.data
                          }}
                          title={`${brand} × ${platform.displayName}: ${value.toLocaleString()} 单`}
                        >
                          <div className={`font-semibold ${styles.fontSize}`}>
                            {isSmallScreen ? 
                              (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString()) :
                              value.toLocaleString()
                            }
                          </div>
                          {value > 0 && brandTotal > 0 && !isSmallScreen && (
                            <div className="text-xs opacity-80 mt-1">
                              {((value / brandTotal) * 100).toFixed(1)}%
                            </div>
                          )}
                          
                          {/* 悬停工具提示 - 优化位置 */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-30">
                            <div className="bg-maersk-black text-maersk-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-xl border border-functional-light-grey">
                              <div className="font-medium">{brand} × {platform.displayName}</div>
                              <div>{selectedKPI ? selectedKPI : '订单量'}: {value.toLocaleString()}</div>
                              {value > 0 && brandTotal > 0 && (
                                <div>占品牌比例: {((value / brandTotal) * 100).toFixed(1)}%</div>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td 
                      className={`${styles.padding} text-center border-b border-functional-light-grey bg-functional-bright-blue font-semibold text-maersk-black`}
                      style={{ 
                        width: columnWidths.total,
                        minWidth: columnWidths.total,
                        height: rowHeights.data
                      }}
                    >
                      <span className={styles.fontSize}>
                        {isSmallScreen ? 
                          (brandTotal >= 1000 ? `${(brandTotal / 1000).toFixed(1)}k` : brandTotal.toString()) :
                          brandTotal.toLocaleString()
                        }
                      </span>
                    </td>
                  </tr>
                );
              })}
              
              {/* 总计行 */}
              <tr className="bg-functional-bright-blue">
                <td 
                  className={`${styles.padding} font-semibold text-center border-r border-functional-light-grey text-maersk-black sticky left-0 z-10 bg-functional-bright-blue`}
                  style={{ 
                    width: columnWidths.brand,
                    minWidth: columnWidths.brand,
                    height: rowHeights.data
                  }}
                >
                  <span className={styles.fontSize}>平台总计</span>
                </td>
                {allPlatforms.map((platform) => {
                  const platformTotal = platformTotals.find(p => p.platform === platform.name)?.total || 0;
                  return (
                    <td 
                      key={platform.name} 
                      className={`${styles.padding} text-center border-r border-functional-light-grey font-semibold text-maersk-black`}
                      style={{ 
                        width: columnWidths.platform,
                        minWidth: columnWidths.platform,
                        height: rowHeights.data
                      }}
                    >
                      <span className={styles.fontSize}>
                        {isSmallScreen ? 
                          (platformTotal >= 1000 ? `${(platformTotal / 1000).toFixed(1)}k` : platformTotal.toString()) :
                          platformTotal.toLocaleString()
                        }
                      </span>
                    </td>
                  );
                })}
                <td 
                  className={`${styles.padding} text-center font-semibold text-maersk-blue`}
                  style={{ 
                    width: columnWidths.total,
                    minWidth: columnWidths.total,
                    height: rowHeights.data
                  }}
                >
                  <span className={styles.fontSize}>
                    {(() => {
                      const grandTotal = brandTotals.reduce((sum, brand) => sum + brand.total, 0);
                      return isSmallScreen ? 
                        (grandTotal >= 1000 ? `${(grandTotal / 1000).toFixed(1)}k` : grandTotal.toString()) :
                        grandTotal.toLocaleString();
                    })()}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 数据说明 - 紧凑版 */}
      <div className="flex-shrink-0 mt-2">
        <div className={`text-xs text-functional-mid-grey bg-functional-bright-grey p-2 rounded border border-functional-light-grey ${isSmallScreen ? 'text-center' : ''}`}>
          <div className={`${isSmallScreen ? 'flex flex-col space-y-1' : 'flex items-center justify-between'}`}>
            <span>💡 提示: {isSmallScreen ? '长按' : '悬停'}单元格查看详细数据，颜色越深表示订单量越大</span>
            <span>
              覆盖范围: {allBrands.length} 品牌 × {allPlatforms.length} 平台 = {allBrands.length * allPlatforms.length} 个数据点
              {containerSize.width > 0 && (
                <span className="ml-2">窗口: {containerSize.width}×{containerSize.height}</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
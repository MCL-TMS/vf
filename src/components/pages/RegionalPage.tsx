import { useState, useEffect } from "react";
import { ChinaMap } from "../ChinaMap";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { FilteredData } from "../../utils/dataFilter";
import { ProvinceMapData, chinaProvinceData } from "../../data/chinaMapData";
import { 
  getCurrentFiscalMonth, 
  getCurrentNaturalMonth, 
  generateMonthOptions,
  isFiscalMonth,
  isNaturalMonth,
  getFiscalMonthDisplayName,
  getNaturalMonthDisplayName
} from "../../utils/dateUtils";

interface RegionalPageProps {
  data: FilteredData;
  selectedBrand: string;
  dateRange?: { from: string; to: string };
  onDateRangeChange?: (from: string, to: string) => void;
}

// 省份级别的详细数据
const provinceData = [
  { province: "Hubei", orders: 330, percentage: 1.4, mom: 3.2, yoy: 8.1 },
  { province: "Fujian", orders: 350, percentage: 1.5, mom: -2.1, yoy: 5.3 },
  { province: "Gansu", orders: 180, percentage: 0.8, mom: -1.5, yoy: 2.8 },
  { province: "Anhui", orders: 151, percentage: 0.6, mom: -0.5, yoy: 4.1 },
  { province: "Shanghai", orders: 130, percentage: 0.6, mom: 0.2, yoy: 6.3 },
  { province: "Jiangxi", orders: 115, percentage: 0.5, mom: 1.8, yoy: 3.7 },
  { province: "Shaanxi", orders: 103, percentage: 0.4, mom: -3.2, yoy: 4.0 },
  { province: "East Subdistrict", orders: 98, percentage: 0.4, mom: 2.5, yoy: 27.0 },
  { province: "Guangdong", orders: 3270, percentage: 13.9, mom: 6.1, yoy: 5.4 },
  { province: "Fujian", orders: 800, percentage: 3.4, mom: 4.0, yoy: 4.1 },
  { province: "Sichuan", orders: 800, percentage: 3.4, mom: 6.0, yoy: 4.0 },
  { province: "Guizhou", orders: 520, percentage: 2.2, mom: 4.0, yoy: 2.1 },
  { province: "Yunnan", orders: 470, percentage: 2.0, mom: 2.8, yoy: 3.5 },
  { province: "Guangxi", orders: 290, percentage: 1.2, mom: 1.4, yoy: 1.4 },
  { province: "Hainan", orders: 275, percentage: 1.2, mom: 2.1, yoy: 1.5 },
  { province: "Chongqing", orders: 234, percentage: 1.0, mom: 3.8, yoy: 2.0 },
  { province: "South Subdistrict", orders: 5244, percentage: 22.3, mom: 4.3, yoy: 25.0 },
  { province: "Beijing", orders: 1700, percentage: 7.2, mom: 6.5, yoy: 6.5 },
  { province: "Tianjin", orders: 1087, percentage: 4.6, mom: 4.1, yoy: 4.0 },
  { province: "Hebei", orders: 981, percentage: 4.2, mom: 2.5, yoy: 4.8 },
  { province: "Shandong", orders: 870, percentage: 3.7, mom: 5.8, yoy: 4.1 },
  { province: "Henan", orders: 803, percentage: 3.4, mom: 4.8, yoy: 4.1 },
  { province: "Heilongjiang", orders: 418, percentage: 1.8, mom: 2.5, yoy: 2.0 },
  { province: "Jilin", orders: 355, percentage: 1.5, mom: 1.8, yoy: 1.4 },
  { province: "Inner Mongolia", orders: 274, percentage: 1.2, mom: 2.5, yoy: 1.5 },
  { province: "Shanxi", orders: 223, percentage: 0.9, mom: 1.0, yoy: 2.8 },
  { province: "Liaoning", orders: 176, percentage: 0.7, mom: 2.8, yoy: 0.8 },
  { province: "North Subdistrict", orders: 6867, percentage: 29.2, mom: 4.3, yoy: 25.0 },
  { province: "TOTAL", orders: 23540, percentage: 100.0, mom: 4.3, yoy: 100.0 }
];

export function RegionalPage({ data, selectedBrand, dateRange: propDateRange, onDateRangeChange }: RegionalPageProps) {
  const [activeTab, setActiveTab] = useState<"order" | "region">("order");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<ProvinceMapData | null>(null);
  
  // 日期相关状态
  const [dateType, setDateType] = useState<'fiscal' | 'natural'>('fiscal');
  const [localDateRange, setLocalDateRange] = useState(() => {
    if (propDateRange) return propDateRange;
    return getCurrentFiscalMonth();
  });
  const [customDateMode, setCustomDateMode] = useState(false);

  // 生成月份选项
  const fiscalMonthOptions = generateMonthOptions('fiscal', 12);
  const naturalMonthOptions = generateMonthOptions('natural', 12);
  const monthOptions = dateType === 'fiscal' ? fiscalMonthOptions : naturalMonthOptions;

  // 初始化日期范围
  useEffect(() => {
    if (!propDateRange) {
      const currentFiscal = getCurrentFiscalMonth();
      setLocalDateRange(currentFiscal);
      if (onDateRangeChange) {
        onDateRangeChange(currentFiscal.from, currentFiscal.to);
      }
    }
  }, []);

  // 处理日期类型切换
  const handleDateTypeChange = (newType: 'fiscal' | 'natural') => {
    setDateType(newType);
    setCustomDateMode(false);
    
    const newDateRange = newType === 'fiscal' 
      ? getCurrentFiscalMonth() 
      : getCurrentNaturalMonth();
    
    setLocalDateRange(newDateRange);
    if (onDateRangeChange) {
      onDateRangeChange(newDateRange.from, newDateRange.to);
    }
  };

  // 处理月份选择
  const handleMonthSelect = (value: string) => {
    const option = monthOptions.find(opt => opt.value === value);
    if (option) {
      const newDateRange = { from: option.from, to: option.to };
      setLocalDateRange(newDateRange);
      if (onDateRangeChange) {
        onDateRangeChange(newDateRange.from, newDateRange.to);
      }
    }
  };

  // 处理自定义日期变更
  const handleCustomDateChange = (type: 'from' | 'to', value: string) => {
    const newDateRange = {
      ...localDateRange,
      [type]: value
    };
    setLocalDateRange(newDateRange);
    if (onDateRangeChange) {
      onDateRangeChange(newDateRange.from, newDateRange.to);
    }
  };

  // 获取当前日期显示名称
  const getCurrentDateDisplayName = () => {
    if (customDateMode) {
      return `${localDateRange.from} 至 ${localDateRange.to}`;
    }
    
    if (isFiscalMonth(localDateRange.from, localDateRange.to)) {
      return getFiscalMonthDisplayName(localDateRange.from, localDateRange.to);
    } else if (isNaturalMonth(localDateRange.from, localDateRange.to)) {
      return getNaturalMonthDisplayName(localDateRange.from, localDateRange.to);
    } else {
      return `${localDateRange.from} 至 ${localDateRange.to}`;
    }
  };

  // 排序函数
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // 获取排序后的数据
  const getSortedData = () => {
    if (!sortConfig) return provinceData;
    
    return [...provinceData].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof typeof a];
      const bValue = b[sortConfig.key as keyof typeof b];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      return 0;
    });
  };

  // 渲染趋势箭头
  const renderTrendArrow = (value: number) => {
    if (value >= 0) {
      return (
        <div className="flex items-center space-x-1 text-accent-mid-red">
          <TrendingUp className="h-3 w-3" />
          <span>{value.toFixed(1)}%</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center space-x-1 text-accent-mid-green">
          <TrendingDown className="h-3 w-3" />
          <span>{Math.abs(value).toFixed(1)}%</span>
        </div>
      );
    }
  };

  // 渲染排序图标
  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronDown className="h-3 w-3 opacity-30" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />;
  };

  // 处理省份点击
  const handleProvinceClick = (province: ProvinceMapData) => {
    setSelectedProvince(province);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和日期选择器 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-maersk-black">📍 地域分析</h1>
          <p className="text-functional-mid-grey">
            分析订单的地域分布情况，从订单和地区角度展示数据
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {selectedBrand && (
            <Badge variant="outline" className="maersk-badge-secondary">
              已筛选: {selectedBrand}
            </Badge>
          )}
        </div>
      </div>

      {/* 日期选择器控制区域 */}
      <div className="maersk-card p-4">
        <div className="space-y-4">
          {/* 日期类型切换 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-maersk-blue" />
              <Label className="text-sm font-medium text-maersk-black">日期范围选择</Label>
              <div className="flex items-center space-x-2 text-sm text-functional-mid-grey">
                <span>当前: {getCurrentDateDisplayName()}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant={customDateMode ? "outline" : "ghost"}
                size="sm"
                onClick={() => setCustomDateMode(!customDateMode)}
                className="h-8 px-3 text-xs maersk-button-secondary"
              >
                {customDateMode ? "快速选择" : "自定义日期"}
              </Button>
            </div>
          </div>

          {!customDateMode ? (
            /* 快速选择模式 */
            <div className="flex items-center space-x-4">
              {/* 财务月/自然月切换 */}
              <div className="flex items-center space-x-2">
                <Label className="text-sm text-functional-mid-grey">月份类型:</Label>
                <div className="flex items-center space-x-1 p-1 bg-functional-bright-grey rounded-md">
                  <Button
                    variant={dateType === 'fiscal' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleDateTypeChange('fiscal')}
                    className={`h-7 px-3 text-xs ${
                      dateType === 'fiscal' 
                        ? 'maersk-button-primary' 
                        : 'text-functional-mid-grey hover:text-maersk-black'
                    }`}
                  >
                    财务月
                  </Button>
                  <Button
                    variant={dateType === 'natural' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleDateTypeChange('natural')}
                    className={`h-7 px-3 text-xs ${
                      dateType === 'natural' 
                        ? 'maersk-button-primary' 
                        : 'text-functional-mid-grey hover:text-maersk-black'
                    }`}
                  >
                    自然月
                  </Button>
                </div>
              </div>

              {/* 月份选择下拉菜单 */}
              <div className="flex items-center space-x-2">
                <Label className="text-sm text-functional-mid-grey">选择月份:</Label>
                <Select 
                  value={monthOptions.find(opt => opt.from === localDateRange.from && opt.to === localDateRange.to)?.value || ''} 
                  onValueChange={handleMonthSelect}
                >
                  <SelectTrigger className="w-48 h-8 text-sm border-functional-light-grey">
                    <SelectValue placeholder="选择月份" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 说明文字 */}
              <div className="text-xs text-functional-mid-grey">
                {dateType === 'fiscal' ? '财务月: 21日-20日' : '自然月: 1日-月末'}
              </div>
            </div>
          ) : (
            /* 自定义日期模式 */
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Label className="text-sm text-functional-mid-grey">开始日期:</Label>
                <Input
                  type="date"
                  value={localDateRange.from}
                  onChange={(e) => handleCustomDateChange('from', e.target.value)}
                  className="w-36 h-8 text-sm maersk-input"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Label className="text-sm text-functional-mid-grey">结束日期:</Label>
                <Input
                  type="date"
                  value={localDateRange.to}
                  onChange={(e) => handleCustomDateChange('to', e.target.value)}
                  className="w-36 h-8 text-sm maersk-input"
                />
              </div>
              <div className="text-xs text-functional-mid-grey">
                自定义日期范围
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 地图区域 - 占用全部空间 */}
      <Card className="maersk-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-maersk-black">中国地图分布</CardTitle>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "order" | "region")}>
              <TabsList className="grid w-40 grid-cols-2 bg-functional-bright-grey">
                <TabsTrigger value="order" className="text-xs text-maersk-black">By Order</TabsTrigger>
                <TabsTrigger value="region" className="text-xs text-maersk-black">By Region</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {/* 地图容器 - 占用全部可用空间 */}
          <div className="h-[500px]">
            <ChinaMap selectedBrand={selectedBrand} onProvinceClick={handleProvinceClick} />
          </div>
        </CardContent>
      </Card>

      {/* 地域订单详情表格 */}
      <Card className="maersk-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-maersk-black">地域订单详情</CardTitle>
            <div className="flex items-center space-x-2 text-sm text-functional-mid-grey">
              <span>按 {activeTab === "order" ? "订单" : "地区"} 视图</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b border-functional-light-grey">
                <tr className="text-xs text-functional-mid-grey">
                  <th className="text-left py-2 px-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 p-0 justify-start hover:bg-transparent text-functional-mid-grey"
                      onClick={() => handleSort('province')}
                    >
                      <span>地区</span>
                      {renderSortIcon('province')}
                    </Button>
                  </th>
                  <th className="text-right py-2 px-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 p-0 justify-end hover:bg-transparent text-functional-mid-grey"
                      onClick={() => handleSort('orders')}
                    >
                      <span>订单量</span>
                      {renderSortIcon('orders')}
                    </Button>
                  </th>
                  <th className="text-right py-2 px-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 p-0 justify-end hover:bg-transparent text-functional-mid-grey"
                      onClick={() => handleSort('percentage')}
                    >
                      <span>占比</span>
                      {renderSortIcon('percentage')}
                    </Button>
                  </th>
                  <th className="text-right py-2 px-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 p-0 justify-end hover:bg-transparent text-functional-mid-grey"
                      onClick={() => handleSort('mom')}
                    >
                      <span>环比</span>
                      {renderSortIcon('mom')}
                    </Button>
                  </th>
                  <th className="text-right py-2 px-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 p-0 justify-end hover:bg-transparent text-functional-mid-grey"
                      onClick={() => handleSort('yoy')}
                    >
                      <span>同比</span>
                      {renderSortIcon('yoy')}
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {getSortedData().map((item, index) => (
                  <tr 
                    key={index} 
                    className={`border-b border-functional-light-grey hover:bg-functional-bright-grey transition-colors ${
                      item.province === 'TOTAL' ? 'bg-functional-bright-blue font-medium border-maersk-blue' : 
                      item.province.includes('Subdistrict') ? 'bg-functional-bright-grey font-medium' : ''
                    }`}
                  >
                    <td className="py-2 px-2">
                      <div className="flex items-center space-x-2">
                        {item.province === 'TOTAL' && (
                          <div className="w-2 h-2 bg-maersk-blue rounded-full"></div>
                        )}
                        {item.province.includes('Subdistrict') && (
                          <div className="w-2 h-2 bg-functional-mid-grey rounded-full"></div>
                        )}
                        <span className={item.province === 'TOTAL' ? 'font-semibold text-maersk-black' : 'text-maersk-black'}>{item.province}</span>
                      </div>
                    </td>
                    <td className="text-right py-2 px-2">
                      <span className={item.province === 'TOTAL' ? 'font-semibold text-maersk-black' : 'text-maersk-black'}>
                        {item.orders.toLocaleString()}
                      </span>
                    </td>
                    <td className="text-right py-2 px-2">
                      <span className={item.province === 'TOTAL' ? 'font-semibold text-maersk-black' : 'text-maersk-black'}>
                        {item.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right py-2 px-2">
                      {item.province === 'TOTAL' ? (
                        <span className="font-semibold text-maersk-black">{item.mom.toFixed(1)}%</span>
                      ) : (
                        renderTrendArrow(item.mom)
                      )}
                    </td>
                    <td className="text-right py-2 px-2">
                      {item.province === 'TOTAL' ? (
                        <span className="font-semibold text-maersk-black">{item.yoy.toFixed(1)}%</span>
                      ) : (
                        renderTrendArrow(item.yoy)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 底部统计信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-maersk-blue">34</div>
              <div className="text-sm text-functional-mid-grey">覆盖省份</div>
            </div>
          </CardContent>
        </Card>
        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-accent-mid-green">23,540</div>
              <div className="text-sm text-functional-mid-grey">总订单量</div>
            </div>
          </CardContent>
        </Card>
        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-accent-mid-orange">广东</div>
              <div className="text-sm text-functional-mid-grey">最高订单省份</div>
            </div>
          </CardContent>
        </Card>
        <Card className="maersk-card">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-accent-mid-red">
                <TrendingUp className="h-4 w-4" />
                <span className="text-2xl font-semibold">4.3%</span>
              </div>
              <div className="text-sm text-functional-mid-grey">总体环比增长</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 省份详情弹窗 */}
      <Dialog open={!!selectedProvince} onOpenChange={() => setSelectedProvince(null)}>
        <DialogContent className="max-w-2xl maersk-card">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-maersk-black">
              <span>📍</span>
              <span>{selectedProvince?.name} 省份详情</span>
              {selectedBrand && (
                <Badge variant="outline" className="ml-2 maersk-badge-secondary">
                  品牌: {selectedBrand}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedProvince && (
            <div className="space-y-6">
              {/* 基础信息 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center maersk-card p-4">
                  <div className="text-2xl font-semibold text-maersk-blue">
                    {selectedProvince.orders.toLocaleString()}
                  </div>
                  <div className="text-sm text-functional-mid-grey">订单量</div>
                </div>
                <div className="text-center maersk-card p-4">
                  <div className="text-2xl font-semibold text-accent-mid-green">
                    {selectedProvince.percentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-functional-mid-grey">全国占比</div>
                </div>
                <div className="text-center maersk-card p-4">
                  <div className={`text-2xl font-semibold flex items-center justify-center space-x-1 ${
                    selectedProvince.growth >= 0 ? 'text-accent-mid-green' : 'text-accent-mid-red'
                  }`}>
                    {selectedProvince.growth >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    <span>{Math.abs(selectedProvince.growth).toFixed(1)}%</span>
                  </div>
                  <div className="text-sm text-functional-mid-grey">增长率</div>
                </div>
                <div className="text-center maersk-card p-4">
                  <div className="text-2xl font-semibold text-accent-mid-orange">
                    #{chinaProvinceData.sort((a, b) => b.orders - a.orders)
                      .findIndex(p => p.name === selectedProvince.name) + 1}
                  </div>
                  <div className="text-sm text-functional-mid-grey">全国排名</div>
                </div>
              </div>

              {/* 详细分析 */}
              <div className="space-y-4">
                <h4 className="font-medium text-maersk-black">省份分析</h4>
                <div className="maersk-card p-4 space-y-3">
                  <div className="text-sm text-functional-mid-grey">
                    该省份在全国物流配送网络中占据重要地位，订单量呈稳定增长趋势。
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
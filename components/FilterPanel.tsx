import { useState } from "react";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Calendar, Filter, RotateCcw, X, ChevronDown, ChevronUp, Settings } from "lucide-react";

interface FilterPanelProps {
  onFilterChange: (filters: any) => void;
}

const filterOptions = [
  {
    id: "status",
    label: "订单状态",
    options: [
      { value: "all", label: "全部状态" },
      { value: "picked", label: "已揽收" },
      { value: "shipped", label: "已发运" },
      { value: "delivered", label: "已签收" },
      { value: "forwarded", label: "转寄中" },
      { value: "returned", label: "退回中" },
      { value: "cancelled", label: "已取消" }
    ]
  },
  {
    id: "priority",
    label: "优先级",
    options: [
      { value: "all", label: "全部优先级" },
      { value: "high", label: "高优先级" },
      { value: "medium", label: "中优先级" },
      { value: "low", label: "低优先级" }
    ]
  },
  {
    id: "timeRange",
    label: "时间范围",
    options: [
      { value: "today", label: "今天" },
      { value: "week", label: "本周" },
      { value: "month", label: "本月" },
      { value: "quarter", label: "本季度" },
      { value: "custom", label: "自定义" }
    ]
  },
  {
    id: "courier",
    label: "快递公司",
    options: [
      { value: "all", label: "全部快递" },
      { value: "zhongtong", label: "中通快递" },
      { value: "shunfeng", label: "顺丰速运" }
    ]
  }
];

export function FilterPanel({ onFilterChange }: FilterPanelProps) {
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleFilterSelect = (filterId: string, value: string) => {
    const newFilters = { ...activeFilters };
    
    if (value === "all") {
      delete newFilters[filterId];
    } else {
      newFilters[filterId] = value;
    }
    
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    setActiveFilters({});
    onFilterChange({});
  };

  const clearFilter = (filterId: string) => {
    const newFilters = { ...activeFilters };
    delete newFilters[filterId];
    setActiveFilters(newFilters);
    onFilterChange(newFilters);
  };

  const activeFilterCount = Object.keys(activeFilters).length;

  // 获取活动筛选的显示文本
  const getActiveFiltersSummary = () => {
    if (activeFilterCount === 0) return "无筛选条件";
    
    const summaryItems = Object.entries(activeFilters).map(([filterId, value]) => {
      const filter = filterOptions.find(f => f.id === filterId);
      const option = filter?.options.find(o => o.value === value);
      return option?.label;
    }).filter(Boolean);

    if (summaryItems.length <= 2) {
      return summaryItems.join(" · ");
    } else {
      return `${summaryItems[0]} · ${summaryItems[1]} 等${summaryItems.length}项`;
    }
  };

  return (
    <div className="bg-maersk-white border-b border-functional-light-grey">
      {/* 紧凑的头部工具栏 */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* 左侧：筛选状态和快速操作 */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-functional-mid-grey" />
              <span className="text-sm font-medium text-functional-mid-grey">数据筛选</span>
            </div>

            {/* 当前筛选状态摘要 */}
            <div className="flex items-center space-x-2">
              {activeFilterCount > 0 ? (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-maersk-black font-medium">
                    {getActiveFiltersSummary()}
                  </span>
                  <Badge variant="outline" className="h-5 px-2 bg-functional-bright-blue text-maersk-blue border-maersk-blue">
                    {activeFilterCount}
                  </Badge>
                </div>
              ) : (
                <span className="text-sm text-functional-mid-grey">点击展开设置筛选条件</span>
              )}
            </div>

            {/* 快速清除按钮 */}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-accent-mid-red hover:bg-accent-light-red hover:text-accent-mid-red"
                onClick={clearAllFilters}
              >
                <X className="h-3 w-3 mr-1" />
                清除
              </Button>
            )}
          </div>

          {/* 右侧：折叠/展开控制 */}
          <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 px-3 transition-all duration-200 ${
                  isFilterOpen 
                    ? 'maersk-button-primary' 
                    : activeFilterCount > 0 
                      ? 'border-maersk-blue text-maersk-blue hover:bg-functional-bright-blue' 
                      : 'maersk-button-outline'
                }`}
              >
                <Settings className="h-4 w-4 mr-1" />
                <span>筛选设置</span>
                {isFilterOpen ? (
                  <ChevronUp className="h-4 w-4 ml-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-1" />
                )}
              </Button>
            </CollapsibleTrigger>

            {/* 可折叠的筛选内容 */}
            <CollapsibleContent className="w-full">
              <div className="mt-4 pt-4 border-t border-functional-light-grey space-y-4">
                {/* 主要筛选选项 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-functional-mid-grey">基础筛选</span>
                    {activeFilterCount > 0 && (
                      <span className="text-xs text-maersk-blue bg-functional-bright-blue px-2 py-1 rounded">
                        {activeFilterCount} 个条件已设置
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {filterOptions.map((filter) => (
                      <div key={filter.id} className="space-y-2">
                        <label className="text-xs font-medium text-functional-mid-grey block">
                          {filter.label}
                        </label>
                        <Select 
                          onValueChange={(value) => handleFilterSelect(filter.id, value)}
                          value={activeFilters[filter.id] || "all"}
                        >
                          <SelectTrigger className="h-9 maersk-input">
                            <SelectValue placeholder={`选择${filter.label}`} />
                          </SelectTrigger>
                          <SelectContent className="maersk-card">
                            {filter.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 已应用的筛选标签 */}
                {activeFilterCount > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-functional-mid-grey">已应用的筛选</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-accent-mid-red hover:bg-accent-light-red hover:text-accent-mid-red"
                        onClick={clearAllFilters}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        清除全部
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(activeFilters).map(([filterId, value]) => {
                        const filter = filterOptions.find(f => f.id === filterId);
                        const option = filter?.options.find(o => o.value === value);
                        return (
                          <Badge 
                            key={filterId} 
                            variant="secondary" 
                            className="h-7 px-3 bg-functional-bright-blue text-maersk-blue border border-maersk-blue/20 hover:bg-maersk-blue hover:text-maersk-white transition-colors group"
                          >
                            <span className="text-xs font-medium">{filter?.label}:</span>
                            <span className="text-xs ml-1">{option?.label}</span>
                            <button
                              onClick={() => clearFilter(filterId)}
                              className="ml-2 hover:bg-maersk-white/20 rounded-full p-0.5 transition-colors"
                              title={`移除${filter?.label}筛选`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 筛选操作栏 */}
                <div className="flex items-center justify-between pt-3 border-t border-functional-light-grey">
                  <div className="text-sm text-functional-mid-grey">
                    {activeFilterCount > 0 ? (
                      <span><strong className="text-maersk-blue">{activeFilterCount}</strong> 个筛选条件已应用</span>
                    ) : (
                      <span>请设置筛选条件以过滤数据</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {activeFilterCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-accent-mid-red hover:bg-accent-light-red hover:text-accent-mid-red"
                        onClick={clearAllFilters}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        重置全部
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 maersk-button-outline"
                      onClick={() => setIsFilterOpen(false)}
                    >
                      收起筛选
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Upload, Download, Calendar, X, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { brands } from "../data/mockData";
import { platformsData } from "../data/platformData";
import { ImageWithFallback } from "./figma/ImageWithFallback";

interface TopToolbarProps {
  selectedBrand: string;
  selectedPlatform?: string;
  onBrandChange: (brand: string) => void;
  onPlatformChange: (platform: string) => void;
  onDateChange: (startDate: string, endDate: string) => void;
  activeMenu: string;
}

export function TopToolbar({
  selectedBrand,
  selectedPlatform,
  onBrandChange,
  onPlatformChange,
  onDateChange,
  activeMenu
}: TopToolbarProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleBrandClick = (brandName: string) => {
    if (selectedBrand === brandName) {
      onBrandChange('');
    } else {
      onBrandChange(brandName);
    }
  };

  const handlePlatformClick = (platformName: string) => {
    if (selectedPlatform === platformName) {
      onPlatformChange('');
    } else {
      onPlatformChange(platformName);
    }
  };

  const handleDateChange = () => {
    onDateChange(startDate, endDate);
    setShowDatePicker(false);
  };

  const clearAllFilters = () => {
    onBrandChange('');
    onPlatformChange('');
    setStartDate('');
    setEndDate('');
    onDateChange('', '');
  };

  // 计算当前激活的筛选数量
  const activeFiltersCount = [
    selectedBrand,
    selectedPlatform,
    startDate || endDate
  ].filter(Boolean).length;

  return (
    <div className="bg-maersk-white border-b border-functional-light-grey">
      {/* 主工具栏 - 始终可见 */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          {/* 左侧：主要功能按钮 */}
          <div className="flex items-center space-x-3">
            <Button variant="outline" className="flex items-center space-x-2 h-9 maersk-button-outline">
              <Upload className="h-4 w-4" />
              <span>导入</span>
            </Button>

            <Button variant="outline" className="flex items-center space-x-2 h-9 maersk-button-outline">
              <Download className="h-4 w-4" />
              <span>导出</span>
            </Button>

            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center space-x-2 h-9 maersk-button-outline"
              >
                <Calendar className="h-4 w-4" />
                <span>时间筛选</span>
              </Button>

              {showDatePicker && (
                <div className="absolute top-full mt-2 left-0 bg-maersk-white border border-functional-light-grey rounded-lg shadow-lg p-4 z-50 min-w-64">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-maersk-black mb-1">
                        开始日期
                      </label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="maersk-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-maersk-black mb-1">
                        结束日期
                      </label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="maersk-input"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" onClick={handleDateChange} className="maersk-button-primary">
                        应用
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDatePicker(false)}
                        className="maersk-button-outline"
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：筛选控制 */}
          <div className="flex items-center space-x-3">
            {/* 当前筛选状态指示器 */}
            {activeFiltersCount > 0 && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-functional-bright-blue rounded-full">
                <span className="text-sm font-medium text-maersk-blue">
                  {activeFiltersCount} 个筛选条件
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-maersk-blue hover:text-maersk-white rounded-full"
                  onClick={clearAllFilters}
                  title="清除所有筛选"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* 筛选面板折叠/展开按钮 */}
            <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className={`flex items-center space-x-2 h-9 transition-all duration-200 ${
                    isFilterOpen 
                      ? 'maersk-button-primary' 
                      : activeFiltersCount > 0 
                        ? 'border-maersk-blue text-maersk-blue hover:bg-functional-bright-blue' 
                        : 'maersk-button-outline'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  <span>筛选</span>
                  {activeFiltersCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-maersk-blue text-maersk-white text-xs rounded-full">
                      {activeFiltersCount}
                    </span>
                  )}
                  {isFilterOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>

              {/* 可折叠的筛选内容 */}
              <CollapsibleContent className="w-full">
                <div className="mt-4 pt-4 border-t border-functional-light-grey space-y-4">
                  {/* 品牌筛选 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-functional-mid-grey">品牌筛选</span>
                        {selectedBrand && (
                          <span className="text-xs text-maersk-blue bg-functional-bright-blue px-2 py-1 rounded">
                            已选择: {selectedBrand}
                          </span>
                        )}
                      </div>
                      {selectedBrand && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-functional-mid-grey hover:text-accent-mid-red"
                          onClick={() => onBrandChange('')}
                        >
                          <X className="h-3 w-3 mr-1" />
                          清除
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {brands.map((brand) => (
                        <Button
                          key={brand.name}
                          variant={selectedBrand === brand.name ? "default" : "outline"}
                          size="sm"
                          className={`h-9 px-3 transition-all duration-200 ${
                            selectedBrand === brand.name 
                              ? 'maersk-button-primary shadow-md' 
                              : 'maersk-button-outline hover:border-maersk-blue hover:text-maersk-blue'
                          }`}
                          onClick={() => handleBrandClick(brand.name)}
                          title={selectedBrand === brand.name ? '点击取消筛选' : `筛选 ${brand.name} 品牌`}
                        >
                          <div className="flex items-center space-x-2">
                            <ImageWithFallback
                              src={brand.logoUrl || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=20&h=20&fit=crop&crop=center"}
                              alt={`${brand.name} Logo`}
                              className="w-4 h-4 rounded object-cover"
                            />
                            <span className="font-medium text-sm">{brand.name}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* 平台筛选 - 仅在总览界面显示 */}
                  {activeMenu === "overview-dashboard" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-functional-mid-grey">平台筛选</span>
                          {selectedPlatform && (
                            <span className="text-xs text-maersk-blue bg-functional-bright-blue px-2 py-1 rounded">
                              已选择: {platformsData.find(p => p.name === selectedPlatform)?.displayName}
                            </span>
                          )}
                        </div>
                        {selectedPlatform && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-functional-mid-grey hover:text-accent-mid-red"
                            onClick={() => onPlatformChange('')}
                          >
                            <X className="h-3 w-3 mr-1" />
                            清除
                          </Button>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {platformsData.map((platform) => (
                          <Button
                            key={platform.name}
                            variant={selectedPlatform === platform.name ? "default" : "outline"}
                            size="sm"
                            className={`h-9 px-3 transition-all duration-200 ${
                              selectedPlatform === platform.name 
                                ? 'maersk-button-primary shadow-md' 
                                : 'maersk-button-outline hover:border-maersk-blue hover:text-maersk-blue'
                            }`}
                            onClick={() => handlePlatformClick(platform.name)}
                            title={selectedPlatform === platform.name ? '点击取消筛选' : `筛选 ${platform.displayName} 平台`}
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-base">{platform.logo}</span>
                              <span className="font-medium text-sm">{platform.displayName}</span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 筛选操作栏 */}
                  {(selectedBrand || selectedPlatform) && (
                    <div className="flex items-center justify-between pt-3 border-t border-functional-light-grey">
                      <div className="text-sm text-functional-mid-grey">
                        {activeFiltersCount} 个筛选条件已应用
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-accent-mid-red hover:bg-accent-light-red hover:text-accent-mid-red"
                          onClick={clearAllFilters}
                        >
                          <X className="h-4 w-4 mr-1" />
                          清除全部
                        </Button>
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
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>
    </div>
  );
}
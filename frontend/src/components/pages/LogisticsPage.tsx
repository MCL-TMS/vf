import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { AlertTriangle, X } from "lucide-react";
import { CourierMonitoring } from "../CourierMonitoring";
import { ForwardingAnalysis } from "../ForwardingAnalysis";
import { InterceptionAnalysis } from "../InterceptionAnalysis";
import { TimeEfficiencyAnalysis } from "../TimeEfficiencyAnalysis";
import { DataLoadingState } from "../DataLoadingState";

interface LogisticsPageProps {
  data: any;
  selectedBrand?: string | string[] | null;
  selectedPlatform?: string | string[] | null;  // ✅ 新增：平台筛选参数
  selectedSelfFlag?: string | null;  // ✅ 新增：自管筛选参数
  onRefetchData?: () => void;
  dateRange?: { from: string; to: string };
  exceptionFilter?: {
    type?: string;
    brand?: string;
    courier?: string;
  };
  onClearExceptionFilter?: () => void;
  onNavigateToMonitoring?: (filter: {
    type: string;
    brand?: string;
    courier?: string;
  }) => void;
  useRealData?: boolean;
  apiLoading?: boolean;
  rawApiData?: any;
  unifiedCourierData?: any;
}

export function LogisticsPage({ 
  data, 
  selectedBrand,
  selectedPlatform,  // ✅ 新增：传递platform参数
  selectedSelfFlag,  // ✅ 新增：传递selfFlag参数
  onRefetchData,
  dateRange,
  exceptionFilter, 
  onClearExceptionFilter,
  onNavigateToMonitoring,
  useRealData = false,
  apiLoading = false,
  rawApiData,
  unifiedCourierData
}: LogisticsPageProps) {
  // 当有异常筛选时，默认跳转到全程监控标签页
  const [activeTab, setActiveTab] = useState(() => {
    return exceptionFilter?.type ? "monitoring" : "time-analysis";
  });

  // 当异常筛选条件变化时，自动切换到全程监控
  useEffect(() => {
    if (exceptionFilter?.type) {
      setActiveTab("monitoring");
    }
  }, [exceptionFilter]);

  // 保持最新回调引用，避免因为函数引用变化导致副作用重复触发
  const onRefetchDataRef = useRef(onRefetchData);
  const hasTriggeredMonitoringRefetchRef = useRef(false);

  useEffect(() => {
    onRefetchDataRef.current = onRefetchData;
  }, [onRefetchData]);

  // 仅在“进入全程监控标签页”时触发一次刷新，避免无限重刷
  useEffect(() => {
    if (activeTab === 'monitoring' && useRealData && !hasTriggeredMonitoringRefetchRef.current) {
      onRefetchDataRef.current?.();
      hasTriggeredMonitoringRefetchRef.current = true;
      return;
    }

    if (activeTab !== 'monitoring') {
      hasTriggeredMonitoringRefetchRef.current = false;
    }
  }, [activeTab, useRealData]);

  // 获取异常类型的显示名称
  const getExceptionTypeName = (type?: string) => {
    switch (type) {
      case 'pickup_timeout': return '超时未揽收';
      case 'shipping_timeout': return '超时未发运';
      case 'shipping_no_update_48h': return '超48h未更新';
      case 'delivery_timeout': return '超时未签收';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">物流监控</h1>
          <p className="text-muted-foreground">
            全链路物流监控，包括时效分析、全程监控、转寄和拦截分析
          </p>
        </div>
      </div>

      {/* 异常筛选状态显示 */}
      {exceptionFilter?.type && (
        <div className="maersk-alert-warning p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-accent-mid-orange mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-accent-dark-orange mb-2">
                  异常监控模式已激活
                </h4>
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <Badge variant="outline" className="bg-accent-bright-orange text-accent-dark-orange border-accent-mid-orange">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    异常类型: {getExceptionTypeName(exceptionFilter.type)}
                  </Badge>
                  {exceptionFilter.brand && (
                    <Badge variant="outline" className="bg-functional-bright-blue text-functional-dark-blue border-functional-mid-blue">
                      🏷️ 品牌: {exceptionFilter.brand}
                    </Badge>
                  )}
                  {exceptionFilter.courier && (
                    <Badge variant="outline" className="bg-accent-bright-teal text-accent-dark-teal border-accent-mid-teal">
                      🚚 快递商: {exceptionFilter.courier}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-accent-dark-orange">
                  系统已自动跳转到"全程监控"标签页，并突出显示相关异常订单的监控详情。
                  点击清除筛选可返回正常监控模式。
                </p>
              </div>
            </div>
            {onClearExceptionFilter && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearExceptionFilter}
                className="bg-maersk-white border-accent-mid-orange text-accent-dark-orange hover:bg-accent-bright-orange"
              >
                <X className="h-4 w-4 mr-1" />
                清除筛选
              </Button>
            )}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="w-full min-w-max grid grid-cols-4 gap-1">
            <TabsTrigger value="time-analysis" className="text-sm">
              <span className="flex items-center space-x-2">
                <span>⏱️</span>
                <span>时效分析</span>
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="monitoring" 
              className={`text-sm ${exceptionFilter?.type ? 'bg-accent-bright-orange border-accent-mid-orange' : ''}`}
            >
              <span className="flex items-center space-x-2">
                <span>📦</span>
                <span>全程监控</span>
                {exceptionFilter?.type && (
                  <AlertTriangle className="h-3 w-3 text-accent-mid-orange" />
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger value="forwarding" className="text-sm">
              <span className="flex items-center space-x-2">
                <span>📤</span>
                <span>转寄分析</span>
              </span>
            </TabsTrigger>
            <TabsTrigger value="interception" className="text-sm">
              <span className="flex items-center space-x-2">
                <span>🚫</span>
                <span>拦截分析</span>
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="time-analysis" className="space-y-6">
          {useRealData && apiLoading ? (
            <DataLoadingState
              loading={true}
              dataType="时效分析"
              loadingMessage="正在加载时效分析数据..."
              minHeight="360px"
            />
          ) : (
            <TimeEfficiencyAnalysis 
              selectedBrand={selectedBrand}
              selectedPlatform={selectedPlatform}
              selectedSelfFlag={selectedSelfFlag}  // ✅ 新增：传递selfFlag参数
              dateRange={dateRange}
            />
          )}
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          {useRealData && apiLoading ? (
            <DataLoadingState
              loading={true}
              dataType="全程监控"
              loadingMessage="正在加载全程监控数据..."
              minHeight="420px"
            />
          ) : (
            <CourierMonitoring 
              dateRange={dateRange}
              selectedBrand={selectedBrand}
              selectedPlatform={selectedPlatform}  // ✅ 新增：传递platform参数
              selectedSelfFlag={selectedSelfFlag}  // ✅ 新增：传递selfFlag参数
              exceptionFilter={exceptionFilter}
              onNavigateToMonitoring={onNavigateToMonitoring}
              useRealData={useRealData}
              rawApiData={rawApiData}
              unifiedCourierData={unifiedCourierData}
            />
          )}
        </TabsContent>

        <TabsContent value="forwarding" className="space-y-6">
          {useRealData && apiLoading ? (
            <DataLoadingState
              loading={true}
              dataType="转寄分析"
              loadingMessage="正在加载转寄分析数据..."
              minHeight="360px"
            />
          ) : (
            <ForwardingAnalysis 
              useRealData={true}
              dateRange={dateRange}
              selectedBrand={selectedBrand}
              selectedPlatform={selectedPlatform}
              selectedSelfFlag={selectedSelfFlag}
            />
          )}
        </TabsContent>

        <TabsContent value="interception" className="space-y-6">
          <InterceptionAnalysis 
            dateRange={dateRange}
            selectedBrand={selectedBrand}
            platform={selectedPlatform}
            selfFlag={selectedSelfFlag}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
import React, { useState } from 'react';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Calculator, CheckCircle } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { analyzeTimeliness } from "../services/apiService";

interface TimelinessAnalysisTestButtonProps {
  selectedBrand?: string;
  dateRange?: { from: string; to: string };
  onAnalysisComplete?: (result: any) => void;
}

export function TimelinessAnalysisTestButton({ 
  selectedBrand, 
  dateRange,
  onAnalysisComplete 
}: TimelinessAnalysisTestButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleTestAnalysis = async () => {
    if (!dateRange) {
      toast.error("时间范围未设置", {
        description: "请先在顶部工具栏设置时间范围"
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      console.log('🧪 测试时效分析计算:', { selectedBrand, dateRange });

      // 创建测试请求
      const testRequest = {
        dateRange,
        selectedBrand,
        selectedCarrier: null,
        analysisType: 'both'
      };

      const result = await analyzeTimeliness(testRequest);
      console.log('✅ 测试分析完成:', result);

      if (onAnalysisComplete) {
        onAnalysisComplete(result.data);
      }

      toast.success("时效分析测试完成", {
        description: `成功分析 ${result.data.totalOrders} 条订单数据`
      });

    } catch (error) {
      console.error('❌ 测试分析失败:', error);
      toast.error("分析测试失败", {
        description: error instanceof Error ? error.message : "测试过程中发生未知错误"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const canAnalyze = dateRange && dateRange.from && dateRange.to;

  return (
    <div className="flex items-center space-x-3 p-4 bg-functional-bright-blue rounded-lg border border-functional-light-blue">
      <div className="flex-1">
        <h4 className="font-medium text-functional-dark-blue mb-1">时效分析计算测试</h4>
        <div className="text-sm text-functional-mid-blue space-y-1">
          <div>时间范围: {dateRange ? `${dateRange.from} 至 ${dateRange.to}` : '未设置'}</div>
          <div>品牌筛选: {selectedBrand || '全部品牌'}</div>
          <div>分析类型: S2D + C2D 综合分析</div>
        </div>
      </div>
      
      <div className="flex flex-col space-y-2">
        <Button
          onClick={handleTestAnalysis}
          disabled={!canAnalyze || isAnalyzing}
          className="maersk-button-primary flex items-center space-x-2"
          size="sm"
        >
          {isAnalyzing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>计算中...</span>
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4" />
              <span>执行分析</span>
            </>
          )}
        </Button>
        
        {canAnalyze && (
          <Badge variant="outline" className="text-xs text-accent-mid-green">
            <CheckCircle className="h-3 w-3 mr-1" />
            可执行
          </Badge>
        )}
      </div>
    </div>
  );
}
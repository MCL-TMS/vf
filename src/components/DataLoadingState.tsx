import { Card, CardContent } from "./ui/card";
import { Loader2, Database, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface DataLoadingStateProps {
  /** 加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 是否有数据 */
  hasData?: boolean;
  /** 数据类型描述（例如："快递商"、"订单"、"品牌"） */
  dataType?: string;
  /** 重试回调 */
  onRetry?: () => void;
  /** 自定义加载消息 */
  loadingMessage?: string;
  /** 自定义无数据消息 */
  noDataMessage?: string;
  /** 卡片样式（true=显示卡片外壳，false=仅内容） */
  showCard?: boolean;
  /** 最小高度 */
  minHeight?: string;
}

/**
 * 统一的数据加载状态组件
 * 用于替换所有模拟数据fallback，提供一致的加载、错误和无数据状态展示
 */
export function DataLoadingState({
  loading = false,
  error = null,
  hasData = false,
  dataType = "数据",
  onRetry,
  loadingMessage,
  noDataMessage,
  showCard = true,
  minHeight = "200px"
}: DataLoadingStateProps) {
  
  const content = (
    <div 
      className="flex flex-col items-center justify-center text-center p-8"
      style={{ minHeight }}
    >
      {/* 加载中状态 */}
      {loading && (
        <>
          <Loader2 className="h-12 w-12 text-maersk-blue animate-spin mb-4" />
          <h3 className="text-lg font-medium text-maersk-black mb-2">
            {loadingMessage || `正在加载${dataType}...`}
          </h3>
          <p className="text-sm text-functional-mid-grey">
            请稍候，数据正在从服务器获取
          </p>
        </>
      )}

      {/* 错误状态 */}
      {!loading && error && (
        <>
          <AlertCircle className="h-12 w-12 text-accent-mid-red mb-4" />
          <h3 className="text-lg font-medium text-accent-dark-red mb-2">
            数据加载失败
          </h3>
          <p className="text-sm text-functional-mid-grey mb-4">
            {error}
          </p>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              className="maersk-button-secondary"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              重新加载
            </Button>
          )}
        </>
      )}

      {/* 无数据状态 */}
      {!loading && !error && !hasData && (
        <>
          <Database className="h-12 w-12 text-functional-mid-grey mb-4" />
          <h3 className="text-lg font-medium text-maersk-black mb-2">
            暂无数据
          </h3>
          <p className="text-sm text-functional-mid-grey mb-4">
            {noDataMessage || `当前筛选条件下没有找到${dataType}`}
          </p>
          <div className="space-y-1 text-xs text-functional-mid-grey">
            <p>• 尝试调整日期范围</p>
            <p>• 尝试更改筛选条件</p>
            <p>• 检查后端API是否正常运行</p>
          </div>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              className="maersk-button-secondary mt-4"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新数据
            </Button>
          )}
        </>
      )}
    </div>
  );

  if (showCard) {
    return (
      <Card className="maersk-card">
        <CardContent className="p-0">
          {content}
        </CardContent>
      </Card>
    );
  }

  return content;
}

/**
 * 简化版加载指示器（用于小型组件）
 */
export function LoadingSpinner({ 
  size = "default",
  message 
}: { 
  size?: "sm" | "default" | "lg";
  message?: string;
}) {
  const sizeClasses = {
    sm: "h-4 w-4",
    default: "h-8 w-8",
    lg: "h-12 w-12"
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <Loader2 className={`${sizeClasses[size]} text-maersk-blue animate-spin`} />
      {message && (
        <p className="text-sm text-functional-mid-grey mt-2">{message}</p>
      )}
    </div>
  );
}

/**
 * 内联加载状态（用于列表项等）
 */
export function InlineLoadingState({ message = "加载中..." }: { message?: string }) {
  return (
    <div className="flex items-center space-x-2 text-functional-mid-grey py-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

import { DataLoadingState } from "./DataLoadingState";

interface PageLoadingStateProps {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  loadingMessage?: string;
  dataType?: string;
  onRetry?: () => void;
  minHeight?: string;
}

/**
 * 页面级统一加载状态：统一容器、背景、文案区与交互样式。
 */
export function PageLoadingState({
  title = "数据加载中",
  subtitle = "系统正在准备页面数据，请稍候",
  loading = true,
  error = null,
  loadingMessage,
  dataType = "页面数据",
  onRetry,
  minHeight = "420px"
}: PageLoadingStateProps) {
  return (
    <section className="page-loading-shell maersk-card">
      <div className="page-loading-header">
        <h2 className="page-loading-title">{title}</h2>
        <p className="page-loading-subtitle">{subtitle}</p>
      </div>

      <div className="page-loading-content">
        <DataLoadingState
          loading={loading}
          error={error}
          hasData={false}
          dataType={dataType}
          loadingMessage={loadingMessage}
          onRetry={onRetry}
          showCard={false}
          minHeight={minHeight}
        />
      </div>
    </section>
  );
}

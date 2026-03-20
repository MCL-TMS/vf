import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CheckCircle, AlertTriangle, FileSpreadsheet, Map, TrendingUp } from "lucide-react";

interface UploadResult {
  success: boolean;
  data: {
    filename: string;
    originalname: string;
    size: number;
    uploadTime: string;
  };
  processingResult: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    timelinessRecords: number;
    brandColumns: string[];
    dataQuality: {
      totalTimelinessRecords: number;
      brandDistribution: Record<string, number>;
      carrierDistribution: Record<string, number>;
      cityMappingRate: number;
    };
  };
  warnings: string[];
}

interface UploadResultDialogProps {
  open: boolean;
  onClose: () => void;
  result: UploadResult | null;
}

export function UploadResultDialog({ open, onClose, result }: UploadResultDialogProps) {
  if (!result) return null;

  const { data, processingResult, warnings } = result;
  const { dataQuality } = processingResult;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-accent-mid-green" />
            <span>上传处理完成</span>
          </DialogTitle>
          <DialogDescription>
            文件上传和数据处理已完成，以下是处理结果和数据质量报告的详细信息。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 文件信息 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <FileSpreadsheet className="h-4 w-4" />
                <span>文件信息</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">文件名：</span>
                  <span className="font-medium">{data.originalname}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">文件大小：</span>
                  <span className="font-medium">{Math.round(data.size / 1024)} KB</span>
                </div>
                <div>
                  <span className="text-muted-foreground">上传时间：</span>
                  <span className="font-medium">
                    {new Date(data.uploadTime).toLocaleString('zh-CN')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 处理结果概览 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <TrendingUp className="h-4 w-4" />
                <span>处理结果</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-functional-bright-blue rounded-lg">
                  <div className="text-2xl font-semibold text-functional-dark-blue">
                    {processingResult.totalRows}
                  </div>
                  <div className="text-sm text-functional-mid-blue">总行数</div>
                </div>
                <div className="text-center p-3 bg-accent-bright-green rounded-lg">
                  <div className="text-2xl font-semibold text-accent-dark-green">
                    {processingResult.validRows}
                  </div>
                  <div className="text-sm text-accent-mid-green">有效行</div>
                </div>
                <div className="text-center p-3 bg-accent-bright-orange rounded-lg">
                  <div className="text-2xl font-semibold text-accent-dark-orange">
                    {processingResult.errorRows}
                  </div>
                  <div className="text-sm text-accent-mid-orange">错误行</div>
                </div>
                <div className="text-center p-3 bg-accent-bright-teal rounded-lg">
                  <div className="text-2xl font-semibold text-accent-dark-teal">
                    {processingResult.timelinessRecords}
                  </div>
                  <div className="text-sm text-accent-mid-teal">时效记录</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 品牌分布 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">识别的品牌列</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {processingResult.brandColumns.map((brand, index) => (
                  <Badge key={index} variant="outline" className="maersk-badge-secondary">
                    {brand}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 数据质量分析 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center space-x-2">
                <Map className="h-4 w-4" />
                <span>数据质量分析</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 城市映射率 */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">城市映射率</span>
                  <span className="text-sm font-medium">{dataQuality.cityMappingRate}%</span>
                </div>
                <div className="w-full bg-functional-light-grey rounded-full h-2">
                  <div 
                    className="bg-maersk-blue h-2 rounded-full transition-all duration-300"
                    style={{ width: `${dataQuality.cityMappingRate}%` }}
                  ></div>
                </div>
              </div>

              {/* 品牌数据分布 */}
              <div>
                <h5 className="text-sm font-medium mb-2">品牌数据分布</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {Object.entries(dataQuality.brandDistribution).map(([brand, count]) => (
                    <div key={brand} className="flex justify-between p-2 bg-functional-bright-grey rounded">
                      <span>{brand}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 快递商分布 */}
              <div>
                <h5 className="text-sm font-medium mb-2">快递商分布</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {Object.entries(dataQuality.carrierDistribution).slice(0, 6).map(([carrier, count]) => (
                    <div key={carrier} className="flex justify-between p-2 bg-functional-bright-grey rounded">
                      <span className="truncate">{carrier}</span>
                      <span className="font-medium ml-2">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 警告信息 */}
          {warnings.length > 0 && (
            <Card className="border-accent-light-orange bg-accent-bright-orange">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center space-x-2 text-accent-dark-orange">
                  <AlertTriangle className="h-4 w-4" />
                  <span>处理提醒</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-accent-dark-orange">
                  {warnings.map((warning, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="w-1 h-1 rounded-full bg-accent-mid-orange mt-2 flex-shrink-0"></span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CourierPerformanceTable } from "./CourierPerformanceTable";
import { S2DTimeChart } from "./S2DTimeChart";
import { C2DTimeChart } from "./C2DTimeChart";

interface TimeEfficiencyAnalysisProps {
  selectedBrand?: string;
}

export function TimeEfficiencyAnalysis({ selectedBrand }: TimeEfficiencyAnalysisProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">时效分析</h2>
          <p className="text-muted-foreground">
            综合展示S2D（发运到签收）和C2D（付款到签收）时效数据，包含表格统计和图表分析
          </p>
        </div>
        {selectedBrand && (
          <Badge variant="outline" className="text-sm">
            当前品牌: {selectedBrand}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="s2d" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="s2d" className="flex items-center space-x-2">
            <span>📊</span>
            <span>S2D 时效分析</span>
          </TabsTrigger>
          <TabsTrigger value="c2d" className="flex items-center space-x-2">
            <span>📈</span>
            <span>C2D 时效分析</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="s2d" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* S2D 表格分析 */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                <span>📋</span>
                <span>S2D 数据表格</span>
                <Badge variant="secondary" className="text-xs">
                  发运到签收时效统计
                </Badge>
              </h3>
              <CourierPerformanceTable 
                selectedBrand={selectedBrand} 
                metricType="S2D"
              />
            </div>

            {/* S2D 图表分析 */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                <span>📊</span>
                <span>S2D 图表分析</span>
                <Badge variant="secondary" className="text-xs">
                  可视化趋势与分布
                </Badge>
              </h3>
              <S2DTimeChart selectedBrand={selectedBrand} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="c2d" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* C2D 表格分析 */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                <span>📋</span>
                <span>C2D 数据表格</span>
                <Badge variant="secondary" className="text-xs">
                  付款到签收时效统计
                </Badge>
              </h3>
              <CourierPerformanceTable 
                selectedBrand={selectedBrand} 
                metricType="C2D"
              />
            </div>

            {/* C2D 图表分析 */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                <span>📈</span>
                <span>C2D 图表分析</span>
                <Badge variant="secondary" className="text-xs">
                  可视化趋势与分布
                </Badge>
              </h3>
              <C2DTimeChart selectedBrand={selectedBrand} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 综合说明信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <span>💡</span>
            <span>时效分析说明</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">指标定义</h4>
              <div className="space-y-2 text-muted-foreground">
                <div><strong>S2D</strong>: Ship to Delivery，从发运到签收的时长</div>
                <div><strong>C2D</strong>: Customer to Delivery，从付款到签收的时长</div>
                <div><strong>Delivery Ratio</strong>: 各时效段内完成配送的订单占比</div>
                <div><strong>Actual VS Plan %</strong>: 实际时效相对于计划时效的比例</div>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
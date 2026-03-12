import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { Download, ExternalLink } from 'lucide-react';
import { Badge } from './ui/badge';

interface OrderDetail {
  orderNo: string;
  trackingNo: string;
  destProvince: string;
  destCity: string;
  sendTime: string;
  signTime: string;
  actualHours: number;
  planHours: number | null;
  timeRange: string;
  achieved: boolean;
}

interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  courierName: string;
  timeRange: string;
  orders: OrderDetail[];
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  open,
  onClose,
  courierName,
  timeRange,
  orders,
}) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 50;

  // 分页数据
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return orders.slice(startIndex, endIndex);
  }, [orders, currentPage]);

  const totalPages = Math.ceil(orders.length / pageSize);

  // 导出Excel
  const handleExport = () => {
    // 构建CSV内容
    const headers = [
      '订单号',
      '运单号',
      '目的省份',
      '目的城市',
      '发货时间',
      '签收时间',
      '实际时效(小时)',
      '计划时效(小时)',
      '时效区间',
      '是否达成',
    ];

    const rows = orders.map((order) => [
      order.orderNo,
      order.trackingNo,
      order.destProvince,
      order.destCity,
      order.sendTime,
      order.signTime,
      order.actualHours.toString(),
      order.planHours?.toString() || '-',
      order.timeRange,
      order.achieved ? '达成' : '未达成',
    ]);

    const csvContent =
      '\uFEFF' + // UTF-8 BOM
      [headers, ...rows].map((row) => row.join(',')).join('\n');

    // 下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${courierName}_${timeRange}_订单明细_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 格式化时间
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {courierName} - {timeRange} 订单明细
              <Badge variant="outline" className="ml-3">
                共 {orders.length} 单
              </Badge>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              导出Excel
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">订单号</TableHead>
                <TableHead className="w-[140px]">运单号</TableHead>
                <TableHead className="w-[80px]">省份</TableHead>
                <TableHead className="w-[80px]">城市</TableHead>
                <TableHead className="w-[110px]">发货时间</TableHead>
                <TableHead className="w-[110px]">签收时间</TableHead>
                <TableHead className="w-[90px] text-right">
                  实际时效
                </TableHead>
                <TableHead className="w-[90px] text-right">
                  计划时效
                </TableHead>
                <TableHead className="w-[80px] text-center">
                  达成状态
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    暂无订单数据
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrders.map((order, index) => (
                  <TableRow key={`${order.orderNo}-${index}`}>
                    <TableCell className="font-mono text-xs">
                      {order.orderNo}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.trackingNo || '-'}
                    </TableCell>
                    <TableCell>{order.destProvince}</TableCell>
                    <TableCell>{order.destCity}</TableCell>
                    <TableCell className="text-xs">
                      {formatDateTime(order.sendTime)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateTime(order.signTime)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.actualHours}h
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {order.planHours ? `${order.planHours}h` : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {order.achieved ? (
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700 border-green-200"
                        >
                          达成
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-red-50 text-red-700 border-red-200"
                        >
                          延迟
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页控制 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              第 {currentPage} / {totalPages} 页，显示{' '}
              {(currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, orders.length)} 单，共{' '}
              {orders.length} 单
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                上一页
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

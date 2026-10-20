import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "./ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table";
import { Badge } from "./ui/badge";
import { LoadingSpinner } from "./DataLoadingState";

export interface TransferCarrierSummary {
  carrierId?: string;
  orderCount: number;
}

interface ShippedTransferDialogProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error?: string | null;
  summaryByCarrier: TransferCarrierSummary[];
  totalOrders: number;
  dateRange?: { from: string; to: string };
  selectedBrand?: string | string[] | null;
}

export function ShippedTransferDialog({
  open,
  onClose,
  loading,
  error,
  summaryByCarrier,
  totalOrders,
  dateRange,
  selectedBrand
}: ShippedTransferDialogProps) {
  const renderBrandInfo = () => {
    if (!selectedBrand || selectedBrand === "all") {
      return "全部品牌";
    }
    if (Array.isArray(selectedBrand)) {
      return selectedBrand.join(", ");
    }
    return selectedBrand;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col bg-white border">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>已发运转运挖掘</span>
            <Badge variant="outline" className="ml-3">
              共 {totalOrders} 单
            </Badge>
          </DialogTitle>
          <div className="text-xs text-muted-foreground">
            {dateRange ? `${dateRange.from} ~ ${dateRange.to}` : "日期范围未知"} | 品牌: {renderBrandInfo()}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-lg">
          {loading && <LoadingSpinner message="正在获取转运数据..." />}
          {!loading && error && (
            <div className="p-6 text-sm text-accent-dark-red">
              {error}
            </div>
          )}
          {!loading && !error && summaryByCarrier.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">暂无符合待分拨条件的订单</div>
          )}
          {!loading && !error && summaryByCarrier.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">快递商</TableHead>
                  <TableHead className="text-right">待分拨数量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryByCarrier.map((row, index) => (
                  <TableRow key={`${row.carrierId || "UNKNOWN"}-${index}`}>
                    <TableCell className="font-mono text-xs">
                      {row.carrierId || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{row.orderCount.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

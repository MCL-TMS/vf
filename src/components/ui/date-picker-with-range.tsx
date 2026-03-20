"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { cn } from "./utils"
import { Button } from "./button"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

interface DatePickerWithRangeProps {
  className?: string
  onDateRangeChange?: (range: { from: string; to: string }) => void
  initialDateRange?: { from: string; to: string }
}

export function DatePickerWithRange({
  className,
  onDateRangeChange,
  initialDateRange
}: DatePickerWithRangeProps) {
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = React.useState<string>(initialDateRange?.from || today);
  const [toDate, setToDate] = React.useState<string>(initialDateRange?.to || today);
  const [isOpen, setIsOpen] = React.useState(false);

  // 当初始日期范围更新时，更新内部状态
  React.useEffect(() => {
    if (initialDateRange) {
      setFromDate(initialDateRange.from);
      setToDate(initialDateRange.to);
    }
  }, [initialDateRange]);

  const handleApply = () => {
    console.log('🎯 [DatePickerWithRange] handleApply called with dates:', { fromDate, toDate });
    if (onDateRangeChange && fromDate && toDate) {
      const dateRange = {
        from: fromDate,
        to: toDate
      };
      console.log('📤 [DatePickerWithRange] Calling onDateRangeChange with:', dateRange);
      onDateRangeChange(dateRange);
    }
    setIsOpen(false);
  };

  const formatDateRange = () => {
    if (fromDate === toDate) {
      return fromDate;
    }
    return `${fromDate} - ${toDate}`;
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              "border-functional-light-grey"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span>{formatDateRange()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">开始日期</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">结束日期</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                size="sm"
              >
                取消
              </Button>
              <Button
                onClick={handleApply}
                size="sm"
                className="bg-maersk-blue hover:bg-functional-mid-blue text-white"
              >
                应用
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
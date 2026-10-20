"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { cn } from "./utils"
import { Button } from "./button"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { getCurrentMonthToDateRange, toDateTimeInput } from "../../utils/dateUtils"

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
  const [appliedRange, setAppliedRange] = React.useState(() => initialDateRange || getCurrentMonthToDateRange());
  const [fromDate, setFromDate] = React.useState(() => toDateTimeInput(appliedRange.from));
  const [toDate, setToDate] = React.useState(() => toDateTimeInput(appliedRange.to, true));
  const [isOpen, setIsOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const inputId = React.useId();

  // 当初始日期范围更新时，更新内部状态
  React.useEffect(() => {
    if (initialDateRange) {
      setAppliedRange(initialDateRange);
      setFromDate(toDateTimeInput(initialDateRange.from));
      setToDate(toDateTimeInput(initialDateRange.to, true));
      setError('');
    }
  }, [initialDateRange]);

  const handleApply = () => {
    if (!fromDate || !toDate || !Number.isFinite(new Date(fromDate).getTime()) || !Number.isFinite(new Date(toDate).getTime())) {
      setError('请选择完整的开始和结束时间');
      return;
    }
    const normalizedFrom = toDateTimeInput(fromDate);
    const normalizedTo = toDateTimeInput(toDate, true);
    if (normalizedFrom > normalizedTo) {
      setError('开始时间不能晚于结束时间');
      return;
    }
    const dateRange = {
      from: normalizedFrom.replace('T', ' '),
      to: normalizedTo.replace('T', ' ')
    };
    setAppliedRange(dateRange);
    onDateRangeChange?.(dateRange);
    setError('');
    setIsOpen(false);
  };

  const formatDateRange = () => {
    return `${toDateTimeInput(appliedRange.from).replace('T', ' ')} - ${toDateTimeInput(appliedRange.to, true).replace('T', ' ')}`;
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={(open) => {
        if (open) {
          setFromDate(toDateTimeInput(appliedRange.from));
          setToDate(toDateTimeInput(appliedRange.to, true));
          setError('');
        }
        setIsOpen(open);
      }}>
        <PopoverTrigger asChild>
          {/* 🔥 给触发按钮也加上白色背景 */}
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal bg-white",
              "border-functional-light-grey"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="text-xs">{formatDateRange()}</span>
          </Button>
        </PopoverTrigger>
        {/* 🔥 核心修改：添加白色背景、边框、阴影 */}
        <PopoverContent 
          className="w-80 p-4 bg-white border border-functional-light-grey shadow-md rounded-lg" 
          align="start"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor={`${inputId}-start`} className="text-sm font-medium">开始时间</label>
              <Input
                id={`${inputId}-start`}
                type="datetime-local"
                step="1"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-white border-functional-light-grey" // 输入框也加白色背景
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={`${inputId}-end`} className="text-sm font-medium">结束时间</label>
              <Input
                id={`${inputId}-end`}
                type="datetime-local"
                step="1"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-white border-functional-light-grey" // 输入框也加白色背景
              />
            </div>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                size="sm"
                className="bg-white border-functional-light-grey" // 取消按钮加白色背景
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
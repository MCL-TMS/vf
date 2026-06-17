import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "./utils"
import { Button } from "./button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"
import { Badge } from "./badge"

export interface MultiSelectProps {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  footer?: React.ReactNode; // 新增footer插槽
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "选择...",
  className,
  disabled = false,
  footer
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (currentValue: string) => {
    if (currentValue === "all") {
      onChange([]);
      return;
    }
    if (selected.includes(currentValue)) {
      onChange(selected.filter((val) => val !== currentValue));
    } else {
      onChange([...selected, currentValue]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-[200px] justify-between font-normal h-8 text-sm",
            className
          )}
        >
          <div className="flex flex-1 items-center overflow-hidden flex-nowrap pr-2">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : selected.length === 1 ? (
              <span className="truncate">{options.find(o => o.value === selected[0])?.label || selected[0]}</span>
            ) : (
              <Badge variant="secondary" className="mr-1 text-[10px] h-5 rounded-sm">
                已选 {selected.length} 项
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0 bg-white border border-functional-light-grey shadow-md z-50 rounded-md" align="start">
        <Command className="bg-white">
          <CommandInput placeholder="搜索..." className="outline-none border-none focus:ring-0" />
          <CommandList className="bg-white">
            <CommandEmpty>未找到结果</CommandEmpty>
            <CommandGroup>
              <CommandItem
                key="all"
                value="all"
                onSelect={() => handleSelect("all")}
              >
                <div
                  className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                    selected.length === 0
                      ? "bg-primary text-primary-foreground"
                      : "opacity-50 [&_svg]:invisible"
                  )}
                >
                  <Check className={cn("h-4 w-4")} />
                </div>
                <span>全部</span>
              </CommandItem>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className={cn("h-4 w-4")} />
                    </div>
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {footer && <div className="border-t px-3 py-2 bg-white">{footer}</div>}
      </PopoverContent>
    </Popover>
  );
}

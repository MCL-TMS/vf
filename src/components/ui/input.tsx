import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 基础样式：默认浅灰色边框 + 白色背景
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md border border-functional-light-grey px-3 py-1 text-base bg-white transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        // 🔥 核心：聚焦时马士基蓝边框 + 无阴影/无outline
        "focus-visible:border-maersk-blue focus-visible:ring-0 focus-visible:outline-none focus-visible:transition-all focus-visible:duration-200",
        // 错误状态样式（保留）
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
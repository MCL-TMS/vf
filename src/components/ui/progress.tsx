"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "./utils";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
<<<<<<< HEAD
        "bg-gray-200 relative h-1 w-full overflow-hidden rounded-full",
=======
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
>>>>>>> main
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
<<<<<<< HEAD
        className="bg-functional-dark-blue h-full w-full flex-1 transition-all"
=======
        className="bg-primary h-full w-full flex-1 transition-all"
>>>>>>> main
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

<<<<<<< HEAD
export { Progress };
=======
export { Progress };
>>>>>>> main

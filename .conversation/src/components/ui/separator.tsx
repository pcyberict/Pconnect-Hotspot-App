import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils.ts";

export function Separator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn("shrink-0 bg-white/10 data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px", className)}
      {...props}
    />
  );
}
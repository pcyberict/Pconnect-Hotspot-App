import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils.ts";

type SeparatorProps = HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
};

export function Separator({ className, orientation = "horizontal", ...props }: SeparatorProps) {
  return (
    <div
      role="separator"
      data-orientation={orientation}
      className={cn("shrink-0 bg-white/10 data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px", className)}
      {...props}
    />
  );
}
"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OnlineStatusIndicatorProps {
  isOnline: boolean;
  className?: string;
}

export function OnlineStatusIndicator({
  isOnline,
  className,
}: OnlineStatusIndicatorProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-block h-2.5 w-2.5 rounded-full",
              isOnline ? "bg-green-500" : "bg-gray-400",
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>{isOnline ? "Online" : "Offline"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Tremor Label [v0.0.2]

import React from "react";
import * as LabelPrimitives from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

interface LabelProps
  extends React.ComponentPropsWithoutRef<typeof LabelPrimitives.Root> {
  disabled?: boolean;
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitives.Root>,
  LabelProps
>(({ className, disabled, ...props }, forwardedRef) => (
  <LabelPrimitives.Root
    ref={forwardedRef}
    className={cn(
      // base
      "text-xs leading-none",
      // text color
      "text-gray-900",
      // disabled
      {
        "text-gray-400": disabled,
      },
      className
    )}
    aria-disabled={disabled}
    tremor-id="tremor-raw"
    {...props}
  />
));

Label.displayName = "Label";

export { Label };

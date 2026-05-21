// Tremor Checkbox [v1.0.0]

import React from "react";
import * as CheckboxPrimitives from "@radix-ui/react-checkbox";

import { cn, focusRing } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitives.Root>
>(({ className, checked, ...props }, forwardedRef) => {
  return (
    <CheckboxPrimitives.Root
      ref={forwardedRef}
      {...props}
      checked={checked}
      className={cn(
        // base
        "relative inline-flex size-4 shrink-0 appearance-none items-center justify-center rounded-sm shadow-xs outline-hidden ring-1 ring-inset transition duration-100 enabled:cursor-pointer",
        // text color
        "text-white",
        // background color
        "bg-white",
        // ring color
        "ring-gray-300",
        // disabled
        "data-disabled:bg-gray-100 data-disabled:text-gray-400 data-disabled:ring-gray-300",
        // checked (bg color only when not disabled - uses disabled state override)
        "data-[state=checked]:bg-blue-500 data-[state=checked]:ring-0 data-[state=checked]:ring-transparent",
        // indeterminate
        "data-[state=indeterminate]:bg-blue-500 data-[state=indeterminate]:ring-0 data-[state=indeterminate]:ring-transparent",
        // focus
        focusRing,
        className
      )}
      tremor-id="tremor-raw"
    >
      <CheckboxPrimitives.Indicator
        asChild
        className="flex size-full items-center justify-center"
      >
        {checked === "indeterminate" ? (
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              x1="4"
              x2="12"
              y1="8"
              y2="8"
            ></line>
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11.2 5.59998L6.79999 9.99998L4.79999 7.99998"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            ></path>
          </svg>
        )}
      </CheckboxPrimitives.Indicator>
    </CheckboxPrimitives.Root>
  );
});

Checkbox.displayName = "Checkbox";

export { Checkbox };

// Tremor Input [v2.0.0]

import React from "react";
import { RiEyeFill, RiEyeOffFill, RiSearchLine } from "@remixicon/react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn, focusInput, focusRing, hasErrorInput } from "@/lib/utils";
import { Lock, Mail } from "lucide-react";

const inputStyles = tv({
  base: [
    // base
    "relative !h-[42px] block font-light w-full appearance-none rounded-sm border px-2.5 py-2 shadow-xs outline-hidden transition sm:text-sm",
    // border color
    "border-gray-300",
    // text color
    "text-gray-900",
    // placeholder color
    "placeholder-gray-400",
    // background color
    "bg-white",
    // disabled
    "disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400",
    // file
    [
      "file:-my-2 file:-ml-2.5 file:cursor-pointer file:rounded-l-[5px] file:rounded-r-none file:border-0 file:px-3 file:py-2 file:outline-hidden focus:outline-hidden disabled:pointer-events-none file:disabled:pointer-events-none",
      "file:border-solid file:border-gray-300 file:bg-gray-50 file:text-gray-500 file:hover:bg-gray-100",
      "file:[border-inline-end-width:1px] file:[margin-inline-end:0.75rem]",
      "file:disabled:bg-gray-100 file:disabled:text-gray-500",
    ],
    // focus
    focusInput,
    // invalid (optional)
    // remove search cancel button (optional)
    "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
  ],
  variants: {
    hasError: {
      true: hasErrorInput,
    },
    // number input
    enableStepper: {
      false:
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
    },
  },
});

interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputStyles> {
  inputClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      inputClassName,
      hasError,
      enableStepper = true,
      type,
      ...props
    }: InputProps,
    forwardedRef
  ) => {
    const [typeState, setTypeState] = React.useState(type);

    const isPassword = type === "password";
    const isSearch = type === "search";
    const isMail = type === "email";

    return (
      <div
        className={cn("relative w-full mt-3", className)}
        tremor-id="tremor-raw"
      >
        <input
          {...props}
          ref={forwardedRef}
          placeholder={props.placeholder || props.title}
          type={isPassword ? typeState : type}
          className={cn(
            "peer placeholder:text-transparent",
            inputStyles({ hasError, enableStepper }),
            {
              "pl-8": isSearch || isMail || isPassword,
              "pr-10": isPassword,
            },
            inputClassName
          )}
        />
        {props.title && (
          <span
            className={cn(
              "absolute transition-all duration-100 text-slate-500 bg-white px-2 py-0 left-8 -top-2.5 z-[999] text-sm",
              "peer-placeholder-shown:top-2.5",
              "peer-focus:-top-3 peer-focus:!text-primary peer-focus:font-medium"
            )}
          >
            {props.title}
          </span>
        )}
        {isMail && (
          <div
            className={cn(
              // base
              "pointer-events-none absolute bottom-0 left-2 flex h-full items-center justify-center",
              // text color
              "text-gray-400"
            )}
          >
            <Mail className="size-[1.125rem] shrink-0" aria-hidden="true" />
          </div>
        )}
        {isSearch && (
          <div
            className={cn(
              // base
              "pointer-events-none absolute bottom-0 left-2 flex h-full items-center justify-center",
              // text color
              "text-gray-400"
            )}
          >
            <RiSearchLine
              className="size-[1.125rem] shrink-0"
              aria-hidden="true"
            />
          </div>
        )}
        {isPassword && (
          <div
            className={cn(
              // base
              "pointer-events-none absolute bottom-0 left-2 flex h-full items-center justify-center",
              // text color
              "text-gray-400"
            )}
          >
            <Lock className="size-[1.125rem] shrink-0" aria-hidden="true" />
          </div>
        )}
        {isPassword && (
          <div
            className={cn(
              "absolute bottom-0 right-0 flex h-full items-center justify-center px-3"
            )}
          >
            <button
              aria-label="Change password visibility"
              className={cn(
                // base
                "h-fit w-fit rounded-xs outline-hidden transition-all",
                // text
                "text-gray-400",
                // hover
                "hover:text-gray-500",
                focusRing
              )}
              type="button"
              onClick={() => {
                setTypeState(typeState === "password" ? "text" : "password");
              }}
            >
              <span className="sr-only">
                {typeState === "password" ? "Show password" : "Hide password"}
              </span>
              {typeState === "password" ? (
                <RiEyeFill aria-hidden="true" className="size-5 shrink-0" />
              ) : (
                <RiEyeOffFill aria-hidden="true" className="size-5 shrink-0" />
              )}
            </button>
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input, inputStyles, type InputProps };

import { cn } from "@/lib/utils";
import Image, { ImageProps } from "next/image";
import * as React from "react";

export const Logo = React.forwardRef<HTMLImageElement, Partial<ImageProps>>(
  (props, ref) => (
    <Image
      {...props}
      width={1000}
      height={700}
      alt="logo"
      src="/icon.png"
      ref={ref}
      className={cn("grayscale", props.className)}
    />
  )
);

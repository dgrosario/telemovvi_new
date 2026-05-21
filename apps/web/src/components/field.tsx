import { cn } from "@/lib/utils";

export const Field: React.FC<
  React.PropsWithChildren & { className?: string }
> = (props) => (
  <div className={cn("flex flex-col gap-2", props.className)}>
    {props.children}
  </div>
);

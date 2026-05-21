import { ReactNode } from "react";

interface LegalCardProps {
  variant: "info" | "important" | "success";
  children: ReactNode;
}

export function LegalCard({ variant, children }: LegalCardProps) {
  const variantStyles = {
    info: "bg-[#f0f8ff] border-l-[#065183]",
    important: "bg-[#fdf2f2] border-l-red-500",
    success: "bg-[#f0fff4] border-l-green-600",
  };

  return (
    <div
      className={`border-l-4 rounded-lg p-5 my-5 ${variantStyles[variant]}`}
    >
      {children}
    </div>
  );
}

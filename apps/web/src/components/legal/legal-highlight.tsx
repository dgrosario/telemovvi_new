import { ReactNode } from "react";

interface LegalHighlightProps {
  children: ReactNode;
}

export function LegalHighlight({ children }: LegalHighlightProps) {
  return (
    <div className="bg-gradient-to-br from-[#0000FF]/10 to-[#065183]/10 border-l-4 border-[#0000FF] rounded-lg p-5 my-5">
      {children}
    </div>
  );
}

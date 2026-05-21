import { ReactNode } from "react";

interface LegalSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="mb-10 scroll-mt-24">
      <h2 className="text-2xl font-bold text-[#2c3e50] mb-4 border-b border-[#e1e5e9] pb-2">
        {title}
      </h2>
      <div className="text-[#495057] space-y-4">{children}</div>
    </section>
  );
}

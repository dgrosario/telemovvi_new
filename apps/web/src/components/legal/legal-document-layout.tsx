import { ReactNode } from "react";
import { LegalSidebar, NavigationSection } from "./legal-sidebar";

interface LegalDocumentLayoutProps {
  title: string;
  subtitle: string;
  navigation: NavigationSection[];
  children: ReactNode;
}

export function LegalDocumentLayout({
  title,
  subtitle,
  navigation,
  children,
}: LegalDocumentLayoutProps) {
  return (
    <div className="min-h-screen bg-[#f8f9fa] fixed inset-0 overflow-y-auto z-50">
      <LegalSidebar title="Documentos Legais" navigation={navigation} />

      <main className="md:ml-[280px]">
        <header className="bg-gradient-to-br from-[#0000FF] to-[#065183] text-white text-center py-10 px-6">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">{title}</h1>
          <p className="text-base md:text-lg text-white/90 max-w-3xl mx-auto">
            {subtitle}
          </p>
        </header>

        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="bg-white rounded-lg shadow-sm border border-[#e1e5e9] p-8 md:p-10">
            {children}
          </div>
        </div>

        <footer className="text-center py-4 px-6">
          <p className="text-[10px] text-[#d0d0d0]">
            &copy; 2025 Softtor Solu&ccedil;&otilde;es Transformadoras LTDA
          </p>
          <p className="text-[10px] text-[#d0d0d0]">
            Terms of Use: softtor.com.br/termos-de-uso
          </p>
        </footer>
      </main>
    </div>
  );
}

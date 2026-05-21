import { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/legal-document-layout";
import { LegalSection } from "@/components/legal/legal-section";
import {
  termsOfUseNavigation,
  termsOfUseSections,
} from "@/data/legal/terms-of-use-content";

export const metadata: Metadata = {
  title: "Termos de Uso - Telemovvi",
  description:
    "Conheça os termos e condições para utilização do nosso aplicativo de integração omnichannel com plataformas Meta",
};

export default function TermsOfUsePage() {
  return (
    <LegalDocumentLayout
      title="📋 Termos de Uso"
      subtitle="Conheça os termos e condições para utilização do nosso aplicativo de integração omnichannel com plataformas Meta"
      navigation={termsOfUseNavigation}
    >
      <div className="bg-[#f0f8ff] border-l-4 border-[#065183] rounded-lg p-5 mb-8">
        <p className="text-[#495057] mb-2">
          <strong>📅 Última atualização:</strong> 24 de Novembro de 2025
        </p>
        <p className="text-[#495057] mb-2">
          <strong>🏢 Empresa:</strong> Infocell
        </p>
        <p className="text-[#495057]">
          <strong>📋 CNPJ:</strong> 21.632.137/0001-39
        </p>
      </div>

      {termsOfUseSections.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          {section.content}
        </LegalSection>
      ))}
    </LegalDocumentLayout>
  );
}

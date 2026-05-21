import { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/legal-document-layout";
import { LegalSection } from "@/components/legal/legal-section";
import {
  privacyPolicyNavigation,
  privacyPolicySections,
} from "@/data/legal/privacy-policy-content";

export const metadata: Metadata = {
  title: "Política de Privacidade - Telemovvi",
  description:
    "Entenda como coletamos, utilizamos, armazenamos e protegemos seus dados pessoais em conformidade com a LGPD",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentLayout
      title="🔒 Política de Privacidade"
      subtitle="Entenda como coletamos, utilizamos, armazenamos e protegemos seus dados pessoais em conformidade com a LGPD"
      navigation={privacyPolicyNavigation}
    >
      <div className="bg-[#f0f8ff] border-l-4 border-[#065183] rounded-lg p-5 mb-8">
        <p className="text-[#495057] mb-2">
          <strong>📅 Última atualização:</strong> 24 de Novembro de 2025
        </p>
        <p className="text-[#495057] mb-2">
          <strong>🏢 Responsável:</strong> Infocell
        </p>
        <p className="text-[#495057]">
          <strong>📋 CNPJ:</strong> 21.632.137/0001-39
        </p>
      </div>

      {privacyPolicySections.map((section) => (
        <LegalSection key={section.id} id={section.id} title={section.title}>
          {section.content}
        </LegalSection>
      ))}
    </LegalDocumentLayout>
  );
}

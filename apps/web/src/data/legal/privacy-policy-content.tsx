import { ReactNode } from "react";
import { LegalCard } from "@/components/legal/legal-card";
import { LegalContactCard } from "@/components/legal/legal-contact-card";
import { LegalHighlight } from "@/components/legal/legal-highlight";

export interface NavigationItem {
  id: string;
  label: string;
}

export interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export interface LegalSection {
  id: string;
  title: string;
  content: ReactNode;
}

export const privacyPolicyNavigation: NavigationSection[] = [
  {
    title: "Introdução",
    items: [
      { id: "introducao", label: "Introdução" },
      { id: "definicoes", label: "Definições" },
      { id: "responsavel", label: "Responsável" },
    ],
  },
  {
    title: "Coleta de Dados",
    items: [
      { id: "dados-coletados", label: "Dados Coletados" },
      { id: "dados-meta", label: "Dados da Meta" },
      { id: "finalidades", label: "Finalidades" },
      { id: "dados-sensiveis", label: "Dados Sensíveis" },
    ],
  },
  {
    title: "Tratamento",
    items: [
      { id: "compartilhamento", label: "Compartilhamento" },
      { id: "armazenamento", label: "Armazenamento" },
      { id: "bases-legais", label: "Bases Legais" },
      { id: "seguranca", label: "Segurança" },
    ],
  },
  {
    title: "Direitos e Contato",
    items: [
      { id: "direitos", label: "Direitos do Usuário" },
      { id: "meta-integration", label: "Integração Meta" },
      { id: "alteracoes", label: "Alterações" },
      { id: "contato", label: "Contato" },
    ],
  },
];

export const privacyPolicySections: LegalSection[] = [
  {
    id: "introducao",
    title: "1. 🎯 Introdução",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Esta Política de Privacidade explica como a <strong>Infocell</strong>{" "}
          (CNPJ: 21.632.137/0001-39) coleta, utiliza, armazenamos e protegemos
          as informações dos usuários quando você utiliza nosso aplicativo, que
          integra serviços da Meta (Facebook, Instagram e WhatsApp), incluindo
          funcionalidades de mensagens e comunicação.
        </p>

        <p className="mb-4 text-[#495057]">
          Nós coletamos e utilizamos alguns dados pessoais que pertencem àqueles
          que utilizam nosso sistema. Ao fazê-lo, agimos na qualidade de operador
          desses dados e estamos sujeitos às disposições da Lei Federal n.
          13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD).
        </p>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">⚠️ Importante</h4>
          <p className="text-[#495057]">
            Ao utilizar nosso aplicativo, você concorda com esta Política de
            Privacidade e com os{" "}
            <a
              href="https://developers.facebook.com/terms/dfc_platform_terms/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0000FF] hover:underline"
            >
              Termos da Plataforma da Meta
            </a>
            . O aplicativo pode solicitar permissões específicas para acessar
            mensagens e conversas das plataformas Meta conforme necessário para as
            funcionalidades oferecidas.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "definicoes",
    title: "2. 📖 Definições",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Para fins desta Política de Privacidade, as seguintes definições se
          aplicam:
        </p>

        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            <strong>Dados Pessoais:</strong> informações que identificam ou podem
            identificar uma pessoa natural
          </li>
          <li>
            <strong>Tratamento:</strong> toda operação realizada com dados
            pessoais
          </li>
          <li>
            <strong>Titular:</strong> pessoa natural a quem se referem os dados
            pessoais
          </li>
          <li>
            <strong>Controlador:</strong> Infocell
          </li>
          <li>
            <strong>LGPD:</strong> Lei Geral de Proteção de Dados Pessoais (Lei
            Federal nº 13.709/2018)
          </li>
          <li>
            <strong>Meta:</strong> Facebook, Instagram, WhatsApp e outras
            plataformas da Meta Platforms, Inc.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "responsavel",
    title: "3. 🏢 Responsável pelo Tratamento",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          A <strong>Infocell</strong> é a responsável pelo tratamento dos dados
          pessoais coletados através desta plataforma.
        </p>

        <LegalCard variant="info">
          <h4 className="text-lg font-semibold mb-3">📋 Informações da Empresa</h4>
          <div className="space-y-2 text-[#495057]">
            <p>
              <strong>Razão Social:</strong> Infocell
            </p>
            <p>
              <strong>CNPJ:</strong> 21.632.137/0001-39
            </p>
            <p>
              <strong>Endereço:</strong> Rua Rubens Justo, 130, Pratania-SP, CEP:
              18660-512
            </p>
            <p>
              <strong>E-mail:</strong> alunosi8@gmail.com
            </p>
          </div>
        </LegalCard>
      </>
    ),
  },
  {
    id: "dados-coletados",
    title: "4. 📊 Dados Coletados",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Nós coletamos os seguintes dados pessoais que nossos usuários nos
          fornecem expressamente ao utilizar nossa plataforma:
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          4.1 Dados fornecidos diretamente pelo usuário
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>👤 Nome completo</li>
          <li>📧 Endereço de e-mail</li>
          <li>📱 Telefone celular</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          4.2 Quando coletamos esses dados
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            Quando usuário realiza cadastro para o teste que será realizado na
            plataforma
          </li>
          <li>
            Quando usuário preenche informações no formulário de perfil existente
            na plataforma
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          4.3 Finalidades da coleta
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>Para que o usuário possa realizar o acesso na nossa plataforma</li>
          <li>Para eventual contato e comunicado</li>
          <li>Para personalização da experiência de uso</li>
        </ul>
      </>
    ),
  },
  {
    id: "dados-meta",
    title: "5. 🔗 Dados fornecidos pela Plataforma da Meta",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Através das permissões concedidas e integração com as APIs da Meta,
          podemos coletar:
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          5.1 Dados de perfil
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>🆔 ID do usuário do Facebook/Instagram</li>
          <li>👤 Nome e foto de perfil</li>
          <li>📧 Endereço de e-mail (quando autorizado)</li>
          <li>📱 Número de telefone do WhatsApp (quando autorizado)</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          5.2 Dados técnicos
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>🔑 Tokens de acesso para integração com serviços Meta</li>
          <li>🔐 Dados de conexão e autenticação</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          5.3 Dados de comunicação
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>💬 Mensagens e conversas do Facebook Messenger (quando autorizado)</li>
          <li>📩 Mensagens diretas do Instagram (quando autorizado)</li>
          <li>👥 Dados de contatos e conversas das plataformas Meta</li>
        </ul>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">🔒 Controle de Permissões</h4>
          <p className="text-[#495057]">
            Você pode revogar as permissões concedidas à Meta através das
            configurações da sua conta a qualquer momento. Isso pode afetar
            algumas funcionalidades do nosso aplicativo.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "6. 🎯 Finalidades do Tratamento",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Utilizamos os dados coletados para as seguintes finalidades:
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          6.1 Autenticação e Acesso
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            Permitir o acesso seguro ao aplicativo através da integração com
            contas Meta
          </li>
          <li>Verificar a identidade do usuário</li>
          <li>Gerenciar sessões de usuário</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          6.2 Integração com WhatsApp
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            Habilitar funcionalidades de envio de mensagens e comunicação via
            WhatsApp Business API
          </li>
          <li>Gerenciar conversas e contatos</li>
          <li>Envio de mídias e documentos</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          6.3 Integração com Facebook Messenger
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            Permitir envio e recebimento de mensagens através do Facebook
            Messenger
          </li>
          <li>Gerenciar páginas conectadas</li>
          <li>Centralizar conversas de múltiplas páginas</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          6.4 Integração com Instagram
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>Habilitar funcionalidades de mensagens diretas do Instagram</li>
          <li>Gerenciar stories e feed</li>
          <li>Integração com funcionalidades sociais</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          6.5 Gestão de Conversas
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            Centralizar e gerenciar conversas de múltiplas plataformas Meta em uma
            única interface
          </li>
          <li>Automação de respostas</li>
          <li>Análise e relatórios de conversas</li>
        </ul>
      </>
    ),
  },
  {
    id: "dados-sensiveis",
    title: "7. 🚫 Dados Sensíveis",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Não coletamos dados sensíveis de nossos usuários, assim entendidos
          aqueles definidos nos arts. 11 e seguintes da Lei de Proteção de Dados
          Pessoais. Assim, não haverá coleta de dados sobre:
        </p>

        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>❌ Origem racial ou étnica</li>
          <li>❌ Convicção religiosa</li>
          <li>❌ Opinião política</li>
          <li>
            ❌ Filiação a sindicato ou organização religiosa, filosófica ou
            política
          </li>
          <li>❌ Dados referentes à saúde ou à vida sexual</li>
          <li>❌ Dados genéticos ou biométricos</li>
        </ul>

        <LegalCard variant="info">
          <h4 className="text-lg font-semibold mb-2">📋 Coleta Adicional</h4>
          <p className="text-[#495057]">
            Eventualmente, outros tipos de dados não previstos expressamente nesta
            Política poderão ser coletados, desde que sejam fornecidos com o
            consentimento do usuário ou com base legal válida.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "compartilhamento",
    title: "8. 🤝 Compartilhamento de Dados",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Nós não vendemos ou compartilhamos dados pessoais de nossos clientes
          para qualquer que seja a finalidade comercial.
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          8.1 Situações de Compartilhamento
        </h3>
        <p className="mb-3 text-[#495057]">
          Podemos compartilhar dados apenas nas seguintes situações:
        </p>

        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            <strong>Com a Meta:</strong> Para permitir a integração com suas APIs
            e serviços, conforme os{" "}
            <a
              href="https://developers.facebook.com/terms/dfc_platform_terms/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0000FF] hover:underline"
            >
              Termos da Plataforma da Meta
            </a>
          </li>
          <li>
            <strong>Prestadores de Serviços:</strong> Com empresas que nos
            auxiliam na operação da plataforma (hospedagem, segurança, etc.)
          </li>
          <li>
            <strong>Obrigação Legal:</strong> Quando exigido por lei, ordem
            judicial ou autoridade competente
          </li>
          <li>
            <strong>Proteção de Direitos:</strong> Para proteger nossos direitos,
            propriedade ou segurança, ou de nossos usuários
          </li>
        </ul>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">🔒 Proteção de Dados</h4>
          <p className="text-[#495057]">
            Todos os terceiros com quem compartilhamos dados são obrigados a
            manter a confidencialidade e usar os dados apenas para as finalidades
            acordadas.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "armazenamento",
    title: "9. 💾 Armazenamento de Dados",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Os dados pessoais que coletamos serão armazenados pelo menor prazo
          possível, levando em consideração:
        </p>

        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>Obrigações legais e regulatórias existentes</li>
          <li>Necessidade de defesa dos interesses da empresa</li>
          <li>Finalidades para as quais foram coletados</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          9.1 Critérios de Retenção
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>Dados de conta: enquanto a conta estiver ativa</li>
          <li>
            Dados de comunicação: conforme necessário para prestação do serviço
          </li>
          <li>Dados de integração Meta: conforme tokens de acesso válidos</li>
          <li>Dados para cumprimento legal: conforme exigido por lei</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          9.2 Exclusão de Dados
        </h3>
        <p className="mb-4 text-[#495057]">
          <strong>Direito de Exclusão:</strong> Você pode solicitar a exclusão dos
          seus dados a qualquer momento através do e-mail:{" "}
          <strong>alunosi8@gmail.com</strong>. Após a solicitação, excluiremos
          suas informações em até 30 dias, exceto quando houver obrigatoriedade de
          retenção.
        </p>

        <LegalCard variant="success">
          <h4 className="text-lg font-semibold mb-2">✅ Anonimização</h4>
          <p className="text-[#495057]">
            Uma vez finalizado o tratamento, os dados são apagados ou anonimizados,
            observadas as disposições legais aplicáveis.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "bases-legais",
    title: "10. ⚖️ Bases Legais para o Tratamento",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Cada operação de tratamento de dados pessoais precisa ter um fundamento
          jurídico, ou seja, uma base legal, conforme previsto na LGPD.
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          10.1 Bases Legais Utilizadas
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            <strong>Consentimento:</strong> Quando você autoriza expressamente o
            tratamento
          </li>
          <li>
            <strong>Execução de Contrato:</strong> Para prestação dos serviços
            contratados
          </li>
          <li>
            <strong>Cumprimento de Obrigação Legal:</strong> Quando exigido por
            lei
          </li>
          <li>
            <strong>Legítimo Interesse:</strong> Para melhorar nossos serviços e
            segurança
          </li>
        </ul>

        <LegalCard variant="info">
          <h4 className="text-lg font-semibold mb-2">📋 Informações Detalhadas</h4>
          <p className="text-[#495057]">
            Mais informações sobre as bases legais específicas podem ser obtidas
            através dos nossos canais de contato.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "direitos",
    title: "11. 🛡️ Direitos do Usuário",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          O usuário possui os seguintes direitos, conferidos pela Lei de Proteção
          de Dados Pessoais:
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          11.1 Direitos Fundamentais
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>✅ Confirmação da existência de tratamento</li>
          <li>👁️ Acesso aos dados</li>
          <li>✏️ Correção de dados incompletos, inexatos ou desatualizados</li>
          <li>
            🚫 Anonimização, bloqueio ou eliminação de dados desnecessários
          </li>
          <li>📤 Portabilidade dos dados a outro fornecedor</li>
          <li>🗑️ Eliminação dos dados pessoais tratados com consentimento</li>
          <li>
            📋 Informação sobre entidades com as quais compartilhamos dados
          </li>
          <li>
            ℹ️ Informação sobre possibilidade de não fornecer consentimento
          </li>
          <li>🔄 Revogação do consentimento</li>
          <li>🔧 Revogar permissões concedidas à Meta</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          11.2 Como Exercer Seus Direitos
        </h3>
        <p className="mb-4 text-[#495057]">
          Para garantir que o usuário que pretende exercer seus direitos é, de
          fato, o titular dos dados pessoais, poderemos solicitar documentos ou
          outras informações que possam auxiliar em sua correta identificação.
        </p>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">⚠️ Limitações</h4>
          <p className="text-[#495057]">
            Nos termos da LGPD, não existe direito de eliminação de dados tratados
            com fundamento em bases legais distintas do consentimento, a menos que
            os dados sejam desnecessários, excessivos ou tratados em
            desconformidade com a lei.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "seguranca",
    title: "12. 🔐 Medidas de Segurança",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Empregamos medidas técnicas e organizativas aptas a proteger os dados
          pessoais de acessos não autorizados e de situações de destruição, perda,
          extravio ou alteração.
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          12.1 Medidas Implementadas
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>🏠 Armazenamento em ambiente seguro</li>
          <li>🔒 Acesso restrito aos dados</li>
          <li>🔐 Certificado SSL para transmissão criptografada</li>
          <li>📝 Registros de acesso e auditoria</li>
          <li>✅ Conformidade com padrões de segurança da Meta</li>
          <li>🛡️ Monitoramento contínuo de segurança</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          12.2 Limitações de Responsabilidade
        </h3>
        <p className="mb-4 text-[#495057]">
          Ainda que adotemos todas as medidas ao nosso alcance, é possível que
          ocorram incidentes motivados por terceiros (ataques de hackers) ou por
          culpa exclusiva do usuário. Em tais casos, nos eximimos de
          responsabilidade.
        </p>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">📢 Notificação de Incidentes</h4>
          <p className="text-[#495057]">
            Caso ocorra qualquer incidente de segurança que possa gerar risco
            relevante, comunicaremos os afetados e a Autoridade Nacional de
            Proteção de Dados (ANPD) conforme exigido pela LGPD.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "meta-integration",
    title: "13. 🔗 Integração com a Plataforma Meta",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Nosso aplicativo integra-se com a Plataforma da Meta conforme os{" "}
          <a
            href="https://developers.facebook.com/terms/dfc_platform_terms/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0000FF] hover:underline"
          >
            Termos da Plataforma da Meta
          </a>
          .
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          13.1 Funcionalidades Integradas
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>🔐 Autenticação através de contas Facebook/Instagram</li>
          <li>💬 Envio de mensagens via WhatsApp Business API</li>
          <li>📩 Envio e recebimento de mensagens via Facebook Messenger</li>
          <li>📸 Funcionalidades de mensagens diretas do Instagram</li>
          <li>🎯 Centralização de conversas de múltiplas plataformas Meta</li>
          <li>👥 Integração com funcionalidades sociais da Meta</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          13.2 Controle de Permissões
        </h3>
        <p className="mb-4 text-[#495057]">
          O uso de dados da Meta está sujeito aos Termos da Plataforma da Meta e
          às permissões que você concede ao nosso aplicativo. Cada plataforma pode
          ter permissões específicas que devem ser concedidas separadamente.
        </p>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">⚠️ Política da Meta</h4>
          <p className="text-[#495057]">
            Para mais informações sobre como a Meta utiliza seus dados, consulte a{" "}
            <a
              href="https://www.facebook.com/privacy/policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0000FF] hover:underline"
            >
              Política de Privacidade da Meta
            </a>
            . O acesso a mensagens e conversas é feito apenas com consentimento
            explícito.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "alteracoes",
    title: "14. 🔄 Alterações nesta Política",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          A presente versão desta Política de Privacidade foi atualizada pela
          última vez em: <strong>15 de Setembro de 2025</strong>.
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          14.1 Modificações
        </h3>
        <p className="mb-4 text-[#495057]">
          Reservamo-nos o direito de modificar, a qualquer momento, as presentes
          normas, especialmente para adaptá-las às eventuais alterações feitas em
          nosso aplicativo, seja pela disponibilização de novas funcionalidades,
          seja pela supressão ou modificação daquelas já existentes.
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          14.2 Notificações
        </h3>
        <p className="mb-3 text-[#495057]">
          Sempre que houver uma modificação significativa, nossos usuários serão
          notificados através de:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>E-mail para o endereço cadastrado</li>
          <li>Notificação dentro do aplicativo</li>
          <li>Atualização da data de modificação nesta página</li>
        </ul>

        <LegalCard variant="info">
          <h4 className="text-lg font-semibold mb-2">📧 Manter Dados Atualizados</h4>
          <p className="text-[#495057]">
            É importante manter seu e-mail atualizado para receber notificações
            sobre alterações nesta Política.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "contato",
    title: "15. 📞 Como Entrar em Contato",
    content: (
      <>
        <LegalContactCard
          email="alunosi8@gmail.com"
          whatsapp="(14) 92000-4772"
          address="Rua Rubens Justo, 130, Pratania-SP, CEP: 18660-512"
        />

        <LegalCard variant="success">
          <h4 className="text-lg font-semibold mb-2">✅ Dúvidas Frequentes</h4>
          <p className="text-[#495057]">
            Para esclarecer quaisquer dúvidas sobre esta Política de Privacidade ou
            sobre os dados pessoais que tratamos, entre em contato conosco.
            Responderemos em até 48 horas úteis.
          </p>
        </LegalCard>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">🏛️ Autoridade de Controle</h4>
          <p className="text-[#495057]">
            Sem prejuízo de outras vias de recurso, você pode apresentar reclamação
            à <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong> se
            considerar que seus dados foram tratados de forma inadequada.
          </p>
        </LegalCard>

        <LegalHighlight>
          <h3 className="text-xl font-semibold text-white mb-2">
            🎉 Obrigado por confiar na Infocell!
          </h3>
          <p className="text-white/90">
            Estamos comprometidos em proteger seus dados pessoais e oferecer
            transparência total sobre como os utilizamos. Se tiver qualquer dúvida,
            não hesite em nos contatar.
          </p>
        </LegalHighlight>
      </>
    ),
  },
];

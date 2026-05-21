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

export const termsOfUseNavigation: NavigationSection[] = [
  {
    title: "Introdução",
    items: [
      { id: "introducao", label: "Introdução" },
      { id: "definicoes", label: "Definições" },
      { id: "aceitacao", label: "Aceitação dos Termos" },
      { id: "servicos", label: "Nossos Serviços" },
    ],
  },
  {
    title: "Uso do Aplicativo",
    items: [
      { id: "permissoes", label: "Permissões e Integrações" },
      { id: "responsabilidades", label: "Responsabilidades" },
      { id: "restricoes", label: "Restrições" },
      { id: "propriedade", label: "Propriedade Intelectual" },
    ],
  },
  {
    title: "Privacidade e Dados",
    items: [
      { id: "privacidade", label: "Política de Privacidade" },
      { id: "dados", label: "Tratamento de Dados" },
      { id: "meta", label: "Integração Meta" },
    ],
  },
  {
    title: "Disposições Gerais",
    items: [
      { id: "responsabilidade", label: "Limitação de Responsabilidade" },
      { id: "alteracoes", label: "Alterações" },
      { id: "jurisdicao", label: "Lei Aplicável" },
      { id: "contato", label: "Contato" },
    ],
  },
];

export const termsOfUseSections: LegalSection[] = [
  {
    id: "introducao",
    title: "1. 📋 Introdução",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Bem-vindo ao aplicativo da <strong>Infocell</strong> (CNPJ:
          21.632.137/0001-39). Estes Termos de Uso estabelecem as condições sob
          as quais você pode acessar e utilizar nosso aplicativo, que integra
          serviços da Meta (Facebook, Instagram e WhatsApp) para fornecer
          funcionalidades de comunicação e gerenciamento de conversas.
        </p>

        <p className="mb-4 text-[#495057]">
          Ao utilizar nosso aplicativo, você concorda em estar vinculado a estes
          Termos de Uso, bem como à nossa{" "}
          <a
            href="/politicas-de-privacidade"
            className="text-[#0000FF] hover:underline"
          >
            Política de Privacidade
          </a>
          .
        </p>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">⚠️ Importante</h4>
          <p className="text-[#495057]">
            Se você não concordar com estes termos, não utilize nosso aplicativo.
            O uso continuado do aplicativo constitui aceitação destes Termos de
            Uso e de quaisquer alterações futuras.
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
          Para fins destes Termos de Uso, as seguintes definições se aplicam:
        </p>

        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            <strong>Aplicativo:</strong> O software desenvolvido pela Infocell
            para integração com plataformas Meta
          </li>
          <li>
            <strong>Usuário:</strong> Qualquer pessoa que acessa e utiliza o
            aplicativo
          </li>
          <li>
            <strong>Serviços:</strong> Todas as funcionalidades oferecidas pelo
            aplicativo
          </li>
          <li>
            <strong>Meta:</strong> Facebook, Instagram, WhatsApp e outras
            plataformas da Meta Platforms, Inc.
          </li>
          <li>
            <strong>Conta:</strong> Registro do usuário no aplicativo
          </li>
          <li>
            <strong>Conteúdo:</strong> Informações, textos, imagens, vídeos e
            outros materiais
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "aceitacao",
    title: "3. ✅ Aceitação dos Termos",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Ao criar uma conta ou utilizar o aplicativo, você confirma que:
        </p>

        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>Leu e compreendeu estes Termos de Uso</li>
          <li>Tem capacidade legal para celebrar este acordo</li>
          <li>
            Concorda em cumprir todas as leis e regulamentos aplicáveis
          </li>
          <li>
            Aceita os{" "}
            <a
              href="https://developers.facebook.com/terms/dfc_platform_terms/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0000FF] hover:underline"
            >
              Termos da Plataforma da Meta
            </a>
          </li>
        </ul>

        <LegalCard variant="info">
          <h4 className="text-lg font-semibold mb-2">📋 Idade Mínima</h4>
          <p className="text-[#495057]">
            Você deve ter pelo menos 18 anos de idade para utilizar este
            aplicativo. Ao utilizar o aplicativo, você declara que possui a idade
            mínima exigida.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "servicos",
    title: "4. 🎯 Nossos Serviços",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          O aplicativo oferece as seguintes funcionalidades:
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          4.1 Integração com WhatsApp
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>Envio e recebimento de mensagens via WhatsApp Business API</li>
          <li>Gerenciamento de conversas e contatos</li>
          <li>Envio de mídias e documentos</li>
          <li>Automação de respostas</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          4.2 Integração com Facebook Messenger
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            Envio e recebimento de mensagens através do Facebook Messenger
          </li>
          <li>Gerenciamento de páginas conectadas</li>
          <li>Centralização de conversas de múltiplas páginas</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          4.3 Integração com Instagram
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>Funcionalidades de mensagens diretas do Instagram</li>
          <li>Gerenciamento de conteúdo social</li>
          <li>Integração com funcionalidades sociais</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          4.4 Centralização Omnichannel
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            Gerenciamento unificado de conversas de múltiplas plataformas
          </li>
          <li>Análise e relatórios de conversas</li>
          <li>Automação e workflows</li>
        </ul>
      </>
    ),
  },
  {
    id: "permissoes",
    title: "5. 🔑 Permissões e Integrações",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Para utilizar plenamente as funcionalidades do aplicativo, você deverá
          conceder as seguintes permissões:
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          5.1 Permissões da Meta
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>Acesso a mensagens e conversas (Facebook, Instagram, WhatsApp)</li>
          <li>Leitura de perfil básico</li>
          <li>Gerenciamento de páginas conectadas</li>
          <li>Envio de mensagens em seu nome</li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          5.2 Controle de Permissões
        </h3>
        <p className="mb-4 text-[#495057]">
          Você pode gerenciar e revogar as permissões concedidas a qualquer
          momento através das configurações da sua conta Meta. No entanto, a
          revogação de permissões pode limitar ou impedir o funcionamento de
          algumas funcionalidades do aplicativo.
        </p>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">🔒 Uso Responsável</h4>
          <p className="text-[#495057]">
            Você é responsável por todas as atividades realizadas através de sua
            conta e deve manter suas credenciais de acesso em segurança.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "responsabilidades",
    title: "6. 👤 Responsabilidades do Usuário",
    content: (
      <>
        <p className="mb-4 text-[#495057]">Ao utilizar o aplicativo, você se compromete a:</p>

        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            Fornecer informações verdadeiras, precisas e atualizadas durante o
            cadastro
          </li>
          <li>Manter a confidencialidade de suas credenciais de acesso</li>
          <li>
            Notificar imediatamente sobre qualquer uso não autorizado de sua
            conta
          </li>
          <li>Utilizar o aplicativo de forma legal e ética</li>
          <li>Respeitar os direitos de propriedade intelectual</li>
          <li>
            Cumprir os Termos de Serviço das plataformas Meta integradas
          </li>
          <li>Não utilizar o aplicativo para fins ilegais ou prejudiciais</li>
        </ul>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">⚠️ Violações</h4>
          <p className="text-[#495057]">
            O descumprimento destas responsabilidades pode resultar na suspensão
            ou encerramento de sua conta, sem prejuízo de outras medidas legais
            cabíveis.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "restricoes",
    title: "7. 🚫 Restrições de Uso",
    content: (
      <>
        <p className="mb-4 text-[#495057]">Você NÃO pode:</p>

        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>❌ Utilizar o aplicativo para spam ou envio de mensagens em massa não solicitadas</li>
          <li>❌ Violar leis aplicáveis ou direitos de terceiros</li>
          <li>❌ Tentar acessar áreas restritas do aplicativo</li>
          <li>❌ Interferir ou interromper o funcionamento do aplicativo</li>
          <li>❌ Realizar engenharia reversa ou descompilar o código</li>
          <li>❌ Revender ou redistribuir o acesso ao aplicativo</li>
          <li>❌ Criar contas falsas ou automatizadas</li>
          <li>❌ Coletar dados de outros usuários sem consentimento</li>
        </ul>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">🏛️ Conformidade Legal</h4>
          <p className="text-[#495057]">
            O uso do aplicativo deve estar em conformidade com todas as leis
            aplicáveis, incluindo mas não se limitando à LGPD (Lei Geral de
            Proteção de Dados) e regulamentações das plataformas Meta.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "propriedade",
    title: "8. 📜 Propriedade Intelectual",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Todo o conteúdo do aplicativo, incluindo mas não se limitando a textos,
          gráficos, logotipos, ícones, imagens, clipes de áudio, downloads
          digitais e compilações de dados, é de propriedade exclusiva da Infocell
          ou de seus licenciadores.
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          8.1 Direitos Reservados
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            O aplicativo e seu conteúdo são protegidos por leis de direitos
            autorais
          </li>
          <li>Você não adquire nenhum direito de propriedade ao usar o aplicativo</li>
          <li>
            É proibida a reprodução, distribuição ou modificação sem autorização
            prévia
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          8.2 Conteúdo do Usuário
        </h3>
        <p className="mb-4 text-[#495057]">
          Você mantém todos os direitos sobre o conteúdo que cria ou envia através
          do aplicativo. Ao utilizar o aplicativo, você concede à Infocell uma
          licença limitada para hospedar, armazenar e processar esse conteúdo
          conforme necessário para fornecer os serviços.
        </p>
      </>
    ),
  },
  {
    id: "privacidade",
    title: "9. 🔒 Política de Privacidade",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          O tratamento dos seus dados pessoais é regido pela nossa{" "}
          <a
            href="/politicas-de-privacidade"
            className="text-[#0000FF] hover:underline"
          >
            Política de Privacidade
          </a>
          , que faz parte integrante destes Termos de Uso.
        </p>

        <LegalCard variant="info">
          <h4 className="text-lg font-semibold mb-2">📋 Conformidade com LGPD</h4>
          <p className="text-[#495057]">
            Estamos comprometidos em proteger seus dados pessoais em conformidade
            com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "dados",
    title: "10. 💾 Tratamento de Dados",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Ao utilizar o aplicativo, você autoriza expressamente:
        </p>

        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            A coleta e tratamento dos seus dados pessoais conforme descrito na
            Política de Privacidade
          </li>
          <li>
            O acesso a dados das plataformas Meta necessários para o funcionamento
            do aplicativo
          </li>
          <li>
            O armazenamento e processamento de mensagens e conversas para
            prestação dos serviços
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          10.1 Seus Direitos
        </h3>
        <p className="mb-4 text-[#495057]">
          Você tem direito a acessar, corrigir, excluir ou solicitar a
          portabilidade dos seus dados pessoais, conforme previsto na LGPD.
        </p>
      </>
    ),
  },
  {
    id: "meta",
    title: "11. 🔗 Integração com Meta",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          O aplicativo integra-se com as plataformas da Meta (Facebook, Instagram,
          WhatsApp) através de suas APIs oficiais.
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          11.1 Termos Adicionais
        </h3>
        <p className="mb-4 text-[#495057]">
          Ao utilizar o aplicativo, você também está sujeito aos:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
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
            <a
              href="https://www.facebook.com/privacy/policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0000FF] hover:underline"
            >
              Política de Privacidade da Meta
            </a>
          </li>
          <li>Termos de Serviço do WhatsApp Business</li>
        </ul>

        <LegalCard variant="important">
          <h4 className="text-lg font-semibold mb-2">⚠️ Importante</h4>
          <p className="text-[#495057]">
            A Infocell não é responsável por quaisquer alterações, interrupções ou
            descontinuação dos serviços da Meta que possam afetar o funcionamento
            do aplicativo.
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "responsabilidade",
    title: "12. ⚖️ Limitação de Responsabilidade",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          O aplicativo é fornecido "no estado em que se encontra", sem garantias
          de qualquer tipo, expressas ou implícitas.
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          12.1 Isenções
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>
            Não garantimos que o aplicativo estará sempre disponível ou livre de
            erros
          </li>
          <li>
            Não nos responsabilizamos por interrupções causadas por terceiros ou
            plataformas Meta
          </li>
          <li>
            Não somos responsáveis por perdas ou danos decorrentes do uso ou
            impossibilidade de uso do aplicativo
          </li>
          <li>
            Não garantimos a precisão ou completude de qualquer informação no
            aplicativo
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          12.2 Força Maior
        </h3>
        <p className="mb-4 text-[#495057]">
          Não seremos responsáveis por falhas ou atrasos no cumprimento de nossas
          obrigações decorrentes de eventos fora de nosso controle razoável,
          incluindo mas não se limitando a desastres naturais, falhas de
          infraestrutura, ataques cibernéticos ou alterações nas políticas das
          plataformas Meta.
        </p>
      </>
    ),
  },
  {
    id: "alteracoes",
    title: "13. 🔄 Alterações nos Termos",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Reservamo-nos o direito de modificar estes Termos de Uso a qualquer
          momento.
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          13.1 Notificação de Alterações
        </h3>
        <ul className="list-disc pl-6 space-y-2 text-[#495057]">
          <li>Alterações significativas serão notificadas por e-mail</li>
          <li>A data de última atualização será sempre exibida no topo desta página</li>
          <li>
            O uso continuado do aplicativo após alterações constitui aceitação dos
            novos termos
          </li>
        </ul>

        <LegalCard variant="info">
          <h4 className="text-lg font-semibold mb-2">📅 Última Atualização</h4>
          <p className="text-[#495057]">
            Estes Termos de Uso foram atualizados pela última vez em:{" "}
            <strong>24 de Novembro de 2025</strong>
          </p>
        </LegalCard>
      </>
    ),
  },
  {
    id: "jurisdicao",
    title: "14. 🏛️ Lei Aplicável e Jurisdição",
    content: (
      <>
        <p className="mb-4 text-[#495057]">
          Estes Termos de Uso são regidos pelas leis da República Federativa do
          Brasil.
        </p>

        <h3 className="text-xl font-semibold text-[#34495e] mb-3 mt-6">
          14.1 Foro
        </h3>
        <p className="mb-4 text-[#495057]">
          Fica eleito o foro da comarca de <strong>Pratania-SP</strong> para
          dirimir quaisquer questões decorrentes destes Termos de Uso, com
          renúncia expressa a qualquer outro, por mais privilegiado que seja.
        </p>

        <LegalCard variant="info">
          <h4 className="text-lg font-semibold mb-2">⚖️ Resolução de Conflitos</h4>
          <p className="text-[#495057]">
            Encorajamos a resolução amigável de quaisquer disputas. Entre em
            contato conosco antes de iniciar qualquer procedimento legal.
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
        <p className="mb-4 text-[#495057]">
          Para dúvidas, sugestões ou solicitações relacionadas a estes Termos de
          Uso, entre em contato conosco:
        </p>

        <LegalContactCard
          email="alunosi8@gmail.com"
          whatsapp="(14) 92000-4772"
          address="Rua Rubens Justo, 130, Pratania-SP, CEP: 18660-512"
        />

        <LegalCard variant="success">
          <h4 className="text-lg font-semibold mb-2">✅ Suporte</h4>
          <p className="text-[#495057]">
            Nossa equipe está disponível para esclarecer dúvidas e fornecer
            suporte. Responderemos em até 48 horas úteis.
          </p>
        </LegalCard>

        <LegalHighlight>
          <h3 className="text-xl font-semibold text-white mb-2">
            🎉 Obrigado por utilizar a Infocell!
          </h3>
          <p className="text-white/90">
            Estamos comprometidos em oferecer a melhor experiência possível e em
            manter a transparência sobre nossos termos e condições. Se tiver
            qualquer dúvida, não hesite em nos contatar.
          </p>
        </LegalHighlight>
      </>
    ),
  },
];

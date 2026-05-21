export type PermissionCategory =
  | "users"
  | "sectors"
  | "conversations"
  | "connections"
  | "templates"
  | "partners"
  | "labels"
  | "flows"
  | "campaigns"
  | "notifications"
  | "dashboard"
  | "settings"
  | "special"
  | "system";

export const permissionCategories: Record<
  PermissionCategory,
  { label: string; icon: string }
> = {
  users: { label: "Usuários", icon: "tabler:users" },
  sectors: { label: "Setores", icon: "tabler:building" },
  conversations: { label: "Atendimentos", icon: "tabler:messages" },
  connections: { label: "Canais", icon: "tabler:plug-connected" },
  templates: { label: "Modelos", icon: "tabler:template" },
  partners: { label: "Clientes", icon: "tabler:address-book" },
  labels: { label: "Etiquetas", icon: "tabler:tag" },
  flows: { label: "Fluxos", icon: "tabler:git-branch" },
  campaigns: { label: "Campanhas", icon: "tabler:speakerphone" },
  notifications: { label: "Notificações", icon: "tabler:bell" },
  dashboard: { label: "Dashboard", icon: "tabler:dashboard" },
  settings: { label: "Configurações", icon: "tabler:settings" },
  special: { label: "Especial", icon: "tabler:star" },
  system: { label: "Sistema", icon: "tabler:shield-lock" },
};

export const permissionsObj = {
  "start:session": {
    description: "Acesso ao sistema",
    linkeds: [],
    category: "users" as PermissionCategory,
  },

  "manage:users": {
    description:
      "Gerenciamento completo de usuários (criar, editar, remover e definir permissões)",
    linkeds: [
      "list:users",
      "register:users",
      "remove:users",
      "register:permissions",
      "manage:roles",
    ],
    category: "users" as PermissionCategory,
  },

  "list:users": {
    description: "Visualizar lista de usuários do workspace",
    linkeds: [],
    category: "users" as PermissionCategory,
  },

  "register:users": {
    description: "Criar novos usuários e editar dados de usuários existentes",
    linkeds: ["list:users"],
    category: "users" as PermissionCategory,
  },

  "remove:users": {
    description: "Desativar ou remover usuários do workspace",
    linkeds: ["list:users"],
    category: "users" as PermissionCategory,
  },

  "register:permissions": {
    description: "Atribuir e remover permissões de outros usuários",
    linkeds: ["list:users", "list:roles"],
    category: "users" as PermissionCategory,
  },

  "manage:roles": {
    description: "Gerenciamento completo de perfis (criar, editar e remover)",
    linkeds: ["list:roles", "register:roles", "remove:roles"],
    category: "users" as PermissionCategory,
  },

  "list:roles": {
    description: "Visualizar perfis de permissão disponíveis",
    linkeds: [],
    category: "users" as PermissionCategory,
  },

  "register:roles": {
    description: "Criar e editar perfis de permissão",
    linkeds: ["list:roles"],
    category: "users" as PermissionCategory,
  },

  "remove:roles": {
    description: "Remover perfis de permissão",
    linkeds: ["list:roles"],
    category: "users" as PermissionCategory,
  },

  "manage:sectors": {
    description:
      "Gerenciamento completo de setores (criar, editar, remover e visualizar todos)",
    linkeds: [
      "list:sectors",
      "register:sectors",
      "remove:sectors",
      "list:all-sectors",
    ],
    category: "sectors" as PermissionCategory,
  },

  "list:sectors": {
    description: "Visualizar setores atribuídos ao usuário",
    linkeds: [],
    category: "sectors" as PermissionCategory,
  },

  "register:sectors": {
    description:
      "Criar novos setores e editar configurações de setores existentes",
    linkeds: ["list:sectors"],
    category: "sectors" as PermissionCategory,
  },

  "manage:conversations": {
    description: "Gerenciamento completo de atendimentos (todas as ações abaixo)",
    linkeds: [
      "list:conversation",
      "list:all-conversations",
      "list:chat-attendants",
      "send:message",
      "send:internal-comment",
      "assign:conversation",
      "transfer:conversation",
      "create:conversation",
      "close:conversation",
      "list:all-channels",
    ],
    category: "conversations" as PermissionCategory,
  },

  "list:conversation": {
    description:
      "Visualizar apenas seus próprios atendimentos e pendentes do setor",
    linkeds: [],
    category: "conversations" as PermissionCategory,
  },

  "list:all-conversations": {
    description:
      "Visualizar atendimentos de outros atendentes nos setores atribuídos (requer toggle \"Ver Todas\")",
    linkeds: ["list:chat-attendants"],
    category: "conversations" as PermissionCategory,
  },

  "list:chat-attendants": {
    description: "Visualizar lista de atendentes no filtro do Chat",
    linkeds: [],
    category: "conversations" as PermissionCategory,
  },

  "send:message": {
    description: "Enviar mensagens de texto, áudio, imagem e documentos",
    linkeds: ["list:conversation"],
    category: "conversations" as PermissionCategory,
  },

  "assign:conversation": {
    description: "Assumir atendimentos pendentes para si",
    linkeds: ["list:conversation"],
    category: "conversations" as PermissionCategory,
  },

  "transfer:conversation": {
    description: "Transferir seus atendimentos para outro atendente ou setor",
    linkeds: ["list:conversation"],
    category: "conversations" as PermissionCategory,
  },

  "create:conversation": {
    description: "Iniciar um novo atendimento com um contato",
    linkeds: ["list:conversation"],
    category: "conversations" as PermissionCategory,
  },

  "close:conversation": {
    description: "Encerrar atendimentos em andamento",
    linkeds: ["list:conversation"],
    category: "conversations" as PermissionCategory,
  },

  "delete:conversation": {
    description: "Excluir atendimentos permanentemente (ação irreversível)",
    linkeds: ["list:conversation"],
    category: "conversations" as PermissionCategory,
  },

  "send:internal-comment": {
    description: "Enviar comentários internos visíveis apenas para a equipe",
    linkeds: ["list:conversation"],
    category: "conversations" as PermissionCategory,
  },

  "bypass:attendance-to-send": {
    description: "Enviar mensagens em atendimentos sem precisar assumi-los",
    linkeds: ["send:message"],
    category: "conversations" as PermissionCategory,
  },

  "list:all-channels": {
    description:
      "Visualizar atendimentos de todos os canais, inclusive os não atribuídos",
    linkeds: ["list:conversation"],
    category: "conversations" as PermissionCategory,
  },

  "view:whatsapp-groups": {
    description: "Visualizar grupos do WhatsApp na lista de atendimentos",
    linkeds: [],
    category: "conversations" as PermissionCategory,
  },

  "delete:any-message": {
    description: "Excluir mensagens enviadas por qualquer usuário",
    linkeds: ["list:conversation"],
    category: "conversations" as PermissionCategory,
  },

  "manage:connections": {
    description: "Gerenciamento completo de canais de comunicação",
    linkeds: [
      "list:connections",
      "register:connections",
      "start:connections",
      "remove:connections",
    ],
    category: "connections" as PermissionCategory,
  },

  "list:connections": {
    description: "Visualizar canais configurados (WhatsApp, Instagram, etc.)",
    linkeds: [],
    category: "connections" as PermissionCategory,
  },

  "register:connections": {
    description: "Criar e configurar novos canais de comunicação",
    linkeds: ["list:connections"],
    category: "connections" as PermissionCategory,
  },

  "start:connections": {
    description: "Conectar e reconectar canais (escanear QR Code, etc.)",
    linkeds: ["list:connections"],
    category: "connections" as PermissionCategory,
  },

  "remove:connections": {
    description: "Desconectar e remover canais",
    linkeds: ["list:connections"],
    category: "connections" as PermissionCategory,
  },

  "manage:templates": {
    description: "Gerenciamento completo de templates e mensagens rápidas",
    linkeds: [
      "list:templates",
      "register:templates",
      "remove:templates",
      "view:quick-messages",
      "create:quick-messages",
      "manage:quick-messages",
      "delete:quick-messages",
      "view:private-quick-messages",
    ],
    category: "templates" as PermissionCategory,
  },

  "list:templates": {
    description: "Visualizar templates de mensagem aprovados pelo WhatsApp",
    linkeds: [],
    category: "templates" as PermissionCategory,
  },

  "register:templates": {
    description: "Enviar templates para aprovação do WhatsApp",
    linkeds: ["list:templates"],
    category: "templates" as PermissionCategory,
  },

  "remove:templates": {
    description: "Remover templates de mensagem",
    linkeds: ["list:templates"],
    category: "templates" as PermissionCategory,
  },

  "manage:partners": {
    description: "Gerenciamento completo de clientes e contatos",
    linkeds: ["list:partners", "register:partners", "remove:partners"],
    category: "partners" as PermissionCategory,
  },

  "list:partners": {
    description: "Visualizar cadastro de clientes",
    linkeds: [],
    category: "partners" as PermissionCategory,
  },

  "register:partners": {
    description: "Criar e editar dados de clientes",
    linkeds: ["list:partners"],
    category: "partners" as PermissionCategory,
  },

  "remove:partners": {
    description: "Remover clientes do cadastro",
    linkeds: ["list:partners"],
    category: "partners" as PermissionCategory,
  },

  "manage:labels": {
    description: "Gerenciamento completo de etiquetas",
    linkeds: ["list:labels", "register:labels", "remove:labels"],
    category: "labels" as PermissionCategory,
  },

  "list:labels": {
    description: "Visualizar e usar etiquetas em atendimentos",
    linkeds: [],
    category: "labels" as PermissionCategory,
  },

  "register:labels": {
    description: "Criar e editar etiquetas",
    linkeds: ["list:labels"],
    category: "labels" as PermissionCategory,
  },

  "remove:labels": {
    description: "Remover etiquetas",
    linkeds: ["list:labels"],
    category: "labels" as PermissionCategory,
  },

  "manage:flows": {
    description: "Gerenciamento completo de fluxos de automação",
    linkeds: ["list:flows", "execute:flows", "remove:flows", "create:flows"],
    category: "flows" as PermissionCategory,
  },

  "list:flows": {
    description: "Visualizar fluxos de automação configurados",
    linkeds: [],
    category: "flows" as PermissionCategory,
  },

  "create:flows": {
    description: "Criar e editar fluxos de automação",
    linkeds: ["list:flows"],
    category: "flows" as PermissionCategory,
  },

  "remove:flows": {
    description: "Remover fluxos de automação",
    linkeds: ["list:flows"],
    category: "flows" as PermissionCategory,
  },

  "execute:flows": {
    description: "Ativar e desativar fluxos de automação",
    linkeds: ["list:flows"],
    category: "flows" as PermissionCategory,
  },

  "manage:campaigns": {
    description: "Gerenciamento completo de campanhas de mensagens em massa",
    linkeds: [
      "list:campaigns",
      "create:campaigns",
      "execute:campaigns",
      "remove:campaigns",
    ],
    category: "campaigns" as PermissionCategory,
  },

  "list:campaigns": {
    description: "Visualizar campanhas criadas",
    linkeds: [],
    category: "campaigns" as PermissionCategory,
  },

  "create:campaigns": {
    description: "Criar e editar campanhas de mensagens",
    linkeds: ["list:campaigns", "list:partners"],
    category: "campaigns" as PermissionCategory,
  },

  "execute:campaigns": {
    description: "Iniciar e pausar envio de campanhas",
    linkeds: ["list:campaigns"],
    category: "campaigns" as PermissionCategory,
  },

  "remove:campaigns": {
    description: "Cancelar e excluir campanhas",
    linkeds: ["list:campaigns"],
    category: "campaigns" as PermissionCategory,
  },

  "manage:notifications": {
    description: "Gerenciamento completo de notificações",
    linkeds: ["list:notifications", "mark:notifications"],
    category: "notifications" as PermissionCategory,
  },

  "list:notifications": {
    description: "Receber notificações do sistema",
    linkeds: [],
    category: "notifications" as PermissionCategory,
  },

  "mark:notifications": {
    description: "Marcar notificações como lidas",
    linkeds: ["list:notifications"],
    category: "notifications" as PermissionCategory,
  },

  "view:dashboard": {
    description: "Acessar dashboard com métricas de atendimento e desempenho",
    linkeds: [],
    category: "dashboard" as PermissionCategory,
  },

  "manage:calculator-settings": {
    description: "Configurar taxas da calculadora de pagamento",
    linkeds: [],
    category: "settings" as PermissionCategory,
  },

  "access:outside-working-hours": {
    description: "Acessar o sistema fora do horário de expediente configurado",
    linkeds: [],
    category: "special" as PermissionCategory,
  },

  "manage:meta-settings": {
    description: "Configurar integração com WhatsApp Business e Instagram",
    linkeds: ["manage:connections"],
    category: "system" as PermissionCategory,
  },

  "list:all-sectors": {
    description:
      "Visualizar atendimentos de todos os setores, inclusive os não atribuídos",
    linkeds: ["list:sectors"],
    category: "sectors" as PermissionCategory,
  },

  "view:quick-messages": {
    description: "Usar mensagens rápidas públicas criadas pela equipe",
    linkeds: [],
    category: "templates" as PermissionCategory,
  },

  "create:quick-messages": {
    description: "Criar suas próprias mensagens rápidas (atalhos de texto)",
    linkeds: ["view:quick-messages"],
    category: "templates" as PermissionCategory,
  },

  "manage:quick-messages": {
    description: "Editar mensagens rápidas criadas por outros usuários",
    linkeds: ["create:quick-messages"],
    category: "templates" as PermissionCategory,
  },

  "delete:quick-messages": {
    description: "Excluir mensagens rápidas de outros usuários",
    linkeds: ["manage:quick-messages"],
    category: "templates" as PermissionCategory,
  },

  "view:private-quick-messages": {
    description: "Visualizar mensagens rápidas privadas de outros usuários",
    linkeds: [],
    category: "templates" as PermissionCategory,
  },

  "view:contact-details": {
    description:
      "Visualizar número de telefone e dados sensíveis do contato",
    linkeds: [],
    category: "partners" as PermissionCategory,
  },
} as const;

export type PolicyName = keyof typeof permissionsObj;

export type PermissionDefinition = {
  readonly description: string;
  readonly linkeds: readonly string[];
  readonly category: PermissionCategory;
};

function createPermissionsMap(): Map<PolicyName, PermissionDefinition> {
  const map = new Map<PolicyName, PermissionDefinition>();
  for (const key of Object.keys(permissionsObj)) {
    const policyKey = key as PolicyName;
    const entry = permissionsObj[policyKey];
    map.set(policyKey, {
      description: entry.description,
      linkeds: entry.linkeds,
      category: entry.category,
    });
  }
  return map;
}

export const permissions = createPermissionsMap();

export function getPermissionsByCategory(
  category: PermissionCategory
): PolicyName[] {
  const result: PolicyName[] = [];
  for (const [key, value] of permissions.entries()) {
    if (value.category === category) {
      result.push(key);
    }
  }
  return result;
}

export function getAllPermissionCategories(): PermissionCategory[] {
  return Object.keys(permissionCategories) as PermissionCategory[];
}

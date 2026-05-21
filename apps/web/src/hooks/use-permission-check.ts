import { useMemo } from "react";
import { PolicyName } from "@omnichannel/core/domain/services/permissions";
import { useUserPermissions } from "@/providers/user-permissions-provider";

type UsePermissionCheckOptions = {
  requireAll?: boolean;
};

type UsePermissionCheckReturn = {
  hasPermission: boolean;
  tooltipMessage: string;
};

const PERMISSION_LABELS: Partial<Record<PolicyName, string>> = {
  "manage:users": "Gerenciar usuários",
  "register:users": "Cadastrar usuários",
  "remove:users": "Remover usuários",
  "list:users": "Listar usuários",
  "manage:roles": "Gerenciar perfis",
  "list:roles": "Listar perfis",
  "register:roles": "Cadastrar perfis",
  "remove:roles": "Remover perfis",
  "manage:partners": "Gerenciar clientes",
  "remove:partners": "Remover clientes",
  "list:partners": "Listar clientes",
  "register:partners": "Cadastrar clientes",
  "view:contact-details": "Visualizar dados completos do contato",
  "manage:sectors": "Gerenciar setores",
  "register:sectors": "Cadastrar setores",
  "list:sectors": "Listar setores",
  "list:all-sectors": "Visualizar todos os setores",
  "manage:connections": "Gerenciar canais",
  "register:connections": "Cadastrar canais",
  "start:connections": "Iniciar conexão de canais",
  "remove:connections": "Remover canais",
  "list:connections": "Listar canais",
  "manage:templates": "Gerenciar modelos",
  "register:templates": "Cadastrar modelos",
  "remove:templates": "Remover modelos",
  "list:templates": "Listar modelos",
  "register:permissions": "Gerenciar permissões",
  "manage:conversations": "Gerenciar atendimentos",
  "list:conversation": "Visualizar conversas",
  "list:all-conversations": "Visualizar todas as conversas",
  "list:chat-attendants": "Listar atendentes no chat",
  "list:all-channels": "Visualizar todos os canais",
  "view:whatsapp-groups": "Visualizar grupos do WhatsApp",
  "send:message": "Enviar mensagens",
  "assign:conversation": "Assumir atendimento",
  "transfer:conversation": "Transferir atendimento",
  "create:conversation": "Criar atendimento",
  "close:conversation": "Fechar atendimento",
  "delete:conversation": "Excluir atendimento",
  "manage:flows": "Gerenciar fluxos",
  "list:flows": "Listar fluxos",
  "create:flows": "Criar fluxos",
  "remove:flows": "Remover fluxos",
  "execute:flows": "Executar fluxos",
  "manage:quick-messages": "Gerenciar mensagens rápidas de outros",
  "delete:quick-messages": "Deletar mensagens rápidas de outros",
  "view:private-quick-messages": "Visualizar mensagens rápidas privadas",
  "access:outside-working-hours": "Acessar fora do horário de trabalho",
  "manage:meta-settings": "Gerenciar configurações do Meta",
  "start:session": "Acessar o sistema",
};

export function usePermissionCheck(
  requiredPermissions: PolicyName[],
  options?: UsePermissionCheckOptions
): UsePermissionCheckReturn {
  const { hasPermission: checkPermission } = useUserPermissions();
  const { requireAll = false } = options || {};

  return useMemo(() => {
    const hasPermission = checkPermission(requiredPermissions, requireAll);

    let tooltipMessage = "";
    if (!hasPermission) {
      const permissionLabels = requiredPermissions
        .map((p) => PERMISSION_LABELS[p] || p)
        .join(requireAll ? " e " : " ou ");

      tooltipMessage = requireAll
        ? `Você precisa das seguintes permissões: ${permissionLabels}`
        : `Você precisa de ao menos uma das seguintes permissões: ${permissionLabels}`;
    }

    return {
      hasPermission,
      tooltipMessage,
    };
  }, [requiredPermissions, requireAll, checkPermission]);
}

/**
 * Hook específico para verificar se pode ver dados de contato para um setor
 */
export function useCanViewContactDetails(sectorId?: string | null) {
  const { canViewContactDetailsForSector } = useUserPermissions();

  return useMemo(() => {
    return canViewContactDetailsForSector(sectorId);
  }, [sectorId, canViewContactDetailsForSector]);
}

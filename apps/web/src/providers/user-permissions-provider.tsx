"use client";

import {
  PolicyName,
  permissions as permissionsMap,
} from "@omnichannel/core/domain/services/permissions";
import { User } from "@omnichannel/core/domain/entities/user";
import { createContext, useContext } from "react";

type UserPermissionsContextValue = {
  user: User.Raw | null;
  permissions: Set<PolicyName>;
  /** Setores BLOQUEADOS para view:contact-details. Se vazio, permite todos */
  blockedSectorsForContactDetails: string[];
  hasPermission: (
    requiredPermissions: PolicyName[],
    requireAll?: boolean
  ) => boolean;
  /** Verifica se pode ver dados de contato para um setor específico */
  canViewContactDetailsForSector: (sectorId?: string | null) => boolean;
};

const UserPermissionsContext =
  createContext<UserPermissionsContextValue | null>(null);

type UserPermissionsProviderProps = {
  children: React.ReactNode;
  user: User.Raw | null;
  permissions: PolicyName[];
  /** Setores BLOQUEADOS para view:contact-details. Se vazio, permite todos */
  blockedSectorsForContactDetails?: string[];
};

export function UserPermissionsProvider({
  children,
  user,
  permissions,
  blockedSectorsForContactDetails = [],
}: UserPermissionsProviderProps) {
  const permissionsSet = new Set(permissions);

  const checkPermission = (permission: PolicyName): boolean => {
    if (permissionsSet.has(permission)) return true;

    for (const userPermission of permissionsSet) {
      const permissionDef = permissionsMap.get(userPermission);
      if (permissionDef && permissionDef.linkeds.includes(permission)) {
        return true;
      }
    }
    return false;
  };

  const hasPermission = (
    requiredPermissions: PolicyName[],
    requireAll = false
  ): boolean => {
    if (requiredPermissions.length === 0) return true;

    if (requireAll) {
      return requiredPermissions.every(checkPermission);
    }

    return requiredPermissions.some(checkPermission);
  };

  const canViewContactDetailsForSector = (
    sectorId?: string | null
  ): boolean => {
    // Se não tem a permissão base, não pode ver nada
    if (!checkPermission("view:contact-details")) {
      return false;
    }

    // Se não há restrição de setores (lista vazia), pode ver todos
    if (blockedSectorsForContactDetails.length === 0) {
      return true;
    }

    // Se não tem sectorId (ex: tela de clientes), pode ver
    // pois a restrição é por setor específico
    if (!sectorId) {
      return true;
    }

    // Verifica se o setor NÃO está na lista de bloqueados
    // Se está bloqueado, retorna false; se não está, retorna true
    return !blockedSectorsForContactDetails.includes(sectorId);
  };

  return (
    <UserPermissionsContext.Provider
      value={{
        user,
        permissions: permissionsSet,
        blockedSectorsForContactDetails,
        hasPermission,
        canViewContactDetailsForSector,
      }}
    >
      {children}
    </UserPermissionsContext.Provider>
  );
}

export function useUserPermissions() {
  const context = useContext(UserPermissionsContext);
  if (!context) {
    throw new Error(
      "useUserPermissions must be used within a UserPermissionsProvider"
    );
  }
  return context;
}

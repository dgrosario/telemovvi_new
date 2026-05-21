export type CurrentUser = {
  id: string;
  email: string;
};

export type CurrentWorkspace = {
  id: string;
  permissions: string[];
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return null;
}

export async function getCurrentWorkspace(_workspaceId: string): Promise<CurrentWorkspace | null> {
  return null;
}

export async function assertWorkspaceAccess(workspaceId: string): Promise<CurrentWorkspace> {
  const workspace = await getCurrentWorkspace(workspaceId);
  if (!workspace) {
    throw new Error("Acesso negado ao workspace selecionado.");
  }
  return workspace;
}

export async function assertPermission(workspaceId: string, permission: string): Promise<CurrentWorkspace> {
  const workspace = await assertWorkspaceAccess(workspaceId);
  if (!workspace.permissions.includes(permission) && !workspace.permissions.includes("*")) {
    throw new Error(`Permissão ausente: ${permission}`);
  }
  return workspace;
}

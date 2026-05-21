import bcrypt from "bcrypt";
import "dotenv/config";
import { Membership } from "../../domain/entities/membership";
import { User } from "../../domain/entities/user";
import { SystemVariable } from "../../domain/entities/system-variable";
import { MembershipsDatabaseRepository } from "../repositories/membership-repository";
import { UsersDatabaseRepository } from "../repositories/users-repository";
import { WorkspacesRepository } from "../repositories/workspaces-repository";
import { SystemVariablesDatabaseRepository } from "../repositories/system-variables-repository";
import { RolesDatabaseRepository } from "../repositories/roles-repository";
import { Workspace } from "../../domain/entities/workspace";
import { createDatabaseConnection } from "./index";
import { workspaces } from "./schemas";

const USER_DATA = {
  name: process.env.USER_NAME_STAGING ?? "",
  email: process.env.USER_EMAIL_STAGING ?? "",
  password: bcrypt.hashSync(process.env.USER_PASSWORD_STAGING ?? "", 10),
  thumbnail: null,
};

const usersRepository = UsersDatabaseRepository.instance();
const workspacesRepository = WorkspacesRepository.instance();
const membershipsRepository = MembershipsDatabaseRepository.instance();
const systemVariablesRepository = SystemVariablesDatabaseRepository.instance();
const rolesRepository = RolesDatabaseRepository.instance();

const DEFAULT_SYSTEM_VARIABLES: SystemVariable.CreateProps[] = [
  {
    key: "nome_contato",
    label: "Nome do Contato",
    description: "Nome do contato/cliente na conversa",
    resolverType: "contact_field",
    resolverConfig: { field: "name" },
    isSystem: true,
  },
  {
    key: "primeiro_nome",
    label: "Primeiro Nome",
    description: "Primeiro nome do contato (primeira palavra do nome)",
    resolverType: "contact_field",
    resolverConfig: { field: "firstName" },
    isSystem: true,
  },
  {
    key: "sobrenome",
    label: "Sobrenome",
    description: "Sobrenome do contato (restante do nome apos a primeira palavra)",
    resolverType: "contact_field",
    resolverConfig: { field: "lastName" },
    isSystem: true,
  },
  {
    key: "saudacao",
    label: "Saudacao",
    description: "Bom dia, Boa tarde ou Boa noite baseado no horario de Brasilia",
    resolverType: "time_based",
    resolverConfig: { timezone: "America/Sao_Paulo", type: "greeting" },
    isSystem: true,
  },
  {
    key: "horario",
    label: "Horario Atual",
    description: "Horario atual no formato HH:mm (Brasilia)",
    resolverType: "current_time",
    resolverConfig: { timezone: "America/Sao_Paulo" },
    isSystem: true,
  },
  {
    key: "data",
    label: "Data Atual",
    description: "Data atual no formato DD/MM/YYYY (Brasilia)",
    resolverType: "current_date",
    resolverConfig: { timezone: "America/Sao_Paulo" },
    isSystem: true,
  },
  {
    key: "nome_atendente",
    label: "Nome do Atendente",
    description: "Nome do atendente responsavel pela conversa",
    resolverType: "attendant_field",
    resolverConfig: { field: "name" },
    isSystem: true,
  },
  {
    key: "dia_semana",
    label: "Dia da Semana",
    description: "Dia da semana por extenso (Segunda-feira, Terca-feira, etc)",
    resolverType: "day_of_week",
    resolverConfig: { timezone: "America/Sao_Paulo" },
    isSystem: true,
  },
  {
    key: "protocolo",
    label: "Protocolo",
    description: "Numero/ID da conversa",
    resolverType: "conversation_field",
    resolverConfig: { field: "id" },
    isSystem: true,
  },
  {
    key: "nome_setor",
    label: "Nome do Setor",
    description: "Nome do setor do atendente",
    resolverType: "attendant_field",
    resolverConfig: { field: "sectorName" },
    isSystem: true,
  },
];

async function seedSystemVariables(): Promise<void> {
  console.log("Iniciando seed de variaveis do sistema...");

  for (const props of DEFAULT_SYSTEM_VARIABLES) {
    const existing = await systemVariablesRepository.findByKey(props.key);
    if (!existing) {
      const variable = SystemVariable.create(props);
      await systemVariablesRepository.create(variable);
      console.log(`Variavel criada: ${props.key}`);
    } else {
      console.log(`Variavel ja existe: ${props.key}`);
    }
  }

  console.log("Seed de variaveis do sistema concluido");
}

async function seedSystemRoles(workspaceId: string): Promise<void> {
  console.log("Iniciando seed de perfis do sistema...");

  const existingRoles = await rolesRepository.list(workspaceId);

  if (existingRoles.some((r) => r.isSystem)) {
    console.log("Perfis de sistema ja existem");
    return;
  }

  await rolesRepository.createSystemRolesForWorkspace(workspaceId);
  console.log("Perfis criados: Administrador, Supervisor, Atendente");
  console.log("Seed de perfis do sistema concluido");
}

(async () => {
  const existingUser = await usersRepository.retrieveUserByEmail(USER_DATA.email);
  let workspaceId: string;

  if (!existingUser?.id) {
    const user = User.create({
      email: USER_DATA.email,
      name: USER_DATA.name,
      isDeletable: false,
    });
    const workspace = Workspace.create("Omnichannel");
    workspaceId = workspace.id;
    await workspacesRepository.upsert(workspace);

    // Criar roles de sistema ANTES de criar o admin
    await seedSystemRoles(workspaceId);

    // Buscar o role "Administrador" para copiar suas permissões
    const adminRole = await rolesRepository.findByName(workspaceId, "Administrador");

    const membership = Membership.create(workspace.id, user.id);

    // Atribuir todas as permissões do role Administrador ao admin
    if (adminRole) {
      membership.setPermissions(adminRole.permissions);
      console.log(`Admin atribuido ao perfil Administrador com ${adminRole.permissions.length} permissoes`);
    } else {
      // Fallback: se role não existir (não deveria acontecer)
      console.warn("AVISO: Perfil Administrador nao encontrado, usando permissoes minimas");
      membership.setPermissions([
        "start:session",
        "manage:users",
        "register:permissions",
        "manage:sectors",
      ]);
    }

    await usersRepository.upsert(user);
    await membershipsRepository.upsert(membership);
    await usersRepository.setPassword(user.id, USER_DATA.password);
    console.log("Usuario criado com sucesso");
  } else {
    console.log("Usuario ja existe");
    const db = createDatabaseConnection();
    const allWorkspaces = await db.select().from(workspaces);
    const firstWorkspace = allWorkspaces[0];
    if (!firstWorkspace) {
      console.log("Nenhum workspace encontrado");
      process.exit(1);
    }
    workspaceId = firstWorkspace.id;
    await seedSystemRoles(workspaceId);
  }

  await seedSystemVariables();
  process.exit(0);
})();

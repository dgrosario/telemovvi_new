import bcrypt from "bcrypt";
import "dotenv/config";
import { User } from "../../domain/entities/user";
import { Sector } from "../../domain/entities/sector";
import { Channel } from "../../domain/entities/channel";
import { Partner } from "../../domain/entities/partner";
import { PartnerContact } from "../../domain/entities/partner-contact";
import { Contact } from "../../domain/entities/contact";
import { Attendant } from "../../domain/entities/attendant";
import { Conversation } from "../../domain/entities/conversation";
import { Message } from "../../domain/entities/message";
import { Membership } from "../../domain/entities/membership";
import { Workspace } from "../../domain/entities/workspace";
import { UsersDatabaseRepository } from "../repositories/users-repository";
import { WorkspacesRepository } from "../repositories/workspaces-repository";
import { MembershipsDatabaseRepository } from "../repositories/membership-repository";
import { RolesDatabaseRepository } from "../repositories/roles-repository";
import { SectorsDatabaseRepository } from "../repositories/sectors-respository";
import { ChannelsDatabaseRepository } from "../repositories/channels-repository";
import { PartnersDatabaseRepository } from "../repositories/partners-repository";
import { ConversationsDatabaseRepository } from "../repositories/conversations-repository";
import { MessagesDatabaseRepository } from "../repositories/messages-repository";
import { ChannelInSectorsDatabaseRepository } from "../repositories/channels-in-sectors-repository";
import { createDatabaseConnection } from "./index";
import { workspaces, usersInSector, partners as partnersTable, channels as channelsTable } from "./schemas";
import { eq, and, sql } from "drizzle-orm";
import type { EvolutionChannelPayload, WhatsAppChannelPayload, InstagramChannelPayload } from "../../domain/entities/channel";

const usersRepository = UsersDatabaseRepository.instance();
const workspacesRepository = WorkspacesRepository.instance();
const membershipsRepository = MembershipsDatabaseRepository.instance();
const rolesRepository = RolesDatabaseRepository.instance();
const sectorsRepository = SectorsDatabaseRepository.instance();
const channelsRepository = ChannelsDatabaseRepository.instance();
const partnersRepository = PartnersDatabaseRepository.instance();
const conversationsRepository = ConversationsDatabaseRepository.instance();
const messagesRepository = MessagesDatabaseRepository.instance();
const channelsInSectorsRepository = new ChannelInSectorsDatabaseRepository();

async function getOrCreateWorkspace(): Promise<string> {
  const db = createDatabaseConnection();
  const allWorkspaces = await db.select().from(workspaces);

  if (allWorkspaces.length > 0) {
    return allWorkspaces[0]!.id;
  }

  const workspace = Workspace.create("Omnichannel");
  await workspacesRepository.upsert(workspace);
  return workspace.id;
}

async function seedSectors(workspaceId: string): Promise<Sector[]> {
  console.log("\n[SETORES] Criando setores...");

  const sectorsData = [
    {
      name: "Vendas",
      color: "#10B981",
      workingHoursStart: "08:00:00",
      workingHoursEnd: "18:00:00",
      isDefault: true
    },
    {
      name: "Suporte",
      color: "#3B82F6",
      workingHoursStart: "09:00:00",
      workingHoursEnd: "22:00:00"
    },
    {
      name: "Financeiro",
      color: "#F59E0B",
      workingHoursStart: "08:00:00",
      workingHoursEnd: "17:00:00"
    },
    {
      name: "Atendimento 24h",
      color: "#8B5CF6",
      workingHoursStart: "00:00:00",
      workingHoursEnd: "23:59:59"
    }
  ];

  const existingSectors = await sectorsRepository.list(workspaceId);
  const sectors: Sector[] = [];

  for (const data of sectorsData) {
    const existing = existingSectors.find(s => s.name === data.name);

    if (existing) {
      console.log(`  [SKIP] Setor ja existe: ${existing.name}`);
      sectors.push(Sector.instance(existing));
      continue;
    }

    const sector = Sector.create(data.name);
    sector.color = data.color;
    sector.isDefault = data.isDefault || false;

    if (data.workingHoursStart && data.workingHoursEnd) {
      const { WorkingHours } = await import("../../domain/value-objects/working-hours");
      sector.setWorkingHours(WorkingHours.instance({
        start: data.workingHoursStart,
        end: data.workingHoursEnd
      }));
    }

    await sectorsRepository.upsert(workspaceId, sector);
    sectors.push(sector);
    console.log(`  [OK] Setor criado: ${sector.name}`);
  }

  return sectors;
}

async function seedUsers(workspaceId: string, sectors: Sector[]): Promise<User[]> {
  console.log("\n[USUARIOS] Criando usuarios...");

  const usersData = [
    {
      name: "Administrador",
      email: "admin@omnichannel.local",
      password: "admin123",
      sectorIndex: 0
    },
    {
      name: "Maria Silva",
      email: "maria@omnichannel.local",
      password: "senha123",
      sectorIndex: 0
    },
    {
      name: "João Santos",
      email: "joao@omnichannel.local",
      password: "senha123",
      sectorIndex: 0
    },
    {
      name: "Ana Costa",
      email: "ana@omnichannel.local",
      password: "senha123",
      sectorIndex: 1
    },
    {
      name: "Pedro Oliveira",
      email: "pedro@omnichannel.local",
      password: "senha123",
      sectorIndex: 1
    },
    {
      name: "Carla Souza",
      email: "carla@omnichannel.local",
      password: "senha123",
      sectorIndex: 2
    },
    {
      name: "Roberto Lima",
      email: "roberto@omnichannel.local",
      password: "senha123",
      sectorIndex: 3
    }
  ];

  const users: User[] = [];

  // Buscar roles para atribuir permissões adequadas
  const adminRole = await rolesRepository.findByName(workspaceId, "Administrador");
  const attendantRole = await rolesRepository.findByName(workspaceId, "Atendente");

  for (let i = 0; i < usersData.length; i++) {
    const data = usersData[i];
    if (!data) continue;

    const existingUser = await usersRepository.retrieveUserByEmail(data.email);

    if (existingUser) {
      // Atualizar permissões do usuário existente
      const isFirstUser = i === 0;
      const existingMembership = await membershipsRepository.retrieveByUserIdAndWorkspaceId(existingUser.id, workspaceId);

      if (existingMembership) {
        const targetRole = isFirstUser ? adminRole : attendantRole;
        if (targetRole) {
          existingMembership.setPermissions(targetRole.permissions);
          await membershipsRepository.upsert(existingMembership);
          console.log(`  [UPDATE] ${existingUser.name} atualizado com ${targetRole.permissions.length} permissões`);
        }
      }

      users.push(existingUser);
      continue;
    }

    const user = User.create({
      email: data.email,
      name: data.name,
    });

    const membership = Membership.create(workspaceId, user.id);

    // admin@omnichannel.local (primeiro usuário) será Administrador, os demais serão Atendentes
    const isFirstUser = i === 0;

    if (isFirstUser && adminRole) {
      membership.setPermissions(adminRole.permissions);
      console.log(`  [OK] ${user.name} configurado como Administrador (${adminRole.permissions.length} permissoes)`);
    } else if (!isFirstUser && attendantRole) {
      membership.setPermissions(attendantRole.permissions);
      console.log(`  [OK] ${user.name} configurado como Atendente (${attendantRole.permissions.length} permissoes)`);
    } else {
      // Fallback: permissões mínimas
      const permissions = isFirstUser
        ? (["start:session", "manage:users", "register:permissions", "manage:sectors"] as const)
        : (["start:session", "send:message", "create:conversation", "close:conversation"] as const);
      membership.setPermissions([...permissions]);
      console.log(`  [WARN] ${user.name} configurado com permissoes minimas (${permissions.length} permissoes)`);
    }

    await usersRepository.upsert(user);
    await membershipsRepository.upsert(membership);
    await usersRepository.setPassword(user.id, bcrypt.hashSync(data.password, 10));

    // Associar usuário ao setor via users_in_sectors
    const sector = sectors[data.sectorIndex];
    if (sector) {
      const db = createDatabaseConnection();
      await db.insert(usersInSector).values({
        userId: user.id,
        sectorId: sector.id,
      }).onConflictDoNothing();
      console.log(`  [OK] Usuario associado ao setor: ${sector.name}`);
    }

    users.push(user);
    console.log(`  [OK] Usuario criado: ${user.name} (${user.email})`);
  }

  return users;
}

async function seedChannels(workspaceId: string, sectors: Sector[]): Promise<Channel[]> {
  console.log("\n[CANAIS] Criando canais...");

  const channelsData: Array<{
    name: string;
    type: Channel.Type;
    sectorIndex: number;
    payload: EvolutionChannelPayload | WhatsAppChannelPayload | InstagramChannelPayload;
  }> = [
    {
      name: "WhatsApp Vendas",
      type: "evolution",
      sectorIndex: 0,
      payload: {
        instanceName: "vendas-instance",
        connected: true,
        phoneNumber: "+5511999991111"
      }
    },
    {
      name: "WhatsApp Suporte",
      type: "evolution",
      sectorIndex: 1,
      payload: {
        instanceName: "suporte-instance",
        connected: true,
        phoneNumber: "+5511999992222"
      }
    },
    {
      name: "Instagram Comercial",
      type: "instagram",
      sectorIndex: 0,
      payload: {
        accessToken: "fake-token-instagram",
        pageId: "123456789",
        pageName: "Omnichannel Comercial",
        igUserId: "987654321",
        igUsername: "omnichannel_oficial"
      }
    },
    {
      name: "WhatsApp Cloud API",
      type: "whatsapp",
      sectorIndex: 3,
      payload: {
        accessToken: "fake-token-whatsapp",
        wabaId: "111222333444",
        phoneId: "555666777888",
        phoneNumber: "+5511999993333",
        businessId: "999888777666"
      }
    }
  ];

  const channels: Channel[] = [];

  for (const data of channelsData) {
    const channel = Channel.create(data.name, data.type);
    channel.connected(data.payload, true);

    await channelsRepository.upsert(channel, workspaceId);

    const sector = sectors[data.sectorIndex];
    if (sector) {
      await channelsInSectorsRepository.addRelationsToChannel(channel.id, [sector.id]);
    }

    channels.push(channel);
    console.log(`  [OK] Canal criado: ${channel.name} (${channel.type})`);
  }

  return channels;
}

async function seedPartnersAndContacts(workspaceId: string): Promise<Array<{ partner: Partner; contact: PartnerContact }>> {
  console.log("\n[PARCEIROS] Criando parceiros e contatos...");

  const timestamp = Date.now().toString().slice(-8);

  const partnersData = [
    // Clientes com APENAS WhatsApp (evolution)
    {
      name: "Cliente VIP Silva",
      contacts: [
        { type: "evolution" as const, phone: `+55119${timestamp}01` }
      ]
    },
    {
      name: "José da Silva",
      contacts: [
        { type: "evolution" as const, phone: `+55119${timestamp}03` }
      ]
    },
    {
      name: "Carlos Mendes",
      contacts: [
        { type: "evolution" as const, phone: `+55119${timestamp}06` }
      ]
    },
    {
      name: "Fernanda Santos",
      contacts: [
        { type: "evolution" as const, phone: `+55119${timestamp}09` }
      ]
    },
    {
      name: "Ricardo Alves",
      contacts: [
        { type: "evolution" as const, phone: `+55119${timestamp}11` }
      ]
    },

    // Clientes com APENAS WhatsApp Cloud API
    {
      name: "Maria Oliveira",
      contacts: [
        { type: "whatsapp" as const, phone: `+55119${timestamp}04` }
      ]
    },
    {
      name: "Startup XYZ",
      contacts: [
        { type: "whatsapp" as const, phone: `+55119${timestamp}05` }
      ]
    },
    {
      name: "Tech Solutions Corp",
      contacts: [
        { type: "whatsapp" as const, phone: `+55119${timestamp}10` }
      ]
    },
    {
      name: "Patricia Lima",
      contacts: [
        { type: "whatsapp" as const, phone: `+55119${timestamp}13` }
      ]
    },

    // Clientes com APENAS Instagram
    {
      name: "Distribuidora Norte",
      contacts: [
        { type: "instagram" as const, phone: `+55119${timestamp}07` }
      ]
    },
    {
      name: "Ana Paula Costa",
      contacts: [
        { type: "instagram" as const, phone: `+55119${timestamp}08` }
      ]
    },
    {
      name: "Atacadista Premium",
      contacts: [
        { type: "instagram" as const, phone: `+55119${timestamp}12` }
      ]
    },
    {
      name: "Bruno Costa",
      contacts: [
        { type: "instagram" as const, phone: `+55119${timestamp}15` }
      ]
    },

    // Clientes com MÚLTIPLOS tipos de contato (para testar filtro OR)
    {
      name: "Empresa ABC Multicanal",
      contacts: [
        { type: "evolution" as const, phone: `+55119${timestamp}20` },
        { type: "whatsapp" as const, phone: `+55119${timestamp}21` },
        { type: "instagram" as const, phone: `+55119${timestamp}22` }
      ]
    },
    {
      name: "Comercial Souza & Cia",
      contacts: [
        { type: "evolution" as const, phone: `+55119${timestamp}14` },
        { type: "whatsapp" as const, phone: `+55119${timestamp}23` }
      ]
    },
    {
      name: "Industrias Reunidas",
      contacts: [
        { type: "whatsapp" as const, phone: `+55119${timestamp}16` },
        { type: "instagram" as const, phone: `+55119${timestamp}24` }
      ]
    },
    {
      name: "Consultoria Estrategica",
      contacts: [
        { type: "instagram" as const, phone: `+55119${timestamp}18` },
        { type: "evolution" as const, phone: `+55119${timestamp}25` }
      ]
    },
    {
      name: "Marcos Pereira Multiconta",
      contacts: [
        { type: "whatsapp" as const, phone: `+55119${timestamp}19` },
        { type: "evolution" as const, phone: `+55119${timestamp}26` }
      ]
    },
    {
      name: "Loja do Futuro Premium",
      contacts: [
        { type: "evolution" as const, phone: `+55119${timestamp}27` },
        { type: "instagram" as const, phone: `+55119${timestamp}28` }
      ]
    },
    {
      name: "Juliana Martins VIP",
      contacts: [
        { type: "evolution" as const, phone: `+55119${timestamp}17` },
        { type: "instagram" as const, phone: `+55119${timestamp}29` },
        { type: "whatsapp" as const, phone: `+55119${timestamp}30` }
      ]
    }
  ];

  const partnerContactPairs: Array<{ partner: Partner; contact: PartnerContact }> = [];

  for (const data of partnersData) {
    const partner = Partner.create({
      name: data.name,
      contacts: data.contacts.map(c => ({
        type: c.type,
        value: c.phone
      }))
    });

    await partnersRepository.upsert(partner, workspaceId);

    const persistedPartner = await partnersRepository.retrieve(partner.id);

    if (persistedPartner && persistedPartner.contacts.length > 0) {
      partnerContactPairs.push({
        partner: persistedPartner,
        contact: persistedPartner.contacts[0]!
      });
      const contactTypes = persistedPartner.contacts.map(c => c.type).join(", ");
      console.log(`  [OK] Parceiro criado: ${persistedPartner.name} (${contactTypes})`);
    }
  }

  return partnerContactPairs;
}

async function seedConversationsAndMessages(
  workspaceId: string,
  partnerContactPairs: Array<{ partner: Partner; contact: PartnerContact }>,
  channels: Channel[],
  sectors: Sector[],
  users: User[]
): Promise<void> {
  console.log("\n[CONVERSAS] Criando conversas e mensagens...");

  const statusOptions: Conversation.Status[] = ["open", "waiting", "closed"];
  const now = Date.now();

  // Criar uma conversa específica do Instagram ABERTA e RECENTE
  const instagramChannel = channels.find(c => c.type === "instagram");
  const instagramPartner = partnerContactPairs.find(p => 
    p.contact.type === "instagram"
  );
  
  if (instagramChannel && instagramPartner) {
    const { partner, contact: partnerContact } = instagramPartner;
    const contact = Contact.fromPartner(partner, partnerContact.id);
    const sector = sectors[0]!;
    const user = users[0]!;

    const conversation = Conversation.create(contact, instagramChannel);
    conversation.transferToSector(sector);
    conversation.status = "open";
    conversation.assign(user);
    
    // Definir lastClientMessageCreatedAt para AGORA (dentro da janela de 24h)
    (conversation as any).lastClientMessageCreatedAt = new Date();

    await conversationsRepository.upsert(conversation, workspaceId);

    // Criar mensagens recentes (última mensagem do cliente há 1 hora)
    const oneHourAgo = now - (1 * 60 * 60 * 1000);
    
    const instagramMessages = [
      {
        content: "Olá! Vi seus produtos no Instagram e gostaria de saber mais",
        isFromClient: true,
        time: oneHourAgo - (10 * 60 * 1000) // 1h10min atrás
      },
      {
        content: `Olá ${partner.name}! Que bom que você nos encontrou! Como posso ajudar?`,
        isFromClient: false,
        time: oneHourAgo - (8 * 60 * 1000) // 1h8min atrás
      },
      {
        content: "Vocês têm catálogo de produtos? Podem me enviar fotos?",
        isFromClient: true,
        time: oneHourAgo // 1h atrás (última mensagem do cliente)
      },
      {
        content: "Claro! Vou te enviar algumas imagens dos nossos produtos",
        isFromClient: false,
        time: oneHourAgo - (30 * 1000) // 1h atrás menos 30s
      }
    ];

    for (let j = 0; j < instagramMessages.length; j++) {
      const msgData = instagramMessages[j]!;
      const sender = msgData.isFromClient
        ? contact
        : Attendant.create({ id: user.id, name: user.name });

      const message = Message.create({
        id: `msg-instagram-${conversation.id}-${j}`,
        content: msgData.content,
        createdAt: new Date(msgData.time),
        type: "text",
        sender,
        internal: false
      });

      message.markAsViewed();
      await messagesRepository.upsert(message, conversation.id);
    }

    console.log(`  [OK] Conversa INSTAGRAM criada: ${partner.name} (ABERTA e RECENTE) - ${instagramMessages.length} mensagens`);
  }

  for (let i = 0; i < partnerContactPairs.length; i++) {
    const { partner, contact: partnerContact } = partnerContactPairs[i]!;
    const channel = channels[i % channels.length]!;
    const sector = sectors[i % sectors.length]!;
    const user = users[i % users.length]!;
    const status = statusOptions[i % statusOptions.length]!;

    const contact = Contact.fromPartner(partner, partnerContact.id);

    const daysAgo = Math.floor(i / 2);
    const conversationTime = now - (daysAgo * 24 * 60 * 60 * 1000);

    const conversation = Conversation.create(contact, channel);
    conversation.transferToSector(sector);
    conversation.status = status;

    if (status === "open" || status === "waiting") {
      conversation.assign(user);
    } else if (status === "closed") {
      conversation.assign(user);
      conversation.close();
    }

    await conversationsRepository.upsert(conversation, workspaceId);

    const messagesCount = Math.floor(Math.random() * 11) + 5;

    for (let j = 0; j < messagesCount; j++) {
      const isFromClient = j % 2 === 0;
      const messageTime = conversationTime + (j * 5 * 60 * 1000);

      const messageStatus: Message.Status = (() => {
        if (j < messagesCount - 3) return "viewed";
        if (j < messagesCount - 1) return "delivered";
        return "sent";
      })();

      const messageTexts = isFromClient ? [
        "Olá, gostaria de saber mais informações",
        "Qual o prazo de entrega?",
        "Vocês aceitam cartão?",
        "Obrigado pela atenção!",
        "Quando posso receber?",
        "Tem disponível em estoque?",
        "Qual o valor do frete?",
        "Gostaria de fazer um pedido",
        "Conseguem me enviar o catálogo?",
        "Precisaria de um orçamento",
        "Vocês trabalham com boleto?",
        "Qual o horário de atendimento?",
        "Tem garantia do produto?",
        "Fazem entrega no mesmo dia?",
        "Gostaria de falar com um vendedor"
      ] : [
        `Olá ${partner.name}, como posso ajudar?`,
        "O prazo é de 5 dias úteis",
        "Sim, aceitamos todas as bandeiras",
        "Por nada! Estamos à disposição",
        "Você receberá em até 7 dias úteis",
        "Sim, temos disponível",
        "O frete é calculado pelo CEP",
        "Perfeito! Vou registrar seu pedido",
        "Já estou enviando o catálogo",
        "Vou preparar um orçamento para você",
        "Sim, aceitamos boleto também",
        "Atendemos das 8h às 18h",
        "Temos garantia de 12 meses",
        "Entrega expressa disponível",
        "Vou transferir para um vendedor"
      ];

      const sender = isFromClient
        ? contact
        : Attendant.create({ id: user.id, name: user.name });

      const message = Message.create({
        id: `msg-${conversation.id}-${j}`,
        content: messageTexts[j % messageTexts.length]!,
        createdAt: new Date(messageTime),
        type: "text",
        sender,
        internal: false
      });

      if (messageStatus === "delivered") {
        message.markAsDelivered();
      } else if (messageStatus === "viewed") {
        message.markAsViewed();
      } else if (messageStatus === "sent") {
        message.markAsSent();
      }

      await messagesRepository.upsert(message, conversation.id);
    }

    console.log(`  [OK] Conversa criada: ${partner.name} (${status}) - ${messagesCount} mensagens`);
  }
}

async function associateAdminToSectors(sectors: Sector[]) {
  const adminUser = await usersRepository.retrieveUserByEmail("admin@omnichannel.local");

  if (!adminUser) {
    console.log("\n[SKIP] Admin nao encontrado, pulando associacao ao setor");
    return;
  }

  if (sectors.length === 0) {
    console.log("\n[SKIP] Nenhum setor disponivel para associar ao admin");
    return;
  }

  console.log("\n[ADMIN] Associando admin ao primeiro setor...");

  const firstSector = sectors[0];
  if (firstSector) {
    const db = createDatabaseConnection();
    await db.insert(usersInSector).values({
      userId: adminUser.id,
      sectorId: firstSector.id,
    }).onConflictDoNothing();
    console.log(`  [OK] Admin associado ao setor: ${firstSector.name}`);
  }
}

async function seedSystemRoles(workspaceId: string): Promise<void> {
  console.log("\n[ROLES] Criando perfis do sistema...");

  const existingRoles = await rolesRepository.list(workspaceId);

  if (existingRoles.some((r) => r.isSystem)) {
    console.log("  [SKIP] Perfis de sistema já existem");
    return;
  }

  await rolesRepository.createSystemRolesForWorkspace(workspaceId);
  console.log("  [OK] Perfis criados: Administrador, Supervisor, Atendente");
}

async function seedContactHistory(
  workspaceId: string,
  channels: Channel[],
  sectors: Sector[],
  users: User[]
): Promise<void> {
  console.log("\n[HISTORICO] Criando partner multicanal com historico de conversas...");

  const partnerName = "Fernanda Historico Multicanal";

  const db = createDatabaseConnection();
  const existing = await db
    .select({ id: partnersTable.id })
    .from(partnersTable)
    .where(and(eq(partnersTable.name, partnerName), eq(partnersTable.workspaceId, workspaceId)))
    .limit(1);

  if (existing.length > 0) {
    console.log("  [SKIP] Partner multicanal ja existe, pulando seed de historico");
    return;
  }

  const evolutionChannel = channels.find(c => c.type === "evolution");
  const whatsappChannel = channels.find(c => c.type === "whatsapp");
  const instagramChannel = channels.find(c => c.type === "instagram");

  if (!evolutionChannel || !whatsappChannel || !instagramChannel) {
    console.log("  [SKIP] Canais necessarios nao encontrados (evolution, whatsapp, instagram)");
    return;
  }

  const partner = Partner.create({
    name: partnerName,
    contacts: [
      { type: "evolution", value: "+5511988887701" },
      { type: "whatsapp", value: "+5511988887702" },
      { type: "instagram", value: "+5511988887703" }
    ]
  });

  await partnersRepository.upsert(partner, workspaceId);
  const persisted = await partnersRepository.retrieve(partner.id);

  if (!persisted || persisted.contacts.length < 3) {
    console.log("  [ERRO] Falha ao criar partner multicanal");
    return;
  }

  const evoContact = persisted.contacts.find(c => c.type === "evolution")!;
  const waContact = persisted.contacts.find(c => c.type === "whatsapp")!;
  const igContact = persisted.contacts.find(c => c.type === "instagram")!;

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const MIN = 60 * 1000;

  const conversationsSpec = [
    {
      label: "Primeiro contato - informacao (Evolution)",
      partnerContact: evoContact,
      channel: evolutionChannel,
      status: "closed" as Conversation.Status,
      daysAgo: 30,
      user: users[1]!,
      sector: sectors[0]!,
      messages: [
        { from: "client", text: "Oi, boa tarde! Vi o anuncio de voces e queria saber mais sobre os planos" },
        { from: "attendant", text: "Boa tarde, Fernanda! Que bom que nos encontrou. Temos tres planos disponiveis" },
        { from: "client", text: "Qual o valor do plano basico?" },
        { from: "attendant", text: "O plano basico custa R$ 99,90/mes com atendimento em 1 canal" },
        { from: "client", text: "Tem algum desconto pra pagamento anual?" },
        { from: "attendant", text: "Sim! No anual voce ganha 2 meses gratis, fica R$ 999,00/ano" },
        { from: "client", text: "Vou pensar e volto a falar, obrigada!" },
        { from: "attendant", text: "Perfeito! Fico a disposicao. Ate logo!" }
      ]
    },
    {
      label: "Problema tecnico - suporte (WhatsApp Cloud)",
      partnerContact: waContact,
      channel: whatsappChannel,
      status: "closed" as Conversation.Status,
      daysAgo: 15,
      user: users[2]!,
      sector: sectors[1]!,
      messages: [
        { from: "client", text: "Ola, estou com problema pra acessar o painel" },
        { from: "attendant", text: "Ola Fernanda, sinto muito pelo inconveniente. Pode me dizer qual erro aparece?" },
        { from: "client", text: "Aparece 'sessao expirada' toda hora, mesmo depois de fazer login" },
        { from: "attendant", text: "Entendi. Vou verificar sua conta. Um momento por favor" },
        { from: "attendant", text: "Identifiquei o problema. Havia um conflito de sessao. Ja corrigi do nosso lado" },
        { from: "client", text: "Testei aqui e agora esta funcionando normalmente!" },
        { from: "attendant", text: "Otimo! Caso tenha mais algum problema, pode nos chamar a qualquer momento" },
        { from: "client", text: "Obrigada pelo atendimento rapido!" },
        { from: "attendant", text: "Por nada! Bom uso da plataforma" },
        { from: "client", text: "Ate mais!" }
      ]
    },
    {
      label: "Pergunta sobre promo no Instagram",
      partnerContact: igContact,
      channel: instagramChannel,
      status: "closed" as Conversation.Status,
      daysAgo: 7,
      user: users[3]!,
      sector: sectors[0]!,
      messages: [
        { from: "client", text: "Vi no stories que tem promocao essa semana, e verdade?" },
        { from: "attendant", text: "Oi Fernanda! Sim, estamos com 30% de desconto no plano premium ate sexta" },
        { from: "client", text: "Que legal! Ja sou cliente do basico, consigo fazer upgrade?" },
        { from: "attendant", text: "Claro! O upgrade com desconto fica R$ 139,90/mes. Quer que eu faca a alteracao?" },
        { from: "client", text: "Sim, pode fazer! Mantem o mesmo cartao" },
        { from: "attendant", text: "Pronto, upgrade realizado! Voce ja tem acesso a todos os recursos premium" }
      ]
    },
    {
      label: "Novo pedido via Evolution",
      partnerContact: evoContact,
      channel: evolutionChannel,
      status: "closed" as Conversation.Status,
      daysAgo: 3,
      user: users[4]!,
      sector: sectors[1]!,
      messages: [
        { from: "client", text: "Boa noite! Preciso adicionar mais um numero de WhatsApp ao meu plano" },
        { from: "attendant", text: "Boa noite Fernanda! Claro, no plano premium voce pode adicionar ate 3 numeros" },
        { from: "client", text: "Perfeito, quero adicionar o numero +5511977776666" },
        { from: "attendant", text: "Numero adicionado com sucesso! Agora precisa conectar pelo QR Code no painel" },
        { from: "client", text: "Onde encontro o QR Code?" },
        { from: "attendant", text: "No menu lateral, va em Canais > WhatsApp > Conectar. La aparece o QR Code" },
        { from: "client", text: "Achei! Ja escaneei e esta conectando" },
        { from: "attendant", text: "Otimo! Quando aparecer 'Conectado' esta pronto pra usar" },
        { from: "client", text: "Conectou! Muito obrigada pela ajuda" },
        { from: "attendant", text: "Disponha! Se precisar de mais alguma coisa, e so chamar" },
        { from: "client", text: "Com certeza! Voces sao muito atenciosos" },
        { from: "attendant", text: "Obrigado pelo feedback, Fernanda! Tenha uma otima noite" }
      ]
    },
    {
      label: "Acompanhamento em andamento (WhatsApp Cloud)",
      partnerContact: waContact,
      channel: whatsappChannel,
      status: "open" as Conversation.Status,
      daysAgo: 0,
      user: users[1]!,
      sector: sectors[0]!,
      messages: [
        { from: "client", text: "Ola! Gostaria de saber como esta o meu relatorio mensal" },
        { from: "attendant", text: "Oi Fernanda! Seu relatorio esta sendo gerado, fica pronto ate amanha" },
        { from: "client", text: "Otimo! Pode me enviar por email quando ficar pronto?" },
        { from: "attendant", text: "Claro, vou enviar para o email cadastrado assim que finalizar" },
        { from: "client", text: "Perfeito, obrigada!" }
      ]
    }
  ];

  for (let ci = 0; ci < conversationsSpec.length; ci++) {
    const spec = conversationsSpec[ci]!;
    const contact = Contact.fromPartner(persisted, spec.partnerContact.id);
    const conversation = Conversation.create(contact, spec.channel);

    conversation.transferToSector(spec.sector);
    conversation.assign(spec.user);

    if (spec.status === "closed") {
      conversation.close();
    } else {
      conversation.status = "open";
      (conversation as any).lastClientMessageCreatedAt = new Date();
    }

    await conversationsRepository.upsert(conversation, workspaceId);

    const baseTime = now - spec.daysAgo * DAY;

    for (let mi = 0; mi < spec.messages.length; mi++) {
      const msgSpec = spec.messages[mi]!;
      const isFromClient = msgSpec.from === "client";

      const sender = isFromClient
        ? contact
        : Attendant.create({ id: spec.user.id, name: spec.user.name });

      const message = Message.create({
        id: `msg-history-${ci}-${mi}`,
        content: msgSpec.text,
        createdAt: new Date(baseTime + mi * 3 * MIN),
        type: "text",
        sender,
        internal: false
      });

      if (spec.status === "closed") {
        message.markAsViewed();
      } else if (mi < spec.messages.length - 1) {
        message.markAsDelivered();
      } else {
        message.markAsSent();
      }

      await messagesRepository.upsert(message, conversation.id);
    }

    console.log(`  [OK] Conv ${ci + 1}: ${spec.label} (${spec.status}) - ${spec.messages.length} msgs`);
  }

  console.log(`  [OK] Partner "${partnerName}" criado com 5 conversas em 3 canais`);
}

async function cleanupEvolutionInstances(): Promise<void> {
  console.log("\n[EVOLUTION] Limpando instancias orfas do Evolution API...");

  const evolutionUrl = process.env.EVOLUTION_URL || "http://localhost:8080";
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiKey) {
    console.log("  [SKIP] EVOLUTION_API_KEY nao configurada");
    return;
  }

  try {
    const response = await fetch(`${evolutionUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
    });

    if (!response.ok) {
      console.log(`  [SKIP] Evolution API indisponivel (${response.status})`);
      return;
    }

    const instances = (await response.json()) as Array<{ instance?: { instanceName?: string }; name?: string }>;

    if (instances.length === 0) {
      console.log("  [OK] Nenhuma instancia encontrada");
      return;
    }

    const db = createDatabaseConnection();
    const channelRows = await db
      .select({ instanceName: sql`payload->>'instanceName'` })
      .from(channelsTable)
      .where(eq(channelsTable.type, "evolution"));

    const activeInstanceNames = new Set(
      channelRows
        .map(r => r.instanceName as string | null)
        .filter((name): name is string => !!name)
    );

    let deleted = 0;
    let skipped = 0;
    for (const inst of instances) {
      const name = inst.instance?.instanceName || inst.name;
      if (!name) continue;

      if (activeInstanceNames.has(name)) {
        skipped++;
        console.log(`  [SKIP] Instancia ativa: ${name}`);
        continue;
      }

      const deleteResponse = await fetch(`${evolutionUrl}/instance/delete/${name}`, {
        method: "DELETE",
        headers: { apikey: apiKey },
      });

      if (deleteResponse.ok) {
        deleted++;
        console.log(`  [OK] Instancia orfa deletada: ${name}`);
      }
    }

    console.log(`  [OK] ${deleted} orfas removidas, ${skipped} ativas mantidas`);
  } catch {
    console.log("  [SKIP] Evolution API nao acessivel");
  }
}

async function main() {
  try {
    console.log("[SEED] Iniciando seed de desenvolvimento...\n");

    await cleanupEvolutionInstances();

    const workspaceId = await getOrCreateWorkspace();
    console.log(`[OK] Workspace ID: ${workspaceId}\n`);

    await seedSystemRoles(workspaceId);

    const sectors = await seedSectors(workspaceId);

    await associateAdminToSectors(sectors);

    const users = await seedUsers(workspaceId, sectors);

    const channels = await seedChannels(workspaceId, sectors);

    const partnerContactPairs = await seedPartnersAndContacts(workspaceId);

    await seedConversationsAndMessages(workspaceId, partnerContactPairs, channels, sectors, users);

    await seedContactHistory(workspaceId, channels, sectors, users);

    console.log("\n[OK] Seed de desenvolvimento concluido com sucesso!");
    console.log("\n[RESUMO]");
    console.log(`   - ${sectors.length} setores`);
    console.log(`   - ${users.length} usuarios`);
    console.log(`   - ${channels.length} canais`);
    console.log(`   - ${partnerContactPairs.length} parceiros/contatos`);
    console.log(`   - ${partnerContactPairs.length} conversas com mensagens`);
    console.log("\n[CREDENCIAIS DE TESTE]");
    console.log("   Admin: admin@omnichannel.local / admin123");
    console.log("   Atendentes: senha123 (maria, joao, ana, pedro, carla, roberto)\n");

    process.exit(0);
  } catch (error) {
    console.error("[ERRO] Erro ao executar seed de desenvolvimento:", error);
    process.exit(1);
  }
}

main();

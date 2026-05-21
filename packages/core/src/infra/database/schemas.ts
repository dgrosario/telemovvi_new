import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { Channel, typeChannelsAvailable } from "../../domain/entities/channel";

const channelType = text("type", {
  enum: Array.from(typeChannelsAvailable.values()).map((t) => t.type) as [
    Channel.Type,
  ],
})
  .notNull()
  .default("whatsapp");

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().notNull(),
  name: text("name").notNull(),
});

export const sectors = pgTable(
  "sectors",
  {
    id: uuid("id").primaryKey().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    removed: boolean("removed").notNull().default(false),
    workingHoursStart: time("working_hours_start").notNull().default("08:00:00"),
    workingHoursEnd: time("working_hours_end").notNull().default("19:00:00"),
    color: varchar("color", { length: 7 }).notNull().default("#3B82F6"),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (table) => [index("idx_sectors_workspace_id").on(table.workspaceId)]
);

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().notNull(),
    name: text("name").default("").notNull(),
    payload: jsonb("payload").notNull().default({}),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    status: text("status", { enum: ["connected", "disconnected"] })
      .default("disconnected")
      .notNull(),
    type: channelType,
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [index("idx_channels_workspace_id").on(table.workspaceId)]
);

export const responseChannels = pgTable(
  "response_channels",
  {
    receivedId: uuid("received_id")
      .notNull()
      .references(() => channels.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    responseId: uuid("response_id")
      .notNull()
      .references(() => channels.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [primaryKey({ columns: [table.receivedId, table.responseId] })]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().notNull(),
    name: text("name").default("").notNull(),
    email: text("email").unique().notNull(),
    thumbnail: text("thumbnail").default(""),
    password: text("password").default("").notNull(),
    isDeletable: boolean("is_deletable").notNull().default(true),
    signatureEnabled: boolean("signature_enabled").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    displayName: text("display_name"),
    phone: text("phone"),
    birthDate: date("birth_date", { mode: "string" }),
    address: text("address"),
  }
);

export const usersInSector = pgTable(
  "users_in_sectors",
  {
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    sectorId: uuid("sector_id").references(() => sectors.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    uniqueIndex("unique_user_in_sector").on(table.userId, table.sectorId),
  ]
);

export const channelsInSector = pgTable(
  "channels_in_sectors",
  {
    channelId: uuid("channel_id").references(() => channels.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    sectorId: uuid("sector_id").references(() => sectors.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    uniqueIndex("unique_channel_in_sector").on(table.channelId, table.sectorId),
  ]
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    permissions: text("permissions").array().notNull().default([]),
  },
  (table) => [
    index("idx_memberships_user_id").on(table.userId),
    index("idx_memberships_workspace_id").on(table.workspaceId),
  ]
);

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    isNameCustom: boolean("is_name_custom").default(false).notNull(),
    birthday: date("birthday"),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_partners_workspace_id").on(table.workspaceId),
    index("idx_partners_created_at").on(table.createdAt),
  ]
);

export const partnersMetadata = pgTable(
  "partners_metadata",
  {
    label: text("label").notNull().default(""),
    value: text("value").notNull().default(""),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    uniqueIndex("unique_partner_metadata").on(
      table.partnerId,
      table.label
    ),
  ]
);

export const partnerContacts = pgTable(
  "partner_contacts",
  {
    id: uuid("id").primaryKey().notNull(),
    type: channelType,
    value: text("value").notNull().default(""),
    username: text("username").default(""),
    thumbnail: text("thumbnail").default(""),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    channelId: uuid("channel_id").references(() => channels.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_partner_contacts_partner_id").on(table.partnerId),
    index("idx_partner_contacts_channel_id").on(table.channelId),
    uniqueIndex("unique_partner_contact_value").on(table.partnerId, table.value),
  ]
);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 7 }).notNull().default("#3B82F6"),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_labels_workspace_id").on(table.workspaceId),
    uniqueIndex("labels_workspace_name_unique").on(table.workspaceId, table.name),
  ]
);

export const partnersLabels = pgTable(
  "partners_labels",
  {
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.partnerId, table.labelId] }),
    index("idx_partners_labels_partner_id").on(table.partnerId),
    index("idx_partners_labels_label_id").on(table.labelId),
  ]
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().notNull(),
    channel: uuid("channel").references(() => channels.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    sectorId: uuid("sector_id").references(() => sectors.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    contact: uuid("contact").references(() => partnerContacts.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    attendantId: uuid("attendant_id").references(() => users.id),
    status: varchar("status", {
      length: 10,
      enum: ["open", "closed", "expired", "waiting", "internal"],
    }),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    activeFlowExecutionId: uuid("active_flow_execution_id"),
    flowCompletedAt: timestamp("flow_completed_at"),
    openedAt: timestamp("opened_at"),
    firstOpenedAt: timestamp("first_opened_at"),
    closedAt: timestamp("closed_at"),
    receivedChannelId: uuid("received_channel_id").references(() => channels.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    conversationType: varchar("conversation_type", {
      length: 20,
      enum: ["external", "direct", "group", "whatsapp-group"],
    })
      .notNull()
      .default("external"),
    name: varchar("name", { length: 255 }),
    groupJid: varchar("group_jid", { length: 50 }),
  },
  (table) => [
    index("idx_conversations_workspace_id").on(table.workspaceId),
    index("idx_conversations_status").on(table.status),
    index("idx_conversations_workspace_status").on(
      table.workspaceId,
      table.status
    ),
    index("idx_conversations_attendant_id").on(table.attendantId),
    index("idx_conversations_type").on(table.conversationType),
    index("idx_conversations_group_jid").on(table.groupJid),
    index("idx_conversations_sector_id").on(table.sectorId),
    index("idx_conversations_workspace_sector").on(
      table.workspaceId,
      table.sectorId
    ),
    uniqueIndex("idx_conversations_unique_open_contact")
      .on(table.channel, table.contact)
      .where(
        sql`${table.status} IN ('open', 'waiting') AND ${table.contact} IS NOT NULL`
      ),
    uniqueIndex("idx_conversations_unique_whatsapp_group")
      .on(table.workspaceId, table.channel, table.groupJid)
      .where(sql`${table.conversationType} = 'whatsapp-group'`),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey().notNull(),
    content: text("content").notNull(),
    originalContent: text("original_content"),
    caption: text("caption"),
    filename: text("filename"),
    mimetype: text("mimetype"),
    mediaKey: text("media_key"),
    mediaPath: varchar("media_path", { length: 500 }),
    createdAt: integer("created_at").notNull(),
    viewedAt: integer("viewed_at"),
    deletedAt: integer("deleted_at"),
    editedAt: integer("edited_at"),
    type: varchar("type", {
      enum: ["text", "audio", "image", "document", "sticker", "video", "template", "location"],
      length: 15,
    }),
    templateName: text("template_name"),
    status: text("status", {
      enum: ["sent", "senting", "viewed", "delivered", "failed"],
    })
      .default("senting")
      .notNull(),
    senderType: varchar("sender_type", {
      length: 10,
      enum: ["attendant", "contact"],
    }),
    senderName: text("sender_name").notNull().default(""),
    senderId: text("sender_id").notNull(),
    internal: boolean("internal").notNull().default(false),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    quotedMessageId: text("quoted_message_id"),
    remoteJid: varchar("remote_jid", { length: 255 }),
  },
  (table) => [
    index("idx_messages_conversation_id").on(table.conversationId),
    index("idx_messages_created_at").on(table.createdAt),
  ]
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    reactorType: varchar("reactor_type", {
      length: 10,
      enum: ["attendant", "contact"],
    }).notNull(),
    reactorId: text("reactor_id").notNull(),
    reactorName: text("reactor_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_reactions_message_id").on(table.messageId),
    uniqueIndex("unique_reaction").on(table.messageId, table.reactorId, table.emoji),
  ]
);

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().notNull(),
    name: text("name").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    language: varchar("language", {
      length: 10,
      enum: ["pt_BR", "en_US"],
    }).notNull(),
    category: text("category").notNull(),
    text: text("text").notNull(),

    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [index("idx_templates_channel_id").on(table.channelId)]
);

export const flows = pgTable(
  "flows",
  {
    id: uuid("id").primaryKey().notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    status: text("status", { enum: ["active", "inactive", "draft"] })
      .notNull()
      .default("draft"),
    nodes: jsonb("nodes").notNull().default([]),
    connections: jsonb("connections").notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_flows_workspace_id").on(table.workspaceId),
    index("idx_flows_status").on(table.status),
  ]
);

export const flowsInChannels = pgTable(
  "flows_in_channels",
  {
    flowId: uuid("flow_id")
      .references(() => flows.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    channelId: uuid("channel_id")
      .references(() => channels.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
  },
  (table) => [
    uniqueIndex("unique_flow_in_channel").on(table.flowId, table.channelId),
  ]
);

export const flowsInSectors = pgTable(
  "flows_in_sectors",
  {
    flowId: uuid("flow_id")
      .references(() => flows.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    sectorId: uuid("sector_id")
      .references(() => sectors.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
  },
  (table) => [
    uniqueIndex("unique_flow_in_sector").on(table.flowId, table.sectorId),
  ]
);

export const flowExecutions = pgTable(
  "flow_executions",
  {
    id: uuid("id").primaryKey().notNull(),
    flowId: uuid("flow_id")
      .notNull()
      .references(() => flows.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    currentNodeId: text("current_node_id"),
    status: text("status", {
      enum: ["running", "completed", "failed", "paused"],
    })
      .notNull()
      .default("running"),
    variables: jsonb("variables").notNull().default({}),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    failedAt: timestamp("failed_at"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_flow_executions_conversation_id").on(table.conversationId),
    index("idx_flow_executions_status").on(table.status),
  ]
);

export const flowExecutionLogs = pgTable("flow_execution_logs", {
  id: uuid("id").primaryKey().notNull(),
  executionId: uuid("execution_id")
    .notNull()
    .references(() => flowExecutions.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  nodeId: text("node_id").notNull(),
  status: text("status", { enum: ["success", "failed"] })
    .notNull()
    .default("success"),
  input: jsonb("input"),
  output: jsonb("output"),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

export const quickMessages = pgTable(
  "quick_messages",
  {
    id: uuid("id").primaryKey().notNull(),
    shortcode: varchar("shortcode", { length: 50 }).notNull(),
    message: text("message").notNull(),
    mediaUrl: text("media_url"),
    mediaType: varchar("media_type", { length: 20 }),
    mediaName: varchar("media_name", { length: 255 }),
    isPublic: boolean("is_public").notNull().default(false),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_shortcode_per_user_workspace").on(
      table.shortcode,
      table.userId,
      table.workspaceId
    ),
  ]
);

export const processedMessages = pgTable(
  "processed_messages",
  {
    messageId: varchar("message_id", { length: 256 }).notNull(),
    instanceName: varchar("instance_name", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    processedAt: timestamp("processed_at").defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.instanceName] })]
);

export const systemVariables = pgTable(
  "system_variables",
  {
    id: uuid("id").primaryKey().notNull(),
    key: varchar("key", { length: 100 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    description: text("description"),
    resolverType: varchar("resolver_type", { length: 50 }).notNull(),
    resolverConfig: jsonb("resolver_config").notNull().default({}),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_variable_key_per_workspace").on(
      table.key,
      table.workspaceId
    ),
  ]
);

export const internalConversationParticipants = pgTable(
  "internal_conversation_participants",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", {
      length: 20,
      enum: ["admin", "member"],
    })
      .notNull()
      .default("member"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    leftAt: timestamp("left_at"),
  },
  (table) => [
    uniqueIndex("unique_participant").on(table.conversationId, table.userId),
    index("idx_participants_conversation").on(table.conversationId),
    index("idx_participants_user").on(table.userId),
  ]
);

export const metaAppSettings = pgTable(
  "meta_app_settings",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    channelType: varchar("channel_type", { length: 20 }).notNull().unique(),
    appId: varchar("app_id", { length: 100 }).notNull(),
    appSecret: text("app_secret").notNull(),
    configId: varchar("config_id", { length: 100 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_meta_app_settings_channel_type").on(table.channelType),
    index("idx_meta_app_settings_is_active").on(table.isActive),
  ]
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    permissions: text("permissions").array().notNull().default([]),
    blockedSectorIds: uuid("blocked_sector_ids").array().notNull().default([]),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_roles_workspace_id").on(table.workspaceId),
    uniqueIndex("unique_role_name_per_workspace").on(
      table.workspaceId,
      table.name
    ),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: varchar("type", {
      length: 50,
      enum: [
        "conversation:assigned",
        "internal:message",
        "transfer:requested",
        "channel:new-message",
      ],
    }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    recipientType: varchar("recipient_type", {
      length: 20,
      enum: ["user", "sector", "workspace"],
    }).notNull(),
    recipientId: uuid("recipient_id").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),
    priority: varchar("priority", {
      length: 10,
      enum: ["low", "normal", "high"],
    })
      .notNull()
      .default("normal"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    index("idx_notifications_workspace_id").on(table.workspaceId),
    index("idx_notifications_recipient").on(table.recipientType, table.recipientId),
    index("idx_notifications_is_read").on(table.isRead),
    index("idx_notifications_created_at").on(table.createdAt),
    index("idx_notifications_type").on(table.type),
    index("idx_notifications_recipient_unread").on(
      table.recipientType,
      table.recipientId,
      table.isRead
    ),
  ]
);

export const userNotificationSettings = pgTable(
  "user_notification_settings",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    realtimeEnabled: boolean("realtime_enabled").notNull().default(true),
    showFloatingButton: boolean("show_floating_button").notNull().default(true),
    showAllConversations: boolean("show_all_conversations").notNull().default(false),
    enabledTypes: text("enabled_types")
      .array()
      .notNull()
      .default([
        "conversation:assigned",
        "internal:message",
        "transfer:requested",
        "channel:new-message",
      ]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_user_notification_settings").on(
      table.userId,
      table.workspaceId
    ),
    index("idx_user_notification_settings_user_id").on(table.userId),
  ]
);

export const starredMessages = pgTable(
  "starred_messages",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    starredAt: timestamp("starred_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_user_starred_message").on(table.userId, table.messageId),
    index("idx_starred_messages_user_id").on(table.userId),
    index("idx_starred_messages_conversation_id").on(table.conversationId),
  ]
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", {
      length: 20,
      enum: ["manual", "birthday"],
    })
      .notNull()
      .default("manual"),
    status: varchar("status", {
      length: 20,
      enum: ["draft", "scheduled", "running", "completed", "cancelled", "failed"],
    })
      .notNull()
      .default("draft"),
    filterLabelIds: uuid("filter_label_ids").array().default([]),
    minIntervalMs: integer("min_interval_ms").notNull().default(5000),
    maxIntervalMs: integer("max_interval_ms").notNull().default(30000),
    scheduledAt: timestamp("scheduled_at"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_campaigns_workspace_id").on(table.workspaceId),
    index("idx_campaigns_status").on(table.status),
    index("idx_campaigns_type").on(table.type),
    index("idx_campaigns_scheduled_at").on(table.scheduledAt),
    index("idx_campaigns_created_at").on(table.createdAt),
  ]
);

export const campaignMessages = pgTable(
  "campaign_messages",
  {
    id: uuid("id").primaryKey().notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    variationLabel: varchar("variation_label", { length: 1 }).notNull(),
    type: varchar("type", {
      length: 15,
      enum: ["text", "template"],
    })
      .notNull()
      .default("text"),
    content: text("content"),
    templateName: varchar("template_name", { length: 255 }),
    variables: jsonb("variables").default([]),
    sentCount: integer("sent_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_campaign_messages_campaign_id").on(table.campaignId),
    uniqueIndex("unique_campaign_variation").on(table.campaignId, table.variationLabel),
  ]
);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").primaryKey().notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    partnerContactId: uuid("partner_contact_id")
      .notNull()
      .references(() => partnerContacts.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    messageId: uuid("message_id").references(() => campaignMessages.id, {
      onDelete: "set null",
    }),
    status: varchar("status", {
      length: 20,
      enum: ["pending", "sent", "failed", "skipped"],
    })
      .notNull()
      .default("pending"),
    externalMessageId: text("external_message_id"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_campaign_recipients_campaign_id").on(table.campaignId),
    index("idx_campaign_recipients_status").on(table.status),
    index("idx_campaign_recipients_partner_contact_id").on(table.partnerContactId),
    uniqueIndex("unique_campaign_recipient").on(table.campaignId, table.partnerContactId),
  ]
);

export const calculatorSettings = pgTable(
  "calculator_settings",
  {
    id: uuid("id").primaryKey().notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    installmentNumber: integer("installment_number").notNull(),
    interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_calculator_settings_workspace_id").on(table.workspaceId),
    uniqueIndex("unique_calculator_settings_workspace_installment").on(
      table.workspaceId,
      table.installmentNumber
    ),
  ]
);

export const sectorPermissions = pgTable(
  "sector_permissions",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sectorId: uuid("sector_id")
      .notNull()
      .references(() => sectors.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    permission: varchar("permission", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_sector_permissions_user_id").on(table.userId),
    index("idx_sector_permissions_sector_id").on(table.sectorId),
    uniqueIndex("unique_sector_permission").on(
      table.userId,
      table.sectorId,
      table.permission
    ),
  ]
);

// Payment Plans - Planos de pagamento (ex: Visa/Master, Elo)
export const paymentPlans = pgTable(
  "payment_plans",
  {
    id: uuid("id").primaryKey().notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_payment_plans_workspace_id").on(table.workspaceId),
  ]
);

// Payment Plan Installments - Parcelas de cada plano
export const paymentPlanInstallments = pgTable(
  "payment_plan_installments",
  {
    id: uuid("id").primaryKey().notNull(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => paymentPlans.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    installmentNumber: integer("installment_number").notNull(),
    interestRate: numeric("interest_rate", { precision: 5, scale: 2 }).notNull(),
    additionalFee: numeric("additional_fee", { precision: 5, scale: 2 }).notNull().default("0"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_payment_plan_installments_plan_id").on(table.planId),
    uniqueIndex("unique_plan_installment").on(table.planId, table.installmentNumber),
  ]
);

// Calculator Messages - Mensagem customizável do rodapé
export const inboundMessageLogs = pgTable(
  "inbound_message_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 50 }).notNull(),
    instanceName: varchar("instance_name", { length: 255 }).notNull(),
    messageId: varchar("message_id", { length: 500 }),
    event: varchar("event", { length: 100 }).notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
    processed: boolean("processed").default(false),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_inbound_message_logs_source_created").on(
      table.source,
      table.createdAt
    ),
    index("idx_inbound_message_logs_message_id").on(table.messageId),
    index("idx_inbound_message_logs_created_at").on(table.createdAt),
  ]
);

export const calculatorMessages = pgTable(
  "calculator_messages",
  {
    id: uuid("id").primaryKey().notNull(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .unique(),
    footerMessage: text("footer_message").notNull().default("Valores sujeitos a alteração. Consulte condições."),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }
);

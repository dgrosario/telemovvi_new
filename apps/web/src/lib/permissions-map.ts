import { PolicyName } from "@omnichannel/core/domain/services/permissions";

export const PERMISSION_MAPPINGS = {
  users: {
    create: ["manage:users", "register:users"] as PolicyName[],
    edit: ["manage:users", "register:users"] as PolicyName[],
    remove: ["manage:users", "remove:users"] as PolicyName[],
    viewAll: ["list:users"] as PolicyName[],
    managePermissions: ["manage:users", "register:permissions"] as PolicyName[],
  },
  sectors: {
    create: ["manage:sectors", "register:sectors"] as PolicyName[],
    edit: ["manage:sectors", "register:sectors"] as PolicyName[],
    remove: ["manage:sectors", "remove:sectors"] as PolicyName[],
    viewAll: ["list:sectors", "list:all-sectors"] as PolicyName[],
  },
  partners: {
    create: ["manage:partners"] as PolicyName[],
    edit: ["manage:partners"] as PolicyName[],
    remove: ["manage:partners", "remove:partners"] as PolicyName[],
    viewAll: ["list:partners"] as PolicyName[],
  },
  channels: {
    create: ["manage:connections", "register:connections"] as PolicyName[],
    edit: ["manage:connections"] as PolicyName[],
    remove: ["manage:connections"] as PolicyName[],
    viewAll: ["manage:connections", "list:connections"] as PolicyName[],
  },
  templates: {
    create: ["manage:templates"] as PolicyName[],
    edit: ["manage:templates"] as PolicyName[],
    remove: ["manage:templates", "remove:templates"] as PolicyName[],
    viewAll: ["manage:templates", "list:templates"] as PolicyName[],
  },
  quickMessages: {
    create: ["create:quick-messages"] as PolicyName[],
    edit: ["create:quick-messages"] as PolicyName[],
    remove: ["create:quick-messages"] as PolicyName[],
    viewAll: ["view:quick-messages", "create:quick-messages"] as PolicyName[],
    manageOthers: ["manage:quick-messages"] as PolicyName[],
    deleteOthers: ["delete:quick-messages"] as PolicyName[],
    viewPrivate: ["view:private-quick-messages"] as PolicyName[],
  },
  roles: {
    create: ["manage:roles", "register:roles"] as PolicyName[],
    edit: ["manage:roles", "register:roles"] as PolicyName[],
    remove: ["manage:roles", "remove:roles"] as PolicyName[],
    viewAll: ["list:roles"] as PolicyName[],
  },
  variables: {
    create: ["manage:templates"] as PolicyName[],
    edit: ["manage:templates"] as PolicyName[],
    remove: ["manage:templates"] as PolicyName[],
    viewAll: ["manage:templates"] as PolicyName[],
  },
  dashboard: {
    view: ["view:dashboard"] as PolicyName[],
  },
  labels: {
    create: ["manage:labels", "register:labels"] as PolicyName[],
    edit: ["manage:labels", "register:labels"] as PolicyName[],
    remove: ["manage:labels", "remove:labels"] as PolicyName[],
    viewAll: ["manage:labels", "list:labels"] as PolicyName[],
  },
  conversations: {
    viewAll: ["list:all-conversations"] as PolicyName[],
    viewOwn: ["list:conversation"] as PolicyName[],
    viewGroups: ["view:whatsapp-groups"] as PolicyName[],
    viewAllSectors: ["list:all-sectors"] as PolicyName[],
    viewAllChannels: ["list:all-channels"] as PolicyName[],
    send: ["send:message"] as PolicyName[],
    sendInternalComment: ["send:internal-comment"] as PolicyName[],
    bypassAttendance: ["bypass:attendance-to-send"] as PolicyName[],
  },
} as const;

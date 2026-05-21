import { ExecutionContext } from "./types";

/**
 * Escapa caracteres especiais de regex para prevenir ReDoS
 */
function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Substitui variáveis em uma string de conteúdo usando o contexto de execução.
 *
 * Suporta variáveis:
 * - Sistema: {{system.var}}
 * - Fluxo: {{flow.var}} ou {{var}}
 * - Contexto: {{user.phone}}, {{contact.name}}, {{partner.email}}, etc
 * - Mensagem: {{user.message}}
 * - Canal: {{conversation.channel}}
 *
 * @param content - String com variáveis no formato {{var}}
 * @param context - Contexto de execução do fluxo
 * @returns String com variáveis substituídas
 */
export function replaceVariables(content: string, context: ExecutionContext): string {
  let result = content;

  // 1. Substituir variáveis de sistema primeiro
  for (const [key, value] of Object.entries(context.resolvedSystemVariables)) {
    const escapedKey = escapeRegexChars(key);
    const regex = new RegExp(`{{${escapedKey}}}`, "gi");
    result = result.replace(regex, value);
  }

  // 2. Substituir variáveis locais do fluxo (com e sem prefixo flow.)
  for (const [key, value] of Object.entries(context.flowExecution.variables)) {
    // Pular variáveis internas (começam com _)
    if (key.startsWith("_")) continue;

    const escapedKey = escapeRegexChars(key);
    // Substituir com prefixo flow. (ex: {{flow.cpf}})
    const regexWithPrefix = new RegExp(`{{flow\\.${escapedKey}}}`, "gi");
    result = result.replace(regexWithPrefix, String(value));
    // Substituir sem prefixo (ex: {{cpf}})
    const regexWithoutPrefix = new RegExp(`{{${escapedKey}}}`, "gi");
    result = result.replace(regexWithoutPrefix, String(value));
  }

  // 3. Substituir variáveis de contexto da conversa
  if (context.conversation.contact) {
    // user.phone e contact.phone
    if (context.conversation.contact.value) {
      result = result.replace(/{{user\.phone}}/gi, context.conversation.contact.value);
      result = result.replace(/{{contact\.phone}}/gi, context.conversation.contact.value);
    }
    // contact.name e partner.name
    if (context.conversation.contact.name) {
      result = result.replace(/{{contact\.name}}/gi, context.conversation.contact.name);
      result = result.replace(/{{partner\.name}}/gi, context.conversation.contact.name);
    }
    // partner.tags (legacy - deprecated)
    result = result.replace(/{{partner\.tags}}/gi, "");
  }

  // 4. Substituir user.message
  if (context.userMessage) {
    result = result.replace(/{{user\.message}}/gi, context.userMessage);
  }

  // 5. Substituir conversation.channel
  if (context.channel?.type) {
    result = result.replace(/{{conversation\.channel}}/gi, context.channel.type);
  }

  // 6. Substituir partner.email (vem do partnerMetadata)
  if (context.partnerMetadata?.email) {
    result = result.replace(/{{partner\.email}}/gi, context.partnerMetadata.email);
  } else {
    result = result.replace(/{{partner\.email}}/gi, "");
  }

  return result;
}

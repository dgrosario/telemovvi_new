"use server";

import { z } from "zod";
import { securityProcedure } from "../procedure";
import { ConversationsDatabaseRepository } from "@omnichannel/core/infra/repositories/conversations-repository";
import { ChannelsDatabaseRepository } from "@omnichannel/core/infra/repositories/channels-repository";
import { PartnersDatabaseRepository } from "@omnichannel/core/infra/repositories/partners-repository";
import { getPayloadProperty } from "@omnichannel/core/domain/entities/channel";

const conversationsRepository = ConversationsDatabaseRepository.instance();
const channelsRepository = ChannelsDatabaseRepository.instance();
const partnersRepository = PartnersDatabaseRepository.instance();

const fetchProfilePictureSchema = z.object({
  conversationId: z.string().uuid(),
});

export interface FetchProfilePictureResult {
  success: boolean;
  profilePictureUrl: string | null;
  error?: string;
}

export const fetchProfilePicture = securityProcedure()
  .input(fetchProfilePictureSchema)
  .handler(async ({ input }): Promise<FetchProfilePictureResult> => {
    const conversation = await conversationsRepository.retrieve(
      input.conversationId
    );

    if (!conversation) {
      return {
        success: false,
        profilePictureUrl: null,
        error: "Conversa não encontrada",
      };
    }

    if (!conversation.channel) {
      return {
        success: false,
        profilePictureUrl: null,
        error: "Canal não encontrado na conversa",
      };
    }

    if (conversation.channel.type !== "evolution") {
      return {
        success: false,
        profilePictureUrl: null,
        error: "Apenas canais Evolution suportam busca de foto de perfil",
      };
    }

    const channel = await channelsRepository.retrieve(conversation.channel.id);

    if (!channel) {
      return {
        success: false,
        profilePictureUrl: null,
        error: "Canal não encontrado",
      };
    }

    const instanceName = getPayloadProperty(channel.payload, "instanceName");

    if (!instanceName) {
      return {
        success: false,
        profilePictureUrl: null,
        error: "instanceName não encontrado no canal",
      };
    }

    if (!conversation.contact) {
      return {
        success: false,
        profilePictureUrl: null,
        error: "Contato não encontrado na conversa",
      };
    }

    const contactValue = conversation.contact.value;

    if (!contactValue) {
      return {
        success: false,
        profilePictureUrl: null,
        error: "Número do contato não encontrado",
      };
    }

    const gatewayUrl = process.env.OMNI_GATEWAY_URL || "http://localhost:3001";

    try {
      const response = await fetch(
        `${gatewayUrl}/api/contacts/${encodeURIComponent(contactValue)}/profile-picture?instanceName=${encodeURIComponent(instanceName)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          profilePictureUrl: null,
          error:
            errorData.message ||
            `Erro ao buscar foto de perfil: ${response.status}`,
        };
      }

      const data = (await response.json()) as {
        profilePictureUrl: string | null;
      };

      if (data.profilePictureUrl && conversation.contact.id) {
        await partnersRepository.updateContactThumbnail(
          conversation.contact.id,
          data.profilePictureUrl
        );
      }

      return {
        success: true,
        profilePictureUrl: data.profilePictureUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido";
      return {
        success: false,
        profilePictureUrl: null,
        error: `Erro ao buscar foto de perfil: ${errorMessage}`,
      };
    }
  });

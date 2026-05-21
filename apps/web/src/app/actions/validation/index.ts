"use server";

import { z } from "zod";
import { securityProcedure } from "../procedure";
import { ChannelsDatabaseRepository } from "@omnichannel/core/infra/repositories/channels-repository";
import { getPayloadProperty } from "@omnichannel/core/domain/entities/channel";

const channelsRepository = ChannelsDatabaseRepository.instance();

const validateWhatsAppNumbersSchema = z.object({
  instanceName: z.string().min(1, "instanceName is required").optional(),
  numbers: z.array(z.string().min(10, "Invalid phone number")).min(1).max(50),
});

export interface ValidationResult {
  number: string;
  exists: boolean;
  jid: string;
}

async function getEvolutionInstanceName(workspaceId: string): Promise<string | null> {
  const channels = await channelsRepository.list(workspaceId, "evolution");
  const connectedChannel = channels.find((c) => c.status === "connected");

  if (!connectedChannel) {
    return null;
  }

  return getPayloadProperty(connectedChannel.payload, "instanceName") ?? null;
}

export const validateWhatsAppNumbers = securityProcedure()
  .input(validateWhatsAppNumbersSchema)
  .handler(async ({ input, ctx }): Promise<ValidationResult[]> => {
    let instanceName: string | undefined = input.instanceName;

    if (!instanceName) {
      const foundInstance = await getEvolutionInstanceName(ctx.membership.workspaceId);
      instanceName = foundInstance ?? undefined;

      if (!instanceName) {
        throw new Error(
          "Nenhum canal Evolution conectado encontrado. Conecte um canal WhatsApp para validar números."
        );
      }
    }

    const gatewayUrl = process.env.OMNI_GATEWAY_URL || "http://localhost:3001";

    const response = await fetch(`${gatewayUrl}/api/validate/whatsapp-numbers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instanceName,
        numbers: input.numbers,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Erro ao validar numeros: ${response.status}`
      );
    }

    const data = await response.json();
    return data.results as ValidationResult[];
  });

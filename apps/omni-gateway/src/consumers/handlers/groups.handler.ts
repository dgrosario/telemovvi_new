import { Injectable } from "@nestjs/common";
import { MainDatabaseService } from "../../database/main-database.service";
import { EvolutionApiService } from "../../channel-apis/evolution-api.service";
import {
  GatewayRequest,
  GatewayResponse,
  GroupInfoPayload,
  GroupInfoResponse,
  GroupParticipantsPayload,
  GroupParticipantsResponse,
  GroupPicturePayload,
  GroupPictureResponse,
} from "../interfaces/gateway-request.interface";
import { BaseHandler } from "./base.handler";

@Injectable()
export class GroupsHandler extends BaseHandler {
  constructor(
    mainDatabaseService: MainDatabaseService,
    private readonly evolutionApi: EvolutionApiService
  ) {
    super(mainDatabaseService, GroupsHandler.name);
  }

  async handleInfo(request: GatewayRequest<GroupInfoPayload>): Promise<GatewayResponse<GroupInfoResponse>> {
    const { correlationId, channelId, payload } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return { correlationId, success: false, error: "Channel not found" };
    }

    if (channel.type !== "evolution") {
      return { correlationId, success: false, error: "Group info only supported for Evolution channels" };
    }

    const instanceName = (channel.payload as { instanceName?: string }).instanceName;
    if (!instanceName) {
      return { correlationId, success: false, error: "Instance name not found" };
    }

    const groupInfo = await this.evolutionApi.fetchGroupInfo(instanceName, payload.groupJid);

    if (!groupInfo) {
      return { correlationId, success: false, error: "Group not found" };
    }

    // Fetch group picture
    const pictureUrl = await this.evolutionApi.fetchGroupPictureUrl(instanceName, payload.groupJid);

    return {
      correlationId,
      success: true,
      data: {
        id: groupInfo.id,
        subject: groupInfo.subject,
        description: groupInfo.desc ?? null,
        owner: groupInfo.owner ?? null,
        size: groupInfo.size,
        creation: groupInfo.creation ?? null,
        pictureUrl,
        participants: groupInfo.participants.map((p) => ({
          id: p.id,
          admin: p.admin ?? null,
        })),
      },
    };
  }

  async handleParticipants(request: GatewayRequest<GroupParticipantsPayload>): Promise<GatewayResponse<GroupParticipantsResponse>> {
    const { correlationId, channelId, payload } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return { correlationId, success: false, error: "Channel not found" };
    }

    if (channel.type !== "evolution") {
      return { correlationId, success: false, error: "Group participants only supported for Evolution channels" };
    }

    const instanceName = (channel.payload as { instanceName?: string }).instanceName;
    if (!instanceName) {
      return { correlationId, success: false, error: "Instance name not found" };
    }

    const participants = await this.evolutionApi.fetchGroupParticipants(instanceName, payload.groupJid);

    if (!participants) {
      return { correlationId, success: false, error: "Failed to fetch participants" };
    }

    return {
      correlationId,
      success: true,
      data: {
        participants: participants.map((p) => ({
          id: p.id,
          admin: p.admin ?? null,
        })),
      },
    };
  }

  async handlePicture(request: GatewayRequest<GroupPicturePayload>): Promise<GatewayResponse<GroupPictureResponse>> {
    const { correlationId, channelId, payload } = request;

    const channel = await this.getChannelById(channelId);
    if (!channel) {
      return { correlationId, success: false, error: "Channel not found" };
    }

    if (channel.type !== "evolution") {
      return { correlationId, success: false, error: "Group picture only supported for Evolution channels" };
    }

    const instanceName = (channel.payload as { instanceName?: string }).instanceName;
    if (!instanceName) {
      return { correlationId, success: false, error: "Instance name not found" };
    }

    const pictureUrl = await this.evolutionApi.fetchGroupPictureUrl(instanceName, payload.groupJid);

    return {
      correlationId,
      success: true,
      data: {
        pictureUrl,
      },
    };
  }
}

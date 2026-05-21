import { Injectable } from "@nestjs/common";
import { MainDatabaseService } from "../../database/main-database.service";
import { EvolutionApiService } from "../../channel-apis/evolution-api.service";
import { GatewayRequest, GatewayResponse } from "../interfaces/gateway-request.interface";
import { BaseHandler } from "./base.handler";

@Injectable()
export class EvolutionHandler extends BaseHandler {
  constructor(
    mainDatabaseService: MainDatabaseService,
    private readonly evolutionApi: EvolutionApiService
  ) {
    super(mainDatabaseService, EvolutionHandler.name);
  }

  async handleHealthCheck(
    request: GatewayRequest
  ): Promise<GatewayResponse<{ healthy: boolean; error?: string }>> {
    const { correlationId } = request;

    this.logger.log(`[HealthCheck] Starting Evolution API health check`);
    const result = await this.evolutionApi.checkHealth();
    this.logger.log(`[HealthCheck] Result: ${JSON.stringify(result)}`);

    const response = this.successResponse(correlationId, result);
    this.logger.log(`[HealthCheck] Response: ${JSON.stringify(response)}`);

    return response;
  }
}

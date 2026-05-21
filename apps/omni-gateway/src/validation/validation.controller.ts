import { Controller, Post, Body, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { EvolutionApiService } from "../channel-apis/evolution-api.service";

interface ValidateNumbersRequest {
  instanceName: string;
  numbers: string[];
}

interface ValidateNumbersResponse {
  results: Array<{
    number: string;
    exists: boolean;
    jid: string;
  }>;
}

@Controller("api/validate")
export class ValidationController {
  private readonly logger = new Logger(ValidationController.name);

  constructor(private readonly evolutionApiService: EvolutionApiService) {}

  @Post("whatsapp-numbers")
  async validateWhatsAppNumbers(
    @Body() body: ValidateNumbersRequest
  ): Promise<ValidateNumbersResponse> {
    const { instanceName, numbers } = body;

    if (!instanceName) {
      throw new HttpException(
        "instanceName is required",
        HttpStatus.BAD_REQUEST
      );
    }

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      throw new HttpException(
        "numbers must be a non-empty array",
        HttpStatus.BAD_REQUEST
      );
    }

    if (numbers.length > 50) {
      throw new HttpException(
        "Maximum 50 numbers per request",
        HttpStatus.BAD_REQUEST
      );
    }

    this.logger.log(
      `Validating ${numbers.length} WhatsApp numbers for instance: ${instanceName}`
    );

    try {
      const results = await this.evolutionApiService.checkWhatsAppNumbers(
        instanceName,
        numbers
      );

      return { results };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to validate WhatsApp numbers: ${errorMessage}`);
      throw new HttpException(
        `Failed to validate numbers: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

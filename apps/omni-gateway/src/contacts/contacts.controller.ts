import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { EvolutionApiService } from "../channel-apis/evolution-api.service";

interface ProfilePictureResponse {
  profilePictureUrl: string | null;
}

interface ContactNameResponse {
  name: string | null;
}

@Controller("api/contacts")
export class ContactsController {
  private readonly logger = new Logger(ContactsController.name);

  constructor(private readonly evolutionApiService: EvolutionApiService) {}

  @Get(":number/profile-picture")
  async getProfilePicture(
    @Param("number") number: string,
    @Query("instanceName") instanceName: string
  ): Promise<ProfilePictureResponse> {
    if (!instanceName) {
      throw new HttpException(
        "instanceName query parameter is required",
        HttpStatus.BAD_REQUEST
      );
    }

    if (!number) {
      throw new HttpException(
        "number parameter is required",
        HttpStatus.BAD_REQUEST
      );
    }

    this.logger.log(
      `Fetching profile picture for ${number} on instance: ${instanceName}`
    );

    try {
      const profilePictureUrl =
        await this.evolutionApiService.fetchProfilePictureUrl(
          instanceName,
          number
        );

      return { profilePictureUrl };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to fetch profile picture: ${errorMessage}`);
      throw new HttpException(
        `Failed to fetch profile picture: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(":number/name")
  async getContactName(
    @Param("number") number: string,
    @Query("instanceName") instanceName: string
  ): Promise<ContactNameResponse> {
    if (!instanceName) {
      throw new HttpException(
        "instanceName query parameter is required",
        HttpStatus.BAD_REQUEST
      );
    }

    if (!number) {
      throw new HttpException(
        "number parameter is required",
        HttpStatus.BAD_REQUEST
      );
    }

    this.logger.log(
      `Fetching contact name for ${number} on instance: ${instanceName}`
    );

    try {
      const name = await this.evolutionApiService.fetchContactName(
        instanceName,
        `${number}@s.whatsapp.net`
      );

      return { name };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to fetch contact name: ${errorMessage}`);
      throw new HttpException(
        `Failed to fetch contact name: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

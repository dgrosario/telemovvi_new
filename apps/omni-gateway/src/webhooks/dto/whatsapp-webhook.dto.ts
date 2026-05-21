import { IsString, IsArray, ValidateNested, IsOptional } from "class-validator";
import { Type } from "class-transformer";

class WhatsAppMetadataDto {
  @IsString()
  display_phone_number!: string;

  @IsString()
  phone_number_id!: string;
}

class WhatsAppContactProfileDto {
  @IsString()
  name!: string;
}

class WhatsAppContactDto {
  @ValidateNested()
  @Type(() => WhatsAppContactProfileDto)
  profile!: WhatsAppContactProfileDto;

  @IsString()
  wa_id!: string;
}

class WhatsAppTextDto {
  @IsString()
  body!: string;
}

class WhatsAppMediaDto {
  @IsString()
  id!: string;

  @IsString()
  mime_type!: string;

  @IsOptional()
  @IsString()
  sha256?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  filename?: string;
}

class WhatsAppMessageDto {
  @IsString()
  from!: string;

  @IsString()
  id!: string;

  @IsString()
  timestamp!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppTextDto)
  text?: WhatsAppTextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppMediaDto)
  image?: WhatsAppMediaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppMediaDto)
  audio?: WhatsAppMediaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppMediaDto)
  video?: WhatsAppMediaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppMediaDto)
  document?: WhatsAppMediaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppMediaDto)
  sticker?: WhatsAppMediaDto;
}

class WhatsAppStatusDto {
  @IsString()
  id!: string;

  @IsString()
  status!: string;

  @IsString()
  timestamp!: string;

  @IsString()
  recipient_id!: string;
}

class WhatsAppValueDto {
  @IsString()
  messaging_product!: string;

  @ValidateNested()
  @Type(() => WhatsAppMetadataDto)
  metadata!: WhatsAppMetadataDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppContactDto)
  contacts?: WhatsAppContactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppMessageDto)
  messages?: WhatsAppMessageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppStatusDto)
  statuses?: WhatsAppStatusDto[];
}

class WhatsAppChangeDto {
  @IsString()
  field!: string;

  @ValidateNested()
  @Type(() => WhatsAppValueDto)
  value!: WhatsAppValueDto;
}

class WhatsAppEntryDto {
  @IsString()
  id!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppChangeDto)
  changes!: WhatsAppChangeDto[];
}

export class WhatsAppWebhookDto {
  @IsString()
  object!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppEntryDto)
  entry!: WhatsAppEntryDto[];
}

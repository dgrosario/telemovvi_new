import { IsString, IsArray, ValidateNested, IsOptional, IsNumber } from "class-validator";
import { Type } from "class-transformer";

class InstagramSenderDto {
  @IsString()
  id!: string;
}

class InstagramRecipientDto {
  @IsString()
  id!: string;
}

class InstagramAttachmentPayloadDto {
  @IsOptional()
  @IsString()
  url?: string;
}

class InstagramAttachmentDto {
  @IsString()
  type!: string;

  @ValidateNested()
  @Type(() => InstagramAttachmentPayloadDto)
  payload!: InstagramAttachmentPayloadDto;
}

class InstagramMessageDto {
  @IsString()
  mid!: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstagramAttachmentDto)
  attachments?: InstagramAttachmentDto[];
}

class InstagramMessagingEventDto {
  @ValidateNested()
  @Type(() => InstagramSenderDto)
  sender!: InstagramSenderDto;

  @ValidateNested()
  @Type(() => InstagramRecipientDto)
  recipient!: InstagramRecipientDto;

  @IsNumber()
  timestamp!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => InstagramMessageDto)
  message?: InstagramMessageDto;
}

class InstagramChangeValueDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => InstagramSenderDto)
  sender?: InstagramSenderDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InstagramRecipientDto)
  recipient?: InstagramRecipientDto;

  @IsOptional()
  @IsNumber()
  timestamp?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => InstagramMessageDto)
  message?: InstagramMessageDto;
}

class InstagramChangeDto {
  @IsString()
  field!: string;

  @ValidateNested()
  @Type(() => InstagramChangeValueDto)
  value!: InstagramChangeValueDto;
}

class InstagramEntryDto {
  @IsString()
  id!: string;

  @IsNumber()
  time!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstagramMessagingEventDto)
  messaging?: InstagramMessagingEventDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstagramChangeDto)
  changes?: InstagramChangeDto[];
}

export class InstagramWebhookDto {
  @IsString()
  object!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstagramEntryDto)
  entry!: InstagramEntryDto[];
}

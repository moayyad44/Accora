import { IsUUID } from "class-validator";

export class SetAccountMappingDto {
  @IsUUID()
  accountId!: string;
}

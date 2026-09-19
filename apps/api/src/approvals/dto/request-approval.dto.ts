import { IsNumberString, IsString, MinLength } from "class-validator";

export class RequestApprovalDto {
  @IsString()
  @MinLength(1)
  docType!: string;

  @IsString()
  @MinLength(1)
  docId!: string;

  @IsNumberString()
  amount!: string;
}

import { ApprovalDecision } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class DecideApprovalDto {
  @IsEnum(ApprovalDecision)
  decision!: ApprovalDecision;

  @IsOptional()
  @IsString()
  comment?: string;
}

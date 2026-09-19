import { Type } from "class-transformer";
import { ArrayMinSize, IsNumberString, IsObject, IsOptional, IsString, IsUUID, MinLength, ValidateNested } from "class-validator";

class ApprovalWorkflowConditionsDto {
  @IsOptional()
  @IsNumberString()
  minAmount?: string;
}

class ApprovalWorkflowStepDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  approverRoleId?: string;
}

export class CreateApprovalWorkflowDto {
  @IsString()
  @MinLength(1)
  docType!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ApprovalWorkflowConditionsDto)
  conditions?: ApprovalWorkflowConditionsDto;

  @ValidateNested({ each: true })
  @Type(() => ApprovalWorkflowStepDto)
  @ArrayMinSize(1)
  steps!: ApprovalWorkflowStepDto[];
}

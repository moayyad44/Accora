import { IsDateString, IsString, IsUUID, MinLength } from "class-validator";

export class RequestLeaveDto {
  @IsUUID()
  employeeId!: string;

  @IsString()
  @MinLength(1)
  type!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

import { IsDateString, IsNumberString, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateContractDto {
  @IsUUID()
  employeeId!: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsNumberString()
  baseSalary!: string;

  @IsOptional()
  @IsString()
  terms?: string;
}

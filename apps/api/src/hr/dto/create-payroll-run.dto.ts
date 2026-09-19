import { IsUUID } from "class-validator";

export class CreatePayrollRunDto {
  @IsUUID()
  periodId!: string;
}

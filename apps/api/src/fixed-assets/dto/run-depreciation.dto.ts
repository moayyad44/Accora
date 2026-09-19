import { IsUUID } from "class-validator";

export class RunDepreciationDto {
  @IsUUID()
  periodId!: string;
}

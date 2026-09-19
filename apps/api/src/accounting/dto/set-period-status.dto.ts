import { IsIn } from "class-validator";

export class SetPeriodStatusDto {
  @IsIn(["OPEN", "CLOSED"])
  status!: "OPEN" | "CLOSED";
}

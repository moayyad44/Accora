import { IsIn } from "class-validator";

export class SetLeaveStatusDto {
  @IsIn(["APPROVED", "REJECTED"])
  status!: "APPROVED" | "REJECTED";
}

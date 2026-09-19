import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { CompaniesModule } from "../companies/companies.module";

@Module({
  imports: [JwtModule.register({}), CompaniesModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}

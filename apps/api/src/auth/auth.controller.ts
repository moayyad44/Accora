import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterCompanyDto } from "./dto/register-company.dto";
import { LoginDto } from "./dto/login.dto";
import { SwitchCompanyDto } from "./dto/switch-company.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenPayload } from "../common/types/auth-user";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register-company")
  registerCompany(@Body() dto: RegisterCompanyDto) {
    return this.authService.registerCompany(dto);
  }

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("switch-company")
  switchCompany(@CurrentUser() user: AccessTokenPayload, @Body() dto: SwitchCompanyDto) {
    return this.authService.switchCompany(user.sub, user.email, user.isSuperAdmin, dto.companyId);
  }

  @Public()
  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}

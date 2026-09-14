import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthenticatedUser } from "../../common/guards/authenticated-user";
import { AuthService } from "./auth.service";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/auth.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Register a Student account" })
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.register(body);
    this.setRefreshCookie(response, result);
    return this.publicSession(result);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @ApiOperation({ summary: "Log in to User Web or Admin Web" })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(body);
    this.setRefreshCookie(response, result);
    return this.publicSession(result);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(
    @Body() body: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieName = this.auth.cookieName(body.clientType);
    const result = await this.auth.refresh(body.clientType, request.cookies?.[cookieName]);
    this.setRefreshCookie(response, result);
    return this.publicSession(result);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() body: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieName = this.auth.cookieName(body.clientType);
    await this.auth.logout(body.clientType, request.cookies?.[cookieName]);
    response.clearCookie(cookieName, { path: "/api/v1/auth" });
  }

  @Get("me")
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user);
  }

  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(user, body);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.auth.forgotPassword(body.email);
    return { message: "If the account exists, password reset instructions have been created." };
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body);
  }

  private setRefreshCookie(
    response: Response,
    session: {
      cookieName: string;
      refreshToken: string;
      refreshMaxAgeMs: number;
    },
  ): void {
    response.cookie(session.cookieName, session.refreshToken, {
      httpOnly: true,
      secure: this.config.get<boolean>("COOKIE_SECURE", false),
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: session.refreshMaxAgeMs,
    });
  }

  private publicSession<T extends {
    accessToken: string;
    audience?: "listenup-admin";
    user: unknown;
  }>(session: T) {
    return {
      accessToken: session.accessToken,
      ...(session.audience ? { audience: session.audience } : {}),
      user: session.user,
    };
  }
}

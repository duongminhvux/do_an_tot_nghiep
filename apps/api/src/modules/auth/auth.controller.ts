import { Controller, Post, Body, UseGuards, Req, Res, UnauthorizedException, Logger, Get } from '@nestjs/common';
import express from 'express';
import { AuthService } from './auth.service.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { Public } from './decorators/public.decorator.js';
import { LocalAuthGuard } from './guards/local-auth.guard.js';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue } from 'ms';

import { VerifyEmailDto } from './dto/verify-email-auth.dto.js';
import { ResendCodeDto } from './dto/resend-code.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { I18nService } from 'nestjs-i18n';
import { GoogleOauthGuard } from './guards/google-oauth.guard.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) { }

  setCookie(res: express.Response, refresh_token: string) {
    const refreshTokenExpires = this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRES') || '7d';
    const maxAge = ms(refreshTokenExpires as StringValue);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: typeof maxAge === 'number' ? maxAge : 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearCookie(res: express.Response) {
    res.clearCookie('refresh_token');
  }

  @Public()
  @Post('register')
  async register(@Body() createAuthDto: CreateAuthDto) {
    return await this.authService.register(createAuthDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: any, @Res({ passthrough: true }) res: express.Response) {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.INVALID_CREDENTIALS'));
    }
    const payload = {
      _id: String(user._id),
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: "USER",
    };

    const { accessToken, refreshToken } = await this.authService.generateTokens(payload);

    this.setCookie(res, refreshToken);

    return {
      message: this.i18n.t('auth.LOGIN_SUCCESSFULLY'),
      accessToken,
      profile: payload,
    };
  }

  @Public()
  @Get('google/login')
  @UseGuards(GoogleOauthGuard)
  async googleAuth(@Req() req: any) { }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  async googleAuthCallback(@Req() req: any, @Res({ passthrough: true }) res: express.Response) {
    const loginResult = await this.authService.googleLogin(req.user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || this.configService.get<string>('FRONTEND_CLIENT_URL') || 'http://localhost:3000';
    this.setCookie(res, loginResult.refreshToken);
    return res.redirect(`${frontendUrl}/auth/callback?token=${loginResult.accessToken}`);
  }

  @Public()
  @Post('verify-email')
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
  ) {
    return await this.authService.verifyEmail(
      verifyEmailDto.email,
      verifyEmailDto.code
    );
  }

  @Public()
  @Post("resend-code")
  async resendCode(@Body() resendCodeDto: ResendCodeDto) {
    return await this.authService.resendCode(resendCodeDto.email);
  }


  @Public()
  @Post('refresh-token')
  async refreshToken(@Req() req: any, @Res({ passthrough: true }) res: express.Response) {
    const refreshToken = req.cookies?.['refresh_token'];
    const result = await this.authService.refreshToken(refreshToken);
    this.setCookie(res, result.refreshToken);
    return {
      message: result.message,
      accessToken: result.accessToken,
    };
  }

  @Public()
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: express.Response) {
    this.clearCookie(res);
    return {
      message: await this.i18n.t('auth.LOGOUT_SUCCESSFULLY'),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return await this.authService.changePassword(req.user._id, changePasswordDto);
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return await this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.authService.resetPassword(resetPasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(@Req() req: any) {
    return req.user;
  }
}


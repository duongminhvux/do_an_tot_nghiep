import { PermissionExemption } from './decorators/require-permissions.decorator.js';
import {
Body,
Controller,
Get,
Logger,
Post,
Req,
Res,
UnauthorizedException,
UseGuards
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import express from 'express';
import { I18nService } from 'nestjs-i18n';
import { AdminsService } from '../admins/admins.service.js';
import { AdminLoginDto } from '../admins/dto/admin-login.dto.js';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { Roles } from './decorators/roles.decorator.js';
import { RolesGuard } from './guards/roles.guard.js';
import { clearRefreshCookie,readRefreshCookie,setRefreshCookie } from './refresh-cookie.js';

@Controller('admin/auth')
export class AdminAuthController {
  private readonly logger = new Logger(AdminAuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
    private readonly adminsService: AdminsService,
    private readonly jwtService: JwtService,
  ) { }

  private setCookie(res: express.Response, refresh_token: string) {
    setRefreshCookie(res, refresh_token, this.configService, 'admin');
  }

  private clearCookie(res: express.Response) {
    clearRefreshCookie(res, this.configService, 'admin');
  }

  @PermissionExemption('E1')
  @Public()
  @Post('login')
  async login(
    @Body() loginDto: AdminLoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const identifier = loginDto.username || loginDto.email;
    if (!identifier) {
      throw new UnauthorizedException(
        await this.i18n.t('auth.INVALID_CREDENTIALS'),
      );
    }

    const admin = await this.adminsService.validateAdmin(
      identifier,
      loginDto.password,
    );

    const payload = {
      _id: String(admin._id),
      username: admin.username,
      email: admin.email,
      avatarUrl: admin.avatarUrl,
      role: 'ADMIN', auth_version: admin.authVersion };

    await this.adminsService.authenticateToken(payload);

    const { accessToken, refreshToken } =
      await this.authService.generateTokens(payload);

    this.setCookie(res, refreshToken);

    return {
      message: await this.i18n.t('auth.LOGIN_SUCCESSFULLY'),
      accessToken,
      refreshToken,
      profile: {
        _id: String(admin._id),
        username: admin.username,
        email: admin.email,
        avatarUrl: admin.avatarUrl,
        role: 'ADMIN' } };
  }

  @PermissionExemption('E2')
  @Public()
  @Post('refresh-token')
  async refreshToken(
    @Req() req: any,
    @Body('refreshToken') bodyRefreshToken: string,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken =
      bodyRefreshToken ||
      readRefreshCookie(req, 'admin') ||
      (req.headers?.['x-refresh-token'] as string);

    if (!refreshToken) {
      throw new UnauthorizedException(
        await this.i18n.t('auth.INVALID_REFRESH_TOKEN'),
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') });

      if (payload.role !== 'ADMIN') {
        throw new UnauthorizedException(
          await this.i18n.t('auth.ADMIN_ACCESS_DENIED'),
        );
      }

      const admin = await this.adminsService.authenticateToken(payload);

      const newPayload = {
        _id: String(admin._id),
        username: admin.username,
        email: admin.email,
        avatarUrl: admin.avatarUrl,
        role: 'ADMIN', auth_version: admin.authVersion };

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        await this.authService.generateTokens(newPayload);

      this.setCookie(res, newRefreshToken);

      return {
        message: await this.i18n.t('auth.REFRESH_TOKEN_SUCCESSFULLY'),
        accessToken: newAccessToken,
        refreshToken: newRefreshToken };
    } catch {
      throw new UnauthorizedException(
        await this.i18n.t('auth.INVALID_REFRESH_TOKEN'),
      );
    }
  }

  @PermissionExemption('E3')
  @Public()
  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: express.Response) {
    this.clearCookie(res);
    const bearer=String(req.headers?.authorization||'').replace(/^Bearer\s+/i,'');
    const refresh=req.body?.refreshToken || readRefreshCookie(req,'admin') || req.headers?.['x-refresh-token'];
    for (const [token,secret] of [[bearer,'JWT_ACCESS_SECRET'],[refresh,'JWT_REFRESH_SECRET']]) {
      if (typeof token!=='string' || !token) continue;
      let payload: any;
      try {payload=await this.jwtService.verifyAsync(token,{secret:this.configService.get<string>(secret)});} catch {continue;}
      if (await this.adminsService.revokeToken(payload)) break;
    }
    return {
      message: await this.i18n.t('auth.LOGOUT_SUCCESSFULLY') };
  }

  @PermissionExemption('E4')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('me')
  async getProfile(@Req() req: any) {
    return req.user;
  }
}

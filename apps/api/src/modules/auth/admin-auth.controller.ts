import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
  Logger,
  Get,
} from '@nestjs/common';
import express from 'express';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { ConfigService } from '@nestjs/config';
import ms, { StringValue } from 'ms';
import { I18nService } from 'nestjs-i18n';
import { RolesGuard } from './guards/roles.guard.js';
import { Roles } from './decorators/roles.decorator.js';
import { AdminsService } from '../admins/admins.service.js';
import { AdminLoginDto } from '../admins/dto/admin-login.dto.js';
import { JwtService } from '@nestjs/jwt';

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
    const refreshTokenExpires =
      this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRES') || '7d';
    const maxAge = ms(refreshTokenExpires as StringValue);
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: typeof maxAge === 'number' ? maxAge : 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearCookie(res: express.Response) {
    res.clearCookie('refresh_token');
  }

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
      role: 'ADMIN',
    };

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
        role: 'ADMIN',
      },
    };
  }

  @Public()
  @Post('refresh-token')
  async refreshToken(
    @Req() req: any,
    @Body('refreshToken') bodyRefreshToken: string,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const refreshToken =
      bodyRefreshToken ||
      req.cookies?.['refresh_token'] ||
      (req.headers?.['x-refresh-token'] as string);

    if (!refreshToken) {
      throw new UnauthorizedException(
        await this.i18n.t('auth.INVALID_REFRESH_TOKEN'),
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.role !== 'ADMIN') {
        throw new UnauthorizedException(
          await this.i18n.t('auth.ADMIN_ACCESS_DENIED'),
        );
      }

      const admin = payload._id
        ? await this.adminsService.findById(payload._id)
        : await this.adminsService.findByEmail(payload.email);

      if (!admin || admin.isDeleted) {
        throw new UnauthorizedException(
          await this.i18n.t('auth.INVALID_REFRESH_TOKEN'),
        );
      }

      const newPayload = {
        _id: String(admin._id),
        username: admin.username,
        email: admin.email,
        avatarUrl: admin.avatarUrl,
        role: 'ADMIN',
      };

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        await this.authService.generateTokens(newPayload);

      this.setCookie(res, newRefreshToken);

      return {
        message: await this.i18n.t('auth.REFRESH_TOKEN_SUCCESSFULLY'),
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException(
        await this.i18n.t('auth.INVALID_REFRESH_TOKEN'),
      );
    }
  }

  @Public()
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: express.Response) {
    this.clearCookie(res);
    return {
      message: await this.i18n.t('auth.LOGOUT_SUCCESSFULLY'),
    };
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('me')
  async getProfile(@Req() req: any) {
    return req.user;
  }
}

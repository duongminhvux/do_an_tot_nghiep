import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { AuthProvider, UserDocument } from '../users/schema/user.schema.js';
import { UsersService } from '../users/users.service.js';
import { comparePassword, hashPassword as hashPasswordHelper } from '../../common/bcrypt.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GmailService } from '../gmail/gmail.service.js';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly gmailService: GmailService,
    private readonly i18n: I18nService,
  ) { }

  private async buildEmailTemplate(code: string, username?: string): Promise<string> {
    const lang = I18nContext.current()?.lang || 'vi';
    const greeting = await this.i18n.translate('auth.GREETING', { lang, args: { username: username || 'bạn' } });
    const title = await this.i18n.translate('auth.EMAIL_VERIFICATION_TITLE', { lang });
    const otpDesc = await this.i18n.translate('auth.OTP_DESCRIPTION', { lang });
    const otpExpiry = await this.i18n.translate('auth.OTP_EXPIRY_NOTE', { lang });
    const footer = await this.i18n.translate('auth.AUTOMATED_EMAIL_FOOTER', { lang });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }
          .container { max-width: 500px; background: #ffffff; margin: 0 auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
          .header { text-align: center; border-bottom: 1px solid #eef2f5; padding-bottom: 20px; }
          .header h2 { color: #1e293b; margin: 0; font-size: 24px; }
          .content { padding: 20px 0; text-align: center; }
          .content p { color: #475569; font-size: 15px; line-height: 1.6; }
          .code-box { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 16px 24px; border-radius: 8px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; color: #94a3b8; font-size: 13px; border-top: 1px solid #eef2f5; padding-top: 20px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${title}</h2>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>${otpDesc}</p>
            <div class="code-box">${code}</div>
            <p>${otpExpiry}</p>
          </div>
          <div class="footer">
            <p>${footer}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateRandomString(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  async generateTokens(payload: Record<string, any>): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRES') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRES') as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  async register(createUserDto: CreateUserDto) {
    const { email, password, authProvider = AuthProvider.LOCAL, ggId } = createUserDto;

    if (await this.usersService.isExistingEmail(email)) {
      throw new BadRequestException(this.i18n.t('auth.EMAIL_ALREADY_EXIST'));
    }

    if (authProvider === AuthProvider.GOOGLE) {
      if (!ggId) {
        throw new BadRequestException(this.i18n.t('auth.GOOGLE_ID_REQUIRED'));
      }

      this.logger.log(`Creating user with Google authentication for email: ${email}`);
      return await this.usersService.create({
        ...createUserDto,
        authProvider: AuthProvider.GOOGLE,
        password: undefined,
      });
    }

    if (!password) {
      throw new BadRequestException(this.i18n.t('auth.PASSWORD_REQUIRED'));
    }

    const hashPassword = await hashPasswordHelper(password);

    const code = this.generateRandomString(6);
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    this.logger.log(`Creating user with local authentication for email: ${email}`);
    const newUser = await this.usersService.create({
      ...createUserDto,
      password: hashPassword,
      code: code,
      codeExpiresAt: codeExpiresAt
    });

    try {
      const lang = I18nContext.current()?.lang || 'vi';
      const subject = await this.i18n.translate('auth.AUTH_VERIFY_EMAIL_SUBJECT', { lang });
      const html = await this.buildEmailTemplate(code, createUserDto.username);
      this.gmailService.sendEmail(email, subject as string, html);
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}`, error);
    }

    return {
      message: this.i18n.t('auth.CODE_SENT_SUCCESSFULLY')
    };
  }

  async validateUser(
    email: string,
    pass: string,
  ): Promise<UserDocument | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.INVALID_CREDENTIALS'));
    }

    if (user.authProvider !== AuthProvider.LOCAL && !user.password) {
      throw new UnauthorizedException(this.i18n.t('auth.USE_GOOGLE_AUTH'));
    }

    if (user.authProvider === AuthProvider.LOCAL && !user.password) {
      throw new UnauthorizedException(this.i18n.t('auth.INVALID_CREDENTIALS'));
    }

    const isPasswordValid = await comparePassword(pass, user.password as string);
    if (isPasswordValid) {
      const { password, ...result } = user as any;
      console.log(result);
      return result;
    }

    return null;
  }

  async verifyEmail(email: string, code: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException(this.i18n.t('auth.USER_NOT_FOUND'));
    }

    if (user.isVerified) {
      throw new BadRequestException(this.i18n.t('auth.EMAIL_ALREADY_VERIFIED'));
    }

    if (!user.code || user.code !== code) {
      throw new BadRequestException(this.i18n.t('auth.INVALID_CODE'));
    }

    if (!user.codeExpiresAt || new Date(user.codeExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException(this.i18n.t('auth.CODE_EXPIRED'));
    }

    const updatedUser = await this.usersService.update(user._id.toString(), {
      isVerified: true,
      code: null,
      codeExpiresAt: null,
    });

    if (!updatedUser) {
      throw new BadRequestException(this.i18n.t('auth.USER_NOT_FOUND'));
    }

    return { message: this.i18n.t('auth.CODE_VERIFIED_SUCCESSFULLY') };
  }

  async resendCode(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException(this.i18n.t('auth.USER_NOT_FOUND'));
    }

    if (user.isVerified) {
      throw new BadRequestException(this.i18n.t('auth.EMAIL_ALREADY_VERIFIED'));
    }

    const code = this.generateRandomString(6);
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const updatedUser = await this.usersService.update(user._id.toString(), {
      code: code,
      codeExpiresAt: codeExpiresAt
    });

    if (!updatedUser) {
      throw new BadRequestException(this.i18n.t('auth.USER_NOT_FOUND'));
    }

    try {
      const lang = I18nContext.current()?.lang || 'vi';
      const subject = await this.i18n.translate('auth.AUTH_RESEND_CODE_SUBJECT', { lang });
      const html = await this.buildEmailTemplate(code, user.username);
      this.gmailService.sendEmail(email, subject as string, html);
    } catch (error) {
      this.logger.error(`Failed to resend email to ${email}`, error);
    }

    return {
      message: this.i18n.t('auth.CODE_RESENT_SUCCESSFULLY')
    };
  }
  async googleLogin(googleUser: any) {
    const { email, username, ggId, avatarUrl } = googleUser;
    let user = await this.usersService.findByEmail(email);

    if (!user) {
      const newUserDto = {
        email,
        username: username || email.split('@')[0],
        authProvider: AuthProvider.GOOGLE,
        isVerified: true,
        avatarUrl,
        ggId,
      };

      const created = await this.usersService.create(newUserDto as any);
      user = (created && typeof (created as any).toObject === 'function') ? (created as any).toObject() : created;
    }

    const payload = {
      _id: String(user!._id),
      username: user!.username,
      email: user!.email,
      avatarUrl: user!.avatarUrl,
      role: 'USER',
    };

    const { accessToken, refreshToken } = await this.generateTokens(payload);

    return {
      accessToken,
      refreshToken,
      profile: payload,
    };
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException(await this.i18n.t('auth.INVALID_REFRESH_TOKEN'));
    }

    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findByEmail(payload.email);
      if (!user || user.isDeleted) {
        throw new UnauthorizedException(await this.i18n.t('auth.INVALID_REFRESH_TOKEN'));
      }

      const newPayload = {
        _id: String(user._id),
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: 'USER',
      };

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        await this.generateTokens(newPayload);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        message: await this.i18n.t('auth.REFRESH_TOKEN_SUCCESSFULLY'),
      };
    } catch {
      throw new UnauthorizedException(await this.i18n.t('auth.INVALID_REFRESH_TOKEN'));
    }
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new BadRequestException(await this.i18n.t('auth.USER_NOT_FOUND'));
    }

    if (user.authProvider !== AuthProvider.LOCAL || !user.password) {
      throw new BadRequestException(await this.i18n.t('auth.USE_GOOGLE_AUTH'));
    }

    const isPasswordValid = await comparePassword(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException(await this.i18n.t('auth.INVALID_OLD_PASSWORD'));
    }

    const hashPassword = await hashPasswordHelper(newPassword);
    await this.usersService.update(userId, { password: hashPassword });

    return {
      message: await this.i18n.t('auth.PASSWORD_CHANGED_SUCCESSFULLY'),
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException(await this.i18n.t('auth.USER_NOT_FOUND'));
    }

    if (user.authProvider !== AuthProvider.LOCAL) {
      throw new BadRequestException(await this.i18n.t('auth.USE_GOOGLE_AUTH'));
    }

    const code = this.generateRandomString(6);
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.usersService.update(user._id.toString(), {
      code,
      codeExpiresAt,
    });

    try {
      const lang = I18nContext.current()?.lang || 'vi';
      const subject = await this.i18n.translate('auth.AUTH_FORGOT_PASSWORD_SUBJECT', { lang });
      const html = await this.buildEmailTemplate(code, user.username);
      this.gmailService.sendEmail(email, subject as string, html);
    } catch (error) {
      this.logger.error(`Failed to send forgot password email to ${email}`, error);
    }

    return {
      message: await this.i18n.t('auth.FORGOT_PASSWORD_CODE_SENT'),
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, code, newPassword } = resetPasswordDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException(await this.i18n.t('auth.USER_NOT_FOUND'));
    }

    if (!user.code || user.code !== code) {
      throw new BadRequestException(await this.i18n.t('auth.INVALID_CODE'));
    }

    if (!user.codeExpiresAt || new Date(user.codeExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException(await this.i18n.t('auth.CODE_EXPIRED'));
    }

    const hashPassword = await hashPasswordHelper(newPassword);

    await this.usersService.update(user._id.toString(), {
      password: hashPassword,
      code: null,
      codeExpiresAt: null,
    });

    return {
      message: await this.i18n.t('auth.PASSWORD_RESET_SUCCESSFULLY'),
    };
  }
}

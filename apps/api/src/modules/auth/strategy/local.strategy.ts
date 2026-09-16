import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service.js';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(
        private authService: AuthService,
        private readonly i18n: I18nService,
    ) {
        super({
            usernameField: "email",
            passwordField: "password",
        });
    }

    async validate(email: string, password: string): Promise<any> {
        const user = await this.authService.validateUser(email, password);
        if (!user) {
            throw new UnauthorizedException(this.i18n.t('auth.INVALID_CREDENTIALS'));
        }
        if (!user.isVerified) {
            throw new BadRequestException(this.i18n.t('auth.ACCOUNT_NOT_VERIFIED'));
        }
        if (user.isDeleted) {
            throw new BadRequestException(this.i18n.t('auth.ACCOUNT_DELETED'));
        }
        return user;
    }
}

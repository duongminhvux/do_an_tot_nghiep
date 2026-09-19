import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service.js';
import { AdminsService } from '../../admins/admins.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private adminsService: AdminsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  async validate(payload: any) {
    if (payload.role === 'ADMIN') {
      const admin = payload._id
        ? await this.adminsService.findById(payload._id)
        : await this.adminsService.findByEmail(payload.email);

      if (!admin || admin.isDeleted) {
        return null;
      }

      return {
        _id: String(admin._id),
        email: admin.email,
        username: admin.username,
        avatarUrl: admin.avatarUrl,
        role: 'ADMIN',
      };
    }

    const user = await this.usersService.findByEmail(payload.email);
    if (!user || user.isDeleted) {
      return null;
    }

    return {
      _id: String(user._id),
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: 'USER',
    };
  }
}

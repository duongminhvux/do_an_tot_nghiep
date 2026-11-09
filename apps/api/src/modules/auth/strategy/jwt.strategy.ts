import { userProfile } from '../../users/user-profile.js';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt,Strategy } from 'passport-jwt';
import { AdminsService } from '../../admins/admins.service.js';
import { UsersService } from '../../users/users.service.js';

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
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')! });
  }

  async validate(payload: any) {
    if (payload.role === 'ADMIN') {
      return this.adminsService.authenticateToken(payload);
    }

    if (payload.role !== 'USER') throw new UnauthorizedException('Invalid token role');
    const user = await this.usersService.findByEmail(payload.email);
    if (!user || user.isDeleted) {
      return null;
    }

    return userProfile(user);
  }
}

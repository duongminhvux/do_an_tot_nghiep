import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service.js';


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET')!,
    });
  }

  async validate(payload: any) {
    const email = payload.email;
    if (payload.role === 'ADMIN') {
      // TODO: Implement admin validation if needed
      return null;
    } else {
      const user = await this.usersService.findByEmail(email);
      if (!user || user.isDeleted) {
        return null;
      }
      return {
        _id: String(user._id),
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
        role: payload.role || 'USER',
      };
    }
  }
}

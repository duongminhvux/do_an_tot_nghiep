import { Body,Controller,ForbiddenException,Headers,Post,UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'node:crypto';
import { AdminsService } from '../admins/admins.service.js';
import { UsersService } from '../users/users.service.js';
import { Public } from './decorators/public.decorator.js';

// Only other trusted service containers can call this endpoint. Gateway never
// exposes /api/_internal; callers also need a signed user access token.
@Controller('_internal/identity')
export class IdentityIntrospectionController {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly admins: AdminsService,
  ) {}

  @Public()
  @Post('introspect')
  async introspect(@Headers('x-internal-token') token: string, @Body('accessToken') accessToken: string) {
    const secret = this.config.get<string>('IDENTITY_INTERNAL_TOKEN') || '';
    const supplied = typeof token === 'string' ? token : '';
    if (secret.length < 24 || supplied.length !== secret.length ||
        !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))) {
      throw new ForbiddenException('Forbidden');
    }
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(accessToken, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') });
    } catch { throw new UnauthorizedException('Invalid access token'); }
    if (!payload || typeof payload._id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload._id)) {
      throw new UnauthorizedException('Invalid token payload');
    }
    if (payload.role === 'ADMIN') {
      const admin = await this.admins.findById(payload._id);
      if (!admin || admin.isDeleted) throw new UnauthorizedException('Admin inactive');
      return { _id: String(admin._id), email: admin.email,
        username: admin.username, avatarUrl: admin.avatarUrl, role: 'ADMIN' };
    }
    if (payload.role === 'USER') {
      const user = await this.users.findById(payload._id);
      if (!user || user.isDeleted) throw new UnauthorizedException('User inactive');
      return { _id: String(user._id), email: user.email,
        username: user.username, avatarUrl: user.avatarUrl, role: 'USER' };
    }
    throw new UnauthorizedException('Invalid role');
  }
}

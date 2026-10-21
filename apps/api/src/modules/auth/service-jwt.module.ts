import { Global, Injectable, Module, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PassportStrategy } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

/** Thin auth client: no Mongoose User/Admin models in non-Identity services. */
@Injectable()
export class IdentityTokenVerifier {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}
  async verifyToken(raw: string): Promise<any> {
    if (typeof raw !== 'string' || !raw.trim()) throw new UnauthorizedException('Missing token');
    try { await this.jwt.verifyAsync(raw, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    }); } catch { throw new UnauthorizedException('Invalid or expired token'); }
    const url = this.config.get<string>('IDENTITY_INTROSPECTION_URL')
      || 'http://identity-service:5000/api/_internal/identity/introspect';
    const token = this.config.get<string>('IDENTITY_INTERNAL_TOKEN');
    if (!token || token.length < 24) throw new ServiceUnavailableException('Identity service authentication not configured');
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-token': token },
        body: JSON.stringify({ accessToken: raw }),
        signal: AbortSignal.timeout(4000),
      });
    } catch { throw new ServiceUnavailableException('Identity service unavailable'); }
    if (response.status === 401 || response.status === 403) throw new UnauthorizedException('Account inactive or token invalid');
    if (!response.ok) throw new ServiceUnavailableException('Identity validation unavailable');
    const principal = (await response.json()) as any;
    // Nest's TransformInterceptor currently wraps data for some endpoints.
    const result = principal?.data ?? principal;
    if (!result || typeof result._id !== 'string' || !['USER','ADMIN'].includes(result.role)) {
      throw new UnauthorizedException('Identity response invalid');
    }
    return result;
  }
}

@Injectable()
export class ServiceJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly verifier: IdentityTokenVerifier) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      passReqToCallback: true,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }
  async validate(req: any, _payload: any) {
    const raw = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return this.verifier.verifyToken(raw);
  }
}

// Preserve the original JWT strategy/guard in the legacy monolith during a
// gateway-first migration. Otherwise two strategies named 'jwt' compete and
// existing logins may fail after upgrading the code without switching modes.
const isolatedRole = Boolean(process.env.SERVICE_ROLE && process.env.SERVICE_ROLE !== 'legacy');

@Global()
@Module({
  imports: [PassportModule.register({defaultStrategy:'jwt'}), JwtModule.register({})],
  providers: [
    IdentityTokenVerifier,
    ...(isolatedRole ? [ServiceJwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }] : []),
  ],
  exports: [IdentityTokenVerifier],
})
export class ServiceJwtModule {}

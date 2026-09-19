import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AUTH_ERRORS } from '../../../common/constants/error-codes.js';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (!req.body?.email && req.body?.username) {
      req.body.email = req.body.username;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }
    return user;
  }
}
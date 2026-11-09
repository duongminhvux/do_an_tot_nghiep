import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ADMIN_CONTROLLER_KEY, CONDITION_KEY, EXEMPTION_KEY, PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

export function assertAdminPermissions(principal: any, permissions: readonly string[]): void {
  if (!principal || principal.role !== 'ADMIN') throw new ForbiddenException('Administrator required');
  if (principal.status !== 'ACTIVE' || !Number.isInteger(principal.authVersion) || principal.authVersion < 1) {
    throw new UnauthorizedException('ADMIN_REAUTH_REQUIRED');
  }
  if (!permissions.length || !Array.isArray(principal.permissions) || !permissions.every(code=>principal.permissions.includes(code))) {
    throw new ForbiddenException('Missing required permission');
  }
}

/** Runs AFTER JWT validation. Principal is produced by Identity, never request headers/body. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true; // Arena WS keeps its connection-authenticated learner contract.
    const targets=[context.getHandler(),context.getClass()];
    const request=context.switchToHttp().getRequest();
    const permissions=this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY,targets);
    const condition=this.reflector.getAllAndOverride<string>(CONDITION_KEY,targets);
    const exemption=this.reflector.getAllAndOverride<string>(EXEMPTION_KEY,targets);
    const prefix=this.reflector.get<string|string[]>(PATH_METADATA,context.getClass());
    const requiredRoles=this.reflector.getAllAndOverride<string[]>('roles',targets);
    const administrative=this.reflector.get<boolean>(ADMIN_CONTROLLER_KEY,context.getClass())
      || [prefix].flat().some(value=>typeof value==='string' && /^(?:\/)?admin(?:\/|$)/.test(value))
      || requiredRoles?.includes('ADMIN') || /^\/(?:api\/)?admin(?:\/|$)/.test(request.path||'');
    if (!permissions && !exemption) {
      if (administrative || condition) throw new ForbiddenException('Administrative route has no permission policy');
      return true;
    }
    if (['E1','E2','E3','E6','E7'].includes(exemption||'')) return true;
    if (exemption==='E5' || condition==='C5') {
      if (request.user?.role!=='USER') throw new ForbiddenException('Learner self-service only');
      return true;
    }
    if (exemption==='E4') {
      if (request.user?.role!=='ADMIN') throw new ForbiddenException('Administrator required');
      if (request.user.status!=='ACTIVE' || (!Number.isInteger(request.user.authVersion) || request.user.authVersion<1)) throw new UnauthorizedException('ADMIN_REAUTH_REQUIRED');
      return true;
    }
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY,targets)) throw new ForbiddenException('Public administrative mutation is not permitted');
    if (condition==='C3') {
      // Shared author-or-moderator predicate is completed by the controller + locked service ownership check.
      if (!['ADMIN','USER'].includes(request.user?.role)) throw new ForbiddenException();
      return true;
    }
    if (condition==='C4' && request.user?.role==='USER') return true;
    const required=[...(permissions||[])];
    if (condition==='C1' && (request.body?.status==='banned'
      || (context.getHandler().name==='update' && Object.hasOwn(request.body||{},'status')))) required.push('users.lock');
    assertAdminPermissions(request.user,required);
    return true;
  }
}

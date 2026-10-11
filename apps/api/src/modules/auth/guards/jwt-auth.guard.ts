import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { CONNECTION_AUTHENTICATED_KEY } from '../decorators/connection-authenticated.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (context.getType() === 'ws') {
      const usesConnectionAuth = this.reflector.get<boolean>(
        CONNECTION_AUTHENTICATED_KEY,
        context.getClass(),
      );
      if (!usesConnectionAuth) {
        throw new WsException(
          'Socket connection authentication is not configured',
        );
      }

      const client = context.switchToWs().getClient<Socket>();
      if (
        typeof client.data.userId !== 'string' ||
        !client.data.userId.trim()
      ) {
        throw new WsException('Socket is not authenticated');
      }
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}

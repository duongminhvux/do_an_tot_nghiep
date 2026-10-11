import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { ConnectionAuthenticated } from '../decorators/connection-authenticated.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

class ConnectionAuthGateway {}
ConnectionAuthenticated()(ConnectionAuthGateway);
class UnconfiguredGateway {}

describe('JwtAuthGuard transport handling', () => {
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(reflector);
  const passportPrototype = Object.getPrototypeOf(JwtAuthGuard.prototype);

  function wsContext(userId: unknown, gateway = ConnectionAuthGateway) {
    return {
      getType: () => 'ws',
      getClass: () => gateway,
      switchToWs: () => ({ getClient: () => ({ data: { userId } }) }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => vi.restoreAllMocks());

  it('uses the authenticated connection identity for opted-in gateways without HTTP Passport', () => {
    const passport = vi.spyOn(passportPrototype, 'canActivate');
    expect(guard.canActivate(wsContext('user-id'))).toBe(true);
    expect(passport).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', ' ', 123])(
    'blocks socket events without an authenticated identity %j',
    (userId) => {
      expect(() => guard.canActivate(wsContext(userId))).toThrow(WsException);
    },
  );

  it('does not bypass authentication for unconfigured gateways', () => {
    expect(() =>
      guard.canActivate(wsContext('user-id', UnconfiguredGateway)),
    ).toThrow(WsException);
  });

  it('keeps Passport authentication for protected HTTP requests', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const passport = vi
      .spyOn(passportPrototype, 'canActivate')
      .mockResolvedValue(true);
    const context = {
      getType: () => 'http',
      getHandler: () => () => {},
      getClass: () => class {},
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(passport).toHaveBeenCalledWith(context);
  });

  it('keeps public HTTP endpoints accessible', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const passport = vi.spyOn(passportPrototype, 'canActivate');
    const context = {
      getType: () => 'http',
      getHandler: () => () => {},
      getClass: () => class {},
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
    expect(passport).not.toHaveBeenCalled();
  });
});

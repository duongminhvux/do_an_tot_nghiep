import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor.js';

describe('TransformInterceptor', () => {
  it.each(['ws', 'rpc'])(
    'passes %s responses through without HTTP access or wrapping',
    async (type) => {
      const payload = { success: true, matched: false, status: 'WAITING' };
      const switchToHttp = vi.fn(() => {
        throw new Error('No HTTP response');
      });
      const context = {
        getType: () => type,
        switchToHttp } as unknown as ExecutionContext;
      const handler: CallHandler = { handle: () => of(payload) };
      expect(
        await firstValueFrom(
          new TransformInterceptor().intercept(context, handler),
        ),
      ).toBe(payload);
      expect(switchToHttp).not.toHaveBeenCalled();
    },
  );
  it('still wraps HTTP responses with statusCode and data', async () => {
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getResponse: () => ({ statusCode: 201 }) }) } as unknown as ExecutionContext;
    const handler: CallHandler = { handle: () => of({ matchId: 'test' }) };
    expect(
      await firstValueFrom(
        new TransformInterceptor().intercept(context, handler),
      ),
    ).toEqual({
      statusCode: 201,
      message: 'SUCCESS',
      data: { matchId: 'test' } });
  });
  it('preserves error acknowledgements for Friendly requests', async () => {
    const payload = { success: false, message: 'Player is offline' };
    const context = { getType: () => 'ws' } as unknown as ExecutionContext;
    expect(
      await firstValueFrom(
        new TransformInterceptor().intercept(context, {
          handle: () => of(payload) }),
      ),
    ).toBe(payload);
  });
});

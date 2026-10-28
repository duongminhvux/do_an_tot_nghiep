import { BadRequestException, Logger } from '@nestjs/common';
import { afterEach, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter.js';

afterEach(() => vi.restoreAllMocks());

async function responseFor(error: Error) {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  const response = { headersSent: false, status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  await new HttpExceptionFilter().catch(error, {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ url: '/api/admin/lessons' }) }),
  } as never);
  return response;
}

it('returns 409 for a foreign-key violation without exposing database details', async () => {
  const response = await responseFor(Object.assign(new Error('private table/key details'), { code: '23503' }));
  expect(response.status).toHaveBeenCalledWith(409);
  expect(response.json.mock.calls[0][0]).toMatchObject({ statusCode: 409, error: 'Conflict' });
  expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain('private');
});

it('preserves existing HTTP and unexpected-error handling', async () => {
  expect((await responseFor(new BadRequestException('Invalid input'))).status).toHaveBeenCalledWith(400);
  expect((await responseFor(new Error('Unexpected failure'))).status).toHaveBeenCalledWith(500);
});

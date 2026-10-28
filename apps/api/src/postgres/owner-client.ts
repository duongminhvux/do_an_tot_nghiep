import { ServiceUnavailableException } from '@nestjs/common';
import { serviceUrl } from './ownership.js';
export async function ownerRequest<T>(owner: string, path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token || token.length < 24) throw new ServiceUnavailableException('Internal source authentication unavailable');
  try {
    const response = await fetch(`${serviceUrl(owner)}/api/_internal/${path}`, {
      method, headers: { 'x-internal-token': token, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Owner ${owner} returned ${response.status}`);
    const result = await response.json();
    return result.data ?? result;
  } catch (error) { throw new ServiceUnavailableException('Owner data temporarily unavailable', { cause: error }); }
}

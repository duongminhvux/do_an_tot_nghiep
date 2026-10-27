import { ServiceUnavailableException } from '@nestjs/common';
import { serviceUrl } from '../../../postgres/ownership.js';

export async function mistakeSource<T>(
  owner: 'content' | 'assessment',
  path: string,
  body: unknown,
): Promise<T> {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token || token.length < 24)
    throw new ServiceUnavailableException(
      'Internal source authentication unavailable',
    );
  try {
    const response = await fetch(
      `${serviceUrl(owner)}/api/_internal/mistakes/${path}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': token,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) throw new Error('Source unavailable');
    const value = await response.json();
    return value.data ?? value;
  } catch {
    throw new ServiceUnavailableException(
      'Mistake source temporarily unavailable',
    );
  }
}

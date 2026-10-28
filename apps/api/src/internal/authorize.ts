import { ForbiddenException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { serviceRole } from '../postgres/ownership.js';
export function authorizeInternal(token: string, roles?: readonly string[]) {
  const expected = Buffer.from(process.env.INTERNAL_SERVICE_TOKEN ?? ''), actual = Buffer.from(token ?? '');
  if ((roles && !roles.includes(serviceRole() ?? '')) || expected.length < 24 || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new ForbiddenException('Internal service credentials required');
}

import { BadRequestException } from '@nestjs/common';
import { isEmail, isURL } from 'class-validator';

/** Explicit allowlists also protect direct service callers, independent of global pipe settings. */
export function iamObject(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Expected an object');
  const object = value as Record<string, unknown>;
  if (Object.keys(object).some((key) => !allowed.includes(key)))
    throw new BadRequestException('Unknown IAM field');
  return object;
}
export function iamText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new BadRequestException(`Invalid ${field}`);
  return value.trim();
}
export function iamId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new BadRequestException('Invalid ID');
  return value.toLowerCase();
}
export function iamIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new BadRequestException('Expected at most 100 role IDs');
  return [...new Set(value.map(iamId))].sort();
}
export function iamEmail(value: unknown): string {
  const email = iamText(value, 'email', 254).toLowerCase();
  if (!isEmail(email)) throw new BadRequestException('Invalid email');
  return email;
}
export function iamUsername(value: unknown): string {
  const username = iamText(value, 'username', 100);
  if (/[\s@]/.test(username)) throw new BadRequestException('Invalid username');
  return username;
}
/** Display name only; never used as a login identifier. */
export function iamFullName(value: unknown): string {
  const name = iamText(value, 'fullName', 150).replace(/\s+/g, ' ');
  if (/[\u0000-\u001f\u007f<>]/.test(name))
    throw new BadRequestException('Invalid fullName');
  return name;
}
/** Login handle derived from the email local part (admins sign in by email). */
export function usernameBaseFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const base = local
    .normalize('NFKD')
    .replace(/[^\w.-]/g, '')
    .toLowerCase()
    .slice(0, 60);
  return base || 'admin';
}
export function iamAvatar(value: unknown): string | null {
  if (value === null) return null;
  const url = iamText(value, 'avatarUrl', 2048);
  if (
    !isURL(url, {
      protocols: ['https'],
      require_protocol: true,
      require_valid_protocol: true,
    })
  )
    throw new BadRequestException('Invalid HTTPS avatar URL');
  return url;
}
export function iamDescription(value: unknown): string | null {
  return value === null ? null : iamText(value, 'description', 2000);
}
export function iamPage(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'string' ||
    !/^[1-9][0-9]*$/.test(value) ||
    Number(value) > max
  )
    throw new BadRequestException('Invalid pagination');
  return Number(value);
}

import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { GmailService } from '../gmail/gmail.service.js';

vi.mock('../users/users.service.js', () => ({ UsersService: class UsersService {} }));
vi.mock('../users/schema/user.schema.js', () => ({
  AuthProvider: { LOCAL: 'local', GOOGLE: 'google' } }));

describe('AuthService.verifyToken', () => {
  const secret = 'test-access-secret';
  const payload = { _id: '507f1f77bcf86cd799439011', role: 'USER' };
  const jwt = new JwtService();
  const findById = vi.fn();
  let service: AuthService;

  beforeEach(async () => {
    findById.mockReset().mockResolvedValue({ _id: payload._id, isDeleted: false });
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findById } },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: new ConfigService({ JWT_ACCESS_SECRET: secret }) },
        { provide: GmailService, useValue: {} },
        { provide: I18nService, useValue: {} },
      ] }).compile();
    service = module.get(AuthService);
  });

  it('returns the verified user payload', async () => {
    const token = await jwt.signAsync(payload, { secret, expiresIn: '1h' });
    await expect(service.verifyToken(token)).resolves.toMatchObject(payload);
    expect(findById).toHaveBeenCalledWith(payload._id);
  });

  it.each(['', ' ', 'invalid.jwt.token'])('rejects an invalid token %j', async (token) => {
    await expect(service.verifyToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejects an expired access token', async () => {
    const token = await jwt.signAsync(payload, { secret, expiresIn: -1 });
    await expect(service.verifyToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the refresh secret', async () => {
    const token = await jwt.signAsync(payload, { secret: 'test-refresh-secret' });
    await expect(service.verifyToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it.each([
    { role: 'USER' },
    { _id: 'invalid-id', role: 'USER' },
    { ...payload, role: 'ADMIN' },
  ])('rejects an invalid user payload %j', async (claims) => {
    const token = await jwt.signAsync(claims, { secret });
    await expect(service.verifyToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findById).not.toHaveBeenCalled();
  });

  it.each([null, { _id: payload._id, isDeleted: true }])('rejects a missing or deleted user %j', async (user) => {
    findById.mockResolvedValue(user);
    const token = await jwt.signAsync(payload, { secret });
    await expect(service.verifyToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

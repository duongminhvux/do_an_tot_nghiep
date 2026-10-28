import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import {I18nService} from 'nestjs-i18n';
import {UsersService} from '../users/users.service.js';
import {NotificationClient} from '../../common/clients/notification-client.js';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService,{provide:ConfigService,useValue:new ConfigService()},{provide:JwtService,useValue:{}},{provide:I18nService,useValue:{}},{provide:UsersService,useValue:{}},{provide:NotificationClient,useValue:{}}] }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import {I18nService} from 'nestjs-i18n';
import {UsersService} from '../users/users.service.js';
import {NotificationClient} from '../../common/clients/notification-client.js';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{provide:AuthService,useValue:{}},{provide:ConfigService,useValue:new ConfigService()},{provide:JwtService,useValue:{}},{provide:I18nService,useValue:{}},{provide:UsersService,useValue:{}},{provide:NotificationClient,useValue:{}}] }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

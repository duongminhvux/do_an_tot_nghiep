import {ConfigService} from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GmailService } from './gmail.service.js';

describe('GmailService', () => {
  let service: GmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GmailService,{provide:ConfigService,useValue:new ConfigService()}] }).compile();

    service = module.get<GmailService>(GmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

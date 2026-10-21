import { Global, Module } from '@nestjs/common';
import { DomainOutboxService } from './domain-outbox.service.js';

@Global()
@Module({ providers: [DomainOutboxService], exports: [DomainOutboxService] })
export class DomainEventsModule {}

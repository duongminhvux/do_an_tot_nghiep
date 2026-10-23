import { Module } from '@nestjs/common';

/**
 * Legacy compatibility token, NOT a production composition root.
 * The eight Docker services bootstrap through src/entrypoints/*.ts and
 * PlatformModule.forService(role, ...) to enforce database ownership.
 * Do not register every feature here: that would recreate a monolith and
 * bypass the service-specific wiring.
 */
@Module({})
export class AppModule {}

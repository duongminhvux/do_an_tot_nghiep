import { Module } from '@nestjs/common';
import { PgModelsModule } from '../../postgres/compat.js';
import { Admin, AdminSchema } from './schema/admin.schema.js';
import { AdminsService } from './admins.service.js';

@Module({
  imports: [
    PgModelsModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
  ],
  providers: [AdminsService],
  exports: [AdminsService, PgModelsModule] })
export class AdminsModule { }

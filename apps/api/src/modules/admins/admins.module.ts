import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Admin, AdminSchema } from './schema/admin.schema.js';
import { AdminsService } from './admins.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
  ],
  providers: [AdminsService],
  exports: [AdminsService, MongooseModule],
})
export class AdminsModule { }

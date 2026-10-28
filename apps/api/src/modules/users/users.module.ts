import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { PublicProfilesController } from './public-profiles.controller.js';












@Module({
  imports: [],
  controllers: [UsersController, AdminUsersController, PublicProfilesController],
  providers: [UsersService],
  exports: [UsersService] })
export class UsersModule {}


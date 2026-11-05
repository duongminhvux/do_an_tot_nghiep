import { PermissionCondition, RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import {
Body,
Delete,
Get,
Param,
Patch,
Post,
Query
} from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { CreateAdminUserDto,UpdateAdminUserDto } from './dto/create-admin-user.dto.js';
import { QueryAdminUserDto } from './dto/query-admin-user.dto.js';
import { UsersService } from './users.service.js';

@AdminController('users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions('users.read')
  @Get()
  findAll(@Query() query: QueryAdminUserDto) {
    return this.usersService.findAllAdmin(query);
  }

  @RequirePermissions('users.read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOneAdmin(id);
  }

  @RequirePermissions('users.read')
  @Get(':id/overview')
  getOverview(@Param('id') id: string) {
    return this.usersService.getUserOverviewAdmin(id);
  }

  @RequirePermissions('users.read')
  @Get(':id/progress')
  getProgress(@Param('id') id: string) {
    return this.usersService.getUserProgressAdmin(id);
  }

  @RequirePermissions('users.read', 'audit.read')
  @Get(':id/activity')
  getActivity(@Param('id') id: string) {
    return this.usersService.getUserActivityAdmin(id);
  }

  @RequirePermissions('users.create')
  @PermissionCondition('C1')
  @Post()
  create(@Body() createDto: CreateAdminUserDto) {
    return this.usersService.createAdmin(createDto);
  }

  @RequirePermissions('users.update')
  @PermissionCondition('C1')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAdminUserDto,
  ) {
    return this.usersService.updateAdmin(id, updateDto);
  }

  @RequirePermissions('users.lock')
  @Patch(':id/toggle-ban')
  toggleBan(@Param('id') id: string) {
    return this.usersService.toggleBan(id);
  }

  @RequirePermissions('users.update')
  @Patch(':id/notes')
  updateNotes(
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.usersService.updateNotes(id, notes || '');
  }

  @RequirePermissions('users.delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.removeAdmin(id);
  }
}

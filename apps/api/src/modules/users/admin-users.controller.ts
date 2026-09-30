import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { UsersService } from './users.service.js';
import { QueryAdminUserDto } from './dto/query-admin-user.dto.js';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/create-admin-user.dto.js';

@AdminController('users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query() query: QueryAdminUserDto) {
    return this.usersService.findAllAdmin(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOneAdmin(id);
  }

  @Post()
  create(@Body() createDto: CreateAdminUserDto) {
    return this.usersService.createAdmin(createDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAdminUserDto,
  ) {
    return this.usersService.updateAdmin(id, updateDto);
  }

  @Patch(':id/toggle-ban')
  toggleBan(@Param('id') id: string) {
    return this.usersService.toggleBan(id);
  }

  @Patch(':id/notes')
  updateNotes(
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.usersService.updateNotes(id, notes || '');
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.removeAdmin(id);
  }
}

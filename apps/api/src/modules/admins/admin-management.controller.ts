import { Body, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { AdminController } from '../auth/decorators/admin-controller.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { AdminManagementService } from './admin-management.service.js';

@AdminController('admins')
export class AdminAccountsController {
  constructor(private readonly management: AdminManagementService) {}
  @RequirePermissions('admins.read')
  @Get()
  list(@Req() req: any, @Query() query: Record<string, unknown>) {
    return this.management.listAdmins(req.user, query);
  }
  @RequirePermissions('admins.read')
  @Get(':id')
  detail(@Req() req: any, @Param('id') id: string) {
    return this.management.getAdmin(req.user, id);
  }
  @RequirePermissions('admins.create')
  @Post()
  create(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.management.createAdmin(req.user, body);
  }
  @RequirePermissions('admins.update')
  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.management.updateAdmin(req.user, id, body);
  }
  @RequirePermissions('admins.lock')
  @Patch(':id/status')
  status(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.management.setStatus(req.user, id, body);
  }
  @RequirePermissions('admins.update')
  @Put(':id/roles')
  roles(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.management.setAdminRoles(req.user, id, body);
  }
}

@AdminController('roles')
export class AdminRolesController {
  constructor(private readonly management: AdminManagementService) {}
  @RequirePermissions('roles.read')
  @Get()
  list(@Req() req: any) {
    return this.management.listRoles(req.user);
  }
  @RequirePermissions('roles.read')
  @Get('matrix')
  matrix(@Req() req: any) {
    return this.management.matrix(req.user);
  }
  @RequirePermissions('roles.manage')
  @Post()
  create(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.management.createRole(req.user, body);
  }
  @RequirePermissions('roles.manage')
  @Patch(':id')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.management.updateRole(req.user, id, body);
  }
  @RequirePermissions('roles.manage')
  @Put(':id/permissions')
  permissions(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.management.setRolePermissions(req.user, id, body);
  }
}

@AdminController('permissions')
export class AdminPermissionsController {
  constructor(private readonly management: AdminManagementService) {}
  @RequirePermissions('roles.read')
  @Get()
  list(@Req() req: any) {
    return this.management.listPermissions(req.user);
  }
}

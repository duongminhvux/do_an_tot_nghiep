import { AdminActivationService } from './admin-activation.service.js';
import {
  AdminActivationController,
  AdminReinviteController,
  AdminActivationDeliveryController,
  ActivationRateLimiter,
} from './admin-activation.controller.js';
import { AdminManagementService } from './admin-management.service.js';
import {
  AdminAccountsController,
  AdminRolesController,
  AdminPermissionsController,
} from './admin-management.controller.js';
import { AdminAuthorizationService } from './admin-authorization.service.js';
import { Module } from '@nestjs/common';
import { AdminRbacService } from './admin-rbac.service.js';
import { RbacRepository } from './rbac.repository.js';
import { AdminsService } from './admins.service.js';

@Module({
  controllers: [
    AdminActivationController,
    AdminReinviteController,
    AdminActivationDeliveryController,
    AdminAccountsController,
    AdminRolesController,
    AdminPermissionsController,
  ],
  providers: [
    AdminActivationService,
    ActivationRateLimiter,
    AdminManagementService,
    AdminsService,
    RbacRepository,
    AdminRbacService,
    AdminAuthorizationService,
  ],
  exports: [
    AdminsService,
    RbacRepository,
    AdminRbacService,
    AdminAuthorizationService,
  ],
})
export class AdminsModule {}

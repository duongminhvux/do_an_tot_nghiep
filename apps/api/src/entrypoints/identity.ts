import { bootstrapService } from '../platform/bootstrap.js';
import { AuthModule } from '../modules/auth/auth.module.js';
import { UsersModule } from '../modules/users/users.module.js';
import { AdminsModule } from '../modules/admins/admins.module.js';

void bootstrapService('identity', [AuthModule, UsersModule, AdminsModule]);

import { NotificationInternalModule } from '../internal/notification-internal.module.js';
import { ActivityLogsModule } from '../modules/activity-logs/activity-logs.module.js';
import { ServiceJwtModule } from '../modules/auth/service-jwt.module.js';
import { GmailModule } from '../modules/gmail/gmail.module.js';
import { bootstrapService } from '../platform/bootstrap.js';

void bootstrapService('notification', [ServiceJwtModule, GmailModule, ActivityLogsModule, NotificationInternalModule]);

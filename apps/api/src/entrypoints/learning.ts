import { bootstrapService } from '../platform/bootstrap.js';
import { ServiceJwtModule } from '../modules/auth/service-jwt.module.js';
import { LearningModule } from '../modules/learning/learning.module.js';
import { MiniGameModule } from '../modules/minigame/minigame.module.js';
import { DashboardModule } from '../modules/dashboard/dashboard.module.js';

void bootstrapService('learning', [ServiceJwtModule, LearningModule, MiniGameModule, DashboardModule]);

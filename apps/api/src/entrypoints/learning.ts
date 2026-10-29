import { ServiceJwtModule } from '../modules/auth/service-jwt.module.js';
import { LearningMediaLibraryModule } from '../modules/media-library/media-library.module.js';
import { DashboardModule } from '../modules/dashboard/dashboard.module.js';
import { LearningModule } from '../modules/learning/learning.module.js';
import { MiniGameModule } from '../modules/minigame/minigame.module.js';
import { bootstrapService } from '../platform/bootstrap.js';

void bootstrapService('learning', [ServiceJwtModule, LearningModule, MiniGameModule, DashboardModule, LearningMediaLibraryModule]);

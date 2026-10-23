import { bootstrapService } from '../platform/bootstrap.js';
import { ServiceJwtModule } from '../modules/auth/service-jwt.module.js';
import { AiImportModule } from '../modules/assessment/ai-import.module.js';

void bootstrapService('ai-import', [ServiceJwtModule, AiImportModule]);

import { AiImportModule } from '../modules/assessment/ai-import.module.js';
import { ServiceJwtModule } from '../modules/auth/service-jwt.module.js';
import { bootstrapService } from '../platform/bootstrap.js';

void bootstrapService('ai-import', [ServiceJwtModule, AiImportModule]);

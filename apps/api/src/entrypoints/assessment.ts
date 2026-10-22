import { bootstrapService } from '../platform/bootstrap.js';
import { ServiceJwtModule } from '../modules/auth/service-jwt.module.js';
import { AssessmentModule } from '../modules/assessment/assessment.module.js';
import { AssessmentAudioOwnerModule } from '../internal/audio-owner-sync.module.js';

void bootstrapService('assessment', [ServiceJwtModule, AssessmentModule, AssessmentAudioOwnerModule]);

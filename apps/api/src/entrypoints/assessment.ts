import { AssessmentAudioOwnerModule } from '../internal/audio-owner-sync.module.js';
import { AssessmentModule } from '../modules/assessment/assessment.module.js';
import { ServiceJwtModule } from '../modules/auth/service-jwt.module.js';
import { bootstrapService } from '../platform/bootstrap.js';

void bootstrapService('assessment', [ServiceJwtModule, AssessmentModule, AssessmentAudioOwnerModule]);

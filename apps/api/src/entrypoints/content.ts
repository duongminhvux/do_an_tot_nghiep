import { ContentAudioOwnerModule } from '../internal/audio-owner-sync.module.js';
import { ServiceJwtModule } from '../modules/auth/service-jwt.module.js';
import { DictationModule } from '../modules/dictation/dictation.module.js';
import { UploadModule } from '../modules/upload/upload.module.js';
import { VocabularyModule } from '../modules/vocabulary/vocabulary.module.js';
import { bootstrapService } from '../platform/bootstrap.js';

void bootstrapService('content', [ServiceJwtModule, VocabularyModule, DictationModule, UploadModule, ContentAudioOwnerModule]);

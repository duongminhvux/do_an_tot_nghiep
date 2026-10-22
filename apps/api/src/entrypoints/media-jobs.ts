import { bootstrapService } from '../platform/bootstrap.js';
import { ServiceJwtModule } from '../modules/auth/service-jwt.module.js';
import { AudioProcessingModule } from '../modules/audio-processing/audio-processing.module.js';
import { AsrModule } from '../modules/asr/asr.module.js';
import { TtsModule } from '../modules/tts/tts.module.js';

void bootstrapService('media-jobs', [ServiceJwtModule, AudioProcessingModule, AsrModule, TtsModule]);

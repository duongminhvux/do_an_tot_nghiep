import { AsrModule } from '../modules/asr/asr.module.js';
import { AudioProcessingModule } from '../modules/audio-processing/audio-processing.module.js';
import { ServiceJwtModule } from '../modules/auth/service-jwt.module.js';
import { SiteSettingsModule } from '../modules/site-settings/site-settings.module.js';
import { TtsModule } from '../modules/tts/tts.module.js';
import { bootstrapService } from '../platform/bootstrap.js';

void bootstrapService('media-jobs', [ServiceJwtModule, AudioProcessingModule, AsrModule, TtsModule, SiteSettingsModule]);

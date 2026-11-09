import { PartialType } from '@nestjs/mapped-types';
import { CreateDictationDto } from './create-dictation.dto.js';

export class UpdateDictationDto extends PartialType(CreateDictationDto) {
  constructor(){
    super();
    // PATCH must preserve omitted fields rather than applying create defaults.
    delete this.audioSource;delete this.sourceText;delete this.language;
    delete this.voiceIds;delete this.speed;delete this.pauseAfterMs;
  }
}

import { Module } from '@nestjs/common';

import { SavedWordsController } from './saved-words.controller.js';
import { SavedWordsService } from './saved-words.service.js';





@Module({
  imports: [],
  controllers: [SavedWordsController],
  providers: [SavedWordsService],
  exports: [SavedWordsService] })
export class SavedWordsModule {}

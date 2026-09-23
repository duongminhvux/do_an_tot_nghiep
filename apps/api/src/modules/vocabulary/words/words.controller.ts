import { Controller } from '@nestjs/common';
import { WordsService } from './words.service.js';

@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}
  // User endpoints will be implemented here later
}

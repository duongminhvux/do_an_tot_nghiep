export * from './types';
export * from './auth.service';
export * from './user.service';
export * from './vocabulary.service';
export * from './learning.service';

import { authService } from './auth.service';
import { userService } from './user.service';
import { collectionService, lessonService, wordService } from './vocabulary.service';
import { learningService } from './learning.service';
import { dictationService } from './dictation.service';

export const apiService = {
  auth: authService,
  user: userService,
  collections: collectionService,
  lessons: lessonService,
  words: wordService,
  learning: learningService,
  dictation: dictationService,
};

export default apiService;
export * from './dictation.service';

export * from './types';
export * from './auth.service';
export * from './user.service';
export * from './vocabulary.service';

import { authService } from './auth.service';
import { userService } from './user.service';
import { collectionService, lessonService, wordService } from './vocabulary.service';

export const apiService = {
  auth: authService,
  user: userService,
  collections: collectionService,
  lessons: lessonService,
  words: wordService,
};

export default apiService;

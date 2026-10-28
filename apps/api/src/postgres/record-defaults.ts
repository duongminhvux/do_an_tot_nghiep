/** Application defaults for native INSERTs; PostgreSQL owns constraints and indexes. */
const defaults:Record<string,Record<string,unknown>>={
  "users": {
    "authProvider": "local",
    "isVerified": false,
    "isDeleted": false,
    "isBanned": false,
    "lastActive": {
      "__nativeCurrentTime": true
    },
    "notes": ""
  },
  "activitylogs": {
    "userEmail": null,
    "userName": null,
    "role": "USER",
    "category": "GENERAL",
    "description": "",
    "metadata": {},
    "ipAddress": null,
    "userAgent": null,
    "status": "SUCCESS",
    "durationMs": 0
  },
  "arenasettings": {
    "revision": 0,
    "config": {
      "maintenance": false,
      "hints": {
        "startAfterSeconds": 10,
        "intervalSeconds": 5,
        "maxPercent": 30
      },
      "audio": {
        "audioEnabled": true,
        "backgroundMusicUrl": "",
        "correctSoundUrl": "",
        "wrongSoundUrl": "",
        "loseSoundUrl": ""
      },
      "ranked": {
        "enabled": true,
        "defaultRating": 1000,
        "kFactor": 32,
        "ratingRange": 100,
        "questionCount": 10,
        "timePerQuestion": 30,
        "readyTimeout": 30,
        "reconnectGrace": 20
      },
      "rankedConnection": {
        "rankedPauseEnabled": true,
        "reloadGraceSeconds": 3,
        "disconnectTimeoutSeconds": 60,
        "resumeCountdownSeconds": 3,
        "maxTotalPauseSeconds": 120,
        "maxPauseCount": 3,
        "idleDetectionEnabled": false,
        "idleTimeoutSeconds": 120,
        "idleChallengeTimeoutSeconds": 15,
        "bothDisconnectedPolicy": "CANCEL_NO_RATING"
      },
      "friendly": {
        "enabled": true,
        "inviteTimeout": 10,
        "reconnectGrace": 20
      },
      "group": {
        "enabled": true,
        "maxPlayers": 8,
        "roomIdleTimeout": 1800,
        "reconnectGrace": 20
      }
    }
  },
  "arenamatches": {
    "runtimePolicy": null,
    "rankedState": null,
    "friendMode": null,
    "nextMatchId": null,
    "lobbyStarting": false,
    "hostId": null,
    "currentTurnUserId": null,
    "currentWord": "",
    "requiredLetter": "",
    "turnStartedAt": null,
    "turnDeadline": null,
    "chainPausedAt": null,
    "usedWords": [],
    "wordGuessAnswer": null,
    "wordGuessAttempts": [],
    "wordGuessRevision": 0,
    "wordGuessSolvedBy": null,
    "turnCount": 0,
    "roomId": null,
    "status": "WAITING",
    "questionMode": null,
    "questionCount": 10,
    "eliminatedUserIds": [],
    "roomRevision": 0,
    "currentQuestionIndex": 1,
    "secondsPerQuestion": 15,
    "startedAt": null,
    "finishedAt": null,
    "winnerId": null,
    "isDraw": false,
    "cancelReason": null,
    "finishReason": null,
    "roomCodeSnapshot": null,
    "settingsSnapshot": null,
    "audioSettings": null
  },
  "arenainvitations": {
    "mode": "CLASSIC",
    "rematchOf": null,
    "status": "PENDING"
  },
  "arenamatchplayers": {
    "readyMode": null,
    "returnedToLobby": false,
    "leftLobby": false,
    "score": 0,
    "correctAnswers": 0,
    "wrongAnswers": 0,
    "unanswered": 0,
    "longestStreak": 0,
    "currentStreak": 0,
    "totalResponseTimeMs": 0,
    "scoredQuestionIds": [],
    "ratingBefore": 0,
    "ratingAfter": 0,
    "ratingChange": 0,
    "isReady": false,
    "readyAt": null,
    "disconnectedAt": null,
    "status": "PLAYING"
  },
  "arenamatchquestions": {
    "options": [],
    "resolvedAt": null,
    "winnerId": null
  },
  "arenaplayeranswers": {
    "attempts": 0,
    "isCorrect": false,
    "timedOut": false,
    "responseTimeMs": 0,
    "earnedScore": 0,
    "streakAtAnswer": 0
  },
  "arenaprofiles": {
    "rating": 1000,
    "rankedMatches": 0,
    "rankedWins": 0,
    "rankedLosses": 0,
    "rankedDraws": 0,
    "currentWinStreak": 0,
    "bestWinStreak": 0
  },
  "arenaratinghistories": {},
  "arenarooms": {
    "status": "WAITING",
    "visibility": "PRIVATE",
    "questionMode": "MIXED",
    "questionCount": 20,
    "secondsPerQuestion": 15,
    "maxPlayers": 8,
    "vocabularySource": "GLOBAL",
    "members": []
  },
  "friendrooms": {
    "runtimePolicy": null,
    "guestId": null,
    "status": "WAITING",
    "maxPlayers": 2,
    "members": [],
    "guestReady": false,
    "currentMatchId": null,
    "matchCount": 0,
    "revision": 0,
    "hostDisconnectedAt": null,
    "guestDisconnectedAt": null
  },
  "attemptanswers": {
    "isCorrect": false
  },
  "attempts": {
    "answers": {},
    "audioPlayCounts": {},
    "flaggedQuestions": [],
    "currentQuestionIndex": 0,
    "status": "IN_PROGRESS",
    "totalQuestions": 0,
    "answeredQuestions": 0,
    "correctAnswers": 0
  },
  "examgroups": {
    "order": 0,
    "isActive": true,
    "isDeleted": false
  },
  "exams": {
    "publicationStatus": "DRAFT",
    "publicationRevision": 1,
    "totalQuestions": 0,
    "durationMinutes": 0,
    "isActive": true,
    "order": 0,
    "groupId": null,
    "groupOrder": 0,
    "isDeleted": false
  },
  "passagegroups": {
    "order": 0
  },
  "passages": {
    "audioMeta": {},
    "order": 0
  },
  "questions": {
    "content": "",
    "audioMeta": {},
    "order": 0,
    "isActive": true
  },
  "dictationtopics": {
    "description": "",
    "thumbnailUrl": "",
    "thumbnailPublicId": "",
    "order": 0,
    "isActive": true,
    "isDeleted": false
  },
  "dictationsections": {
    "description": "",
    "order": 0,
    "isActive": true,
    "isDeleted": false
  },
  "dictationlessons": {
    "publicationStatus": "DRAFT",
    "publicationRevision": 1,
    "description": "",
    "level": "B1",
    "topic": "General",
    "order": 0,
    "thumbnailUrl": "",
    "audioSource": "TTS",
    "sourceText": "",
    "language": "en-US",
    "voiceIds": [
      "af_heart"
    ],
    "speed": 1,
    "pauseAfterMs": 300,
    "status": "DRAFT",
    "sentenceCount": 0,
    "totalDurationMs": 0,
    "fullAudioUrl": "",
    "fullAudioStorageKey": "",
    "fullAudioPublicId": "",
    "processingError": "",
    "audioProcessor": "",
    "audioProcessorDevice": "",
    "isDeleted": false
  },
  "dictationprogresses": {
    "currentSegment": 0,
    "completedSegments": [],
    "revealedSegments": [],
    "segmentProgress": [],
    "correctCount": 0,
    "wrongCount": 0,
    "attempts": 0,
    "transcriptRevealed": false,
    "completed": false,
    "lastPracticedAt": {
      "__nativeCurrentTime": true
    }
  },
  "dictationsegments": {
    "normalizedText": "",
    "speaker": "",
    "voiceId": "",
    "speed": 1,
    "confidence": 0,
    "words": [],
    "audioUrl": "",
    "audioPublicId": ""
  },
  "userdailyactivities": {
    "studyMinutes": 0,
    "wordsLearned": 0,
    "wordsReviewed": 0,
    "sessionCount": 0
  },
  "userlessonprogresses": {
    "status": "NOT_STARTED",
    "progress": 0
  },
  "userlessonwords": {},
  "userwordreviews": {
    "status": "LEARNING",
    "reviewCount": 0,
    "correctCount": 0,
    "incorrectCount": 0,
    "intervalDays": 0
  },
  "usersavedwords": {
    "savedAt": {
      "__nativeCurrentTime": true
    }
  },
  "vocabularyfolders": {
    "description": ""
  },
  "learningsessionwords": {},
  "learningsessions": {
    "durationSeconds": 0,
    "totalWords": 0,
    "completedWords": 0
  },
  "learning_activities": {},
  "gamedefinitions": {
    "settings": null,
    "nameEn": "",
    "description": "",
    "descriptionEn": "",
    "imageUrl": "",
    "badge": null,
    "category": "SOLO",
    "order": 0,
    "isActive": true
  },
  "minigameresults": {},
  "vocabularygroups": {
    "order": 1,
    "isActive": true,
    "isDeleted": false
  },
  "collections": {
    "order": 1,
    "isActive": true,
    "isDeleted": false
  },
  "lessons": {
    "publicationStatus": "DRAFT",
    "publicationRevision": 1,
    "order": 1,
    "isActive": true,
    "isDeleted": false
  },
  "words": {
    "publicationStatus": "DRAFT",
    "publicationRevision": 1,
    "ipa": {},
    "audio": {},
    "audioMeta": {},
    "variations": [],
    "relatedWords": [],
    "parts": [],
    "isActive": true,
    "isDeleted": false
  },
  "sections": {
    "order": 1
  },
  "lessonwords": {
    "order": 0
  }
};
const dates:Record<string,string[]>={
  "users": [
    "codeExpiresAt",
    "deletedAt",
    "lastActive",
    "profileUpdatedAt"
  ],
  "activitylogs": [
    "createdAt",
    "updatedAt"
  ],
  "arenasettings": [],
  "arenamatches": [
    "turnStartedAt",
    "turnDeadline",
    "chainPausedAt",
    "startedAt",
    "finishedAt",
    "createdAt",
    "updatedAt"
  ],
  "arenainvitations": [
    "expiresAt",
    "createdAt",
    "updatedAt"
  ],
  "arenamatchplayers": [
    "readyAt",
    "disconnectedAt",
    "finishedAt",
    "createdAt",
    "updatedAt"
  ],
  "arenamatchquestions": [
    "startedAt",
    "resolvedAt",
    "createdAt",
    "updatedAt"
  ],
  "arenaplayeranswers": [
    "answeredAt",
    "createdAt",
    "updatedAt"
  ],
  "arenaprofiles": [
    "createdAt",
    "updatedAt"
  ],
  "arenaratinghistories": [
    "createdAt",
    "updatedAt"
  ],
  "arenarooms": [
    "members[].joinedAt",
    "createdAt",
    "updatedAt"
  ],
  "friendrooms": [
    "members[].disconnectedAt",
    "hostDisconnectedAt",
    "guestDisconnectedAt",
    "createdAt",
    "updatedAt"
  ],
  "attemptanswers": [
    "answeredAt"
  ],
  "attempts": [
    "startedAt",
    "completedAt",
    "expiresAt",
    "submittedAt"
  ],
  "examgroups": [],
  "exams": [],
  "passagegroups": [],
  "passages": [
    "audioMeta.generatedAt"
  ],
  "questions": [
    "audioMeta.generatedAt"
  ],
  "dictationtopics": [],
  "dictationsections": [],
  "dictationlessons": [
    "publishedAt"
  ],
  "dictationprogresses": [
    "segmentProgress[].completedAt",
    "transcriptRevealedAt",
    "lastPracticedAt"
  ],
  "dictationsegments": [],
  "userdailyactivities": [
    "date"
  ],
  "userlessonprogresses": [
    "startedAt",
    "lastStudiedAt",
    "completedAt"
  ],
  "userlessonwords": [
    "learnedAt",
    "completedAt"
  ],
  "userwordreviews": [
    "lastReviewedAt",
    "nextReviewAt"
  ],
  "usersavedwords": [
    "savedAt"
  ],
  "vocabularyfolders": [
    "createdAt",
    "updatedAt"
  ],
  "learningsessionwords": [
    "answeredAt",
    "scheduledAt"
  ],
  "learningsessions": [
    "startedAt",
    "endedAt"
  ],
  "learning_activities": [
    "occurredAt",
    "createdAt"
  ],
  "gamedefinitions": [],
  "minigameresults": [
    "createdAt"
  ],
  "vocabularygroups": [],
  "collections": [],
  "lessons": [],
  "words": [
    "audioMeta.us.generatedAt",
    "audioMeta.uk.generatedAt"
  ],
  "sections": [],
  "lessonwords": []
};
export function nativeDefaults(table:string):Record<string,unknown>{
 const values=structuredClone(defaults[table]??{});
 for(const [key,value]of Object.entries(values))if(value&&typeof value==='object'&&'__nativeCurrentTime' in value)values[key]=new Date();
 return values;
}
export function normalizeNativeDates(table:string,data:any){
 for(const [key,value]of Object.entries(data))if(defaults[table]?.[key]!==null&&typeof defaults[table]?.[key]==='object'&&typeof value==='string'){try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object')data[key]=parsed;}catch{/* Preserve malformed stored text for repair. */}}
 function visit(value:any,parts:string[]){if(!value)return;const [key,...tail]=parts;if(key.endsWith('[]')){const list=value[key.slice(0,-2)];if(Array.isArray(list))for(const item of list)visit(item,tail);return;}
 if(tail.length){visit(value[key],tail);return;}if(value[key]!=null&&!(value[key]instanceof Date)){const parsed=new Date(value[key]);if(Number.isFinite(parsed.getTime()))value[key]=parsed;}}
 for(const field of dates[table]??[])visit(data,field.split('.'));return data;
}

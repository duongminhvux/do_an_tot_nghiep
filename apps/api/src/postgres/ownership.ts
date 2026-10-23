/** Read contracts between services. Credentials always stay with the database owner. */
export const OWNED_TABLES: Record<string, readonly string[]> = {
  identity: ['users', 'admins'],
  content: ['collections', 'dictationlessons', 'dictationprogresses', 'dictationsections', 'dictationsegments', 'dictationtopics', 'lessons', 'lessonwords', 'sections', 'vocabularygroups', 'words', 'youtubelessons'],
  assessment: ['attemptanswers', 'attempts', 'examgroups', 'exams', 'passagegroups', 'passages', 'questions', 'pdf_ai_correction_events'],
  arena: ['arenainvitations', 'arenamatches', 'arenamatchplayers', 'arenamatchquestions', 'arenaplayeranswers', 'arenaprofiles', 'arenaratinghistories', 'arenarooms', 'arenasettings', 'friendrooms'],
  learning: ['gamedefinitions', 'learning_activities', 'learningsessions', 'learningsessionwords', 'minigameresults', 'userdailyactivities', 'userlessonprogresses', 'userlessonwords', 'usersavedwords', 'userwordreviews', 'vocabularyfolders'],
  'media-jobs': ['asr_jobs', 'audio_jobs', 'media_assets', 'system_settings'],
  'ai-import': ['pdf_ai_correction_events'],
  notification: ['activitylogs', 'notifications'],
};

export function serviceRole() {
  return process.env.SERVICE_ROLE === 'audio-worker' ? 'media-jobs' : process.env.SERVICE_ROLE;
}

export function tableOwner(table: string, role = serviceRole()): string | undefined {
  // Both Assessment's delivery outbox and AI Import's processing records are local.
  if (role && OWNED_TABLES[role]?.includes(table)) return role;
  return Object.keys(OWNED_TABLES).find(owner => OWNED_TABLES[owner].includes(table));
}

export function serviceUrl(role: string) {
  return process.env[`${role.replaceAll('-', '_').toUpperCase()}_INTERNAL_URL`]
    || `http://${role}-service:5000`;
}

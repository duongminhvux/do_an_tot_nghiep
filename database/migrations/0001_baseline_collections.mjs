// Non-destructive baseline. Do not drop existing collections or data.
// The model definitions (*.schema.ts) still validate documents in NestJS.
export async function up(db) {
  const collections = [
    'users', 'admins', 'vocabularygroups', 'collections', 'lessons',
    'words', 'lessonwords', 'exams', 'questions', 'passages',
    'dictationtopics', 'dictationlessons', 'youtubelessons',
    'audio_jobs', 'media_assets', 'system_settings',
  ];
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of collections) {
    if (!existing.has(name)) await db.createCollection(name);
  }
}

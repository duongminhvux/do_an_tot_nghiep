// Additive core indexes that are required for data integrity when autoIndex=false.
// Conflicting existing indexes or duplicate documents stop the migration.
export async function up(db) {
  const required = [
    ['users', {email: 1}, {unique: true}],
    ['users', {ggId: 1}, {unique: true, sparse: true}],
    ['admins', {email: 1}, {unique: true}],
    ['words', {word: 1}, {unique: true}],
    ['words', {slug: 1}, {unique: true}],
    ['lessonwords', {lessonId: 1, wordId: 1}, {unique: true}],
    ['sections', {lessonId: 1, slug: 1}, {unique: true}],
    ['lessons', {collectionId: 1, slug: 1}, {unique: true}],
    ['dictationsegments', {lessonId: 1, order: 1}, {unique: true}],
    ['dictationprogresses', {userId: 1, lessonId: 1}, {unique: true}],
    ['arenamatchplayers', {matchId: 1, userId: 1}, {unique: true}],
    ['arenamatchquestions', {matchId: 1, order: 1}, {unique: true}],
    ['arenaratinghistories', {matchId: 1, userId: 1}, {unique: true}],
    ['userdailyactivities', {userId: 1, date: 1}, {unique: true}],
  ];
  const present = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const [name, fields, options] of required) {
    if (!present.has(name)) { await db.createCollection(name); present.add(name); }
    const col = db.collection(name);
    const matching = (await col.indexes()).some((index) =>
      JSON.stringify(index.key) === JSON.stringify(fields) &&
      Boolean(index.unique) === Boolean(options.unique) &&
      Boolean(index.sparse) === Boolean(options.sparse));
    if (!matching) await col.createIndex(fields, options);
  }
}

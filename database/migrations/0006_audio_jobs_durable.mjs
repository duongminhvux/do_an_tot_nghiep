export async function up(db) {
  await db.collection('audio_jobs').createIndex({ id: 1 }, {
    name: 'audio_job_id_unique', unique: true,
    partialFilterExpression: { id: { $type: 'string' } },
  });
}

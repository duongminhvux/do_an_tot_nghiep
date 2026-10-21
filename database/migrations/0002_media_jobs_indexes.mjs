// Stable, additive indexes. No automatic dropIndex / syncIndexes.
export async function up(db) {
  await db.collection('media_assets').createIndex({ bucket: 1, key: 1 }, { unique: true, name: 'unique_bucket_key' });
  await db.collection('audio_jobs').createIndex({ createdAt: -1 }, { name: 'job_created_at' });
  await db.collection('audio_jobs').createIndex({ state: 1, createdAt: -1 }, { name: 'job_state_created' });
}

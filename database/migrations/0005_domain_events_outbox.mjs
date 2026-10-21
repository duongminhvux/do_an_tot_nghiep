// Safe, additive event-relay storage. No existing collection is dropped.
export async function up(db) {
  await db.collection('domain_outbox').createIndex(
    { state: 1, claimUntil: 1, occurredAt: 1 },
    { name: 'outbox_due' },
  );
  await db.collection('processed_domain_events').createIndex(
    { consumer: 1, eventId: 1 },
    { name: 'consumer_event_unique', unique: true },
  );
}

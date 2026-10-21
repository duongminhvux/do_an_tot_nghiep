// Legacy indexes may have incompatible options: do not delete them automatically.
// Validate data and index definitions on real deployments before applying.
export async function up(db) {
  for (const collectionName of ['vocabularygroups', 'collections']) {
    const col = db.collection(collectionName);
    // Existing documents missing isDeleted should be treated as active.
    await col.updateMany({ isDeleted: { $exists: false } }, { $set: { isDeleted: false } });
    for (const field of ['name', 'slug']) {
      const expectedName = `uniq_active_${field}`;
      const indexes = await col.indexes();
      const matches = indexes.filter((index) =>
        index.key?.[field] === 1 && Object.keys(index.key).length === 1);
      if (matches.some((index) => index.unique && index.partialFilterExpression?.isDeleted === false)) continue;
      if (matches.length > 0) {
        throw new Error(`Legacy ${collectionName}.${field} index differs from versioned partial unique index; create a reviewed index migration after backup. No indexes were dropped.`);
      }
      // MongoDB's supported partial filter uses equality rather than $ne.
      await col.createIndex({ [field]: 1 }, {
        name: expectedName, unique: true,
        partialFilterExpression: { isDeleted: false },
      });
    }
  }
}

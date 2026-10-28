import { readFileSync } from 'node:fs';

const owners = {
  content: new URL('../../database/postgres/migrations/content/0018_content_relations.sql', import.meta.url),
  learning: new URL('../../database/postgres/migrations/learning/0018_learning_relations.sql', import.meta.url),
};

export function relationsFor(owner) {
  if (!owners[owner]) throw new Error('Relation preflight supports content and learning');
  return [...readFileSync(owners[owner], 'utf8').matchAll(/ALTER TABLE public\.(\w+) ADD CONSTRAINT (\w+) FOREIGN KEY \(([\w,]+)\) REFERENCES public\.(\w+)\(([\w,]+)\)/g)]
    .map(([, table, constraint, fields, parent, targets]) => ({ table, constraint, fields: fields.split(','), parent, targets: targets.split(',') }));
}

/** All identifiers come from reviewed migration declarations; values never become SQL text. */
export async function checkRelations(db, owner) {
  const result = [];
  for (const relation of relationsFor(owner)) {
    const { table, fields, parent, targets } = relation;
    const where = fields.map(field => `child."${field}" IS NOT NULL`).join(' AND ') +
      ` AND NOT EXISTS (SELECT 1 FROM public."${parent}" parent WHERE ` +
      fields.map((field, index) => `parent."${targets[index]}"=child."${field}"`).join(' AND ') + ')';
    const count = await db.query(`SELECT count(*)::text AS count FROM public."${table}" child WHERE ${where}`);
    const orphanCount = count.rows[0].count;
    const sample = orphanCount === '0' ? [] : (await db.query(`SELECT child.id FROM public."${table}" child WHERE ${where} ORDER BY child.id LIMIT 10`)).rows.map(row => row.id);
    result.push({ owner, constraint: relation.constraint, table, orphanCount, sampleIds: sample });
  }
  return result;
}

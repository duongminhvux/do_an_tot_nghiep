import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { databaseSuite } from '../../../../test/native-database.js';
import { ExamGroupsService } from './exam-groups.service.js';

const suite = databaseSuite('assessment');

async function fixture(statuses: string[]) {
  const service = new ExamGroupsService(suite.db);
  const group = await service.create({ name: `Group ${randomUUID()}` });
  const ids: string[] = [];
  await suite.db.query("SELECT set_config('vocalearn.publication_transition','1',false)");
  try {
    for (const status of statuses) {
      const id = randomUUID();
      await suite.db.query(`INSERT INTO exams(id,name,slug,type,publication_status) VALUES($1::uuid,$2,$2,'TOEIC',$3)`, [id, id, status]);
      ids.push(id);
    }
  } finally {
    await suite.db.query("SELECT set_config('vocalearn.publication_transition','',false)");
  }
  return { service, groupId: String((group as unknown as { _id: string })._id), ids };
}

describe('Adding published exams to a group', () => {
  it('rejects a draft and leaves the group unchanged', async () => {
    const { service, groupId, ids } = await fixture(['DRAFT']);
    await expect(service.addExams(groupId, ids)).rejects.toMatchObject({ status: 400 });
    expect(await service.getExams(groupId)).toEqual([]);
  });

  it('rejects a mixed request atomically rather than adding only the published exam', async () => {
    const { service, groupId, ids } = await fixture(['PUBLISHED', 'DRAFT']);
    await expect(service.addExams(groupId, ids)).rejects.toMatchObject({ status: 400 });
    expect(await service.getExams(groupId)).toEqual([]);
  });

  it('appends published exams in the selected order and ignores duplicate IDs', async () => {
    const { service, groupId, ids } = await fixture(['PUBLISHED', 'PUBLISHED']);
    expect(await service.addExams(groupId, [ids[1]!, ids[0]!, ids[1]!])).toEqual({ updatedCount: 2 });
    expect((await service.getExams(groupId)).map(exam => exam._id)).toEqual([ids[1], ids[0]]);
    const after = await suite.db.query('SELECT publication_status,publication_revision FROM exams WHERE id=ANY($1::uuid[])', [ids]);
    expect(after.rows.every(exam => exam.publication_status === 'PUBLISHED' && exam.publication_revision === 1)).toBe(true);
    expect(await service.addExams(groupId, ids)).toEqual({ updatedCount: 0 });
  });

  it('still invalidates publication when exam content changes', async () => {
    const { ids } = await fixture(['PUBLISHED']);
    await suite.db.query("UPDATE exams SET name='Edited content' WHERE id=$1", [ids[0]]);
    const result = await suite.db.query('SELECT publication_status FROM exams WHERE id=$1', [ids[0]]);
    expect(result.rows[0].publication_status).toBe('DRAFT');
  });

  it('rejects missing and malformed IDs instead of partially adding exams', async () => {
    const { service, groupId, ids } = await fixture(['PUBLISHED']);
    await expect(service.addExams(groupId, [...ids, randomUUID()])).rejects.toMatchObject({ status: 404 });
    await expect(service.addExams(groupId, [...ids, 'invalid'])).rejects.toMatchObject({ status: 400 });
    expect(await service.getExams(groupId)).toEqual([]);
  });
});

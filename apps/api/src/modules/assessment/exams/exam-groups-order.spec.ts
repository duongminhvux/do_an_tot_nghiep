import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createConnection, Types } from 'mongoose';
import { ExamGroupsService } from './exam-groups.service.js';
import { ExamSchema } from './schemas/exam.schema.js';
import { ExamGroupSchema } from './schemas/exam-group.schema.js';

describe.skipIf(!process.env.TOEIC_TEST_MONGO_URI)(
  'exam order inside a group',
  () => {
    const connection = createConnection();
    const prefix = `group_order_${new Types.ObjectId()}_`;
    let service: ExamGroupsService;
    let exams: any;
    let groupId: string;

    beforeAll(async () => {
      await connection.openUri(process.env.TOEIC_TEST_MONGO_URI!, {
        autoIndex: false,
      });
      const groups = connection.model(
        'ExamGroup',
        ExamGroupSchema,
        `${prefix}groups`,
      );
      exams = connection.model('Exam', ExamSchema, `${prefix}exams`);
      service = new ExamGroupsService(groups as never, exams as never);
      groupId = String(
        (await groups.create({ name: 'Group', slug: `${prefix}group` }))._id,
      );
    });

    afterAll(async () => {
      // Other suites share this database in parallel: drop only our collections.
      for (const { name } of await connection.db!.listCollections().toArray())
        if (name.startsWith(prefix)) await connection.db!.dropCollection(name);
      await connection.close();
    });

    const create = (name: string, order: number) =>
      exams.create({ name, slug: `${prefix}${name}`, order, type: 'TOEIC' });

    it('appends added exams, reorders them and rejects incomplete lists', async () => {
      const [a, b, c] = await Promise.all([
        create('a', 1),
        create('b', 2),
        create('c', 3),
      ]);
      const ids = [a, b, c].map((exam) => String(exam._id));
      await service.addExams(groupId, [ids[0]!, ids[1]!]);
      await service.addExams(groupId, [ids[2]!, ids[0]!]); // a is already in
      const names = async () =>
        (await service.getExams(groupId)).map((exam) => exam.name);
      expect(await names()).toEqual(['a', 'b', 'c']);

      await service.reorderExams(groupId, [ids[2]!, ids[0]!, ids[1]!]);
      expect(await names()).toEqual(['c', 'a', 'b']);

      await expect(
        service.reorderExams(groupId, [ids[0]!, ids[1]!]),
      ).rejects.toThrow('every exam');
      await expect(
        service.reorderExams(groupId, [ids[0]!, ids[0]!, ids[1]!]),
      ).rejects.toThrow('every exam');

      await service.removeExam(groupId, ids[0]!);
      expect(await names()).toEqual(['c', 'b']);
      await service.addExams(groupId, [ids[0]!]);
      expect(await names()).toEqual(['c', 'b', 'a']);
    });
  },
);

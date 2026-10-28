import { PgId } from '../../../postgres/compat.js';
import type { Model } from '../../../postgres/compat.js';

/** Position for an exam appended to the end of a group (1-based). */
export async function nextGroupOrder(
  exams: Model<any>,
  groupId: PgId,
): Promise<number> {
  const last = await exams
    .findOne({ groupId, isDeleted: { $ne: true } })
    .sort({ groupOrder: -1 })
    .select('groupOrder')
    .lean()
    .exec();
  return (last?.groupOrder ?? 0) + 1;
}

// Exams placed in a group before `groupOrder` existed keep their global order.
export const GROUP_EXAM_SORT = {
  groupOrder: 1,
  order: 1,
  createdAt: -1,
  _id: 1 } as const;

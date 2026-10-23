import { Model, Types } from 'mongoose';

/** Position for an exam appended to the end of a group (1-based). */
export async function nextGroupOrder(
  exams: Model<any>,
  groupId: Types.ObjectId,
): Promise<number> {
  const last = await exams
    .findOne({ groupId, isDeleted: { $ne: true } })
    .sort({ groupOrder: -1 })
    .select('groupOrder')
    .lean<{ groupOrder?: number }>()
    .exec();
  return (last?.groupOrder ?? 0) + 1;
}

// Exams placed in a group before `groupOrder` existed keep their global order.
export const GROUP_EXAM_SORT = {
  groupOrder: 1,
  order: 1,
  createdAt: -1,
  _id: 1,
} as const;

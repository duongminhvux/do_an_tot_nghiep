import { Types } from 'mongoose';
import { ExamsService } from './exams.service.js';

function fixture(orders = [4, 5, 5, 9]) {
  const rows: any[] = orders.map((order, index) => ({
    _id: new Types.ObjectId(),
    name: `Exam ${index + 1}`,
    slug: `exam-${index + 1}`,
    order,
    isDeleted: false,
  }));
  const matches = (row: any, filter: any) =>
    Object.entries(filter).every(([key, value]: any) => {
      if (value?.$ne !== undefined)
        return String(row[key]) !== String(value.$ne);
      if (value?.$regex) return value.$regex.test(row[key]);
      return String(row[key]) === String(value);
    });
  const query = (get: () => any) => {
    let sort: Record<string, number> = {};
    const q: any = {
      sort: (s: any) => {
        sort = s;
        return q;
      },
      select: () => q,
      lean: () => q,
      exec: async () => {
        const result = get();
        if (Array.isArray(result))
          return [...result]
            .sort((a, b) => {
              for (const [key, direction] of Object.entries(sort)) {
                const cmp = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
                if (cmp) return cmp * direction;
              }
              return 0;
            })
            .map((row) => ({ ...row }));
        return result;
      },
      then: (ok: any, fail: any) => q.exec().then(ok, fail),
    };
    return q;
  };
  class Exams {
    _id = new Types.ObjectId();
    constructor(data: any) {
      Object.assign(this, data);
    }
    async save() {
      rows.push({ ...this });
      return this;
    }
    static find(filter: any) {
      return query(() => rows.filter((row) => matches(row, filter)));
    }
    static findOne(filter: any) {
      let sort: any;
      const q = query(() => {
        const list = rows.filter((row) => matches(row, filter));
        if (sort?.order === -1) list.sort((a, b) => b.order - a.order);
        return list[0] ? { ...list[0] } : null;
      });
      q.sort = (value: any) => {
        sort = value;
        return q;
      };
      return q;
    }
    static exists(filter: any) {
      return Promise.resolve(rows.some((row) => matches(row, filter)));
    }
    static findOneAndUpdate(filter: any, patch: any) {
      return query(() => {
        const row = rows.find((row) => matches(row, filter));
        if (!row) return null;
        Object.assign(row, patch);
        return { ...row };
      });
    }
    static findByIdAndUpdate(id: any, patch: any) {
      return this.findOneAndUpdate({ _id: id }, patch);
    }
    static async bulkWrite(operations: any[]) {
      for (const op of operations)
        Object.assign(
          rows.find((row) => matches(row, op.updateOne.filter)),
          op.updateOne.update.$set,
        );
    }
  }
  const service = new ExamsService(
    Exams as never,
    { t: async (key: string) => key } as never,
  );
  const active = () =>
    rows.filter((r) => !r.isDeleted).sort((a, b) => a.order - b.order);
  return { service, rows, active };
}

describe('exam positions', () => {
  it('repairs gaps and duplicates while preserving the current relative order', async () => {
    const { service, active, rows } = fixture();
    const ids = rows.map((row) => String(row._id));
    await service.reorderExams([]);
    expect(active().map((row) => row.order)).toEqual([1, 2, 3, 4]);
    expect(active().map((row) => String(row._id))).toEqual(ids);
  });
  it('moves to an occupied position by shifting the other exams', async () => {
    const { service, rows, active } = fixture([1, 2, 3, 4]);
    await service.update(String(rows[3]._id), { order: 2 });
    expect(active().map((row) => row.name)).toEqual([
      'Exam 1',
      'Exam 4',
      'Exam 2',
      'Exam 3',
    ]);
    expect(active().map((row) => row.order)).toEqual([1, 2, 3, 4]);
  });
  it('serializes simultaneous creates and appends them without duplicate positions', async () => {
    const { service, active } = fixture();
    await Promise.all(
      ['New A', 'New B'].map((name) =>
        service.create({ name, type: 'TOEIC' } as any),
      ),
    );
    expect(active().map((row) => row.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(
      active()
        .slice(-2)
        .map((row) => row.name),
    ).toEqual(['New A', 'New B']);
  });
  it('closes the removed position and restores the exam at the end', async () => {
    const { service, rows, active } = fixture([1, 2, 3, 4]);
    const id = String(rows[1]._id);
    await service.remove(id);
    expect(active().map((row) => row.order)).toEqual([1, 2, 3]);
    await service.restore(id);
    expect(active().map((row) => row.name)).toEqual([
      'Exam 1',
      'Exam 3',
      'Exam 4',
      'Exam 2',
    ]);
    expect(active().map((row) => row.order)).toEqual([1, 2, 3, 4]);
  });
  it('rejects partial or duplicate full-list ranks without changing data', async () => {
    const { service, rows } = fixture([1, 2]);
    await expect(
      service.reorderExams([{ id: String(rows[0]._id), order: 1 }]),
    ).rejects.toThrow();
    await expect(
      service.reorderExams(
        rows.map((row) => ({ id: String(row._id), order: 1 })),
      ),
    ).rejects.toThrow();
    expect(rows.map((row) => row.order)).toEqual([1, 2]);
  });
});

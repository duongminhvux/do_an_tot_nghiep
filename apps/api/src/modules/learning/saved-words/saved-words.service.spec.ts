import { describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { SavedWordsService } from './saved-words.service.js';

const userId = '507f1f77bcf86cd799439011';
const folderId = '507f1f77bcf86cd799439012';
const wordId = '507f1f77bcf86cd799439013';
function setup(folder: unknown = { _id: new Types.ObjectId(folderId) }) {
  const chain = (data: unknown) => ({
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(data),
  });
  const saved = {
    find: vi.fn().mockReturnValue(chain([{ wordId, folderId }])),
    findOneAndUpdate: vi.fn().mockResolvedValue({ wordId, folderId }),
  };
  const words = {
    find: vi.fn().mockReturnValue(chain([{ _id: wordId, word: 'a+b' }])),
    findById: vi.fn().mockResolvedValue({ _id: wordId, isDeleted: false }),
  };
  const folders = {
    findOne: vi.fn().mockResolvedValue(folder),
    create: vi.fn(),
  };
  const service = new SavedWordsService(
    saved as never,
    words as never,
    {} as never,
    folders as never,
  );
  return { service, saved, words, folders };
}
describe('vocabulary folder flow', () => {
  it('rejects searching a folder that does not belong to the user', async () => {
    const { service, words, folders } = setup(null);
    await expect(
      service.searchWords(userId, folderId, 'apple'),
    ).rejects.toThrow('Không tìm thấy thư mục');
    expect(folders.findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(folderId),
      userId: new Types.ObjectId(userId),
    });
    expect(words.find).not.toHaveBeenCalled();
  });
  it('searches literal text and identifies words already in the folder', async () => {
    const { service, words } = setup();
    const result = await service.searchWords(userId, folderId, 'a+b');
    const regex = words.find.mock.calls[0]![0].$or[0].word as RegExp;
    expect(regex.test('a+b')).toBe(true);
    expect(regex.test('aaab')).toBe(false);
    expect(result[0]).toMatchObject({ saved: true, inFolder: true });
  });
  it('moves an existing saved word using an upsert instead of removing it', async () => {
    const { service, saved } = setup();
    await service.saveWord(userId, { wordId, folderId });
    expect(saved.findOneAndUpdate).toHaveBeenCalledWith(
      {
        userId: new Types.ObjectId(userId),
        wordId: new Types.ObjectId(wordId),
      },
      expect.objectContaining({
        $set: { folderId: new Types.ObjectId(folderId) },
      }),
      { upsert: true, returnDocument: 'after' },
    );
  });
  it('rejects a blank folder name', async () => {
    const { service, folders } = setup();
    await expect(service.createFolder(userId, { name: '   ' })).rejects.toThrow(
      'Tên thư mục không được để trống',
    );
    expect(folders.create).not.toHaveBeenCalled();
  });
});

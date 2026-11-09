import { describe, expect, it } from 'vitest';
import { checkExam, TOEIC_PART_COUNTS } from '@repo/shared-types/exam-checks';
import { validatePublication } from '@repo/shared-types/publication';

const options = (n: number) =>
  ['A', 'B', 'C', 'D'].slice(0, n).map((key) => ({ key, text: `Option ${key}` }));
const part1 = (order: number, patch: Record<string, unknown> = {}) => ({
  id: `p1-${order}`,
  order,
  part: 1,
  content: `Script ${order}`,
  options: options(4),
  correctAnswer: 'A',
  imageUrl: '/media/photo.jpg',
  audioUrl: '/media/audio.mp3',
  ...patch,
});
const part5 = (order: number, patch: Record<string, unknown> = {}) => ({
  id: `p5-${order}`,
  order,
  part: 5,
  content: `Sentence ${order} ____.`,
  options: options(4),
  correctAnswer: 'B',
  ...patch,
});
const codes = (issues: { code: string; order?: number }[], order: number) =>
  issues.filter((i) => i.order === order).map((i) => i.code).sort();

describe('TOEIC exam checks (admin tab, quality scan, publication)', () => {
  it('requires BOTH a photo and audio for every Part 1 question, reported with the real number', () => {
    const issues = checkExam({
      questions: [
        part1(1),
        part1(2, { imageUrl: '' }),
        part1(3, { audioUrl: '' }),
        part1(4, { imageUrl: undefined, audioUrl: undefined }),
      ],
      groups: [],
    });
    expect(codes(issues, 1)).toEqual([]);
    expect(codes(issues, 2)).toEqual(['IMAGE_REQUIRED']);
    expect(codes(issues, 3)).toEqual(['AUDIO_REQUIRED']);
    expect(codes(issues, 4)).toEqual(['AUDIO_REQUIRED', 'IMAGE_REQUIRED']);
    expect(issues.find((i) => i.order === 3)?.message).toBe(
      'Câu 3: thiếu audio (Part 1 bắt buộc có cả hình ảnh và audio).',
    );
  });

  it('accepts conversation audio for Part 3 questions and flags missing audio otherwise', () => {
    const group = { id: 'g', part: 3, passages: [{ id: 'p', content: 'Conversation', audioUrl: '/media/c.mp3' }] };
    const q = (order: number, groupId: string) => ({
      id: `p3-${order}`, order, part: 3, content: `Question ${order}?`, options: options(4), correctAnswer: 'C', passageGroupId: groupId,
    });
    const silent = { id: 'g2', part: 3, passages: [{ id: 'p2', content: 'Conversation' }] };
    const issues = checkExam({ questions: [q(32, 'g'), q(35, 'g2')], groups: [group, silent] });
    expect(codes(issues, 32)).toEqual([]);
    expect(codes(issues, 35)).toEqual(['AUDIO_REQUIRED']);
  });

  it('uses the real question number for structure problems (not the index inside the Part)', () => {
    const issues = checkExam({ questions: [part5(101), part5(117, { correctAnswer: 'X' })], groups: [] });
    const answer = issues.find((i) => i.order === 117);
    expect(answer?.code).toBe('TOEIC_STRUCTURE');
    expect(answer?.message.startsWith('Câu 117:')).toBe(true);
    expect(issues.some((i) => i.order === 101)).toBe(false);
  });

  it('names the earlier question when two questions are identical', () => {
    const issues = checkExam({ questions: [part5(120), part5(121, { id: 'dup', content: 'Sentence 120 ____.' })], groups: [] });
    expect(issues.find((i) => i.code === 'DUPLICATE')?.message).toBe('Câu 121: trùng nội dung với câu 120.');
  });

  it('reports exam size and every TOEIC part that is short, only when counts are requested', () => {
    const questions = [part1(1), part5(101)];
    const full = checkExam({ exam: { type: 'TOEIC', totalQuestions: 200 }, questions, groups: [] });
    expect(full.find((i) => i.code === 'EXAM_INCOMPLETE')?.message).toContain('2/200');
    expect(full.filter((i) => i.code === 'TOEIC_PART_COUNT')).toHaveLength(7);
    expect(full.find((i) => i.code === 'TOEIC_PART_COUNT' && i.part === 1)?.message).toContain('1/6');
    expect(Object.values(TOEIC_PART_COUNTS).reduce((a, b) => a + b, 0)).toBe(200);
    expect(checkExam({ exam: { totalQuestions: 200 }, questions, groups: [] }, 'vi', { counts: false })
      .some((i) => /EXAM_|PART_COUNT/.test(i.code))).toBe(false);
  });

  it('blocks publishing a Part 1 question without its photo', () => {
    const issues = validatePublication('exams', { questions: [part1(1, { imageUrl: '' })], groups: [] });
    expect(issues.map((i) => i.code)).toContain('IMAGE_REQUIRED');
    expect(issues[0].path).toBe('questions.p1-1');
  });
});

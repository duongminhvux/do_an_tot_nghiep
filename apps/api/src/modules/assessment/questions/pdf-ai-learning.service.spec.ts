import { PdfAiLearningService } from './pdf-ai-learning.service.js';

describe('PDF correction outbox', () => {
  const pending = { eventId: 'event', payload: { kind: 'part' } };
  const exec = (value: any) => ({ exec: vi.fn().mockResolvedValue(value) });
  function setup() {
    const updateOne = vi.fn().mockReturnValue(exec({}));
    const events = { updateOne, find: vi.fn().mockReturnValue({ sort: () => ({ limit: () => ({ lean: () => exec([pending]) }) }) }) };
    const pdfAi = { learningRequest: vi.fn() };
    const service = new PdfAiLearningService(events as never, pdfAi as never);
    return { service, events, pdfAi };
  }
  it('retains the event for retry when PDF service is unavailable', async () => {
    const { service, events, pdfAi } = setup();
    pdfAi.learningRequest.mockRejectedValue(new Error('offline'));
    await service.flush();
    expect(events.updateOne).toHaveBeenCalledWith({ eventId: 'event' }, { $set: { lastError: 'Error: offline' } });
    expect(events.updateOne.mock.calls.some(c => c[1].$set?.state === 'delivered')).toBe(false);
    pdfAi.learningRequest.mockResolvedValue({ ids: [] });
    await service.flush();
    expect(events.updateOne).toHaveBeenLastCalledWith({ eventId: 'event' }, { $set: { state: 'delivered', lastError: '' } });
  });
  it('only recognizes source jobs from AI batch IDs', () => {
    const { service } = setup();
    expect(service.sourceJob('11111111-1111-4111-8111-111111111111-p2')).toBe('11111111-1111-4111-8111-111111111111');
    expect(service.sourceJob('11111111-1111-4111-8111-111111111111')).toBeUndefined();
  });
  it('reports capture failure without throwing into exam save rollback', async () => {
    const { service, events } = setup();
    events.updateOne.mockReturnValue({ exec: vi.fn().mockRejectedValue(new Error('DB unavailable')) });
    expect(await service.enqueue({ kind: 'part' })).toMatchObject({ status: 'failed' });
  });
});

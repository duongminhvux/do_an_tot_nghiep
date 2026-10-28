import {describe,it,expect,vi} from 'vitest';
import {databaseSuite} from '../../../../test/native-database.js';
import {PdfAiLearningService} from './pdf-ai-learning.service.js';
import {sql} from '../../../postgres/sql.js';
const suite=databaseSuite('assessment');
describe('native PDF correction outbox',()=>{
  it('retains failed deliveries and marks successful retries without duplicate events',async()=>{
    const pdf={learningRequest:vi.fn().mockRejectedValue(new Error('offline'))},service=new PdfAiLearningService(suite.db,pdf as never);
    await suite.records('pdf_ai_correction_events').insert({eventId:'test-event',state:'pending',lastError:'',kind:'part'});
    await service.flush();let event=await suite.records('pdf_ai_correction_events').one(sql`event_id='test-event'`);expect(event.state).toBe('pending');expect(event.lastError).toContain('offline');
    pdf.learningRequest.mockResolvedValue({ids:[]});await service.flush();event=await suite.records('pdf_ai_correction_events').one(sql`event_id='test-event'`);expect(event.state).toBe('delivered');expect(event.lastError).toBe('');
  });
  it('only recognizes source jobs from AI batch IDs and reports a persistence failure',async()=>{
    const service=new PdfAiLearningService({query:vi.fn().mockRejectedValue(new Error('DB unavailable'))} as never,{} as never);
    expect(service.sourceJob('11111111-1111-4111-8111-111111111111-p2')).toBe('11111111-1111-4111-8111-111111111111');expect(service.sourceJob('11111111-1111-4111-8111-111111111111')).toBeUndefined();expect(await service.enqueue({kind:'part'})).toMatchObject({status:'failed'});
  });
});

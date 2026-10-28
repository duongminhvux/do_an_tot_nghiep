import { Injectable,Logger,OnModuleDestroy,OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { ownerRequest } from '../../../postgres/owner-client.js';
import { serviceRole } from '../../../postgres/ownership.js';
import { first,rows,sql } from '../../../postgres/sql.js';
import { PdfAiService } from './pdf-ai.service.js';

@Injectable()
export class PdfAiLearningService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfAiLearningService.name);
  private timer?: ReturnType<typeof setInterval>;
  private flushing = false;
  constructor(
    @InjectPgConnection() private readonly db:PgConnection,
    private readonly pdfAi: PdfAiService,
  ) {}
  onModuleInit() {
    // Only Assessment should deliver the correction outbox. The AI API can
    // read its status without starting a competing flush loop.
    if (serviceRole() !== 'assessment' || process.env.PDF_AI_CORRECTIONS_FLUSH_ENABLED === 'false') return;
    this.timer = setInterval(() => void this.flush(), 30_000);
    this.timer.unref();
    void this.flush();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  sourceJob(batchId?: string) {
    return batchId?.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})-p[1-7]$/i)?.[1]?.toLowerCase();
  }

  async enqueue(payload: Record<string, any>) {
    if(serviceRole()==='ai-import')return ownerRequest('assessment','assessment/correction-outbox/enqueue',payload);
    const eventId = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    try {
      await rows(this.db,sql`INSERT INTO public.pdf_ai_correction_events(event_id,state,last_error,payload) VALUES(${eventId},'pending','',${JSON.stringify({...payload,eventId})}::jsonb) ON CONFLICT(event_id) DO NOTHING`);
      void this.flush();
      return { status: 'queued' };
    } catch (error) {
      this.logger.error('Could not retain PDF correction event', error);
      return { status: 'failed', message: 'Đề đã lưu nhưng chưa ghi được mẫu chỉnh sửa. Hãy thử lưu lại khi kết nối dữ liệu ổn định.' };
    }
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const pending=await rows(this.db,sql`SELECT event_id AS "eventId",CASE WHEN jsonb_typeof(payload->'payload')='object' AND payload->>'eventId'=event_id THEN payload->'payload' ELSE payload END AS payload FROM public.pdf_ai_correction_events WHERE state='pending' ORDER BY created_at,id LIMIT 30`);
      for (const event of pending) {
        try {
          await this.pdfAi.learningRequest('/events', event.payload);
          await rows(this.db,sql`UPDATE public.pdf_ai_correction_events SET state='delivered',last_error='',updated_at=now() WHERE event_id=${event.eventId} AND state='pending'`);
        } catch (error) {
          await rows(this.db,sql`UPDATE public.pdf_ai_correction_events SET last_error=${String(error).slice(0,500)},updated_at=now() WHERE event_id=${event.eventId} AND state='pending'`);
        }
      }
    } catch (error) { this.logger.warn('PDF correction delivery will retry', error); }
    finally { this.flushing = false; }
  }

  async pendingCount(){return Number((await first(this.db,sql`SELECT COUNT(*)::integer AS count FROM public.pdf_ai_correction_events WHERE state='pending'`))?.count??0);}

  async overview() {
    const result = await this.pdfAi.learningRequest('');
    const queued=serviceRole()==='ai-import'?(await ownerRequest<{count:number}>('assessment','assessment/correction-outbox/count')).count:await this.pendingCount();
    return { ...result, queued };
  }
}

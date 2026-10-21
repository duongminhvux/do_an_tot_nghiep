import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel, Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Model, Schema as MongooseSchema } from 'mongoose';
import { createHash } from 'node:crypto';
import { PdfAiService } from './pdf-ai.service.js';

@Schema({ timestamps: true, collection: 'pdf_ai_correction_events' })
export class PdfAiCorrectionEvent {
  @Prop({ required: true, unique: true }) eventId: string;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) payload: Record<string, any>;
  @Prop({ default: 'pending', enum: ['pending', 'delivered'] }) state: string;
  @Prop({ default: '' }) lastError: string;
}
export const PdfAiCorrectionEventSchema = SchemaFactory.createForClass(PdfAiCorrectionEvent);

/** Durable outbox: an unavailable OCR service must not discard saved corrections. */
@Injectable()
export class PdfAiLearningService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfAiLearningService.name);
  private timer?: ReturnType<typeof setInterval>;
  private flushing = false;
  constructor(
    @InjectModel(PdfAiCorrectionEvent.name) private readonly events: Model<PdfAiCorrectionEvent>,
    private readonly pdfAi: PdfAiService,
  ) {}
  onModuleInit() {
    // Only Assessment should deliver the correction outbox. The AI API can
    // read its status without starting a competing flush loop.
    if (process.env.PDF_AI_CORRECTIONS_FLUSH_ENABLED === 'false') return;
    this.timer = setInterval(() => void this.flush(), 30_000);
    this.timer.unref();
    void this.flush();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  sourceJob(batchId?: string) {
    return batchId?.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})-p[1-7]$/i)?.[1]?.toLowerCase();
  }

  async enqueue(payload: Record<string, any>) {
    const eventId = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    try {
      await this.events.updateOne({ eventId }, { $setOnInsert: { eventId, payload: { ...payload, eventId }, state: 'pending' } }, { upsert: true }).exec();
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
      const pending = await this.events.find({ state: 'pending' }).sort({ createdAt: 1 }).limit(30).lean().exec();
      for (const event of pending) {
        try {
          await this.pdfAi.learningRequest('/events', event.payload);
          await this.events.updateOne({ eventId: event.eventId }, { $set: { state: 'delivered', lastError: '' } }).exec();
        } catch (error) {
          await this.events.updateOne({ eventId: event.eventId }, { $set: { lastError: String(error).slice(0, 500) } }).exec();
        }
      }
    } catch (error) { this.logger.warn('PDF correction delivery will retry', error); }
    finally { this.flushing = false; }
  }

  async overview() {
    const result = await this.pdfAi.learningRequest('');
    const queued = await this.events.countDocuments({ state: 'pending' }).exec();
    return { ...result, queued };
  }
}

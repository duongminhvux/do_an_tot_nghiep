import {
BadRequestException,
Injectable,
NotFoundException,
ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateImportDraft } from '@repo/shared-types/assessment-import';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { isUuid } from '../../../postgres/ids.js';
import { assessmentRows } from '../assessment-reader.js';

@Injectable()
export class PdfAiService {
  constructor(
    private readonly config: ConfigService,
    @InjectPgConnection() private readonly db:PgConnection,
  ) {}

  private async checkExam(examId: string) {
    if (!isUuid(examId))
      throw new NotFoundException('Exam not found');
    const exam = (await assessmentRows(this.db,'exams',{ids:[examId],limit:1}))[0]??null;
    if (!exam || exam.isDeleted) throw new NotFoundException('Exam not found');
    if (exam.type !== 'TOEIC')
      throw new BadRequestException('AI PDF hiện hỗ trợ đề TOEIC.');
  }

  private async request(path: string, init: RequestInit = {}) {
    const base = (
      this.config.get<string>('PDF_AI_URL') || 'http://localhost:8003'
    ).replace(/\/$/, '');
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        signal: AbortSignal.timeout(30_000) });
    } catch {
      throw new ServiceUnavailableException(
        'Chưa kết nối được AI PDF local. Hãy khởi động dịch vụ pdf-ai và Ollama.',
      );
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        typeof payload?.detail === 'string'
          ? payload.detail
          : 'AI PDF local chưa sẵn sàng.';
      if (response.status === 404) throw new NotFoundException(detail);
      if (response.status === 400) throw new BadRequestException(detail);
      throw new ServiceUnavailableException(detail);
    }
    if (!payload || typeof payload !== 'object')
      throw new ServiceUnavailableException('AI PDF trả dữ liệu không hợp lệ.');
    return payload;
  }

  async start(
    examId: string,
    file?: Express.Multer.File,
    answers?: Express.Multer.File,
  ) {
    await this.checkExam(examId);
    const validate = (upload?: Express.Multer.File) => {
      if (
        !upload?.buffer?.length ||
        upload.buffer.length > 25 * 1024 * 1024 ||
        upload.buffer.subarray(0, 5).toString() !== '%PDF-'
      ) {
        throw new BadRequestException(
          'Hãy chọn PDF hợp lệ, tối đa 25 MB mỗi file.',
        );
      }
      return upload;
    };
    const source = validate(file);
    const form = new FormData();
    form.set('exam_id', examId);
    form.set(
      'file',
      new Blob([new Uint8Array(source.buffer)], { type: 'application/pdf' }),
      'exam.pdf',
    );
    if (answers) {
      const key = validate(answers);
      form.set(
        'answers',
        new Blob([new Uint8Array(key.buffer)], { type: 'application/pdf' }),
        'answers.pdf',
      );
    }
    return this.request('/jobs', { method: 'POST', body: form });
  }

  async status(examId: string, jobId: string) {
    await this.checkExam(examId);
    if (!/^[a-f0-9-]{36}$/i.test(jobId))
      throw new BadRequestException('Mã xử lý PDF không hợp lệ.');
    const job = await this.request(
      `/jobs/${jobId}?exam_id=${encodeURIComponent(examId)}`,
    );
    return this.validateResult(job);
  }

  private validateResult(job: any) {
    if (job.state === 'completed') {
      if (!Array.isArray(job.result?.parts))
        throw new ServiceUnavailableException(
          'AI PDF trả kết quả không hợp lệ.',
        );
      for (const part of job.result.parts) {
        if (
          !Number.isInteger(part.part) ||
          part.part < 1 ||
          part.part > 7 ||
          !Array.isArray(part.questions) ||
          !Array.isArray(part.groups)
        ) {
          throw new ServiceUnavailableException(
            'AI PDF trả Part không hợp lệ.',
          );
        }
        part.issues = validateImportDraft(part, part.part);
      }
    }
    return job;
  }

  async startBundle(
    testNumber: number,
    files: Partial<
      Record<'lc' | 'rc' | 'lc_answers' | 'rc_answers' | 'lc_script', Express.Multer.File[]>
    >,
  ) {
    if (!Number.isInteger(testNumber) || testNumber < 1 || testNumber > 10)
      throw new BadRequestException('Chọn Test từ 1 đến 10.');
    const form = new FormData();
    form.set('test_number', String(testNumber));
    for (const field of ['lc', 'rc', 'lc_answers', 'rc_answers', 'lc_script'] as const) {
      const file = files[field]?.[0];
      if (field === 'lc_script' && !file) continue;
      if (
        !file?.buffer?.length ||
        file.buffer.length > 25 * 1024 * 1024 ||
        file.buffer.subarray(0, 5).toString() !== '%PDF-'
      ) {
        throw new BadRequestException(
          `Thiếu hoặc sai PDF ${field}. Mỗi file tối đa 25 MB.`,
        );
      }
      const namedTest = (field === 'lc' || field === 'rc' || field === 'lc_script') ? file.originalname?.match(/\bTEST[ _-]*0*(\d+)\b/i) : null;
      if ((field === 'lc' && /\bRC\b/i.test(file.originalname || '')) ||
          (field === 'rc' && /\bLC\b/i.test(file.originalname || ''))) {
        throw new BadRequestException(`Bạn đang chọn nhầm file ${field === 'lc' ? 'Reading (RC)' : 'Listening (LC)'} vào ô ${field.toUpperCase()}. Hãy đổi lại đúng ô đề thi.`);
      }
      if (namedTest && Number(namedTest[1]) !== testNumber) throw new BadRequestException(`Tên file đề ${field.toUpperCase()} không khớp Test ${testNumber} đã chọn.`);
      form.set(
        field,
        new Blob([new Uint8Array(file.buffer)], { type: 'application/pdf' }),
        `${field}.pdf`,
      );
    }
    return this.request('/bundle-jobs', { method: 'POST', body: form });
  }

  async bundleStatus(jobId: string) {
    if (!/^[a-f0-9-]{36}$/i.test(jobId))
      throw new BadRequestException('Mã xử lý PDF không hợp lệ.');
    return this.validateResult(
      await this.request(`/jobs/${jobId}?exam_id=bundle`),
    );
  }

  async learningRequest(path: string, payload?: Record<string, any>) {
    return this.request(`/learning${path}`, payload ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {});
  }
}

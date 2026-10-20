import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PdfAiService } from './pdf-ai.service.js';

describe('PdfAiService', () => {
  const examId = '507f1f77bcf86cd799439011';
  const jobId = '38b10029-2541-401c-bfa4-e9a16dac175e';
  const file = {
    buffer: Buffer.from('%PDF-1.7\nexample'),
  } as Express.Multer.File;
  const exams = { findById: vi.fn() };
  const fetchMock = vi.fn();
  let service: PdfAiService;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    exams.findById.mockReturnValue({
      lean: () => ({ exec: async () => ({ type: 'TOEIC' }) }),
    });
    service = new PdfAiService(
      new ConfigService({ PDF_AI_URL: 'http://pdf-ai:8003' }),
      exams as never,
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('requires all four PDFs and a valid Test before creating a bundle job', async () => {
    await expect(service.startBundle(1, { lc: [file] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.startBundle(11, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a Reading booklet placed in the Listening slot before OCR', async () => {
    await expect(service.startBundle(2, {lc:[{...file,originalname:'TEST 2 RC (1).pdf'}]})).rejects.toThrow('Reading (RC)');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits the four document roles and chosen Test without creating an exam', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ jobId }), { status: 202 }),
    );
    exams.findById.mockClear();
    await service.startBundle(1, {
      lc: [file],
      rc: [file],
      lc_answers: [file],
      rc_answers: [file],
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://pdf-ai:8003/bundle-jobs');
    expect(init.body.get('test_number')).toBe('1');
    for (const role of ['lc', 'rc', 'lc_answers', 'rc_answers'])
      expect(await init.body.get(role).text()).toBe(file.buffer.toString());
    expect(exams.findById).not.toHaveBeenCalled();
  });

  it('rejects invalid files before forwarding them', async () => {
    await expect(service.start(examId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.start(examId, {
        buffer: Buffer.from('not PDF'),
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('forwards an optional script PDF and checks its Test number', async () => {
    const files = {lc:[file],rc:[file],lc_answers:[file],rc_answers:[file],lc_script:[{...file,originalname:'TEST_01.pdf'}]};
    fetchMock.mockResolvedValue(new Response(JSON.stringify({jobId}),{status:202}));
    await service.startBundle(1,files);
    expect(await fetchMock.mock.calls[0][1].body.get('lc_script').text()).toBe(file.buffer.toString());
    fetchMock.mockClear();
    await expect(service.startBundle(2,files)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.startBundle(1,{...files,lc_script:[{...file,buffer:Buffer.from('not PDF')}]})).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('checks the exam before submitting an inference job', async () => {
    await expect(service.start('bad-id', file)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('forwards PDF bytes, answer key and exam ID without database writes', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ jobId }), { status: 202 }),
    );
    expect(await service.start(examId, file, file)).toEqual({ jobId });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://pdf-ai:8003/jobs');
    expect(init.body.get('exam_id')).toBe(examId);
    expect(await init.body.get('file').text()).toBe(file.buffer.toString());
    expect(await init.body.get('answers').text()).toBe(file.buffer.toString());
  });
  it('reports unavailable AI as a service error', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.start(examId, file)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it('validates a completed draft and surfaces missing answers', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          state: 'completed',
          result: {
            parts: [
              {
                part: 5,
                groups: [],
                questions: [
                  {
                    content: 'A question',
                    order: 101,
                    correctAnswer: '',
                    options: ['A', 'B', 'C', 'D'].map((key) => ({
                      key,
                      text: key,
                    })),
                  },
                ],
              },
            ],
          },
        }),
      ),
    );
    const result = await service.status(examId, jobId);
    expect(
      result.result.parts[0].issues.some(
        (issue: { severity: string }) => issue.severity === 'error',
      ),
    ).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain(`exam_id=${examId}`);
  });
});

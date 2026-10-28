import { Body,Controller,Get,Headers,Param,Post } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readAssessmentRows,type AssessmentKind,type AssessmentRead } from '../modules/assessment/assessment-reader.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { InjectPgConnection,type PgConnection } from '../postgres/connection.js';
import { first,sql } from '../postgres/sql.js';
import { authorizeInternal } from './authorize.js';
@Controller('_internal/assessment')
export class AssessmentReadsController {
  constructor(@InjectPgConnection() private readonly db:PgConnection){}
  @Public() @Get('correction-outbox/count')
  async correctionCount(@Headers('x-internal-token') token:string){
    authorizeInternal(token,['assessment']);return {count:Number((await first(this.db,sql`SELECT COUNT(*)::integer AS count FROM public.pdf_ai_correction_events WHERE state='pending'`))?.count??0)};
  }
  @Public() @Post('correction-outbox/enqueue')
  async enqueueCorrection(@Headers('x-internal-token') token:string,@Body() body:Record<string,unknown>){
    authorizeInternal(token,['assessment']);const eventId=createHash('sha256').update(JSON.stringify(body)).digest('hex');
    await first(this.db,sql`INSERT INTO public.pdf_ai_correction_events(event_id,state,last_error,payload) VALUES(${eventId},'pending','',${JSON.stringify({...body,eventId})}::jsonb) ON CONFLICT(event_id) DO NOTHING`);
    return {status:'queued'};
  }
  @Public() @Post(':kind')
  read(@Headers('x-internal-token') token:string,@Param('kind') kind:AssessmentKind,@Body() input:AssessmentRead){
    authorizeInternal(token,['assessment']);return readAssessmentRows(this.db,kind,input);
  }
}

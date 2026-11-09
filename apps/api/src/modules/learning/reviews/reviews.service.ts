import { advanceReview } from './review-schedule.js';
import type { ReviewLibraryDto, PracticeWordsDto } from './dto/review-library.dto.js';
import { BadRequestException,Inject,Injectable,NotFoundException } from '@nestjs/common';
import { DomainOutboxService } from '../../../common/events/domain-outbox.service.js';
import { InjectPgConnection,createConnection,type PgConnection } from '../../../postgres/connection.js';
import { SqlRecords } from '../../../postgres/records.js';
import { first,literal,rowData,rows,sql } from '../../../postgres/sql.js';
import { contentRows } from '../../vocabulary/content-reader.js';
import { mistakeSource } from '../mistakes/mistake-source-client.js';
@Injectable()
export class ReviewsService {
  constructor(@InjectPgConnection() private readonly db:PgConnection,@Inject(DomainOutboxService) private readonly outbox:DomainOutboxService) {}
  private get reviews(){return new SqlRecords(this.db,'userwordreviews');}
  private async populated(reviews:any[]) {
    const words:any[]=[];const ids=[...new Set(reviews.map(r=>String(r.wordId)))];
    for(let offset=0;offset<ids.length;offset+=2000)words.push(...await contentRows(this.db,'words',{ids:ids.slice(offset,offset+2000),publishedOnly:true,limit:2000}));
    const byId=new Map(words.map(word=>[word._id,word]));return reviews.map(review=>({...review,wordId:byId.get(String(review.wordId))??null}));
  }
  async library(userId: string, query: ReviewLibraryDto) {
    // Scope to the learner first. Resolve current published content before counting/filtering,
    // so removed words never create empty pages or misleading totals.
    const owned = await this.populated(await this.reviews.select(sql`user_id=${userId}::uuid`, literal('ORDER BY last_reviewed_at DESC NULLS LAST,created_at DESC,id')));
    const available = owned.filter(row => row.wordId);
    const now = Date.now();
    const due = (row: any) => !!row.nextReviewAt && new Date(row.nextReviewAt).getTime() <= now;
    const upcoming = available.filter(row => row.nextReviewAt && !due(row)).map(row => new Date(row.nextReviewAt).getTime());
    const stats = { total: available.length, due: available.filter(due).length, learning: available.filter(row=>row.status==='LEARNING').length, mastered: available.filter(row=>row.status==='MASTERED').length,
      nextDueAt: upcoming.length ? new Date(Math.min(...upcoming)).toISOString() : null };
    const search = query.search?.toLocaleLowerCase() || '';
    const searchable = (word: any) => [word.word,word.meaning,...(word.parts ?? []).flatMap((part: any)=>part.meanings ?? []).flatMap((meaning: any)=>[meaning.definition,...(Array.isArray(meaning.translation)?meaning.translation:[meaning.translation])])].filter(value=>typeof value==='string').join(' ').toLocaleLowerCase();
    const filtered = available.filter(row => (query.status==='ALL' || !query.status || query.status==='DUE' && due(row) || row.status===query.status) &&
      (!search || searchable(row.wordId).includes(search)));
    // Due words first (most overdue on top) so the list matches what the learner should review next;
    // the rest keep the most-recently-reviewed order.
    const dueAt = (row: any) => (due(row) ? new Date(row.nextReviewAt).getTime() : Infinity);
    filtered.sort((a, b) => { const x = dueAt(a), y = dueAt(b); return x === y ? 0 : x < y ? -1 : 1; });
    const page=query.page || 1, limit=Math.min(50,Math.max(1,query.limit || 20));
    return { items: filtered.slice((page-1)*limit,page*limit), total: filtered.length, page, limit, totalPages: Math.max(1,Math.ceil(filtered.length/limit)), stats };
  }
  async practice(userId: string, query: PracticeWordsDto) {
    if (!query.wordId) return (await this.library(userId, { page: 1, limit: 50, status: query.status, search: query.search })).items;
    const filter=sql`user_id=${userId}::uuid AND (${query.wordId ?? null}::uuid IS NULL OR word_id=${query.wordId ?? null}::uuid)
      AND (${query.status==='ALL' ? null : query.status ?? null}::text IS NULL OR status=${query.status})`;
    const owned=await this.populated(await this.reviews.select(filter,literal('ORDER BY next_review_at,id LIMIT 50')));
    return owned.filter(row=>row.wordId);
  }
  async getDueReviews(userId:string,limit=30) {
    const cap=Math.min(100,Math.max(1,Math.floor(limit)));
    return this.populated(await this.reviews.select(sql`user_id=${userId}::uuid AND next_review_at<=${new Date()}`,
      sql`ORDER BY next_review_at,id LIMIT ${cap}`));
  }
  async getStats(userId:string) {
    const end=new Date();end.setHours(23,59,59,999);
    const row=await first(this.db,sql`SELECT COUNT(*)::integer AS total,COUNT(*) FILTER(WHERE status='LEARNING')::integer AS learning,
      COUNT(*) FILTER(WHERE status='MASTERED')::integer AS mastered,COUNT(*) FILTER(WHERE next_review_at<=${end})::integer AS due
      FROM public.userwordreviews WHERE user_id=${userId}::uuid`);
    return {totalWords:Number(row?.total??0),learningWords:Number(row?.learning??0),masteredWords:Number(row?.mastered??0),dueToday:Number(row?.due??0)};
  }
  async checkDue(userId:string) {
    const now=new Date(),end=new Date();end.setHours(23,59,59,999);
    const counts=await first(this.db,sql`SELECT COUNT(*) FILTER(WHERE next_review_at<=${now})::integer AS due,
      COUNT(*) FILTER(WHERE next_review_at<=${end})::integer AS today,COUNT(*) FILTER(WHERE status='LEARNING')::integer AS learning
      FROM public.userwordreviews WHERE user_id=${userId}::uuid`);
    const dueCount=Number(counts?.due??0);let previewWords:string[]=[];
    if(dueCount)previewWords=(await this.getDueReviews(userId,3)).map(review=>review.wordId?.word).filter(Boolean);
    return {hasDueWords:dueCount>0,dueCount,dueToday:Number(counts?.today??0),totalLearning:Number(counts?.learning??0),previewWords};
  }
  async recordReview(userId:string,wordId:string,rating:'AGAIN'|'HARD'|'GOOD'|'EASY') {
    if (!['AGAIN','HARD','GOOD','EASY'].includes(rating)) throw new BadRequestException('Invalid review rating');
    const now=new Date();const titles=await mistakeSource<Record<string,string>>('content','vocabulary-titles',{wordIds:[wordId]});
    if(!titles[wordId])throw new NotFoundException('Published vocabulary word not found');
    return this.outbox.withTransaction(async session=>{
      const db=createConnection(session.client as any);
      await rows(db,sql`INSERT INTO public.userwordreviews(user_id,word_id,status,review_count,correct_count,incorrect_count,interval_days)
        VALUES(${userId}::uuid,${wordId}::uuid,'LEARNING',0,0,0,0) ON CONFLICT(user_id,word_id) DO NOTHING`);
      const raw=await first(db,sql`SELECT * FROM public.userwordreviews WHERE user_id=${userId}::uuid AND word_id=${wordId}::uuid FOR UPDATE`);
      const review=rowData<any>(raw!);
    const isAgain = rating === 'AGAIN';
    advanceReview(review,rating,now);


      const saved=await new SqlRecords(db,'userwordreviews').patch(sql`id=${review._id}::uuid`,{
        reviewCount:review.reviewCount,lastReviewedAt:review.lastReviewedAt,correctCount:review.correctCount,incorrectCount:review.incorrectCount,
        intervalDays:review.intervalDays,status:review.status,nextReviewAt:review.nextReviewAt,
      });
      await session.client!.query('SELECT public.record_learning_outcomes($1,$2,$3,$4::jsonb)',[
        userId,`vocab-review:${saved._id}:${saved.reviewCount}`,now,JSON.stringify([{sourceType:'VOCABULARY',sourceItemId:wordId,sourceRefId:String(saved._id),
          title:titles[wordId]||wordId,samples:1,wrongCount:isAgain?1:0}]),
      ]);return saved;
    });
  }
  async findAll(userId:string,status?:string) {
    return this.populated(await this.reviews.select(sql`user_id=${userId}::uuid AND (${status??null}::text IS NULL OR status=${status??null})`,literal('ORDER BY next_review_at,id LIMIT 100')));
  }
}

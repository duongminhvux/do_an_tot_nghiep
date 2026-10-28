import { Inject,Injectable,NotFoundException } from '@nestjs/common';
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
    const now=new Date();const titles=await mistakeSource<Record<string,string>>('content','vocabulary-titles',{wordIds:[wordId]});
    if(!titles[wordId])throw new NotFoundException('Published vocabulary word not found');
    return this.outbox.withTransaction(async session=>{
      const db=createConnection(session.client as any);
      await rows(db,sql`INSERT INTO public.userwordreviews(user_id,word_id,status,review_count,correct_count,incorrect_count,interval_days)
        VALUES(${userId}::uuid,${wordId}::uuid,'LEARNING',0,0,0,0) ON CONFLICT(user_id,word_id) DO NOTHING`);
      const raw=await first(db,sql`SELECT * FROM public.userwordreviews WHERE user_id=${userId}::uuid AND word_id=${wordId}::uuid FOR UPDATE`);
      const review=rowData<any>(raw!);
    review.reviewCount += 1;
    review.lastReviewedAt = now;

    const isAgain = rating === 'AGAIN';
    const isHard = rating === 'HARD';
    const isEasy = rating === 'EASY';

    if (isAgain) {
      review.incorrectCount += 1;
      review.intervalDays = 0;
      review.status = 'LEARNING';
      // Ôn lại sau 10 phút
      review.nextReviewAt = new Date(now.getTime() + 10 * 60 * 1000);
    } else if (isHard) {
      review.intervalDays = Math.max(1, Math.round((review.intervalDays || 1) * 1.2));
      review.nextReviewAt = new Date(
        now.getTime() + review.intervalDays * 24 * 60 * 60 * 1000,
      );
    } else if (isEasy) {
      review.correctCount += 1;
      review.intervalDays =
        review.intervalDays === 0 ? 3 : Math.round(review.intervalDays * 3.5);
      if (review.reviewCount >= 2) {
        review.status = 'MASTERED';
      }
      review.nextReviewAt = new Date(
        now.getTime() + review.intervalDays * 24 * 60 * 60 * 1000,
      );
    } else {
      // 'GOOD'
      review.correctCount += 1;
      review.intervalDays =
        review.intervalDays === 0
          ? 1
          : review.intervalDays === 1
            ? 3
            : Math.round(review.intervalDays * 2.5);
      if (review.reviewCount >= 4 && review.correctCount >= 3) {
        review.status = 'MASTERED';
      }
      review.nextReviewAt = new Date(
        now.getTime() + review.intervalDays * 24 * 60 * 60 * 1000,
      );
    }


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

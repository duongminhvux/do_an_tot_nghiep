import { InjectPgConnection,withPgTransaction,type PgConnection } from '../../../postgres/connection.js';
import { SqlRecords } from '../../../postgres/records.js';
import { rows,sql } from '../../../postgres/sql.js';
import { allContentRows,contentRows } from '../../vocabulary/content-reader.js';

import {
BadRequestException,
Injectable,
NotFoundException
} from '@nestjs/common';
import { XP } from '@repo/shared-types/learning-xp';
import { vocabularyOutcomes } from '@repo/shared-types/mistakes';
import { LearningActivityService } from '../../learning-activity/learning-activity.service.js';
import { mistakeSource } from '../mistakes/mistake-source-client.js';


import { I18nService } from 'nestjs-i18n';
import { NotificationClient } from '../../../common/clients/notification-client.js';
import {
ActivityAction,
ActivityCategory
} from '../../activity-logs/rows/activity-log.row.js';
import {
UserLessonProgressRow
} from '../progress/rows/user-lesson-progress.row.js';
import {
UserWordReviewRow
} from '../reviews/rows/user-word-review.row.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { RecordActionDto } from './dto/record-action.dto.js';
import {
LearningSessionRow
} from './rows/learning-session.row.js';

@Injectable()
export class SessionsService {
  private get sessionModel(){return new SqlRecords(this.nativeDb,'learningsessions');}
private get sessionWordModel(){return new SqlRecords(this.nativeDb,'learningsessionwords');}
private get progressModel(){return new SqlRecords(this.nativeDb,'userlessonprogresses');}
private get userLessonWordModel(){return new SqlRecords(this.nativeDb,'userlessonwords');}
private get reviewModel(){return new SqlRecords(this.nativeDb,'userwordreviews');}
private get dailyActivityModel(){return new SqlRecords(this.nativeDb,'userdailyactivities');}
constructor(
@InjectPgConnection() private readonly nativeDb:PgConnection,private readonly i18n: I18nService,
private readonly activityLogsService: NotificationClient,
private readonly learningActivity: LearningActivityService
  ) {}

  /**
   * Khởi tạo phiên học mới (khi user tương tác hoặc khi bắt đầu)
   */
  async create(userId: string, createSessionDto: CreateSessionDto) {
    return withPgTransaction(this.nativeDb,async()=>{
      await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended(${"learning-session:"+userId},0))`);

    const lesson = (await contentRows(this.nativeDb,'lessons',{ids:[createSessionDto.lessonId],publishedOnly:true,activeOnly:true}))[0];
    if (!lesson) {
      throw new NotFoundException(
        await this.i18n.t('learning.LESSON_NOT_FOUND'),
      );
    }

    const totalWords = (await allContentRows(this.nativeDb,'lessonwords',{lessonIds:[String(lesson._id)]})).length;

    const session = await this.sessionModel.insert({
      userId: String(userId),
      type: createSessionDto.type || 'LESSON',
      lessonId: lesson._id,
      startedAt: createSessionDto.startedAt
        ? new Date(createSessionDto.startedAt)
        : new Date(),
      totalWords,
      completedWords: 0 });

    if (session.lessonId) {
      await this.progressModel.insert({userId,lessonId:session.lessonId,status:'IN_PROGRESS',progress:0,startedAt:session.startedAt},['user_id','lesson_id']);
      await this.progressModel.patch(sql`user_id=${userId}::uuid AND lesson_id=${session.lessonId}::uuid`,{lastStudiedAt:session.startedAt});
    }

    return session;
  
    });
  }

  /**
   * Ghi nhận tương tác đánh giá từ (Atomic: Session + Review + Progress + LessonWord)
   * Tự động khởi tạo Session nếu client chưa có sessionId
   */
  async recordAction(userId: string, dto: RecordActionDto) {
    return withPgTransaction(this.nativeDb,async()=>{
      await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended(${"learning-session:"+userId},0))`);

    const availableWord=await mistakeSource<Record<string,string>>('content','vocabulary-titles',{wordIds:[dto.wordId]});
    if(!availableWord[dto.wordId])throw new NotFoundException('Published vocabulary word not found');
    const userObjId = String(userId);
    const wordObjId = String(dto.wordId);
    const now = dto.answeredAt ? new Date(dto.answeredAt) : new Date();

    // 1. Tìm hoặc Khởi tạo LearningSession
    let session: LearningSessionRow | null = null;
    if (dto.sessionId) {
      session = await this.sessionModel.one(sql`("id" = ${String(dto.sessionId)}) AND ("user_id" = ${userObjId})`);
      if (!session) {
        throw new NotFoundException(
          await this.i18n.t('learning.SESSION_NOT_FOUND'),
        );
      }
    } else {
      if (!dto.lessonId) {
        throw new BadRequestException(
          await this.i18n.t('learning.LESSON_ID_REQUIRED'),
        );
      }
      const lesson = (await contentRows(this.nativeDb,'lessons',{ids:[dto.lessonId],publishedOnly:true,activeOnly:true}))[0];
      if (!lesson) {
        throw new NotFoundException(
          await this.i18n.t('learning.LESSON_NOT_FOUND'),
        );
      }
      const totalWords = (await allContentRows(this.nativeDb,'lessonwords',{lessonIds:[String(lesson._id)]})).length;

      session = await this.sessionModel.insert({
        userId: userObjId,
        type: 'LESSON',
        lessonId: lesson._id,
        startedAt: dto.sessionStartedAt ? new Date(dto.sessionStartedAt) : now,
        totalWords,
        completedWords: 0 });
    }

    if (!session) {
      throw new NotFoundException(await this.i18n.t('learning.SESSION_NOT_FOUND'));
    }

    // 2. Xác định LessonWord ID tương ứng (nếu chưa truyền)
    let lessonWordId: string | undefined = undefined;
    if (dto.lessonWordId) {
      lessonWordId = String(dto.lessonWordId);
    } else if (session.lessonId) {
      const lw = (await contentRows(this.nativeDb,'lessonwords',{lessonIds:[String(session.lessonId)],wordIds:[wordObjId]}))[0];
      if (lw) {
        lessonWordId = lw._id;
      }
    }

    // 3. Ghi log tương tác: LearningSessionWord
    const sessionWord = await this.sessionWordModel.insert({
      sessionId: session._id,
      wordId: wordObjId,
      lessonWordId,
      mode: dto.mode,
      rating: dto.rating,
      isCorrect: dto.isCorrect,
      answeredAt: now });

    // Cập nhật số từ độc lập đã làm trong session
    const evaluatedWordIds = await rows(this.nativeDb,sql`SELECT DISTINCT word_id FROM learningsessionwords WHERE session_id=${session._id}::uuid`);
    session.completedWords = evaluatedWordIds.length;
    await this.sessionModel.upsert(session);

    // 4. CHỈ KHI NÀO người dùng bấm chọn 1 trong 4 nút (AGAIN, HARD, GOOD, EASY) thì mới tạo UserLessonWord
    const isRatingSelected =
      !!dto.rating && ['AGAIN', 'HARD', 'GOOD', 'EASY'].includes(dto.rating);

    let review: UserWordReviewRow | null = null;
    let lessonProgress: UserLessonProgressRow | null = null;

    if (isRatingSelected) {
      // 4.1. Tạo / Cập nhật UserLessonWord (Đánh dấu từ đã học trong Lesson)
      if (lessonWordId) {
        const isMasteredRating = dto.rating === 'GOOD' || dto.rating === 'EASY';
        await this.userLessonWordModel.insert({userId:userObjId,lessonWordId,learnedAt:now},['user_id','lesson_word_id']);
        if(isMasteredRating)await this.userLessonWordModel.patch(sql`user_id=${userObjId}::uuid AND lesson_word_id=${lessonWordId}::uuid`,{completedAt:now});
      }

      // 4.2. Cập nhật UserWordReview (Thuật toán lặp lại ngắt quãng SRS)
      await this.reviewModel.insert({userId:userObjId,wordId:wordObjId},['user_id','word_id']);
      review = await this.reviewModel.one(sql`("user_id" = ${userObjId}) AND ("word_id" = ${wordObjId})`,sql`FOR UPDATE`);

      if (!review) throw new Error('Review row was not persisted');

      review.reviewCount += 1;
      review.lastReviewedAt = now;

      const isAgain = dto.rating === 'AGAIN';
      const isHard = dto.rating === 'HARD';
      const isEasy = dto.rating === 'EASY';

      if (isAgain) {
        review.incorrectCount += 1;
        review.intervalDays = 0;
        review.status = 'LEARNING';
        // Học lại sau 10 phút
        review.nextReviewAt = new Date(now.getTime() + 10 * 60 * 1000);
      } else if (isHard) {
        review.intervalDays = Math.max(
          1,
          Math.round((review.intervalDays || 1) * 1.2),
        );
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

      await this.reviewModel.upsert(review,['user_id','word_id']);

      if (review.reviewCount === 1) {
        await this.incrementDailyActivity(userObjId, now, { wordsLearned: 1 });
      } else {
        await this.incrementDailyActivity(userObjId, now, { wordsReviewed: 1 });
      }
      const learned = review.reviewCount === 1;
      await this.learningActivity.record({
        userId: userObjId,
        module: 'VOCABULARY',
        type: learned ? 'WORD_LEARNED' : 'WORD_REVIEWED',
        sourceKey: `vocab-word:${review._id}:${review.reviewCount}`,
        xp: learned ? XP.WORD_LEARNED : XP.WORD_REVIEWED,
        occurredAt: now,
        refId: String(review._id) });

      // 4.3. Tính toán và cập nhật UserLessonProgress
      if (session.lessonId) {
        const allLessonWords = await allContentRows(this.nativeDb,'lessonwords',{lessonIds:[String(session.lessonId)]});

        const allLessonWordIds = allLessonWords.map((lw) => lw._id);
        const totalLessonWords = allLessonWordIds.length || 1;

        const learnedCount = await this.userLessonWordModel.count(sql`("user_id" = ${userObjId}) AND ("lesson_word_id"=ANY(${allLessonWordIds}::uuid[]))`);

        const progressPercent = Math.min(
          100,
          Math.round((learnedCount / totalLessonWords) * 100),
        );
        const lessonStatus =
          progressPercent >= 100 ? 'COMPLETED' : 'IN_PROGRESS';

        await this.progressModel.insert({userId:userObjId,lessonId:session.lessonId,startedAt:session.startedAt||now},['user_id','lesson_id']);
        lessonProgress=await this.progressModel.patch(sql`user_id=${userObjId}::uuid AND lesson_id=${session.lessonId}::uuid`,{progress:progressPercent,status:lessonStatus,lastStudiedAt:now,...(progressPercent>=100?{completedAt:now}:{})});
      }
    } else {
      // Nếu chưa bấm chọn 4 nút, lấy dữ liệu hiện tại (nếu có)
      if (session.lessonId) {
        lessonProgress = await this.progressModel.one(sql`("user_id" = ${userObjId}) AND ("lesson_id" = ${session.lessonId})`);
      }
      review = await this.reviewModel.one(sql`("user_id" = ${userObjId}) AND ("word_id" = ${wordObjId})`);
    }

    return {
      sessionId: String(session._id),
      sessionWordId: String(sessionWord._id),
      completedWords: session.completedWords,
      totalWords: session.totalWords,
      progress: lessonProgress?.progress ?? 0,
      lessonStatus: lessonProgress?.status ?? 'IN_PROGRESS',
      wordReview: review
        ? {
            status: review.status,
            intervalDays: review.intervalDays,
            nextReviewAt: review.nextReviewAt }
        : undefined };
  
    });
  }

  /**
   * Kết thúc phiên học (khi hoàn thành bài hoặc user thoát)
   */
  async complete(userId: string, sessionId: string, endedAt?: string) {
    return withPgTransaction(this.nativeDb,async()=>{
      await rows(this.nativeDb,sql`SELECT pg_advisory_xact_lock(hashtextextended(${"learning-session:"+userId},0))`);

    const session = await this.sessionModel.one(sql`("id" = ${String(sessionId)}) AND ("user_id" = ${String(userId)})`);
    if (!session) {
      throw new NotFoundException(
        await this.i18n.t('learning.SESSION_NOT_FOUND'),
      );
    }

    if(session.endedAt)return session;
    session.endedAt = endedAt ? new Date(endedAt) : new Date();
    const durationSeconds = Math.max(
      0,
      Math.round(
        (session.endedAt.getTime() - session.startedAt.getTime()) / 1000,
      ),
    );
    session.durationSeconds = durationSeconds;
    await this.sessionModel.upsert(session);

    const studyMinutes = Math.max(1, Math.round(durationSeconds / 60));
    await this.incrementDailyActivity(session.userId, session.endedAt, {
      sessionCount: 1,
      studyMinutes });

    {
      const lesson = session.lessonId
        ? (await contentRows(this.nativeDb,'lessons',{ids:[String(session.lessonId)]}))[0]
        : null;
      const actions = await this.sessionWordModel.select(sql`session_id=${session._id}::uuid`);
      const wordIds = [...new Set(actions.map(action => String(action.wordId)))];
      const titles = wordIds.length ? await mistakeSource<Record<string,string>>('content', 'vocabulary-titles', { wordIds }) : {};
      await this.learningActivity.record({
        userId: session.userId,
        module: 'VOCABULARY',
        type: 'VOCAB_SESSION',
        sourceKey: `vocab-session:${session._id}`,
        xp: XP.VOCAB_SESSION,
        occurredAt: session.endedAt,
        title: lesson?.title,
        refId: String(session._id),
        link: '/vocabulary',
        correct: session.completedWords,
        total: session.totalWords,
        durationSec: durationSeconds,
        metadata: { sessionType: session.type },
        outcomes: vocabularyOutcomes(String(session._id), actions, titles) });
    }

    void this.activityLogsService.log({
      userId: String(session.userId),
      action: ActivityAction.VOCABULARY_LEARN,
      category: ActivityCategory.VOCABULARY,
      description: `Hoàn thành phiên học từ vựng (${session.completedWords}/${session.totalWords} từ - ${studyMinutes} phút)`,
      durationMs: durationSeconds * 1000,
      metadata: {
        sessionId: String(session._id),
        type: session.type,
        lessonId: session.lessonId ? String(session.lessonId) : null,
        totalWords: session.totalWords,
        completedWords: session.completedWords,
        durationSeconds } }).catch(err => this.activityLogsService.reportError('activity log',err));

    return session;
  
    });
  }

  async findOne(userId: string, id: string) {
    const session = await this.sessionModel.one(sql`("id" = ${String(id)}) AND ("user_id" = ${String(userId)})`);
    if (!session) {
      throw new NotFoundException(
        await this.i18n.t('learning.SESSION_NOT_FOUND'),
      );
    }
    return session;
  }

  async findAll(userId: string) {
    return this.sessionModel.select(sql`("user_id" = ${String(userId)})`, sql`ORDER BY "started_at" DESC NULLS LAST LIMIT ${50}`);
  }

  async incrementDailyActivity(
    userId: string,
    date: Date,
    inc: {
      studyMinutes?: number;
      wordsLearned?: number;
      wordsReviewed?: number;
      sessionCount?: number;
    },
  ) {
    try {
      const dayStart = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);

      const incFields: Record<string, number> = {};
      if (inc.studyMinutes) incFields.studyMinutes = inc.studyMinutes;
      if (inc.wordsLearned) incFields.wordsLearned = inc.wordsLearned;
      if (inc.wordsReviewed) incFields.wordsReviewed = inc.wordsReviewed;
      if (inc.sessionCount) incFields.sessionCount = inc.sessionCount;

      if (Object.keys(incFields).length === 0) return;

      await rows(this.nativeDb,sql`INSERT INTO userdailyactivities(user_id,date,study_minutes,words_learned,words_reviewed,session_count) VALUES(${userId}::uuid,${dayStart},${inc.studyMinutes??0},${inc.wordsLearned??0},${inc.wordsReviewed??0},${inc.sessionCount??0}) ON CONFLICT(user_id,date) DO UPDATE SET study_minutes=COALESCE(userdailyactivities.study_minutes,0)+EXCLUDED.study_minutes,words_learned=COALESCE(userdailyactivities.words_learned,0)+EXCLUDED.words_learned,words_reviewed=COALESCE(userdailyactivities.words_reviewed,0)+EXCLUDED.words_reviewed,session_count=COALESCE(userdailyactivities.session_count,0)+EXCLUDED.session_count`);
    } catch {
      // Ignored to prevent breaking session operations
    }
  }
}

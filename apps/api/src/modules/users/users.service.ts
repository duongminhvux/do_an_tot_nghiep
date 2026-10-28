import { BadRequestException,Injectable,Logger,Optional } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { DomainOutboxService } from '../../common/events/domain-outbox.service.js';
import { InjectPgConnection,createConnection,type PgConnection } from '../../postgres/connection.js';
import { SqlRecords } from '../../postgres/records.js';
import { first,joinSql,literal,sql,type Sql } from '../../postgres/sql.js';
import { learnedCounts,learningSnapshot } from '../learning/learning-reader.js';
import { contentBatches } from '../vocabulary/content-reader.js';
import { formatRelativeTime,formatVietnamDate,formatVietnamLastActive } from './admin-user-time.js';
import { CreateAdminUserDto,UpdateAdminUserDto } from './dto/create-admin-user.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { QueryAdminUserDto } from './dto/query-admin-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { AuthProvider,type UserRow } from './rows/user.row.js';
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@InjectPgConnection() private readonly db:PgConnection,private readonly i18n:I18nService,
    @Optional() private readonly domainOutbox?:DomainOutboxService) {}
  private get users(){return new SqlRecords(this.db,'users');}
  private async requireUser(id:string){const user=await this.users.one(sql`id=${id}::uuid AND is_deleted IS NOT TRUE`);
    if(!user)throw new BadRequestException(await this.i18n.t('user.USER_NOT_FOUND'));return user;}
  async isExistingEmail(email:string){return !!await this.users.one(sql`email=${email}`);}
  async create(data:CreateUserDto|Record<string,unknown>){
    if(!this.domainOutbox)throw new Error('Transactional outbox not configured');
    return this.domainOutbox.withTransaction(async session=>{
      const created=await new SqlRecords(createConnection(session.client as any),'users').insert({...data});
      await this.domainOutbox!.enqueue('identity.user.created.v1',String(created._id),{
        userId:String(created._id),username:created.username??null,avatarUrl:created.avatarUrl??null,
        isBanned:created.isBanned??false,isDeleted:created.isDeleted??false,sourceVersion:new Date(created.updatedAt).getTime(),
      },session);return created;
    });
  }
  findByEmail(email:string):Promise<UserRow|null>{return this.users.one(sql`email=${email}`);}
  findById(id:string):Promise<UserRow|null>{return this.users.one(sql`id=${id}::uuid`);}
  async update(id:string,data:Record<string,any>):Promise<any>{
    if(!this.domainOutbox)throw new Error('Transactional outbox not configured');
    return this.domainOutbox.withTransaction(async session=>{
      const updated=await new SqlRecords(createConnection(session.client as any),'users').patch(sql`id=${id}::uuid`,data);
      if(updated)await this.domainOutbox!.enqueue('identity.user.updated.v1',String(updated._id),{
        userId:String(updated._id),username:updated.username??null,avatarUrl:updated.avatarUrl??null,
        isBanned:updated.isBanned??false,isDeleted:updated.isDeleted??false,sourceVersion:new Date(updated.updatedAt).getTime(),
      },session);return updated;
    });
  }
  async updateProfile(id: string, updateProfileDto: UpdateProfileDto) {
    const updatedUser=await this.update(id,{...updateProfileDto,profileUpdatedAt:new Date()});

    if (!updatedUser) {
      throw new BadRequestException(await this.i18n.t('auth.USER_NOT_FOUND'));
    }

    return {
      message: await this.i18n.t('auth.PROFILE_UPDATED_SUCCESSFULLY'),
      profile: {
        _id: String(updatedUser._id),
        username: updatedUser.username,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
        role: 'USER' } };
  }

  // ==========================================
  // ADMIN USER MANAGEMENT METHODS (REAL DB ONLY)
  // ==========================================
  async findAllAdmin(query: QueryAdminUserDto) {
    const page=Math.max(1,Math.floor(query.page||1)),limit=Math.min(100,Math.max(1,Math.floor(query.limit||10))),skip=(page-1)*limit;
    const conditions:Sql[]=[literal('is_deleted IS NOT TRUE')];
    if(query.search?.trim())conditions.push(sql`(username ILIKE '%'||${query.search.trim()}||'%' OR email ILIKE '%'||${query.search.trim()}||'%')`);
    const status=query.status?.trim().toLowerCase();
    if(status&&status!=='all'&&status!=='tất cả')conditions.push(status==='banned'||status==='bị khóa'?literal('is_banned IS TRUE'):literal('is_banned IS NOT TRUE'));
    let from:Date|null=null;const now=new Date();
    if(query.dateRange==='today')from=new Date(`${new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(now)}T00:00:00+07:00`);
    else if(query.dateRange==='7days')from=new Date(Date.now()-7*86400000);
    else if(query.dateRange==='30days')from=new Date(Date.now()-30*86400000);
    else if(query.dateRange==='year')from=new Date(`${new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric'}).format(now)}-01-01T00:00:00+07:00`);
    if(from)conditions.push(sql`created_at>=${from}`);const where=joinSql(conditions,' AND ');
    const [rawUsers,totalMatched,summary]=await Promise.all([
      this.users.select(where,sql`ORDER BY created_at DESC,id LIMIT ${limit} OFFSET ${skip}`),this.users.count(where),
      first(this.db,sql`SELECT COUNT(*)::integer AS total,COUNT(*) FILTER(WHERE is_banned IS NOT TRUE)::integer AS active,
        COUNT(*) FILTER(WHERE is_banned IS TRUE)::integer AS banned,COUNT(*) FILTER(WHERE created_at>=${new Date(Date.now()-7*86400000)})::integer AS recent
        FROM public.users WHERE is_deleted IS NOT TRUE`),
    ]);
    const totalUsers=Number(summary?.total??0),activeUsers=Number(summary?.active??0),bannedUsers=Number(summary?.banned??0),newUsers7d=Number(summary?.recent??0);
    const wordCounts=await learnedCounts(this.db,rawUsers.map(user=>String(user._id)));
    const wordCountMap=new Map(wordCounts.map(word=>[String(word._id),word.count]));

    const items = rawUsers.map((user: any, index: number) => {
      const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
      const lastActiveDate = user.lastActive
        ? new Date(user.lastActive)
        : (user.updatedAt ? new Date(user.updatedAt) : createdDate);
      const formattedCreated = formatVietnamDate(createdDate);
      const formattedLastActive = formatVietnamLastActive(lastActiveDate, user.isBanned, this.i18n);
      const registrationAgo = formatRelativeTime(createdDate, this.i18n);

      const globalIndex = skip + index + 1;
      const customId = `U${String(globalIndex).padStart(3, '0')}`;

      return {
        _id: String(user._id),
        id: customId,
        name: user.username || user.email.split('@')[0],
        email: user.email,
        avatarUrl: user.avatarUrl || '',
        status: user.isBanned ? 'banned' : 'active',
        createdAt: formattedCreated,
        registrationAgo,
        lastActive: formattedLastActive,
        lastActiveDetails: this.i18n.t(user.isBanned ? 'user.STATUS_BANNED' : 'user.LAST_ACTIVITY'),
        phone: user.phone || '',
        wordsLearned: wordCountMap.get(String(user._id)) || 0,
        streakDays: 0,
        courses: [],
        recentActivities: [],
        personalDetail: {
          fullName: user.username || user.email.split('@')[0],
          email: user.email,
          phone: user.phone || '',
          authProvider: user.authProvider || 'local',
          isVerified: user.isVerified ?? false,
          createdAt: formattedCreated,
          bio: '' },
        learningStats: {
          totalWordsLearned: 0,
          accuracyRate: 0,
          testScoresAvg: 0,
          studyTimeMinutes: 0,
          dailyGoalStreak: 0 } };
    });

    const totalPages = Math.ceil(totalMatched / limit) || 1;

    return {
      items,
      total: totalMatched,
      page,
      limit,
      totalPages,
      stats: {
        totalUsers,
        activeUsers,
        newUsers7d,
        bannedUsers,
        growthTotal: 0,
        growthActive: 0,
        growthNew: 0,
        growthBanned: 0 } };
  }

  async findOneAdmin(id: string) {
    const user=await this.requireUser(id);

    const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
    const lastActiveDate = user.lastActive
      ? new Date(user.lastActive)
      : (user.updatedAt ? new Date(user.updatedAt) : createdDate);
    const formattedCreated = formatVietnamDate(createdDate);
    const formattedLastActive = formatVietnamLastActive(lastActiveDate, user.isBanned, this.i18n);
    const registrationAgo = formatRelativeTime(createdDate, this.i18n);

    const snapshot=await learningSnapshot(this.db,String(user._id));
    const wordsLearned=Number(snapshot.summary.learned??snapshot.words.length),completedLessonsCount=snapshot.progress.filter(row=>row.status==='COMPLETED').length;
    const sessions=snapshot.sessions;
    const allLessons=await contentBatches(this.db,'lessons',{ids:[...new Set(snapshot.progress.map(row=>String(row.lessonId)))]});
    const lessonsById=new Map(allLessons.map(lesson=>[String(lesson._id),lesson]));
    const collectionIds=[...new Set(allLessons.map(lesson=>String(lesson.collectionId)).filter(Boolean))];
    const collections=await contentBatches(this.db,'collections',{ids:collectionIds});
    const collectionsById=new Map(collections.map(collection=>[String(collection._id),collection]));
    const catalogLessons=await contentBatches(this.db,'lessons',{collectionIds,activeOnly:true},'collectionIds');
    const recentWords=snapshot.words.slice(0,6);
    const links=await contentBatches(this.db,'lessonwords',{ids:recentWords.map(word=>String(word.lessonWordId))});
    const linksById=new Map(links.map(link=>[String(link._id),link]));
    const vocabulary=await contentBatches(this.db,'words',{ids:links.map(link=>String(link.wordId))});
    const wordsById=new Map(vocabulary.map(word=>[String(word._id),word]));
    let totalStudyTimeMinutes = 0;
    sessions.forEach((s) => {
      if (s.startedAt && s.endedAt) {
        const diffMs = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
        if (diffMs > 0) totalStudyTimeMinutes += Math.round(diffMs / 60000);
      }
    });

    // 4. Query word reviews to calculate real accuracy
    const reviews=snapshot.reviews;

    let correctCount = 0;
    let incorrectCount = 0;
    reviews.forEach((r) => {
      correctCount += r.correctCount || 0;
      incorrectCount += r.incorrectCount || 0;
    });
    const totalReviews = correctCount + incorrectCount;
    const accuracyRate =
      totalReviews > 0 ? Math.round((correctCount / totalReviews) * 100) : 0;
    const testScoresAvg =
      totalReviews > 0 ? Math.round((correctCount / totalReviews) * 10 * 10) / 10 : 0;

    // 5. Query user lesson progresses and aggregate by collection
    const allUserLessonProgresses=snapshot.progress.map(row=>({...row,lessonId:lessonsById.get(String(row.lessonId))??null}));
    // Group by collectionId
    const colProgressMap = new Map<string, any[]>();
    for (const lp of allUserLessonProgresses) {
      const lessonObj: any = lp.lessonId;
      const colId = lessonObj?.collectionId ? String(lessonObj.collectionId) : 'other';
      if (!colProgressMap.has(colId)) {
        colProgressMap.set(colId, []);
      }
      colProgressMap.get(colId)!.push(lp);
    }

    const colors = [
      'bg-teal-500',
      'bg-indigo-500',
      'bg-amber-500',
      'bg-blue-600',
      'bg-rose-500',
      'bg-purple-500',
    ];
    let colorIdx = 0;

    const courses: any[] = [];
    for (const [colId, userLps] of colProgressMap.entries()) {
      if (colId !== 'other') {
        const col=collectionsById.get(colId)??null;
        const totalLessons=catalogLessons.filter(lesson=>String(lesson.collectionId)===colId).length;

        const completedLessons = userLps.filter(
          (p: any) => p.status === 'COMPLETED',
        ).length;
        const totalProgSum = userLps.reduce(
          (acc: number, p: any) => acc + (p.progress || 0),
          0,
        );
        const percentage =
          totalLessons > 0
            ? completedLessons > 0
              ? Math.round((completedLessons / totalLessons) * 100)
              : Math.max(1, Math.round(totalProgSum / totalLessons))
            : 0;

        const colName = col?.name || 'Khóa học';

        courses.push({
          id: colId,
          title: colName,
          letter: colName.charAt(0).toUpperCase(),
          color: colors[colorIdx++ % colors.length],
          progressText: `${completedLessons} / ${totalLessons || userLps.length} bài học`,
          percentage,
          completedItems: completedLessons,
          totalItems: totalLessons || userLps.length,
          type: 'lessons' });
      } else {
        for (const lp of userLps) {
          const lessonTitle = lp.lessonId?.title || 'Bài học';
          courses.push({
            id: String(lp._id),
            title: lessonTitle,
            letter: lessonTitle.charAt(0).toUpperCase(),
            color: colors[colorIdx++ % colors.length],
            progressText: `${lp.status === 'COMPLETED' ? '1 / 1' : '0 / 1'} bài học`,
            percentage: lp.progress || 0,
            completedItems: lp.status === 'COMPLETED' ? 1 : 0,
            totalItems: 1,
            type: 'lessons' });
        }
      }
    }

    // 6. Build recent activities from real database events
    const recentActivities: any[] = [];
    if (user.lastActive) {
      recentActivities.push({
        id: 'act-login',
        title: 'Đăng nhập hệ thống',
        time: formatVietnamLastActive(user.lastActive, false, this.i18n),
        type: 'login',
        timestamp: new Date(user.lastActive).getTime() });
    }

    // Lesson activities: "Hoàn thành bài học: <title> - <col>"
    for (const lp of allUserLessonProgresses.slice(0, 5)) {
      const time = lp.lastStudiedAt || (lp as any).updatedAt;
      if (time) {
        let colName = '';
        const lessonObj: any = lp.lessonId;
        if (lessonObj?.collectionId) {
          const col=collectionsById.get(String(lessonObj.collectionId));
          if (col?.name) colName = col.name;
        }
        const lessonTitle = lessonObj?.title || 'Bài học';
        const displayActivityTitle = colName
          ? `${lp.status === 'COMPLETED' ? 'Hoàn thành bài học' : 'Học bài học'}: ${lessonTitle} - ${colName}`
          : `${lp.status === 'COMPLETED' ? 'Hoàn thành bài học' : 'Học bài học'}: ${lessonTitle}`;

        recentActivities.push({
          id: `act-lp-${lp._id}`,
          title: displayActivityTitle,
          time: formatVietnamLastActive(time, false, this.i18n),
          type: 'lesson',
          timestamp: new Date(time).getTime() });
      }
    }

    // Word activities: "Học từ mới: <word>"
    for (const rw of recentWords) {
      const lw=linksById.get(String(rw.lessonWordId));
      if (lw?.wordId) {
        const w=wordsById.get(String(lw.wordId));
        if (w?.word) {
          const time = rw.learnedAt || (rw as any).createdAt;
          recentActivities.push({
            id: `act-word-${rw._id}`,
            title: `Học từ mới: ${w.word}`,
            time: formatVietnamLastActive(time, false, this.i18n),
            type: 'word',
            timestamp: new Date(time).getTime() });
        }
      }
    }

    if (user.profileUpdatedAt) {
      recentActivities.push({
        id: 'act-profile',
        title: 'Cập nhật thông tin cá nhân',
        time: formatVietnamLastActive(user.profileUpdatedAt, false, this.i18n),
        type: 'profile',
        timestamp: new Date(user.profileUpdatedAt).getTime() });
    }

    recentActivities.push({
      id: 'act-registered',
      title: 'Tài khoản được tạo',
      time: formatVietnamLastActive(createdDate, false, this.i18n),
      type: 'profile',
      timestamp: createdDate.getTime() });

    recentActivities.sort((a, b) => b.timestamp - a.timestamp);

    // 7. Calculate real streak days
    const activeDates = new Set<string>();
    if (user.lastActive) {
      activeDates.add(formatVietnamDate(user.lastActive));
    }
    sessions.forEach((s) => {
      if (s.startedAt) activeDates.add(formatVietnamDate(s.startedAt));
    });
    allUserLessonProgresses.forEach((lp: any) => {
      if (lp.lastStudiedAt) activeDates.add(formatVietnamDate(lp.lastStudiedAt));
    });
    const streakDays = activeDates.size;

    const completedCoursesCount = courses.filter((c: any) => c.percentage === 100).length;

    return {
      _id: String(user._id),
      id: String(user._id),
      name: user.username || user.email.split('@')[0],
      email: user.email,
      avatarUrl: user.avatarUrl || '',
      status: user.isBanned ? 'banned' : 'active',
      createdAt: formattedCreated,
      registrationAgo,
      lastActive: formattedLastActive,
      lastActiveDetails: this.i18n.t(user.isBanned ? 'user.STATUS_BANNED' : 'user.LAST_ACTIVITY'),
      phone: user.phone || '',
      notes: user.notes || '',
      wordsLearned,
      completedCoursesCount,
      inProgressCoursesCount: courses.filter((c: any) => c.percentage < 100).length,
      totalEnrolledCount: courses.length,
      streakDays,
      courses,
      recentActivities,
      personalDetail: {
        fullName: user.username || user.email.split('@')[0],
        email: user.email,
        phone: user.phone || '',
        authProvider: user.authProvider || 'local',
        isVerified: user.isVerified ?? false,
        createdAt: formattedCreated,
        bio: '' },
      learningStats: {
        totalWordsLearned: wordsLearned,
        accuracyRate,
        testScoresAvg,
        studyTimeMinutes: totalStudyTimeMinutes,
        dailyGoalStreak: streakDays } };
  }

  async updateNotes(id:string,notes:string){await this.requireUser(id);await this.update(id,{notes});return {success:true,notes};}
  async createAdmin(data:CreateAdminUserDto){
    if(await this.isExistingEmail(data.email))throw new BadRequestException('Email already exists');
    const created = await this.create({
      email: data.email.toLowerCase().trim(),
      username: data.name.trim(),
      phone: data.phone?.trim(),
      avatarUrl: data.avatarUrl || '',
      isBanned: data.status === 'banned',
      isDeleted: false,
      isVerified: true,
      authProvider: AuthProvider.LOCAL,
      lastActive: new Date() });

    return created;
  }
  async updateAdmin(id:string,data:UpdateAdminUserDto){
    const user=await this.requireUser(id);const changes:Record<string,any>={};
    if(data.email&&data.email!==user.email){if(await this.isExistingEmail(data.email))throw new BadRequestException('Email already exists');changes.email=data.email.toLowerCase().trim();}
    if(data.name)changes.username=data.name.trim();if(data.phone!==undefined)changes.phone=data.phone?.trim();
    if(data.avatarUrl!==undefined)changes.avatarUrl=data.avatarUrl;if(data.status)changes.isBanned=data.status==='banned';
    return this.update(id,changes);
  }
  async toggleBan(id:string){await this.requireUser(id);
    if(!this.domainOutbox)throw new Error('Transactional outbox not configured');
    return this.domainOutbox.withTransaction(async session=>{
      const db=createConnection(session.client as any),updated=await new SqlRecords(db,'users').patch(sql`id=${id}::uuid AND is_deleted IS NOT TRUE`,{}, {isBanned:sql`NOT COALESCE(is_banned,false)`});
      if(!updated)throw new BadRequestException('User not found');
      await this.domainOutbox!.enqueue('identity.user.updated.v1',id,{userId:id,username:updated.username??null,avatarUrl:updated.avatarUrl??null,
        isBanned:updated.isBanned??false,isDeleted:updated.isDeleted??false,sourceVersion:new Date(updated.updatedAt).getTime()},session);
      return {_id:String(updated._id),isBanned:updated.isBanned,status:updated.isBanned?'banned':'active'};
    });
  }
  async removeAdmin(id:string){await this.requireUser(id);await this.update(id,{isDeleted:true,deletedAt:new Date()});return {success:true};}

  /**
   * GET /admin/users/:userId/overview
   */
  async getUserOverviewAdmin(userId: string) {
    const user=await this.requireUser(userId);
    const snapshot=await learningSnapshot(this.db,String(user._id));
    const totalWordsLearned=Math.max(Number(snapshot.summary.learned??0),Number(snapshot.summary.reviewed??0));
    const totalWordsReviewed=Number(snapshot.summary.reviewCount??0);
    const studyMinutes=Math.max(Number(snapshot.summary.dailyMinutes??0),Math.round(Number(snapshot.summary.sessionMinutes??0)));
    const [dailyActivities,sessions,reviews,progresses]=[snapshot.daily,snapshot.sessions,snapshot.reviews,snapshot.progress];
    const studyDates = new Set<string>();
    dailyActivities.forEach((d) => {
      if (d.date) studyDates.add(new Date(d.date).toISOString().slice(0, 10));
    });
    sessions.forEach((s) => {
      if (s.startedAt)
        studyDates.add(new Date(s.startedAt).toISOString().slice(0, 10));
    });
    reviews.forEach((r) => {
      if (r.lastReviewedAt)
        studyDates.add(new Date(r.lastReviewedAt).toISOString().slice(0, 10));
    });
    progresses.forEach((p) => {
      if (p.lastStudiedAt)
        studyDates.add(new Date(p.lastStudiedAt).toISOString().slice(0, 10));
    });

    const sortedDates = Array.from(studyDates).sort();

    let longestStreak = 0;
    let tempStreak = 0;
    let prevTime: number | null = null;

    for (const dStr of sortedDates) {
      const curTime = new Date(`${dStr}T00:00:00.000Z`).getTime();
      if (prevTime === null) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curTime - prevTime) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          tempStreak += 1;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      prevTime = curTime;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    }

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let currentStreak = 0;
    let checkDate = new Date(now);

    if (studyDates.has(todayStr)) {
      while (studyDates.has(checkDate.toISOString().slice(0, 10))) {
        currentStreak += 1;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      }
    } else if (studyDates.has(yesterdayStr)) {
      checkDate = yesterday;
      while (studyDates.has(checkDate.toISOString().slice(0, 10))) {
        currentStreak += 1;
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    longestStreak = Math.max(longestStreak, currentStreak);

    return {
      totalWordsLearned,
      totalWordsReviewed,
      studyMinutes,
      currentStreak,
      longestStreak };
  }

  /**
   * GET /admin/users/:userId/progress
   * Tiến độ vocabulary của user theo Collection/Lesson
   */
  async getUserProgressAdmin(userId: string) {
    const user=await this.requireUser(userId);
    const snapshot=await learningSnapshot(this.db,String(user._id));
    const learnedIds=new Set(snapshot.words.map(word=>String(word.lessonWordId)));
    const collections=await contentBatches(this.db,'collections',{activeOnly:true,orderBy:'order'});
    const result = [];

    for (const col of collections) {
      const lessons=await contentBatches(this.db,'lessons',{collectionIds:[String(col._id)],activeOnly:true,orderBy:'order'},'collectionIds');
      const lessonIds=lessons.map(lesson=>String(lesson._id)),lessonSet=new Set(lessonIds);
      const userProgresses=snapshot.progress.filter(row=>lessonSet.has(String(row.lessonId)));
      const allLessonWords=await contentBatches(this.db,'lessonwords',{lessonIds},'lessonIds');
      const progressMap = new Map(
        userProgresses.map((p) => [String(p.lessonId), p]),
      );

      const learnedWordsCount=allLessonWords.filter(word=>learnedIds.has(String(word._id))).length;
      const totalWords = allLessonWords.length;
      let completedLessons = 0;

      const lessonList = lessons.map((l) => {
        const p = progressMap.get(String(l._id));
        const prog = p?.progress || 0;
        const status = p?.status || 'NOT_STARTED';
        if (status === 'COMPLETED') completedLessons += 1;

        return {
          lessonId: String(l._id),
          title: l.title,
          slug: l.slug,
          status,
          progress: prog,
          lastStudiedAt: p?.lastStudiedAt };
      });

      const colProgress =
        totalWords > 0
          ? Math.min(100, Math.round((learnedWordsCount / totalWords) * 100))
          : lessons.length > 0
            ? Math.round((completedLessons / lessons.length) * 100)
            : 0;

      result.push({
        collectionId: String(col._id),
        collectionName: col.name,
        totalLessons: lessons.length,
        completedLessons,
        totalWords,
        learnedWords: learnedWordsCount,
        progress: colProgress,
        lessons: lessonList });
    }

    return result;
  }

  /**
   * GET /admin/users/:userId/activity
   * Hoạt động học của user
   */
  async getUserActivityAdmin(userId: string) {
    const user=await this.requireUser(userId);
    const snapshot=await learningSnapshot(this.db,String(user._id));
    const progress=snapshot.progress.slice().sort((a,b)=>new Date(b.lastStudiedAt??b.updatedAt).getTime()-new Date(a.lastStudiedAt??a.updatedAt).getTime()).slice(0,10);
    const sessions=snapshot.sessions.slice(0,10);
    const lessons=await contentBatches(this.db,'lessons',{ids:[...new Set([...progress,...sessions].map(row=>String(row.lessonId)).filter(id=>id&&id!=='null'&&id!=='undefined'))]});
    const lessonMap=new Map(lessons.map(lesson=>[String(lesson._id),lesson]));
    const recentProgresses=progress.map(row=>({...row,lessonId:lessonMap.get(String(row.lessonId))??null}));
    const recentSessions=sessions.map(row=>({...row,lessonId:lessonMap.get(String(row.lessonId))??null}));
    const dailyActivities=snapshot.daily.slice(0,30);
    const recentActivities: any[] = [];

    for (const lp of recentProgresses) {
      const lessonObj = lp.lessonId as any;
      const title = lessonObj?.title
        ? `${lp.status === 'COMPLETED' ? 'Hoàn thành bài học' : 'Học bài'}: ${lessonObj.title}`
        : 'Học bài học';
      const time = lp.lastStudiedAt || (lp as any).updatedAt || new Date();
      recentActivities.push({
        id: `act-lp-${lp._id}`,
        type: 'LESSON',
        title,
        time: formatVietnamLastActive(time, false, this.i18n),
        createdAt: time });
    }

    for (const s of recentSessions) {
      const lessonObj = s.lessonId as any;
      let title = '';
      if (s.type === 'REVIEW') {
        title = `Ôn tập ${s.completedWords || 0} từ vựng`;
      } else {
        title = lessonObj?.title
          ? `Luyện tập: ${lessonObj.title}`
          : 'Luyện tập từ vựng';
      }
      recentActivities.push({
        id: `act-sess-${s._id}`,
        type: s.type || 'LESSON',
        title,
        time: formatVietnamLastActive(s.startedAt, false, this.i18n),
        createdAt: s.startedAt });
    }

    recentActivities.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      recentActivities: recentActivities.slice(0, 15),
      dailyActivities: dailyActivities.map((d) => ({
        date: d.date,
        studyMinutes: d.studyMinutes || 0,
        wordsLearned: d.wordsLearned || 0,
        wordsReviewed: d.wordsReviewed || 0,
        sessionCount: d.sessionCount || 0 })) };
  }
}

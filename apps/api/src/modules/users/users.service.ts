import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { InjectModel } from '@nestjs/mongoose';
import { AuthProvider, User, UserDocument } from './schema/user.schema.js';
import { Model, UpdateQuery, isValidObjectId, Types } from 'mongoose';
import { I18nService } from 'nestjs-i18n';
import { QueryAdminUserDto } from './dto/query-admin-user.dto.js';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/create-admin-user.dto.js';
import { UserLessonWord } from '../learning/progress/schemas/user-lesson-word.schema.js';
import { UserLessonProgress } from '../learning/progress/schemas/user-lesson-progress.schema.js';
import { LearningSession } from '../learning/sessions/schemas/learning-session.schema.js';
import { UserWordReview } from '../learning/reviews/schemas/user-word-review.schema.js';
import { Lesson } from '../vocabulary/lessons/lesson.schema.js';
import { LessonWord } from '../vocabulary/lessons/lesson-word.schema.js';
import { Word } from '../vocabulary/words/word.schema.js';
import { Collection } from '../vocabulary/collections/collection.schema.js';
import { UserDailyActivity } from '../learning/progress/schemas/user-daily-activity.schema.js';

function formatVietnamDate(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date); // DD/MM/YYYY
}

function formatVietnamTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date); // HH:mm
}

function formatVietnamLastActive(dateInput: Date | string | null | undefined, isBanned?: boolean): string {
  if (isBanned) return 'Không hoạt động';
  if (!dateInput) return 'Chưa có hoạt động';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Chưa có hoạt động';

  const vnFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = vnFormatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  const hour = getPart('hour');
  const minute = getPart('minute');

  const nowVNParts = vnFormatter.formatToParts(new Date());
  const getNowPart = (type: string) => nowVNParts.find((p) => p.type === type)?.value || '';
  const nowDay = getNowPart('day');
  const nowMonth = getNowPart('month');
  const nowYear = getNowPart('year');

  const formattedTime = `${hour}:${minute}`;

  // Check if today in VN (UTC+7)
  if (day === nowDay && month === nowMonth && year === nowYear) {
    return `Hôm nay, ${formattedTime}`;
  }

  // Check if yesterday in VN (UTC+7)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yParts = vnFormatter.formatToParts(yesterday);
  const getYPart = (type: string) => yParts.find((p) => p.type === type)?.value || '';
  if (day === getYPart('day') && month === getYPart('month') && year === getYPart('year')) {
    return `Hôm qua, ${formattedTime}`;
  }

  return `${day}/${month}/${year} ${formattedTime}`;
}

function formatRelativeTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return 'Vừa xong';

  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) return `${diffYears} năm trước`;
  if (diffMonths > 0) return `${diffMonths} tháng trước`;
  if (diffDays > 0) return `${diffDays} ngày trước`;
  if (diffHours > 0) return `${diffHours} giờ trước`;
  if (diffMinutes > 0) return `${diffMinutes} phút trước`;
  return 'Vừa xong';
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(UserLessonWord.name)
    private readonly userLessonWordModel: Model<UserLessonWord>,
    @InjectModel(UserLessonProgress.name)
    private readonly userLessonProgressModel: Model<UserLessonProgress>,
    @InjectModel(LearningSession.name)
    private readonly learningSessionModel: Model<LearningSession>,
    @InjectModel(UserWordReview.name)
    private readonly userWordReviewModel: Model<UserWordReview>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<Lesson>,
    @InjectModel(LessonWord.name)
    private readonly lessonWordModel: Model<LessonWord>,
    @InjectModel(Word.name)
    private readonly wordModel: Model<Word>,
    @InjectModel(Collection.name)
    private readonly collectionModel: Model<Collection>,
    @InjectModel(UserDailyActivity.name)
    private readonly userDailyActivityModel: Model<UserDailyActivity>,
    private readonly i18n: I18nService,
  ) {}

  async isExistingEmail(email: string) {
    return !!(await this.userModel.exists({ email }));
  }

  async create(data: CreateUserDto) {
    return await this.userModel.create({
      ...data
    });
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      return null;
    }
    return user.toObject() as UserDocument;
  }

  async findById(id: string): Promise<UserDocument | null> {
    const user = await this.userModel.findById(id);
    if (!user) {
      return null;
    }
    return user.toObject() as UserDocument;
  }

  async update(id: string, data: UpdateQuery<User>): Promise<UserDocument | null> {
    return await this.userModel.findByIdAndUpdate(id, data, { returnDocument: 'after' });
  }

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto) {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      id,
      {
        $set: {
          ...updateProfileDto,
          profileUpdatedAt: new Date(),
        },
      },
      { returnDocument: 'after', select: '-password -code -codeExpiresAt -__v' }
    );

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
        role: 'USER',
      },
    };
  }

  // ==========================================
  // ADMIN USER MANAGEMENT METHODS (REAL DB ONLY)
  // ==========================================
  async findAllAdmin(query: QueryAdminUserDto) {
    const filter: Record<string, any> = {
      isDeleted: { $ne: true },
    };

    if (query.search) {
      const q = query.search.trim();
      filter.$or = [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    if (query.status) {
      const statusLower = query.status.trim().toLowerCase();
      if (statusLower !== 'all' && statusLower !== 'tất cả') {
        const isBanned = statusLower === 'banned' || statusLower === 'bị khóa';
        filter.isBanned = isBanned ? true : { $ne: true };
      }
    }

    if (query.dateRange && query.dateRange !== 'all') {
      const now = new Date();
      if (query.dateRange === 'today') {
        const vnDateString = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(now);
        const startOfDayVN = new Date(`${vnDateString}T00:00:00+07:00`);
        filter.createdAt = { $gte: startOfDayVN };
      } else if (query.dateRange === '7days') {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filter.createdAt = { $gte: sevenDaysAgo };
      } else if (query.dateRange === '30days') {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        filter.createdAt = { $gte: thirtyDaysAgo };
      } else if (query.dateRange === 'year') {
        const vnYear = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
        }).format(now);
        const startOfYearVN = new Date(`${vnYear}-01-01T00:00:00+07:00`);
        filter.createdAt = { $gte: startOfYearVN };
      }
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, query.limit || 10);
    const skip = (page - 1) * limit;

    const [rawUsers, totalMatched, totalUsers, activeUsers, bannedUsers] =
      await Promise.all([
        this.userModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.userModel.countDocuments(filter),
        this.userModel.countDocuments({ isDeleted: { $ne: true } }),
        this.userModel.countDocuments({ isDeleted: { $ne: true }, isBanned: { $ne: true } }),
        this.userModel.countDocuments({ isDeleted: { $ne: true }, isBanned: true }),
      ]);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsers7d = await this.userModel.countDocuments({
      isDeleted: { $ne: true },
      createdAt: { $gte: sevenDaysAgo },
    });

    const userIds = rawUsers.map((u: any) => u._id);
    const wordCounts = await this.userLessonWordModel.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const wordCountMap = new Map(wordCounts.map((w: any) => [String(w._id), w.count]));

    const items = rawUsers.map((user: any, index: number) => {
      const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
      const lastActiveDate = user.lastActive
        ? new Date(user.lastActive)
        : (user.updatedAt ? new Date(user.updatedAt) : createdDate);
      const formattedCreated = formatVietnamDate(createdDate);
      const formattedLastActive = formatVietnamLastActive(lastActiveDate, user.isBanned);
      const registrationAgo = formatRelativeTime(createdDate);

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
        lastActiveDetails: user.isBanned ? 'bị khóa' : 'đăng nhập',
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
          bio: '',
        },
        learningStats: {
          totalWordsLearned: 0,
          accuracyRate: 0,
          testScoresAvg: 0,
          studyTimeMinutes: 0,
          dailyGoalStreak: 0,
        },
      };
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
        growthBanned: 0,
      },
    };
  }

  async findOneAdmin(id: string) {
    const filter: Record<string, any> = { isDeleted: false };
    if (isValidObjectId(id)) {
      filter._id = id;
    } else {
      filter._id = id;
    }

    const user: any = await this.userModel.findOne(filter).lean().exec();
    if (!user) {
      throw new BadRequestException(await this.i18n.t('user.USER_NOT_FOUND'));
    }

    const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
    const lastActiveDate = user.lastActive
      ? new Date(user.lastActive)
      : (user.updatedAt ? new Date(user.updatedAt) : createdDate);
    const formattedCreated = formatVietnamDate(createdDate);
    const formattedLastActive = formatVietnamLastActive(lastActiveDate, user.isBanned);
    const registrationAgo = formatRelativeTime(createdDate);

    // 1. Query real count of learned words
    const wordsLearned = await this.userLessonWordModel.countDocuments({
      userId: user._id,
    });

    // 2. Query real completed lessons count
    const completedLessonsCount = await this.userLessonProgressModel.countDocuments({
      userId: user._id,
      status: 'COMPLETED',
    });

    // 3. Query study sessions to calculate real study time
    const sessions = await this.learningSessionModel
      .find({ userId: user._id })
      .lean()
      .exec();

    let totalStudyTimeMinutes = 0;
    sessions.forEach((s) => {
      if (s.startedAt && s.endedAt) {
        const diffMs = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
        if (diffMs > 0) totalStudyTimeMinutes += Math.round(diffMs / 60000);
      }
    });

    // 4. Query word reviews to calculate real accuracy
    const reviews = await this.userWordReviewModel
      .find({ userId: user._id })
      .lean()
      .exec();

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
    const allUserLessonProgresses = await this.userLessonProgressModel
      .find({ userId: user._id })
      .sort({ updatedAt: -1 })
      .populate('lessonId')
      .lean()
      .exec();

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
        const col = await this.collectionModel
          .findById(colId)
          .select('name slug')
          .lean()
          .exec();
        const totalLessons = await this.lessonModel.countDocuments({
          collectionId: new Types.ObjectId(colId),
          isActive: true,
          isDeleted: false,
        });

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
          type: 'lessons',
        });
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
            type: 'lessons',
          });
        }
      }
    }

    // 6. Build recent activities from real database events
    const recentActivities: any[] = [];
    if (user.lastActive) {
      recentActivities.push({
        id: 'act-login',
        title: 'Đăng nhập hệ thống',
        time: formatVietnamLastActive(user.lastActive),
        type: 'login',
        timestamp: new Date(user.lastActive).getTime(),
      });
    }

    // Lesson activities: "Hoàn thành bài học: <title> - <col>"
    for (const lp of allUserLessonProgresses.slice(0, 5)) {
      const time = lp.lastStudiedAt || (lp as any).updatedAt;
      if (time) {
        let colName = '';
        const lessonObj: any = lp.lessonId;
        if (lessonObj?.collectionId) {
          const col = await this.collectionModel
            .findById(lessonObj.collectionId)
            .select('name')
            .lean()
            .exec();
          if (col?.name) colName = col.name;
        }
        const lessonTitle = lessonObj?.title || 'Bài học';
        const displayActivityTitle = colName
          ? `${lp.status === 'COMPLETED' ? 'Hoàn thành bài học' : 'Học bài học'}: ${lessonTitle} - ${colName}`
          : `${lp.status === 'COMPLETED' ? 'Hoàn thành bài học' : 'Học bài học'}: ${lessonTitle}`;

        recentActivities.push({
          id: `act-lp-${lp._id}`,
          title: displayActivityTitle,
          time: formatVietnamLastActive(time),
          type: 'lesson',
          timestamp: new Date(time).getTime(),
        });
      }
    }

    // Word activities: "Học từ mới: <word>"
    const recentWords = await this.userLessonWordModel
      .find({ userId: user._id })
      .sort({ learnedAt: -1, createdAt: -1 })
      .limit(6)
      .lean()
      .exec();

    for (const rw of recentWords) {
      const lw: any = await this.lessonWordModel
        .findById(rw.lessonWordId)
        .lean()
        .exec();
      if (lw?.wordId) {
        const w: any = await this.wordModel
          .findById(lw.wordId)
          .select('word')
          .lean()
          .exec();
        if (w?.word) {
          const time = rw.learnedAt || (rw as any).createdAt;
          recentActivities.push({
            id: `act-word-${rw._id}`,
            title: `Học từ mới: ${w.word}`,
            time: formatVietnamLastActive(time),
            type: 'word',
            timestamp: new Date(time).getTime(),
          });
        }
      }
    }

    if (user.profileUpdatedAt) {
      recentActivities.push({
        id: 'act-profile',
        title: 'Cập nhật thông tin cá nhân',
        time: formatVietnamLastActive(user.profileUpdatedAt),
        type: 'profile',
        timestamp: new Date(user.profileUpdatedAt).getTime(),
      });
    }

    recentActivities.push({
      id: 'act-registered',
      title: 'Tài khoản được tạo',
      time: formatVietnamLastActive(createdDate),
      type: 'profile',
      timestamp: createdDate.getTime(),
    });

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
      lastActiveDetails: user.isBanned ? 'bị khóa' : 'đăng nhập',
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
        bio: '',
      },
      learningStats: {
        totalWordsLearned: wordsLearned,
        accuracyRate,
        testScoresAvg,
        studyTimeMinutes: totalStudyTimeMinutes,
        dailyGoalStreak: streakDays,
      },
    };
  }

  async updateNotes(id: string, notes: string) {
    const filter: Record<string, any> = { isDeleted: false };
    if (isValidObjectId(id)) {
      filter._id = id;
    } else {
      filter._id = id;
    }

    const user = await this.userModel.findOne(filter);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    user.notes = notes;
    await user.save();
    return { success: true, notes: user.notes };
  }

  async createAdmin(data: CreateAdminUserDto) {
    const isExist = await this.isExistingEmail(data.email);
    if (isExist) {
      throw new BadRequestException('Email already exists');
    }

    const created = await this.userModel.create({
      email: data.email.toLowerCase().trim(),
      username: data.name.trim(),
      phone: data.phone?.trim(),
      avatarUrl: data.avatarUrl || '',
      isBanned: data.status === 'banned',
      isDeleted: false,
      isVerified: true,
      authProvider: AuthProvider.LOCAL,
      lastActive: new Date(),
    });

    return created;
  }

  async updateAdmin(id: string, data: UpdateAdminUserDto) {
    const user = await this.userModel.findById(id);
    if (!user || user.isDeleted) {
      throw new BadRequestException('User not found');
    }

    if (data.email && data.email !== user.email) {
      const isExist = await this.isExistingEmail(data.email);
      if (isExist) {
        throw new BadRequestException('Email already exists');
      }
      user.email = data.email.toLowerCase().trim();
    }

    if (data.name) user.username = data.name.trim();
    if (data.phone !== undefined) user.phone = data.phone?.trim();
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    if (data.status) {
      user.isBanned = data.status === 'banned';
    }

    await user.save();
    return user;
  }

  async toggleBan(id: string) {
    const user = await this.userModel.findById(id);
    if (!user || user.isDeleted) {
      throw new BadRequestException('User not found');
    }

    user.isBanned = !user.isBanned;
    await user.save();

    return {
      _id: String(user._id),
      isBanned: user.isBanned,
      status: user.isBanned ? 'banned' : 'active',
    };
  }

  async removeAdmin(id: string) {
    const user = await this.userModel.findById(id);
    if (!user || user.isDeleted) {
      throw new BadRequestException(await this.i18n.t('user.USER_NOT_FOUND'));
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();

    return { success: true };
  }

  /**
   * GET /admin/users/:userId/overview
   */
  async getUserOverviewAdmin(userId: string) {
    const filter: Record<string, any> = { isDeleted: false };
    if (isValidObjectId(userId)) {
      filter._id = userId;
    } else {
      filter._id = userId;
    }
    const user = await this.userModel.findOne(filter).lean();
    if (!user) {
      throw new BadRequestException(await this.i18n.t('user.USER_NOT_FOUND'));
    }

    const userObjId = new Types.ObjectId(String(user._id));

    // 1. Tổng từ đã học
    const [totalUserLessonWords, totalReviewedWords] = await Promise.all([
      this.userLessonWordModel.countDocuments({ userId: userObjId }),
      this.userWordReviewModel.countDocuments({ userId: userObjId }),
    ]);
    const totalWordsLearned = Math.max(totalUserLessonWords, totalReviewedWords);

    // 2. Tổng từ đã ôn
    const reviewAgg = await this.userWordReviewModel.aggregate([
      { $match: { userId: userObjId } },
      { $group: { _id: null, total: { $sum: '$reviewCount' } } },
    ]);
    const totalWordsReviewed = reviewAgg[0]?.total || 0;

    // 3. Tổng thời gian học
    const dailyAgg = await this.userDailyActivityModel.aggregate([
      { $match: { userId: userObjId } },
      { $group: { _id: null, total: { $sum: '$studyMinutes' } } },
    ]);
    const dailyMinutes = dailyAgg[0]?.total || 0;

    const sessionAgg = await this.learningSessionModel.aggregate([
      {
        $match: {
          userId: userObjId,
          startedAt: { $exists: true },
          endedAt: { $exists: true },
        },
      },
      {
        $project: {
          durationMinutes: {
            $divide: [{ $subtract: ['$endedAt', '$startedAt'] }, 60000],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$durationMinutes' },
        },
      },
    ]);
    const sessionMinutes = Math.round(sessionAgg[0]?.total || 0);
    const studyMinutes = Math.max(dailyMinutes, sessionMinutes);

    // 4. Streak
    const [dailyActivities, sessions, reviews, progresses] = await Promise.all([
      this.userDailyActivityModel
        .find({ userId: userObjId })
        .select('date')
        .lean(),
      this.learningSessionModel
        .find({ userId: userObjId })
        .select('startedAt')
        .lean(),
      this.userWordReviewModel
        .find({ userId: userObjId, lastReviewedAt: { $exists: true } })
        .select('lastReviewedAt')
        .lean(),
      this.userLessonProgressModel
        .find({ userId: userObjId, lastStudiedAt: { $exists: true } })
        .select('lastStudiedAt')
        .lean(),
    ]);

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
      longestStreak,
    };
  }

  /**
   * GET /admin/users/:userId/progress
   * Tiến độ vocabulary của user theo Collection/Lesson
   */
  async getUserProgressAdmin(userId: string) {
    const filter: Record<string, any> = { isDeleted: false };
    if (isValidObjectId(userId)) {
      filter._id = userId;
    } else {
      filter._id = userId;
    }
    const user = await this.userModel.findOne(filter).lean();
    if (!user) {
      throw new BadRequestException(await this.i18n.t('user.USER_NOT_FOUND'));
    }

    const userObjId = new Types.ObjectId(String(user._id));

    const collections = await this.collectionModel
      .find({ isActive: true, isDeleted: false })
      .sort({ order: 1 })
      .lean();

    const result = [];

    for (const col of collections) {
      const lessons = await this.lessonModel
        .find({
          collectionId: col._id,
          isActive: true,
          isDeleted: false,
        })
        .sort({ order: 1 })
        .lean();

      const lessonIds = lessons.map((l) => l._id);

      const [userProgresses, allLessonWords] = await Promise.all([
        this.userLessonProgressModel
          .find({
            userId: userObjId,
            lessonId: { $in: lessonIds },
          })
          .lean(),
        this.lessonWordModel
          .find({
            lessonId: { $in: lessonIds },
          })
          .select('_id lessonId')
          .lean(),
      ]);

      const progressMap = new Map(
        userProgresses.map((p) => [String(p.lessonId), p]),
      );

      const allLwIds = allLessonWords.map((lw) => lw._id);
      const learnedWordsCount = await this.userLessonWordModel.countDocuments({
        userId: userObjId,
        lessonWordId: { $in: allLwIds },
      });

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
          lastStudiedAt: p?.lastStudiedAt,
        };
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
        lessons: lessonList,
      });
    }

    return result;
  }

  /**
   * GET /admin/users/:userId/activity
   * Hoạt động học của user
   */
  async getUserActivityAdmin(userId: string) {
    const filter: Record<string, any> = { isDeleted: false };
    if (isValidObjectId(userId)) {
      filter._id = userId;
    } else {
      filter._id = userId;
    }
    const user = await this.userModel.findOne(filter).lean();
    if (!user) {
      throw new BadRequestException(await this.i18n.t('user.USER_NOT_FOUND'));
    }

    const userObjId = new Types.ObjectId(String(user._id));

    const [recentProgresses, recentSessions, dailyActivities] =
      await Promise.all([
        this.userLessonProgressModel
          .find({ userId: userObjId })
          .sort({ lastStudiedAt: -1, updatedAt: -1 })
          .limit(10)
          .populate('lessonId')
          .lean(),
        this.learningSessionModel
          .find({ userId: userObjId })
          .sort({ startedAt: -1 })
          .limit(10)
          .populate('lessonId')
          .lean(),
        this.userDailyActivityModel
          .find({ userId: userObjId })
          .sort({ date: -1 })
          .limit(30)
          .lean(),
      ]);

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
        time: formatVietnamLastActive(time),
        createdAt: time,
      });
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
        time: formatVietnamLastActive(s.startedAt),
        createdAt: s.startedAt,
      });
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
        sessionCount: d.sessionCount || 0,
      })),
    };
  }
}

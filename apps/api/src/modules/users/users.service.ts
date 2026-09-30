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
    return await this.userModel.findByIdAndUpdate(id, data, { new: true });
  }

  async updateProfile(id: string, updateProfileDto: UpdateProfileDto) {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      id,
      { $set: updateProfileDto },
      { new: true, select: '-password -code -codeExpiresAt -__v' }
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

    if (query.status && query.status !== 'all' && query.status !== 'Tất cả') {
      const isBanned = query.status === 'banned' || query.status === 'Bị khóa';
      filter.isBanned = isBanned ? true : { $ne: true };
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
      throw new BadRequestException('User not found');
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

    if (user.updatedAt && String(user.updatedAt) !== String(user.createdAt)) {
      recentActivities.push({
        id: 'act-profile',
        title: 'Cập nhật thông tin cá nhân',
        time: formatVietnamLastActive(user.updatedAt),
        type: 'profile',
        timestamp: new Date(user.updatedAt).getTime(),
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
    if (!user.isBanned) {
      user.lastActive = new Date();
    }
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
      throw new BadRequestException('User not found');
    }

    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();

    return { success: true };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Lesson, LessonDocument } from './lesson.schema.js';
import { Section, SectionDocument } from './section.schema.js';
import { LessonWord, LessonWordDocument } from './lesson-word.schema.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { CreateSectionDto } from './dto/create-section.dto.js';
import { UpdateSectionDto } from './dto/update-section.dto.js';
import { UpdateLessonWordDto } from './dto/update-lesson-word.dto.js';

@Injectable()
export class LessonsService {
  constructor(
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(Section.name) private readonly sectionModel: Model<SectionDocument>,
    @InjectModel(LessonWord.name) private readonly lessonWordModel: Model<LessonWordDocument>,
    private readonly i18n: I18nService,
  ) {}

  private getLang(): string {
    return I18nContext.current()?.lang || 'vi';
  }

  private generateSlug(text: string): string {
    if (!text) return '';
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  async createLesson(createLessonDto: CreateLessonDto): Promise<Lesson> {
    const collectionIdObj = new Types.ObjectId(createLessonDto.collectionId);
    const rawSlug = createLessonDto.slug?.trim() || createLessonDto.title;
    const baseSlug = this.generateSlug(rawSlug) || 'lesson';
    let slug = baseSlug;
    let counter = 1;
    while (
      await this.lessonModel.exists({
        collectionId: collectionIdObj,
        slug,
        isDeleted: { $ne: true },
      })
    ) {
      slug = `${baseSlug}-${counter++}`;
    }

    let order = createLessonDto.order;
    if (order === undefined || order === null || order <= 0) {
      const count = await this.lessonModel.countDocuments({
        collectionId: collectionIdObj,
        isDeleted: { $ne: true },
      });
      order = count + 1;
    }

    const createdLesson = new this.lessonModel({
      ...createLessonDto,
      collectionId: collectionIdObj,
      slug,
      order,
    });
    return createdLesson.save();
  }

  async findAllLessons(collectionId?: string): Promise<any[]> {
    const filter: Record<string, any> = { isDeleted: { $ne: true } };
    if (collectionId) {
      filter.collectionId = new Types.ObjectId(collectionId);
    }
    const lessons = await this.lessonModel
      .find(filter)
      .sort({ order: 1, createdAt: -1 })
      .lean()
      .exec();

    const lessonIds = lessons.map((l) => l._id);
    const [wordCounts, sectionCounts] = await Promise.all([
      this.lessonWordModel.aggregate([
        { $match: { lessonId: { $in: lessonIds } } },
        { $group: { _id: '$lessonId', count: { $sum: 1 } } },
      ]),
      this.sectionModel.aggregate([
        { $match: { lessonId: { $in: lessonIds } } },
        { $group: { _id: '$lessonId', count: { $sum: 1 } } },
      ]),
    ]);

    const wordCountMap = new Map(
      wordCounts.map((wc) => [wc._id.toString(), wc.count]),
    );
    const sectionCountMap = new Map(
      sectionCounts.map((sc) => [sc._id.toString(), sc.count]),
    );

    return lessons.map((l) => ({
      ...l,
      wordsCount: wordCountMap.get(l._id.toString()) || 0,
      sectionsCount: sectionCountMap.get(l._id.toString()) || 0,
    }));
  }

  async findOneLesson(id: string): Promise<any> {
    const lang = this.getLang();
    const lesson = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } }).lean().exec();
    if (!lesson) {
      throw new NotFoundException(
        await this.i18n.t('lesson.LESSON_NOT_FOUND', { lang }),
      );
    }
    const [wordsCount, sectionsCount] = await Promise.all([
      this.lessonWordModel.countDocuments({
        lessonId: new Types.ObjectId(id),
      }).exec(),
      this.sectionModel.countDocuments({
        lessonId: new Types.ObjectId(id),
      }).exec(),
    ]);
    return {
      ...lesson,
      wordsCount,
      sectionsCount,
    };
  }

  async updateLesson(id: string, updateLessonDto: UpdateLessonDto): Promise<Lesson> {
    const lang = this.getLang();
    const updateData: Partial<Lesson> = { ...updateLessonDto } as any;
    if (updateLessonDto.collectionId) {
      updateData.collectionId = new Types.ObjectId(updateLessonDto.collectionId);
    }

    if (updateLessonDto.slug || updateLessonDto.title) {
      const existingLesson = await this.findOneLesson(id);
      const targetColId = updateData.collectionId || existingLesson.collectionId;
      const rawSlug = updateLessonDto.slug?.trim() || updateLessonDto.title;
      if (rawSlug) {
        const baseSlug = this.generateSlug(rawSlug) || 'lesson';
        let slug = baseSlug;
        let counter = 1;
        while (
          await this.lessonModel.exists({
            _id: { $ne: id },
            collectionId: targetColId,
            slug,
            isDeleted: { $ne: true },
          })
        ) {
          slug = `${baseSlug}-${counter++}`;
        }
        updateData.slug = slug;
      }
    }

    const updatedLesson = await this.lessonModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updateData, { new: true })
      .exec();
    if (!updatedLesson) {
      throw new NotFoundException(
        await this.i18n.t('lesson.LESSON_NOT_FOUND', { lang }),
      );
    }
    return updatedLesson;
  }

  async toggleActive(id: string, isActive?: boolean): Promise<Lesson> {
    const lang = this.getLang();
    const lesson = await this.findOneLesson(id);
    const nextActive = isActive !== undefined ? isActive : !lesson.isActive;
    const updated = await this.lessonModel
      .findOneAndUpdate(
        { _id: id, isDeleted: { $ne: true } },
        { isActive: nextActive },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new NotFoundException(
        await this.i18n.t('lesson.LESSON_NOT_FOUND', { lang }),
      );
    }
    return updated;
  }

  async removeLesson(id: string): Promise<Lesson> {
    const lang = this.getLang();
    const deletedLesson = await this.lessonModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { isDeleted: true }, { new: true })
      .exec();
    if (!deletedLesson) {
      throw new NotFoundException(
        await this.i18n.t('lesson.LESSON_NOT_FOUND', { lang }),
      );
    }
    return deletedLesson;
  }

  async restore(id: string): Promise<Lesson> {
    const lang = this.getLang();
    const restored = await this.lessonModel
      .findOneAndUpdate({ _id: id }, { isDeleted: false }, { new: true })
      .exec();
    if (!restored) {
      throw new NotFoundException(
        await this.i18n.t('lesson.LESSON_NOT_FOUND', { lang }),
      );
    }
    return restored;
  }

  async reorderLessons(items: { id: string; order: number }[]): Promise<void> {
    const operations = items.map((item) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(item.id) },
        update: { $set: { order: item.order } },
      },
    }));
    if (operations.length > 0) {
      await this.lessonModel.bulkWrite(operations);
    }
  }

  // ==========================
  // SECTIONS MANAGEMENT
  // ==========================
  async createSection(lessonId: string, createSectionDto: CreateSectionDto): Promise<Section> {
    await this.findOneLesson(lessonId); // Validate lesson exists

    const lessonIdObj = new Types.ObjectId(lessonId);
    const rawSlug = createSectionDto.slug?.trim() || createSectionDto.name;
    const baseSlug = this.generateSlug(rawSlug) || 'section';
    let slug = baseSlug;
    let counter = 1;
    while (
      await this.sectionModel.exists({
        lessonId: lessonIdObj,
        slug,
      })
    ) {
      slug = `${baseSlug}-${counter++}`;
    }

    let order = createSectionDto.order;
    if (order === undefined || order === null || order <= 0) {
      const count = await this.sectionModel.countDocuments({
        lessonId: lessonIdObj,
      });
      order = count + 1;
    }

    const section = new this.sectionModel({
      ...createSectionDto,
      lessonId: lessonIdObj,
      slug,
      order,
    });
    return section.save();
  }

  async getSections(lessonId: string): Promise<any[]> {
    await this.findOneLesson(lessonId);

    const sections = await this.sectionModel
      .find({ lessonId: new Types.ObjectId(lessonId) })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();

    const sectionIds = sections.map((s) => s._id);
    const wordCounts = await this.lessonWordModel.aggregate([
      { $match: { sectionId: { $in: sectionIds } } },
      { $group: { _id: '$sectionId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(wordCounts.map((wc) => [wc._id.toString(), wc.count]));

    return sections.map((s) => ({
      ...s,
      wordsCount: countMap.get(s._id.toString()) || 0,
    }));
  }

  async getSectionById(sectionId: string): Promise<any> {
    const lang = this.getLang();
    const section = await this.sectionModel.findById(sectionId).lean().exec();
    if (!section) {
      throw new NotFoundException(
        await this.i18n.t('lesson.SECTION_NOT_FOUND', { lang }),
      );
    }
    const wordsCount = await this.lessonWordModel.countDocuments({
      sectionId: new Types.ObjectId(sectionId),
    }).exec();
    return {
      ...section,
      wordsCount,
    };
  }

  async updateSection(sectionId: string, updateSectionDto: UpdateSectionDto): Promise<Section> {
    const lang = this.getLang();
    const existing = await this.sectionModel.findById(sectionId).exec();
    if (!existing) {
      throw new NotFoundException(
        await this.i18n.t('lesson.SECTION_NOT_FOUND', { lang }),
      );
    }

    const updateData: any = { ...updateSectionDto };

    if (updateSectionDto.name || updateSectionDto.slug) {
      const rawSlug = updateSectionDto.slug?.trim() || updateSectionDto.name || existing.name;
      const baseSlug = this.generateSlug(rawSlug) || 'section';
      let slug = baseSlug;
      let counter = 1;
      while (
        await this.sectionModel.exists({
          _id: { $ne: sectionId },
          lessonId: existing.lessonId,
          slug,
        })
      ) {
        slug = `${baseSlug}-${counter++}`;
      }
      updateData.slug = slug;
    }

    const updated = await this.sectionModel
      .findByIdAndUpdate(sectionId, updateData, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(
        await this.i18n.t('lesson.SECTION_NOT_FOUND', { lang }),
      );
    }
    return updated;
  }

  async deleteSection(sectionId: string): Promise<void> {
    const lang = this.getLang();
    const res = await this.sectionModel.findByIdAndDelete(sectionId).exec();
    if (!res) {
      throw new NotFoundException(
        await this.i18n.t('lesson.SECTION_NOT_FOUND', { lang }),
      );
    }
    // Unassign sectionId for words that belonged to this section
    await this.lessonWordModel
      .updateMany(
        { sectionId: new Types.ObjectId(sectionId) },
        { $unset: { sectionId: 1 } },
      )
      .exec();
  }

  async reorderSections(lessonId: string, items: { id: string; order: number }[]): Promise<void> {
    const operations = items.map((item) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(item.id), lessonId: new Types.ObjectId(lessonId) },
        update: { $set: { order: item.order } },
      },
    }));
    if (operations.length > 0) {
      await this.sectionModel.bulkWrite(operations);
    }
  }

  // ==========================
  // LESSON WORDS MANAGEMENT
  // ==========================
  async addWordsToLesson(
    lessonId: string,
    wordIds: string[],
    sectionId?: string,
  ): Promise<LessonWord[]> {
    await this.findOneLesson(lessonId); // Validate lesson existence

    const lessonObjectId = new Types.ObjectId(lessonId);
    const sectionObjectId = sectionId ? new Types.ObjectId(sectionId) : undefined;

    const baseFilter: any = { lessonId: lessonObjectId };
    if (sectionObjectId) {
      baseFilter.sectionId = sectionObjectId;
    }
    const currentCount = await this.lessonWordModel.countDocuments(baseFilter);

    const operations = wordIds.map((wordId, index) => {
      const setOnInsert: any = {
        lessonId: lessonObjectId,
        wordId: new Types.ObjectId(wordId),
        order: currentCount + index + 1,
      };

      const updateDoc: any = {
        $setOnInsert: setOnInsert,
      };

      if (sectionObjectId) {
        updateDoc.$set = { sectionId: sectionObjectId };
      }

      return {
        updateOne: {
          filter: { lessonId: lessonObjectId, wordId: new Types.ObjectId(wordId) },
          update: updateDoc,
          upsert: true,
        },
      };
    });

    if (operations.length > 0) {
      await this.lessonWordModel.bulkWrite(operations);
    }

    return this.getWordsInLesson(lessonId, sectionId);
  }

  async getWordsInLesson(lessonId: string, sectionId?: string): Promise<LessonWord[]> {
    await this.findOneLesson(lessonId); // Validate lesson existence

    const filter: any = { lessonId: new Types.ObjectId(lessonId) };
    if (sectionId) {
      filter.sectionId = new Types.ObjectId(sectionId);
    }

    return this.lessonWordModel
      .find(filter)
      .populate('wordId')
      .populate('sectionId')
      .sort({ createdAt: -1, _id: -1 })
      .exec();
  }

  async updateLessonWord(
    lessonId: string,
    wordId: string,
    updateDto: UpdateLessonWordDto,
  ): Promise<LessonWord> {
    const updateSet: any = {};
    const updateUnset: any = {};

    if (updateDto.sectionId !== undefined) {
      if (updateDto.sectionId) {
        updateSet.sectionId = new Types.ObjectId(updateDto.sectionId);
      } else {
        updateUnset.sectionId = 1;
      }
    }
    if (updateDto.order !== undefined) {
      updateSet.order = updateDto.order;
    }
    if (updateDto.customNote !== undefined) {
      updateSet.customNote = updateDto.customNote;
    }

    const query = {
      lessonId: new Types.ObjectId(lessonId),
      wordId: new Types.ObjectId(wordId),
    };

    const updatePayload: any = {};
    if (Object.keys(updateSet).length > 0) updatePayload.$set = updateSet;
    if (Object.keys(updateUnset).length > 0) updatePayload.$unset = updateUnset;

    const updated = await this.lessonWordModel
      .findOneAndUpdate(query, updatePayload, { new: true })
      .populate('wordId')
      .populate('sectionId')
      .exec();

    if (!updated) {
      const lang = this.getLang();
      throw new NotFoundException(
        await this.i18n.t('lesson.WORD_NOT_IN_LESSON', { lang }),
      );
    }
    return updated;
  }

  async reorderLessonWords(
    lessonId: string,
    items: { wordId: string; order: number; sectionId?: string | null }[],
  ): Promise<void> {
    const lessonObjectId = new Types.ObjectId(lessonId);
    const operations = items.map((item) => {
      const updateSet: any = { order: item.order };
      const updateUnset: any = {};

      if (item.sectionId !== undefined) {
        if (item.sectionId) {
          updateSet.sectionId = new Types.ObjectId(item.sectionId);
        } else {
          updateUnset.sectionId = 1;
        }
      }

      const updatePayload: any = { $set: updateSet };
      if (Object.keys(updateUnset).length > 0) {
        updatePayload.$unset = updateUnset;
      }

      return {
        updateOne: {
          filter: { lessonId: lessonObjectId, wordId: new Types.ObjectId(item.wordId) },
          update: updatePayload,
        },
      };
    });

    if (operations.length > 0) {
      await this.lessonWordModel.bulkWrite(operations);
    }
  }

  async removeWordFromLesson(lessonId: string, wordId: string): Promise<void> {
    const result = await this.lessonWordModel
      .deleteOne({
        lessonId: new Types.ObjectId(lessonId),
        wordId: new Types.ObjectId(wordId),
      })
      .exec();

    if (result.deletedCount === 0) {
      const lang = this.getLang();
      throw new NotFoundException(
        await this.i18n.t('lesson.WORD_NOT_IN_LESSON', { lang }),
      );
    }
  }
}


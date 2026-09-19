import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lesson, LessonDocument } from './lesson.schema.js';
import { LessonWord, LessonWordDocument } from './lesson-word.schema.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';

@Injectable()
export class LessonsService {
  constructor(
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(LessonWord.name) private readonly lessonWordModel: Model<LessonWordDocument>,
  ) {}

  async createLesson(createLessonDto: CreateLessonDto): Promise<Lesson> {
    const createdLesson = new this.lessonModel({
      ...createLessonDto,
      collectionId: new Types.ObjectId(createLessonDto.collectionId),
    });
    return createdLesson.save();
  }

  async findAllLessons(collectionId?: string): Promise<Lesson[]> {
    const filter: Record<string, any> = { isDeleted: { $ne: true } };
    if (collectionId) {
      filter.collectionId = new Types.ObjectId(collectionId);
    }
    return this.lessonModel.find(filter).sort({ order: 1, createdAt: -1 }).exec();
  }

  async findOneLesson(id: string): Promise<Lesson> {
    const lesson = await this.lessonModel.findOne({ _id: id, isDeleted: { $ne: true } }).exec();
    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }
    return lesson;
  }

  async updateLesson(id: string, updateLessonDto: UpdateLessonDto): Promise<Lesson> {
    const updateData: Partial<Lesson> = { ...updateLessonDto } as any;
    if (updateLessonDto.collectionId) {
      updateData.collectionId = new Types.ObjectId(updateLessonDto.collectionId);
    }

    const updatedLesson = await this.lessonModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, updateData, { new: true })
      .exec();
    if (!updatedLesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }
    return updatedLesson;
  }

  async removeLesson(id: string): Promise<Lesson> {
    const deletedLesson = await this.lessonModel
      .findOneAndUpdate({ _id: id, isDeleted: { $ne: true } }, { isDeleted: true }, { new: true })
      .exec();
    if (!deletedLesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }
    return deletedLesson;
  }

  // LessonWords Management
  async addWordsToLesson(lessonId: string, wordIds: string[]): Promise<LessonWord[]> {
    await this.findOneLesson(lessonId); // Validate lesson existence

    const lessonObjectId = new Types.ObjectId(lessonId);
    const operations = wordIds.map((wordId, index) => ({
      updateOne: {
        filter: { lessonId: lessonObjectId, wordId: new Types.ObjectId(wordId) },
        update: {
          $setOnInsert: {
            lessonId: lessonObjectId,
            wordId: new Types.ObjectId(wordId),
            order: index,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      await this.lessonWordModel.bulkWrite(operations);
    }

    return this.getWordsInLesson(lessonId);
  }

  async getWordsInLesson(lessonId: string): Promise<LessonWord[]> {
    await this.findOneLesson(lessonId); // Validate lesson existence

    return this.lessonWordModel
      .find({ lessonId: new Types.ObjectId(lessonId) })
      .populate('wordId')
      .sort({ order: 1 })
      .exec();
  }

  async removeWordFromLesson(lessonId: string, wordId: string): Promise<void> {
    const result = await this.lessonWordModel
      .deleteOne({
        lessonId: new Types.ObjectId(lessonId),
        wordId: new Types.ObjectId(wordId),
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Word with ID ${wordId} is not in lesson ${lessonId}`);
    }
  }
}

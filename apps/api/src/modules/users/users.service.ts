import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { InjectModel } from '@nestjs/mongoose';
import { AuthProvider, User, UserDocument } from './schema/user.schema.js';
import { Model, UpdateQuery } from 'mongoose';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly i18n: I18nService,
  ) { }

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
}

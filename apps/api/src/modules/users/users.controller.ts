/// <reference types="multer" />
import { PermissionCondition, PermissionExemption, RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { BadRequestException,Body,Controller,Logger,Patch,Post,Req,UploadedFile,UseGuards,UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ManagedMediaService } from '../upload/managed-media.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';

const AVATAR_FOLDER = 'avatars';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);
  constructor(
    private readonly usersService: UsersService,
    private readonly media: ManagedMediaService,
  ) {}

  @RequirePermissions('users.create')
  @PermissionCondition('C2')
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    if ((createUserDto.authProvider && createUserDto.authProvider !== 'local')
      || createUserDto.code !== undefined || createUserDto.codeExpiresAt !== undefined) {
      throw new BadRequestException('Legacy provisioning accepts local accounts without verification overrides');
    }
    return this.usersService.createAdmin({email:createUserDto.email,name:createUserDto.username,
      password:createUserDto.password ?? '',avatarUrl:createUserDto.avatarUrl});
  }

  @PermissionCondition('C5')
  @PermissionExemption('E5')
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @Req() req: any,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    return await this.usersService.updateProfile(req.user._id, updateProfileDto);
  }

  /** Learner self-service avatar upload. Image bytes are signature-checked (PNG/JPEG/GIF/WebP). */
  @PermissionCondition('C5')
  @PermissionExemption('E5')
  @UseGuards(JwtAuthGuard)
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES, files: 1 } }))
  async uploadAvatar(@Req() req: any, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Please provide an image file');
    const previous = (await this.usersService.findById(req.user._id))?.avatarUrl;
    const uploaded = await this.media.uploadFile(file, AVATAR_FOLDER);
    let result;
    try {
      result = await this.usersService.updateProfile(req.user._id, { avatarUrl: uploaded.url });
    } catch (error) {
      await this.media.deleteFile(uploaded.public_id).catch(() => undefined);
      throw error;
    }
    if (previous && previous !== uploaded.url && previous.includes(`/uploads/${AVATAR_FOLDER}/`) && this.media.isManagedUrl(previous)) {
      await this.media.deleteFile(previous).catch(cause => this.logger.warn(`Old avatar cleanup failed: ${String(cause)}`));
    }
    return result;
  }
}

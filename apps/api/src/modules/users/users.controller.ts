import { PermissionCondition, PermissionExemption, RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { BadRequestException,Body,Controller,Patch,Post,Req,UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}

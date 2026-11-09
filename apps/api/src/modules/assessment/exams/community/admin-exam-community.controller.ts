import {
  Body,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { AdminController } from '../../../auth/decorators/admin-controller.decorator.js';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator.js';
import { CommunityPageDto, PinExamCommentDto } from './exam-community.dto.js';
import { ExamCommunityService } from './exam-community.service.js';
type Viewer = { user: { _id: string } };
@AdminController('exams/:examId')
export class AdminExamCommunityController {
  constructor(private readonly community: ExamCommunityService) {}
  @Get('leaderboard')
  @RequirePermissions('toeic.read')
  @Header('Cache-Control', 'private, no-store')
  leaderboard(
    @Param('examId', new ParseUUIDPipe()) exam: string,
    @Req() req: Viewer,
    @Query() query: CommunityPageDto,
  ) {
    return this.community.leaderboard(exam, req.user._id, query.page, true);
  }
  @Get('comments')
  @RequirePermissions('toeic.read')
  @Header('Cache-Control', 'private, no-store')
  comments(
    @Param('examId', new ParseUUIDPipe()) exam: string,
    @Req() req: Viewer,
    @Query() query: CommunityPageDto,
  ) {
    return this.community.comments(
      exam,
      req.user._id,
      query.page,
      undefined,
      true,
    );
  }
  @Get('comments/:id/replies')
  @RequirePermissions('toeic.read')
  @Header('Cache-Control', 'private, no-store')
  replies(
    @Param('examId', new ParseUUIDPipe()) exam: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Viewer,
    @Query() query: CommunityPageDto,
  ) {
    return this.community.comments(exam, req.user._id, query.page, id, true);
  }
  @Delete('comments/:id')
  @RequirePermissions('toeic.comments.moderate')
  remove(
    @Param('examId', new ParseUUIDPipe()) exam: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Viewer,
  ) {
    return this.community.remove(exam, id, req.user._id, true);
  }
  @Patch('comments/:id/pin')
  @RequirePermissions('toeic.comments.moderate')
  pin(
    @Param('examId', new ParseUUIDPipe()) exam: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PinExamCommentDto,
  ) {
    return this.community.pin(exam, id, dto.pinned);
  }
}

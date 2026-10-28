import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  CommunityPageDto,
  CreateExamCommentDto,
  CommentReactionDto,
} from './exam-community.dto.js';
import { ExamCommunityService } from './exam-community.service.js';
type Viewer = { user: { _id: string; role: string } };
@Controller('exams/:examId')
export class ExamCommunityController {
  constructor(private readonly community: ExamCommunityService) {}
  @Get('leaderboard')
  @Header('Cache-Control', 'private, no-store')
  leaderboard(
    @Param('examId') exam: string,
    @Req() req: Viewer,
    @Query() query: CommunityPageDto,
  ) {
    return this.community.leaderboard(exam, req.user._id, query.page);
  }
  @Get('comments')
  @Header('Cache-Control', 'private, no-store')
  comments(
    @Param('examId') exam: string,
    @Req() req: Viewer,
    @Query() query: CommunityPageDto,
  ) {
    return this.community.comments(exam, req.user._id, query.page);
  }
  @Get('comments/:id/replies')
  @Header('Cache-Control', 'private, no-store')
  replies(
    @Param('examId') exam: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Viewer,
    @Query() query: CommunityPageDto,
  ) {
    return this.community.comments(exam, req.user._id, query.page, id);
  }
  @Post('comments')
  post(
    @Param('examId') exam: string,
    @Req() req: Viewer,
    @Body() dto: CreateExamCommentDto,
  ) {
    return this.community.post(exam, req.user._id, dto);
  }
  @Delete('comments/:id')
  remove(
    @Param('examId') exam: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Viewer,
  ) {
    return this.community.remove(
      exam,
      id,
      req.user._id,
      req.user.role === 'ADMIN',
    );
  }
  @Put('comments/:id/reaction')
  react(
    @Param('examId') exam: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Viewer,
    @Body() dto: CommentReactionDto,
  ) {
    return this.community.react(exam, id, req.user._id, dto.emoji);
  }
  @Delete('comments/:id/reaction')
  unreact(
    @Param('examId') exam: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Viewer,
  ) {
    return this.community.react(exam, id, req.user._id, null);
  }
}

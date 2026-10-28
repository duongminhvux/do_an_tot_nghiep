import {
Body,
Controller,
Get,
Header,
Inject,
Param,
ParseUUIDPipe,
Patch,
Query,
Req,
} from '@nestjs/common';
import { AdminController } from '../../auth/decorators/admin-controller.decorator.js';
import { MistakesQueryDto,ReviewMistakeDto } from './mistakes.dto.js';
import { MistakesService } from './mistakes.service.js';
type RequestUser = { user: { _id: string } };
@Controller('learning/mistakes')
export class MistakesController {
  constructor(
    @Inject(MistakesService) private readonly mistakes: MistakesService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Req() req: RequestUser, @Query() query: MistakesQueryDto) {
    return this.mistakes.list(String(req.user._id), query);
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Req() req: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.mistakes.detail(String(req.user._id), id);
  }
  @Get(':id/review-word')
  @Header('Cache-Control', 'private, no-store')
  reviewWord(
    @Req() req: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.mistakes.reviewWord(String(req.user._id), id);
  }
  @Patch(':id/reviewed')
  reviewed(
    @Req() req: RequestUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReviewMistakeDto,
  ) {
    return this.mistakes.markReviewed(
      String(req.user._id),
      id,
      body.seenWrongCount,
    );
  }
}
@AdminController('learning/mistakes')
export class AdminMistakesController {
  constructor(
    @Inject(MistakesService) private readonly mistakes: MistakesService,
  ) {}
  @Get('statistics') statistics() {
    return this.mistakes.statistics();
  }
}

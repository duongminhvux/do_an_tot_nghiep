import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SavedWordsService } from './saved-words.service.js';
import { CreateSavedWordDto } from './dto/create-saved-word.dto.js';
import { QuerySavedWordsDto } from './dto/query-saved-words.dto.js';
import { UpdateSavedWordNoteDto } from './dto/update-saved-word.dto.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';

@Controller('learning/saved-words')
@UseGuards(JwtAuthGuard)
export class SavedWordsController {
  constructor(private readonly savedWordsService: SavedWordsService) {}

  @Post()
  saveWord(@Req() req: any, @Body() dto: CreateSavedWordDto) {
    return this.savedWordsService.saveWord(req.user._id, dto);
  }

  @Post('toggle')
  toggleSave(@Req() req: any, @Body('wordId') wordId: string) {
    return this.savedWordsService.toggleSave(req.user._id, wordId);
  }

  @Get()
  findAll(@Req() req: any, @Query() query: QuerySavedWordsDto) {
    return this.savedWordsService.findAll(req.user._id, query);
  }

  @Get('ids')
  getAllSavedWordIds(@Req() req: any) {
    return this.savedWordsService.getAllSavedWordIds(req.user._id);
  }

  @Get('stats')
  getStats(@Req() req: any) {
    return this.savedWordsService.getStats(req.user._id);
  }

  @Get('check/:wordId')
  checkIsSaved(@Req() req: any, @Param('wordId') wordId: string) {
    return this.savedWordsService.checkIsSaved(req.user._id, wordId);
  }

  @Patch(':wordId/note')
  updateNote(
    @Req() req: any,
    @Param('wordId') wordId: string,
    @Body() dto: UpdateSavedWordNoteDto,
  ) {
    return this.savedWordsService.updateNote(req.user._id, wordId, dto);
  }

  @Delete(':wordId')
  unsaveWord(@Req() req: any, @Param('wordId') wordId: string) {
    return this.savedWordsService.unsaveWord(req.user._id, wordId);
  }
}

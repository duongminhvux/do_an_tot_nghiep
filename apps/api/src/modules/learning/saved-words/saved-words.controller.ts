import {
Body,
Controller,
Delete,
Get,
Param,
Patch,
Post,
Query,
Req,
UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CreateSavedWordDto } from './dto/create-saved-word.dto.js';
import { CreateVocabularyFolderDto } from './dto/create-vocabulary-folder.dto.js';
import { QuerySavedWordsDto } from './dto/query-saved-words.dto.js';
import { UpdateSavedWordNoteDto } from './dto/update-saved-word.dto.js';
import { UpdateVocabularyFolderDto } from './dto/update-vocabulary-folder.dto.js';
import { SavedWordsService } from './saved-words.service.js';

@Controller('learning/saved-words')
@UseGuards(JwtAuthGuard)
export class SavedWordsController {
  constructor(private readonly savedWordsService: SavedWordsService) {}

  @Get('folders')
  getFolders(@Req() req: any) {
    return this.savedWordsService.getFolders(req.user._id);
  }

  @Get('folders/:folderId/words/search')
  searchWords(
    @Req() req: any,
    @Param('folderId') folderId: string,
    @Query('search') search?: string,
  ) {
    return this.savedWordsService.searchWords(req.user._id, folderId, search);
  }

  @Post('folders')
  createFolder(@Req() req: any, @Body() dto: CreateVocabularyFolderDto) {
    return this.savedWordsService.createFolder(req.user._id, dto);
  }

  @Patch('folders/:folderId')
  updateFolder(
    @Req() req: any,
    @Param('folderId') folderId: string,
    @Body() dto: UpdateVocabularyFolderDto,
  ) {
    return this.savedWordsService.updateFolder(req.user._id, folderId, dto);
  }

  @Delete('folders/:folderId')
  deleteFolder(@Req() req: any, @Param('folderId') folderId: string) {
    return this.savedWordsService.deleteFolder(req.user._id, folderId);
  }

  @Post()
  saveWord(@Req() req: any, @Body() dto: CreateSavedWordDto) {
    return this.savedWordsService.saveWord(req.user._id, dto);
  }

  @Post('toggle')
  toggleSave(
    @Req() req: any,
    @Body('wordId') wordId: string,
    @Body('folderId') folderId?: string,
  ) {
    return this.savedWordsService.toggleSave(req.user._id, wordId, folderId);
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

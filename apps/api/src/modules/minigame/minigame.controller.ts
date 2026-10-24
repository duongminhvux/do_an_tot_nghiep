import { GameCatalogService } from './services/game-catalog.service.js';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req } from '@nestjs/common';
import { MiniGameWordSourceService } from './services/minigame-word-source.service.js';
import { MiniGameResultService } from './services/minigame-result.service.js';
import { StartTypingRushDto } from './dto/start-typing-rush.dto.js';
import { CreateMiniGameResultDto } from './dto/create-minigame-result.dto.js';
import { MiniGameType } from './minigame.types.js';
type UserRequest = { user: { _id: string } };
@Controller('minigames')
export class MiniGameController {
  constructor(
    private readonly sources: MiniGameWordSourceService,
    private readonly results: MiniGameResultService,
    private readonly catalog: GameCatalogService,
  ) {}
  @Get('catalog') catalogList() {
    return this.catalog.list(true);
  }
  @Get() publicList() {
    return this.catalog.list(true);
  }
  @Get('vocabulary-sources') async sourcesList(@Req() req: UserRequest) {
    const [sources, settings] = await Promise.all([
      this.sources.list(String(req.user._id)),
      this.catalog.typingRushSettings(),
    ]);
    return { ...sources, settings };
  }
  @Get('meaning-typing/vocabulary-sources') async meaningSources(
    @Req() req: UserRequest,
  ) {
    const [sources, settings] = await Promise.all([
      this.sources.list(String(req.user._id)),
      this.catalog.meaningTypingSettings(),
    ]);
    return { ...sources, settings };
  }
  @Post('typing-rush/start') async start(
    @Req() req: UserRequest,
    @Body() dto: StartTypingRushDto,
  ) {
    await this.catalog.assertEnabled('TYPING_RUSH');
    const settings = await this.catalog.typingRushSettings();
    return {
      gameType: MiniGameType.TYPING_RUSH,
      difficulty: dto.difficulty,
      config: {
        audioEnabled: settings.audioEnabled,
        backgroundMusicUrl: settings.backgroundMusicUrl,
        correctSoundUrl: settings.correctSoundUrl,
        wrongSoundUrl: settings.wrongSoundUrl,
        loseSoundUrl: settings.loseSoundUrl,
        lives: settings.lives,
        maxLives: settings.maxLives,
        initialFallSpeed: settings.initialFallSpeed,
        spawnInterval: settings.spawnInterval,
        heartEveryWords: settings.heartEveryWords,
        meaningDurationSeconds: settings.meaningDurationSeconds },
      words: await this.sources.pool(
        String(req.user._id),
        dto.sources,
        settings,
      ) };
  }
  @Post('meaning-typing/start') async startMeaningTyping(
    @Req() req: UserRequest,
    @Body() dto: StartTypingRushDto,
  ) {
    await this.catalog.assertEnabled('MEANING_TYPING');
    const settings = await this.catalog.meaningTypingSettings();
    return {
      gameType: MiniGameType.MEANING_TYPING,
      difficulty: dto.difficulty,
      config: settings,
      words: await this.sources.pool(
        String(req.user._id),
        dto.sources,
        settings,
      ) };
  }
  @Get('word-shooter/vocabulary-sources') async wordShooterSources(
    @Req() req: UserRequest,
  ) {
    const [sources, settings] = await Promise.all([
      this.sources.list(String(req.user._id)),
      this.catalog.wordShooterSettings(),
    ]);
    return { ...sources, settings };
  }
  @Post('word-shooter/start') async startWordShooter(
    @Req() req: UserRequest,
    @Body() dto: StartTypingRushDto,
  ) {
    await this.catalog.assertEnabled(MiniGameType.WORD_SHOOTER);
    const settings = await this.catalog.wordShooterSettings();
    const pool = await this.sources.pool(String(req.user._id), dto.sources, {
      minWordCount: 1 });
    const meanings = new Set<string>();
    const words = pool.filter((word) => {
      const meaning = word.meaning
        ?.trim()
        .toLocaleLowerCase('vi')
        .normalize('NFC');
      if (!meaning || meanings.has(meaning)) return false;
      meanings.add(meaning);
      return true;
    });
    if (words.length < Math.max(settings.minWordCount, settings.wordsPerRound))
      throw new BadRequestException('WORD_SHOOTER_MIN_WORDS');
    return {
      gameType: MiniGameType.WORD_SHOOTER,
      config: { ...settings },
      words };
  }
  @Post('results') save(
    @Req() req: UserRequest,
    @Body() dto: CreateMiniGameResultDto,
  ) {
    return this.results.save(String(req.user._id), dto);
  }
  @Get('results/:gameType') stats(
    @Req() req: UserRequest,
    @Param('gameType') gameType: string,
  ) {
    return this.results.stats(String(req.user._id), gameType);
  }
}

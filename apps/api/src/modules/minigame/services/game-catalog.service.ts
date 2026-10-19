import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  IMPLEMENTED_GAME_CODES,
  IMPLEMENTED_GAMES,
  TYPING_RUSH_DEFAULT_SETTINGS,
  type TypingRushSettings,
} from '../game-registry.js';
import { MiniGameType } from '../minigame.types.js';
import type { TypingRushSettingsDto } from '../dto/typing-rush-settings.dto.js';
import {
  GameCategory,
  GameDefinition,
} from '../schemas/game-definition.schema.js';
import { ReorderGamesDto, UpdateGameDto } from '../dto/game-definition.dto.js';
@Injectable()
export class GameCatalogService implements OnModuleInit {
  constructor(
    @InjectModel(GameDefinition.name)
    private readonly games: Model<GameDefinition>,
  ) {}
  async onModuleInit() {
    await this.games.updateOne(
      { code: 'TYPING_RUSH' },
      {
        $set: { destination: IMPLEMENTED_GAMES.TYPING_RUSH.destination },
        $setOnInsert: {
          code: 'TYPING_RUSH',
          name: 'Luyện gõ từ vựng',
          nameEn: 'Typing Rush',
          description: 'Luyện phản xạ và ghi nhớ từ vựng qua từng lượt gõ.',
          descriptionEn:
            'Build your typing reflexes and remember vocabulary as you play.',
          imageUrl: '',
          settings: { ...TYPING_RUSH_DEFAULT_SETTINGS },
          category: GameCategory.SOLO,
          order: 0,
          isActive: true,
        },
      },
      { upsert: true },
    );
  }
  list(publicOnly = false) {
    return this.games
      .find({
        code: { $in: IMPLEMENTED_GAME_CODES },
        ...(publicOnly ? { isActive: true } : {}),
      })
      .sort({ order: 1, _id: 1 })
      .lean();
  }
  async update(id: string, dto: UpdateGameDto) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('INVALID_GAME_ID');
    const game = await this.games
      .findOneAndUpdate(
        { _id: id, code: { $in: IMPLEMENTED_GAME_CODES } },
        { $set: dto },
        { returnDocument: 'after', runValidators: true },
      )
      .lean();
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    return game;
  }
  async updateByCode(code: string, dto: UpdateGameDto) {
    this.requireImplemented(code);
    const game = await this.games
      .findOneAndUpdate(
        { code },
        { $set: dto },
        { returnDocument: 'after', runValidators: true },
      )
      .lean();
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    return game;
  }
  private requireImplemented(code: string) {
    if (!IMPLEMENTED_GAME_CODES.includes(code))
      throw new NotFoundException('GAME_NOT_IMPLEMENTED');
  }
  async configuration(code: string) {
    this.requireImplemented(code);
    const game = await this.games.findOne({ code }).lean();
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    switch (code) {
      case MiniGameType.TYPING_RUSH: {
        const settings = Object.fromEntries(
          Object.entries(TYPING_RUSH_DEFAULT_SETTINGS).map(([key, value]) => [
            key,
            game.settings?.[key as keyof TypingRushSettings] ?? value,
          ]),
        ) as TypingRushSettings;
        settings.maxLives =
          game.settings?.maxLives ??
          Math.max(settings.lives, TYPING_RUSH_DEFAULT_SETTINGS.maxLives);
        return { gameType: MiniGameType.TYPING_RUSH, settings };
      }
      default:
        throw new NotFoundException('GAME_SETTINGS_NOT_SUPPORTED');
    }
  }
  async updateConfiguration(code: string, settings: TypingRushSettingsDto) {
    if (settings.maxLives < settings.lives)
      throw new BadRequestException('MINIGAME_INVALID_LIFE_LIMIT');
    this.requireImplemented(code);
    if (code !== MiniGameType.TYPING_RUSH)
      throw new NotFoundException('GAME_SETTINGS_NOT_SUPPORTED');
    const game = await this.games
      .findOneAndUpdate(
        { code },
        { $set: { settings } },
        { returnDocument: 'after', runValidators: true },
      )
      .lean();
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    return this.configuration(code);
  }
  async typingRushSettings(): Promise<TypingRushSettings> {
    return (await this.configuration(MiniGameType.TYPING_RUSH)).settings;
  }
  async reorder(dto: ReorderGamesDto) {
    const games = await this.list();
    const ids = new Set(games.map((game) => String(game._id)));
    if (
      dto.items.length !== ids.size ||
      dto.items.some((item) => !ids.has(item.id))
    )
      throw new BadRequestException('GAME_LIST_CHANGED');
    if (dto.items.length)
      await this.games.bulkWrite(
        dto.items.map((item) => ({
          updateOne: {
            filter: { _id: item.id },
            update: { $set: { order: item.order } },
          },
        })),
      );
    return this.list();
  }
  async assertEnabled(code: string) {
    this.requireImplemented(code);
    if (!(await this.games.findOne({ code, isActive: true }).lean()))
      throw new ForbiddenException('MINIGAME_DISABLED');
  }
}

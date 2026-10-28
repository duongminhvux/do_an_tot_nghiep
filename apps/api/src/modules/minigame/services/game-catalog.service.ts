import {
BadRequestException,
ForbiddenException,
Injectable,
NotFoundException,
OnModuleInit
} from '@nestjs/common';
import { InjectPgConnection,type PgConnection } from '../../../postgres/connection.js';
import { isUuid } from '../../../postgres/ids.js';
import { first,rowData,rows,sql,SqlTable } from '../../../postgres/sql.js';
import { ReorderGamesDto,UpdateGameDto } from '../dto/game-definition.dto.js';
import type { MeaningTypingSettingsDto } from '../dto/meaning-typing-settings.dto.js';
import type { TypingRushSettingsDto } from '../dto/typing-rush-settings.dto.js';
import type { WordShooterSettingsDto } from '../dto/word-shooter-settings.dto.js';
import {
IMPLEMENTED_GAME_CODES,
IMPLEMENTED_GAMES,
MEANING_TYPING_DEFAULT_SETTINGS,
TYPING_RUSH_DEFAULT_SETTINGS,
WORD_SHOOTER_DEFAULT_SETTINGS,
type MeaningTypingSettings,
type TypingRushSettings,
type WordShooterSettings
} from '../game-registry.js';
import { MiniGameType } from '../minigame.types.js';
@Injectable()
export class GameCatalogService implements OnModuleInit {
  constructor(
    @InjectPgConnection() private readonly db: PgConnection,
  ) {}
  private get writer() {return new SqlTable(this.db,'gamedefinitions',{
    name:'name',nameEn:'name_en',description:'description',descriptionEn:'description_en',imageUrl:'image_url',
    badge:'badge',destination:'destination',category:'category',order:'order',isActive:'is_active',settings:'settings'
  },['badge','category','settings']);}
  async onModuleInit() {
    const seeds=[{
          code: 'TYPING_RUSH',
          name: 'Luyện gõ từ vựng',
          nameEn: 'Typing Rush',
          description: 'Luyện phản xạ và ghi nhớ từ vựng qua từng lượt gõ.',
          descriptionEn:
            'Build your typing reflexes and remember vocabulary as you play.',
          imageUrl: '',
          settings: { ...TYPING_RUSH_DEFAULT_SETTINGS },
          category: 'SOLO',
          order: 0,
          isActive: true },
{
          code: 'MEANING_TYPING',
          name: 'Gõ từ theo nghĩa',
          nameEn: 'Meaning Typing',
          description: 'Nhìn nghĩa tiếng Việt và gõ từ tiếng Anh tương ứng.',
          descriptionEn:
            'Read the Vietnamese meaning and type the matching English word.',
          imageUrl: '',
          settings: { ...MEANING_TYPING_DEFAULT_SETTINGS },
          category: 'SOLO',
          order: 1,
          isActive: true },
{
          code: 'WORD_SHOOTER',
          name: 'Bắn từ vựng',
          nameEn: 'Word Shooter',
          description:
            'Ngắm đúng từ tiếng Anh theo nghĩa và bắn trước khi hết giờ.',
          descriptionEn:
            'Shoot the English word matching the meaning before time runs out.',
          imageUrl: '',
          settings: { ...WORD_SHOOTER_DEFAULT_SETTINGS },
          category: 'SOLO',
          order: 2,
          isActive: true }];
    for(const seed of seeds)await rows(this.db,sql`INSERT INTO public.gamedefinitions
      (code,name,name_en,description,description_en,image_url,settings,category,"order",is_active,destination)
      VALUES (${seed.code},${seed.name},${seed.nameEn},${seed.description},${seed.descriptionEn},'',${JSON.stringify(seed.settings)}::jsonb,
        '"SOLO"'::jsonb,${seed.order},true,${IMPLEMENTED_GAMES[seed.code as keyof typeof IMPLEMENTED_GAMES].destination})
      ON CONFLICT (code) DO UPDATE SET destination=EXCLUDED.destination,payload=gamedefinitions.payload-'destination'`);
  }
  async list(publicOnly=false) {
    return (await rows(this.db,sql`SELECT * FROM public.gamedefinitions WHERE code=ANY(${IMPLEMENTED_GAME_CODES}::text[])
      AND (NOT ${publicOnly}::boolean OR is_active IS TRUE) ORDER BY "order" ASC NULLS LAST,id`)).map(row=>rowData<any>(row));
  }
  async update(id: string, dto: UpdateGameDto) {
    if (!isUuid(id))
      throw new BadRequestException('INVALID_GAME_ID');
    const game = await this.writer.patch(sql`id=${id}::uuid AND code=ANY(${IMPLEMENTED_GAME_CODES}::text[])`, dto);
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    return game;
  }
  async updateByCode(code: string, dto: UpdateGameDto) {
    this.requireImplemented(code);
    const game = await this.writer.patch(sql`code=${code}`, dto);
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    return game;
  }
  private requireImplemented(code: string) {
    if (!IMPLEMENTED_GAME_CODES.includes(code))
      throw new NotFoundException('GAME_NOT_IMPLEMENTED');
  }
  async configuration(code: string) {
    this.requireImplemented(code);
    const row = await first(this.db,sql`SELECT * FROM public.gamedefinitions WHERE code=${code}`);
    const game=row?rowData<any>(row):null;
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    switch (code) {
      case MiniGameType.WORD_SHOOTER: {
        const settings = Object.fromEntries(
          Object.entries(WORD_SHOOTER_DEFAULT_SETTINGS).map(([key, value]) => [
            key,
            (game.settings as Partial<WordShooterSettings> | null)?.[
              key as keyof WordShooterSettings
            ] ?? value,
          ]),
        ) as WordShooterSettings;
        return { gameType: MiniGameType.WORD_SHOOTER, settings };
      }
      case MiniGameType.TYPING_RUSH: {
        const settings = Object.fromEntries(
          Object.entries(TYPING_RUSH_DEFAULT_SETTINGS).map(([key, value]) => [
            key,
            (game.settings as Partial<TypingRushSettings> | null)?.[
              key as keyof TypingRushSettings
            ] ?? value,
          ]),
        ) as TypingRushSettings;
        settings.maxLives =
          (game.settings as Partial<TypingRushSettings> | null)?.maxLives ??
          Math.max(settings.lives, TYPING_RUSH_DEFAULT_SETTINGS.maxLives);
        return { gameType: MiniGameType.TYPING_RUSH, settings };
      }
      case MiniGameType.MEANING_TYPING: {
        const settings = Object.fromEntries(
          Object.entries(MEANING_TYPING_DEFAULT_SETTINGS).map(
            ([key, value]) => [
              key,
              (game.settings as Partial<MeaningTypingSettings> | null)?.[
                key as keyof MeaningTypingSettings
              ] ?? value,
            ],
          ),
        ) as MeaningTypingSettings;
        settings.maxLives =
          (game.settings as Partial<TypingRushSettings> | null)?.maxLives ??
          Math.max(settings.lives, MEANING_TYPING_DEFAULT_SETTINGS.maxLives);
        return { gameType: MiniGameType.MEANING_TYPING, settings };
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
    const game = await this.writer.patch(sql`code=${code}`, { settings });
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    return this.configuration(code);
  }
  async updateMeaningTypingConfiguration(
    code: string,
    settings: MeaningTypingSettingsDto,
  ) {
    if (settings.maxLives < settings.lives)
      throw new BadRequestException('MINIGAME_INVALID_LIFE_LIMIT');
    this.requireImplemented(code);
    if (code !== MiniGameType.MEANING_TYPING)
      throw new NotFoundException('GAME_SETTINGS_NOT_SUPPORTED');
    const game = await this.writer.patch(sql`code=${code}`, { settings });
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    return this.configuration(code);
  }
  async typingRushSettings(): Promise<TypingRushSettings> {
    return (await this.configuration(MiniGameType.TYPING_RUSH))
      .settings as TypingRushSettings;
  }
  async meaningTypingSettings(): Promise<MeaningTypingSettings> {
    return (await this.configuration(MiniGameType.MEANING_TYPING))
      .settings as MeaningTypingSettings;
  }
  async wordShooterSettings(): Promise<WordShooterSettings> {
    return (await this.configuration(MiniGameType.WORD_SHOOTER))
      .settings as WordShooterSettings;
  }
  async updateWordShooterConfiguration(settings: WordShooterSettingsDto) {
    if (
      settings.minWordCount < settings.wordsPerRound ||
      settings.wrongShotPenaltySeconds >= settings.roundDurationSeconds
    )
      throw new BadRequestException('WORD_SHOOTER_INVALID_SETTINGS');
    const game = await this.writer.patch(sql`code=${MiniGameType.WORD_SHOOTER}`, { settings });
    if (!game) throw new NotFoundException('GAME_NOT_FOUND');
    return this.configuration(MiniGameType.WORD_SHOOTER);
  }
  async reorder(dto: ReorderGamesDto) {
    const games = await this.list();
    const ids = new Set(games.map((game) => String(game._id)));
    if (
      dto.items.length !== ids.size ||
      dto.items.some((item) => !ids.has(item.id))
    )
      throw new BadRequestException('GAME_LIST_CHANGED');
    if(new Set(dto.items.map(item=>item.id)).size!==ids.size)throw new BadRequestException('GAME_LIST_CHANGED');
    if(dto.items.length)await rows(this.db,sql`UPDATE public.gamedefinitions g SET "order"=i."order",payload=g.payload-'order'
      FROM jsonb_to_recordset(${JSON.stringify(dto.items)}::jsonb) i(id uuid,"order" double precision) WHERE g.id=i.id`);
    return this.list();
  }
  async assertEnabled(code: string) {
    this.requireImplemented(code);
    if (!await first(this.db,sql`SELECT 1 FROM public.gamedefinitions WHERE code=${code} AND is_active IS TRUE`))
      throw new ForbiddenException('MINIGAME_DISABLED');
  }
}

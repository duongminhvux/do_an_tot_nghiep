import { IsDefined, IsInt, IsObject, Min } from 'class-validator';

/** The config body is normalized (clamped, defaults filled) by the shared dictation-settings module. */
export class UpdateDictationSettingsDto {
  @IsInt() @Min(0) revision!: number;
  @IsDefined() @IsObject() config!: Record<string, unknown>;
}

import { IsString, MaxLength, MinLength, Matches } from 'class-validator';
export class AdminChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(1024) oldPassword!: string;
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[\s\S]+$/)
  newPassword!: string;
}

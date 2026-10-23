import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { IsEmail, IsEnum, IsOptional, IsUrl } from 'class-validator';
import type { PgDocument } from '../../../postgres/compat.js';

export type UserDocument = PgDocument<User>;

export enum AuthProvider {
    LOCAL = 'local',
    GOOGLE = 'google' }

@PgEntity({ timestamps: true })
export class User {
    @IsEmail()
    @PgField({ unique: true, required: true, lowercase: true, trim: true })
    email!: string;

    @PgField({ trim: true })
    username?: string;

    @IsOptional()
    @PgField({ required: false })
    password?: string;

    @IsOptional()
    @IsUrl()
    @PgField()
    avatarUrl?: string;

    @IsEnum(AuthProvider)
    @PgField({ enum: AuthProvider, default: AuthProvider.LOCAL })
    authProvider!: AuthProvider;

    @IsOptional()
    @PgField({ unique: true, sparse: true })
    ggId?: string;

    @PgField({ default: false })
    isVerified!: boolean;

    @IsOptional()
    @PgField()
    code?: string;

    @IsOptional()
    @PgField()
    codeExpiresAt?: Date;

    @PgField({ default: false })
    isDeleted: boolean;

    @PgField()
    deletedAt?: Date;

    @PgField({ default: false })
    isBanned!: boolean;

    @IsOptional()
    @PgField()
    phone?: string;

    @IsOptional()
    @PgField({ default: Date.now })
    lastActive?: Date;

    @IsOptional()
    @PgField({ default: '' })
    notes?: string;

    @IsOptional()
    @PgField()
    profileUpdatedAt?: Date;
}

export const UserSchema = PgSchemaFactory.createForClass(User);

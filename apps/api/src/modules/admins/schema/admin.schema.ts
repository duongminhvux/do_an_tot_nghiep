import { PgField, PgEntity, PgSchemaFactory } from '../../../postgres/compat.js';
import { IsEmail, IsOptional, IsUrl } from 'class-validator';
import type { PgDocument } from '../../../postgres/compat.js';

export type AdminDocument = PgDocument<Admin>;

@PgEntity({ timestamps: true, collection: 'admins' })
export class Admin {
    @IsEmail()
    @PgField({ unique: true, required: true, lowercase: true, trim: true })
    email!: string;

    @PgField({ required: true, trim: true })
    username!: string;

    @PgField({ required: true })
    password!: string;

    @IsOptional()
    @IsUrl()
    @PgField()
    avatarUrl?: string;

    @PgField({ default: false })
    isDeleted: boolean;

    @PgField()
    deletedAt?: Date;
}

export const AdminSchema = PgSchemaFactory.createForClass(Admin);

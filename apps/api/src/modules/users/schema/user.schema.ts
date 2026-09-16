import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsEmail, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum AuthProvider {
    LOCAL = 'local',
    GOOGLE = 'google',
}

@Schema({ timestamps: true })
export class User {
    @IsEmail()
    @Prop({ unique: true, required: true, lowercase: true, trim: true })
    email!: string;

    @Prop({ trim: true })
    username?: string;

    @IsOptional()
    @Prop({ required: false })
    password?: string;

    @IsOptional()
    @IsUrl()
    @Prop()
    avatarUrl?: string;

    @IsEnum(AuthProvider)
    @Prop({ enum: AuthProvider, default: AuthProvider.LOCAL })
    authProvider!: AuthProvider;

    @IsOptional()
    @Prop({ unique: true, sparse: true })
    ggId?: string;

    @Prop({ default: false })
    isVerified!: boolean;

    @IsOptional()
    @Prop()
    code?: string;

    @IsOptional()
    @Prop()
    codeExpiresAt?: Date;

    @Prop({ default: false })
    isDeleted: boolean;

    @Prop()
    deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

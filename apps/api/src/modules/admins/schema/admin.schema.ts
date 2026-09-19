import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { IsEmail, IsOptional, IsUrl } from 'class-validator';
import { HydratedDocument } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

@Schema({ timestamps: true, collection: 'admins' })
export class Admin {
    @IsEmail()
    @Prop({ unique: true, required: true, lowercase: true, trim: true })
    email!: string;

    @Prop({ required: true, trim: true })
    username!: string;

    @Prop({ required: true })
    password!: string;

    @IsOptional()
    @IsUrl()
    @Prop()
    avatarUrl?: string;

    @Prop({ default: false })
    isDeleted: boolean;

    @Prop()
    deletedAt?: Date;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);

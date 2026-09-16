import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class GmailService {
    private transporter: nodemailer.Transporter;

    constructor(
        private readonly configService: ConfigService,
    ) {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: this.configService.get<string>('MAIL_USERNAME'),
                pass: this.configService.get<string>('MAIL_PASSWORD'),
            },
        });
    }

    async sendEmail(to: string, subject: string, html: string) {
        await this.transporter.sendMail({
            from: `"${this.configService.get<string>('MAIL_FROM') || 'Support'}" <${this.configService.get<string>('MAIL_USERNAME')}>`,
            to,
            subject,
            html,
        });
    }
}

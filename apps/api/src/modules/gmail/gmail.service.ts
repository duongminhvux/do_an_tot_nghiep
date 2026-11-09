import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class GmailService {
  private readonly transporter: nodemailer.Transporter;
  constructor(private readonly configService: ConfigService) {
    const get=(key:string)=>this.configService.get<string>(key);
    const timeouts={connectionTimeout:2000,greetingTimeout:3000,socketTimeout:5000};
    if(get('MAIL_TRANSPORT')==='smtp'){
      const host=get('SMTP_HOST'),port=Number(get('SMTP_PORT')||'587');
      if(!host||!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid SMTP configuration');
      this.transporter=nodemailer.createTransport({host,port,secure:get('SMTP_SECURE')==='true',...timeouts,
        ...(get('SMTP_USER')?{auth:{user:get('SMTP_USER'),pass:get('SMTP_PASSWORD')}}:{})});
    }else{
      this.transporter=nodemailer.createTransport({service:'gmail',...timeouts,auth:{user:get('MAIL_USERNAME'),pass:get('MAIL_PASSWORD')}});
    }
  }
  async sendEmail(to:string,subject:string,html:string){
    if(this.configService.get<string>('MAIL_SANDBOX_ONLY')==='true'&&!/^[^\s,;<>@]+@[^\s,;<>@]+\.test$/i.test(to))throw new Error('Sandbox recipient rejected');
    await this.transporter.sendMail({from:`"${this.configService.get<string>('MAIL_FROM')||'Support'}" <${this.configService.get<string>('MAIL_USERNAME')}>`,to,subject,html});
  }
}

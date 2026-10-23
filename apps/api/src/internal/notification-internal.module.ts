import { Module, Controller, Post, Body, Headers, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { timingSafeEqual } from 'node:crypto';
import { GmailModule } from '../modules/gmail/gmail.module.js';
import { GmailService } from '../modules/gmail/gmail.service.js';
import { ActivityLogsModule } from '../modules/activity-logs/activity-logs.module.js';
import { ActivityLogsService } from '../modules/activity-logs/activity-logs.service.js';
import type { CreateActivityLogDto } from '../modules/activity-logs/dto/create-activity-log.dto.js';
function verify(token:string) {
  const expected=process.env.INTERNAL_SERVICE_TOKEN||'';
  if(expected.length<24||!token||token.length!==expected.length||
      !timingSafeEqual(Buffer.from(token),Buffer.from(expected))) throw new ForbiddenException();
}
@Controller('_internal/notification')
export class InternalNotificationController {
  constructor(private readonly logs:ActivityLogsService,private readonly mail:GmailService) {}
  @Public()
  @Post('activity')
  async activity(@Headers('x-internal-token') token:string,@Body() body:Record<string,unknown>) {
    verify(token);
    if(!body || typeof body.action!=='string' || typeof body.description!=='string') throw new BadRequestException();
    const result=await this.logs.log(body as unknown as CreateActivityLogDto);
    if(!result) throw new Error('Activity log persistence failed');
    return {ok:true};
  }
  @Public()
  @Post('email')
  async email(@Headers('x-internal-token') token:string,@Body() body:{to:string,subject:string,html:string}) {
    verify(token);
    if(!body || typeof body.to!=='string' || !/^\S+@\S+\.\S+$/.test(body.to) ||
       typeof body.subject!=='string'||body.subject.length>300||
       typeof body.html!=='string'||body.html.length>100_000) throw new BadRequestException();
    await this.mail.sendEmail(body.to,body.subject,body.html);
    return {ok:true};
  }
}
@Module({imports:[GmailModule,ActivityLogsModule],controllers:[InternalNotificationController]})
export class NotificationInternalModule {}

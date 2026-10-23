import { Injectable, Logger, Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** HTTP client for Notification-owned email and activity logs.
 * No service may write notification_db or instantiate its PostgreSQL repository models.
 */
@Injectable()
export class NotificationClient {
  private readonly logger=new Logger(NotificationClient.name);
  constructor(private readonly config:ConfigService) {}
  private async post(route:string,payload:unknown) {
    const token=this.config.get<string>('INTERNAL_SERVICE_TOKEN')||'';
    if(token.length<24) throw new Error('INTERNAL_SERVICE_TOKEN missing');
    const base=this.config.get<string>('NOTIFICATION_INTERNAL_URL')||'http://notification-service:5000';
    const response=await fetch(`${base}/api/_internal/notification/${route}`,{
      method:'POST',headers:{'content-type':'application/json','x-internal-token':token},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(7000) });
    if(!response.ok) throw new Error(`Notification ${route} failed: HTTP ${response.status}`);
  }
  log(payload:Record<string,unknown>){return this.post('activity',payload);}
  sendEmail(to:string,subject:string,html:string){return this.post('email',{to,subject,html});}
  reportError(context:string,error:unknown){this.logger.warn(`${context}: ${String(error)}`);}
}
@Global()
@Module({providers:[NotificationClient],exports:[NotificationClient]})
export class NotificationClientModule {}

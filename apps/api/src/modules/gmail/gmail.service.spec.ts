import {ConfigService} from '@nestjs/config';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {GmailService} from './gmail.service.js';
const mail=vi.hoisted(()=>({sendMail:vi.fn(),createTransport:vi.fn()}));
vi.mock('nodemailer',()=>({createTransport:mail.createTransport}));
describe('GmailService transport isolation',()=>{
 beforeEach(()=>{vi.clearAllMocks();mail.createTransport.mockReturnValue({sendMail:mail.sendMail});mail.sendMail.mockResolvedValue({});vi.stubEnv('MAIL_TRANSPORT','gmail');vi.stubEnv('MAIL_SANDBOX_ONLY','false');});
 afterEach(()=>vi.unstubAllEnvs());
 const make=(values:Record<string,string|undefined>)=>new GmailService(new ConfigService(values));
 it('preserves the Gmail default and configured sender',async()=>{
  const service=make({MAIL_USERNAME:'sender@example.test',MAIL_PASSWORD:'fixture-only'});
  expect(mail.createTransport).toHaveBeenCalledWith(expect.objectContaining({service:'gmail',auth:{user:'sender@example.test',pass:'fixture-only'}}));
  await service.sendEmail('recipient@example.test','Subject','<p>Sandbox</p>');expect(mail.sendMail).toHaveBeenCalledWith(expect.objectContaining({to:'recipient@example.test',subject:'Subject'}));
 });
 it('supports an explicit sandbox SMTP host without Gmail auth',async()=>{
  const service=make({MAIL_TRANSPORT:'smtp',SMTP_HOST:'mailpit',SMTP_PORT:'1025',MAIL_SANDBOX_ONLY:'true'});
  expect(mail.createTransport).toHaveBeenCalledWith({host:'mailpit',port:1025,secure:false,connectionTimeout:2000,greetingTimeout:3000,socketTimeout:5000});
  await service.sendEmail('fixture@example.test','Sandbox','<p>Test</p>');expect(mail.sendMail).toHaveBeenCalledTimes(1);
 });
 it('supports explicitly configured SMTP TLS and credentials',()=>{
  make({MAIL_TRANSPORT:'smtp',SMTP_HOST:'smtp.example.test',SMTP_PORT:'465',SMTP_SECURE:'true',SMTP_USER:'fixture',SMTP_PASSWORD:'fixture-secret'});
  expect(mail.createTransport).toHaveBeenCalledWith(expect.objectContaining({secure:true,auth:{user:'fixture',pass:'fixture-secret'}}));
 });
 it.each([{SMTP_HOST:''},{SMTP_HOST:'mailpit',SMTP_PORT:'0'},{SMTP_HOST:'mailpit',SMTP_PORT:'65536'},{SMTP_HOST:'mailpit',SMTP_PORT:'abc'}])('rejects invalid SMTP settings before sending',values=>{expect(()=>make({MAIL_TRANSPORT:'smtp',...values})).toThrow('Invalid SMTP configuration');expect(mail.sendMail).not.toHaveBeenCalled();});
 it.each(['real@gmail.com','fixture@example.test,real@gmail.com','Name <fixture@example.test>','fixture@example.test\r\nBcc:real@gmail.com'])('blocks non-sandbox or compound recipients',async to=>{await expect(make({MAIL_SANDBOX_ONLY:'true'}).sendEmail(to,'Subject','Body')).rejects.toThrow('Sandbox recipient rejected');expect(mail.sendMail).not.toHaveBeenCalled();});
 it('propagates delivery failure so durable worker can retry',async()=>{mail.sendMail.mockRejectedValue(Error('SMTP unavailable'));await expect(make({}).sendEmail('fixture@example.test','Subject','Body')).rejects.toThrow('SMTP unavailable');});
});

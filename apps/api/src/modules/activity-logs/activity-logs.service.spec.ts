import { describe, expect, it, vi,afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActivityLogsService } from './activity-logs.service.js';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto.js';
import { CreateActivityLogDto } from './dto/create-activity-log.dto.js';
import { LEARNING_ACTIVITY_TYPES } from '../learning-activity/rows/learning-activity.row.js';

const userId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const dictionaries = Object.fromEntries(
  ['vi', 'en'].map((lang) => [
    lang,
    JSON.parse(
      readFileSync(
        new URL(`../../i18n/${lang}/activity-log.json`, import.meta.url),
        'utf8',
      ),
    ),
  ]),
);
const i18n = {
  translate: (key: string, { lang = 'vi', args = {} }: any = {}) => {
    const template = key
      .replace(/^activity-log\./, '')
      .split('.')
      .reduce((node: any, part: string) => node?.[part], dictionaries[lang]);
    return typeof template === 'string'
      ? template.replace(/\{(\w+)\}/g, (_match, name) =>
          String(args[name] ?? ''),
        )
      : key;
  },
};
import {databaseSuite} from '../../../test/native-database.js';
import {randomUUID} from 'node:crypto';
import {sql} from '../../postgres/sql.js';
const suite=databaseSuite('notification');afterEach(()=>vi.unstubAllGlobals());
async function fixture(){
 const service=new ActivityLogsService(suite.db,i18n as never),auditId=randomUUID();await suite.records('identity_profiles').insert({_id:userId,username:'Learner'});
 await suite.records('activitylogs').insert({_id:auditId,userId,action:'AUTH_LOGIN',category:'AUTH',status:'SUCCESS',description:'Legacy login',createdAt:new Date('2026-10-24T01:00:00Z')});
 await suite.records('activitylogs').insert({userId:otherId,userEmail:'learner@example.com',action:'AUTH_LOGIN',category:'AUTH',status:'SUCCESS',description:'Private other user'});
 vi.stubEnv('INTERNAL_SERVICE_TOKEN','native-activity-tests-service-token');
 vi.stubGlobal('fetch',async()=>({ok:true,json:async()=>({data:{items:[],total:0}})}));
 return {service,auditId,query:(extra:any={})=>service.findAll({page:1,limit:100,userId,includeLearning:'true',...extra})};
}
describe('native activity history',()=>{
 it('isolates users when public profiles have no email and rejects a missing profile',async()=>{const f=await fixture();const result=await f.query();expect(result.total).toBe(1);expect(result.items[0]._id).toBe(f.auditId);expect(JSON.stringify(result)).not.toContain('Private other user');await expect(f.query({userId:randomUUID()})).rejects.toThrow();});
 it('paginates and filters translated searches before returning audit rows',async()=>{const f=await fixture();for(let i=0;i<25;i++)await suite.records('activitylogs').insert({userId,action:'AUTH_LOGIN',category:'AUTH',status:'SUCCESS',description:'Login '+i});const first=await f.query({limit:10}),second=await f.query({limit:10,page:2});expect(first.total).toBe(26);expect(new Set([...first.items,...second.items].map(item=>item._id)).size).toBe(20);expect((await f.query({category:'VOCABULARY'})).total).toBe(0);});
 it('keeps stored messages and arguments intact while localizing each read',async()=>{
   const f=await fixture();const stored=await f.service.log({userId,action:'CUSTOM',category:'GENERAL',description:'Original',descriptionKey:'activity-log.messages.PAGE_VIEW',descriptionArgs:{path:'/vocabulary'}} as never);expect(stored?.description).toBe('Original');
   const viLog=await f.service.localizeLog(stored!,'vi'),enLog=await f.service.localizeLog(stored!,'en');expect(viLog.description).not.toBe(enLog.description);expect((await suite.records('activitylogs').one(sql`id=${stored!._id}::uuid`)).description).toBe('Original');
 });
 it('preserves unknown custom messages and supports key-only standard events',async()=>{const f=await fixture();const custom=await f.service.log({userId,action:'CUSTOM',description:'Untranslated custom text'} as never);expect((await f.service.localizeLog(custom!,'en')).description).toBe('Untranslated custom text');const standard=await f.service.log({userId,action:'PAGE_VIEW',metadata:{path:'/home'}} as never);expect(standard?.descriptionKey).toBe('activity-log.messages.PAGE_VIEW_WITH_TITLE');});
 it('returns translated filter labels and enforces scoped learning history queries',async()=>{const f=await fixture();expect(await f.service.getFilterOptions('en')).toBeTruthy();await expect(f.service.findAll({includeLearning:'true'} as never)).rejects.toThrow();});
 it('rejects missing fallback/message keys at the DTO boundary',async()=>{const invalid=plainToInstance(CreateActivityLogDto,{action:'CUSTOM'});expect((await validate(invalid)).length).toBeGreaterThan(0);});
});
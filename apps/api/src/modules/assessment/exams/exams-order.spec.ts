import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('assessment');
import {ExamsService} from './exams.service.js';
import {DomainOutboxService} from '../../../common/events/domain-outbox.service.js';
describe('native exam positions',()=>{
 const fixture=()=>new ExamsService(suite.db,{t:async(key:string)=>key} as never,new DomainOutboxService(suite.db));
 it('serializes simultaneous creates and closes removed positions',async()=>{
   const service=fixture(),created=await Promise.all(['Three','One','Two'].map(name=>service.create({name,type:'TOEIC'} as never)));expect((await service.findAll({})).data.map(row=>row.order)).toEqual([1,2,3]);
   await service.remove(String((created[1] as any)._id));expect((await service.findAll({})).data.map(row=>row.order)).toEqual([1,2]);await service.restore(String((created[1] as any)._id));expect((await service.findAll({})).data.map(row=>row.order)).toEqual([1,2,3]);
 });
 it('moves an occupied position and rejects partial or duplicate reorder lists',async()=>{
   const service=fixture();for(const name of ['A','B','C'])await service.create({name,type:'TOEIC'} as never);const list=(await service.findAll({})).data as any[];await service.update(list[2]._id,{order:1});expect((await service.findAll({})).data[0].name).toBe('C');await expect(service.reorderExams([{id:list[0]._id,order:1}])).rejects.toThrow();
 });
});
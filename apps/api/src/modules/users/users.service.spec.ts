import {describe,it,expect,vi} from 'vitest';
import {databaseSuite} from '../../../test/native-database.js';
import {UsersService} from './users.service.js';
import {DomainOutboxService} from '../../common/events/domain-outbox.service.js';
const suite=databaseSuite('identity');
describe('native user writes',()=>{
  it('persists profile updates with durable identity events',async()=>{
    const outbox=new DomainOutboxService(suite.db),service=new UsersService(suite.db,{t:async(key:string)=>key} as never,outbox);
    const user=await service.create({email:'native@example.test',username:'Original'});
    await service.update(user._id,{username:'Updated'});expect((await service.findByEmail(user.email))?.username).toBe('Updated');expect(await suite.records('outbox_events').count()).toBe(2);
  });
  it('rolls back the user when the identity event cannot be saved',async()=>{
    const outbox=new DomainOutboxService(suite.db),service=new UsersService(suite.db,{t:async(key:string)=>key} as never,outbox);vi.spyOn(outbox,'enqueue').mockRejectedValueOnce(new Error('outbox failed'));
    await expect(service.create({email:'rollback@example.test'})).rejects.toThrow('outbox failed');expect(await service.findByEmail('rollback@example.test')).toBeNull();
  });
});

import {describe,it,expect} from 'vitest';
import {databaseSuite} from '../../../test/native-database.js';
import {UsersService} from './users.service.js';
import {AuthService} from '../auth/auth.service.js';
import {DomainOutboxService} from '../../common/events/domain-outbox.service.js';
import {plainToInstance} from 'class-transformer';
import {validateSync} from 'class-validator';
import {CreateAdminUserDto} from './dto/create-admin-user.dto.js';
import {sql} from '../../postgres/sql.js';
const suite=databaseSuite('identity');
const i18n={t:async(key:string)=>key};
const service=()=>new UsersService(suite.db,i18n as never,new DomainOutboxService(suite.db));
describe('Admin-created local user credentials (isolated PostgreSQL memory)',()=>{
  it('hashes the exact initial password, supports real login and never exposes it in response/events',async()=>{
    const users=service(),password='  Valid initial password!  ';
    const result=await users.createAdmin({email:' NEW@example.test ',name:'New User',password});
    expect(result).not.toHaveProperty('password');
    const stored=await users.findByEmail('new@example.test');
    expect(stored?.password).toMatch(/^\$2[aby]\$/);expect(stored?.password).not.toBe(password);
    const auth=new AuthService(users,{} as never,{} as never,{} as never,i18n as never);
    expect(await auth.validateUser('new@example.test',password)).toMatchObject({username:'New User',isVerified:true});
    await expect(auth.validateUser('new@example.test','incorrect')).rejects.toMatchObject({status:401});
    const events=await suite.records('outbox_events').select(sql`TRUE`);
    expect(events).toHaveLength(1);expect(JSON.stringify(events)).not.toContain(password);expect(JSON.stringify(events)).not.toContain(stored?.password);
  });
  it('rejects absent/short passwords before creating a user and normalizes duplicate email checks',async()=>{
    const users=service();
    for(const password of [undefined,'','12345'])await expect(users.createAdmin({email:'empty@example.test',name:'Empty',password} as CreateAdminUserDto)).rejects.toMatchObject({status:400});
    expect(await suite.records('users').count()).toBe(0);
    await users.createAdmin({email:'one@example.test',name:'One',password:'Test password!'});
    await expect(users.createAdmin({email:' ONE@EXAMPLE.TEST ',name:'Duplicate',password:'Test password!'})).rejects.toMatchObject({status:400});
    expect(await suite.records('users').count()).toBe(1);
    expect(validateSync(plainToInstance(CreateAdminUserDto,{email:'valid@example.test',name:'User'})).some(error=>error.property==='password')).toBe(true);
  });
});

import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('learning');
import {MiniGameResultService} from './minigame-result.service.js';
describe('native minigame results',()=>{
 it('stores every play and credits its actual persisted result ID',async()=>{const record=vi.fn(async()=>true),service=new MiniGameResultService(suite.db,{record} as never),user=randomUUID();const saved=await service.save(user,{gameType:'WORD_SHOOTER',score:420} as never);expect(record).toHaveBeenCalledWith(expect.objectContaining({userId:user,sourceKey:'minigame:'+saved.id,xp:5,score:420}));expect((await service.stats(user,'WORD_SHOOTER')).totalPlays).toBe(1);expect((await service.stats(randomUUID(),'WORD_SHOOTER')).totalPlays).toBe(0);});
});
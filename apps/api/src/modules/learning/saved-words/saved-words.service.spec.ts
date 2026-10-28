import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('learning');
import {SavedWordsService} from './saved-words.service.js';
afterEach(()=>vi.unstubAllGlobals());
describe('native vocabulary folders',()=>{
 it('checks ownership, preserves notes on upsert and detaches words when deleting folders',async()=>{
   const service=new SavedWordsService(suite.db),user=randomUUID(),word=randomUUID(),other=randomUUID();vi.stubEnv('INTERNAL_SERVICE_TOKEN','native-folder-service-token');vi.stubGlobal('fetch',async()=>({ok:true,json:async()=>({data:[{_id:word,word:'a+b'}]})}));
   const folder=await service.createFolder(user,{name:'Literal'});await expect(service.searchWords(other,folder._id,'a+b')).rejects.toThrow();const saved=await service.saveWord(user,{wordId:word,note:'Remember',folderId:folder._id});await service.saveWord(user,{wordId:word});expect((await suite.records('usersavedwords').one(sql`id=${saved._id}::uuid`)).note).toBe('Remember');
   expect((await service.searchWords(user,folder._id,'a+b'))[0].inFolder).toBe(true);await service.deleteFolder(user,folder._id);expect((await suite.records('usersavedwords').one(sql`id=${saved._id}::uuid`)).folderId).toBeNull();await expect(service.createFolder(user,{name:'  '})).rejects.toThrow();
 });
});
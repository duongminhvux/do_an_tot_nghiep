import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('learning');
import {SavedWordsService} from './saved-words.service.js';
afterEach(()=>vi.unstubAllGlobals());
describe('native vocabulary folders',()=>{
 it('keeps personal dictation words private, deduplicated and searchable in saved words',async()=>{
   const service=new SavedWordsService(suite.db),user=randomUUID(),other=randomUUID();
   vi.stubEnv('INTERNAL_SERVICE_TOKEN','native-folder-service-token');
   vi.stubGlobal('fetch',async()=>({ok:true,json:async()=>({data:[]})}));
   const word=await service.savePersonalWord(user,'Subscribers','From listening');
   expect((await service.savePersonalWord(user,'SUBSCRIBERS'))._id).toBe(word._id);
   expect((await service.lookupWord(user,'subscribers')).saved).toBe(true);
   expect(await service.lookupWord(other,'subscribers')).toBeNull();
   const found=await service.findAll(user,{search:'subscr'});
   expect(found.pagination.total).toBe(1);
   expect(found.data[0].word.word).toBe('subscribers');
   expect(found.data[0].note).toBe('From listening');
   expect((await service.findAll(other,{})).data).toEqual([]);
   const phrase=await service.savePersonalWord(user,'Good morning','Greeting',{ipa:'/ɡʊd ˈmɔːnɪŋ/',translation:'Chào buổi sáng'});
   expect((await service.lookupWord(user,'good morning')).ipa.us).toBe('/ɡʊd ˈmɔːnɪŋ/');
   await service.savePersonalWord(user,'good morning',undefined,{ipa:'/new/',translation:'Lời chào'});
   expect((await service.lookupWord(user,'good morning'))._id).toBe(phrase._id);
   expect((await service.findAll(user,{search:'good'})).data[0].word.parts[0].meanings[0].translation).toEqual(['Lời chào']);
   await expect(service.savePersonalWord(user,'<script>')).rejects.toThrow();
 });
 it('checks ownership, preserves notes on upsert and detaches words when deleting folders',async()=>{
   const service=new SavedWordsService(suite.db),user=randomUUID(),word=randomUUID(),other=randomUUID();vi.stubEnv('INTERNAL_SERVICE_TOKEN','native-folder-service-token');vi.stubGlobal('fetch',async()=>({ok:true,json:async()=>({data:[{_id:word,word:'a+b'}]})}));
   const folder=await service.createFolder(user,{name:'Literal'});await expect(service.searchWords(other,folder._id,'a+b')).rejects.toThrow();const saved=await service.saveWord(user,{wordId:word,note:'Remember',folderId:folder._id});await service.saveWord(user,{wordId:word});expect((await suite.records('usersavedwords').one(sql`id=${saved._id}::uuid`)).note).toBe('Remember');
   expect((await service.lookupWord(user,'A+B')).saved).toBe(true);
   expect((await service.lookupWord(other,'a+b')).saved).toBe(false);
   expect(await service.lookupWord(user,'missing')).toBeNull();
   expect((await service.searchWords(user,folder._id,'a+b'))[0].inFolder).toBe(true);await service.deleteFolder(user,folder._id);expect((await suite.records('usersavedwords').one(sql`id=${saved._id}::uuid`)).folderId).toBeNull();await expect(service.createFolder(user,{name:'  '})).rejects.toThrow();
 });
});

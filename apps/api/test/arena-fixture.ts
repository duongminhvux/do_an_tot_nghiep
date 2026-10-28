import {randomUUID} from 'node:crypto';
import {vi} from 'vitest';
import {databaseSuite} from './native-database.js';
import {DomainOutboxService} from '../src/common/events/domain-outbox.service.js';
import {sql} from '../src/postgres/sql.js';
import {ArenaReadService} from '../src/modules/arena/arena-read.service.js';
import {ArenaService} from '../src/modules/arena/arena.service.js';
import {ArenaQuestionService} from '../src/modules/arena/question/arena-question.service.js';
import {ArenaRoundService} from '../src/modules/arena/question/arena-round.service.js';
import {ArenaScoringService} from '../src/modules/arena/scoring/arena-scoring.service.js';
import {ArenaRatingService} from '../src/modules/arena/rating/arena-rating.service.js';
import {ArenaMatchService} from '../src/modules/arena/matches/arena-match.service.js';
import {ArenaMatchTransactions} from '../src/modules/arena/matches/arena-match-transactions.js';
import {ArenaFriendRoomService} from '../src/modules/arena/friendly/arena-friend-room.service.js';
import {ArenaFriendlyService} from '../src/modules/arena/friendly/arena-friendly.service.js';
import {ArenaSettingsService} from '../src/modules/arena/admin/arena-settings.service.js';

export async function arenaFixture(suite:ReturnType<typeof databaseSuite>){
  const users=[randomUUID(),randomUUID(),randomUUID()],locks=new Map<string,string>();
  for(const [index,id]of users.entries())await suite.records('identity_profiles').insert({_id:id,username:'Player '+index});
  const redis={getClient:()=>({set:vi.fn(async(key:string,value:string)=>{if(locks.has(key))return null;locks.set(key,value);return 'OK';}),eval:vi.fn(async(_script:string,args:{keys:string[]})=>{for(const key of args.keys)locks.delete(key);return 1;})})};
  const presence={isOnline:vi.fn(async()=>true),isInMatch:vi.fn(async()=>true)};
  vi.stubEnv('INTERNAL_SERVICE_TOKEN','native-arena-test-service-token');
  const dictionary=new Set(['apple','elephant','environment','tiger','river','chair','thumb']);
  const lookup=vi.fn(async(word:string)=>dictionary.has(word)?[{_id:randomUUID(),word}]:[]);
  vi.stubGlobal('fetch',vi.fn(async(url:string,options:{body:string})=>{
    const input=JSON.parse(options.body);let data;
    if(url.endsWith('sample-words'))data=Array.from({length:input.count},(_,index)=>({_id:randomUUID(),word:index===0?'apple':'word'+String.fromCharCode(97+index),meaning:'meaning '+index,definition:'Definition',example:{en:'Example',vi:'Translation'},partOfSpeech:'noun'}));
    else data=await lookup(input.word);
    return {ok:true,json:async()=>({data})};
  }));
  const settings=new ArenaSettingsService(suite.db);await settings.onModuleInit();
  const read=new ArenaReadService(suite.db),arena=new ArenaService(read,suite.db,settings),questions=new ArenaQuestionService(suite.db),outbox=new DomainOutboxService(suite.db),transactions=new ArenaMatchTransactions(suite.db);
  const matches=new ArenaMatchService(suite.db,redis as never,questions,new ArenaRatingService(),settings,undefined,outbox,transactions);
  const rounds=new ArenaRoundService(suite.db,new ArenaScoringService(),matches,transactions);
  const rooms=new ArenaFriendRoomService(suite.db,matches,presence as never,questions,arena,redis as never,settings);
  const friendly=new ArenaFriendlyService(suite.db,matches,rounds,questions,presence as never,arena,rooms,settings);
  const match=async(options:Record<string,any>={})=>{
    const row=await suite.records('arenamatches').insert({type:'RANK',status:'PLAYING',questionMode:'MEANING_TO_WORD',questionCount:2,currentQuestionIndex:1,secondsPerQuestion:30,startedAt:new Date(),...options});
    for(const id of users.slice(0,2)){await arena.getOrCreateProfile(id);await suite.records('arenamatchplayers').insert({matchId:row._id,userId:id,status:'PLAYING',ratingBefore:1000});}
    return row;
  };
  const question=(matchId:string,order=1,patch:Record<string,any>={})=>suite.records('arenamatchquestions').insert({matchId,vocabularyId:randomUUID(),order,type:'MEANING',question:'A digit',correctAnswer:'thumb',startedAt:new Date(),...patch});
  const savedMatch=(id:string)=>suite.records('arenamatches').one(sql`id=${id}::uuid`);
  return {users,redis,presence,settings,read,arena,questions,outbox,transactions,matches,rounds,rooms,friendly,match,question,savedMatch,lookup,dictionary};
}

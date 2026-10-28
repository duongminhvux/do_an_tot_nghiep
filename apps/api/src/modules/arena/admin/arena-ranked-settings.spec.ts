import {describe,it,expect,vi,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {databaseSuite} from '../../../../test/native-database.js';
import {sql,rows} from '../../../postgres/sql.js';
const suite=databaseSuite('arena');
import 'reflect-metadata';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {ArenaSettingsService} from './arena-settings.service.js';
import {UpdateArenaSettingsDto} from './arena-admin.dto.js';
import {ARENA_DEFAULTS} from './arena-settings.defaults.js';
describe('Native settings arena-ranked-settings.spec.ts',()=>{
 it('fills omitted nested sections and preserves saved audio/hint policy',async()=>{
   const service=new ArenaSettingsService(suite.db);await service.onModuleInit();const original=await service.read();const config={...original.config};delete config.audio;delete config.hints;delete config.rankedConnection;
   const saved=await service.update({revision:0,config,reason:'Older client'});expect(saved.config.audio).toEqual(ARENA_DEFAULTS.audio);expect(saved.config.hints).toEqual(ARENA_DEFAULTS.hints);expect(saved.config.rankedConnection).toEqual(ARENA_DEFAULTS.rankedConnection);
   await expect(service.update({revision:0,config,reason:'Stale client'})).rejects.toThrow('ARENA_SETTINGS_CHANGED');
 });
 it('rejects unsafe audio URLs, timing, percentages and reconnect budgets',async()=>{
   for(const patch of [{audio:{...ARENA_DEFAULTS.audio,loseSoundUrl:'javascript:alert(1)'}},{hints:{...ARENA_DEFAULTS.hints,maxPercent:101}},{rankedConnection:{...ARENA_DEFAULTS.rankedConnection,resumeCountdownSeconds:11}}]){
     const dto=plainToInstance(UpdateArenaSettingsDto,{revision:0,reason:'Invalid',config:{...structuredClone(ARENA_DEFAULTS),...patch}});expect((await validate(dto)).length).toBeGreaterThan(0);
   }
   const service=new ArenaSettingsService(suite.db);await service.onModuleInit();const config=structuredClone(ARENA_DEFAULTS);config.rankedConnection.maxTotalPauseSeconds=1;await expect(service.update({revision:0,config,reason:'Invalid budget'})).rejects.toThrow('Pause budget');
 });
});
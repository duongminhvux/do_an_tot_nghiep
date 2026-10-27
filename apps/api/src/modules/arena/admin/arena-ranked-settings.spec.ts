import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { ARENA_DEFAULTS } from './arena-settings.defaults.js';
import { UpdateArenaSettingsDto } from './arena-admin.dto.js';
import { ArenaSettingsService } from './arena-settings.service.js';

describe('Ranked reconnect admin configuration', () => {
  it('validates hint timing and percentage and preserves defaults for older admin clients', async () => {
    const config=structuredClone(ARENA_DEFAULTS);
    for(const patch of [{startAfterSeconds:-1},{intervalSeconds:0},{maxPercent:101}]){
      const input=plainToInstance(UpdateArenaSettingsDto,{revision:0,reason:'Hints',config:{...config,hints:{...config.hints,...patch}}});
      expect((await validate(input)).length).toBeGreaterThan(0);
    }
    const {hints:_,...oldConfig}=config;
    const model={findOne:()=>({lean:async()=>({revision:0,config:oldConfig})}),findOneAndUpdate:vi.fn((_filter,update)=>({lean:async()=>({revision:1,config:update.$set.config})}))};
    const service=new ArenaSettingsService(model as any);
    expect((await service.read()).config.hints).toEqual(ARENA_DEFAULTS.hints);
    expect((await service.update({revision:0,reason:'Legacy client',config:oldConfig})).config.hints).toEqual(ARENA_DEFAULTS.hints);
    await expect(service.update({revision:1,reason:'Too late',config:{...config,hints:{...config.hints,startAfterSeconds:30}}})).rejects.toThrow('Hints must start');
  });
  const dto = () => plainToInstance(UpdateArenaSettingsDto,{revision:0,reason:'Configure reconnect',config:structuredClone(ARENA_DEFAULTS)});
  it('accepts explicit defaults and rejects unsafe ranges or enabling deferred online AFK', async () => {
    expect(await validate(dto())).toEqual([]);
    for(const patch of [{reloadGraceSeconds:-1},{disconnectTimeoutSeconds:0},{resumeCountdownSeconds:11},{maxPauseCount:0},{idleDetectionEnabled:true},{bothDisconnectedPolicy:'BOTH_LOSE'}]) {
      const invalid = dto(); Object.assign(invalid.config.rankedConnection!,patch);
      expect((await validate(invalid)).length).toBeGreaterThan(0);
    }
  });
  it('merges defaults for older stored configurations and rejects a budget shorter than one timeout', async () => {
    const {rankedConnection:_,...oldConfig}=structuredClone(ARENA_DEFAULTS);
    const model = {findOne:()=>({lean:async()=>({revision:0,config:oldConfig})}),findOneAndUpdate:vi.fn()};
    const service=new ArenaSettingsService(model as any);
    expect((await service.read()).config.rankedConnection).toEqual(ARENA_DEFAULTS.rankedConnection);
    const invalid=dto(); invalid.config.rankedConnection!.maxTotalPauseSeconds=10;
    await expect(service.update(invalid)).rejects.toThrow('Pause budget');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

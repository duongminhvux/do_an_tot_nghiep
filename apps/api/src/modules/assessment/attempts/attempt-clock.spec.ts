import {describe,expect,it} from 'vitest';
import {activeSeconds,HEARTBEAT_GRACE_SECONDS,isPaused,isStale,pausedClock,remainingSeconds,runningClock} from './attempt-clock.js';

const at=(seconds:number)=>new Date(Date.UTC(2026,10,2,8,0,seconds));
const startedAt=at(0);

describe('Attempt active-time clock',()=>{
  it('counts only time between resume and pause',()=>{
    let clock:any={startedAt,...runningClock({startedAt,activeSeconds:0},at(0))};
    clock={...clock,lastSeenAt:at(30)};
    clock={...clock,...pausedClock(clock,at(40))};
    expect(activeSeconds(clock,at(40))).toBe(40);
    expect(isPaused(clock)).toBe(true);
    // An hour away from the page adds nothing.
    expect(activeSeconds(clock,at(3640))).toBe(40);
    clock={...clock,...runningClock(clock,at(3640))};
    expect(activeSeconds(clock,at(3650))).toBe(50);
  });

  it('stops counting after the last heartbeat when the page vanishes',()=>{
    const clock={startedAt,activeSeconds:0,activeSince:at(0),lastSeenAt:at(60)};
    expect(activeSeconds(clock,at(10_000))).toBe(60+HEARTBEAT_GRACE_SECONDS);
    expect(isStale(clock,at(10_000))).toBe(true);
    expect(isStale(clock,at(70))).toBe(false);
  });

  it('derives remaining time from active time, not the wall clock',()=>{
    const clock={startedAt,timeLimitSeconds:600,activeSeconds:100,activeSince:null,lastSeenAt:at(100)};
    expect(remainingSeconds(clock,at(5000))).toBe(500);
    expect(remainingSeconds({...clock,timeLimitSeconds:undefined},at(5000))).toBeUndefined();
  });

  it('keeps wall-clock time for attempts created before the clock existed',()=>{
    const legacy={startedAt};
    expect(isPaused(legacy)).toBe(false);
    expect(activeSeconds(legacy,at(90))).toBe(90);
  });

  it('reads ISO strings stored in the attempt payload',()=>{
    const clock={startedAt:startedAt.toISOString(),activeSeconds:5,activeSince:at(10).toISOString(),lastSeenAt:at(20).toISOString()};
    expect(activeSeconds(clock,at(25))).toBe(20);
  });
});

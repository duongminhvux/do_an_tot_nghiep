const DAY_MS=86400000, VIETNAM_OFFSET_MS=7*3600000;
export function dashboardPeriod(inputDays:number,now=new Date()){
  const days=Number.isFinite(inputDays)?Math.max(7,Math.min(90,Math.floor(inputDays))):7;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const start=new Date(new Date(`${today}T00:00:00+07:00`).getTime()-(days-1)*DAY_MS);
  return {days,start:start.toISOString(),end:new Date(now.getTime()+1).toISOString(),previousStart:new Date(start.getTime()-days*DAY_MS).toISOString(),
    labels:Array.from({length:days},(_,index)=>new Date(start.getTime()+index*DAY_MS+VIETNAM_OFFSET_MS).toISOString().slice(0,10))};
}

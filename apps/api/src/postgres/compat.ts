/**
 * PostgreSQL document repository used to preserve existing REST contracts while
 * the application moves to service-owned SQL schemas. No legacy document database driver is used.
 * All durable state is stored in PostgreSQL; explicit SQL columns are generated
 * from database/postgres/01-init.sql, optional nested data lives in JSONB.
 *
 * Deliberate restrictions: no cross-database implicit joins, no auto DDL,
 * no silent fallback to an absent SQL table, and no unsupported aggregation.
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { Injectable, Inject, Module, Global, type DynamicModule } from '@nestjs/common';
import { serviceRole, serviceUrl, tableOwner } from './ownership.js';

export class PgId extends String {
  constructor(value?: any) {
    const id = value == null ? randomUUID() : String(value);
    super(id);
  }
  static isValid(value: unknown): boolean {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
      || value instanceof PgId && PgId.isValid(String(value));
  }
  equals(value: unknown) { return String(this) === String(value); }
  toJSON() { return String(this); }
}
export const isValidPgId = PgId.isValid;
export type ClientSession = { client?: pg.PoolClient };
export type FilterQuery<T = any> = Record<string, any>;
export type UpdateQuery<T = any> = Record<string, any>;
export type PipelineStage = Record<string, any>;
export type PgDocument<T = any> = T & { _id: PgId; id: string; createdAt: Date; updatedAt: Date;
  toObject: (options?: any) => any; save: () => Promise<any>;
  validate: () => Promise<void>; populate: (path: any) => Promise<any> };
export type HydratedDocument<T = any> = PgDocument<T>;

const modelMetadata = new Map<string, {collection?: string, fields: Record<string,any>, hooks: Record<string,Function[]>}>();
const registeredTypes = new Map<string, Function>();
function metadata(name: string) {
  if (!modelMetadata.has(name)) modelMetadata.set(name, {fields:{},hooks:{}});
  return modelMetadata.get(name)!;
}
export function PgEntity(options: any = {}) {
  return (target: Function) => { metadata(target.name).collection = options.collection; registeredTypes.set(target.name,target); };
}
export function PgField(options: any = {}) {
  return (target: any, property: string | symbol) => {
    const name = target.constructor.name; metadata(name).fields[String(property)] = options;
  };
}
export class PgSchemaDefinition {
  static Types = { Mixed: Object, Uuid: PgId };
  constructor(public readonly className = '') { }
  index(_fields: any, _options?: any): this { return this; } // indexes are defined by SQL bootstrap
  pre(name: string, fn: Function): this { (metadata(this.className).hooks[name] ??= []).push(fn); return this; }
  clone(): PgSchemaDefinition { return new PgSchemaDefinition(this.className); }
  virtual(_field: string) { return {get(_fn:Function){},set(_fn:Function){}}; }
  path(_path: string) { return { validate(_validator:any) {} }; }
}
export const PgSchemaFactory = { createForClass(ctor: Function) {
  registeredTypes.set(ctor.name,ctor); return new PgSchemaDefinition(ctor.name);
}};

// JSONB round trips turn Date values into strings. Restore schema-declared
// dates (including nested room members) before services use Date methods.
function restoreDocumentDates(value: Record<string, any>, fields: Record<string, any>): Record<string, any> {
  const result = { ...value };
  for (const [field, options] of Object.entries(fields)) {
    const current = result[field];
    if (options?.type === Date && current != null && !(current instanceof Date)) {
      const date = new Date(current);
      if (Number.isFinite(date.getTime())) result[field] = date;
    } else if (Array.isArray(options?.type) && options.type[0] instanceof PgSchemaDefinition && Array.isArray(current)) {
      const nested = metadata(options.type[0].className).fields;
      result[field] = current.map((item) => item && typeof item === 'object' ? restoreDocumentDates(item, nested) : item);
    }
  }
  for (const field of ['createdAt', 'updatedAt']) {
    if (result[field] != null && !(result[field] instanceof Date)) {
      const date = new Date(result[field]);
      if (Number.isFinite(date.getTime())) result[field] = date;
    }
  }
  return result;
}

const MODEL_TABLE_OVERRIDES: Record<string,string> = {
  LearningActivity:'learning_activities', SavedWord:'usersavedwords',
  GeneratedAudio:'media_assets', GameDefinition:'gamedefinitions', AudioJob:'audio_jobs', AsrJob:'asr_jobs', SystemSetting:'system_settings',
  PdfAiCorrectionEvent:'pdf_ai_correction_events',
};
export function sqlTable(name: string): string {
  const base=name.toLowerCase();
  const candidates=[MODEL_TABLE_OVERRIDES[name],base,base+'s',base+'es',base.endsWith('y')?base.slice(0,-1)+'ies':null];
  const table=candidates.find(x=>x && SQL_TABLES.has(x))??MODEL_TABLE_OVERRIDES[name]??`${base}s`;
  if (!/^[a-z_][a-z_0-9]*$/.test(table)) throw new Error('Invalid PostgreSQL table name');
  return table;
}
const SQL_TABLES = new Set(["activitylogs", "admins", "arenainvitations", "arenamatches", "arenamatchplayers", "arenamatchquestions", "arenaplayeranswers", "arenaprofiles", "arenaratinghistories", "arenarooms", "arenasettings", "asr_jobs", "attemptanswers", "attempts", "audio_jobs", "collections", "dictationlessons", "dictationprogresses", "dictationsections", "dictationsegments", "dictationtopics", "examgroups", "exams", "friendrooms", "gamedefinitions", "learning_activities", "learningsessions", "learningsessionwords", "lessons", "lessonwords", "media_assets", "minigameresults", "notifications", "passagegroups", "passages", "pdf_ai_correction_events", "questions", "sections", "system_settings", "userdailyactivities", "userlessonprogresses", "userlessonwords", "users", "usersavedwords", "userwordreviews", "vocabularyfolders", "vocabularygroups", "words", "youtubelessons"]);
const PG_POOL = Symbol('PG_POOL');
const PG_UPDATE = Symbol('PG_UPDATE');
const REMOVE_VALUE = Symbol('REMOVE_VALUE');
let defaultPool: pg.Pool | null = null;
export type PgConnection = { pool: pg.Pool; query: (sql:string, params?:any[])=>Promise<pg.QueryResult> };
export function createConnection(pool: pg.Pool): PgConnection {return {pool,query:(sql,params)=>pool.query(sql,params)}};
const safeName = (name: string) => {if (!/^[a-z_][a-z_0-9]*$/.test(name)) throw new Error('Unsafe SQL identifier: '+name);return `"${name}"`;};
const snake = (s:string) => s.replace(/([a-z\d])([A-Z])/g,'$1_$2').toLowerCase();
const camel = (s:string) => s.replace(/_([a-z])/g,(_,x)=>x.toUpperCase());
const normalize = (v:any):any => v instanceof PgId?String(v):v instanceof Date?v.toISOString(): v instanceof RegExp?v.source: Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,val])=>[k,normalize(val)])):v;
const plain = (v:any):any => v instanceof PgId?String(v): v instanceof Date?v.toISOString():Array.isArray(v)?v.map(plain):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['toObject','save','validate','populate'].includes(k)).map(([k,val])=>[k,plain(val)])):v;
function getValue(doc:any, key:string):any {
  if (key==='id') return doc._id || doc.id;
  return key.split('.').reduce((v,k)=>Array.isArray(v)&&!/^\d+$/.test(k)?v.map(item=>item?.[k]):v?.[k],doc);
}
// Inclusive projection with Mongoose-style dotted paths ("parts.meanings.definition"), applied through arrays.
type ProjectionTree = { [key:string]: true|ProjectionTree };
function projectionTree(paths:string[]):ProjectionTree {
  const tree:ProjectionTree={};
  for(const path of paths){
    let node=tree;const segs=path.split('.');
    segs.forEach((seg,i)=>{
      if(node[seg]===true)return;
      if(i===segs.length-1){node[seg]=true;return;}
      node=(node[seg]??={}) as ProjectionTree;
    });
  }
  return tree;
}
function project(value:any, tree:true|ProjectionTree):any {
  if(tree===true||value==null||typeof value!=='object'||value instanceof Date||value instanceof PgId)return value;
  if(Array.isArray(value))return value.map(item=>project(item,tree));
  return Object.fromEntries(Object.entries(tree).filter(([key])=>value[key]!==undefined).map(([key,sub])=>[key,project(value[key],sub)]));
}
function eq(a:any,b:any):boolean {
  if (a===undefined||b===undefined) return a===b;
  if (a instanceof Date||b instanceof Date) return new Date(a).getTime()===new Date(b).getTime();
  if (typeof a==='object' && a!==null && typeof b==='object' && b!==null) return JSON.stringify(normalize(a))===JSON.stringify(normalize(b));
  return String(a)===String(b);
}
function cmp(a:any,b:any):number {
  if (a instanceof Date||b instanceof Date) return +new Date(a)-+new Date(b);
  if (typeof a==='number'&&typeof b==='number') return a-b;
  return String(a??'').localeCompare(String(b??''));
}
export function matches(doc:any, filter:any, variables:Record<string,any>={}):boolean {
  if (!filter || !Object.keys(filter).length) return true;
  return Object.entries(filter).every(([key,expect])=>{
    if (key==='$or') return (expect as any[]).some(x=>matches(doc,x,variables));
    if (key==='$and') return (expect as any[]).every(x=>matches(doc,x,variables));
    if (key==='$nor') return !(expect as any[]).some(x=>matches(doc,x,variables));
    if (key==='$expr') return Boolean(evaluate(expect,doc,variables));
    const value = getValue(doc,key);
    if(expect instanceof RegExp) return expect.test(String(value??''));
    if(expect && typeof expect==='object' && !Array.isArray(expect) && !(expect instanceof Date) && !(expect instanceof PgId)) {
      const e=expect as Record<string,any>, keys=Object.keys(e);
      if(keys.some(k=>k.startsWith('$'))) return keys.every(op=>{
        const v=e[op];
        switch(op){
          case '$eq':return eq(value,v);
          case '$ne':return !eq(value,v);
          case '$in':return (v as any[]).some(x=>Array.isArray(value)?value.some(y=>eq(x,y)):eq(value,x));
          case '$nin':return !(v as any[]).some(x=>eq(value,x));
          case '$gt':return value!=null&&cmp(value,v)>0;
          case '$gte':return value!=null&&cmp(value,v)>=0;
          case '$lt':return value!=null&&cmp(value,v)<0;
          case '$lte':return value!=null&&cmp(value,v)<=0;
          case '$exists':return v ? value!==undefined : value===undefined;
          case '$type':return v==='number'?typeof value==='number':v==='string'?typeof value==='string':v==='date'?value instanceof Date:v==='array'?Array.isArray(value):v==='object'?value!==null&&typeof value==='object':false;
          case '$regex':return new RegExp(v,e.$options??'').test(String(value??''));
          case '$options':return true;
          case '$size':return Array.isArray(value)&&value.length===v;
          case '$elemMatch':return Array.isArray(value)&&value.some(x=>matches(x,v));
          case '$all':return Array.isArray(value)&&(v as any[]).every(x=>value.some(y=>eq(x,y)));
          case '$not':return !matches({v:value},{v});
          default:throw new Error(`Unsupported SQL repository filter operator ${op}`);
        }
      });
    }
    return Array.isArray(value) ? value.some(x=>eq(x,expect)) : eq(value,expect);
  });
}
function evaluate(v:any,doc:any,variables:Record<string,any>={}):any {
  if(typeof v==='string' && v.startsWith('$$')) return getValue(variables,v.slice(2));
  if(typeof v==='string' && v.startsWith('$')) return getValue(doc,v.slice(1));
  if(v===null||typeof v!=='object') return v;
  if(v instanceof Date||v instanceof PgId)return v;
  const ev=(value:any)=>evaluate(value,doc,variables);
  if(Array.isArray(v))return v.map(ev);
  const keys=Object.keys(v);
  if(keys.length===1 && keys[0].startsWith('$')) {
    const k=keys[0], a=(v as any)[k];
    switch(k){
      case '$literal':return a;
      case '$eq':return eq(ev(a[0]),ev(a[1]));
      case '$ne':return !eq(ev(a[0]),ev(a[1]));
      case '$gte':return cmp(ev(a[0]),ev(a[1]))>=0;
      case '$lte':return cmp(ev(a[0]),ev(a[1]))<=0;
      case '$gt':return cmp(ev(a[0]),ev(a[1]))>0;
      case '$lt':return cmp(ev(a[0]),ev(a[1]))<0;
      case '$in':return (ev(a[1])||[]).some((x:any)=>eq(x,ev(a[0])));
      case '$ifNull':return ev(a[0])??ev(a[1]);
      case '$add':return a.reduce((s:any,x:any)=>s+Number(ev(x)||0),0);
      case '$subtract':{
        const number=(value:any)=>value instanceof Date?value.getTime():typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)?new Date(value).getTime():Number(value||0);
        return number(ev(a[0]))-number(ev(a[1]));
      }
      case '$divide':return Number(ev(a[0]))/Number(ev(a[1]));
      case '$multiply':return a.reduce((n:number,x:any)=>n*Number(ev(x)),1);
      case '$mergeObjects':return Object.assign({},...a.map(ev).filter((value:any)=>value!=null));
      case '$sum':{const values=ev(a);return (Array.isArray(values)?values:[values]).reduce((sum:number,value:any)=>sum+(typeof value==='number'?value:0),0);}
      case '$max':return Math.max(...a.map((value:any)=>Number(ev(value))));
      case '$floor':return Math.floor(Number(ev(a)));
      case '$round':{const scale=10**Number(ev(a[1])??0);return Math.round(Number(ev(a[0]))*scale)/scale;}
      case '$switch':{const branch=a.branches.find((x:any)=>ev(x.case));return ev(branch?branch.then:a.default);}
      case '$dateToString':{
        const date=ev(a.date);if(date==null)return a.onNull??null;
        if(a.format!=='%Y-%m-%d')throw new Error(`Unsupported date format ${a.format}`);
        const parts=new Intl.DateTimeFormat('en-US',{timeZone:a.timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(date));
        const part=(type:string)=>parts.find(p=>p.type===type)!.value;
        return `${part('year')}-${part('month')}-${part('day')}`;
      }
      case '$cond':return Array.isArray(a)?(ev(a[0])?ev(a[1]):ev(a[2])):(ev(a.if)?ev(a.then):ev(a.else));
      case '$and':return a.every(ev);
      case '$or':return a.some(ev);
      case '$toString':return String(ev(a));
      case '$size':return (ev(a)||[]).length;
      case '$arrayElemAt':return ev(a[0])?.[ev(a[1])];
    }
  }
  return Object.fromEntries(Object.entries(v).map(([k,val])=>[k,ev(val)]));
}
function applyUpdate(doc:any, update:any, isInsert=false):any {
  if(Array.isArray(update)) {
    let current=doc;
    const variables={NOW:new Date(),REMOVE:REMOVE_VALUE};
    for(const stage of update){
      if(Object.keys(stage).length!==1||!stage.$set)throw new Error('Only $set update pipeline stages are supported');
      const values=evaluate(stage.$set,current,variables),set:any={},unset:any={};
      for(const [key,value] of Object.entries(values))if(value===REMOVE_VALUE)unset[key]='';else set[key]=value;
      current=applyUpdate(current,{$set:set,$unset:unset},isInsert);
    }
    return current;
  }
  const next={...doc}, operators=Object.keys(update||{}).some(x=>x.startsWith('$'));
  if(!operators) return {...next,...normalize(update)};
  function set(key:string,value:any){const parts=key.split('.');let obj=next;for(const p of parts.slice(0,-1))obj=obj[p]??={};obj[parts.at(-1)!]=normalize(value);}
  for(const [op,fields] of Object.entries(update||{})) {
    for(const [key,value] of Object.entries(fields as Record<string,any>)) {
      switch(op){
        case '$set':set(key,value);break;
        case '$setOnInsert':if(isInsert)set(key,value);break;
        case '$inc':set(key,Number(getValue(next,key)||0)+Number(value));break;
        case '$mul':set(key,Number(getValue(next,key)||0)*Number(value));break;
        case '$unset':{const ps=key.split('.'), leaf=ps.pop()!;let p=next;for(const part of ps)p=p?.[part];if(p)delete p[leaf];break;}
        case '$push':{const v=getValue(next,key)||[], added=(value as any)?.$each??[value];set(key,[...v,...added]);break;}
        case '$addToSet':{const v=getValue(next,key)||[],added=(value as any)?.$each??[value];set(key,[...v,...added.filter((x:any)=>!v.some((y:any)=>eq(x,y)))]);break;}
        case '$pull':set(key,(getValue(next,key)||[]).filter((v:any)=>!matches(v,value)));break;
        case '$currentDate':set(key,new Date());break;
        case '$min':set(key,cmp(getValue(next,key),value)>0?value:getValue(next,key));break;
        case '$max':set(key,cmp(getValue(next,key),value)<0?value:getValue(next,key));break;
        default:throw new Error(`Unsupported SQL repository update operator ${op}`);
      }
    }
  }
  return next;
}
export class PgQuery<T=any> implements PromiseLike<T> {
  private selection:any; private ordering:any; private offset=0; private cap?:number;
  private populatePaths:any[]=[]; private distinctPath?:string; private collator?:Intl.Collator;
  constructor(private readonly run:()=>Promise<any>,private readonly model:any,private readonly one=false){}
  lean(_opt?:any):this{return this;}
  exec():Promise<T>{return this.resolve() as Promise<T>}
  then<TResult1=T,TResult2=never>(onfulfilled?:((value:T)=>TResult1|PromiseLike<TResult1>)|null,onrejected?:((reason:any)=>TResult2|PromiseLike<TResult2>)|null):Promise<TResult1|TResult2>{return this.resolve().then(onfulfilled,onrejected)}
  catch<TResult=never>(onrejected:(reason:any)=>TResult|PromiseLike<TResult>):Promise<T|TResult>{return this.resolve().catch(onrejected)}
  finally(onfinally:()=>void):Promise<T>{return this.resolve().finally(onfinally)}
  collation(options:{locale?:string,numericOrdering?:boolean,strength?:number}):this{
    this.collator=new Intl.Collator(options.locale||'en',{numeric:options.numericOrdering===true,
      sensitivity:options.strength===1?'base':options.strength===2?'accent':'variant'});
    return this;
  }
  select(fields:any):this{this.selection=fields;return this;}
  sort(fields:any):this{this.ordering=fields;return this;}
  skip(value:number):this{this.offset=Number(value)||0;return this;}
  limit(value:number):this{this.cap=Math.max(0,Number(value));return this;}
  populate(fields:any, select?:any):this{this.populatePaths.push(typeof fields === "string" && select ? {path:fields,select} : fields);return this;}
  distinct(path:string):this{this.distinctPath=path;return this;}
  private async resolve():Promise<any>{
    let result=await this.run();const many=Array.isArray(result);
    let arr=many?result:result==null?[]:[result];
    if(this.ordering){ const order= typeof this.ordering==='string' ? Object.fromEntries(this.ordering.split(/\s+/).filter(Boolean).map((x:string)=>[x.replace(/^-/,''),x.startsWith('-')?-1:1])) : this.ordering;
      arr=[...arr].sort((a,b)=>{for(const [k,v] of Object.entries(order)){const av=getValue(a,k),bv=getValue(b,k);
        const cmpv=this.collator&&typeof av==='string'&&typeof bv==='string'?this.collator.compare(av,bv):cmp(av,bv);
        if(cmpv)return cmpv*(Number(v)===-1?-1:1);}return 0;});}
    if(many){arr=arr.slice(this.offset,this.cap==null?undefined:this.offset+this.cap)}
    for(const option of this.populatePaths){for(const doc of arr)await this.model.populate(doc,option)}
    if(this.selection){
      const keys:string[]=typeof this.selection==='string'?this.selection.split(/\s+/).filter(Boolean)
        :Object.entries(this.selection).map(([key,value])=>value===0||value===false?`-${key}`:key);
      const excluded=keys.filter(key=>key.startsWith('-')).map(key=>key.slice(1));
      const included=keys.filter(key=>!key.startsWith('-')&&!key.startsWith('+'));
      const forced=keys.filter(key=>key.startsWith('+')).map(key=>key.slice(1));
      // +field overrides a hidden field; it does not turn the query into an inclusive projection.
      const tree=included.length?projectionTree([...included,...forced,'_id'].filter(key=>!excluded.includes(key))):undefined;
      arr=arr.map(doc=>{
        if(tree)return project(doc,tree);
        for(const key of excluded)delete doc[key];
        return doc;
      });
    }
    if(this.distinctPath)return [...new Set(arr.map(v=>getValue(v,this.distinctPath!)))];
    return this.one?(arr[0]??null):many?arr:(arr[0]??null);
  }
}

export type PgModel<T=any> = (new (values?:any)=>PgDocument<T>) & {
  find(filter?:any,projection?:any):PgQuery<PgDocument<T>[]>;
  findOne(filter?:any,projection?:any):PgQuery<PgDocument<T>|null>;
  findById(id:any,projection?:any):PgQuery<PgDocument<T>|null>;
  findOneAndUpdate(filter:any,values:any,opts?:any):PgQuery<PgDocument<T>|null>;
  findByIdAndUpdate(id:any,values:any,opts?:any):PgQuery<PgDocument<T>|null>;
  findOneAndDelete(filter:any):PgQuery<PgDocument<T>|null>;
  findByIdAndDelete(id:any):PgQuery<PgDocument<T>|null>;
  findOneAndRemove(filter:any):PgQuery<PgDocument<T>|null>;
  collection: {name:string};
  updateOne(filter:any,update:any,opts?:any):PgQuery<{modifiedCount:number,matchedCount:number,upsertedCount:number}>;
  updateMany(filter:any,update:any,opts?:any):PgQuery<{modifiedCount:number,matchedCount:number}>;
  deleteOne(filter:any):PgQuery<{deletedCount:number}>;
  deleteMany(filter:any):PgQuery<{deletedCount:number}>;
  countDocuments(filter?:any):PgQuery<number>;
  estimatedDocumentCount():PgQuery<number>;
  exists(filter:any):PgQuery<any>;
  create(value:any):Promise<any>;
  insertMany(values:any[],opts?:any):Promise<any[]>;
  bulkWrite(ops:any[]):Promise<any>;
  distinct(field:string,filter?:any):PgQuery<any[]>;
  aggregate<U=any>(pipeline?:any[]):PgQuery<U[]>;
  populate(doc:any, path:any):Promise<any>;
};

type PoolLike = Pick<pg.Pool,'query'>;
async function readRows(table: string, pool: PoolLike): Promise<any[]> {
  const role = serviceRole(), owner = tableOwner(table);
  if (!role || !owner || owner === role) {
    return (await pool.query(`SELECT * FROM public.${safeName(table)}`)).rows;
  }
  // Identity user data is never loaded wholesale into Arena/Learning: only
  // the dedicated, event-maintained public display projection is accessible.
  if (table === 'users' && ['arena','learning','notification'].includes(role)) {
    return (await pool.query(`SELECT id,username,avatar_url,is_deleted,is_banned,payload,
      created_at,updated_at FROM public.identity_profiles`)).rows;
  }
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token || token.length < 24) throw new Error('Internal read authentication not configured');
  const response = await fetch(`${serviceUrl(owner)}/api/_internal/read-models/${table}`, {
    headers: { 'x-internal-token': token }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Read model ${owner}.${table} unavailable (${response.status})`);
  const body = await response.json() as any;
  const rows = body?.data ?? body;
  if (!Array.isArray(rows)) throw new Error(`Invalid read model response for ${owner}.${table}`);
  return rows;
}

/** Push safe, common document filters into PostgreSQL. Unsupported operators
 * retain the legacy adapter behavior until their owner repositories are migrated.
 * All user values are bound parameters; identifiers are introspected columns. */
function simpleWhere(filter: any, columns: Map<string,string>): {sql:string; values:any[]} | null {
  const values:any[]=[];
  const bind=(value:any)=>{values.push(value instanceof PgId?String(value):value);return `$${values.length}`;};
  const column=(key:string):string|null=>{
    const name=key==='_id'?'id':snake(key);
    return columns.has(name)?safeName(name):null;
  };
  const entry=(key:string, value:any):string|null=>{
    const col=column(key);
    if(!col)return null;
    if(value instanceof RegExp) {
      if(/[^i]/.test(value.flags))return null;
      return `${col} ${value.ignoreCase?'~*':'~'} ${bind(value.source)}`;
    }
    if(value===null)return `${col} IS NULL`;
    if(value && typeof value==='object' && !(value instanceof Date) && !(value instanceof PgId)) {
      if(Array.isArray(value))return null;
      const conditions:string[]=[];
      for(const [op,target] of Object.entries(value)) {
        if(op==='$options')continue;
        if(op==='$exists'){conditions.push(`${col} IS ${target?'NOT ':''}NULL`);continue;}
        if(op==='$regex'){
          const opts=String((value as any).$options||'');
          if(/[^i]/.test(opts))return null;
          conditions.push(`${col} ${opts.includes('i')?'~*':'~'} ${bind(target)}`);continue;
        }
        if(op==='$ne'){conditions.push(`${col} IS DISTINCT FROM ${bind(target)}`);continue;}
        if(op==='$eq'){conditions.push(`${col} IS NOT DISTINCT FROM ${bind(target)}`);continue;}
        if(op==='$in'||op==='$nin'){
          if(!Array.isArray(target))return null;
          const vs=(target as any[]).map(String);
          conditions.push(`${col}::text ${op==='$in'?'= ANY':'<> ALL'}(${bind(vs)}::text[])`);
          continue;
        }
        if(['$gt','$gte','$lt','$lte'].includes(op)){
          const symbol:{[key:string]:string}={'$gt':'>','$gte':'>=','$lt':'<','$lte':'<='};
          conditions.push(`${col} ${symbol[op]} ${bind(target)}`);continue;
        }
        return null;
      }
      return conditions.length?conditions.map(c=>`(${c})`).join(' AND '):null;
    }
    return `${col} = ${bind(value)}`;
  };
  const recurse=(part:any):string|null=>{
    if(!part || typeof part!=='object' || Array.isArray(part))return null;
    const conditions:string[]=[];
    for(const [key,value] of Object.entries(part)){
      if(key==='$or'||key==='$and'){
        if(!Array.isArray(value)||!value.length)return null;
        const expressions=(value as any[]).map(recurse);
        if(expressions.some(x=>x==null))return null;
        conditions.push('('+expressions.join(key==='$or'?' OR ':' AND ')+')');
      }else{
        const condition=entry(key,value);
        if(condition==null)return null;
        conditions.push('('+condition+')');
      }
    }
    return conditions.length?conditions.join(' AND '):'TRUE';
  };
  const sql=recurse(filter||{});
  return sql==null?null:{sql,values};
}

function assertOwnedWrite(table: string) {
  const role = serviceRole(), owner = tableOwner(table);
  if (role && owner && owner !== role) throw new Error(`Service ${role} cannot write ${owner}.${table}; use the owner's command API`);
}

export function makePgModel<T=any>(name:string,pool:pg.Pool):PgModel<T> {
  const table=sqlTable(name), meta=metadata(name), defined=meta.fields;
  // PostgreSQL's JSON/JSONB columns accept JSON text, not bare enum/string values.
  // Keep the real column types (not just names) so writes are encoded correctly.
  let columns: Map<string,string>|null=null;
  async function fields():Promise<Map<string,string>>{if(columns)return columns;
    const result=await pool.query(`SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,[table]);
    if(!result.rows.length)throw new Error(`PostgreSQL table public.${table} is absent. Update database/postgres/01-init.sql and recreate fresh database.`);
    return columns=new Map(result.rows.map(r=>[r.column_name, r.data_type||r.udt_name||'']));
  }
  function columnParameter(value:any, dataType:string):any {
    if(value===null)return null; // SQL NULL is different from a JSON null value.
    if(dataType==='jsonb'||dataType==='json')return JSON.stringify(normalize(value));
    return value instanceof Date?value:Array.isArray(value)||value&&typeof value==='object'
      ?JSON.stringify(normalize(value)):normalize(value);
  }
  async function validateDoc(data:any):Promise<void>{
    const context={get:(field:string)=>getValue(data,field)};
    for(const [field,opts] of Object.entries(defined)){
      const rules:any=opts||{}, value=data[field];
      const required=typeof rules.required==='function'?Boolean(rules.required.call(context)):Boolean(rules.required);
      if(required&&(value===undefined||value===null||value===''))throw new Error(`${name}.${field} is required`);
      if(value===undefined||value===null)continue;
      if(rules.enum&&!rules.enum.includes(value))throw new Error(`${name}.${field} has invalid value`);
      if(typeof value==='number'&&((rules.min!==undefined&&value<rules.min)||(rules.max!==undefined&&value>rules.max)))
        throw new Error(`${name}.${field} is outside allowed range`);
      const validator=typeof rules.validate==='function'?rules.validate:rules.validate?.validator;
      if(typeof validator==='function'&&!await validator.call(context,value))
        throw new Error(rules.validate?.message||`${name}.${field} failed validation`);
    }
  }
  function hydrate(row:any):any{
    let data= {...row.payload};
    for(const [k,v] of Object.entries(row)) {
      if(k==='payload')continue;
      const key=k==='id'?'_id':k==='password_hash'?'password':camel(k);
      if(v!==null&&v!==undefined&&(data[key]===undefined || k==='id'))data[key]=v;
    }
    if(!data._id)data._id=row.id;
    if (data._id)data._id=new PgId(data._id);
    data.id=String(data._id);data.createdAt=data.createdAt||row.created_at;data.updatedAt=data.updatedAt||row.updated_at;
    for(const [k,option] of Object.entries(defined)) if(data[k]===undefined && option && (option as any).default!==undefined) {
      const def=(option as any).default;data[k]=typeof def==='function'?def():JSON.parse(JSON.stringify(def));
    }
    data = restoreDocumentDates(data, defined);
    Object.defineProperties(data,{toObject:{enumerable:false,value:()=>plain(data)},save:{enumerable:false,value:()=>save(data)},
      validate:{enumerable:false,value:()=>validateDoc(data)},
      populate:{enumerable:false,value:async(opt:any)=>{await (PgDynamicModel as any).populate(data,opt);return data;}}});
    return data;
  }
  async function all(){return (await readRows(table,pool)).map(hydrate);}
  async function selected(filter?:any){
    const owner=tableOwner(table),role=serviceRole();
    if(!owner||!role||owner===role){
      const where=simpleWhere(filter,await fields());
      if(where){
        const result=await pool.query(`SELECT * FROM public.${safeName(table)} WHERE ${where.sql}`,where.values);
        return result.rows.map(hydrate).filter((x:any)=>matches(x,filter));
      }
    }
    return (await all()).filter(x=>matches(x,filter));
  }
  async function save(value:any){const doc=plain(value);const id=String(doc._id||doc.id||randomUUID());if(!PgId.isValid(id))throw new Error(`Expected UUID for ${name}.id, got ${id}`);
    assertOwnedWrite(table);
    doc._id=id;delete doc.id;delete doc.createdAt;delete doc.updatedAt;
    const cols=await fields();const writeCols:string[]=['id','payload'];const vals:any[]=[id,JSON.stringify(normalize(doc))];
    for(const [k,v] of Object.entries(doc)){
      const column=k==='password'?'password_hash':snake(k);
      if(['id','payload','_id','created_at','updated_at'].includes(column)||!cols.has(column)||v===undefined)continue;
      writeCols.push(column);vals.push(columnParameter(v,cols.get(column)||''));
    }
    const quoted=writeCols.map(safeName).join(',');const params=vals.map((_,i)=>`$${i+1}`).join(',');
    const updates=writeCols.filter(x=>x!=='id').map(x=>`${safeName(x)}=EXCLUDED.${safeName(x)}`).join(',');
    const res=await pool.query(`INSERT INTO public.${safeName(table)} (${quoted}) VALUES (${params}) ON CONFLICT (id) DO UPDATE SET ${updates} RETURNING *`,vals);
    return hydrate(res.rows[0]);
  }
  async function hooks(op:string,filter:any,updates:any){for(const h of (meta.hooks[op]??[]))await h.call({getUpdate:()=>updates,getFilter:()=>filter});}
  async function update(filter:any,updates:any,opts:any={},one:boolean){
    assertOwnedWrite(table);
    const lockRows=Array.isArray(updates)||table==='attempts';
    // Serialize answer saves/submission against the latest row, on one PostgreSQL connection.
    if(lockRows&&typeof pool.connect==='function'&&typeof (pool as any).release!=='function'){
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const transactional=makePgModel(name,client as any) as any;
        const result=await transactional[PG_UPDATE](filter,updates,opts,one);
        await client.query('COMMIT');return result;
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    }
    await hooks(one?'findOneAndUpdate':'updateOne',filter,updates);
    const rows=await selected(filter);const targets=one?rows.slice(0,1):rows;let first=null;
    let matchedCount=0;
    for(let row of targets){
      if(lockRows&&typeof (pool as any).release==='function'){
        const locked=await pool.query(`SELECT * FROM public.${safeName(table)} WHERE id=$1 FOR UPDATE`,[String(row._id)]);
        if(!locked.rows[0])continue;
        row=hydrate(locked.rows[0]);if(!matches(row,filter))continue;
      }
      const changed=applyUpdate(row,updates);first=await save(changed);matchedCount++;
    }
    if(!targets.length&&opts.upsert){const seed=Object.fromEntries(Object.entries(filter||{}).filter(([k,v])=>!k.startsWith('$')&&!(typeof v==='object'&&!Array.isArray(v)&&!(v instanceof Date)&&!(v instanceof PgId))));first=await save(applyUpdate(seed,updates,true));}
    return {first,modifiedCount:matchedCount,matchedCount,upsertedCount:!targets.length&&first?1:0};
  }
  async function erase(filter:any,one:boolean){const targets=(await selected(filter)).slice(0,one?1:undefined);
    assertOwnedWrite(table);
    for(const v of targets)await pool.query(`DELETE FROM public.${safeName(table)} WHERE id=$1`,[String(v._id)]);return targets;
  }
  class PgDynamicModel {
    static [PG_UPDATE]=update;
    static readonly collection={name:table};
    constructor(data:any={}) {return hydrate({id:data._id||data.id||randomUUID(),payload:normalize(data),created_at:new Date(),updated_at:new Date()});}
    static find(filter:any={},projection?:any){const q=new PgQuery(()=>selected(filter),PgDynamicModel);if(projection)q.select(projection);return q;}
    static findOne(filter:any={},projection?:any){const q=new PgQuery(async()=>await selected(filter),PgDynamicModel,true);if(projection)q.select(projection);return q;}
    static findById(id:any,projection?:any){return PgDynamicModel.findOne({_id:String(id)},projection);}
    static findOneAndUpdate(filter:any,values:any,opts:any={}){return new PgQuery(async()=>{
      const old=(await selected(filter))[0]||null, result=await update(filter,values,opts,true);
      return opts.new===false || opts.returnDocument==='before'?old:result.first;
    },PgDynamicModel);}
    static findByIdAndUpdate(id:any,values:any,opts:any={}){return PgDynamicModel.findOneAndUpdate({_id:String(id)},values,opts);}
    static updateOne(filter:any,values:any,opts:any={}){return new PgQuery(async()=>{
      const x=await update(filter,values,opts,true);
      return {modifiedCount:x.modifiedCount,matchedCount:x.matchedCount,upsertedCount:x.upsertedCount};
    },PgDynamicModel);}
    static updateMany(filter:any,values:any,opts:any={}){return new PgQuery(async()=>{
      const x=await update(filter,values,opts,false);
      return {modifiedCount:x.modifiedCount,matchedCount:x.matchedCount};
    },PgDynamicModel);}
    static findOneAndDelete(filter:any){return new PgQuery(async()=>(await erase(filter,true))[0]||null,PgDynamicModel);}
    static findByIdAndDelete(id:any){return PgDynamicModel.findOneAndDelete({_id:String(id)});}
    static findOneAndRemove(filter:any){return PgDynamicModel.findOneAndDelete(filter);}
    static deleteOne(filter:any){return new PgQuery(async()=>({deletedCount:(await erase(filter,true)).length}),PgDynamicModel);}
    static deleteMany(filter:any){return new PgQuery(async()=>({deletedCount:(await erase(filter,false)).length}),PgDynamicModel);}
    static countDocuments(filter:any={}){return new PgQuery(async()=>{
      const owner=tableOwner(table),role=serviceRole();
      if(!owner||!role||owner===role){
        const where=simpleWhere(filter,await fields());
        if(where){const result=await pool.query(`SELECT COUNT(*)::integer AS n FROM public.${safeName(table)} WHERE ${where.sql}`,where.values);
          return result.rows[0].n as number;}
      }
      return (await selected(filter)).length;
    },PgDynamicModel);}
    static estimatedDocumentCount(){return PgDynamicModel.countDocuments({});}
    static exists(filter:any){return new PgQuery(async()=>{
      const owner=tableOwner(table),role=serviceRole();
      if(!owner||!role||owner===role){
        const where=simpleWhere(filter,await fields());
        if(where){const result=await pool.query(`SELECT id FROM public.${safeName(table)} WHERE ${where.sql} LIMIT 1`,where.values);
          return result.rows[0]?{_id:new PgId(result.rows[0].id)}:null;}
      }
      const found=(await selected(filter))[0];return found?{_id:found._id}:null;
    },PgDynamicModel);}
    static async create(data:any){return Array.isArray(data)?Promise.all(data.map(x=>save(new PgDynamicModel(x)))):save(new PgDynamicModel(data))}
    static async insertMany(values:any[]){return Promise.all(values.map(x=>save(new PgDynamicModel(x))))}
    static async bulkWrite(ops:any[]){for(const op of ops){if(op.updateOne)await PgDynamicModel.updateOne(op.updateOne.filter,op.updateOne.update,op.updateOne);
      if(op.insertOne)await PgDynamicModel.create(op.insertOne.document);
      if(op.deleteOne)await PgDynamicModel.deleteOne(op.deleteOne.filter);
      if(op.replaceOne)await PgDynamicModel.updateOne(op.replaceOne.filter,op.replaceOne.replacement,op.replaceOne);
      if(op.updateMany)await PgDynamicModel.updateMany(op.updateMany.filter,op.updateMany.update,op.updateMany);
    } return {ok:1};}
    static distinct(field:string,filter:any={}){return new PgQuery(async()=>
      [...new Set((await selected(filter)).map(v=>getValue(v,field)))],PgDynamicModel)}
    static aggregate<U=any>(pipeline:any[]=[]):PgQuery<U[]>{return new PgQuery<U[]>(async()=>runAggregation(pipeline,await all(),pool),PgDynamicModel);}
    static async populate(doc:any, option:any){const opts=typeof option==='string'?{path:option}:option;const key=opts.path as string;
      const ref=defined[key]?.ref; if(!ref) return doc;
      const destination=makePgModel(ref,pool), id=doc[key];if(!id)return doc;
      try{doc[key]=Array.isArray(id)?await Promise.all(id.map((i:any)=>destination.findById(i).lean().exec())):await destination.findById(id).lean().exec();}
      catch(err){throw new Error(`Cannot populate ${name}.${key} from owned PostgreSQL database: ${String(err)}`);}
      return doc;
    }
  }
  return PgDynamicModel as unknown as PgModel<T>;
}

export async function runAggregation(pipeline: any[], initial: any[], pool?: pg.Pool, variables:Record<string,any>={}):Promise<any[]> {
  let data=[...initial];
  for(const stage of pipeline){
    const [op,body]=Object.entries(stage)[0] as [string,any];
    switch(op){
      case '$match':data=data.filter(row=>matches(row,body,variables));break;
      case '$sort':data.sort((a,b)=>{for(const [k,dir] of Object.entries(body)){const c=cmp(getValue(a,k),getValue(b,k));if(c)return c*(Number(dir)<0?-1:1)}return 0});break;
      case '$skip':data=data.slice(body);break;
      case '$limit':data=data.slice(0,body);break;
      case '$count':data=data.length?[{[body]:data.length}]:[];break;
      case '$project':{
        const fields=Object.entries(body),exclusion=fields.every(([,v])=>v===0||v===false);
        data=data.map(row=>{
          if(exclusion)return Object.fromEntries(Object.entries(row).filter(([key])=>!(key in body)));
          const projected=Object.fromEntries(fields.filter(([,v])=>v!==0&&v!==false).map(([k,v])=>[k,v===1||v===true?getValue(row,k):evaluate(v,row,variables)]));
          if(body._id!==0&&body._id!==false&&projected._id===undefined&&row._id!==undefined)projected._id=row._id;
          return projected;
        });break;
      }
      case '$addFields':case '$set':data=data.map(row=>({...row,...evaluate(body,row,variables)}));break;
      case '$unwind':{const path=typeof body==='string'?body:body.path;const key=path.replace(/^\$/,'');data=data.flatMap(row=>{const vals=getValue(row,key);return Array.isArray(vals)&&vals.length?vals.map(x=>({...row,[key]:x})):((body.preserveNullAndEmptyArrays)?[row]:[])});break;}
      case '$group':{const groups=new Map<string,any>(),averages=new Map<string,{sum:number,count:number}>();for(const row of data){const id=evaluate(body._id,row,variables), key=JSON.stringify(normalize(id));let g=groups.get(key);if(!g){g={_id:id};groups.set(key,g)}
        for(const [field,acc] of Object.entries(body))if(field!=='_id'){const [agg,expr]=Object.entries(acc as any)[0] as [string,any];const value=evaluate(expr,row,variables);
          if(agg==='$sum')g[field]=(g[field]||0)+Number(value??0);else if(agg==='$push')(g[field]??=[]).push(value);
          else if(agg==='$avg'){const avgKey=JSON.stringify([key,field]),stats=averages.get(avgKey)??{sum:0,count:0};if(typeof value==='number'){stats.sum+=value;stats.count++;}averages.set(avgKey,stats);g[field]=stats.count?stats.sum/stats.count:null;}
          else if(agg==='$addToSet'){if(!(g[field]??=[]).some((v:any)=>eq(v,value)))g[field].push(value)}
          else if(agg==='$first'&&g[field]===undefined)g[field]=value;
          else if(agg==='$max'&&(g[field]===undefined||cmp(value,g[field])>0))g[field]=value;
          else if(agg==='$min'&&(g[field]===undefined||cmp(value,g[field])<0))g[field]=value;
          else if(!['$first','$max','$min'].includes(agg))throw new Error(`Unsupported SQL aggregate ${agg}`);
        }}data=[...groups.values()];break;}
      case '$facet':{const groups:any={};for(const [key,sub] of Object.entries(body))groups[key]=await runAggregation(sub as any[],data,pool,variables);data=[groups];break;}
      case '$setWindowFields':{
        if(body.partitionBy)throw new Error('Partitioned windows require an explicit SQL query');
        const ordering=Object.entries(body.sortBy||{});
        const outputs=Object.entries(body.output||{}) as [string,Record<string,any>][];
        if(ordering.length!==1||outputs.some(([,value])=>Object.keys(value).length!==1||!('$rank' in value)))throw new Error('Only single-column rank windows are supported');
        const [field,direction]=ordering[0];
        data.sort((a,b)=>cmp(getValue(a,field),getValue(b,field))*(Number(direction)<0?-1:1));
        let rank=1;
        data=data.map((row,index)=>{if(index&& !eq(getValue(row,field),getValue(data[index-1],field)))rank=index+1;return {...row,...Object.fromEntries(outputs.map(([name])=>[name,rank]))};});
        break;
      }
      case '$lookup':{if(!pool)throw new Error('Lookup requires SQL connection');const tbl=sqlTable(body.from);
        const rows=(await readRows(tbl,pool)).map(r=>({...Object.fromEntries(Object.entries(r).filter(([k])=>k!=='payload').map(([k,v])=>[camel(k),v])),...r.payload,_id:new PgId(r.id)}));
        data=await Promise.all(data.map(async row=>{
          let joined=rows;
          if(body.localField&&body.foreignField)joined=joined.filter(r=>{
            const local=getValue(row,body.localField),foreign=getValue(r,body.foreignField);
            return (Array.isArray(local)?local:[local]).some(a=>(Array.isArray(foreign)?foreign:[foreign]).some(b=>eq(a,b)));
          });
          else if(!body.pipeline)throw new Error('Lookup requires matching fields or a pipeline');
          const scoped={...variables,...evaluate(body.let||{},row,variables)};
          if(body.pipeline)joined=await runAggregation(body.pipeline,joined,pool,scoped);
          return {...row,[body.as]:joined};
        }));break;}
      default:throw new Error(`Unsupported SQL aggregation stage: ${op}; implement explicit SQL query for this use case`);
    }
  }
  return data;
}

export function getModelToken(name:string){return `PG_MODEL_${name}`}
export function InjectPgModel(name:string):ParameterDecorator{return Inject(getModelToken(name))}
export function getConnectionToken(){return 'PG_CONNECTION'}
export function InjectPgConnection():ParameterDecorator{return Inject(getConnectionToken())}
@Global() @Module({})
export class PgModelsModule {
  static forRootAsync(_options:any={}):DynamicModule {
    return {module:PgModelsModule,global:true,providers:[{
      provide:getConnectionToken(),useFactory:()=>{
        if (!defaultPool) {
          const config=process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:
            {host:process.env.PGHOST||'127.0.0.1',port:Number(process.env.PGPORT||5432),database:process.env.PGDATABASE,
              user:process.env.PGUSER,password:process.env.PGPASSWORD};
          if(!process.env.DATABASE_URL&&(!config.database||!config.user||!config.password))throw new Error('PostgreSQL role/database credentials must be provided');
          defaultPool=new pg.Pool({...config,max:Number(process.env.PG_POOL_MAX||8),connectionTimeoutMillis:10000});
        }
        return createConnection(defaultPool);
      },
    }],exports:[getConnectionToken()]};
  }
  static forFeature(models:{name:string,schema?:any}[]):DynamicModule {
    return {module:PgModelsModule,providers:models.map(x=>({provide:getModelToken(x.name),inject:[getConnectionToken()],
      useFactory:(conn:PgConnection)=>makePgModel(x.name,conn.pool)})),exports:models.map(x=>getModelToken(x.name))};
  }
}
export const Schema=PgSchemaDefinition;
export const SchemaFactory=PgSchemaFactory;
export const Prop=PgField;
export const Model=undefined as unknown as PgModel;
export const getDb = () => defaultPool;

export type Model<T=any> = PgModel<T>;
export type Connection = PgConnection;

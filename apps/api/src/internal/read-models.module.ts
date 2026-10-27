import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, HttpCode, Module, Param, Post, UnprocessableEntityException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { InjectPgConnection, simpleWhere, type PgConnection } from '../postgres/compat.js';
import { OWNED_TABLES, serviceRole } from '../postgres/ownership.js';
import { Public } from '../modules/auth/decorators/public.decorator.js';
import { MiniGameSourceSummaryController } from './minigame-source-summary.controller.js';
import { RecommendationSummaryController } from './recommendation-summary.controller.js';
import { MistakeSourceController } from './mistake-source.controller.js';

/** Transitional read API. All identifiers are restricted to the owner's
 * allowlist, predicates are parameterized and no SQL is accepted from clients. */
@Controller('_internal/read-models')
export class ReadModelsController {
  constructor(@InjectPgConnection() private readonly connection: PgConnection) {}

  private readonly columnCache = new Map<string, Map<string,string>>();

  private authenticate(token:string, table:string) {
    const expected = Buffer.from(process.env.INTERNAL_SERVICE_TOKEN || '');
    const actual = Buffer.from(token || '');
    if (expected.length < 24 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new ForbiddenException();
    }
    // Do not export admin credentials, auth secrets or private event payloads.
    if (!OWNED_TABLES[serviceRole() || '']?.includes(table)
      || ['admins', 'pdf_ai_correction_events', 'learning_mistakes', 'learning_item_outcomes'].includes(table)) {
      throw new BadRequestException('Unknown read model');
    }
  }

  private async columns(table:string):Promise<Map<string,string>>{
    const cached=this.columnCache.get(table);
    if(cached)return cached;
    const result=await this.connection.query(`SELECT column_name,data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1`,[table]);
    if(!result.rows.length)throw new BadRequestException('Read model table missing');
    const columns=new Map<string,string>(result.rows.map(row=>[String(row.column_name),String(row.data_type)] as [string,string]));
    // Consumers of identity must not use this broad bridge to query private
    // fields, even for filters that would not return those fields.
    if(table==='users')for(const name of [...columns.keys()])
      if(!['id','username','avatar_url','is_deleted','is_banned','created_at','updated_at'].includes(name))columns.delete(name);
    this.columnCache.set(table,columns);
    return columns;
  }

  private publicRows(table:string, rows:Record<string,any>[]){
    if(table!=='users')return rows;
    return rows.map(row=>({
      id:row.id,username:row.username,avatar_url:row.avatar_url,
      is_deleted:row.is_deleted,is_banned:row.is_banned,
      payload:{username:row.username,avatarUrl:row.avatar_url},
    }));
  }

  private async queryPredicate(table:string,filter:unknown){
    if(!filter || typeof filter!=='object' || Array.isArray(filter) || JSON.stringify(filter).length>16384)
      throw new UnprocessableEntityException('Unsupported read-model filter');
    const where=simpleWhere(filter,await this.columns(table));
    if(!where)throw new UnprocessableEntityException('Unsupported read-model filter');
    return where;
  }

  @Public()
  @Get(':table')
  async rows(@Headers('x-internal-token') token: string, @Param('table') table: string) {
    this.authenticate(token,table);
    // Retained for older consumers and complex document pipelines. New callers
    // should use the bounded SQL /query or /count endpoints below.
    const select=table==='users'
      ? 'id,username,avatar_url,is_deleted,is_banned'
      : '*';
    const result=await this.connection.query(`SELECT ${select} FROM public."${table}"`);
    return this.publicRows(table,result.rows);
  }

  @Public()
  @Post(':table/query')
  @HttpCode(200)
  async query(@Headers('x-internal-token') token:string,@Param('table') table:string,
    @Body() body:{filter?:Record<string,unknown>,sort?:Record<string,unknown>|string,offset?:number,limit?:number}){
    this.authenticate(token,table);
    const filter=body?.filter??{};
    const where=await this.queryPredicate(table,filter);
    const offset=body?.offset??0,limit=body?.limit;
    if(!Number.isSafeInteger(offset)||offset<0||typeof limit!=='number'||!Number.isSafeInteger(limit)||limit<1||limit>2000)
      throw new UnprocessableEntityException('Read-model query requires limit 1..2000 and a nonnegative offset');
    const cols=await this.columns(table);
    const sort=body?.sort;
    const ordering=typeof sort==='string'
      ? Object.fromEntries(sort.split(/\s+/).filter(Boolean).map(item=>[item.replace(/^-/,''),item.startsWith('-')?-1:1]))
      : sort??{};
    if(!ordering || typeof ordering!=='object' || Array.isArray(ordering))
      throw new UnprocessableEntityException('Unsupported read-model ordering');
    const order:string[]=[];
    for(const [key,direction] of Object.entries(ordering)){
      const name=key==='_id'?'id':key.replace(/([a-z\d])([A-Z])/g,'$1_$2').toLowerCase();
      if(!cols.has(name) || !['double precision','real','integer','bigint','smallint','numeric',
        'timestamp with time zone','timestamp without time zone','date'].includes(cols.get(name)!)
        || ![1,-1,'asc','desc','ascending','descending'].includes(direction as any))
        throw new UnprocessableEntityException('Unsupported read-model ordering');
      const desc=direction===-1||direction==='desc'||direction==='descending';
      order.push(`"${name}" ${desc?'DESC NULLS LAST':'ASC NULLS FIRST'}`);
    }
    const values=[...where.values,limit,offset];
    const select=table==='users'?'id,username,avatar_url,is_deleted,is_banned':'*';
    const result=await this.connection.query(`SELECT ${select} FROM public."${table}"
      WHERE ${where.sql} ORDER BY ${order.length?`${order.join(', ')}, `:''}id ASC
      LIMIT $${where.values.length+1} OFFSET $${where.values.length+2}`,values);
    return this.publicRows(table,result.rows);
  }

  @Public()
  @Post(':table/count')
  @HttpCode(200)
  async count(@Headers('x-internal-token') token:string,@Param('table') table:string,
    @Body() body:{filter?:Record<string,unknown>}){
    this.authenticate(token,table);
    const where=await this.queryPredicate(table,body?.filter??{});
    const result=await this.connection.query(`SELECT COUNT(*)::integer AS count FROM public."${table}" WHERE ${where.sql}`,where.values);
    return {count:Number(result.rows[0].count)};
  }
}

@Module({ controllers: [ReadModelsController, MiniGameSourceSummaryController, RecommendationSummaryController, MistakeSourceController] })
export class ReadModelsModule {}

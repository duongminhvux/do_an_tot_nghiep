import type { PgConnection } from './connection.js';
import { newId } from './ids.js';
import { serviceRole,tableOwner } from './ownership.js';
import { nativeDefaults,normalizeNativeDates } from './record-defaults.js';
import { identifier,joinSql,literal,rowData,rows,sql,type Sql } from './sql.js';
export function newSqlRow(table:string,input:Record<string,any>={}){return {...nativeDefaults(table),...input,_id:input._id??input.id??newId()};}

const columnCache = new WeakMap<object, Map<string, Promise<Map<string, string>>>>();
const snake = (key: string) => key === '_id' || key === 'id' ? 'id' : key === 'password' ? 'password_hash' : key.replace(/([a-z\d])([A-Z])/g, '$1_$2').toLowerCase();

/** SQL rows and parameterized statements; there is no document query dialect. */
export class SqlRecords<T = any> {
  constructor(readonly db: PgConnection, readonly table: string) { identifier(table); }
  private assertOwner() {
    const role = serviceRole(), owner = tableOwner(this.table);
    if (role && owner && role !== owner) throw new Error(`Service ${role} cannot write ${owner}.${this.table}`);
  }
  private columns() {
    let cache = columnCache.get(this.db.pool);
    if (!cache) { cache = new Map(); columnCache.set(this.db.pool, cache); }
    let pending = cache.get(this.table);
    if (!pending) {
      pending = rows(this.db, sql`SELECT column_name,data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name=${this.table}`).then(result => {
          if (!result.length) throw new Error(`Missing PostgreSQL table ${this.table}`);
          return new Map<string, string>(result.map(row => [String(row.column_name), String(row.data_type)]));
        }).catch(error => { cache!.delete(this.table); throw error; });
      cache.set(this.table, pending);
    }
    return pending;
  }
  async select(where: Sql = literal('TRUE'), tail: Sql = literal('')): Promise<T[]> {
    return (await rows(this.db, sql`SELECT * FROM public.${identifier(this.table)} WHERE ${where} ${tail}`)).map(row => normalizeNativeDates(this.table,rowData<T>(row)) as T);
  }
  async one(where: Sql,tail:Sql=literal('')): Promise<T | null> { return (await this.select(where, sql`${tail} LIMIT 1`))[0] ?? null; }
  async count(where: Sql = literal('TRUE')) {
    const result = await rows(this.db, sql`SELECT COUNT(*)::integer AS count FROM public.${identifier(this.table)} WHERE ${where}`);
    return Number(result[0].count);
  }
  private async entries(input: Record<string, any>) {
    const columns = await this.columns(), entries: { key: string; column: string; value: unknown }[] = [], extra: Record<string, any> = {};
    const used = new Set<string>();
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || typeof value === 'function') continue;
      const column = snake(key);
      if (column === 'payload' || !columns.has(column)) { extra[key] = value; continue; }
      if (used.has(column)) continue;
      used.add(column);
      const type = columns.get(column)!;
      entries.push({ key, column, value: value instanceof String ? String(value) : value !== null &&
        (['json', 'jsonb'].includes(type) || Array.isArray(value) || (typeof value==='object' && !(value instanceof Date))) ? JSON.stringify(value) : value });
    }
    return { entries, extra, columns };
  }
  async insert(input: Record<string, any>, conflictColumns:readonly string[]=[]): Promise<T> {
    this.assertOwner();
    const values={...nativeDefaults(this.table),...Object.fromEntries(Object.entries(input).filter(([,value])=>value!==undefined))};
    const { entries, extra } = await this.entries(values);
    const result = await rows(this.db, sql`INSERT INTO public.${identifier(this.table)}
      (${joinSql([...entries.map(entry => identifier(entry.column)), identifier('payload')])})
      VALUES (${joinSql([...entries.map(entry => sql`${entry.value}`), sql`${JSON.stringify(extra)}::jsonb`])})
      ${conflictColumns.length?sql`ON CONFLICT (${joinSql(conflictColumns.map(identifier))}) DO NOTHING`:literal('')} RETURNING *`);
    return result[0]?normalizeNativeDates(this.table,rowData<T>(result[0])) as T:null as T;
  }
  async patch(where: Sql, input: Record<string, any>, expressions: Readonly<Record<string, Sql>> = {}): Promise<T | null> {
    this.assertOwner();
    const { entries, extra, columns } = await this.entries(input);
    const assignments = entries.filter(entry => !['id', 'created_at', 'updated_at'].includes(entry.column) && !(entry.key in expressions))
      .map(entry => sql`${identifier(entry.column)}=${entry.value}`);
    const removed = [...entries.filter(entry => entry.column !== 'id').map(entry => entry.key),...Object.keys(expressions).filter(key=>columns.has(snake(key)))];
    let payload = sql`payload - ${removed}::text[] || ${JSON.stringify(extra)}::jsonb`;
    for (const [key, expression] of Object.entries(expressions)) {
      const column = snake(key);
      if (['id', 'payload', 'created_at', 'updated_at'].includes(column)) throw new Error('Protected PostgreSQL column');
      if (columns.has(column)) assignments.push(sql`${identifier(column)}=${expression}`);
      else payload = sql`${payload} || jsonb_build_object(${key}::text,${expression})`;
    }
    assignments.push(sql`payload=${payload}`);
    const result = await rows(this.db, sql`UPDATE public.${identifier(this.table)} SET ${joinSql(assignments)} WHERE ${where} RETURNING *`);
    return result[0] ? normalizeNativeDates(this.table,rowData<T>(result[0])) as T : null;
  }
  async upsert(input:Record<string,any>,conflictColumns:readonly string[]=['id']):Promise<T>{
    this.assertOwner();
    const data={...nativeDefaults(this.table),...Object.fromEntries(Object.entries(input).filter(([,value])=>value!==undefined))};
    const {entries,extra}=await this.entries(data);
    const updates=entries.filter(entry=>!['id','created_at','updated_at'].includes(entry.column)).map(entry=>sql`${identifier(entry.column)}=EXCLUDED.${identifier(entry.column)}`);
    updates.push(sql`payload=${identifier(this.table)}.payload - ${entries.map(entry=>entry.key)}::text[] || EXCLUDED.payload`);
    const result=await rows(this.db,sql`INSERT INTO public.${identifier(this.table)}
      (${joinSql([...entries.map(entry=>identifier(entry.column)),identifier('payload')])})
      VALUES(${joinSql([...entries.map(entry=>sql`${entry.value}`),sql`${JSON.stringify(extra)}::jsonb`])})
      ON CONFLICT(${joinSql(conflictColumns.map(identifier))}) DO UPDATE SET ${joinSql(updates)} RETURNING *`);
    return normalizeNativeDates(this.table,rowData<T>(result[0])) as T;
  }
  async remove(where: Sql): Promise<T[]> {
    this.assertOwner();
    return (await rows(this.db, sql`DELETE FROM public.${identifier(this.table)} WHERE ${where} RETURNING *`)).map(row => rowData<T>(row));
  }
}

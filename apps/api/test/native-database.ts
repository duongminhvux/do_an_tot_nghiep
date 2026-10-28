import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterAll,beforeAll,beforeEach,vi} from 'vitest';
import {createConnection,type PgConnection} from '../src/postgres/connection.js';
import {SqlRecords} from '../src/postgres/records.js';
import {sql} from '../src/postgres/sql.js';

/** Every statement, constraint and trigger runs in PostgreSQL. Only external services are mocked. */
export function databaseSuite(domain:string){
  let database:PGlite,connection:PgConnection;
  const statements:{text:string;params:any[]}[]=[];
  beforeAll(async()=>{
    database=new PGlite();
    const root=resolve(process.cwd(),'../../database/postgres/migrations');
    const migrations=[domain,'common'].flatMap(owner=>readdirSync(resolve(root,owner)).filter(name=>name.endsWith('.sql')&&name!=='0009_numeric_collation.sql').map(name=>({name,file:resolve(root,owner,name)}))).sort((a,b)=>a.name.localeCompare(b.name));
    for(const migration of migrations)await database.exec(readFileSync(migration.file,'utf8'));
    const query=async(text:string,params:any[]=[])=>{statements.push({text,params});return database.query(text,params);};
    let tail=Promise.resolve();
    const pool={query,connect:async()=>{const previous=tail;let release!:()=>void;tail=new Promise<void>(resolve=>release=resolve);await previous;return {query,release};}};
    connection=createConnection(pool as never);
  },30000);
  beforeEach(async()=>{
    vi.stubEnv('SERVICE_ROLE',domain);statements.length=0;
    const tables=await database.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    await database.exec('TRUNCATE '+tables.rows.map(row=>'public."'+row.tablename+'"').join(',')+' CASCADE');
  });
  afterAll(async()=>{vi.unstubAllEnvs();await database?.close();});
  return {get db(){return connection;},get database(){return database;},statements,records:(table:string)=>new SqlRecords(connection,table)};
}

/** Native fixtures keep test setup mutations explicit and read state back from SQL. */
export async function insertRows(suite:ReturnType<typeof databaseSuite>,table:string,rows:Record<string,any>[]){
  const records=suite.records(table);for(const row of rows)Object.assign(row,await records.insert(row));return rows;
}
export async function refreshRows(suite:ReturnType<typeof databaseSuite>,table:string,rows:Record<string,any>[]){
  for(const row of rows)Object.assign(row,await suite.records(table).one(sql`id=${row._id}::uuid`));return rows;
}

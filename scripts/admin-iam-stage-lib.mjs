/** Test-only helpers pinned to the isolated Compose project, never root .env. */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import https from 'node:https';
export const req=createRequire(resolve('apps/api/package.json'));
export const stageEnv=Object.fromEntries(readFileSync('.tmp/admin-iam-phase6/stage.env','utf8').split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
export const project='vocalearn-iam-phase6',base='https://localhost:57443';
export const docker=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',maxBuffer:8*1024*1024,...options});
export const compose=(...args)=>docker(['compose','--env-file','.tmp/admin-iam-phase6/stage.env','-f','infra/admin-iam-staging/compose.json','-p',project,...args]);
export async function db(domain){const {Client}=req('pg');const conn=new Client({host:'127.0.0.1',port:57532,user:'vl_'+domain,password:stageEnv['PG_'+domain.toUpperCase()+'_PASSWORD'],database:domain+'_db'});await conn.connect();if((await conn.query('SHOW cluster_name')).rows[0].cluster_name!=='admin-iam-phase6-staging')throw Error('Refusing non-staging PostgreSQL');return conn;}
export function http(path,{method='GET',body,token}={}){return new Promise((resolve,reject)=>{const request=https.request(base+path,{method,rejectUnauthorized:false,headers:{'content-type':'application/json',Origin:base,...(token?{Authorization:'Bearer '+token}:{})}},response=>{let buffer='';response.on('data',chunk=>buffer+=chunk);response.on('end',()=>{let data;try{data=JSON.parse(buffer);}catch{data=null;}resolve({status:response.statusCode,data:data?.data??data});});});request.on('error',reject);request.setTimeout(15000,()=>request.destroy(Error('Staging HTTP timeout')));if(body)request.write(JSON.stringify(body));request.end();});}
export async function waitFor(check,label,timeout=30000){const until=Date.now()+timeout;while(Date.now()<until){const value=await check();if(value)return value;await new Promise(resolve=>setTimeout(resolve,500));}throw Error('Timeout: '+label);}
export async function mailFor(email){const list=await (await fetch('http://127.0.0.1:57825/api/v1/messages')).json();const entry=list.messages?.find(item=>item.To?.some(to=>to.Address===email));if(!entry)return null;return (await fetch('http://127.0.0.1:57825/api/v1/message/'+entry.ID)).json();}
export function tokenFromMail(mail){const link=/href="([^"]+)"/.exec(mail.HTML||mail.Text||'')?.[1]?.replaceAll('&amp;','&');return link?new URLSearchParams(new URL(link).hash.slice(1)).get('token'):null;}

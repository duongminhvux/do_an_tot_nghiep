import { BadRequestException,Injectable,NotFoundException } from '@nestjs/common';
import { InjectPgConnection,withPgTransaction,type PgConnection } from '../../../postgres/connection.js';
import { isUuid } from '../../../postgres/ids.js';
import { SqlRecords } from '../../../postgres/records.js';
import { first,literal,rowData,rows,sql,type Sql } from '../../../postgres/sql.js';
import { allContentRows,contentRows } from '../../vocabulary/content-reader.js';
import { CreateSavedWordDto } from './dto/create-saved-word.dto.js';
import { CreateVocabularyFolderDto } from './dto/create-vocabulary-folder.dto.js';
import { QuerySavedWordsDto } from './dto/query-saved-words.dto.js';
import { UpdateSavedWordNoteDto } from './dto/update-saved-word.dto.js';
import { UpdateVocabularyFolderDto } from './dto/update-vocabulary-folder.dto.js';
import { savedWordMessages as msg } from './saved-word.messages.js';
@Injectable()
export class SavedWordsService {
  constructor(@InjectPgConnection() private readonly db:PgConnection) {}
  private get folders(){return new SqlRecords(this.db,'vocabularyfolders');}
  private get saved(){return new SqlRecords(this.db,'usersavedwords');}
  private folderName(name:string){const value=name.trim();if(!value)throw new BadRequestException(msg.nameRequired);return value;}
  private folderDescription(value?:string){return value?.trim()||'';}
  private folderSlug(name:string,suffix?:string){const slug=this.folderName(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');return slug||`folder-${suffix||Date.now()}`;}
  private wordId(id:string){if(!isUuid(id))throw new BadRequestException(msg.invalidWord);return id;}
  private async validateFolder(userId:string,folderId:string,db=this.db,lock=false){
    if(!isUuid(folderId))throw new BadRequestException(msg.invalidFolder);
    const folder=await first(db,sql`SELECT id FROM public.vocabularyfolders WHERE id=${folderId}::uuid AND user_id=${userId}::uuid ${lock?literal('FOR KEY SHARE'):literal('')}`);
    if(!folder)throw new NotFoundException(msg.folderMissing);return String(folder.id);
  }
  private wordShape(word:any,search=false){
    const data:any={_id:String(word._id),word:word.word,slug:word.slug,level:word.level,ipa:word.ipa,parts:word.parts};
    if(!search)Object.assign(data,{phonetic:word.phonetic,audio:word.audio,image:word.image,isActive:word.isActive});return data;
  }
  async searchWords(userId:string,folderId:string,search?:string){
    await this.validateFolder(userId,folderId);const term=search?.trim().slice(0,100);if(!term)return [];
    const words=await contentRows(this.db,'words',{search:term,publishedOnly:true,activeOnly:true,orderBy:'word',limit:30});
    const saved=await this.saved.select(sql`user_id=${userId}::uuid AND word_id=ANY(${words.map(w=>w._id)}::uuid[])`);
    const byWord=new Map(saved.map(item=>[String(item.wordId),item]));
    return words.map(word=>({...this.wordShape(word,true),saved:byWord.has(word._id),inFolder:String(byWord.get(word._id)?.folderId)===folderId}));
  }
  async getFolders(userId:string){
    const folders=await rows(this.db,sql`SELECT f.*,(SELECT COUNT(*)::integer FROM public.usersavedwords s WHERE s.user_id=f.user_id AND s.folder_id=f.id) AS word_count
      FROM public.vocabularyfolders f WHERE f.user_id=${userId}::uuid ORDER BY f.name,f.id`);
    return folders.map(row=>({_id:row.id,name:row.name,slug:row.slug||this.folderSlug(row.name,row.id),description:row.description||'',count:Number(row.word_count),createdAt:row.created_at}));
  }
  async createFolder(userId:string,dto:CreateVocabularyFolderDto){
    try{const folder=await this.folders.insert({userId,name:this.folderName(dto.name),slug:this.folderSlug(dto.name),description:this.folderDescription(dto.description)});
      return {_id:folder._id,name:folder.name,slug:folder.slug,description:folder.description||'',count:0,createdAt:folder.createdAt};
    }catch(error:any){if(error?.code==='23505')throw new BadRequestException(msg.folderExists);throw error;}
  }
  async updateFolder(userId:string,folderId:string,dto:UpdateVocabularyFolderDto){
    if(!isUuid(folderId))throw new BadRequestException(msg.invalidFolder);
    const folder=await this.folders.patch(sql`id=${folderId}::uuid AND user_id=${userId}::uuid`,{name:this.folderName(dto.name),slug:this.folderSlug(dto.name,folderId),
      ...(dto.description!==undefined?{description:this.folderDescription(dto.description)}:{})});
    if(!folder)throw new NotFoundException(msg.folderMissing);
    return {_id:folder._id,name:folder.name,slug:folder.slug,description:folder.description||'',createdAt:folder.createdAt};
  }
  async deleteFolder(userId:string,folderId:string){
    if(!isUuid(folderId))throw new BadRequestException(msg.invalidFolder);
    return withPgTransaction(this.db,async db=>{
      const folder=await first(db,sql`DELETE FROM public.vocabularyfolders WHERE id=${folderId}::uuid AND user_id=${userId}::uuid RETURNING id`);
      if(!folder)throw new NotFoundException(msg.folderMissing);
      await rows(db,sql`UPDATE public.usersavedwords SET folder_id=NULL,payload=payload-'folderId' WHERE user_id=${userId}::uuid AND folder_id=${folderId}::uuid`);
      return {success:true,folderId};
    });
  }
  private async requireWord(wordId:string){
    this.wordId(wordId);if(!(await contentRows(this.db,'words',{ids:[wordId],publishedOnly:true,limit:1}))[0])throw new NotFoundException(msg.wordMissing);
  }
  async saveWord(userId:string,dto:CreateSavedWordDto){
    await this.requireWord(dto.wordId);
    return withPgTransaction(this.db,async db=>{
      if(dto.folderId)await this.validateFolder(userId,dto.folderId,db,true);
      const row=await first(db,sql`INSERT INTO public.usersavedwords(user_id,word_id,saved_at,note,folder_id)
        VALUES(${userId}::uuid,${dto.wordId}::uuid,now(),${dto.note??''},${dto.folderId||null}::uuid)
        ON CONFLICT(user_id,word_id) DO UPDATE SET
          note=CASE WHEN ${dto.note!==undefined} THEN EXCLUDED.note ELSE usersavedwords.note END,
          folder_id=CASE WHEN ${!!dto.folderId} THEN EXCLUDED.folder_id ELSE usersavedwords.folder_id END,
          payload=usersavedwords.payload-'note'-'folderId' RETURNING *`);return rowData(row!);
    });
  }
  async toggleSave(userId:string,wordId:string,folderId?:string){
    this.wordId(wordId);return withPgTransaction(this.db,async db=>{
      await rows(db,sql`SELECT pg_advisory_xact_lock(hashtextextended(${`saved-word:${userId}:${wordId}`},0))`);
      const removed=await rows(db,sql`DELETE FROM public.usersavedwords WHERE user_id=${userId}::uuid AND word_id=${wordId}::uuid RETURNING id`);
      if(removed.length)return {saved:false,wordId};await this.requireWord(wordId);
      if(folderId)await this.validateFolder(userId,folderId,db,true);
      const data=await new SqlRecords(db,'usersavedwords').insert({userId,wordId,savedAt:new Date(),note:'',folderId:folderId||null});return {saved:true,wordId,data};
    });
  }
  async unsaveWord(userId:string,wordId:string){this.wordId(wordId);const result=await this.saved.remove(sql`user_id=${userId}::uuid AND word_id=${wordId}::uuid`);return {success:result.length>0,wordId};}
  async updateNote(userId:string,wordId:string,dto:UpdateSavedWordNoteDto){this.wordId(wordId);
    const saved=await this.saved.patch(sql`user_id=${userId}::uuid AND word_id=${wordId}::uuid`,{note:dto.note??''});if(!saved)throw new NotFoundException(msg.notSaved);return saved;}
  async checkIsSaved(userId:string,wordId:string){if(!isUuid(wordId))return {isSaved:false};return {isSaved:await this.saved.count(sql`user_id=${userId}::uuid AND word_id=${wordId}::uuid`)>0};}
  async getAllSavedWordIds(userId:string){return (await rows(this.db,sql`SELECT word_id FROM public.usersavedwords WHERE user_id=${userId}::uuid`)).map(row=>String(row.word_id));}
  async findAll(userId:string,query:QuerySavedWordsDto){
    const page=Math.max(1,Math.floor(Number(query.page)||1)),limit=Math.min(100,Math.max(1,Math.floor(Number(query.limit)||20)));
    let where=sql`s.user_id=${userId}::uuid`;
    if(query.folderId==='unfiled')where=sql`${where} AND s.folder_id IS NULL`;
    else if(query.folderId){await this.validateFolder(userId,query.folderId);where=sql`${where} AND s.folder_id=${query.folderId}::uuid`;}
    const ids=(await rows(this.db,sql`SELECT word_id FROM public.usersavedwords s WHERE ${where}`)).map(row=>String(row.word_id));
    const words:any[]=[];
    for(let offset=0;offset<ids.length;offset+=2000)words.push(...await allContentRows(this.db,'words',{ids:ids.slice(offset,offset+2000),publishedOnly:true,
      ...(query.search?.trim()?{search:query.search.trim().slice(0,100)}:{}),...(query.level&&query.level!=='all'?{level:query.level.toUpperCase()}:{})}));
    const wordMap=new Map(words.map(word=>[word._id,word]));
    where=sql`${where} AND s.word_id=ANY(${words.map(word=>word._id)}::uuid[])`;
    const descending=query.order==='desc';let order:Sql;
    if(query.sortBy==='alpha'){
      const sorted=words.sort((a,b)=>a.word.localeCompare(b.word)).map(word=>word._id);
      order=sql`array_position(${sorted}::uuid[],s.word_id) ${descending?literal('DESC'):literal('ASC')},s.id`;
    }else order=sql`s.saved_at ${query.sortBy==='savedAt'&&query.order==='asc'?literal('ASC'):literal('DESC')},s.id`;
    const [records,count]=await Promise.all([
      rows(this.db,sql`SELECT s.*,r.status AS review_status,r.review_count,r.next_review_at FROM public.usersavedwords s
        LEFT JOIN public.userwordreviews r ON r.user_id=s.user_id AND r.word_id=s.word_id WHERE ${where}
        ORDER BY ${order} LIMIT ${limit} OFFSET ${(page-1)*limit}`),first(this.db,sql`SELECT COUNT(*)::integer AS count FROM public.usersavedwords s WHERE ${where}`),
    ]);
    const total=Number(count?.count??0);return {data:records.map(row=>({_id:row.id,savedAt:row.saved_at,note:row.note||'',word:this.wordShape(wordMap.get(row.word_id)),
      reviewStatus:row.review_status||'NOT_STUDIED',reviewCount:row.review_count||0,nextReviewAt:row.next_review_at})),pagination:{total,page,limit,totalPages:Math.ceil(total/limit)}};
  }
  async getStats(userId:string){return {total:await this.saved.count(sql`user_id=${userId}::uuid`)};}
}

import type { SqlRecords } from '../../../postgres/records.js';
import { sql } from '../../../postgres/sql.js';
export async function nextGroupOrder(exams:SqlRecords,groupId:string):Promise<number>{
 const last=await exams.one(sql`group_id=${groupId}::uuid AND is_deleted IS NOT TRUE`,sql`ORDER BY group_order DESC NULLS LAST`);
 return Number(last?.groupOrder??0)+1;
}
export const GROUP_EXAM_SORT=sql`group_order ASC NULLS FIRST,"order" ASC NULLS FIRST,created_at DESC,id ASC`;

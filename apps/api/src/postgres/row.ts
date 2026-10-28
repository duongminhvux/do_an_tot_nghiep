/** A PostgreSQL row exposed to existing API DTOs with their string `_id` key. */
export type SqlRow<T> = T & {_id:string;id:string;createdAt:Date;updatedAt:Date};

/** Unwrap Nest's response envelope without changing the shared Axios policy.
 * Raw payloads remain supported for endpoints which deliberately skip wrapping. */
export function apiPayload<T = any>(value: unknown): T {
  if(value!==null && typeof value==='object' && 'data' in value)return (value as {data:T}).data;
  return value as T;
}

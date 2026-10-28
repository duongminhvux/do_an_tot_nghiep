import { BadRequestException } from '@nestjs/common';
import type { PgConnection } from '../../postgres/connection.js';
import {
identifier,
joinSql,
sql,
SqlTable,
type Sql,
} from '../../postgres/sql.js';

export type AudioResource = 'words' | 'questions' | 'passages';
export type AudioFields = Record<string, unknown>;
type PatchNode = {
  children: Map<string, PatchNode>;
  value?: unknown;
  leaf?: boolean;
};

/** A narrow owner command; arbitrary document operators are never accepted. */
export function parseAudioFields(body: unknown): AudioFields {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Audio fields required');
  const fields = (body as { fields?: unknown }).fields;
  if (
    !fields ||
    typeof fields !== 'object' ||
    Array.isArray(fields) ||
    !Object.keys(fields).length
  )
    throw new BadRequestException('Audio fields required');
  return fields as AudioFields;
}

function jsonPatch(base: Sql, node: PatchNode): Sql {
  if (node.leaf) {
    const encoded = JSON.stringify(node.value);
    if (encoded === undefined)
      throw new BadRequestException('Audio values must be JSON');
    return sql`${encoded}::jsonb`;
  }
  const pairs: Sql[] = [];
  for (const [key, child] of node.children) {
    pairs.push(sql`${key}::text`, jsonPatch(sql`${base}->${key}::text`, child));
  }
  return sql`COALESCE(NULLIF(${base}, 'null'::jsonb), '{}'::jsonb) || jsonb_build_object(${joinSql(pairs)})`;
}

export async function updateAudio(
  connection: PgConnection,
  resource: AudioResource,
  id: string,
  fields: AudioFields,
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new BadRequestException('Invalid UUID');
  const columns: Record<string, string> =
    resource === 'words'
      ? { audio: 'audio', audioMeta: 'audio_meta' }
      : { audioUrl: 'audio_url', audioMeta: 'audio_meta' };
  const tree = new Map<string, PatchNode>();
  for (const [path, value] of Object.entries(fields)) {
    const [root, ...parts] = path.split('.');
    if (
      !columns[root] ||
      parts.length > 4 ||
      (root === 'audioUrl' && parts.length) ||
      [root, ...parts].some(
        (part) =>
          !/^[A-Za-z][A-Za-z0-9]*$/.test(part) ||
          ['__proto__', 'constructor', 'prototype'].includes(part),
      )
    )
      throw new BadRequestException(
        'Only audio metadata fields may be updated',
      );
    let node = tree.get(root);
    if (!node) {
      node = { children: new Map() };
      tree.set(root, node);
    }
    for (const part of parts) {
      if (node.leaf) throw new BadRequestException('Conflicting audio paths');
      if (!node.children.has(part))
        node.children.set(part, { children: new Map() });
      node = node.children.get(part)!;
    }
    if (node.children.size)
      throw new BadRequestException('Conflicting audio paths');
    node.leaf = true;
    node.value = value;
  }
  if (!tree.size) throw new BadRequestException('Audio fields required');
  const expressions: Record<string, Sql> = {};
  const values: Record<string, unknown> = {};
  for (const [key, node] of tree) {
    if (key === 'audioUrl') {
      if (node.value !== null && typeof node.value !== 'string')
        throw new BadRequestException('Audio URL must be text');
      values[key] = node.value;
    } else expressions[key] = jsonPatch(identifier(columns[key]), node);
  }
  const table = new SqlTable(
    connection,
    resource,
    columns,
    resource === 'words' ? ['audio', 'audioMeta'] : ['audioMeta'],
  );
  const where =
    resource === 'words'
      ? sql`id = ${id}::uuid AND is_deleted IS NOT TRUE`
      : sql`id = ${id}::uuid`;
  return table.patch(where, values, expressions);
}

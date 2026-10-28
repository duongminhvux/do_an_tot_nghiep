import type { PgConnection } from './connection.js';
import { serviceRole,tableOwner } from './ownership.js';

/** Parameters can be composed without interpolating user input into SQL. */
const SQL_FRAGMENT = Symbol('SQL_FRAGMENT');
export type Sql = {
  readonly [SQL_FRAGMENT]: true;
  text: string;
  values: any[];
};
export function sql(strings: TemplateStringsArray, ...params: unknown[]): Sql {
  const values: unknown[] = [];
  let text = strings[0];
  params.forEach((value, index) => {
    if (isSql(value)) {
      const offset = values.length;
      text += value.text.replace(
        /\$(\d+)/g,
        (_, n) => `$${Number(n) + offset}`,
      );
      values.push(...value.values);
    } else {
      values.push(value);
      text += `$${values.length}`;
    }
    text += strings[index + 1];
  });
  return { [SQL_FRAGMENT]: true, text, values };
}
function isSql(value: unknown): value is Sql {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as Sql)[SQL_FRAGMENT] === true
  );
}
/** Only use for identifiers/SQL literals owned by application code. */
export const literal = (text: string): Sql => ({
  [SQL_FRAGMENT]: true,
  text,
  values: [],
});
export function identifier(name: string): Sql {
  if (!/^[a-z_][a-z_0-9]*$/.test(name))
    throw new Error('Invalid SQL identifier');
  return literal(`"${name}"`);
}
export function joinSql(items: Sql[], separator = ', '): Sql {
  return items.reduce(
    (left, right, index) =>
      index ? sql`${left}${literal(separator)}${right}` : right,
    literal(''),
  );
}
export async function rows<T = any>(
  connection: PgConnection,
  statement: Sql,
): Promise<T[]> {
  return (await connection.query(statement.text, statement.values)).rows as T[];
}
export async function first<T = any>(
  connection: PgConnection,
  statement: Sql,
): Promise<T | null> {
  return (await rows<T>(connection, statement))[0] ?? null;
}

/** Explicit SQL columns win over old payload copies, including SQL NULL. */
export function rowData<T = any>(row: Record<string, any>): T {
  const data: Record<string, any> = { ...row.payload };
  delete data.payload;
  for (const [key, value] of Object.entries(row)) {
    if (key === 'payload') continue;
    const field =
      key === 'id'
        ? '_id'
        : key === 'password_hash'
          ? 'password'
          : key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    // The frozen Content baseline encodes these arrays in TEXT columns.
    if (
      ['variations', 'related_words'].includes(key) &&
      typeof value === 'string'
    ) {
      try {
        const parsed: unknown = JSON.parse(value);
        data[field] = Array.isArray(parsed) ? parsed : value;
      } catch {
        data[field] = value;
      }
    } else data[field] = value;
  }
  data.id = String(data._id);
  return data as T;
}

export type ColumnMap = Readonly<Record<string, string>>;

/** Small SQL write helpers. They accept field values, never document operators. */
export class SqlTable {
  constructor(
    private readonly connection: PgConnection,
    readonly table: string,
    private readonly fields: ColumnMap,
    private readonly jsonFields: readonly string[] = [],
  ) {
    identifier(table);
    Object.values(fields).forEach(identifier);
  }
  private assertOwner() {
    const role = serviceRole(),
      owner = tableOwner(this.table);
    if (role && owner && role !== owner)
      throw new Error(`Service ${role} cannot write ${owner}.${this.table}`);
  }
  private entries(input: Record<string, any>) {
    return Object.entries(input)
      .filter(([key, value]) => value !== undefined && this.fields[key])
      .map(([key, value]) => ({
        key,
        column: identifier(this.fields[key]),
        value:
          this.jsonFields.includes(key) && value !== null
            ? JSON.stringify(value)
            : value,
      }));
  }
  async insert<T = any>(input: Record<string, any>): Promise<T> {
    this.assertOwner();
    const entries = this.entries(input);
    const result = await first(
      this.connection,
      sql`INSERT INTO public.${identifier(this.table)}
      (${joinSql(entries.map((e) => e.column))}) VALUES (${joinSql(entries.map((e) => sql`${e.value}`))}) RETURNING *`,
    );
    return rowData<T>(result!);
  }
  async patch<T = any>(
    where: Sql,
    input: Record<string, any>,
    expressions: Readonly<Record<string, Sql>> = {},
  ): Promise<T | null> {
    this.assertOwner();
    const entries = this.entries(input).filter(
      (entry) => !(entry.key in expressions),
    );
    for (const [key, value] of Object.entries(expressions)) {
      if (!this.fields[key] || !isSql(value))
        throw new Error('Invalid SQL update expression');
      entries.push({ key, column: identifier(this.fields[key]), value });
    }
    if (!entries.length) {
      const result = await first(
        this.connection,
        sql`SELECT * FROM public.${identifier(this.table)} WHERE ${where} LIMIT 1`,
      );
      return result ? rowData<T>(result) : null;
    }
    // Remove stale duplicated fields from payload so older readers see the SQL values too.
    const keys = entries.map((e) => e.key);
    const result = await first(
      this.connection,
      sql`UPDATE public.${identifier(this.table)}
      SET ${joinSql(entries.map((e) => sql`${e.column} = ${e.value}`))}, payload = payload - ${keys}::text[]
      WHERE ${where} RETURNING *`,
    );
    return result ? rowData<T>(result) : null;
  }
}

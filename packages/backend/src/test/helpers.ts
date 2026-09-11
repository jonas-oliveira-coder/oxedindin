import Fastify from 'fastify';
import { validatorCompiler } from 'fastify-type-provider-zod';
import sensible from '@fastify/sensible';
import { getTableName } from 'drizzle-orm';

export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';
export const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

const BaseName = Symbol.for('drizzle:BaseName');
const Columns = Symbol.for('drizzle:Columns');

function nameOf(table: any): string {
  return (table && table[BaseName]) ?? getTableName(table);
}

function fieldKey(tableObj: any, dbName: string): string {
  const cols = tableObj && tableObj[Columns];
  if (cols && typeof cols === 'object') {
    for (const k of Object.keys(cols)) {
      if (cols[k] && cols[k].name === dbName) return k;
    }
  }
  return dbName;
}

interface Token {
  k: 'op' | 'col' | 'val';
  s?: string;
  table?: string;
  tableObj?: any;
  name?: string;
  v?: any;
}

function tokenize(chunk: any, out: Token[]): void {
  if (chunk === null || chunk === undefined) return;
  if (Array.isArray(chunk)) {
    for (const c of chunk) tokenize(c, out);
    return;
  }
  if (Array.isArray(chunk.value) && !Array.isArray(chunk.queryChunks)) {
    const s = chunk.value.join('');
    if (s !== '') out.push({ k: 'op', s });
    return;
  }
  if (Array.isArray(chunk.queryChunks)) {
    for (const c of chunk.queryChunks) tokenize(c, out);
    return;
  }
  if (typeof chunk.name === 'string' && chunk.table && typeof chunk.table !== 'string') {
    out.push({ k: 'col', table: nameOf(chunk.table), tableObj: chunk.table, name: chunk.name });
    return;
  }
  const v = chunk && typeof chunk === 'object' && 'value' in chunk ? chunk.value : chunk;
  out.push({ k: 'val', v });
}

function eqVals(a: any, b: any): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function cmp(a: any, b: any): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'bigint') a = Number(a);
  if (typeof b === 'bigint') b = Number(b);
  return a - b;
}

function parse(tokens: Token[], resolve: (t: Token) => any): boolean {
  let i = 0;
  const isOp = (s: string) => {
    const t = tokens[i];
    return !!t && t.k === 'op' && t.s!.trim() === s;
  };
  const eatOp = (s: string) => {
    if (isOp(s)) { i += 1; return true; }
    return false;
  };
  const peek = () => tokens[i];

  function parseOr(): boolean {
    let v = parseAnd();
    while (isOp('or')) { i += 1; v = parseAnd() || v; }
    return v;
  }
  function parseAnd(): boolean {
    let v = parseUnary();
    while (isOp('and')) { i += 1; v = parseUnary() && v; }
    return v;
  }
  function parseUnary(): boolean {
    if (isOp('not')) { i += 1; return !parseUnary(); }
    if (isOp('(')) { i += 1; const v = parseOr(); eatOp(')'); return v; }
    if (!peek()) return true;
    return parseComparison();
  }
  function parseComparison(): boolean {
    const left = tokens[i];
    i += 1;
    const opTok = tokens[i];
    i += 1;
    const op = opTok && opTok.k === 'op' ? opTok.s!.trim() : '';
    const leftVal = resolve(left);

    if (op === 'is null') return leftVal === null || leftVal === undefined;
    if (op === 'is not null') return leftVal !== null && leftVal !== undefined;

    const right = tokens[i];
    i += 1;
    const rightVal = right && right.k === 'col' ? resolve(right) : (right ? right.v : undefined);

    switch (op) {
      case '=': return eqVals(leftVal, rightVal);
      case '>': return cmp(leftVal, rightVal) > 0;
      case '>=': return cmp(leftVal, rightVal) >= 0;
      case '<': return cmp(leftVal, rightVal) < 0;
      case '<=': return cmp(leftVal, rightVal) <= 0;
      case 'in': {
        const vals = [rightVal];
        while (isOp(',')) {
          i += 1;
          const n = tokens[i];
          i += 1;
          vals.push(n && n.k === 'col' ? resolve(n) : (n ? n.v : undefined));
        }
        return vals.some((v) => eqVals(leftVal, v));
      }
      default:
        return true;
    }
  }
  return parseOr();
}

function evaluate(filter: any, ctx: Record<string, any>): boolean {
  if (!filter) return true;
  const tokens: Token[] = [];
  tokenize(filter, tokens);
  const resolve = (t: Token) => {
    const row = ctx[t.table!];
    const key = fieldKey(t.tableObj, t.name!);
    return row ? row[key] : undefined;
  };
  return parse(tokens, resolve);
}

function detectAggregate(sql: any): { type: 'count'; table?: string; tableObj?: any; name?: string } | { type: 'sum'; table?: string; tableObj?: any; name?: string } | null {
  if (!sql) return null;
  const tokens: Token[] = [];
  tokenize(sql, tokens);
  const first = tokens.find((t) => t.k === 'op');
  if (!first) return null;
  const s = first.s!.trim();
  if (s.startsWith('count(')) return { type: 'count' };
  if (s.startsWith('sum(')) {
    const col = tokens.find((t) => t.k === 'col');
    return { type: 'sum', table: col?.table, tableObj: col?.tableObj, name: col?.name };
  }
  return null;
}

function resolveValue(selection: any, ctx: Record<string, any>): any {
  if (selection === null || selection === undefined) return null;
  if (typeof selection.name === 'string' && selection.table && typeof selection.table !== 'string') {
    const row = ctx[nameOf(selection.table)];
    const key = fieldKey(selection.table, selection.name);
    return row ? row[key] : undefined;
  }
  if (Array.isArray(selection.queryChunks)) {
    return evaluate(selection, ctx);
  }
  if (typeof selection === 'object' && selection[BaseName] !== undefined) {
    return ctx[nameOf(selection)] ?? null;
  }
  if (typeof selection === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(selection)) {
      out[k] = resolveValue(selection[k], ctx);
    }
    return out;
  }
  return selection;
}

function isTableLike(selection: any): boolean {
  return typeof selection === 'object' && selection !== null && selection[BaseName] !== undefined;
}

class SelectBuilder {
  private table?: any;
  private whereCond?: any;
  private joins: { table: any; cond: any; type: 'left' | 'inner' }[] = [];
  private limitN?: number;
  private offsetN: number = 0;

  constructor(private db: FakeDb, private selection?: any) {}

  from(t: any) { this.table = t; return this; }
  where(f: any) { this.whereCond = f; return this; }
  leftJoin(t: any, c: any) { this.joins.push({ table: t, cond: c, type: 'left' }); return this; }
  innerJoin(t: any, c: any) { this.joins.push({ table: t, cond: c, type: 'inner' }); return this; }
  orderBy() { return this; }
  limit(n: number) { this.limitN = n; return this; }
  offset(n: number) { this.offsetN = n; return this; }

  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    try { return Promise.resolve(resolve(this.run())); }
    catch (e) { return reject ? Promise.reject(reject(e)) : Promise.reject(e); }
  }

  private matchedCtxs(): Record<string, any>[] {
    const baseName = nameOf(this.table);
    const baseRows = this.db.store.get(baseName) ?? [];
    const out: Record<string, any>[] = [];
    for (const row of baseRows) {
      const ctx: Record<string, any> = { [baseName]: row };
      let ok = true;
      for (const j of this.joins) {
        const jName = nameOf(j.table);
        const jRows = this.db.store.get(jName) ?? [];
        let match: any = null;
        for (const jr of jRows) {
          const probe: Record<string, any> = { ...ctx, [jName]: jr };
          if (evaluate(j.cond, probe)) { match = jr; break; }
        }
        if (match === null && j.type === 'inner') { ok = false; break; }
        ctx[jName] = match;
      }
      if (!ok) continue;
      if (this.whereCond && !evaluate(this.whereCond, ctx)) continue;
      out.push(ctx);
    }
    return out;
  }

  private run(): any[] {
    const matched = this.matchedCtxs();

    if (this.selection && typeof this.selection === 'object') {
      const keys = Object.keys(this.selection);
      if (keys.length === 1) {
        const key = keys[0];
        const agg = detectAggregate(this.selection[key]);
        if (agg) {
          let value: any;
          if (agg.type === 'count') {
            value = matched.length;
          } else {
            const key = fieldKey(agg.tableObj, agg.name);
            value = matched.reduce((acc, ctx) => acc + Number(ctx[agg.table!]?.[key!] ?? 0), 0);
          }
          return [{ [key]: value }];
        }
      }

      const sliced = matched.slice(this.offsetN, this.limitN !== undefined ? this.offsetN + this.limitN : undefined);
      return sliced.map((ctx) => {
        const out: Record<string, any> = {};
        for (const k of keys) {
          const sel = this.selection[k];
          if (isTableLike(sel)) out[k] = ctx[nameOf(sel)] ?? null;
          else out[k] = resolveValue(sel, ctx);
        }
        return out;
      });
    }

    const baseName = nameOf(this.table);
    const sliced = matched.slice(this.offsetN, this.limitN !== undefined ? this.offsetN + this.limitN : undefined);
    return sliced.map((ctx) => ctx[baseName]);
  }
}

class InsertBuilder {
  private valuesSet?: any;

  constructor(private db: FakeDb, private table: any) {}

  values(v: any) { this.valuesSet = v; return this; }
  returning(): any[] { return this.execute(); }
  onConflictDoNothing(): any[] { return this.execute(); }

  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    try { return Promise.resolve(resolve(this.execute())); }
    catch (e) { return reject ? Promise.reject(reject(e)) : Promise.reject(e); }
  }

  private execute(): any[] {
    const name = nameOf(this.table);
    const rows = this.db.store.get(name) ?? [];
    const values = Array.isArray(this.valuesSet) ? this.valuesSet : [this.valuesSet ?? {}];
    const created: any[] = [];
    for (const v of values) {
      const row: Record<string, any> = { ...v };
      if (row.id === undefined) row.id = crypto.randomUUID();
      const now = new Date();
      if (row.createdAt === undefined) row.createdAt = now;
      if (row.updatedAt === undefined) row.updatedAt = now;
      rows.push(row);
      created.push(row);
    }
    this.db.store.set(name, rows);
    return created;
  }
}

class UpdateBuilder {
  private setVals?: any;
  private whereCond?: any;

  constructor(private db: FakeDb, private table: any) {}

  set(v: any) { this.setVals = v; return this; }
  where(f: any) { this.whereCond = f; return this; }
  returning(): any[] { return this.execute(); }

  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    try { return Promise.resolve(resolve(this.execute())); }
    catch (e) { return reject ? Promise.reject(reject(e)) : Promise.reject(e); }
  }

  private execute(): any[] {
    const name = nameOf(this.table);
    const rows = this.db.store.get(name) ?? [];
    const updated: any[] = [];
    const next = rows.map((row) => {
      const ctx = { [name]: row };
      if (this.whereCond && !evaluate(this.whereCond, ctx)) return row;
      const merged = { ...row, ...this.setVals };
      updated.push(merged);
      return merged;
    });
    this.db.store.set(name, next);
    return updated;
  }
}

class DeleteBuilder {
  private whereCond?: any;

  constructor(private db: FakeDb, private table: any) {}

  where(f: any) { this.whereCond = f; return this; }

  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    try { return Promise.resolve(resolve(this.execute())); }
    catch (e) { return reject ? Promise.reject(reject(e)) : Promise.reject(e); }
  }

  private execute(): any[] {
    const name = nameOf(this.table);
    const rows = this.db.store.get(name) ?? [];
    const remaining = rows.filter((row) => !(this.whereCond && evaluate(this.whereCond, { [name]: row })));
    this.db.store.set(name, remaining);
    return rows.slice(remaining.length);
  }
}

class FakeDb {
  readonly store = new Map<string, any[]>();

  select(selection?: any) { return new SelectBuilder(this, selection); }
  insert(table: any) { return new InsertBuilder(this, table); }
  update(table: any) { return new UpdateBuilder(this, table); }
  delete(table: any) { return new DeleteBuilder(this, table); }
  async execute() { return [] as any[]; }

  all(table: any): any[] { return this.store.get(nameOf(table)) ?? []; }
  seed(table: any, rows: Record<string, any>[]) {
    const name = nameOf(table);
    const existing = this.store.get(name) ?? [];
    this.store.set(name, [...existing, ...rows.map((r) => ({ ...r }))]);
  }
  clear(table: any) { this.store.set(nameOf(table), []); }
}

export function createTestDb(): FakeDb {
  return new FakeDb();
}

export async function buildApp(routes: any, prefix: string) {
  const app = Fastify();
  (app as any).setValidatorCompiler(validatorCompiler as any);
  await app.register(sensible);

  const db = createTestDb();
  const state = { userId: TEST_USER_ID };

  app.decorate('db', db);
  app.decorate('auditLog', async () => {});
  app.decorate('authenticate', async (request: any) => {
    request.authUser = {
      id: state.userId,
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: false,
      twoFactorEnabled: false,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });
  app.decorate('broadcast', () => {});
  app.decorate('broadcastToAll', () => {});
  app.decorate('wsClients', new Map());
  app.decorate('config', { env: { NODE_ENV: 'test' } });

  await app.register(routes, { prefix });

  return {
    app,
    db,
    setUser: (id: string) => { state.userId = id; },
  };
}

export function uuid(): string {
  return crypto.randomUUID();
}
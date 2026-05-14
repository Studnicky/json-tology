/**
 * Browser-runnable benchmark scenario registry.
 *
 * Each scenario id matches a `### <name>` heading in
 * examples/docs/benchmarks/results/latest.md. For every scenario, every
 * comparator library that can run it has a factory that returns a closure
 * to time.
 *
 * json-tology is bundled directly from the local source (Vite alias in
 * docs/.vitepress/config.ts) so the page measures HEAD, not whatever
 * version happens to be on esm.sh. Peer libraries load from their esm.sh
 * CDN entries on demand so they don't bloat the docs bundle.
 */

import * as JsonTologyModule from 'json-tology';

export type LibKey =
  | 'json-tology'
  | 'zod'
  | 'valibot'
  | 'typebox'
  | 'typebox-compiled'
  | 'ajv'
  | 'arktype'
  | 'runtypes'
  | 'io-ts'
  | 'yup'
  | 'joi'
  | 'json-stringify'
  | 'structured-clone'
  | 'manual';

export interface LibSpec {
  readonly key: LibKey;
  readonly label: string;
  readonly url?: string;
  readonly extras?: readonly string[];
}

export const LIB_SPECS: readonly LibSpec[] = [
  { key: 'json-tology',      label: 'json-tology (HEAD)' },
  { key: 'zod',              label: 'Zod',                 url: 'https://esm.sh/zod@3' },
  { key: 'valibot',          label: 'Valibot',             url: 'https://esm.sh/valibot@1' },
  { key: 'typebox',          label: 'TypeBox (Value)',     url: 'https://esm.sh/@sinclair/typebox@0.34', extras: ['https://esm.sh/@sinclair/typebox@0.34/value'] },
  { key: 'typebox-compiled', label: 'TypeBox (compiled)',  url: 'https://esm.sh/@sinclair/typebox@0.34', extras: ['https://esm.sh/@sinclair/typebox@0.34/compiler'] },
  { key: 'ajv',              label: 'AJV',                 url: 'https://esm.sh/ajv@8',                  extras: ['https://esm.sh/ajv-formats@3'] },
  { key: 'arktype',          label: 'ArkType',             url: 'https://esm.sh/arktype@2' },
  { key: 'runtypes',         label: 'Runtypes',            url: 'https://esm.sh/runtypes@7' },
  { key: 'io-ts',            label: 'io-ts',               url: 'https://esm.sh/io-ts@2' },
  { key: 'yup',              label: 'Yup',                 url: 'https://esm.sh/yup@1' },
  { key: 'joi',              label: 'Joi',                 url: 'https://esm.sh/joi@17' },
  { key: 'json-stringify',   label: 'JSON.stringify' },
  { key: 'structured-clone', label: 'structuredClone' },
  { key: 'manual',           label: 'Manual (handwritten)' },
];

const moduleCache = new Map<string, unknown>();
async function importOnce<T = unknown>(url: string): Promise<T> {
  if (!moduleCache.has(url)) {
    moduleCache.set(url, await import(/* @vite-ignore */ url));
  }
  return moduleCache.get(url) as T;
}

async function loadLib(key: LibKey): Promise<{ main: unknown; extras: unknown[] }> {
  if (key === 'json-tology') {
    return { main: JsonTologyModule, extras: [] };
  }
  const spec = LIB_SPECS.find(s => s.key === key);
  if (!spec || !spec.url) return { main: null, extras: [] };
  const main = await importOnce(spec.url);
  const extras = await Promise.all((spec.extras ?? []).map(u => importOnce(u)));
  return { main, extras };
}

// ----------------------------------------------------------------------------
// Sample data + schema fixtures (mirror examples/docs/benchmarks/fixtures.ts)
// ----------------------------------------------------------------------------

const FLAT_VALID = Object.freeze({
  id: '6c8b3c1e-0c4d-4d3e-a1f2-1234567890ab',
  email: 'alice@bookstore.example',
  name: 'Alice Chen',
});
const FLAT_INVALID = Object.freeze({ id: 'not-a-uuid', email: 'bad', name: 42 as unknown });
const NESTED_VALID = Object.freeze({
  customer: { ...FLAT_VALID },
  address: { street: '123 Main', city: 'Springfield', zip: '12345' },
  amount: 99.95,
});
const NESTED_FOR_DUMP = Object.freeze({
  customer: { ...FLAT_VALID },
  items: [
    { sku: 'A', qty: 2, price: 9.99 },
    { sku: 'B', qty: 1, price: 19.99 },
  ],
  total: 39.97,
});

const JT_FLAT_SCHEMA = {
  $id: 'urn:bench:Flat',
  type: 'object',
  properties: {
    id:    { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name:  { type: 'string' },
  },
  required: ['id', 'email', 'name'],
} as const;

const JT_NESTED_SCHEMA = {
  $id: 'urn:bench:Nested',
  type: 'object',
  properties: {
    customer: { $ref: 'urn:bench:Flat' },
    address: {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city:   { type: 'string' },
        zip:    { type: 'string' },
      },
      required: ['street', 'city', 'zip'],
    },
    amount: { type: 'number', minimum: 0 },
  },
  required: ['customer', 'address', 'amount'],
} as const;

const JT_COERCE_SCHEMA = {
  $id: 'urn:bench:Coerce',
  type: 'object',
  properties: {
    n:   { type: 'number' },
    ok:  { type: 'boolean' },
    tag: { type: 'string', default: 'x' },
  },
  required: ['n', 'ok'],
} as const;

const COERCE_INPUT = Object.freeze({ n: '42', ok: 'true' });
const DEFAULTS_INPUT = Object.freeze({ n: 1, ok: true });

// ----------------------------------------------------------------------------
// Per-library setup helpers, scoped by scenario
// ----------------------------------------------------------------------------

type Setup = () => Promise<() => void>;
type LibFactories = Partial<Record<LibKey, Setup | null>>;

interface Scenario {
  readonly id: string;
  readonly family: string;
  readonly name: string;
  readonly description: string;
  readonly factories: LibFactories;
}

function jtFlatSetup(data: unknown): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { validate: (id: string, d: unknown) => unknown } } };
    const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', schemas: [JT_FLAT_SCHEMA] });
    return () => { void jt.validate(JT_FLAT_SCHEMA.$id, data); };
  };
}

function jtNestedSetup(data: unknown): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { validate: (id: string, d: unknown) => unknown } } };
    const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', schemas: [JT_FLAT_SCHEMA, JT_NESTED_SCHEMA] });
    return () => { void jt.validate(JT_NESTED_SCHEMA.$id, data); };
  };
}

function zodFlatValidate(data: unknown): Setup {
  return async () => {
    const z = (await loadLib('zod')).main as typeof import('zod');
    const Customer = z.z.object({ id: z.z.string().uuid(), email: z.z.string().email(), name: z.z.string() });
    return () => { void Customer.safeParse(data); };
  };
}

function zodNestedValidate(data: unknown): Setup {
  return async () => {
    const z = (await loadLib('zod')).main as typeof import('zod');
    const Customer = z.z.object({ id: z.z.string().uuid(), email: z.z.string().email(), name: z.z.string() });
    const Nested = z.z.object({
      customer: Customer,
      address: z.z.object({ street: z.z.string(), city: z.z.string(), zip: z.z.string() }),
      amount: z.z.number().nonnegative(),
    });
    return () => { void Nested.safeParse(data); };
  };
}

function valibotFlatValidate(data: unknown): Setup {
  return async () => {
    const v = (await loadLib('valibot')).main as Record<string, (...a: unknown[]) => unknown>;
    const Customer = (v.object as (s: unknown) => unknown)({
      id:    (v.pipe as (...a: unknown[]) => unknown)(v.string(), (v.uuid as (...a: unknown[]) => unknown)()),
      email: (v.pipe as (...a: unknown[]) => unknown)(v.string(), (v.email as (...a: unknown[]) => unknown)()),
      name:  v.string(),
    });
    const safeParse = v.safeParse as (s: unknown, d: unknown) => unknown;
    return () => { void safeParse(Customer, data); };
  };
}

function valibotNestedValidate(data: unknown): Setup {
  return async () => {
    const v = (await loadLib('valibot')).main as Record<string, (...a: unknown[]) => unknown>;
    const object = v.object as (s: unknown) => unknown;
    const string = v.string as () => unknown;
    const number = v.number as () => unknown;
    const Customer = object({ id: string(), email: string(), name: string() });
    const Nested = object({
      customer: Customer,
      address: object({ street: string(), city: string(), zip: string() }),
      amount: number(),
    });
    const safeParse = v.safeParse as (s: unknown, d: unknown) => unknown;
    return () => { void safeParse(Nested, data); };
  };
}

function typeboxFlatCompiled(data: unknown): Setup {
  return async () => {
    const tb = (await loadLib('typebox-compiled')).main as { Type: { Object: (s: unknown) => unknown; String: (a?: unknown) => unknown } };
    const compiler = (await importOnce('https://esm.sh/@sinclair/typebox@0.34/compiler')) as { TypeCompiler: { Compile: (s: unknown) => { Check: (d: unknown) => boolean } } };
    const Customer = tb.Type.Object({ id: tb.Type.String({ format: 'uuid' }), email: tb.Type.String({ format: 'email' }), name: tb.Type.String() });
    const C = compiler.TypeCompiler.Compile(Customer);
    return () => { void C.Check(data); };
  };
}

function typeboxNestedCompiled(data: unknown): Setup {
  return async () => {
    const tb = (await loadLib('typebox-compiled')).main as { Type: { Object: (s: unknown) => unknown; String: (a?: unknown) => unknown; Number: () => unknown } };
    const compiler = (await importOnce('https://esm.sh/@sinclair/typebox@0.34/compiler')) as { TypeCompiler: { Compile: (s: unknown) => { Check: (d: unknown) => boolean } } };
    const Customer = tb.Type.Object({ id: tb.Type.String(), email: tb.Type.String(), name: tb.Type.String() });
    const Nested = tb.Type.Object({
      customer: Customer,
      address: tb.Type.Object({ street: tb.Type.String(), city: tb.Type.String(), zip: tb.Type.String() }),
      amount: tb.Type.Number(),
    });
    const C = compiler.TypeCompiler.Compile(Nested);
    return () => { void C.Check(data); };
  };
}

function ajvFlatValidate(data: unknown): Setup {
  return async () => {
    const mod = (await loadLib('ajv')).main as { default?: new () => unknown };
    const Ajv = (mod.default ?? mod) as new () => { addFormat: (n: string, r: RegExp) => void; compile: (s: unknown) => (d: unknown) => boolean };
    const ajv = new Ajv();
    ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    ajv.addFormat('email', /^[^@]+@[^@]+$/);
    const validate = ajv.compile(JT_FLAT_SCHEMA);
    return () => { void validate(data); };
  };
}

function ajvNestedValidate(data: unknown): Setup {
  return async () => {
    const mod = (await loadLib('ajv')).main as { default?: new () => unknown };
    const Ajv = (mod.default ?? mod) as new () => { addFormat: (n: string, r: RegExp) => void; addSchema: (s: unknown) => void; getSchema: (id: string) => ((d: unknown) => boolean) | undefined };
    const ajv = new Ajv();
    ajv.addFormat('uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    ajv.addFormat('email', /^[^@]+@[^@]+$/);
    ajv.addSchema(JT_FLAT_SCHEMA);
    ajv.addSchema(JT_NESTED_SCHEMA);
    const validate = ajv.getSchema(JT_NESTED_SCHEMA.$id)!;
    return () => { void validate(data); };
  };
}

function arktypeFlat(data: unknown): Setup {
  return async () => {
    const ark = (await loadLib('arktype')).main as { type: (s: unknown) => (d: unknown) => unknown };
    const Customer = ark.type({ id: 'string.uuid', email: 'string.email', name: 'string' });
    return () => { void Customer(data); };
  };
}

function arktypeNested(data: unknown): Setup {
  return async () => {
    const ark = (await loadLib('arktype')).main as { type: (s: unknown) => (d: unknown) => unknown };
    const Nested = ark.type({
      customer: { id: 'string', email: 'string', name: 'string' },
      address: { street: 'string', city: 'string', zip: 'string' },
      amount: 'number >= 0',
    });
    return () => { void Nested(data); };
  };
}

function iotsFlat(data: unknown): Setup {
  return async () => {
    const t = (await loadLib('io-ts')).main as { type: (s: unknown) => { decode: (d: unknown) => unknown }; string: unknown };
    const Customer = t.type({ id: t.string, email: t.string, name: t.string });
    return () => { void Customer.decode(data); };
  };
}

function iotsNested(data: unknown): Setup {
  return async () => {
    const t = (await loadLib('io-ts')).main as { type: (s: unknown) => { decode: (d: unknown) => unknown }; string: unknown; number: unknown };
    const Nested = t.type({
      customer: t.type({ id: t.string, email: t.string, name: t.string }),
      address: t.type({ street: t.string, city: t.string, zip: t.string }),
      amount: t.number,
    });
    return () => { void Nested.decode(data); };
  };
}

// ----------------------------------------------------------------------------
// json-tology coerce / instantiate / clean / convert / dump
// ----------------------------------------------------------------------------

function jtCoerceValid(): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { instantiate: (id: string, d: unknown) => unknown } } };
    const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', enableTypeCast: true, schemas: [JT_COERCE_SCHEMA] });
    return () => { void jt.instantiate(JT_COERCE_SCHEMA.$id, COERCE_INPUT); };
  };
}

function jtCoerceDefaults(): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { instantiate: (id: string, d: unknown) => unknown } } };
    const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', enableTypeCast: true, schemas: [JT_COERCE_SCHEMA] });
    return () => { void jt.instantiate(JT_COERCE_SCHEMA.$id, DEFAULTS_INPUT); };
  };
}

function jtClean(data: unknown, primary: { readonly $id: string }, schemas: readonly unknown[]): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { registry: { clean: (id: string, d: unknown) => unknown } } } };
    const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', schemas });
    return () => { void jt.registry.clean(primary.$id, data); };
  };
}

// ----------------------------------------------------------------------------
// Strip-unknown-keys ("clean") — how each library would achieve the same.
// Some libraries have a direct API; others require the call site to opt into
// strict-object construction so the parser drops unknown keys.
// ----------------------------------------------------------------------------

function zodClean(data: unknown, build: (z: typeof import('zod')) => { parse: (d: unknown) => unknown }): Setup {
  return async () => {
    const z = (await loadLib('zod')).main as typeof import('zod');
    const Customer = build(z);
    return () => { void Customer.parse(data); };
  };
}

function valibotClean(data: unknown, build: (v: Record<string, (...a: unknown[]) => unknown>) => unknown): Setup {
  return async () => {
    const v = (await loadLib('valibot')).main as Record<string, (...a: unknown[]) => unknown>;
    const schema = build(v);
    const parse = v.parse as (s: unknown, d: unknown) => unknown;
    return () => { void parse(schema, data); };
  };
}

function typeboxClean(data: unknown, build: (Type: { Object: (s: unknown) => unknown; String: (a?: unknown) => unknown; Number: () => unknown }) => unknown): Setup {
  return async () => {
    const tb = (await loadLib('typebox')).main as { Type: { Object: (s: unknown) => unknown; String: (a?: unknown) => unknown; Number: () => unknown } };
    const value = await importOnce<{ Value: { Clean: (s: unknown, d: unknown) => unknown } }>('https://esm.sh/@sinclair/typebox@0.34/value');
    const schema = build(tb.Type);
    return () => { void value.Value.Clean(schema, data); };
  };
}

function yupClean(data: unknown, build: (yup: typeof import('yup')) => { cast: (d: unknown, opts: unknown) => unknown }): Setup {
  return async () => {
    const yup = (await importOnce('https://esm.sh/yup@1')) as typeof import('yup');
    const Customer = build(yup);
    return () => { void Customer.cast(data, { stripUnknown: true }); };
  };
}

function joiClean(data: unknown, build: (Joi: { object: (s: unknown) => { unknown: (b: boolean) => unknown } } & Record<string, (...a: unknown[]) => unknown>) => { validate: (d: unknown, opts: unknown) => unknown }): Setup {
  return async () => {
    const joiMod = (await importOnce('https://esm.sh/joi@17')) as { default?: unknown };
    const Joi = (joiMod.default ?? joiMod) as { object: (s: unknown) => { unknown: (b: boolean) => unknown } } & Record<string, (...a: unknown[]) => unknown>;
    const Customer = build(Joi);
    return () => { void Customer.validate(data, { stripUnknown: true }); };
  };
}

// JSON-round-trip clone: universal fallback every JS user has access to.
function jsonRoundTripClone(data: unknown): Setup {
  return async () => () => { void JSON.parse(JSON.stringify(data)); };
}

// Manual structural diff — what a user would write if their library has no
// diff primitive. Walks two objects and records changed/added/removed keys.
function manualDiff(): Setup {
  const before = { ...NESTED_VALID, amount: 100 };
  const after = { ...NESTED_VALID, amount: 100, customer: { ...NESTED_VALID.customer, name: 'Renamed' } };
  return async () => () => {
    const diff: Array<{ path: string; kind: 'add' | 'remove' | 'change'; from?: unknown; to?: unknown }> = [];
    const walk = (a: Record<string, unknown>, b: Record<string, unknown>, base: string): void => {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) {
        const av = a[k];
        const bv = b[k];
        const p = base ? `${base}/${k}` : `/${k}`;
        if (!(k in a)) diff.push({ path: p, kind: 'add', to: bv });
        else if (!(k in b)) diff.push({ path: p, kind: 'remove', from: av });
        else if (av !== bv) {
          if (av && bv && typeof av === 'object' && typeof bv === 'object'
              && !Array.isArray(av) && !Array.isArray(bv)) {
            walk(av as Record<string, unknown>, bv as Record<string, unknown>, p);
          } else if (JSON.stringify(av) !== JSON.stringify(bv)) {
            diff.push({ path: p, kind: 'change', from: av, to: bv });
          }
        }
      }
    };
    walk(before as Record<string, unknown>, after as Record<string, unknown>, '');
    void diff;
  };
}

// Coerce-equivalent factories for libraries with a real coerce mode.
function zodCoerceValid(data: unknown): Setup {
  return async () => {
    const z = (await loadLib('zod')).main as typeof import('zod');
    const C = z.z.object({ n: z.z.coerce.number(), ok: z.z.coerce.boolean(), tag: z.z.string().default('x') });
    return () => { void C.parse(data); };
  };
}

function valibotCoerceValid(data: unknown): Setup {
  return async () => {
    const v = (await loadLib('valibot')).main as Record<string, (...a: unknown[]) => unknown>;
    const object = v.object as (s: unknown) => unknown;
    const string = v.string as () => unknown;
    const number = v.number as () => unknown;
    const boolean = v.boolean as () => unknown;
    const pipe = v.pipe as (...a: unknown[]) => unknown;
    const transform = v.transform as (fn: (x: unknown) => unknown) => unknown;
    const optional = v.optional as (s: unknown, d: unknown) => unknown;
    const schema = object({
      n:   pipe(string(), transform((x) => Number(x))),
      ok:  pipe(string(), transform((x) => x === 'true')),
      tag: optional(string(), 'x'),
    });
    const parse = v.parse as (s: unknown, d: unknown) => unknown;
    return () => { void parse(schema, data); };
  };
}

function yupCoerceValid(data: unknown): Setup {
  return async () => {
    const yup = (await importOnce('https://esm.sh/yup@1')) as typeof import('yup');
    const Schema = yup.object({
      n:   yup.number(),
      ok:  yup.boolean(),
      tag: yup.string().default('x'),
    });
    return () => { void Schema.cast(data); };
  };
}

function joiCoerceValid(data: unknown): Setup {
  return async () => {
    const joiMod = (await importOnce('https://esm.sh/joi@17')) as { default?: unknown };
    const Joi = (joiMod.default ?? joiMod) as {
      object: (s: unknown) => { validate: (d: unknown, opts: unknown) => unknown };
      number: () => unknown;
      boolean: () => unknown;
      string: () => { default: (v: string) => unknown };
    };
    const Schema = Joi.object({
      n:   Joi.number(),
      ok:  Joi.boolean(),
      tag: Joi.string().default('x'),
    });
    return () => { void Schema.validate(data, { convert: true }); };
  };
}

function jtConvert(data: unknown): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { registry: { convert: (id: string, d: unknown) => unknown } } } };
    const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', enableTypeCast: true, schemas: [JT_COERCE_SCHEMA] });
    return () => { void jt.registry.convert(JT_COERCE_SCHEMA.$id, data); };
  };
}

function jtClone(data: unknown): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { Value: { clone: (d: unknown) => unknown } };
    return () => { void mod.Value.clone(data); };
  };
}

function jtDiff(): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { Value: { diff: (a: unknown, b: unknown) => unknown } };
    const before = { ...NESTED_VALID, amount: 100 };
    const after = { ...NESTED_VALID, amount: 100, customer: { ...NESTED_VALID.customer, name: 'Renamed' } };
    return () => { void mod.Value.diff(before, after); };
  };
}

function jtDump(): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { dump: (s: unknown, v: unknown) => unknown } } };
    const schema = {
      $id: 'urn:bench:Order',
      type: 'object',
      properties: {
        customer: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' } } },
        items: { type: 'array', items: { type: 'object', properties: { sku: { type: 'string' }, qty: { type: 'number' }, price: { type: 'number' } } } },
        total: { type: 'number' },
      },
    } as const;
    const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', schemas: [schema] });
    return () => { void jt.dump(schema, NESTED_FOR_DUMP); };
  };
}

function jtDumpJson(): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { dumpJson: (s: unknown, v: unknown) => string } } };
    const schema = {
      $id: 'urn:bench:Order',
      type: 'object',
      properties: {
        customer: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' } } },
        items: { type: 'array', items: { type: 'object', properties: { sku: { type: 'string' }, qty: { type: 'number' }, price: { type: 'number' } } } },
        total: { type: 'number' },
      },
    } as const;
    const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', schemas: [schema] });
    return () => { void jt.dumpJson(schema, NESTED_FOR_DUMP); };
  };
}

function jsonStringify(data: unknown): Setup {
  return async () => () => { void JSON.stringify(data); };
}

function structuredCloneSetup(data: unknown): Setup {
  return async () => () => { void structuredClone(data); };
}

// ----------------------------------------------------------------------------
// Scenario registry
// ----------------------------------------------------------------------------

export const SCENARIOS: Scenario[] = [
  // -- Validation --
  {
    id: 'simple-valid',
    family: 'Validation',
    name: 'simple valid',
    description: 'Flat 3-property object that satisfies the schema.',
    factories: {
      'json-tology': jtFlatSetup(FLAT_VALID),
      'zod': zodFlatValidate(FLAT_VALID),
      'valibot': valibotFlatValidate(FLAT_VALID),
      'typebox-compiled': typeboxFlatCompiled(FLAT_VALID),
      'ajv': ajvFlatValidate(FLAT_VALID),
      'arktype': arktypeFlat(FLAT_VALID),
      'io-ts': iotsFlat(FLAT_VALID),
    },
  },
  {
    id: 'simple-invalid',
    family: 'Validation',
    name: 'simple invalid',
    description: 'Flat 3-property object that fails every constraint.',
    factories: {
      'json-tology': jtFlatSetup(FLAT_INVALID),
      'zod': zodFlatValidate(FLAT_INVALID),
      'valibot': valibotFlatValidate(FLAT_INVALID),
      'typebox-compiled': typeboxFlatCompiled(FLAT_INVALID),
      'ajv': ajvFlatValidate(FLAT_INVALID),
      'arktype': arktypeFlat(FLAT_INVALID),
      'io-ts': iotsFlat(FLAT_INVALID),
    },
  },
  {
    id: 'nested-valid',
    family: 'Validation',
    name: 'nested valid',
    description: 'Nested object with sub-objects and refs.',
    factories: {
      'json-tology': jtNestedSetup(NESTED_VALID),
      'zod': zodNestedValidate(NESTED_VALID),
      'valibot': valibotNestedValidate(NESTED_VALID),
      'typebox-compiled': typeboxNestedCompiled(NESTED_VALID),
      'ajv': ajvNestedValidate(NESTED_VALID),
      'arktype': arktypeNested(NESTED_VALID),
      'io-ts': iotsNested(NESTED_VALID),
    },
  },

  // -- Instantiation (no coercion) --
  {
    id: 'instantiate-simple',
    family: 'Instantiation',
    name: 'instantiate simple',
    description: 'Parse + normalize a flat object; no coercion.',
    factories: {
      'json-tology': async () => {
        const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { instantiate: (id: string, d: unknown) => unknown } } };
        const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', schemas: [JT_FLAT_SCHEMA] });
        return () => { void jt.instantiate(JT_FLAT_SCHEMA.$id, FLAT_VALID); };
      },
      'zod': async () => {
        const z = (await loadLib('zod')).main as typeof import('zod');
        const Customer = z.z.object({ id: z.z.string(), email: z.z.string(), name: z.z.string() });
        return () => { void Customer.parse(FLAT_VALID); };
      },
      'valibot': async () => {
        const v = (await loadLib('valibot')).main as Record<string, (...a: unknown[]) => unknown>;
        const Customer = (v.object as (s: unknown) => unknown)({ id: v.string(), email: v.string(), name: v.string() });
        const parse = v.parse as (s: unknown, d: unknown) => unknown;
        return () => { void parse(Customer, FLAT_VALID); };
      },
      'typebox-compiled': typeboxFlatCompiled(FLAT_VALID),
      'arktype': arktypeFlat(FLAT_VALID),
      'io-ts': iotsFlat(FLAT_VALID),
    },
  },
  {
    id: 'instantiate-nested',
    family: 'Instantiation',
    name: 'instantiate nested',
    description: 'Parse + normalize a nested object.',
    factories: {
      'json-tology': async () => {
        const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { instantiate: (id: string, d: unknown) => unknown } } };
        const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', schemas: [JT_FLAT_SCHEMA, JT_NESTED_SCHEMA] });
        return () => { void jt.instantiate(JT_NESTED_SCHEMA.$id, NESTED_VALID); };
      },
      'zod': zodNestedValidate(NESTED_VALID),
      'valibot': valibotNestedValidate(NESTED_VALID),
      'typebox-compiled': typeboxNestedCompiled(NESTED_VALID),
      'arktype': arktypeNested(NESTED_VALID),
      'io-ts': iotsNested(NESTED_VALID),
    },
  },

  // -- Coerce --
  {
    id: 'coerce-valid',
    family: 'Coerce',
    name: 'coerce valid',
    description: 'Already-valid data through the coerce path.',
    factories: {
      'json-tology': jtCoerceValid(),
      'zod': zodCoerceValid(COERCE_INPUT),
      'valibot': valibotCoerceValid(COERCE_INPUT),
      // Yup .cast() applies type coercion the same way zod.coerce does.
      // Joi has `convert: true` enabled by default — equivalent surface.
      'arktype': async () => {
        // ArkType has no built-in coerce; the user wraps the input. This is
        // how someone using ArkType would normalize a query-string payload.
        const ark = (await loadLib('arktype')).main as { type: (s: unknown) => (d: unknown) => unknown };
        const Schema = ark.type({ n: 'number', ok: 'boolean', 'tag?': 'string' });
        return () => {
          const coerced = { n: Number(COERCE_INPUT.n), ok: COERCE_INPUT.ok === 'true' };
          void Schema(coerced);
        };
      },
    },
  },
  {
    id: 'coerce-defaults',
    family: 'Coerce',
    name: 'coerce defaults',
    description: 'Apply default values during instantiate.',
    factories: {
      'json-tology': jtCoerceDefaults(),
      'zod': async () => {
        const z = (await loadLib('zod')).main as typeof import('zod');
        const C = z.z.object({ n: z.z.number(), ok: z.z.boolean(), tag: z.z.string().default('x') });
        return () => { void C.parse(DEFAULTS_INPUT); };
      },
      'valibot': async () => {
        const v = (await loadLib('valibot')).main as Record<string, (...a: unknown[]) => unknown>;
        const object = v.object as (s: unknown) => unknown;
        const string = v.string as () => unknown;
        const number = v.number as () => unknown;
        const boolean = v.boolean as () => unknown;
        const optional = v.optional as (s: unknown, d: unknown) => unknown;
        const schema = object({ n: number(), ok: boolean(), tag: optional(string(), 'x') });
        const parse = v.parse as (s: unknown, d: unknown) => unknown;
        return () => { void parse(schema, DEFAULTS_INPUT); };
      },
      'yup': yupCoerceValid(DEFAULTS_INPUT),
      'joi': joiCoerceValid(DEFAULTS_INPUT),
    },
  },

  // -- Value operations --
  {
    id: 'clean-simple',
    family: 'Value operations',
    name: 'clean simple',
    description: 'Strip unknown keys from a flat object.',
    factories: {
      'json-tology': jtClean({ ...FLAT_VALID, extra: 1, more: 'no' }, JT_FLAT_SCHEMA, [JT_FLAT_SCHEMA]),
      // Zod z.object() strips unknown keys by default on .parse(); explicit
      // .strip() makes the intent visible.
      'zod': zodClean({ ...FLAT_VALID, extra: 1, more: 'no' }, (z) => {
        return z.z.object({ id: z.z.string(), email: z.z.string(), name: z.z.string() }).strip();
      }),
      // Valibot's object() schema drops unknown keys on parse(); use
      // `strictObject` to error instead. The default is the strip behavior.
      'valibot': valibotClean({ ...FLAT_VALID, extra: 1, more: 'no' }, (v) => {
        const object = v.object as (s: unknown) => unknown;
        const string = v.string as () => unknown;
        return object({ id: string(), email: string(), name: string() });
      }),
      // TypeBox: Value.Clean is the explicit strip-unknown operation.
      'typebox': typeboxClean({ ...FLAT_VALID, extra: 1, more: 'no' }, (Type) => {
        return Type.Object({ id: Type.String(), email: Type.String(), name: Type.String() });
      }),
      // Yup has .noUnknown() to declare the intent and stripUnknown to enforce.
      'yup': yupClean({ ...FLAT_VALID, extra: 1, more: 'no' }, (yup) => {
        return yup.object({ id: yup.string(), email: yup.string(), name: yup.string() }).noUnknown();
      }),
      // Joi defaults to .unknown(false) — pair with stripUnknown to drop.
      'joi': joiClean({ ...FLAT_VALID, extra: 1, more: 'no' }, (Joi) => {
        return Joi.object({ id: Joi.string(), email: Joi.string(), name: Joi.string() });
      }),
    },
  },
  {
    id: 'clean-nested',
    family: 'Value operations',
    name: 'clean nested',
    description: 'Strip unknown keys from a nested object.',
    factories: {
      'json-tology': jtClean({ ...NESTED_VALID, extra: 1 }, JT_NESTED_SCHEMA, [JT_FLAT_SCHEMA, JT_NESTED_SCHEMA]),
      'zod': zodClean({ ...NESTED_VALID, extra: 1 }, (z) => {
        const Customer = z.z.object({ id: z.z.string(), email: z.z.string(), name: z.z.string() });
        const Address = z.z.object({ street: z.z.string(), city: z.z.string(), zip: z.z.string() });
        return z.z.object({ customer: Customer, address: Address, amount: z.z.number() }).strip();
      }),
      'valibot': valibotClean({ ...NESTED_VALID, extra: 1 }, (v) => {
        const object = v.object as (s: unknown) => unknown;
        const string = v.string as () => unknown;
        const number = v.number as () => unknown;
        const Customer = object({ id: string(), email: string(), name: string() });
        const Address = object({ street: string(), city: string(), zip: string() });
        return object({ customer: Customer, address: Address, amount: number() });
      }),
      'typebox': typeboxClean({ ...NESTED_VALID, extra: 1 }, (Type) => {
        return Type.Object({
          customer: Type.Object({ id: Type.String(), email: Type.String(), name: Type.String() }),
          address: Type.Object({ street: Type.String(), city: Type.String(), zip: Type.String() }),
          amount: Type.Number(),
        });
      }),
      'yup': yupClean({ ...NESTED_VALID, extra: 1 }, (yup) => {
        const Customer = yup.object({ id: yup.string(), email: yup.string(), name: yup.string() });
        const Address = yup.object({ street: yup.string(), city: yup.string(), zip: yup.string() });
        return yup.object({ customer: Customer, address: Address, amount: yup.number() }).noUnknown();
      }),
      'joi': joiClean({ ...NESTED_VALID, extra: 1 }, (Joi) => {
        const Customer = Joi.object({ id: Joi.string(), email: Joi.string(), name: Joi.string() });
        const Address = Joi.object({ street: Joi.string(), city: Joi.string(), zip: Joi.string() });
        return Joi.object({ customer: Customer, address: Address, amount: Joi.number() });
      }),
    },
  },
  {
    id: 'convert-simple',
    family: 'Value operations',
    name: 'convert simple',
    description: 'String → number / boolean coercion only.',
    factories: {
      'json-tology': jtConvert(COERCE_INPUT),
      // What every user resorts to in a library without a coerce primitive:
      // explicit per-field `Number(x)` / `x === 'true'`.
      'manual': async () => () => {
        void { n: Number(COERCE_INPUT.n), ok: COERCE_INPUT.ok === 'true' };
      },
    },
  },
  {
    id: 'clone-nested',
    family: 'Value operations',
    name: 'clone nested',
    description: 'Deep-clone a nested object.',
    factories: {
      'json-tology': jtClone(NESTED_VALID),
      'structured-clone': structuredCloneSetup(NESTED_VALID),
      // The pre-structuredClone idiom every JS user has reached for.
      'json-stringify': jsonRoundTripClone(NESTED_VALID),
    },
  },
  {
    id: 'diff-nested',
    family: 'Value operations',
    name: 'diff nested',
    description: 'Compute a changeset between two nested objects.',
    factories: {
      'json-tology': jtDiff(),
      // What a user writes when the library has no diff primitive — a hand-rolled
      // recursive walk that records add/remove/change per JSON Pointer path.
      'manual': manualDiff(),
    },
  },

  // -- Serialization --
  {
    id: 'dump-nested',
    family: 'Serialization',
    name: 'dump nested',
    description: 'Serialize a nested object via the json-tology dump pipeline.',
    factories: {
      'json-tology': jtDump(),
      'structured-clone': structuredCloneSetup(NESTED_FOR_DUMP),
    },
  },
  {
    id: 'dumpjson-nested',
    family: 'Serialization',
    name: 'dumpJson nested',
    description: 'Serialize a nested object to a JSON string.',
    factories: {
      'json-tology': jtDumpJson(),
      'json-stringify': jsonStringify(NESTED_FOR_DUMP),
    },
  },

  // -- Registry --
  {
    id: 'warm-validate',
    family: 'Registry',
    name: 'warm validate',
    description: 'Validate after registration; hot path.',
    factories: {
      'json-tology': jtFlatSetup(FLAT_VALID),
      'zod': zodFlatValidate(FLAT_VALID),
      'valibot': valibotFlatValidate(FLAT_VALID),
      'typebox-compiled': typeboxFlatCompiled(FLAT_VALID),
      'ajv': ajvFlatValidate(FLAT_VALID),
    },
  },
];

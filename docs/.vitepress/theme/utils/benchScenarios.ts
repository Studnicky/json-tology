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
  | 'effect-schema'
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
  { key: 'effect-schema',    label: 'Effect Schema',       url: 'https://esm.sh/effect@3' },
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

// ----------------------------------------------------------------------------
// FULL-COVERAGE helpers — every scenario × every library. Where a library
// lacks a primitive, the factory shows the workaround a user of that library
// would actually write. Comments mark the difference between native APIs and
// userland equivalents.
// ----------------------------------------------------------------------------

// Yup / Joi flat validators (validation family)
function yupFlatValidate(data: unknown): Setup {
  return async () => {
    const yup = (await importOnce('https://esm.sh/yup@1')) as typeof import('yup');
    const Customer = yup.object({
      id: yup.string().uuid().required(),
      email: yup.string().email().required(),
      name: yup.string().required(),
    });
    return () => {
      try { Customer.validateSync(data, { abortEarly: false }); } catch { /* error collected */ }
    };
  };
}

function yupNestedValidate(data: unknown): Setup {
  return async () => {
    const yup = (await importOnce('https://esm.sh/yup@1')) as typeof import('yup');
    const Customer = yup.object({ id: yup.string(), email: yup.string(), name: yup.string() });
    const Address = yup.object({ street: yup.string(), city: yup.string(), zip: yup.string() });
    const Nested = yup.object({ customer: Customer, address: Address, amount: yup.number() });
    return () => {
      try { Nested.validateSync(data, { abortEarly: false }); } catch { /* error collected */ }
    };
  };
}

function joiFlatValidate(data: unknown): Setup {
  return async () => {
    const joiMod = (await importOnce('https://esm.sh/joi@17')) as { default?: unknown };
    const Joi = (joiMod.default ?? joiMod) as {
      object: (s: unknown) => { validate: (d: unknown, opts: unknown) => unknown };
      string: () => { uuid: () => unknown; email: () => unknown; required: () => unknown };
    };
    const Customer = Joi.object({
      id: Joi.string().uuid().required(),
      email: Joi.string().email().required(),
      name: Joi.string().required(),
    });
    return () => { void Customer.validate(data, { abortEarly: false }); };
  };
}

function joiNestedValidate(data: unknown): Setup {
  return async () => {
    const joiMod = (await importOnce('https://esm.sh/joi@17')) as { default?: unknown };
    const Joi = (joiMod.default ?? joiMod) as {
      object: (s: unknown) => { validate: (d: unknown, opts: unknown) => unknown };
      string: () => unknown;
      number: () => unknown;
    };
    const Customer = Joi.object({ id: Joi.string(), email: Joi.string(), name: Joi.string() });
    const Address  = Joi.object({ street: Joi.string(), city: Joi.string(), zip: Joi.string() });
    const Nested   = Joi.object({ customer: Customer, address: Address, amount: Joi.number() });
    return () => { void Nested.validate(data, { abortEarly: false }); };
  };
}

// Runtypes flat / nested
function runtypesFlat(data: unknown): Setup {
  return async () => {
    const rt = (await loadLib('runtypes')).main as Record<string, unknown>;
    const RtObject = (rt.Object ?? rt.Record) as (s: unknown) => { check: (d: unknown) => unknown; validate?: (d: unknown) => unknown };
    const String = rt.String as unknown;
    const Customer = RtObject({ id: String, email: String, name: String });
    return () => {
      try { Customer.check(data); } catch { /* error collected */ }
    };
  };
}

function runtypesNested(data: unknown): Setup {
  return async () => {
    const rt = (await loadLib('runtypes')).main as Record<string, unknown>;
    const RtObject = (rt.Object ?? rt.Record) as (s: unknown) => { check: (d: unknown) => unknown };
    const String = rt.String as unknown;
    const Number = rt.Number as unknown;
    const Customer = RtObject({ id: String, email: String, name: String });
    const Address  = RtObject({ street: String, city: String, zip: String });
    const Nested   = RtObject({ customer: Customer, address: Address, amount: Number });
    return () => {
      try { Nested.check(data); } catch { /* error collected */ }
    };
  };
}

// Effect Schema flat / nested
async function loadEffect(): Promise<{ Schema: Record<string, unknown>; Either: { isLeft: (e: unknown) => boolean } }> {
  const mod = (await loadLib('effect-schema')).main as { Schema: Record<string, unknown>; Either: { isLeft: (e: unknown) => boolean } };
  return mod;
}

function effectFlat(data: unknown): Setup {
  return async () => {
    const { Schema: S, Either } = await loadEffect();
    const Struct = S.Struct as (s: unknown) => unknown;
    const String = S.String as unknown;
    const Customer = Struct({ id: String, email: String, name: String });
    const decode = (S.decodeUnknownEither as (s: unknown) => (d: unknown) => unknown)(Customer);
    return () => {
      const r = decode(data);
      void Either.isLeft(r);
    };
  };
}

function effectNested(data: unknown): Setup {
  return async () => {
    const { Schema: S, Either } = await loadEffect();
    const Struct = S.Struct as (s: unknown) => unknown;
    const String = S.String as unknown;
    const Number = S.Number as unknown;
    const Customer = Struct({ id: String, email: String, name: String });
    const Address  = Struct({ street: String, city: String, zip: String });
    const Nested   = Struct({ customer: Customer, address: Address, amount: Number });
    const decode = (S.decodeUnknownEither as (s: unknown) => (d: unknown) => unknown)(Nested);
    return () => {
      const r = decode(data);
      void Either.isLeft(r);
    };
  };
}

// AJV instantiate: AJV doesn't return the value; the user runs validate and
// uses the original data. This is the userland equivalent path.
function ajvInstantiate(data: unknown, schema: unknown): Setup {
  return async () => {
    const mod = (await loadLib('ajv')).main as { default?: new () => unknown };
    const Ajv = (mod.default ?? mod) as new () => { compile: (s: unknown) => (d: unknown) => boolean };
    const ajv = new Ajv();
    const validate = ajv.compile(schema);
    return () => {
      if (validate(data)) { void data; } else { /* invalid; user discards */ }
    };
  };
}

// Yup / Joi / Runtypes / Effect instantiate (parse + return value)
function yupInstantiate(data: unknown, nested: boolean): Setup {
  return async () => {
    const yup = (await importOnce('https://esm.sh/yup@1')) as typeof import('yup');
    if (nested) {
      const Customer = yup.object({ id: yup.string(), email: yup.string(), name: yup.string() });
      const Address  = yup.object({ street: yup.string(), city: yup.string(), zip: yup.string() });
      const Nested   = yup.object({ customer: Customer, address: Address, amount: yup.number() });
      return () => { void Nested.validateSync(data); };
    }
    const Schema = yup.object({ id: yup.string(), email: yup.string(), name: yup.string() });
    return () => { void Schema.validateSync(data); };
  };
}

function joiInstantiate(data: unknown, nested: boolean): Setup {
  return async () => {
    const joiMod = (await importOnce('https://esm.sh/joi@17')) as { default?: unknown };
    const Joi = (joiMod.default ?? joiMod) as { object: (s: unknown) => { validate: (d: unknown) => unknown }; string: () => unknown; number: () => unknown };
    if (nested) {
      const Customer = Joi.object({ id: Joi.string(), email: Joi.string(), name: Joi.string() });
      const Address  = Joi.object({ street: Joi.string(), city: Joi.string(), zip: Joi.string() });
      const Nested   = Joi.object({ customer: Customer, address: Address, amount: Joi.number() });
      return () => { void Nested.validate(data); };
    }
    const Schema = Joi.object({ id: Joi.string(), email: Joi.string(), name: Joi.string() });
    return () => { void Schema.validate(data); };
  };
}

// io-ts / Effect / typebox / ajv / yup / joi / runtypes clean
function arktypeClean(data: unknown, nested: boolean): Setup {
  return async () => {
    const ark = (await loadLib('arktype')).main as { type: (s: unknown) => (d: unknown) => unknown };
    const Schema = nested
      ? ark.type({
          customer: { id: 'string', email: 'string', name: 'string' },
          address: { street: 'string', city: 'string', zip: 'string' },
          amount: 'number',
        })
      : ark.type({ id: 'string', email: 'string', name: 'string' });
    // ArkType has no native strip-unknown — the user-level equivalent is to
    // run validation, then keep only the keys that the schema declares.
    const known = nested
      ? ['customer', 'address', 'amount'] as const
      : ['id', 'email', 'name'] as const;
    return () => {
      const r = Schema(data) as Record<string, unknown>;
      if (r) {
        const out: Record<string, unknown> = {};
        for (const k of known) out[k] = r[k];
        void out;
      }
    };
  };
}

function runtypesClean(data: unknown, nested: boolean): Setup {
  return async () => {
    const rt = (await loadLib('runtypes')).main as Record<string, unknown>;
    const RtObject = (rt.Object ?? rt.Record) as (s: unknown) => { check: (d: unknown) => unknown };
    const String = rt.String as unknown;
    const Number = rt.Number as unknown;
    const Schema = nested
      ? RtObject({
          customer: RtObject({ id: String, email: String, name: String }),
          address: RtObject({ street: String, city: String, zip: String }),
          amount: Number,
        })
      : RtObject({ id: String, email: String, name: String });
    const known = nested ? ['customer', 'address', 'amount'] : ['id', 'email', 'name'];
    // Runtypes has no strip-unknown. Validate then handpick known keys.
    return () => {
      try {
        const checked = Schema.check(data) as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const k of known) out[k] = checked[k];
        void out;
      } catch { /* invalid */ }
    };
  };
}

function ajvClean(data: unknown, nested: boolean): Setup {
  return async () => {
    const mod = (await loadLib('ajv')).main as { default?: new (opts: unknown) => unknown };
    const Ajv = (mod.default ?? mod) as new (opts: unknown) => { compile: (s: unknown) => (d: unknown) => boolean };
    // AJV: removeAdditional in compiled validator mutates the value to strip
    // properties not in the schema. This is the AJV strip-unknown path.
    const ajv = new Ajv({ removeAdditional: 'all' });
    const schema = nested
      ? {
          type: 'object',
          properties: {
            customer: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' } } },
            address:  { type: 'object', additionalProperties: false, properties: { street: { type: 'string' }, city: { type: 'string' }, zip: { type: 'string' } } },
            amount:   { type: 'number' },
          },
          additionalProperties: false,
        }
      : {
          type: 'object',
          properties: { id: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' } },
          additionalProperties: false,
        };
    const validate = ajv.compile(schema);
    return () => {
      const copy = JSON.parse(JSON.stringify(data));
      validate(copy);
      void copy;
    };
  };
}

function iotsClean(data: unknown, nested: boolean): Setup {
  return async () => {
    const t = (await loadLib('io-ts')).main as { type: (s: unknown) => { decode: (d: unknown) => unknown }; exact: (s: unknown) => { decode: (d: unknown) => unknown }; string: unknown; number: unknown };
    const Schema = nested
      ? t.exact(t.type({
          customer: t.exact(t.type({ id: t.string, email: t.string, name: t.string })),
          address:  t.exact(t.type({ street: t.string, city: t.string, zip: t.string })),
          amount: t.number,
        }))
      : t.exact(t.type({ id: t.string, email: t.string, name: t.string }));
    // t.exact wraps the codec so unknown keys are stripped on decode.
    return () => { void Schema.decode(data); };
  };
}

function effectClean(data: unknown, nested: boolean): Setup {
  return async () => {
    const { Schema: S } = await loadEffect();
    const Struct = S.Struct as (s: unknown) => unknown;
    const String = S.String as unknown;
    const Number = S.Number as unknown;
    const Schema = nested
      ? Struct({
          customer: Struct({ id: String, email: String, name: String }),
          address: Struct({ street: String, city: String, zip: String }),
          amount: Number,
        })
      : Struct({ id: String, email: String, name: String });
    // Effect Schema's decode strips unknown keys by default.
    const decode = (S.decodeUnknownSync as (s: unknown) => (d: unknown) => unknown)(Schema);
    return () => { try { void decode(data); } catch { /* invalid */ } };
  };
}

// Convert/coerce factories for remaining libs (typebox-compiled, ajv, io-ts,
// runtypes, effect)
function typeboxConvert(data: unknown): Setup {
  return async () => {
    const tb = (await loadLib('typebox')).main as { Type: { Object: (s: unknown) => unknown; Number: () => unknown; Boolean: () => unknown; String: () => unknown } };
    const value = await importOnce<{ Value: { Convert: (s: unknown, d: unknown) => unknown } }>('https://esm.sh/@sinclair/typebox@0.34/value');
    const Schema = tb.Type.Object({ n: tb.Type.Number(), ok: tb.Type.Boolean(), tag: tb.Type.String() });
    return () => { void value.Value.Convert(Schema, data); };
  };
}

function ajvCoerceValid(data: unknown): Setup {
  return async () => {
    const mod = (await loadLib('ajv')).main as { default?: new (opts: unknown) => unknown };
    const Ajv = (mod.default ?? mod) as new (opts: unknown) => { compile: (s: unknown) => (d: unknown) => boolean };
    const ajv = new Ajv({ coerceTypes: true, useDefaults: true });
    const validate = ajv.compile({
      type: 'object',
      properties: { n: { type: 'number' }, ok: { type: 'boolean' }, tag: { type: 'string', default: 'x' } },
      required: ['n', 'ok'],
    });
    return () => {
      const copy = JSON.parse(JSON.stringify(data));
      validate(copy);
      void copy;
    };
  };
}

function iotsCoerce(data: unknown): Setup {
  return async () => {
    const t = (await loadLib('io-ts')).main as { type: (s: unknown) => { decode: (d: unknown) => unknown }; string: unknown };
    // io-ts has no built-in coerce; the user-level path is to decode the raw
    // shape and then coerce in application code.
    const Raw = t.type({ n: t.string, ok: t.string });
    return () => {
      Raw.decode(data);
      void { n: Number(typeof data === 'object' && data ? (data as Record<string, string>).n : 0), ok: typeof data === 'object' && data ? (data as Record<string, string>).ok === 'true' : false };
    };
  };
}

function runtypesCoerce(data: unknown): Setup {
  return async () => {
    const rt = (await loadLib('runtypes')).main as Record<string, unknown>;
    const RtObject = (rt.Object ?? rt.Record) as (s: unknown) => { check: (d: unknown) => unknown };
    const String = rt.String as unknown;
    // Runtypes also has no coerce — same workaround as io-ts: validate raw,
    // then coerce explicitly.
    const Raw = RtObject({ n: String, ok: String });
    return () => {
      try { Raw.check(data); } catch { /* invalid */ }
      void { n: Number(typeof data === 'object' && data ? (data as Record<string, string>).n : 0), ok: typeof data === 'object' && data ? (data as Record<string, string>).ok === 'true' : false };
    };
  };
}

function effectCoerce(data: unknown): Setup {
  return async () => {
    const { Schema: S } = await loadEffect();
    const Struct = S.Struct as (s: unknown) => unknown;
    const NumberFromString = (S.NumberFromString ?? S.Number) as unknown;
    const String = S.String as unknown;
    const Schema = Struct({ n: NumberFromString, ok: String });
    const decode = (S.decodeUnknownSync as (s: unknown) => (d: unknown) => unknown)(Schema);
    return () => { try { void decode(data); } catch { /* invalid */ } };
  };
}

// Universal clone equivalents (every lib gets the standard idiom).
function jsonRoundTripCloneFor(data: unknown): Setup {
  return jsonRoundTripClone(data);
}

// Universal serialize equivalents — JSON.stringify is the user-level baseline
// for every library that doesn't have a custom encoder.
function jsonStringifyEncode(data: unknown): Setup {
  return async () => () => { void JSON.stringify(data); };
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
    const mod = (await loadLib('json-tology')).main as { Operations: { clone: (d: unknown) => unknown } };
    return () => { void mod.Operations.clone(data); };
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
      'yup': yupFlatValidate(FLAT_VALID),
      'joi': joiFlatValidate(FLAT_VALID),
      'runtypes': runtypesFlat(FLAT_VALID),
      'effect-schema': effectFlat(FLAT_VALID),
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
      'yup': yupFlatValidate(FLAT_INVALID),
      'joi': joiFlatValidate(FLAT_INVALID),
      'runtypes': runtypesFlat(FLAT_INVALID),
      'effect-schema': effectFlat(FLAT_INVALID),
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
      'yup': yupNestedValidate(NESTED_VALID),
      'joi': joiNestedValidate(NESTED_VALID),
      'runtypes': runtypesNested(NESTED_VALID),
      'effect-schema': effectNested(NESTED_VALID),
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
      // AJV has no parse — user validates then uses the original value. This
      // is what an AJV consumer writes when they need json-tology.instantiate.
      'ajv': ajvInstantiate(FLAT_VALID, JT_FLAT_SCHEMA),
      'arktype': arktypeFlat(FLAT_VALID),
      'io-ts': iotsFlat(FLAT_VALID),
      'yup': yupInstantiate(FLAT_VALID, false),
      'joi': joiInstantiate(FLAT_VALID, false),
      'runtypes': runtypesFlat(FLAT_VALID),
      'effect-schema': effectFlat(FLAT_VALID),
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
      'ajv': ajvInstantiate(NESTED_VALID, JT_NESTED_SCHEMA),
      'arktype': arktypeNested(NESTED_VALID),
      'io-ts': iotsNested(NESTED_VALID),
      'yup': yupInstantiate(NESTED_VALID, true),
      'joi': joiInstantiate(NESTED_VALID, true),
      'runtypes': runtypesNested(NESTED_VALID),
      'effect-schema': effectNested(NESTED_VALID),
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
      'typebox': typeboxConvert(COERCE_INPUT),
      'ajv': ajvCoerceValid(COERCE_INPUT),
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
      'io-ts': iotsCoerce(COERCE_INPUT),
      'runtypes': runtypesCoerce(COERCE_INPUT),
      'yup': yupCoerceValid(COERCE_INPUT),
      'joi': joiCoerceValid(COERCE_INPUT),
      'effect-schema': effectCoerce(COERCE_INPUT),
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
      'typebox': typeboxConvert(DEFAULTS_INPUT),
      'ajv': ajvCoerceValid(DEFAULTS_INPUT),
      // ArkType has no defaults — user merges defaults before validate.
      'arktype': async () => {
        const ark = (await loadLib('arktype')).main as { type: (s: unknown) => (d: unknown) => unknown };
        const Schema = ark.type({ n: 'number', ok: 'boolean', tag: 'string' });
        return () => { void Schema({ tag: 'x', ...DEFAULTS_INPUT }); };
      },
      'io-ts': async () => {
        // io-ts has no defaults; the user merges them in application code
        // before decoding.
        const t = (await loadLib('io-ts')).main as { type: (s: unknown) => { decode: (d: unknown) => unknown }; string: unknown; number: unknown; boolean: unknown };
        const Schema = t.type({ n: t.number, ok: t.boolean, tag: t.string });
        return () => { void Schema.decode({ tag: 'x', ...DEFAULTS_INPUT }); };
      },
      'runtypes': async () => {
        // Runtypes has no defaults; user merges before .check().
        const rt = (await loadLib('runtypes')).main as Record<string, unknown>;
        const RtObject = (rt.Object ?? rt.Record) as (s: unknown) => { check: (d: unknown) => unknown };
        const Schema = RtObject({ n: rt.Number, ok: rt.Boolean, tag: rt.String });
        return () => { try { void Schema.check({ tag: 'x', ...DEFAULTS_INPUT }); } catch { /* invalid */ } };
      },
      'yup': yupCoerceValid(DEFAULTS_INPUT),
      'joi': joiCoerceValid(DEFAULTS_INPUT),
      'effect-schema': effectCoerce(DEFAULTS_INPUT),
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
      // typebox-compiled: same as Value.Clean via the compiled API surface.
      'typebox-compiled': typeboxClean({ ...FLAT_VALID, extra: 1, more: 'no' }, (Type) => {
        return Type.Object({ id: Type.String(), email: Type.String(), name: Type.String() });
      }),
      // AJV: removeAdditional in the compiled validator mutates the value.
      'ajv': ajvClean({ ...FLAT_VALID, extra: 1, more: 'no' }, false),
      // ArkType has no native strip — validate + handpick known keys.
      'arktype': arktypeClean({ ...FLAT_VALID, extra: 1, more: 'no' }, false),
      // io-ts: t.exact wraps the codec so unknown keys are stripped on decode.
      'io-ts': iotsClean({ ...FLAT_VALID, extra: 1, more: 'no' }, false),
      // Runtypes has no strip — validate + handpick.
      'runtypes': runtypesClean({ ...FLAT_VALID, extra: 1, more: 'no' }, false),
      // Effect Schema's decode strips unknown keys by default.
      'effect-schema': effectClean({ ...FLAT_VALID, extra: 1, more: 'no' }, false),
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
      'typebox-compiled': typeboxClean({ ...NESTED_VALID, extra: 1 }, (Type) => {
        return Type.Object({
          customer: Type.Object({ id: Type.String(), email: Type.String(), name: Type.String() }),
          address: Type.Object({ street: Type.String(), city: Type.String(), zip: Type.String() }),
          amount: Type.Number(),
        });
      }),
      'ajv': ajvClean({ ...NESTED_VALID, extra: 1 }, true),
      'arktype': arktypeClean({ ...NESTED_VALID, extra: 1 }, true),
      'io-ts': iotsClean({ ...NESTED_VALID, extra: 1 }, true),
      'runtypes': runtypesClean({ ...NESTED_VALID, extra: 1 }, true),
      'effect-schema': effectClean({ ...NESTED_VALID, extra: 1 }, true),
    },
  },
  {
    id: 'convert-simple',
    family: 'Value operations',
    name: 'convert simple',
    description: 'String → number / boolean coercion only.',
    factories: {
      'json-tology': jtConvert(COERCE_INPUT),
      'zod': zodCoerceValid(COERCE_INPUT),
      'valibot': valibotCoerceValid(COERCE_INPUT),
      'typebox': typeboxConvert(COERCE_INPUT),
      'ajv': ajvCoerceValid(COERCE_INPUT),
      'io-ts': iotsCoerce(COERCE_INPUT),
      'runtypes': runtypesCoerce(COERCE_INPUT),
      'yup': yupCoerceValid(COERCE_INPUT),
      'joi': joiCoerceValid(COERCE_INPUT),
      'effect-schema': effectCoerce(COERCE_INPUT),
      // Universal baseline: explicit per-field Number(x) / x === 'true'.
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
      // Pre-structuredClone idiom every JS user has reached for.
      'json-stringify': jsonRoundTripCloneFor(NESTED_VALID),
      // Cloning is not validator-territory; every per-library row routes
      // through the same JSON round-trip — that's literally what a Zod /
      // Valibot / TypeBox / etc. user writes for "deep clone this object".
      'zod': jsonRoundTripCloneFor(NESTED_VALID),
      'valibot': jsonRoundTripCloneFor(NESTED_VALID),
      'typebox': jsonRoundTripCloneFor(NESTED_VALID),
      'ajv': jsonRoundTripCloneFor(NESTED_VALID),
      'arktype': jsonRoundTripCloneFor(NESTED_VALID),
      'io-ts': jsonRoundTripCloneFor(NESTED_VALID),
      'runtypes': jsonRoundTripCloneFor(NESTED_VALID),
      'yup': jsonRoundTripCloneFor(NESTED_VALID),
      'joi': jsonRoundTripCloneFor(NESTED_VALID),
      'effect-schema': jsonRoundTripCloneFor(NESTED_VALID),
    },
  },
  {
    id: 'diff-nested',
    family: 'Value operations',
    name: 'diff nested',
    description: 'Compute a changeset between two nested objects.',
    factories: {
      'json-tology': jtDiff(),
      // No peer library exposes a diff primitive. Every "what would the user
      // write" answer is the same recursive walk — make that explicit by
      // routing every row through manualDiff so the table shows what running
      // a hand-rolled diff actually costs.
      'manual': manualDiff(),
      'zod': manualDiff(),
      'valibot': manualDiff(),
      'typebox': manualDiff(),
      'ajv': manualDiff(),
      'arktype': manualDiff(),
      'io-ts': manualDiff(),
      'runtypes': manualDiff(),
      'yup': manualDiff(),
      'joi': manualDiff(),
      'effect-schema': manualDiff(),
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
      // None of the comparators have a "dump through schema" primitive —
      // the user-level equivalent for "produce a serializable representation"
      // is the JSON round-trip every JS user reaches for.
      'zod': jsonRoundTripCloneFor(NESTED_FOR_DUMP),
      'valibot': jsonRoundTripCloneFor(NESTED_FOR_DUMP),
      'typebox': jsonRoundTripCloneFor(NESTED_FOR_DUMP),
      'ajv': jsonRoundTripCloneFor(NESTED_FOR_DUMP),
      'arktype': jsonRoundTripCloneFor(NESTED_FOR_DUMP),
      'io-ts': jsonRoundTripCloneFor(NESTED_FOR_DUMP),
      'runtypes': jsonRoundTripCloneFor(NESTED_FOR_DUMP),
      'yup': jsonRoundTripCloneFor(NESTED_FOR_DUMP),
      'joi': jsonRoundTripCloneFor(NESTED_FOR_DUMP),
      'effect-schema': jsonRoundTripCloneFor(NESTED_FOR_DUMP),
      'json-stringify': jsonStringifyEncode(NESTED_FOR_DUMP),
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
      // Same answer for every peer library — the user writes JSON.stringify.
      'zod': jsonStringifyEncode(NESTED_FOR_DUMP),
      'valibot': jsonStringifyEncode(NESTED_FOR_DUMP),
      'typebox': jsonStringifyEncode(NESTED_FOR_DUMP),
      'ajv': jsonStringifyEncode(NESTED_FOR_DUMP),
      'arktype': jsonStringifyEncode(NESTED_FOR_DUMP),
      'io-ts': jsonStringifyEncode(NESTED_FOR_DUMP),
      'runtypes': jsonStringifyEncode(NESTED_FOR_DUMP),
      'yup': jsonStringifyEncode(NESTED_FOR_DUMP),
      'joi': jsonStringifyEncode(NESTED_FOR_DUMP),
      'effect-schema': jsonStringifyEncode(NESTED_FOR_DUMP),
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
      'arktype': arktypeFlat(FLAT_VALID),
      'io-ts': iotsFlat(FLAT_VALID),
      'yup': yupFlatValidate(FLAT_VALID),
      'joi': joiFlatValidate(FLAT_VALID),
      'runtypes': runtypesFlat(FLAT_VALID),
      'effect-schema': effectFlat(FLAT_VALID),
    },
  },
];

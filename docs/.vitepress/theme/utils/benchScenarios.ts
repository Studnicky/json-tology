/**
 * Browser-runnable benchmark scenario registry.
 *
 * Each scenario id matches a `### <name>` heading in
 * examples/docs/benchmarks/results/latest.md. For every scenario, every
 * comparator library that can run it has a factory that loads the lib from
 * its esm.sh CDN entry on demand and returns a closure to time.
 *
 * `null` factory → library does not run this scenario (intentional skip).
 */

const VERSION = '0.5.0';

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
  | 'json-stringify'
  | 'structured-clone';

export interface LibSpec {
  readonly key: LibKey;
  readonly label: string;
  readonly url?: string;
  readonly extras?: readonly string[];
}

export const LIB_SPECS: readonly LibSpec[] = [
  { key: 'json-tology',      label: 'json-tology',         url: `https://esm.sh/json-tology@${VERSION}` },
  { key: 'zod',              label: 'Zod',                 url: 'https://esm.sh/zod@3' },
  { key: 'valibot',          label: 'Valibot',             url: 'https://esm.sh/valibot@1' },
  { key: 'typebox',          label: 'TypeBox (Value)',     url: 'https://esm.sh/@sinclair/typebox@0.34', extras: ['https://esm.sh/@sinclair/typebox@0.34/value'] },
  { key: 'typebox-compiled', label: 'TypeBox (compiled)',  url: 'https://esm.sh/@sinclair/typebox@0.34', extras: ['https://esm.sh/@sinclair/typebox@0.34/compiler'] },
  { key: 'ajv',              label: 'AJV',                 url: 'https://esm.sh/ajv@8',                  extras: ['https://esm.sh/ajv-formats@3'] },
  { key: 'arktype',          label: 'ArkType',             url: 'https://esm.sh/arktype@2' },
  { key: 'runtypes',         label: 'Runtypes',            url: 'https://esm.sh/runtypes@7' },
  { key: 'io-ts',            label: 'io-ts',               url: 'https://esm.sh/io-ts@2' },
  { key: 'json-stringify',   label: 'JSON.stringify' },
  { key: 'structured-clone', label: 'structuredClone' },
];

const moduleCache = new Map<string, unknown>();
async function importOnce<T = unknown>(url: string): Promise<T> {
  if (!moduleCache.has(url)) {
    moduleCache.set(url, await import(/* @vite-ignore */ url));
  }
  return moduleCache.get(url) as T;
}

async function loadLib(key: LibKey): Promise<{ main: unknown; extras: unknown[] }> {
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

function jtClean(data: unknown, schema: unknown): Setup {
  return async () => {
    const mod = (await loadLib('json-tology')).main as { JsonTology: { create: (o: unknown) => { registry: { clean: (id: string, d: unknown) => unknown } } } };
    const jt = mod.JsonTology.create({ baseIRI: 'urn:bench:', schemas: [schema] });
    return () => { void jt.registry.clean((schema as { $id: string }).$id, data); };
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
    id: 'validation-simple-valid',
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
    id: 'validation-simple-invalid',
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
    id: 'validation-nested-valid',
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
      'zod': async () => {
        const z = (await loadLib('zod')).main as typeof import('zod');
        const C = z.z.object({ n: z.z.coerce.number(), ok: z.z.coerce.boolean(), tag: z.z.string().default('x') });
        return () => { void C.parse(COERCE_INPUT); };
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
    },
  },

  // -- Value operations --
  {
    id: 'clean-simple',
    family: 'Value operations',
    name: 'clean simple',
    description: 'Strip unknown keys from a flat object.',
    factories: {
      'json-tology': jtClean({ ...FLAT_VALID, extra: 1, more: 'no' }, JT_FLAT_SCHEMA),
    },
  },
  {
    id: 'clean-nested',
    family: 'Value operations',
    name: 'clean nested',
    description: 'Strip unknown keys from a nested object.',
    factories: {
      'json-tology': jtClean({ ...NESTED_VALID, extra: 1 }, JT_NESTED_SCHEMA),
    },
  },
  {
    id: 'convert-simple',
    family: 'Value operations',
    name: 'convert simple',
    description: 'String → number / boolean coercion only.',
    factories: {
      'json-tology': jtConvert(COERCE_INPUT),
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
    },
  },
  {
    id: 'diff-nested',
    family: 'Value operations',
    name: 'diff nested',
    description: 'Compute a changeset between two nested objects.',
    factories: {
      'json-tology': jtDiff(),
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
    id: 'dumpJson-nested',
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
    id: 'registry-warm-validate',
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

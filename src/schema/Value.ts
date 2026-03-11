/**
 * Value utilities
 *
 * Standalone operations on plain values — no schema required for most.
 * For schema-aware operations (cast, clean) a plain schema object is accepted.
 *
 * Value.cast(schema, value)    — coerce types and fill defaults; never throws
 * Value.clean(schema, value)   — strip keys not declared in schema properties
 * Value.convert(schema, value) — type coercion only (no defaults); never throws
 * Value.parse(schema, value)   — full pipeline: clone → convert → cast → clean → validate → decode
 * Value.clone(value)           — deep clone via structuredClone
 * Value.hash(value)            — deterministic FNV-1a hash of a JSON-serialisable value
 * Value.diff(a, b)             — returns a Changeset describing how to transform a into b
 */

import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema } from 'json-schema-to-ts';
import type { Infer } from './EntityBuilder.js';
import type { DiffOp } from '../types/errors.js';
import { Changeset } from './Changeset.js';
import { ParseError } from './ParseError.js';
import { ValidationErrors } from './ValidationErrors.js';
import { Transform } from './Transform.js';
import { Compiler } from './Compiler.js';

// ---------------------------------------------------------------------------
// AJV singleton — fallback for schemas with $ref / if-then-else / etc.
// ---------------------------------------------------------------------------

let _ajv: Ajv | undefined;
function getAjv(): Ajv {
  if (!_ajv) {
    _ajv = new Ajv({ allErrors: true, strict: false, useDefaults: false });
    addFormats(_ajv);
  }
  return _ajv;
}

const ajvValidators = new WeakMap<object, ValidateFunction>();

function getAjvValidator(schema: object): ValidateFunction {
  let fn = ajvValidators.get(schema);
  if (!fn) {
    fn = getAjv().compile(schema);
    ajvValidators.set(schema, fn);
  }
  return fn;
}

// ---------------------------------------------------------------------------
// Compiled defaults applicator — cached per schema object
// Generated via new Function() so it runs without any per-call schema traversal
// ---------------------------------------------------------------------------

type DefaultsApplicator = (obj: Record<string, unknown>) => void;
const defaultsCache = new WeakMap<object, DefaultsApplicator>();

function getDefaultsApplicator(schema: Record<string, unknown>): DefaultsApplicator {
  let fn = defaultsCache.get(schema);
  if (!fn) {
    fn = buildDefaultsApplicator(schema);
    defaultsCache.set(schema, fn);
  }
  return fn;
}

function buildDefaultsApplicator(schema: Record<string, unknown>): DefaultsApplicator {
  const lines: string[] = [];
  emitDefaults(schema, 'obj', lines, 0);
  if (lines.length === 0) return () => { /* no defaults */ };
  // eslint-disable-next-line no-new-func
  return new Function('obj', lines.join('\n')) as DefaultsApplicator;
}

function emitDefaults(schema: Record<string, unknown>, expr: string, lines: string[], depth: number): void {
  if (depth > 10) return;
  const props = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
  if (!props) return;

  const guard = depth > 0 ? `if (${expr} && typeof ${expr} === 'object') ` : '';

  const propEntries = Object.entries(props);
  for (let i = 0; i < propEntries.length; i++) {
    const key = propEntries[i][0];
    const propSchema = propEntries[i][1];
    const safeKey = JSON.stringify(key);
    const propExpr = `${expr}[${safeKey}]`;

    if ('default' in propSchema) {
      const defaultLiteral = JSON.stringify(propSchema['default']);
      lines.push(`${guard}if (${propExpr} === undefined) ${propExpr} = ${defaultLiteral};`);
    }

    if (propSchema['type'] === 'object' && propSchema['properties']) {
      const childLines: string[] = [];
      emitDefaults(propSchema, propExpr, childLines, depth + 1);
      if (childLines.length > 0) {
        lines.push(`if (${propExpr} !== undefined && ${propExpr} !== null && typeof ${propExpr} === 'object') {`);
        lines.push(...childLines);
        lines.push('}');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Value class
// ---------------------------------------------------------------------------

export class Value {
  /**
   * Deep clone a value using structuredClone.
   * Works with objects, arrays, Dates, Maps, Sets, typed arrays, etc.
   */
  public static clone<T>(value: T): T {
    return structuredClone(value);
  }

  /**
   * Produce a deterministic hex string hash of any JSON-serialisable value.
   * Uses FNV-1a (32-bit). Identical values always produce identical hashes.
   */
  public static hash(value: unknown): string {
    const str = JSON.stringify(value, stableReplacer);
    let hashValue = 2166136261;
    const fnvPrime = 16777619;
    for (let i = 0; i < str.length; i++) {
      hashValue ^= str.charCodeAt(i);
      hashValue = (hashValue * fnvPrime) >>> 0;
    }
    return hashValue.toString(16);
  }

  /**
   * Produce a Changeset describing the minimal operations needed to transform `before` into `after`.
   * Paths use JSON Pointer format (e.g. "/user/name").
   *
   * @example
   * const changes = Value.diff(before, after);
   * changes.isEmpty       // true if no differences
   * const result = changes.apply(before);  // equals after
   */
  public static diff(before: unknown, after: unknown): Changeset {
    const operations: DiffOp[] = [];
    diffAt('', before, after, operations);
    return new Changeset(operations);
  }

  /**
   * Coerce a value to match a schema and fill in defaults — never throws.
   * Uses a lightweight pass that handles common type mismatches.
   *
   * Returns the (possibly invalid) coerced value. Intended as a best-effort
   * operation for normalising external data before validation.
   *
   * For strict validated output use jt.parse() instead.
   */
  public static cast<TSchema extends JSONSchema>(
    schema: TSchema,
    value: unknown,
  ): Infer<TSchema> {
    return castValue(schema as Record<string, unknown>, value) as Infer<TSchema>;
  }

  /**
   * Recursively remove properties from `value` that are not declared in the
   * schema's `properties`. Does not mutate the original.
   *
   * Useful for sanitising external data before storage or serialisation.
   *
   * @example
   * const safe = Value.clean(UserSchema, { name: 'Alice', hackField: '...' });
   * // safe = { name: 'Alice' }
   */
  public static clean<TSchema extends JSONSchema>(
    schema: TSchema,
    value: unknown,
  ): Infer<TSchema> {
    return cleanValue(schema as Record<string, unknown>, value) as Infer<TSchema>;
  }

  /**
   * Coerce a value's primitive types to match the schema — without applying
   * defaults or throwing. Unlike `cast`, convert leaves missing properties
   * untouched and does not fill `default` values.
   *
   * - `"42"` → `42` for `type: "number"`
   * - `"true"` / `"1"` → `true` for `type: "boolean"`
   * - `42` → `"42"` for `type: "string"` (when value is not already a string)
   * - `"null"` → `null` for `type: "null"`
   *
   * Recurses into object properties and array items.
   */
  public static convert<TSchema extends JSONSchema>(
    schema: TSchema,
    value: unknown,
  ): unknown {
    return convertValue(schema as Record<string, unknown>, value);
  }

  /**
   * Full parse pipeline — the safest and most complete way to normalise external data.
   *
   * Pipeline: Clone → Convert → Cast (defaults) → Clean → Validate → Decode
   *
   * Throws `ParseError` if validation fails after all coercions are applied.
   * If the schema has a Transform attached (via `Transform.create`), the decoded
   * value is returned instead of the raw validated value.
   *
   * @example
   * const user = Value.parse(UserSchema, rawInput);
   */
  public static parse<TSchema extends JSONSchema>(
    schema: TSchema,
    data: unknown,
  ): Infer<TSchema> {
    // 1. Clone — isolate caller's data
    const result: unknown = structuredClone(data);
    // 2-4. Normalize in-place (single pass: coerce + defaults + clean)
    //      falls back to 3 separate passes for complex schemas
    const jit = Compiler.compile(schema as object);
    if (jit) {
      // 2-5. Single-pass: normalize in-place + validate
      if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
        if (!jit.normalizeAndCheck(result as Record<string, unknown>)) {
          throw new ParseError(new ValidationErrors(jit.errors(result)));
        }
      } else if (!jit.check(result)) {
        throw new ParseError(new ValidationErrors(jit.errors(result)));
      }
    } else {
      // AJV fallback: separate passes
      const s = schema as Record<string, unknown>;
      let r = convertValue(s, result);
      if (r !== null && typeof r === 'object' && !Array.isArray(r)) {
        getDefaultsApplicator(s)(r as Record<string, unknown>);
      }
      r = cleanValue(s, r);
      const validate = getAjvValidator(schema as object);
      if (!validate(r)) {
        const errs = (validate.errors ?? []).map((e) => ({
          path: e.instancePath || '/',
          message: e.message ?? 'invalid',
          keyword: e.keyword,
          params: e.params as Record<string, unknown>,
        }));
        throw new ParseError(new ValidationErrors(errs));
      }
    }
    // 6. Decode — run transform if attached
    const decoder = Transform.getDecoder(schema as object);
    if (decoder) return decoder.decode(result) as Infer<TSchema>;
    return result as Infer<TSchema>;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (exported for use by Changeset)
// ---------------------------------------------------------------------------

/** Replacer that sorts object keys for deterministic serialization. */
function stableReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    const sortedKeys = Object.keys(value as object).sort();
    for (let i = 0; i < sortedKeys.length; i++) {
      sorted[sortedKeys[i]] = (value as Record<string, unknown>)[sortedKeys[i]];
    }
    return sorted;
  }
  return value;
}

function diffAt(path: string, before: unknown, after: unknown, ops: DiffOp[]): void {
  if (isPlainObject(before) && isPlainObject(after)) {
    const b = before as Record<string, unknown>;
    const a = after  as Record<string, unknown>;
    // Phase 1: walk before — find deletes and recurse into shared keys
    for (const key in b) {
      const child = path + '/' + key;
      if (key in a) {
        diffAt(child, b[key], a[key], ops);
      } else {
        ops.push({ op: 'delete', path: child });
      }
    }
    // Phase 2: walk after — find new keys not in before
    for (const key in a) {
      if (!(key in b)) {
        ops.push({ op: 'set', path: path + '/' + key, value: a[key] });
      }
    }
  } else if (Array.isArray(before) && Array.isArray(after)) {
    const bl = before.length;
    const al = after.length;
    const min = bl < al ? bl : al;
    for (let i = 0; i < min; i++) {
      diffAt(path + '/' + i, before[i], after[i], ops);
    }
    for (let i = min; i < al; i++) {
      ops.push({ op: 'set', path: path + '/' + i, value: after[i] });
    }
    for (let i = min; i < bl; i++) {
      ops.push({ op: 'delete', path: path + '/' + i });
    }
  } else if (before !== after) {
    ops.push({ op: 'set', path: path || '/', value: after });
  }
}

export function applyOp(root: unknown, operation: DiffOp): unknown {
  const path = operation.path === '/' ? '' : operation.path;
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    return operation.op === 'set' ? operation.value : undefined;
  }

  const result = isPlainObject(root) ? { ...(root as object) } : Array.isArray(root) ? [...root] : root;
  let current: unknown = result;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const child = (current as Record<string, unknown>)[segment];
    const next = isPlainObject(child) ? { ...(child as object) } : Array.isArray(child) ? [...child] : child;
    (current as Record<string, unknown>)[segment] = next;
    current = next;
  }

  const lastSegment = segments[segments.length - 1];
  if (operation.op === 'set') {
    (current as Record<string, unknown>)[lastSegment] = operation.value;
  } else {
    if (Array.isArray(current)) {
      (current as unknown[]).splice(Number(lastSegment), 1);
    } else {
      delete (current as Record<string, unknown>)[lastSegment];
    }
  }

  return result;
}

function castValue(schema: Record<string, unknown>, value: unknown): unknown {
  const type = schema['type'];

  if (type === 'string') {
    if (typeof value !== 'string') return value == null ? '' : String(value);
    return value;
  }

  if (type === 'number' || type === 'integer') {
    if (typeof value === 'string') { const n = Number(value); return isNaN(n) ? 0 : n; }
    if (typeof value !== 'number') return 0;
    return type === 'integer' ? Math.trunc(value) : value;
  }

  if (type === 'boolean') {
    if (typeof value === 'string') return value === 'true' || value === '1';
    return Boolean(value);
  }

  if (type === 'object') {
    const base: Record<string, unknown> = isPlainObject(value) ? { ...(value as object) } : {};
    const props = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
    const defaults = schema['default'];

    if (typeof defaults === 'object' && defaults !== null) {
      const defEntries = Object.entries(defaults as object);
      for (let i = 0; i < defEntries.length; i++) {
        if (!(defEntries[i][0] in base)) base[defEntries[i][0]] = defEntries[i][1];
      }
    }

    if (props) {
      const entries = Object.entries(props);
      for (let i = 0; i < entries.length; i++) {
        const key = entries[i][0];
        const propSchema = entries[i][1];
        if (key in base) {
          base[key] = castValue(propSchema, base[key]);
        } else if ('default' in propSchema) {
          base[key] = structuredClone(propSchema['default']);
        }
      }
    }
    return base;
  }

  if (type === 'array') {
    const base = Array.isArray(value) ? [...value] : [];
    const itemSchema = schema['items'] as Record<string, unknown> | undefined;
    if (itemSchema) {
      return base.map((item) => castValue(itemSchema, item));
    }
    return base;
  }

  return value;
}

/**
 * Pure type coercion — no defaults injected. Safe and non-throwing.
 * Recurses into object properties and array items.
 */
function convertValue(schema: Record<string, unknown>, value: unknown): unknown {
  const type = schema['type'];

  if (type === 'number' || type === 'integer') {
    if (typeof value === 'string') {
      const n = Number(value);
      if (!isNaN(n)) return type === 'integer' ? Math.trunc(n) : n;
    }
    return value;
  }

  if (type === 'boolean') {
    if (typeof value === 'string') {
      if (value === 'true' || value === '1') return true;
      if (value === 'false' || value === '0') return false;
    }
    return value;
  }

  if (type === 'string') {
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return value;
  }

  if (type === 'null') {
    if (value === 'null') return null;
    return value;
  }

  if (type === 'object' && isPlainObject(value)) {
    const props = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
    if (!props) return value;
    const obj = value as Record<string, unknown>;
    let changed = false;
    const result: Record<string, unknown> = { ...obj };
    const entries = Object.entries(props);
    for (let i = 0; i < entries.length; i++) {
      const key = entries[i][0];
      const propSchema = entries[i][1];
      if (key in obj) {
        const converted = convertValue(propSchema, obj[key]);
        if (converted !== obj[key]) { result[key] = converted; changed = true; }
      }
    }
    return changed ? result : value;
  }

  if (type === 'array' && Array.isArray(value)) {
    const itemSchema = schema['items'] as Record<string, unknown> | undefined;
    if (!itemSchema) return value;
    let changed = false;
    const result = value.map((item) => {
      const converted = convertValue(itemSchema, item);
      if (converted !== item) changed = true;
      return converted;
    });
    return changed ? result : value;
  }

  return value;
}

function cleanValue(schema: Record<string, unknown>, value: unknown): unknown {
  if (!isPlainObject(value)) return value;

  const props = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
  if (!props) return { ...(value as object) };

  const result: Record<string, unknown> = {};
  const entries = Object.entries(props);
  for (let i = 0; i < entries.length; i++) {
    const key = entries[i][0];
    const propSchema = entries[i][1];
    if (key in (value as object)) {
      result[key] = cleanValue(propSchema, (value as Record<string, unknown>)[key]);
    }
  }
  return result;
}

function isPlainObject(v: unknown): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}

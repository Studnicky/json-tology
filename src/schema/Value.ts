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

import type { JSONSchema } from 'json-schema-to-ts';
import type { Infer } from './Materializer.js';
import type { DiffOp } from '../types/errors.js';
import { Changeset } from './Changeset.js';
import { ParseError } from './ParseError.js';
import { ValidationErrors } from './ValidationErrors.js';
import { Transform } from './Transform.js';
import { GraphEngine } from './GraphEngine.js';

// ---------------------------------------------------------------------------
// Value class
// ---------------------------------------------------------------------------

export class Value {
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
    value: unknown
  ): Infer<TSchema> {
    return new GraphEngine(schema as Record<string, unknown>).execute(structuredClone(value), '', {
      'applyDefaults': true,
      'coerce': true,
      'collectErrors': false,
      'materializeContainers': true,
      'removeAdditional': false,
      'stripUnknownProperties': false
    }).value as Infer<TSchema>;
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
    value: unknown
  ): Infer<TSchema> {
    return new GraphEngine(schema as Record<string, unknown>).execute(structuredClone(value), '', {
      'applyDefaults': false,
      'coerce': false,
      'collectErrors': false,
      'materializeContainers': false,
      'removeAdditional': false,
      'stripUnknownProperties': true
    }).value as Infer<TSchema>;
  }

  /**
   * Deep clone a value using structuredClone.
   * Works with objects, arrays, Dates, Maps, Sets, typed arrays, etc.
   */
  public static clone<T>(value: T): T {
    return structuredClone(value);
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
    value: unknown
  ): unknown {
    return new GraphEngine(schema as Record<string, unknown>).execute(structuredClone(value), '', {
      'applyDefaults': false,
      'coerce': true,
      'collectErrors': false,
      'materializeContainers': false,
      'removeAdditional': false,
      'stripUnknownProperties': false
    }).value;
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
   * Produce a deterministic hex string hash of any JSON-serialisable value.
   * Uses FNV-1a (32-bit). Identical values always produce identical hashes.
   */
  public static hash(value: unknown): string {
    const str = JSON.stringify(value, stableReplacer);
    let hashValue = 2_166_136_261;
    const fnvPrime = 16_777_619;

    for (let i = 0; i < str.length; i++) {
      hashValue ^= str.codePointAt(i) ?? 0;
      hashValue = (hashValue * fnvPrime) >>> 0;
    }

    return hashValue.toString(16);
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
    data: unknown
  ): Infer<TSchema> {
    const result = new GraphEngine(schema as Record<string, unknown>).execute(structuredClone(data), '', {
      'applyDefaults': true,
      'collectErrors': true,
      'coerce': true,
      'materializeContainers': false,
      'removeAdditional': true
    });

    if (!result.valid) {
      throw new ParseError(new ValidationErrors(result.errors));
    }

    const decoder = Transform.getDecoder(schema as object);

    if (decoder !== undefined) {
      const decoded: unknown = decoder.decode(result.value);

      return decoded as Infer<TSchema>;
    }

    return result.value as Infer<TSchema>;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (exported for use by Changeset)
// ---------------------------------------------------------------------------

/** Replacer that sorts object keys for deterministic serialization. */
function stableReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    const sortedKeys = Object.keys(value).sort();

    for (const sortedKey of sortedKeys) {
      sorted[sortedKey] = (value as Record<string, unknown>)[sortedKey];
    }

    return sorted;
  }

  return value;
}

function diffAt(path: string, before: unknown, after: unknown, ops: DiffOp[]): void {
  if (isPlainObject(before) && isPlainObject(after)) {
    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;

    // Phase 1: walk before — find deletes and recurse into shared keys
    for (const key in beforeObj) {
      const child = `${path}/${key}`;

      if (key in afterObj) {
        diffAt(child, beforeObj[key], afterObj[key], ops);
      } else {
        ops.push({
          'op': 'delete',
          'path': child
        });
      }
    }
    // Phase 2: walk after — find new keys not in before
    for (const key in afterObj) {
      if (!(key in beforeObj)) {
        ops.push({
          'op': 'set',
          'path': `${path}/${key}`,
          'value': afterObj[key]
        });
      }
    }
  } else if (Array.isArray(before) && Array.isArray(after)) {
    const bl = before.length;
    const al = after.length;
    const min = Math.min(bl, al);

    for (let i = 0; i < min; i++) {
      diffAt(`${path}/${i}`, before[i], after[i], ops);
    }
    for (let i = min; i < al; i++) {
      ops.push({
        'op': 'set',
        'path': `${path}/${i}`,
        'value': (after as unknown[])[i]
      });
    }
    for (let i = min; i < bl; i++) {
      ops.push({
        'op': 'delete',
        'path': `${path}/${i}`
      });
    }
  } else if (before !== after) {
    ops.push({
      'op': 'set',
      'path': path || '/',
      'value': after
    });
  }
}

export function applyOp(root: unknown, operation: DiffOp): unknown {
  const path = operation.path === '/' ? '' : operation.path;
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) {
    return operation.op === 'set' ? operation.value : undefined;
  }

  let result: unknown;

  if (isPlainObject(root)) {
    result = { ...(root as object) };
  } else if (Array.isArray(root)) {
    result = [...(root as unknown[])];
  } else {
    result = root;
  }
  let current: unknown = result;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const child = (current as Record<string, unknown>)[segment];
    let next: unknown;

    if (isPlainObject(child)) {
      next = { ...(child as object) };
    } else if (Array.isArray(child)) {
      next = [...(child as unknown[])];
    } else {
      next = child;
    }

    (current as Record<string, unknown>)[segment] = next;
    current = next;
  }

  const lastSegment = segments.at(-1) ?? '';

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

function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

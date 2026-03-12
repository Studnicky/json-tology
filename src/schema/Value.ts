/**
 * Value utilities
 *
 * Standalone operations on plain values — no schema required for most.
 * For schema-aware operations (cast, clean, convert, parse) a plain schema
 * object is accepted. These use SchemaCompiler for optimized execution.
 *
 * Value.cast(schema, value)    — coerce types and fill defaults; never throws
 * Value.clean(schema, value)   — strip keys not declared in schema properties
 * Value.convert(schema, value) — type coercion only (no defaults); never throws
 * Value.parse(schema, value)   — full pipeline: clone → convert → cast → clean → validate → decode
 * Value.clone(value)           — deep clone via structuredClone
 * Value.hash(value)            — deterministic FNV-1a hash of a JSON-serialisable value
 * Value.diff(a, b)             — returns a Changeset describing how to transform a into b
 */

import type { JSONSchema } from '../types/json-schema.js';
import type { Infer } from './Materializer.js';
import type { DiffOp } from '../types/errors.js';
import { Changeset } from './Changeset.js';
import { ParseError } from './ParseError.js';
import { ValidationErrors } from './ValidationErrors.js';
import { Transform } from './Transform.js';
import { GraphEngine } from './GraphEngine.js';
import { SchemaCompiler, type CompiledValidator } from './SchemaCompiler.js';

// ---------------------------------------------------------------------------
// Shared compiler + cache for standalone usage
// ---------------------------------------------------------------------------

const compiler = new SchemaCompiler();
const validatorCache = new WeakMap<object, CompiledValidator>();

function validatorFor(schema: Record<string, unknown>): CompiledValidator {
  let cached = validatorCache.get(schema);

  if (cached === undefined) {
    const engine = new GraphEngine(schema);

    cached = compiler.compile(engine);
    validatorCache.set(schema, cached);
  }

  return cached;
}

// ---------------------------------------------------------------------------
// Value class
// ---------------------------------------------------------------------------

export class Value {
  /**
   * Generate a fully-defaulted instance from schema defaults and type-appropriate zero values.
   * Walks the schema declaratively — does not use GraphEngine.
   */
  public static create<TSchema extends JSONSchema>(schema: TSchema): Infer<TSchema> {
    return instanceFromSchema(schema as Record<string, unknown>) as Infer<TSchema>;
  }

  /**
   * Coerce a value to match a schema and fill in defaults — never throws.
   */
  public static cast<TSchema extends JSONSchema>(
    schema: TSchema,
    value: unknown
  ): Infer<TSchema> {
    return validatorFor(schema as Record<string, unknown>).validate(structuredClone(value), {
      'applyDefaults': true,
      'coerce': true,
      'collectErrors': false
    }).value as Infer<TSchema>;
  }

  /**
   * Recursively remove properties from `value` that are not declared in the
   * schema's `properties`. Does not mutate the original.
   */
  public static clean<TSchema extends JSONSchema>(
    schema: TSchema,
    value: unknown
  ): Infer<TSchema> {
    return validatorFor(schema as Record<string, unknown>).validate(structuredClone(value), {
      'collectErrors': false,
      'stripUnknownProperties': true
    }).value as Infer<TSchema>;
  }

  /**
   * Deep clone a value using structuredClone.
   */
  public static clone<T>(value: T): T {
    return structuredClone(value);
  }

  /**
   * Coerce a value's primitive types to match the schema — without applying
   * defaults or throwing.
   */
  public static convert<TSchema extends JSONSchema>(
    schema: TSchema,
    value: unknown
  ): unknown {
    return validatorFor(schema as Record<string, unknown>).validate(structuredClone(value), {
      'coerce': true,
      'collectErrors': false
    }).value;
  }

  /**
   * Produce a Changeset describing the minimal operations needed to transform `before` into `after`.
   */
  public static diff(before: unknown, after: unknown): Changeset {
    const operations: DiffOp[] = [];

    diffAt('', before, after, operations);

    return new Changeset(operations);
  }

  /**
   * Produce a deterministic hex string hash of any JSON-serialisable value.
   * Uses FNV-1a (32-bit).
   */
  public static hash(value: unknown): string {
    const str = JSON.stringify(value, keySortReplacer);
    let hashValue = 2_166_136_261;
    const fnvPrime = 16_777_619;

    for (let i = 0; i < str.length; i++) {
      hashValue ^= str.codePointAt(i) ?? 0;
      hashValue = (hashValue * fnvPrime) >>> 0;
    }

    return hashValue.toString(16);
  }

  /**
   * Full parse pipeline — Clone → Convert → Cast (defaults) → Clean → Validate → Decode
   *
   * Throws `ParseError` if validation fails after all coercions are applied.
   */
  public static parse<TSchema extends JSONSchema>(
    schema: TSchema,
    data: unknown
  ): Infer<TSchema> {
    const compiled = validatorFor(schema as Record<string, unknown>);
    const result = compiled.validate(structuredClone(data), {
      'applyDefaults': true,
      'coerce': true,
      'collectErrors': true,
      'removeAdditional': true
    });

    if (!result.valid) {
      throw new ParseError(new ValidationErrors(result.errors));
    }

    const decoder = Transform.getDecoder(schema as object);

    if (decoder !== undefined) {
      return decoder.decode(result.value) as Infer<TSchema>;
    }

    return result.value as Infer<TSchema>;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (exported for use by Changeset)
// ---------------------------------------------------------------------------

function keySortReplacer(_key: string, value: unknown): unknown {
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

function instanceFromSchema(schema: Record<string, unknown>): unknown {
  if ('default' in schema) {
    return structuredClone(schema['default']);
  }
  if ('const' in schema) {
    return schema['const'];
  }
  if (Array.isArray(schema['enum']) && (schema['enum'] as unknown[]).length > 0) {
    return (schema['enum'] as unknown[])[0];
  }

  const type = schema['type'];

  if (type === 'string') return '';
  if (type === 'number' || type === 'integer') return 0;
  if (type === 'boolean') return false;
  if (type === 'null') return null;
  if (type === 'array') return [];

  if (type === 'object') {
    const result: Record<string, unknown> = {};
    const properties = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
    const required = Array.isArray(schema['required']) ? schema['required'] as string[] : [];

    if (properties) {
      for (const key of Object.keys(properties)) {
        const propSchema = properties[key];
        const hasDefault = 'default' in propSchema || 'const' in propSchema ||
          (Array.isArray(propSchema['enum']) && (propSchema['enum'] as unknown[]).length > 0);

        if (hasDefault || required.includes(key)) {
          result[key] = instanceFromSchema(propSchema);
        }
      }
    }

    return result;
  }

  return null;
}

function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

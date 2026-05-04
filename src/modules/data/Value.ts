/**
 * Value utilities
 *
 * Instance methods (cast, clean, instantiate, convert, create) delegate to a
 * SchemaRegistry for schema-aware operations.
 *
 * Static methods (clone, hash, diff, applyOp) operate on plain values
 * without requiring a schema or registry.
 */

import type { DiffOpType } from '../../types/Diff.js';
import type { ValueInterface } from '../../interfaces/ValueImpl.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import { isPlainObject } from './DataTypes.js';
import { Hash } from '../hash/Hash.js';
import { Changeset } from './Changeset.js';
import {
  applyOp, clone
} from './Operations.js';

export class Value implements ValueInterface {
  // ---------------------------------------------------------------------------
  // Static — pure value operations (no schema/registry)
  // ---------------------------------------------------------------------------

  /**
   * Apply a single diff operation to a value and return the result.
   *
   * @param root - Value to apply the operation to
   * @param operation - Diff operation (set or delete)
   * @returns Modified value after applying the operation
   */
  static applyOp(root: unknown, operation: DiffOpType): unknown {
    return applyOp(root, operation);
  }

  /**
   * Deep-clone a value using structured cloning.
   *
   * @param value - Value to clone
   * @returns Independent deep copy of the value
   */
  public static clone<T extends unknown>(value: T): T {
    return clone(value);
  }

  /**
   * Compute the structural diff between two values as a Changeset.
   *
   * @param before - Original value
   * @param after - Modified value
   * @returns Changeset containing the operations needed to transform before into after
   */
  public static diff(before: unknown, after: unknown): Changeset {
    const operations: DiffOpType[] = [];

    diffAt('', before, after, operations);

    return new Changeset(operations);
  }

  /**
   * Compute a deterministic FNV-1a hash of a JSON-serializable value.
   *
   * @param value - Value to hash
   * @returns Hex string hash
   */
  public static hash(value: unknown): string {
    return Hash.value(value);
  }

  // ---------------------------------------------------------------------------
  // Constructor + instance — schema-aware operations (delegate to registry)
  // ---------------------------------------------------------------------------

  /**
   * Create a Value instance bound to a schema registry for schema-aware operations.
   *
   * @param registry - Schema registry to delegate operations to
   */
  constructor(private readonly registry: SchemaRegistryInterface) {}

  /**
   * Cast data to match the schema, applying coercion rules.
   *
   * @param schemaId - The $id of the schema to cast against
   * @param data - Data to cast
   * @returns Coerced value
   * @throws {@link CoercionError} When data cannot be cast to the schema
   */
  public cast(schemaId: string, data: unknown): unknown {
    return this.registry.cast(schemaId, data);
  }

  /**
   * Strip unknown properties from data according to the schema.
   *
   * @param schemaId - The $id of the schema to clean against
   * @param data - Data to clean
   * @returns Data with unknown properties removed
   * @throws {@link CoercionError} When data fails validation after cleaning
   */
  public clean(schemaId: string, data: unknown): unknown {
    return this.registry.clean(schemaId, data);
  }

  /**
   * Convert data by applying coercion and defaults according to the schema.
   *
   * @param schemaId - The $id of the schema to convert against
   * @param data - Data to convert
   * @returns Converted value with coercion and defaults applied
   * @throws {@link CoercionError} When data cannot be converted to the schema
   */
  public convert(schemaId: string, data: unknown): unknown {
    return this.registry.convert(schemaId, data);
  }

  /**
   * Create a default instance of a schema by synthesizing zero values for required properties.
   *
   * @param schemaId - The $id of the schema to create a default for
   * @returns Default value matching the schema
   * @throws {@link SchemaError} When the schema is not registered
   */
  public create(schemaId: string): unknown {
    return this.registry.create(schemaId);
  }

  /**
   * Coerce data against the schema, applying defaults and validating.
   *
   * @param schemaId - The $id of the schema to coerce against
   * @param data - Data to coerce
   * @returns Coerced and validated value
   * @throws {@link CoercionError} When data fails validation
   */
  public instantiate(schemaId: string, data: unknown): unknown {
    return this.registry.instantiate(schemaId, data);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function diffAt(path: string, before: unknown, after: unknown, ops: DiffOpType[]): void {
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


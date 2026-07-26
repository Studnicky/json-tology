/**
 * Value utilities
 *
 * Instance methods (cast, clean, instantiate, convert, create) delegate to a
 * SchemaRegistry for schema-aware operations.
 *
 * Static method (diff) owns the internal diffAt walker and is not a wrapper.
 * For clone and apply operations use the Operations class.
 * For hash operations use Hash.value().
 */

import type { DiffOpEntity } from '../../entities/DiffOpEntity.js';
import type { ValueInterface } from '../../interfaces/ValueInterface.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistryInterface.js';
import { DataType } from './DataType.js';
import { Changeset } from './Changeset.js';

export class Value implements ValueInterface {
  // ---------------------------------------------------------------------------
  // Static — pure value operations (no schema/registry)
  // ---------------------------------------------------------------------------

  /**
   * Compute the structural diff between two values as a Changeset.
   *
   * @param before - Original value
   * @param after - Modified value
   * @returns Changeset containing the operations needed to transform before into after
   */
  public static diff(before: unknown, after: unknown): Changeset {
    const operations: DiffOpEntity.Type[] = [];

    Value.diffAt('', before, after, operations);

    return new Changeset(operations);
  }

  private static diffAt(path: string, before: unknown, after: unknown, ops: DiffOpEntity.Type[]): void {
    if (DataType.isRecord(before) && DataType.isRecord(after)) {
      const beforeObject = before;
      const afterObject = after;

      for (const key of Object.keys(beforeObject)) {
        const child = `${path}/${key}`;

        if (key in afterObject) {
          Value.diffAt(child, beforeObject[key], afterObject[key], ops);
        } else {
          ops.push({
            'op': 'delete',
            'path': child
          });
        }
      }
      for (const key of Object.keys(afterObject)) {
        if (!(key in beforeObject)) {
          const value = afterObject[key];

          ops.push({
            'op': 'set',
            'path': `${path}/${key}`,
            'value': value
          });
        }
      }
    } else if (Array.isArray(before) && Array.isArray(after)) {
      const bl = before.length;
      const al = after.length;
      const minimumLength = Math.min(bl, al);

      for (let i = 0; i < minimumLength; i++) {
        Value.diffAt(`${path}/${i}`, before[i], after[i], ops);
      }
      const afterArray = after as unknown[];

      for (let i = minimumLength; i < al; i++) {
        const value = afterArray[i];

        ops.push({
          'op': 'set',
          'path': `${path}/${i}`,
          'value': value
        });
      }
      for (let i = minimumLength; i < bl; i++) {
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
   * @throws {@link SchemaError} When the schema is not registered
   * @throws {@link CoercionError} When the data cannot be coerced to satisfy the schema
   */
  public cast(schemaId: string, data: unknown): unknown {
    const result = this.registry.cast(schemaId, data);

    return result;
  }

  /**
   * Strip unknown properties from data according to the schema.
   *
   * @param schemaId - The $id of the schema to clean against
   * @param data - Data to clean
   * @returns Data with unknown properties removed
   * @throws {@link SchemaError} When the schema is not registered
   */
  public clean(schemaId: string, data: unknown): unknown {
    const result = this.registry.clean(schemaId, data);

    return result;
  }

  /**
   * Convert data by applying coercion and defaults according to the schema.
   *
   * @param schemaId - The $id of the schema to convert against
   * @param data - Data to convert
   * @returns Converted value with coercion and defaults applied
   * @throws {@link SchemaError} When the schema is not registered
   * @throws {@link CoercionError} When the data cannot be coerced to satisfy the schema
   */
  public convert(schemaId: string, data: unknown): unknown {
    const result = this.registry.convert(schemaId, data);

    return result;
  }

  /**
   * Create a default instance of a schema by synthesizing zero values for required properties.
   *
   * @param schemaId - The $id of the schema to create a default for
   * @returns Default value matching the schema
   * @throws {@link SchemaError} When the schema is not registered
   */
  public create(schemaId: string): unknown {
    const result = this.registry.create(schemaId);

    return result;
  }

  /**
   * Coerce data against the schema, applying defaults and validating.
   *
   * @param schemaId - The $id of the schema to coerce against
   * @param data - Data to coerce
   * @returns Coerced and validated value
   * @throws {@link InstantiationError} When data fails validation
   * @throws {@link DecodeError} When a decode transform fails
   */
  public instantiate(schemaId: string, data: unknown): unknown {
    const result = this.registry.instantiate(schemaId, data);

    return result;
  }
}


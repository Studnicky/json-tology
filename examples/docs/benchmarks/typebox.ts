/**
 * TypeBox Value API wrapper with proper types.
 *
 * Wraps @sinclair/typebox's Value methods to provide clean, typed access.
 */

import { Value } from '@sinclair/typebox/value';
import type { TSchema } from '@sinclair/typebox';

export class TypeBoxValue {
  /**
   * Cleans an object by removing properties not declared in the schema.
   */
  public static clean<T extends TSchema>(schema: T, value: unknown): unknown {
    return Value.Clean(schema, value);
  }

  /**
   * Converts a value to match the schema type (coercion).
   */
  public static convert<T extends TSchema>(schema: T, value: unknown): unknown {
    return Value.Convert(schema, value);
  }

  /**
   * Generates a structural diff between two values.
   */
  public static diff(left: unknown, right: unknown): unknown[] {
    return [...Value.Diff(left, right)];
  }
}

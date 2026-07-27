import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { SetOpEntity } from './SetOpEntity.js';
import { DelOpEntity } from './DelOpEntity.js';

/**
 * Diff operation — a set or a delete.
 */
export namespace DiffOpEntity {
  export const Schema = {
    'oneOf': [
      SetOpEntity.Schema,
      DelOpEntity.Schema
    ]
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    if (value.op === 'set') {
      return typeof value.path === 'string' && 'value' in value;
    }

    return value.op === 'delete' && typeof value.path === 'string';
  }
}

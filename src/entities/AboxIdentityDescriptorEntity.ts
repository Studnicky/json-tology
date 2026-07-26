import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * Describes the inverse-functional identity of a class: which class owns the
 * identity, which predicate uniquely identifies its instances, and which range
 * primitive carries that identity value.
 *
 * Derived from the canonical schema graph (the property node whose semantics
 * are `inverseFunctional`), so the owning class is unambiguous even when the
 * flat predicate is shared by foreign-key holders (`Order.customerId`,
 * `Review.customerId`) whose declarations are not inverse-functional.
 */
export namespace AboxIdentityDescriptorEntity {
  export const Schema = {
    'properties': {
      'owningClass': { 'type': 'string' },
      'predicate': { 'type': 'string' },
      'range': { 'type': 'string' }
    },
    'required': [
      'owningClass',
      'predicate',
      'range'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.owningClass === 'string'
      && typeof value.predicate === 'string'
      && typeof value.range === 'string';
  }
}

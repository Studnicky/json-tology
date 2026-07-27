import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';

/**
 * All boolean semantics flags extracted from the raw schema object and the
 * resolved jt:config.
 *
 * @remarks
 * Consolidates all `schema.x === true` extractions into one named shape to
 * keep `Semantics.build` within complexity limits. Internal to
 * `SchemaFieldExtractor.booleanFlags` in
 * `src/modules/graph/SchemaGraphSupport.ts`.
 */
export namespace BooleanFlagsEntity {
  export const Schema = {
    'properties': {
      'asymmetric': { 'type': 'boolean' },
      'computed': { 'type': 'boolean' },
      'deprecated': { 'type': 'boolean' },
      'functional': { 'type': 'boolean' },
      'hasConst': { 'type': 'boolean' },
      'hasDefault': { 'type': 'boolean' },
      'inverseFunctional': { 'type': 'boolean' },
      'iriRef': { 'type': 'boolean' },
      'irreflexive': { 'type': 'boolean' },
      'jtFrozen': { 'type': 'boolean' },
      'readOnly': { 'type': 'boolean' },
      'recursiveAnchor': { 'type': 'boolean' },
      'reflexive': { 'type': 'boolean' },
      'symmetric': { 'type': 'boolean' },
      'transitive': { 'type': 'boolean' },
      'uniqueItems': { 'type': 'boolean' },
      'writeOnly': { 'type': 'boolean' }
    },
    'required': [
      'asymmetric',
      'computed',
      'deprecated',
      'functional',
      'hasConst',
      'hasDefault',
      'inverseFunctional',
      'iriRef',
      'irreflexive',
      'jtFrozen',
      'readOnly',
      'recursiveAnchor',
      'reflexive',
      'symmetric',
      'transitive',
      'uniqueItems',
      'writeOnly'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.asymmetric === 'boolean'
      && typeof value.computed === 'boolean'
      && typeof value.deprecated === 'boolean'
      && typeof value.functional === 'boolean'
      && typeof value.hasConst === 'boolean'
      && typeof value.hasDefault === 'boolean'
      && typeof value.inverseFunctional === 'boolean'
      && typeof value.iriRef === 'boolean'
      && typeof value.irreflexive === 'boolean'
      && typeof value.jtFrozen === 'boolean'
      && typeof value.readOnly === 'boolean'
      && typeof value.recursiveAnchor === 'boolean'
      && typeof value.reflexive === 'boolean'
      && typeof value.symmetric === 'boolean'
      && typeof value.transitive === 'boolean'
      && typeof value.uniqueItems === 'boolean'
      && typeof value.writeOnly === 'boolean';
  }
}

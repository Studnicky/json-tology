import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';

/**
 * Options object for {@link buildEntityFiles} and {@link buildIndexSource}.
 *
 * @remarks
 * Bundles the common registry-directory context into a single shape so
 * helpers with many parameters can accept a single options object.
 *
 * @example
 * ```ts
 * buildEntityFiles({ sortedIris, nameMap, schemas, ts, sourceLabel });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link OwlCodegen.toRegistryFiles}
 * @group OWL Codegen
 */
export namespace RegistryDirContextEntity {
  export const Schema = {
    'additionalProperties': false,
    'properties': {
      /** Map from IRI to PascalCase identifier. */
      'nameMap': {
        'additionalProperties': { 'type': 'string' },
        'type': 'object'
      },
      /** Name of the schema-set reference-map type exported by `index.ts`. */
      'refsName': { 'type': 'string' },
      /** Sorted IRIs in emission order. */
      'sortedIris': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      /** Human-readable source label, or empty string. */
      'sourceLabel': { 'type': 'string' },
      /** ISO-8601 timestamp string. */
      'ts': { 'type': 'string' }
    },
    'required': [
      'nameMap',
      'refsName',
      'sortedIris',
      'sourceLabel',
      'ts'
    ],
    'type': 'object'
  } as const satisfies JSONSchema;

  // `schemas` holds JsonSchemaDocumentObjectType[] — a recursive JSON-Schema
  // meta-schema shape that cannot itself be expressed as JSON Schema without
  // infinite regress, so it is composed in as a documented exception.
  //
  // `@studnicky/type-alias-invariants` (no-fix exception): flags this alias as
  // an interface contract because `JsonSchemaDocumentObjectType` transitively
  // references `Record`/mapped-type composition deep in the JSON-Schema-of-
  // JSON-Schema type graph. There is no interface remedy — `folder-content-
  // shape` requires an entity namespace's `Type` to be a `type` alias, not an
  // `interface` — and no schema-derived remedy, since a JSON Schema cannot
  // describe JSON Schema itself without infinite regress.
  export type Type = InferType<typeof Schema> & { 'schemas': JsonSchemaDocumentObjectType[] };

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.refsName === 'string'
      && typeof value.sourceLabel === 'string'
      && typeof value.ts === 'string'
      && typeof value.nameMap === 'object' && value.nameMap !== null
      && Array.isArray(value.sortedIris)
      && Array.isArray(value.schemas);
  }
}

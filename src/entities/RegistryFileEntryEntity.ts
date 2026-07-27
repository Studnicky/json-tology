import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { REGISTRY_FILE_ENTRY_SCHEMA } from '../constants/SCHEMAS.js';

/**
 * Describes one entity file produced by {@link OwlCodegen.toRegistryFiles}.
 *
 * Shares its shape with {@link GenerateRegistryDirectoryEntityFileEntity} via
 * the canonical `REGISTRY_FILE_ENTRY_SCHEMA` — kept as its own entity because
 * it backs a distinct public function contract.
 *
 * @category Codegen
 * @since 0.18.0
 * @group OWL Codegen
 */
export namespace RegistryFileEntryEntity {
  export const Schema = { ...REGISTRY_FILE_ENTRY_SCHEMA } as const satisfies JSONSchema;

  export type Type = InferType<typeof Schema>;

  export function validate(candidate: unknown): candidate is Type {
    if (typeof candidate !== 'object' || candidate === null) {
      return false;
    }

    const value = candidate as Record<string, unknown>;

    return typeof value.iri === 'string'
      && typeof value.name === 'string'
      && typeof value.path === 'string'
      && typeof value.source === 'string';
  }
}

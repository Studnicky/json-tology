import type { JSONSchema } from 'json-schema-to-ts';
import type { InferType } from '../types/Schema.js';
import { REGISTRY_FILE_ENTRY_SCHEMA } from '../constants/SCHEMAS.js';

/**
 * A generated entity file returned by {@link generateRegistryDirectory}.
 *
 * Carries the file source and a relative path (e.g. `entities/Person.ts`).
 * The Node-only writer (`writeRegistryDirectory`) resolves these to absolute
 * paths before writing and returns {@link WrittenEntityFileEntity.Type} instead.
 *
 * Shares its shape with {@link RegistryFileEntryEntity} via the canonical
 * `REGISTRY_FILE_ENTRY_SCHEMA` — kept as its own entity because it backs a
 * distinct public function contract (browser-safe `generateRegistryDirectory`
 * vs. `OwlCodegen.toRegistryFiles`).
 */
export namespace GenerateRegistryDirectoryEntityFileEntity {
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

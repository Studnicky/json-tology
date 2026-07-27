import type { InferType } from '../types/Schema.js';
import type { OWL_REGISTRY_DIR_OPTIONS_SCHEMA } from '../constants/SCHEMAS.js';

/**
 * Options controlling registry-directory-mode code generation.
 *
 * A consumer-facing option bag with `exactOptionalPropertyTypes`-style
 * `| undefined` fields — TS-only ergonomics, not JSON-representable data —
 * so it is authored as an interface extending the schema-derived base rather
 * than a `type`.
 */
export interface OwlRegistryDirOptionsInterface extends InferType<typeof OWL_REGISTRY_DIR_OPTIONS_SCHEMA> {
  /**
   * Base IRI used in the `JsonTology.create` call.
   * Defaults to an IRI derived from the first schema `$id`.
   */
  'baseIri'?: string | undefined;

  /**
   * Extra comment lines inserted after the auto-generated banner in the
   * `index.ts` file. Each element is emitted as a `// ` comment line.
   */
  'header'?: string[] | undefined;

  /**
   * Name of the exported registry constant and schemas array.
   * E.g. `'foaf'` → `foafSchemas`, `foaf`.
   * Defaults to `'registry'`.
   */
  'registryConstName'?: string | undefined;

  /**
   * Human-readable label for the source (file path or IRI) emitted in the
   * auto-generated banner.
   */
  'sourceLabel'?: string | undefined;
}

import type { InferType } from '../types/Schema.js';
import type { QuadInterface } from './QuadInterface.js';
import type { GENERATE_REGISTRY_DIRECTORY_OPTIONS_SCHEMA } from '../constants/SCHEMAS.js';

/**
 * Options accepted by {@link generateRegistryDirectory} (browser-safe).
 *
 * Does not include an `outDir` path — file writing is handled by
 * `writeRegistryDirectory` in `json-tology/owl-gen-node`.
 *
 * A consumer-facing option bag: `input` accepts a {@link QuadInterface} array
 * (a runtime RDF/JS quad, not schema-derived data) and the remaining fields use
 * `exactOptionalPropertyTypes`-style `| undefined` — TS-only ergonomics — so it
 * is authored as an interface extending the schema-derived base rather than a
 * `type`.
 */
export interface GenerateRegistryDirectoryOptionsInterface
  extends InferType<typeof GENERATE_REGISTRY_DIRECTORY_OPTIONS_SCHEMA> {
  /**
   * Override the base IRI. When omitted the generator derives it from
   * the first schema `$id` in the import result.
   */
  'baseIri'?: string | undefined;

  /**
   * Extra header comment lines inserted after the banner in `index.ts`.
   */
  'header'?: string[] | undefined;

  /**
   * The OWL 2 TBox source — a JSON-LD object, a JSON-LD string, or an
   * array of {@link QuadInterface} quads.
   */
  'input': QuadInterface[] | Record<string, unknown> | string;

  /**
   * Registry constant name (e.g. `'acl'` → `aclSchemas`, `acl`).
   * Defaults to `'registry'`.
   */
  'name'?: string | undefined;

  /**
   * Human-readable label emitted in the banner (file path or IRI).
   * When omitted, derived from `input` when it is a string.
   */
  'sourceLabel'?: string | undefined;
}

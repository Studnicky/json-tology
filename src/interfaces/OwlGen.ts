/**
 * OWL gen interfaces.
 *
 * Public API contracts for the owl-gen entry point — programmatic OWL 2 TBox
 * → TypeScript code generation.
 */

import type { QuadInterface } from './Quad.js';

/**
 * Options accepted by {@link generateFromTbox}.
 */
export interface GenerateFromTboxOptions {
  /**
   * Override the base IRI. When omitted the generator derives it from
   * the first schema `$id` in the import result.
   */
  readonly 'baseIRI'?: string | undefined;

  /**
   * Extra header comment lines inserted after the banner.
   */
  readonly 'header'?: readonly string[] | undefined;

  /**
   * The OWL 2 TBox source — a JSON-LD object, a JSON-LD string, or an
   * array of {@link QuadInterface} quads.
   */
  readonly 'input': object | QuadInterface[] | string;

  /**
   * Registry constant name (e.g. `'acl'` → `aclSchemas`, `acl`).
   * Defaults to `'registry'`.
   */
  readonly 'name'?: string | undefined;

  /**
   * Output file path. When provided, the source is written to that path
   * and the function returns `void`. When omitted, the source string is
   * returned.
   */
  readonly 'output'?: string | undefined;

  /**
   * Human-readable label emitted in the banner (file path or IRI).
   * When omitted, derived from `input` when it is a string.
   */
  readonly 'sourceLabel'?: string | undefined;
}

/**
 * Options accepted by {@link generateRegistryDirectory}.
 */
export interface GenerateRegistryDirectoryOptions {
  /**
   * Override the base IRI. When omitted the generator derives it from
   * the first schema `$id` in the import result.
   */
  readonly 'baseIRI'?: string | undefined;

  /**
   * Extra header comment lines inserted after the banner in `index.ts`.
   */
  readonly 'header'?: readonly string[] | undefined;

  /**
   * The OWL 2 TBox source — a JSON-LD object, a JSON-LD string, or an
   * array of {@link QuadInterface} quads.
   */
  readonly 'input': object | QuadInterface[] | string;

  /**
   * Registry constant name (e.g. `'acl'` → `aclSchemas`, `acl`).
   * Defaults to `'registry'`.
   */
  readonly 'name'?: string | undefined;

  /**
   * Directory to write the generated files to.
   * Created recursively when it does not yet exist.
   * An `entities/` subdirectory is created inside it.
   */
  readonly 'outDir': string;

  /**
   * Human-readable label emitted in the banner (file path or IRI).
   * When omitted, derived from `input` when it is a string.
   */
  readonly 'sourceLabel'?: string | undefined;
}

/**
 * Description of an entity file written by {@link generateRegistryDirectory}.
 */
export interface GenerateRegistryDirectoryEntityFile {
  /** Full IRI of the OWL class. */
  readonly 'iri': string;
  /** PascalCase class name without `Schema` suffix. */
  readonly 'name': string;
  /** Absolute file path as written. */
  readonly 'path': string;
}

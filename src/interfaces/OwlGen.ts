/**
 * OWL gen interfaces.
 *
 * Public API contracts for the owl-gen and owl-gen-node entry points —
 * programmatic OWL 2 TBox → TypeScript code generation.
 *
 * Architecture: browser-safe codegen core (`owl-gen`) returns strings/data;
 * file-writing is in the Node-only skin (`owl-gen-node`).
 *
 * @experimental This surface is subject to change before 1.0. The generated
 * output format and option shapes may evolve as the codegen path matures.
 */

import type { QuadInterface } from './Quad.js';

/**
 * Options accepted by {@link generateFromTbox} (browser-safe).
 *
 * Does not include an `output` path — file writing is handled by
 * `writeFromTbox` in `json-tology/owl-gen-node`.
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
   * Human-readable label emitted in the banner (file path or IRI).
   * When omitted, derived from `input` when it is a string.
   */
  readonly 'sourceLabel'?: string | undefined;
}

/**
 * Options accepted by {@link generateRegistryDirectory} (browser-safe).
 *
 * Does not include an `outDir` path — file writing is handled by
 * `writeRegistryDirectory` in `json-tology/owl-gen-node`.
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
   * Human-readable label emitted in the banner (file path or IRI).
   * When omitted, derived from `input` when it is a string.
   */
  readonly 'sourceLabel'?: string | undefined;
}

/**
 * A generated entity file returned by {@link generateRegistryDirectory}.
 *
 * Carries the file source and a relative path (e.g. `entities/Person.ts`).
 * The Node-only writer (`writeRegistryDirectory`) resolves these to absolute
 * paths before writing and returns {@link WrittenEntityFile} instead.
 */
export interface GenerateRegistryDirectoryEntityFile {
  /** Full IRI of the OWL class. */
  readonly 'iri': string;
  /** PascalCase class name without `Schema` suffix. */
  readonly 'name': string;
  /**
   * Relative path inside the output directory, e.g. `entities/Person.ts`.
   * Resolve against an `outDir` to get the absolute write location.
   */
  readonly 'path': string;
  /** Generated TypeScript source for this entity file. */
  readonly 'source': string;
}

/**
 * Data returned by {@link generateRegistryDirectory} (browser-safe).
 */
export interface GenerateRegistryDirectoryResult {
  /** Generated entity files (relative paths + source strings). */
  readonly 'entityFiles': readonly GenerateRegistryDirectoryEntityFile[];
  /** Generated source for `index.ts`. */
  readonly 'indexSource': string;
}

/**
 * Metadata for a file written to disk by `writeRegistryDirectory`
 * (Node-only, `json-tology/owl-gen-node`).
 *
 * Mirrors the pre-refactor `GenerateRegistryDirectoryEntityFile` shape for
 * consumers that previously depended on written absolute paths.
 */
export interface WrittenEntityFile {
  /** Full IRI of the OWL class. */
  readonly 'iri': string;
  /** PascalCase class name without `Schema` suffix. */
  readonly 'name': string;
  /** Absolute file path as written to disk. */
  readonly 'path': string;
}

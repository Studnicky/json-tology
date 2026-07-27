import type { QuadInterface } from './QuadInterface.js';

/**
 * Fields shared by the two OWL-codegen entry points —
 * {@link GenerateFromTboxOptionsInterface} and
 * {@link GenerateRegistryDirectoryOptionsInterface} — for supplying the TBox
 * source and generation metadata. `input` accepts a {@link QuadInterface}
 * array (a runtime RDF/JS quad, not schema-derived data), so this bag stays
 * an `interface` rather than a `type`.
 */
export interface OwlCodegenSourceOptionsInterface {
  /**
   * Override the base IRI. When omitted the generator derives it from
   * the first schema `$id` in the import result.
   */
  'baseIri'?: string | undefined;

  /**
   * Extra header comment lines inserted after the banner.
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

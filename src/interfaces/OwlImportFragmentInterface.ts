import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';
import type { OwlImportSharedFieldsInterface } from './OwlImportSharedFieldsInterface.js';

/**
 * The value returned by each dispatcher after processing its axiom group.
 *
 * The orchestrator merges all fragments before constructing the final
 * OwlImportResultInterface.
 *
 * @remarks
 * Each field is a partial accumulation — dispatchers that do not produce a
 * given category return an empty array or empty Map for that field. The
 * orchestrator deep-merges all fragments, with later entries winning on
 * per-key conflicts in `schemaDeltas`.
 *
 * Authored as an interface rather than a `type`: `schemaDeltas` is a real
 * `ReadonlyMap` keyed by class IRI, not schema-derivable pure data (see
 * `OwlImportSharedFieldsInterface` for the rationale on the inherited fields).
 *
 * @example
 * ```ts
 * const fragment: OwlImportFragmentInterface = {
 *   characteristics: [], differentFrom: [], individuals: [], invariants: [],
 *   sameAs: [], schemaDeltas: new Map(),
 * };
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportResultInterface}
 * @group Import
 */
export interface OwlImportFragmentInterface extends OwlImportSharedFieldsInterface {
  /** Per-class schema property deltas: classIri → partial JSON Schema object. */
  readonly 'schemaDeltas': ReadonlyMap<string, JsonSchemaDocumentObjectType>;
}

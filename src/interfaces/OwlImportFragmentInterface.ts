import type { InvariantType } from '../types/Invariant.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';
import type { PropertyCharacteristicEntity } from '../entities/PropertyCharacteristicEntity.js';

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
 * Authored as an interface rather than a `type`: `individuals[].properties` is
 * an open `Record<string, unknown>` bag (arbitrary ABox property values, not
 * fixed by any schema) and `schemaDeltas` is a real `ReadonlyMap` keyed by
 * class IRI, neither of which is schema-derivable pure data.
 *
 * @example
 * ```ts
 * const fragment: OwlImportFragmentInterface = {
 *   characteristics: [], individuals: [], invariants: [],
 *   sameAs: [], schemaDeltas: new Map(),
 * };
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportResultInterface}
 * @group Import
 */
export interface OwlImportFragmentInterface {
  /** OWL property characteristics discovered during import (e.g. Functional, Transitive). */
  readonly 'characteristics': readonly PropertyCharacteristicEntity.Type[];

  /** owl:differentFrom pairs (individual IRI pairs asserted distinct). */
  readonly 'differentFrom': ReadonlyArray<[string, string]>;

  /** Named individuals (ABox assertions) found in the TBox input. */
  readonly 'individuals': ReadonlyArray<{
    'iri': string;
    'properties': Record<string, unknown>;
    'types': string[];
  }>;

  /** Per-schema structural invariants produced during import (e.g. min/max cardinality checks). */
  readonly 'invariants': ReadonlyArray<{ 'invariant': InvariantType;
    'schemaId': string; }>;

  /** owl:sameAs pairs (individual IRI pairs asserted identical). */
  readonly 'sameAs': ReadonlyArray<[string, string]>;

  /** Per-class schema property deltas: classIri → partial JSON Schema object. */
  readonly 'schemaDeltas': ReadonlyMap<string, JsonSchemaDocumentObjectType>;
}

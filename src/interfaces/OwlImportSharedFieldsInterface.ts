import type { InvariantType } from '../types/Invariant.js';
import type { PropertyCharacteristicEntity } from '../entities/PropertyCharacteristicEntity.js';

/**
 * Fields common to every stage of OWL import accumulation: per-axiom-group
 * fragments (`OwlImportFragmentInterface`) and the merged final result
 * (`OwlImportResultInterface`) both carry these verbatim.
 *
 * @remarks
 * Authored as an interface rather than a `type`: `individuals[].properties`
 * is an open `Record<string, unknown>` bag (arbitrary ABox property values,
 * not fixed by any schema), which is not schema-derivable pure data.
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportFragmentInterface}
 * @see {@link OwlImportResultInterface}
 */
export interface OwlImportSharedFieldsInterface {
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
}

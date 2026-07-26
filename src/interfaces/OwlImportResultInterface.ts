import type { InvariantType } from '../types/Invariant.js';
import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';
import type { PropertyCharacteristicEntity } from '../entities/PropertyCharacteristicEntity.js';
import type { UnsupportedAxiomEntity } from '../entities/UnsupportedAxiomEntity.js';

/**
 * The top-level result returned by OwlImporter.import() and
 * JsonTology.fromTbox().
 *
 * @remarks
 * Aggregates the output of all per-axiom-group dispatchers after merging.
 * `schemas` contains the reconstructed JSON Schema objects for every class
 * declared in the TBox. `unsupported` logs axiom IRIs that no dispatcher
 * recognised — useful for diagnosing incomplete imports.
 *
 * Authored as an interface rather than a `type`: `individuals[].properties` is
 * an open `Record<string, unknown>` bag and `schemas` holds full
 * `JsonSchemaDocumentObjectType` documents — a recursive schema-of-schemas
 * shape that cannot itself be expressed as a JSON Schema without infinite
 * regress — so neither field is schema-derivable pure data.
 *
 * @example
 * ```ts
 * const result = await jt.fromTbox(owlQuads);
 * for (const schema of result.schemas) {
 *   jt.register(schema);
 * }
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportFragmentInterface}
 * @group Import
 */
export interface OwlImportResultInterface {
  /** Property characteristics harvested from property axioms. */
  readonly 'characteristics': readonly PropertyCharacteristicEntity.Type[];

  /** owl:differentFrom pairs extracted from the input graph. */
  readonly 'differentFrom': ReadonlyArray<[string, string]>;

  /** Named individuals (ABox assertions) found in the TBox input. */
  readonly 'individuals': ReadonlyArray<{
    'iri': string;
    'properties': Record<string, unknown>;
    'types': string[];
  }>;

  /** Structural invariants derived from OWL axioms (e.g. cardinality constraints). */
  readonly 'invariants': ReadonlyArray<{ 'invariant': InvariantType;
    'schemaId': string; }>;

  /** owl:sameAs pairs extracted from the input graph. */
  readonly 'sameAs': ReadonlyArray<[string, string]>;

  /** JSON Schema objects reconstructed from TBox class declarations. */
  readonly 'schemas': JsonSchemaDocumentObjectType[];

  /**
   * Axiom/predicate IRIs for valid constructs a dispatcher recognized but does
   * not project into the schema graph. Populated via `ctx.reportUnsupported`.
   */
  readonly 'unsupported': readonly UnsupportedAxiomEntity.Type[];
}

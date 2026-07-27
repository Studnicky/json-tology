import type { JsonSchemaDocumentObjectType } from '../types/Schema.js';
import type { UnsupportedAxiomEntity } from '../entities/UnsupportedAxiomEntity.js';
import type { OwlImportSharedFieldsInterface } from './OwlImportSharedFieldsInterface.js';

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
 * Authored as an interface rather than a `type`: `schemas` holds full
 * `JsonSchemaDocumentObjectType` documents — a recursive schema-of-schemas
 * shape that cannot itself be expressed as a JSON Schema without infinite
 * regress — so it is not schema-derivable pure data (see
 * `OwlImportSharedFieldsInterface` for the rationale on the inherited fields).
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
export interface OwlImportResultInterface extends OwlImportSharedFieldsInterface {
  /** JSON Schema objects reconstructed from TBox class declarations. */
  readonly 'schemas': JsonSchemaDocumentObjectType[];

  /**
   * Axiom/predicate IRIs for valid constructs a dispatcher recognized but does
   * not project into the schema graph. Populated via `ctx.reportUnsupported`.
   */
  readonly 'unsupported': readonly UnsupportedAxiomEntity.Type[];
}

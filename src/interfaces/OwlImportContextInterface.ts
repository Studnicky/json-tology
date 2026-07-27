import type { CurieInterface } from './CurieInterface.js';
import type { LoggerInterface } from './LoggerInterface.js';
import type { PrefixMapInterface } from './PrefixMapInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * Context threaded into every dispatcher call.
 *
 * Provides read-only access to the graph, prefix machinery, and IRI
 * membership sets so dispatchers can resolve and validate without
 * re-deriving those structures.
 *
 * @remarks
 * The orchestrator constructs one `OwlImportContextInterface` per import session
 * and passes the same instance to every dispatcher. Dispatchers must not
 * mutate context fields; they use `reportUnsupported` to record unhandled
 * axioms.
 *
 * @example
 * ```ts
 * function myDispatcher(_quads: QuadInterface[], ctx: OwlImportContextInterface): OwlImportFragmentInterface {
 *   const expanded = ctx.curie.expand('owl:Class');
 *   ctx.reportUnsupported('owl:unknownAxiom', null);
 *   return { characteristics: [], individuals: [], invariants: [], sameAs: [], schemaDeltas: new Map() };
 * }
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportFragmentInterface}
 * @group Import
 */
export interface OwlImportContextInterface {
  /** Set of all class IRIs present in the input graph. */
  readonly 'allClassIris': ReadonlySet<string>;

  /** Set of all property IRIs (datatype and object) present in the input graph. */
  readonly 'allPropertyIris': ReadonlySet<string>;

  /** Base IRI of the import session (from OwlImporter constructor options). */
  readonly 'baseIri': StringValueEntity.Type;

  /** CURIE handler for expanding and compacting IRIs. */
  readonly 'curie': CurieInterface;

  /** The SchemaGraph built from the input quads. */
  readonly 'graph': SchemaGraphInterface;

  /**
   * Returns true when the given IRI is a supported XSD or json-tology datatype.
   * Used by Datatypes and PropertyRestrictions dispatchers to validate range IRIs.
   */
  'isDatatype': (iri: string) => boolean;

  /** Optional logger; defaults to SILENT_LOGGER at the call site. */
  'logger'?: LoggerInterface;

  /** Prefix-to-IRI map in effect for the import session. */
  readonly 'prefixes': PrefixMapInterface;

  /**
   * Record an axiom or predicate IRI that the dispatcher does not handle.
   * The orchestrator accumulates these into OwlImportResultInterface.unsupported.
   */
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void;
}
